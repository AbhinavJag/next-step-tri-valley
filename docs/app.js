/* Next Step Tri-Valley — runs entirely in the browser. No tracking, no server. */
(() => {
  "use strict";

  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];
  const money = n => n == null ? "n/a" : "$" + Math.round(n).toLocaleString("en-US");
  const k = n => n >= 1e6 ? (n / 1e6).toFixed(2).replace(/0$/, "") + "M" : n >= 1e4 ? Math.round(n / 1e3) + "K" : n.toLocaleString("en-US");
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  let D, JOBS = {}, INDEX = [];

  // Everyday words people type, mapped to words in official job titles.
  const SYN = {
    receptionist: "receptionists", bookkeeper: "bookkeeping", secretary: "secretaries", admin: "administrative",
    assistant: "assistants", "front desk": "receptionists", cashier: "cashiers", server: "waiters", waiter: "waiters",
    waitress: "waiters", barista: "baristas", nurse: "nurses", rn: "registered nurses", cna: "nursing assistants",
    teacher: "teachers", developer: "developers", programmer: "programmers", coder: "programmers", engineer: "engineers",
    accountant: "accountants", driver: "drivers", trucker: "truck drivers", warehouse: "laborers freight stock",
    mechanic: "mechanics", electrician: "electricians", plumber: "plumbers", cook: "cooks", chef: "chefs",
    paralegal: "paralegals", lawyer: "lawyers", "customer service": "customer service representatives",
    "call center": "customer service representatives", clerk: "clerks", "data entry": "data entry keyers",
    hr: "human resources", recruiter: "human resources specialists", payroll: "payroll", teller: "tellers",
    janitor: "janitors", cleaner: "janitors maids", security: "security guards", sales: "sales",
    manager: "managers", supervisor: "supervisors", designer: "designers", writer: "writers", analyst: "analysts",
    "medical assistant": "medical assistants", dental: "dental", pharmacy: "pharmacy", it: "computer support",
    "help desk": "computer user support", marketing: "marketing", insurance: "insurance", "real estate": "real estate",
  };

  const stem = w => w.toLowerCase().replace(/[^a-z0-9]/g, "").replace(/(ies)$/, "y").replace(/s$/, "");

  function buildIndex() {
    INDEX = D.jobs.map(j => ({ j, words: j.t.split(/[\s,/()-]+/).map(stem).filter(Boolean) }));
  }

  function search(q) {
    q = q.trim().toLowerCase();
    if (q.length < 2) return [];
    let expanded = q;
    for (const [a, b] of Object.entries(SYN)) {
      if (new RegExp("\\b" + a + "\\b").test(q)) expanded += " " + b;
    }
    const qWords = q.split(/\s+/).map(stem).filter(Boolean);
    const extra = expanded.split(/\s+/).map(stem).filter(Boolean);
    const scored = [];
    for (const { j, words } of INDEX) {
      const hit = w => words.some(x => x.startsWith(w));
      const all = qWords.every(hit);
      const some = extra.filter(hit).length;
      if (!all && !some) continue;
      let s = (all ? 100 : 0) + some * 10 + Math.log10((j.e || 1) + 1);
      if (j.t.toLowerCase().startsWith(q)) s += 50;
      scored.push([s, j, all]);
    }
    if (scored.some(x => x[2])) return scored.filter(x => x[2]).sort((a, b) => b[0] - a[0]).slice(0, 8).map(x => x[1]);
    return scored.sort((a, b) => b[0] - a[0]).slice(0, 8).map(x => x[1]);
  }

  // ---------- routing ----------
  function route() {
    const h = location.hash.replace(/^#\/?/, "");
    const [view, arg] = h.split("/");
    const v = ["benefits", "city", "about"].includes(view) ? view : "job";
    $$(".view").forEach(s => (s.hidden = s.id !== "view-" + v));
    $$("[data-nav]").forEach(a => a.dataset.nav === v ? a.setAttribute("aria-current", "page") : a.removeAttribute("aria-current"));
    if (v !== "job" || !arg) document.title = "Next Step Tri-Valley";
    if (v === "job") {
      if (view === "job" && arg && JOBS[arg]) showJob(arg); else if (!arg) $("#result").innerHTML = "";
    }
    if (v === "benefits") calc();
    if (v === "city") renderCity();
    if (v === "about") renderAbout();
    if (!(v === "job" && arg)) window.scrollTo({ top: 0 });
  }

  // ---------- search box ----------
  function initSearch() {
    const q = $("#q"), list = $("#suggest"), box = $(".search");
    let items = [], active = -1;
    const close = () => { list.hidden = true; box.setAttribute("aria-expanded", "false"); active = -1; };
    const paint = () => {
      list.innerHTML = items.length
        ? items.map((j, i) => `<li role="option" id="opt-${i}" data-soc="${j.s}" aria-selected="${i === active}"><span>${esc(j.t)}</span><span class="s-pay">${money(j.m)}/yr</span></li>`).join("")
        : `<li class="none">No match yet. Try a simpler word, like "clerk" or "driver".</li>`;
      list.hidden = false; box.setAttribute("aria-expanded", "true");
      q.setAttribute("aria-activedescendant", active >= 0 ? "opt-" + active : "");
    };
    q.addEventListener("input", () => { items = search(q.value); active = -1; q.value.trim().length >= 2 ? paint() : close(); });
    q.addEventListener("keydown", e => {
      if (list.hidden) return;
      if (e.key === "ArrowDown") { active = Math.min(active + 1, items.length - 1); paint(); e.preventDefault(); }
      else if (e.key === "ArrowUp") { active = Math.max(active - 1, 0); paint(); e.preventDefault(); }
      else if (e.key === "Enter") { const j = items[active >= 0 ? active : 0]; if (j) go(j.s); e.preventDefault(); }
      else if (e.key === "Escape") close();
    });
    list.addEventListener("mousedown", e => { const li = e.target.closest("li[data-soc]"); if (li) { e.preventDefault(); go(li.dataset.soc); } });
    document.addEventListener("click", e => { if (!box.contains(e.target)) close(); });
    $$(".chip-btn").forEach(b => b.addEventListener("click", () => go(b.dataset.soc)));
    function go(soc) { close(); q.value = JOBS[soc].t; location.hash = "#/job/" + soc; }
  }

  // ---------- job view ----------
  const BAND_TEXT = {
    high: "A lot of what this job asks of people overlaps with what AI tools can already do: reading, writing, sorting information, answering routine questions. That doesn't mean the job disappears. It usually means fewer people doing it, or the job turning into something different. This is a good time to build a second skill.",
    medium: "Some parts of this job overlap with what AI can do, and others don't. Expect some tasks to change. The parts that involve people, judgment, or hands-on work are the safest to lean into.",
    lower: "This job leans on physical work, care, or in-person skills that AI tools don't do well. It's less likely to change because of AI, though other things (like the economy) still matter.",
  };
  const BAND_LABEL = { high: "High AI exposure", medium: "Medium AI exposure", lower: "Lower AI exposure" };

  function payDelta(from, to) {
    const d = (to - from) / from;
    if (Math.abs(d) < 0.03) return `<span class="delta muted">about the same</span>`;
    return `<span class="delta ${d > 0 ? "up" : "down"}">${d > 0 ? "+" : "−"}${money(Math.abs(to - from))}</span>`;
  }

  function jobRows(socs, base) {
    return socs.map(s => JOBS[s]).map(j => `
      <li>
        <div><button class="jt" data-go="${j.s}">${esc(j.t)}</button><div class="small muted">${k(j.e || 0)} jobs in the metro area</div></div>
        <span class="band ${j.b}" title="${j.x}th percentile of AI exposure">${j.b === "lower" ? "Lower" : j.b === "medium" ? "Medium" : "High"} · ${j.x}</span>
        <div class="pay"><div>${money(j.m)}</div>${payDelta(base.m, j.m)}</div>
      </li>`).join("");
  }

  function showJob(soc) {
    const j = JOBS[soc];
    const zone = j.z ? D.zones[j.z] : null;
    const progIdx = new Set();
    const progFor = {};
    const addProgs = (s, label) => (JOBS[s]?.tr || []).forEach(i => { progIdx.add(i); (progFor[i] ||= new Set()).add(label); });
    addProgs(j.s, JOBS[j.s].t);
    j.mv.forEach(s => addProgs(s, JOBS[s].t));
    j.n.forEach(s => addProgs(s, JOBS[s].t));
    const progs = [...progIdx].map(i => [i, D.programs[i]]).sort((a, b) => (b[1].cost === "tuition-free") - (a[1].cost === "tuition-free"));

    $("#result").innerHTML = `
      <article class="card" aria-labelledby="jt">
        <div class="job-head">
          <div>
            <h2 id="jt">${esc(j.t)}</h2>
            <div class="muted small">Pay and job counts for the San Francisco-Oakland-Fremont metro area, which includes the Tri-Valley (BLS, May 2025)</div>
          </div>
          <span class="band ${j.b}">${BAND_LABEL[j.b]}</span>
        </div>
        <div class="stat-row">
          <div class="stat"><div class="k">Typical pay here</div><div class="v">${money(j.m)}</div><div class="s">Middle half earns ${money(j.p25)} to ${money(j.p75)}</div></div>
          <div class="stat"><div class="k">People doing this job</div><div class="v">${(j.e || 0).toLocaleString("en-US")}</div><div class="s">in the metro area</div></div>
          <div class="stat"><div class="k">AI exposure</div><div class="v">${j.x}<span class="small muted"> / 100</span></div><div class="s">More exposed than ${j.x}% of jobs</div></div>
        </div>
        <div class="meter" role="img" aria-label="AI exposure: ${j.x} out of 100">
          <div class="meter-track"><div class="meter-dot" style="left:${Math.min(98, Math.max(2, j.x))}%"></div></div>
          <div class="meter-scale"><span>Less exposed</span><span>More exposed</span></div>
        </div>
        <p class="callout">${BAND_TEXT[j.b]}</p>
        ${zone ? `<p class="small muted">How people usually get this job: ${esc(zone)}.</p>` : ""}
      </article>

      <div class="section-title"><h2>Moves toward less AI exposure</h2><span class="small muted">Close to your skills, pays at least 85% of what you make now</span></div>
      <div class="card">${j.mv.length ? `<ul class="list">${jobRows(j.mv, j)}</ul>
        <p class="small muted" style="margin:12px 0 0">These come from O*NET's list of related jobs (one or two steps from yours). They're starting points, not guarantees. Click any job to see its own pay and next steps.</p>`
        : `<p class="empty">${j.b === "lower" ? "Your job already has lower AI exposure than most. The jobs below use similar skills if you want to move up or across." : "We didn't find a nearby job that's clearly less exposed and pays close to what you make now. The similar jobs below are still worth a look, and the training section shows where to build a new skill."}</p>`}
      </div>

      <div class="section-title"><h2>Jobs that use the skills you already have</h2><span class="small muted">From O*NET's related-jobs list</span></div>
      <div class="card">${j.n.length ? `<ul class="list">${jobRows(j.n, j)}</ul>` : `<p class="empty">O*NET doesn't list related jobs for this one.</p>`}</div>

      <div class="section-title"><h2>Train for it nearby</h2><span class="small muted">Programs at Las Positas College in Livermore</span></div>
      ${progs.length ? `<div class="grid-3">${progs.slice(0, 9).map(([i, p]) => `
        <div class="card prog">
          <span class="tag">${p.cost === "tuition-free" ? "Tuition-free" : p.cost.startsWith("apprenticeship") ? "Paid apprenticeship" : "Community college"}</span>
          <div class="pn">${esc(p.name)}</div>
          <div class="small muted">${esc(p.type)} · ${esc(p.where)}</div>
          <div class="for">Leads toward: ${[...progFor[i]].slice(0, 3).map(esc).join("; ")}</div>
        </div>`).join("")}</div>`
      : `<div class="card"><p class="empty">We haven't matched a local program to these jobs yet. The Tri-Valley Career Center (below) can point you to short-term training and scholarships.</p></div>`}

      <div class="section-title"><h2>Free help in the Tri-Valley</h2></div>
      <div class="grid-2">${D.help.map(h => `
        <div class="card help">
          <h3>${esc(h.name)}</h3>
          <p>${esc(h.what)}</p>
          <p class="small muted">${esc(h.where)}${h.phone ? " · " + esc(h.phone) : ""}</p>
          <a href="${h.url}" target="_blank" rel="noopener">Learn more</a>
        </div>`).join("")}</div>

      <div class="card note">
        <h2>If you've been laid off</h2>
        <p>See what <a href="#/benefits">unemployment would pay you</a>, and ask EDD about California Training Benefits before your 16th week so you can keep your benefits while you train.</p>
      </div>`;
    $$("[data-go]", $("#result")).forEach(b => b.addEventListener("click", () => { $("#q").value = JOBS[b.dataset.go].t; location.hash = "#/job/" + b.dataset.go; }));
    $("#result").scrollIntoView({ behavior: "smooth", block: "start" });
    document.title = j.t + " · Next Step Tri-Valley";
  }

  // ---------- unemployment estimate ----------
  // EDD benefit table (DE 1101BT5) for claims since 2005: rows below $1,846 listed here,
  // above that the weekly amount is the highest-quarter pay divided by 26, rounded up, max $450.
  const LOW = [[900, 40], [949, 41], [975, 42], [1001, 43], [1027, 44], [1053, 45], [1079, 46], [1118, 47], [1144, 48], [1170, 49], [1196, 50], [1222, 51], [1248, 52], [1287, 53], [1313, 54], [1339, 55], [1365, 56], [1404, 57], [1430, 58], [1456, 59], [1495, 60], [1521, 61], [1547, 62], [1586, 63], [1612, 64], [1638, 65], [1677, 66], [1703, 67], [1742, 68], [1768, 69], [1807, 70], [1833, 71]];
  function weeklyBenefit(hq) {
    if (!(hq >= 900)) return 0;
    if (hq <= 1846) { let w = 0; for (const [lo, amt] of LOW) if (hq >= lo) w = amt; return w; }
    return Math.min(450, Math.ceil(hq / 26 - 1e-9));
  }

  function calc() {
    const mode = $("input[name=mode]:checked").value;
    $$(".field[data-mode]").forEach(f => (f.hidden = f.dataset.mode !== mode));
    const num = id => parseFloat(($("#" + id).value || "").replace(/[$,]/g, ""));
    let hq;
    if (mode === "hour") hq = num("rate") * num("hours") * 13;
    else if (mode === "year") hq = num("salary") / 4;
    else hq = num("hq");
    const out = $("#calc-out");
    if (!isFinite(hq) || hq <= 0) { out.innerHTML = `<p class="empty">Enter your pay to see an estimate.</p>`; return; }
    const wba = weeklyBenefit(hq);
    const weekly = hq / 13;
    if (!wba) {
      out.innerHTML = `<h2>You may not qualify</h2><p>California usually needs at least $900 in your best quarter (and more across the year) to open a claim. EDD looks at your actual wage records, so it's still worth applying if you're close.</p>`;
      return;
    }
    const pct = Math.round(100 * wba / weekly);
    const capped = wba === 450;
    out.innerHTML = `
      <div class="muted small">Estimated weekly benefit</div>
      <div class="big">${money(wba)}<span class="small muted"> / week</span></div>
      <p style="margin-top:8px">That's about <b>${pct}%</b> of the ${money(weekly)} a week you earned. Over the usual 26 weeks, it adds up to at most <b>${money(wba * 26)}</b>.</p>
      <div class="compare" role="img" aria-label="Your weekly pay ${money(weekly)} compared to the weekly benefit ${money(wba)}">
        <div class="row"><span>Your pay</span><div class="bar" style="width:100%"></div><span>${money(weekly)}</span></div>
        <div class="row"><span>Unemployment</span><div class="bar ui" style="width:${Math.max(2, pct)}%"></div><span>${money(wba)}</span></div>
      </div>
      ${capped ? `<p class="callout small">You hit California's $450 weekly cap, which hasn't gone up since 2005. Anyone earning more than about $46,700 a year gets the same $450.</p>` : ""}
      <p class="fine">Estimate only. Uses the EDD benefit table for claims filed since 2005 (DE 1101BT5). Your real amount depends on your wage records in EDD's base period. Apply at edd.ca.gov.</p>`;
  }

  function initCalc() {
    $("#calc").addEventListener("input", calc);
    $("#calc").addEventListener("change", calc);
    $("#calc").addEventListener("submit", e => e.preventDefault());
  }

  // ---------- city view ----------
  let cityDone = false;
  function renderCity() {
    if (cityDone) return; cityDone = true;
    const s = D.summary;
    $("#city-lede").textContent = `Using federal wage data for every job in the ${s.area}, here's where AI exposure is concentrated and which workers have the least cushion.`;
    const groups = s.by_major.filter(g => g.emp >= 15000).map(g => ({ ...g, share: g.high / g.emp })).sort((a, b) => b.share - a.share);
    $("#city").innerHTML = `
      <div class="kpis">
        <div class="card kpi"><div class="v">${s.high_share}%</div><div class="k">of the metro's ${k(s.total_emp)} jobs are in occupations with high AI exposure (top third of all jobs)</div></div>
        <div class="card kpi"><div class="v">${s.office_high_share}%</div><div class="k">of office and administrative support jobs are high exposure. That's ${k(s.office_high_emp)} workers.</div></div>
        <div class="card kpi"><div class="v">${k(s.squeezed_emp)}</div><div class="k">workers are in jobs that are both highly exposed and pay less than the metro's typical wage of ${money(s.all_median)}</div></div>
      </div>

      <div class="card">
        <h2>Share of jobs with high AI exposure, by type of work</h2>
        <p class="small muted">Job families with at least 15,000 workers in the metro area. Hover a bar for counts.</p>
        <div class="hbars" id="hbars">${groups.map(g => `
          <div class="hbar" data-tip="${esc(g.name)}: ${g.high.toLocaleString("en-US")} of ${g.emp.toLocaleString("en-US")} jobs are high exposure">
            <span class="lab">${esc(g.name)}</span>
            <div class="trk"><div class="fill" style="width:${(100 * g.share).toFixed(1)}%"></div></div>
            <span class="num">${Math.round(100 * g.share)}%</span>
          </div>`).join("")}</div>
        <details><summary>Show as a table</summary><div class="table-wrap"><table>
          <thead><tr><th>Type of work</th><th class="n">Jobs</th><th class="n">High exposure</th><th class="n">Share</th></tr></thead>
          <tbody>${groups.map(g => `<tr><td>${esc(g.name)}</td><td class="n">${g.emp.toLocaleString("en-US")}</td><td class="n">${g.high.toLocaleString("en-US")}</td><td class="n">${Math.round(100 * g.share)}%</td></tr>`).join("")}</tbody>
        </table></div></details>
      </div>

      <div class="card">
        <h2>The squeezed middle: exposed and underpaid</h2>
        <p class="small muted">The largest jobs that are high AI exposure and pay below the metro's typical wage. These workers have the least savings to fall back on and the most to gain from retraining.</p>
        <div class="table-wrap"><table>
          <thead><tr><th>Job</th><th class="n">Workers</th><th class="n">Typical pay</th><th class="n">AI exposure</th></tr></thead>
          <tbody>${s.squeezed_jobs.map(j => `<tr><td>${esc(j.t)}</td><td class="n">${j.e.toLocaleString("en-US")}</td><td class="n">${money(j.m)}</td><td class="n">${j.x}</td></tr>`).join("")}</tbody>
        </table></div>
      </div>

      <div class="grid-2">
        <div class="card">
          <h2>What unemployment covers, and what it doesn't</h2>
          <p>California's top weekly benefit is $450, and it hasn't changed since 2005. A full-time worker earning the typical metro wage of ${money(s.all_median)} would get about a third of their pay. Unemployment buys time to search, but it doesn't pay for a new skill, and EDD won't cover tuition even under California Training Benefits.</p>
        </div>
        <div class="card">
          <h2>A small step the city can take</h2>
          <p>A <b>$40,000</b> reskilling voucher pilot at <b>$800 per worker</b> would cover <b>50 Dublin workers</b> in high-exposure jobs. Paired with California Training Benefits, a laid-off worker could keep their unemployment check while the voucher covers fees, books, and supplies at Las Positas College.</p>
          <p class="small muted">A pilot this size can't prove what works, but it can answer the practical questions first: can the city find these workers, will they use vouchers, and which programs take them?</p>
        </div>
      </div>

      <div class="card">
        <h2>Three things that cost almost nothing</h2>
        <ol>
          <li><b>Link this tool</b> from the city's economic development page and the library's job help page.</li>
          <li><b>Tell people about the 16-week deadline.</b> Most workers have never heard of California Training Benefits. A line in city layoff notices and WARN follow-ups could change that.</li>
          <li><b>Send people to the Tri-Valley Career Center</b> in Pleasanton for free coaching and training scholarships.</li>
        </ol>
      </div>`;
    const tip = document.createElement("div"); tip.className = "tip"; tip.hidden = true; document.body.appendChild(tip);
    $$("#hbars .hbar").forEach(r => {
      r.addEventListener("mousemove", e => { tip.textContent = r.dataset.tip; tip.hidden = false; tip.style.left = Math.min(e.pageX + 14, document.documentElement.clientWidth - 300) + "px"; tip.style.top = e.pageY + 14 + "px"; });
      r.addEventListener("mouseleave", () => (tip.hidden = true));
    });
  }

  // ---------- about view ----------
  let aboutDone = false;
  function renderAbout() {
    if (aboutDone) return; aboutDone = true;
    const s = D.summary;
    $("#about").innerHTML = `
      <p>Next Step Tri-Valley puts three public datasets together so a worker can answer one question in under a minute: <i>if AI changes my job, where could I go next, and how do I get there here?</i></p>
      <h2>Where the numbers come from</h2>
      <ul>
        <li><b>Pay and job counts:</b> U.S. Bureau of Labor Statistics, <a href="https://www.bls.gov/oes/" target="_blank" rel="noopener">Occupational Employment and Wage Statistics</a>, May 2025, for the San Francisco-Oakland-Fremont, CA metro area. BLS doesn't publish wages for the Tri-Valley alone, so this is the closest official local number.</li>
        <li><b>AI exposure:</b> the AI Occupational Exposure score from Felten, Raj and Seamans (2021), <a href="https://github.com/AIOE-Data/AIOE" target="_blank" rel="noopener">published on GitHub</a>. It measures how much the abilities a job needs overlap with what AI applications can do. We turned the score into a percentile from 0 to 100 across the ${s.occupations} jobs in the data, so 80 means more exposed than 80% of jobs. "High" is the top third, "lower" is the bottom third.</li>
        <li><b>Related jobs and preparation level:</b> <a href="https://www.onetcenter.org/database.html" target="_blank" rel="noopener">O*NET 30.3</a> Related Occupations and Job Zones, from the U.S. Department of Labor.</li>
        <li><b>Local programs:</b> Las Positas College 2024-2025 catalog and Continuing Education page. <b>Help:</b> Las Positas College's Tri-Valley Career Center page and EDD's California Training Benefits page.</li>
        <li><b>Unemployment estimate:</b> EDD's benefit table for claims filed since 2005 (form DE 1101BT5).</li>
      </ul>
      <h2>How "moves toward less AI exposure" are picked</h2>
      <p>For your job, we look at the jobs O*NET lists as related, and the jobs related to those. We keep a job only if it is at least 10 points less exposed, pays at least 85% of your current local median, needs no more than one extra level of preparation, and has at least 1,000 jobs in the metro area. Closer jobs come first, then higher pay.</p>
      <h2>What this can't tell you</h2>
      <ul>
        <li>Exposure is not the same as job loss. A highly exposed job can grow if AI makes workers more productive. The score describes overlap, not a prediction.</li>
        <li>The exposure scores are from 2021, before tools like ChatGPT were widely used. They use an older job list, so ${s.match.crosswalk} jobs were matched through the official BLS crosswalk and ${s.match.none} jobs couldn't be matched and are left out.</li>
        <li>Pay is for the whole metro area, which includes San Francisco and Oakland. Tri-Valley pay may differ.</li>
        <li>Program lists change. Always check with Las Positas College and the Tri-Valley Career Center.</li>
      </ul>
      <h2>Privacy</h2>
      <p>The whole site runs in your browser. There's no account, no tracking, and nothing you type is sent anywhere.</p>
      <h2>Who made this, and how</h2>
      <p>Abhinav Jagtap, a senior at Dublin High School, built this for Neighborhood Hacks 2026. It grew out of his published research on how unemployment insurance fits AI-driven job change, and a reskilling voucher pilot he proposed to the Dublin City Council. Abhinav used Claude, an AI assistant, to help write the code and gather the data. The data, code and the steps to rebuild it are <a href="https://github.com/AbhinavJag/next-step-tri-valley" target="_blank" rel="noopener">on GitHub</a>.</p>`;
  }

  // ---------- boot ----------
  fetch("data.json").then(r => r.json()).then(d => {
    D = d; d.jobs.forEach(j => (JOBS[j.s] = j)); buildIndex();
    initSearch(); initCalc();
    window.addEventListener("hashchange", route);
    route();
  }).catch(() => { $("#result").innerHTML = `<div class="card"><p>Sorry, the data didn't load. Please refresh the page.</p></div>`; });
})();
