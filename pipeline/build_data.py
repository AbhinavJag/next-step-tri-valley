"""Build docs/data.json for Next Step Tri-Valley.

Inputs (all public, in data/raw/):
  - oews_may2025_sf_msa_and_soc_crosswalk.txt
      BLS OEWS May 2025 wages for the San Francisco-Oakland-Fremont, CA metro
      (area 41860, which includes Dublin, Pleasanton and Livermore), plus the
      BLS SOC 2010 -> 2018 crosswalk rows where a code changed.
  - onet_related_30_3.txt
      O*NET 30.3 "Related Occupations" (top related jobs for each occupation)
      and Job Zones, in a compact form (see README).
  - AIOE_DataAppendix.xlsx
      AI Occupational Exposure scores, Felten, Raj and Seamans (2021).
      Downloaded from github.com/AIOE-Data/AIOE if missing.
  - ../training.json  hand-built list of local programs and the jobs they lead to.

Run:  python3 pipeline/build_data.py
"""
import json, os, statistics, urllib.request
from collections import defaultdict

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
RAW = os.path.join(ROOT, "data", "raw")
AIOE_URL = "https://raw.githubusercontent.com/AIOE-Data/AIOE/main/AIOE_DataAppendix.xlsx"


def load_oews():
    occ, xwalk, section = {}, defaultdict(list), None
    for line in open(os.path.join(RAW, "oews_may2025_sf_msa_and_soc_crosswalk.txt")):
        line = line.rstrip("\n")
        if line.startswith("# OEWS"):
            section = "oews"; continue
        if line.startswith("# BLS SOC"):
            section = "xwalk"; continue
        if not line:
            continue
        f = line.split("|")
        if section == "oews":
            def num(x):
                try:
                    return int(float(x))
                except ValueError:
                    return None  # '*' = not released, '#' = above top code
            occ[f[0]] = dict(soc=f[0], title=f[1], emp=num(f[2]), p10=num(f[3]),
                             p25=num(f[4]), median=num(f[5]), p75=num(f[6]), p90=num(f[7]),
                             topcoded=(f[5] == "#"))
        else:
            xwalk[f[1]].append(f[0])  # soc2018 -> [soc2010, ...]
    return occ, xwalk


def load_onet():
    codes, rel, jz = open(os.path.join(RAW, "onet_related_30_3.txt")).read().strip().split("|")
    codes = [c[:2] + "-" + c[2:] for c in codes.split(",")]
    related = {}
    for c, r in zip(codes, rel.split(",")):
        related[c] = [codes[int(i, 36)] for i in r.split(".")] if r else []
    zones = {c: int(z) for c, z in zip(codes, jz)}
    return related, zones


def load_aioe():
    path = os.path.join(RAW, "AIOE_DataAppendix.xlsx")
    if not os.path.exists(path):
        urllib.request.urlretrieve(AIOE_URL, path)
    import openpyxl
    ws = openpyxl.load_workbook(path, read_only=True)["Appendix A"]
    rows = list(ws.iter_rows(values_only=True))[1:]
    return {r[0]: float(r[2]) for r in rows if r[0] and r[2] is not None}


def pct_rank(values):
    """Percentile (0-100) of each value among all values."""
    s = sorted(values)
    n = len(s)
    out = {}
    for v in set(values):
        below = sum(1 for x in s if x < v)
        equal = sum(1 for x in s if x == v)
        out[v] = round(100 * (below + 0.5 * equal) / n)
    return out


JOB_ZONE_TEXT = {
    1: "Little or no preparation (a few days to a few months of on-the-job training)",
    2: "Some preparation (usually a high school diploma, a few months to a year of training)",
    3: "Medium preparation (usually vocational school, an associate degree, or an apprenticeship)",
    4: "Considerable preparation (usually a bachelor's degree)",
    5: "Extensive preparation (usually a graduate degree)",
}

MAJOR = {
    "11": "Management", "13": "Business and financial", "15": "Computer and math",
    "17": "Architecture and engineering", "19": "Science", "21": "Community and social service",
    "23": "Legal", "25": "Education", "27": "Arts, design, media", "29": "Healthcare practitioners",
    "31": "Healthcare support", "33": "Protective service", "35": "Food service",
    "37": "Building and grounds", "39": "Personal care", "41": "Sales",
    "43": "Office and administrative support", "45": "Farming", "47": "Construction",
    "49": "Installation and repair", "51": "Production", "53": "Transportation and moving",
}


def main():
    occ, xwalk = load_oews()
    related, zones = load_onet()
    aioe10 = load_aioe()

    # Attach AI exposure. Same code in both SOC versions -> direct match.
    # Otherwise average the SOC 2010 codes that map into this SOC 2018 code.
    matched = {"direct": 0, "crosswalk": 0, "none": 0}
    for soc, o in occ.items():
        if soc in aioe10:
            o["aioe"] = aioe10[soc]; matched["direct"] += 1
        else:
            vals = [aioe10[c] for c in xwalk.get(soc, []) if c in aioe10]
            if vals:
                o["aioe"] = statistics.mean(vals); matched["crosswalk"] += 1
            else:
                o["aioe"] = None; matched["none"] += 1

    jobs = {s: o for s, o in occ.items() if o["aioe"] is not None and o["median"] is not None}
    prank = pct_rank([o["aioe"] for o in jobs.values()])
    for o in jobs.values():
        o["exp"] = prank[o["aioe"]]
        o["band"] = "high" if o["exp"] >= 67 else ("medium" if o["exp"] >= 34 else "lower")
        o["zone"] = zones.get(o["soc"])

    training = json.load(open(os.path.join(ROOT, "data", "training.json")))
    prog_by_soc = defaultdict(list)
    for i, p in enumerate(training["programs"]):
        for t in p["leads_to"]:
            prog_by_soc[t].append(i)

    def lower_exposure_moves(soc):
        """Jobs within two O*NET 'related occupation' steps that are clearly less
        exposed to AI (10+ percentile points lower), pay at least 85% of the
        current local median, and need at most one more level of preparation. Very small local
        occupations (under 1,000 jobs) are skipped."""
        o = jobs[soc]
        first = [r for r in related.get(soc, []) if r in jobs]
        seen, cands = {soc}, []
        for depth, layer in ((1, first), (2, [q for r in first for q in related.get(r, []) if q in jobs])):
            for r in layer:
                if r in seen:
                    continue
                seen.add(r)
                c = jobs[r]
                if (c["exp"] <= o["exp"] - 10 and c["median"] >= 0.85 * o["median"] and (c["emp"] or 0) >= 1000
                        and (c["zone"] or 9) <= (o["zone"] or 0) + 1):
                    cands.append((depth, -c["median"], r))
        return [r for _, _, r in sorted(cands)[:6]]

    out_jobs = []
    for soc in sorted(jobs):
        o = jobs[soc]
        nxt = [r for r in related.get(soc, []) if r in jobs][:8]
        moves = lower_exposure_moves(soc)
        out_jobs.append({
            "s": soc, "t": o["title"], "e": o["emp"], "m": o["median"],
            "p25": o["p25"], "p75": o["p75"], "x": o["exp"], "b": o["band"],
            "z": o["zone"], "n": nxt, "mv": moves, "tr": prog_by_soc.get(soc, []),
        })

    # Region summary for the "For the city" page.
    msa_all_median = 74260  # OEWS May 2025, all occupations, area 41860
    tot = sum(o["emp"] or 0 for o in jobs.values())
    high = [o for o in jobs.values() if o["band"] == "high"]
    high_emp = sum(o["emp"] or 0 for o in high)
    squeezed = [o for o in high if o["median"] < msa_all_median]
    squeezed_emp = sum(o["emp"] or 0 for o in squeezed)
    by_major = defaultdict(lambda: [0, 0])
    for o in jobs.values():
        g = o["soc"][:2]
        by_major[g][0] += o["emp"] or 0
        if o["band"] == "high":
            by_major[g][1] += o["emp"] or 0
    office = by_major["43"]
    summary = {
        "area": "San Francisco-Oakland-Fremont, CA metro area (includes Dublin, Pleasanton and Livermore)",
        "occupations": len(jobs),
        "total_emp": tot,
        "high_emp": high_emp,
        "high_share": round(100 * high_emp / tot, 1),
        "all_median": msa_all_median,
        "squeezed_emp": squeezed_emp,
        "squeezed_jobs": [
            {"t": o["title"], "e": o["emp"], "m": o["median"], "x": o["exp"]}
            for o in sorted(squeezed, key=lambda o: -(o["emp"] or 0))[:12]
        ],
        "office_emp": office[0],
        "office_high_emp": office[1],
        "office_high_share": round(100 * office[1] / office[0], 1) if office[0] else 0,
        "by_major": sorted(
            [{"g": g, "name": MAJOR.get(g, g), "emp": v[0], "high": v[1]} for g, v in by_major.items()],
            key=lambda d: -d["high"]),
        "match": matched,
    }

    data = {"jobs": out_jobs, "programs": training["programs"], "help": training["help"],
            "zones": JOB_ZONE_TEXT, "summary": summary,
            "sources_note": "OEWS May 2025 (BLS); O*NET 30.3; AIOE (Felten, Raj and Seamans 2021)"}
    with open(os.path.join(ROOT, "docs", "data.json"), "w") as f:
        json.dump(data, f, separators=(",", ":"))
    print("jobs:", len(out_jobs), "| AIOE match:", matched)
    print("total emp:", tot, "| high-exposure emp:", high_emp, f"({summary['high_share']}%)")
    print("high exposure and below metro median pay:", squeezed_emp, "workers in", len(squeezed), "jobs")
    print("office/admin:", office, summary["office_high_share"], "% high")
    no_next = sum(1 for j in out_jobs if not j["n"])
    hi = [j for j in out_jobs if j["b"] == "high"]
    print("high-exposure jobs with at least one lower-exposure move:", sum(1 for j in hi if j["mv"]), "of", len(hi))
    print("jobs with no related jobs in data:", no_next)
    print("programs matched to jobs:", sum(1 for j in out_jobs if j["tr"]))


if __name__ == "__main__":
    main()
