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
    const [view, arg, arg2] = h.split("/");
    const v = ["benefits", "city", "about", "plan"].includes(view) ? view : "job";
    $$(".view").forEach(s => (s.hidden = s.id !== "view-" + v));
    $$("[data-nav]").forEach(a => a.dataset.nav === v ? a.setAttribute("aria-current", "page") : a.removeAttribute("aria-current"));
    if (v !== "job" || !arg) document.title = "Next Step Tri-Valley";
    if (v === "job") {
      if (view === "job" && arg && JOBS[arg]) showJob(arg); else if (!arg) $("#result").innerHTML = "";
    }
    if (v === "benefits") calc();
    if (v === "city") renderCity();
    if (v === "plan") renderPlan(JOBS[arg] ? arg : null, JOBS[arg2] ? arg2 : null);
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
    if (Math.abs(d) < 0.03) return `<span class="delta same">About the same pay</span>`;
    return `<span class="delta ${d > 0 ? "up" : "down"}">${d > 0 ? "▲ " : "▼ "}${money(Math.abs(to - from))}</span>`;
  }
  const bandWord = b => b === "lower" ? "Lower" : b === "medium" ? "Medium" : "High";

  function jobRows(socs, base) {
    return socs.map(s => JOBS[s]).map(j => `
      <li>
        <div><button class="jt" data-go="${j.s}">${esc(j.t)}</button><div class="meta">${k(j.e || 0)} jobs in the metro area · <a class="plan-link" href="#/plan/${base.s}/${j.s}">Plan this switch</a></div></div>
        <span class="band ${j.b}" title="More exposed to AI than ${j.x}% of jobs">${bandWord(j.b)} AI · ${j.x}</span>
        <div class="pay">${money(j.m)}${payDelta(base.m, j.m)}</div>
      </li>`).join("");
  }

  function sectionTitle(chip, color, title, sub) {
    return `<div class="section-title"><span class="line-chip" style="background:${color}">${chip}</span><h2>${title}</h2>${sub ? `<span class="sub">${sub}</span>` : ""}</div>`;
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
    const segColor = j.b === "high" ? "var(--r)" : j.b === "medium" ? "var(--o)" : "var(--g)";
    const lit = Math.round(j.x / 10);

    $("#result").innerHTML = `
      <article class="station" aria-labelledby="jt">
        <div class="station-head">
          <h2 id="jt">${esc(j.t)}</h2>
          <span class="here">You are here</span>
        </div>
        <div class="board">
          <div><div class="k">Typical pay here</div><div class="v">${money(j.m)}</div><div class="s">Middle half: ${money(j.p25)} to ${money(j.p75)}</div></div>
          <div><div class="k">People doing this job</div><div class="v">${(j.e || 0).toLocaleString("en-US")}</div><div class="s">in the metro area</div></div>
          <div><div class="k">AI exposure</div><div class="v">${j.x}<span style="font-size:20px;color:#bbb"> / 100</span></div><div class="s">More exposed than ${j.x}% of jobs</div></div>
        </div>
        <div class="station-body">
          <div class="segs" role="img" aria-label="AI exposure ${j.x} out of 100, ${BAND_LABEL[j.b]}" style="--c:${segColor}">${Array.from({ length: 10 }, (_, i) => `<i class="${i < lit ? "on" : ""}"></i>`).join("")}</div>
          <div class="seg-scale"><span>Less exposed</span><span class="band ${j.b}">${BAND_LABEL[j.b]}</span><span>More exposed</span></div>
          <p class="callout">${BAND_TEXT[j.b]}</p>
          ${zone ? `<p class="small muted" style="margin:0">How people usually get this job: ${esc(zone)}.</p>` : ""}
          <p class="small muted" style="margin:6px 0 0">Pay and job counts are for the San Francisco-Oakland-Fremont metro area, which includes the Tri-Valley (BLS, May 2025).</p>
          <a class="go cta" href="#/plan/${j.s}/${j.mv[0] || j.n[0] || j.s}">Plan a switch from this job</a>
        </div>
      </article>

      ${sectionTitle("1", "var(--y)", "Next stops: less AI exposure", "Close to your skills, and pays at least 85% of what you make now")}
      <div class="card">${j.mv.length ? `<ul class="route y">${jobRows(j.mv, j)}</ul>
        <p class="route-note">From O*NET's list of related jobs, one or two steps from yours. Starting points, not guarantees. Tap any stop to see its own next stops.</p>`
        : `<p class="empty">${j.b === "lower" ? "Your job already has lower AI exposure than most. The jobs below use similar skills if you want to move up or across." : "We didn't find a nearby job that's clearly less exposed and pays close to what you make now. The jobs below still use your skills, and the training section shows where to build a new one."}</p>`}
      </div>

      ${sectionTitle("2", "var(--b)", "Jobs on the same line", "They use the skills you already have (O*NET related jobs)")}
      <div class="card">${j.n.length ? `<ul class="route b">${jobRows(j.n, j)}</ul>` : `<p class="empty">O*NET doesn't list related jobs for this one.</p>`}</div>

      ${sectionTitle("T", "var(--g)", "Transfer here: train nearby", "Programs at Las Positas College in Livermore")}
      ${progs.length ? `<div class="grid-3">${progs.slice(0, 9).map(([i, p]) => `
        <div class="prog">
          <span class="tag ${p.cost === "tuition-free" ? "free" : ""}">${p.cost === "tuition-free" ? "Tuition-free" : p.cost.startsWith("apprenticeship") ? "Paid apprenticeship" : "Community college"}</span>
          <div class="pn">${esc(p.name)}</div>
          <div class="small muted">${esc(p.type)} · ${esc(p.where)}</div>
          <div class="for">Leads toward: ${[...progFor[i]].slice(0, 3).map(esc).join("; ")}</div>
        </div>`).join("")}</div>`
      : `<div class="card"><p class="empty">We haven't matched a local program to these jobs yet. The Tri-Valley Career Center (below) can point you to short-term training and scholarships.</p></div>`}

      ${sectionTitle("i", "#fff;border:3px solid var(--rule)", "Free help in the Tri-Valley", "")}
      <div class="grid-2">${D.help.map(h => `
        <div class="card help">
          <h3>${esc(h.name)}</h3>
          <p>${esc(h.what)}</p>
          <p class="small muted">${esc(h.where)}${h.phone ? " · " + esc(h.phone) : ""}</p>
          <a class="go" href="${h.url}" target="_blank" rel="noopener">Learn more</a>
        </div>`).join("")}</div>

      <div class="card note">
        <h2>If you've been laid off</h2>
        <p>See what <a href="#/benefits">unemployment would pay you</a>, and ask EDD about California Training Benefits before your 16th week so you can keep your benefits while you train.</p>
      </div>`;
    $$("[data-go]", $("#result")).forEach(b => b.addEventListener("click", () => { $("#q").value = JOBS[b.dataset.go].t; location.hash = "#/job/" + b.dataset.go; }));
    $("#result").scrollIntoView({ behavior: "smooth", block: "start" });
    document.title = j.t + " · Next Step Tri-Valley";
  }

  // ---------- rotating local photos on the home page ----------
  function initPhotos() {
    const band = $("#home-band"); if (!band) return;
    const phs = $$(".ph", band), credit = $("#home-credit");
    let i = 0;
    const show = () => { phs.forEach((p, n) => p.classList.toggle("on", n === i)); credit.innerHTML = phs[i].dataset.credit; };
    show();
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    setInterval(() => { i = (i + 1) % phs.length; show(); }, 7000);
  }

  // ---------- switch planner ----------
  const PROG_DEFAULTS = {
    "community college": { months: 9, cost: 1600, note: "About 24 units at $46 a unit plus books" },
    "tuition-free": { months: 4, cost: 100, note: "Tuition-free, maybe a materials fee" },
    "apprenticeship (paid while you learn)": { months: 12, cost: 0, note: "Paid while you learn" },
    none: { months: 6, cost: 1500, note: "Short course or certification" },
  };
  let P = null;

  function renderPlan(from, to) {
    from = from || P?.from || "43-6013";
    const fj = JOBS[from];
    to = to || (P && P.from === from ? P.to : null) || fj.mv[0] || fj.n[0] || from;
    const keep = P && P.from === from;
    P = {
      from, to,
      pay: keep ? P.pay : fj.m,
      start: (P && P.to === to && keep) ? P.start : JOBS[to].m,
      prog: (P && P.to === to && keep) ? P.prog : (JOBS[to].tr[0] ?? -1),
      months: null, cost: null,
      waiver: keep ? P.waiver : false, voucher: keep ? P.voucher : false,
      laidoff: keep ? P.laidoff : true, search: keep ? P.search : 4,
    };
    const d = progDefaults(P.prog); P.months = d.months; P.cost = d.cost;
    if (location.hash !== `#/plan/${from}/${to}`) history.replaceState(null, "", `#/plan/${from}/${to}`);
    drawPlanForm(); planCalc();
  }

  function progDefaults(i) { return i >= 0 ? PROG_DEFAULTS[D.programs[i].cost] || PROG_DEFAULTS.none : PROG_DEFAULTS.none; }

  function jobOptions(sel, groups) {
    return groups.filter(g => g[1].length).map(([label, socs]) => `<optgroup label="${esc(label)}">${socs.map(s => `<option value="${s}" ${s === sel ? "selected" : ""}>${esc(JOBS[s].t)}</option>`).join("")}</optgroup>`).join("");
  }

  function drawPlanForm() {
    const fj = JOBS[P.from], tj = JOBS[P.to];
    const all = D.jobs.map(j => j.s).sort((a, b) => JOBS[a].t.localeCompare(JOBS[b].t));
    const progIdx = [...new Set([...tj.tr, ...fj.tr])];
    $("#plan").innerHTML = `
      <div class="planner">
        <form class="plan-form" id="plan-form" onsubmit="return false">
          <ol class="steps">
            <li class="stop">
              <h3>Where you are</h3>
              <label for="p-from">Your job now</label>
              <select id="p-from">${jobOptions(P.from, [["All jobs", all]])}</select>
              <label for="p-pay">What you make a year</label>
              <div class="money"><span>$</span><input id="p-pay" inputmode="numeric" value="${P.pay}"></div>
              <p class="hint">Typical here: ${money(fj.m)}. Hourly? Multiply by 2,080 for full time.</p>
            </li>
            <li class="stop">
              <h3>Where you want to go</h3>
              <label for="p-to">Next job</label>
              <select id="p-to">${jobOptions(P.to, [["Next stops (less AI exposure)", fj.mv], ["Same line (similar skills)", fj.n], ["All jobs", all]])}</select>
              <label for="p-start">Starting pay you expect</label>
              <div class="money"><span>$</span><input id="p-start" inputmode="numeric" value="${P.start}"></div>
              <div class="quick">
                <button type="button" data-start="${tj.p25}">New hire ${money(tj.p25)}</button>
                <button type="button" data-start="${tj.m}">Typical ${money(tj.m)}</button>
                <button type="button" data-start="${tj.p75}">Experienced ${money(tj.p75)}</button>
              </div>
            </li>
            <li class="stop">
              <h3>How you get there</h3>
              <label for="p-prog">Training</label>
              <select id="p-prog">
                ${progIdx.map(i => `<option value="${i}" ${i === P.prog ? "selected" : ""}>${esc(D.programs[i].name)} (Las Positas)</option>`).join("")}
                <option value="-1" ${P.prog === -1 ? "selected" : ""}>Other training or certification</option>
              </select>
              <p class="hint" id="p-prog-note"></p>
              <label for="p-months">How long it takes: <b id="p-months-v">${P.months} months</b></label>
              <input id="p-months" type="range" min="1" max="24" value="${P.months}">
              <label for="p-cost">Tuition, fees and books</label>
              <div class="money"><span>$</span><input id="p-cost" inputmode="numeric" value="${P.cost}"></div>
              <label class="check"><input type="checkbox" id="p-waiver" ${P.waiver ? "checked" : ""}> I qualify for the College Promise Grant (waives enrollment fees)</label>
              <label class="check"><input type="checkbox" id="p-voucher" ${P.voucher ? "checked" : ""}> Include the proposed $800 Dublin reskilling voucher</label>
            </li>
            <li class="stop">
              <h3>Your situation</h3>
              <div class="seg">
                <label><input type="radio" name="p-sit" value="1" ${P.laidoff ? "checked" : ""}> I was laid off</label>
                <label><input type="radio" name="p-sit" value="0" ${P.laidoff ? "" : "checked"}> I still have my job</label>
              </div>
              <div id="p-search-wrap" ${P.laidoff ? "" : "hidden"}>
                <label for="p-search">If you don't retrain, months to find the same kind of job: <b id="p-search-v">${P.search}</b></label>
                <input id="p-search" type="range" min="0" max="12" value="${P.search}">
              </div>
              <p class="hint" id="p-sit-note"></p>
            </li>
          </ol>
        </form>
        <div class="plan-out" id="plan-out" aria-live="polite"></div>
      </div>`;

    const num = id => Math.max(0, parseFloat(($("#" + id).value || "0").replace(/[$,]/g, "")) || 0);
    $("#p-from").addEventListener("change", e => { P = null; renderPlan(e.target.value, null); });
    $("#p-to").addEventListener("change", e => { const f = P.from; const keepPay = P.pay, lo = P.laidoff, se = P.search, w = P.waiver, v = P.voucher; P = { from: f, pay: keepPay, laidoff: lo, search: se, waiver: w, voucher: v }; renderPlan(f, e.target.value); });
    $("#p-prog").addEventListener("change", e => { P.prog = +e.target.value; const d = progDefaults(P.prog); P.months = d.months; P.cost = d.cost; $("#p-months").value = d.months; $("#p-cost").value = d.cost; planCalc(); });
    $$(".quick button").forEach(b => b.addEventListener("click", () => { $("#p-start").value = b.dataset.start; planCalc(); }));
    $("#plan-form").addEventListener("input", e => {
      if (["p-from", "p-to", "p-prog"].includes(e.target.id)) return;
      P.pay = num("p-pay"); P.start = num("p-start"); P.months = +$("#p-months").value; P.cost = num("p-cost");
      P.waiver = $("#p-waiver").checked; P.voucher = $("#p-voucher").checked;
      P.laidoff = $("input[name=p-sit]:checked").value === "1"; P.search = +$("#p-search").value;
      planCalc();
    });
  }

  function planCalc() {
    const fj = JOBS[P.from], tj = JOBS[P.to];
    const prog = P.prog >= 0 ? D.programs[P.prog] : null;
    $("#p-prog-note").textContent = prog ? `${prog.type}. ${progDefaults(P.prog).note}. Check exact costs with Las Positas.` : "Set the length and cost yourself.";
    $("#p-months-v").textContent = P.months + (P.months === 1 ? " month" : " months");
    $("#p-search-v").textContent = P.search + (P.search === 1 ? " month" : " months");
    $("#p-search-wrap").hidden = !P.laidoff;

    // Costs: the fee waiver removes the enrollment-fee part of a community college program; the voucher covers up to $800.
    let cost = P.cost;
    if (P.waiver && prog && prog.cost === "community college") cost = Math.max(0, cost - 24 * 46);
    const voucher = P.voucher ? Math.min(800, cost) : 0;
    const oop = cost - voucher;

    const wba = weeklyBenefit(P.pay / 4);
    const uiMonthly = wba * 52 / 12;
    const uiMonths = 6; // 26 weeks
    $("#p-sit-note").innerHTML = P.laidoff
      ? `Unemployment estimate: <b>${money(wba)}/week</b> for up to 26 weeks. With California Training Benefits you keep it while you train (ask EDD before week 16).`
      : "You'd keep working and train on nights or weekends, so the training may take longer.";

    const N = 60, A = [], B = [];
    let a = 0, b = -oop;
    for (let m = 0; m < N; m++) {
      if (P.laidoff) {
        a += m < P.search ? (m < uiMonths ? uiMonthly : 0) : P.pay / 12;
        b += m < P.months ? (m < uiMonths ? uiMonthly : 0) : P.start / 12;
      } else {
        a += P.pay / 12;
        b += m < P.months ? P.pay / 12 : P.start / 12;
      }
      A.push(a); B.push(b);
    }
    // Pay-back month: the first month (after training) from which the switch path stays ahead for good.
    let even = -1;
    for (let m = Math.max(0, P.months - 1); m < N; m++) {
      if (B.slice(m).every((v, i) => v > A[m + i])) { even = m + 1; break; }
    }
    const diff5 = B[N - 1] - A[N - 1];
    const trainIncome = P.laidoff ? (uiMonths >= P.months ? uiMonthly : uiMonthly * uiMonths / P.months) : P.pay / 12;
    const raise = P.start - P.pay;

    $("#plan-out").innerHTML = `
      <div class="kpis plan-kpis">
        <div class="kpi"><div class="v">${money(oop)}</div><div class="k">out of pocket for training${voucher ? `, after the ${money(voucher)} voucher` : ""}</div></div>
        <div class="kpi"><div class="v">${money(trainIncome)}</div><div class="k">a month to live on while training${P.laidoff ? ` (unemployment${P.months > uiMonths ? ", averaged, it stops after 26 weeks" : ""})` : " (your paycheck)"}, vs ${money(P.pay / 12)} before</div></div>
        <div class="kpi"><div class="v">${raise >= 0 ? "+" : "−"}${money(Math.abs(raise))}</div><div class="k">a year in the new job vs. your pay now</div></div>
      </div>
      <div class="verdict ${even > 0 ? "good" : "bad"}">
        <div class="cond">${even > 0 ? `Pays you back in month ${even}` : "Doesn't pay back within 5 years"}</div>
        <p>After 5 years, switching leaves you <b>${money(Math.abs(diff5))} ${diff5 >= 0 ? "ahead" : "behind"}</b> compared with ${P.laidoff ? "going back to the same kind of work" : "staying where you are"}. ${tj.x < fj.x ? `You'd also move from AI exposure <b>${fj.x}</b> to <b>${tj.x}</b>.` : tj.x > fj.x ? `Heads up: the new job is <b>more</b> exposed to AI (${tj.x} vs ${fj.x}).` : ""}</p>
      </div>
      <div class="card chart-card">
        <h3>Total money earned, minus training costs</h3>
        <div class="legend"><span class="sw" style="background:var(--b)"></span> Train and switch to ${esc(tj.t)} <span class="sw" style="background:var(--ink-3)"></span> ${P.laidoff ? "Go back to the same kind of job" : "Stay in your job"}</div>
        ${planChart(A, B)}
        <p class="hint">Before taxes. Doesn't count raises, or the chance that ${esc(fj.t.toLowerCase())} jobs get harder to find as AI spreads. Estimates only.</p>
      </div>`;
    initPlanChart(A, B);
  }

  function planChart(A, B) {
    return `<div class="pchart" id="pchart"><svg viewBox="0 0 640 260" role="img" aria-label="Cumulative earnings over 5 years for both paths"></svg><div class="tip" hidden></div></div>`;
  }

  function initPlanChart(A, B) {
    const wrap = $("#pchart"), svg = $("svg", wrap), tip = $(".tip", wrap);
    const W = 640, H = 260, L = 64, R = 150, T = 14, Bm = 30;
    const lo = Math.min(0, ...A, ...B), hi = Math.max(...A, ...B) * 1.05;
    const x = m => L + (m / 59) * (W - L - R), y = v => T + (1 - (v - lo) / (hi - lo)) * (H - T - Bm);
    const path = arr => arr.map((v, m) => (m ? "L" : "M") + x(m).toFixed(1) + "," + y(v).toFixed(1)).join("");
    const ticks = []; const step = hi > 400000 ? 100000 : 50000;
    for (let v = Math.ceil(lo / step) * step; v <= hi; v += step) ticks.push(v);
    const fmt = v => (v < 0 ? "−" : "") + "$" + Math.round(Math.abs(v) / 1000) + "K";
    svg.innerHTML = `
      ${ticks.map(v => `<line x1="${L}" x2="${W - R}" y1="${y(v)}" y2="${y(v)}" stroke="var(--soft-rule)" stroke-width="1"/><text x="${L - 8}" y="${y(v) + 4}" text-anchor="end" class="ax">${fmt(v)}</text>`).join("")}
      ${[0, 12, 24, 36, 48, 59].map(m => `<text x="${x(m)}" y="${H - 8}" text-anchor="middle" class="ax">${m === 0 ? "Now" : m === 59 ? "Year 5" : "Year " + m / 12}</text>`).join("")}
      <rect x="${x(0)}" y="${T}" width="${Math.max(0, x(Math.min(P.months, 59)) - x(0))}" height="${H - T - Bm}" fill="var(--y)" opacity=".18"/>
      <text x="${x(0) + 6}" y="${T + 14}" class="ax">Training</text>
      <path d="${path(A)}" fill="none" stroke="var(--ink-3)" stroke-width="2.5"/>
      <path d="${path(B)}" fill="none" stroke="var(--b)" stroke-width="3"/>
      <text x="${W - R + 8}" y="${y(B[59]) + 4}" class="lab" fill="var(--b)">Switch ${fmt(B[59])}</text>
      <text x="${W - R + 8}" y="${y(A[59]) + (Math.abs(y(A[59]) - y(B[59])) < 16 ? (A[59] > B[59] ? -10 : 18) : 4)}" class="lab" fill="var(--ink-2)">${P.laidoff ? "Same job" : "Stay"} ${fmt(A[59])}</text>
      <line class="cross" x1="0" x2="0" y1="${T}" y2="${H - Bm}" stroke="var(--ink)" stroke-width="1" visibility="hidden"/>
      <circle class="dA" r="5" fill="var(--ink-3)" stroke="var(--bg)" stroke-width="2" visibility="hidden"/>
      <circle class="dB" r="5" fill="var(--b)" stroke="var(--bg)" stroke-width="2" visibility="hidden"/>
      <rect x="${L}" y="${T}" width="${W - L - R}" height="${H - T - Bm}" fill="transparent" class="hit"/>`;
    const hit = $(".hit", svg), cross = $(".cross", svg), dA = $(".dA", svg), dB = $(".dB", svg);
    const move = e => {
      const r = svg.getBoundingClientRect(); const px = (e.clientX - r.left) * (W / r.width);
      const m = Math.max(0, Math.min(59, Math.round((px - L) / (W - L - R) * 59)));
      cross.setAttribute("x1", x(m)); cross.setAttribute("x2", x(m)); cross.setAttribute("visibility", "visible");
      dA.setAttribute("cx", x(m)); dA.setAttribute("cy", y(A[m])); dB.setAttribute("cx", x(m)); dB.setAttribute("cy", y(B[m]));
      dA.setAttribute("visibility", "visible"); dB.setAttribute("visibility", "visible");
      tip.hidden = false;
      tip.innerHTML = `<b>Month ${m + 1}</b><br>Switch: ${money(B[m])}<br>${P.laidoff ? "Same job" : "Stay"}: ${money(A[m])}`;
      const left = (x(m) / W) * r.width; tip.style.left = Math.min(left + 12, r.width - 170) + "px"; tip.style.top = "10px";
    };
    hit.addEventListener("mousemove", move);
    hit.addEventListener("touchmove", e => { move(e.touches[0]); e.preventDefault(); }, { passive: false });
    hit.addEventListener("mouseleave", () => { tip.hidden = true; [cross, dA, dB].forEach(n => n.setAttribute("visibility", "hidden")); });
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
        <div class="kpi"><div class="v">${s.high_share}%</div><div class="k">of the metro's ${k(s.total_emp)} jobs are in occupations with high AI exposure (top third of all jobs)</div></div>
        <div class="kpi"><div class="v">${s.office_high_share}%</div><div class="k">of office and administrative support jobs are high exposure. That's ${k(s.office_high_emp)} workers.</div></div>
        <div class="kpi"><div class="v">${k(s.squeezed_emp)}</div><div class="k">workers are in jobs that are both highly exposed and pay less than the metro's typical wage of ${money(s.all_median)}</div></div>
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
      <h2>Who made this</h2>
      <p>Abhinav Jagtap, a senior at Dublin High School, built this. It grew out of his published research on how unemployment insurance fits AI-driven job change, and a reskilling voucher pilot he proposed to the Dublin City Council. The data, code and the steps to rebuild it are <a href="https://github.com/AbhinavJag/next-step-tri-valley" target="_blank" rel="noopener">on GitHub</a>.</p>`;
  }

  // ---------- boot ----------
  fetch("data.json").then(r => r.json()).then(d => {
    D = d; d.jobs.forEach(j => (JOBS[j.s] = j)); buildIndex();
    initSearch(); initCalc(); initPhotos();
    window.addEventListener("hashchange", route);
    route();
  }).catch(() => { $("#result").innerHTML = `<div class="card"><p>Sorry, the data didn't load. Please refresh the page.</p></div>`; });
})();
