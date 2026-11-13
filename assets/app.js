// Sheeens — Arabic reference guide to the birds of Saudi Arabia.
const app = document.getElementById("app");
const MONTHS = ["يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو", "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر"];
const MONTHS_SHORT = ["ينا", "فبر", "مار", "أبر", "ماي", "يون", "يول", "أغس", "سبت", "أكت", "نوف", "ديس"];
const NOW_MONTH = new Date().getMonth();
const STATUS = {
  resident: { label: "مقيم", hint: "موجود في المملكة طوال السنة تقريباً", icon: "●" },
  winter: { label: "زائر شتوي", hint: "يصل في الخريف ويقضي الشتاء", icon: "❄" },
  summer: { label: "زائر صيفي", hint: "يصل في الربيع للتكاثر ويغادر في الخريف", icon: "☀" },
  passage: { label: "عابر", hint: "يمر في هجرتي الربيع والخريف", icon: "⇅" },
  vagrant: { label: "نادر", hint: "سجلاته قليلة جداً في المملكة", icon: "◇" },
  unknown: { label: "غير محدد", hint: "السجلات لا تكفي لتحديد موسمه", icon: "○" },
};
const IUCN = {
  LC: "غير مهدد", NT: "قريب من التهديد", VU: "معرّض للخطر", EN: "مهدد بالانقراض",
  CR: "مهدد بشدة", EW: "منقرض في البرية", EX: "منقرض", DD: "بيانات ناقصة", NE: "لم يُقيَّم",
};
const REGIONS = [
  ["الرياض", 24.7136, 46.6753], ["الخرج", 24.1556, 47.3346], ["الدوادمي", 24.5072, 44.3922], ["المجمعة", 25.9061, 45.3456],
  ["الزلفي", 26.2994, 44.8151], ["القصيم - بريدة", 26.3592, 43.9818], ["حائل", 27.5114, 41.7208], ["حفر الباطن", 28.4328, 45.9708],
  ["رفحاء", 29.6202, 43.4936], ["عرعر", 30.9753, 41.0381], ["طريف", 31.6725, 38.6637], ["القريات", 31.3317, 37.3428],
  ["الجوف - سكاكا", 29.9697, 40.2064], ["تبوك", 28.3835, 36.5662], ["العلا", 26.6085, 37.9232], ["المدينة المنورة", 24.5247, 39.5692],
  ["ينبع", 24.0895, 38.0618], ["جدة", 21.4858, 39.1925], ["مكة المكرمة", 21.3891, 39.8579], ["الطائف", 21.2703, 40.4158],
  ["الباحة", 20.0129, 41.4677], ["القنفذة", 19.1264, 41.0789], ["بيشة", 19.9881, 42.6052], ["أبها", 18.2164, 42.5053],
  ["جازان", 16.8892, 42.5511], ["نجران", 17.5656, 44.2289], ["شرورة", 17.4867, 47.1101], ["وادي الدواسر", 20.4607, 44.7816],
  ["الأحساء", 25.3833, 49.5867], ["الدمام", 26.4207, 50.0888], ["الجبيل", 27.0174, 49.6225],
];
const WMO = {
  0: "صحو", 1: "صحو غالباً", 2: "غائم جزئياً", 3: "غائم", 45: "ضباب", 48: "ضباب متجمد", 51: "رذاذ خفيف", 53: "رذاذ", 55: "رذاذ كثيف",
  61: "مطر خفيف", 63: "مطر", 65: "مطر غزير", 66: "مطر متجمد", 67: "مطر متجمد غزير", 71: "ثلج خفيف", 73: "ثلج", 75: "ثلج كثيف",
  80: "زخات خفيفة", 81: "زخات مطر", 82: "زخات غزيرة", 95: "عواصف رعدية", 96: "رعد مع برد", 99: "رعد مع برد كثيف",
};
const DIRS = ["شمالية", "شمالية شرقية", "شرقية", "جنوبية شرقية", "جنوبية", "جنوبية غربية", "غربية", "شمالية غربية"];

const fmt = new Intl.NumberFormat("ar-SA-u-nu-latn");
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const photo = (u, size = "medium") => (u ? u.replace("{s}", size) : null);
const dirName = (deg) => DIRS[Math.round(((deg % 360) / 45)) % 8];
const store = {
  get(k, d) { try { const v = localStorage.getItem(k); return v === null ? d : JSON.parse(v); } catch { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} },
};

// ---------- private Claude page mode (no outside requests allowed there) ----------
const ART = window.SHEEENS_ARTIFACT ?? null;
const SP_COLS = 8;
function pic(b, extra = "") {
  if (ART) {
    const sp = b.sp;
    if (!sp) return `<div class="ph-empty ${extra}">بلا صورة</div>`;
    const [sheet, i] = sp;
    const col = i % SP_COLS, row = Math.floor(i / SP_COLS), rows = ART.spriteRows[sheet];
    return `<div class="sp ${extra}" role="img" aria-label="${esc(displayName(b))}" style="background-image:url(ph/${sheet}.jpg);background-size:${SP_COLS * 100}% ${rows * 100}%;background-position:${(col / (SP_COLS - 1)) * 100}% ${rows > 1 ? (row / (rows - 1)) * 100 : 0}%"></div>`;
  }
  const u = b.ph ?? b.photos?.[0]?.u;
  return u ? `<img loading="lazy" src="${esc(photo(u, extra === "big" ? "large" : "medium"))}" alt="${esc(displayName(b))}">` : `<div class="ph-empty">بلا صورة</div>`;
}

// ---------- local (personal) mode ----------
const LOCAL = ["127.0.0.1", "localhost"].includes(location.hostname);
if (LOCAL) document.documentElement.classList.add("is-local");
let statusPromise;
const apiStatus = () => (statusPromise ??= LOCAL ? fetch("/api/status").then((r) => (r.ok ? r.json() : {})).catch(() => ({})) : Promise.resolve({}));
const slimObs = (o) => ({ code: o.speciesCode, sci: o.sciName, en: o.comName, loc: o.locName, dt: o.obsDt, n: o.howMany ?? null, lat: o.lat, lng: o.lng, sub: o.subId });
async function ebird(path) {
  const r = await fetch(`/api/ebird/${path}`);
  if (!r.ok) throw new Error(r.status === 401 ? "مفتاح eBird غير مضبوط. افتح الإعدادات." : "تعذّر الاتصال بـ eBird الآن");
  return r.json();
}

// ---------- data ----------
let indexPromise, sightingsPromise;
const detailCache = new Map();
const plain = (t) => (t ? String(t).replace(/[\u064B-\u0652\u0670]/g, "") : t); // drop tashkeel for clean display
function loadIndex() {
  indexPromise ??= fetch("data/birds.json", { cache: "no-cache" }).then((r) => {
    if (!r.ok) throw new Error("تعذّر تحميل بيانات الطيور");
    return r.json();
  }).then((d) => { for (const b of d.birds) b.ar = plain(b.ar); return d; });
  return indexPromise;
}
function loadSightings() {
  sightingsPromise ??= (async () => {
    const st = await apiStatus();
    if (st.ebird) {
      try {
        const [latest, notable] = await Promise.all([ebird("data/obs/SA/recent?back=30&maxResults=10000"), ebird("data/obs/SA/recent/notable?back=30&detail=simple")]);
        return { generatedAt: new Date().toISOString(), live: true, latest: latest.map(slimObs), notable: notable.map(slimObs), bySpecies: {} };
      } catch {}
    }
    return fetch("data/sightings.json", { cache: "no-cache" }).then((r) => (r.ok ? r.json() : null)).catch(() => null);
  })();
  return sightingsPromise;
}
let cornellPromise;
function loadCornell() {
  cornellPromise ??= fetch("data/cornell.json").then((r) => (r.ok ? r.json() : [])).then((list) => { list.forEach((x, i) => (x.i = i)); return list; }).catch(() => []);
  return cornellPromise;
}
const audioSrc = (p) => "../" + p.split("/").map(encodeURIComponent).join("/");
let allDetails;
async function loadDetail(id) {
  if (ART) {
    allDetails ??= fetch("data/details.json").then((r) => r.json());
    const d = (await allDetails)[id];
    if (!d) throw new Error("الطير غير موجود");
    d.ar = plain(d.ar);
    return d;
  }
  if (!detailCache.has(id)) {
    detailCache.set(id, fetch(`data/b/${id}.json`).then((r) => { if (!r.ok) throw new Error("الطير غير موجود"); return r.json(); })
      .then((b) => { b.ar = plain(b.ar); b.arAlt = [...new Set((b.arAlt ?? []).map(plain).filter((x) => x && x !== b.ar))]; return b; }));
  }
  return detailCache.get(id);
}

const norm = (s) => String(s ?? "").toLowerCase()
  .replace(/[ً-ْـ]/g, "").replace(/[أإآ]/g, "ا").replace(/ة/g, "ه").replace(/ى/g, "ي").trim();
const displayName = (b) => b.ar || b.en || b.sci;
const favs = new Set(store.get("favs", []));
const toggleFav = (id) => { favs.has(id) ? favs.delete(id) : favs.add(id); store.set("favs", [...favs]); };

// ---------- small views ----------
function strip(presence) {
  if (!presence?.length) return "";
  return `<div class="strip" title="تقدير وجوده في المملكة حسب الشهر">${presence
    .map((p, i) => `<i class="${i === NOW_MONTH ? "now" : ""}" style="background:${rampColor(p)}"></i>`)
    .join("")}</div>`;
}
function rampColor(p) {
  if (p >= 0.75) return "var(--ramp-4)";
  if (p >= 0.5) return "var(--ramp-3)";
  if (p >= 0.25) return "var(--ramp-2)";
  if (p > 0.05) return "var(--ramp-1)";
  return "var(--ramp-0)";
}
function card(b) {
  const img = ART ? b.sp : photo(b.ph, "medium");
  const st = STATUS[b.status] ?? STATUS.unknown;
  return `<a class="card" href="#bird-${b.id}">
    ${b.hunting ? `<span class="mark">مقناص</span>` : ""}
    <div class="ph ${img ? "" : "empty"}">${img ? pic(b) : "بلا صورة"}</div>
    <div class="body">
      <div class="ar">${esc(displayName(b))}</div>
      ${b.local && b.local !== b.ar ? `<div class="local">${esc(b.local)}</div>` : ""}
      <div class="sci latin">${esc(b.sci)}</div>
      <div class="meta">
        <span class="tag" title="${esc(st.hint)}">${st.icon} ${st.label}</span>
        ${b.iucn && b.iucn !== "LC" ? `<span class="tag iucn-${esc(b.iucn)}">${esc(IUCN[b.iucn] ?? b.iucn)}</span>` : ""}
        ${b.snd ? `<span class="tag">♪ صوت</span>` : ""}
      </div>
      ${strip(b.presence)}
    </div>
  </a>`;
}
function setActiveNav(name) {
  document.querySelectorAll("[data-nav]").forEach((a) => a.classList.toggle("active", a.dataset.nav === name));
}
const errorView = (e) => `<div class="error-box">${esc(e.message || e)}</div>`;
const timeAgo = (d) => {
  const diff = (Date.now() - new Date(d).getTime()) / 36e5;
  if (diff < 1) return "قبل أقل من ساعة";
  if (diff < 24) return `قبل ${Math.round(diff)} ساعة`;
  const days = Math.round(diff / 24);
  return days === 1 ? "أمس" : days === 2 ? "قبل يومين" : `قبل ${days} أيام`;
};
const dateAr = (d) => new Date(d.replace(" ", "T")).toLocaleDateString("ar-SA-u-ca-gregory-nu-latn", { day: "numeric", month: "long" });

// ---------- weather ----------
const wxCache = new Map();
let wxSnap;
async function fetchWeather(lat, lon) {
  if (ART) {
    wxSnap ??= fetch("data/weather.json").then((r) => r.json());
    const snap = await wxSnap;
    const name = REGIONS.find((r) => r[1] === lat && r[2] === lon)?.[0];
    const d = snap.regions[name];
    if (!d) throw new Error("ما فيه بيانات طقس لهذي المنطقة");
    d.snapshotAt = snap.generatedAt;
    return d;
  }
  const key = `${lat.toFixed(2)},${lon.toFixed(2)}`;
  const hit = wxCache.get(key);
  if (hit && Date.now() - hit.t < 15 * 60e3) return hit.data;
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}` +
    `&current=temperature_2m,relative_humidity_2m,apparent_temperature,precipitation,weather_code,cloud_cover,wind_speed_10m,wind_direction_10m,wind_gusts_10m,surface_pressure,visibility` +
    `&hourly=temperature_2m,wind_speed_10m,wind_direction_10m,wind_gusts_10m,precipitation_probability` +
    `&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,precipitation_sum,wind_speed_10m_max,wind_gusts_10m_max,wind_direction_10m_dominant,sunrise,sunset` +
    `&timezone=Asia%2FRiyadh&forecast_days=7&wind_speed_unit=kmh`;
  const r = await fetch(url);
  if (!r.ok) throw new Error("تعذّر جلب الطقس الآن");
  const data = await r.json();
  wxCache.set(key, { t: Date.now(), data });
  return data;
}
function currentRegion() {
  const name = store.get("region", "الرياض");
  return REGIONS.find((r) => r[0] === name) ?? REGIONS[0];
}
function regionSelect(id, selected) {
  return `<select class="sel" id="${id}" aria-label="المنطقة">${REGIONS.map(
    (r) => `<option ${r[0] === selected ? "selected" : ""}>${esc(r[0])}</option>`
  ).join("")}</select>`;
}
function dayScore(d) {
  // Rough field-outing guide: calm wind, low gusts, low rain chance, comfortable temperature.
  let s = 0;
  if (d.wind <= 15) s += 2; else if (d.wind <= 25) s += 1;
  if (d.gust <= 30) s += 1;
  if (d.rain <= 20) s += 2; else if (d.rain <= 45) s += 1;
  if (d.tmax <= 34 && d.tmin >= 5) s += 1;
  if (s >= 5) return ["good", "مناسب"];
  if (s >= 3) return ["ok", "متوسط"];
  return ["bad", "غير مناسب"];
}
function migrationWindNote(dirDeg, month) {
  const d = dirName(dirDeg);
  const northerly = dirDeg >= 300 || dirDeg <= 60;
  const southerly = dirDeg >= 120 && dirDeg <= 240;
  if (month >= 7 && month <= 10) {
    return northerly
      ? `الرياح ${d} في موسم الهجرة الخريفية تساعد الطيور القادمة من الشمال، وغالباً يزيد العبور.`
      : `الرياح ${d}: في الخريف تفضّل الطيور المهاجرة جنوباً الرياح الشمالية، فالعبور غالباً أقل.`;
  }
  if (month >= 1 && month <= 4) {
    return southerly
      ? `الرياح ${d} في هجرة الربيع تساعد الطيور العائدة شمالاً.`
      : `الرياح ${d}: في الربيع تفضّل الطيور العائدة شمالاً الرياح الجنوبية.`;
  }
  return `الرياح ${d}. خارج ذروتي الهجرة (الربيع والخريف) يقل أثر الرياح على العبور.`;
}

async function renderWxMini(el) {
  const [name, lat, lon] = currentRegion();
  el.innerHTML = `<div class="row"><h3>طقس المقناص</h3>${regionSelect("wxMiniSel", name)}</div><div class="skel" style="height:120px"></div>`;
  el.querySelector("#wxMiniSel").onchange = (e) => { store.set("region", e.target.value); renderWxMini(el); };
  try {
    const w = await fetchWeather(lat, lon);
    const c = w.current;
    const today = { wind: w.daily.wind_speed_10m_max[0], gust: w.daily.wind_gusts_10m_max[0], rain: w.daily.precipitation_probability_max[0] ?? 0, tmax: w.daily.temperature_2m_max[0], tmin: w.daily.temperature_2m_min[0] };
    const [cls, label] = dayScore(today);
    el.innerHTML = `
      <div class="row"><h3>طقس المقناص</h3>${regionSelect("wxMiniSel", name)}</div>
      <div class="row">
        <div><div class="wx-temp">${Math.round(c.temperature_2m)}°</div><div class="muted">${esc(WMO[c.weather_code] ?? "")}</div></div>
        <div style="text-align:end"><span class="score ${cls}" style="padding:3px 12px;border-radius:999px;font-weight:700;font-size:.85rem">طلعة اليوم: ${label}</span></div>
      </div>
      <div class="wx-grid">
        <div class="wx-cell"><small>الرياح</small><b>${Math.round(c.wind_speed_10m)} كم/س</b></div>
        <div class="wx-cell"><small>الاتجاه</small><b><span class="arrow" style="transform:rotate(${c.wind_direction_10m + 180}deg)">↑</span> ${dirName(c.wind_direction_10m)}</b></div>
        <div class="wx-cell"><small>الهبات</small><b>${Math.round(c.wind_gusts_10m)} كم/س</b></div>
      </div>
      <a class="link-more" href="#weather">توقعات 7 أيام ←</a>`;
    el.querySelector("#wxMiniSel").onchange = (e) => { store.set("region", e.target.value); renderWxMini(el); };
  } catch (e) {
    el.insertAdjacentHTML("beforeend", errorView(e));
  }
}

// ---------- pages ----------
async function pageHome(params) {
  setActiveNav("home");
  const data = await loadIndex();
  const birds = data.birds;
  const presentNow = birds.filter((b) => (b.presence?.[NOW_MONTH] ?? 0) >= 0.5 && b.status !== "vagrant").length;
  const hunting = birds.filter((b) => b.hunting);
  const families = [...new Map(birds.filter((b) => b.fam).map((b) => [b.fam, b.famAr || b.fam])).entries()]
    .sort((a, b) => a[1].localeCompare(b[1], "ar"));

  const state = {
    q: params.get("q") ?? store.get("q", ""),
    filter: store.get("filter", "all"),
    fam: store.get("fam", "all"),
    sort: store.get("sort", "common"),
    shown: 60,
  };

  app.innerHTML = `
    <section class="hero">
      <div class="hero-main">
        <h1>دليل طيور السعودية</h1>
        <p>كل طير سُجّل في المملكة: اسمه العربي والدارج والإنجليزي والعلمي، وصوره، وموسم وجوده شهراً بشهر، وصوته، وآخر مشاهداته.</p>
        <label class="search">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>
          <input id="q" type="search" placeholder="ابحث: قميري، صفاري، Turtle Dove، Streptopelia…" value="${esc(state.q)}" autocomplete="off">
        </label>
        <div class="stats">
          <div class="stat"><b>${fmt.format(birds.length)}</b><span>نوعاً مسجلاً في المملكة</span></div>
          <div class="stat"><b>${fmt.format(hunting.length)}</b><span>من طيور المقناص</span></div>
          <div class="stat"><b>${fmt.format(presentNow)}</b><span>موجود في ${MONTHS[NOW_MONTH]} غالباً</span></div>
        </div>
      </div>
      <aside class="wx-mini" id="wxMini"></aside>
    </section>

    <section class="section">
      <div class="section-head"><div><h2>طيور المقناص</h2><p>الأنواع اللي يعرفها أهل المقناص بأسمائها الدارجة.</p></div><a class="link-more" href="#hunting">كلها ←</a></div>
      <div class="scroller">${hunting.slice(0, 16).map(card).join("")}</div>
    </section>

    <section class="section" id="catalog">
      <div class="section-head"><div><h2>كل الطيور</h2><p>الشريط الملوّن تحت كل طير يبين وجوده شهراً بشهر (يناير يميناً)، والمربع المحدد هو الشهر الحالي.</p></div></div>
      <div class="filters">
        ${[["all", "الكل"], ["fav", "★ مفضلتي"], ["hunting", "المقناص"], ["now", "موجود هذا الشهر"], ["resident", "مقيم"], ["winter", "شتوي"], ["summer", "صيفي"], ["passage", "عابر"], ["threat", "مهدد"]]
          .map(([k, l]) => `<button class="chip ${state.filter === k ? "on" : ""}" data-f="${k}">${l}</button>`).join("")}
        <select class="sel" id="fam" aria-label="الفصيلة"><option value="all">كل الفصائل</option>${families
          .map(([k, l]) => `<option value="${esc(k)}" ${state.fam === k ? "selected" : ""}>${esc(l)}</option>`).join("")}</select>
        <select class="sel" id="sort" aria-label="الترتيب">
          <option value="common" ${state.sort === "common" ? "selected" : ""}>الأكثر تسجيلاً</option>
          <option value="name" ${state.sort === "name" ? "selected" : ""}>أبجدياً</option>
        </select>
        <span class="count-note" id="countNote"></span>
      </div>
      <div class="grid" id="grid"></div>
      <div class="more" id="more"></div>
    </section>`;

  renderWxMini(document.getElementById("wxMini"));

  const grid = document.getElementById("grid");
  const more = document.getElementById("more");
  const countNote = document.getElementById("countNote");
  const searchIndex = birds.map((b) => ({ b, t: norm([b.ar, b.local, b.en, b.sci, b.famAr, b.group].join(" ")) }));

  function apply() {
    const q = norm(state.q);
    let list = searchIndex.filter((x) => !q || x.t.includes(q)).map((x) => x.b);
    const f = state.filter;
    if (f === "hunting") list = list.filter((b) => b.hunting);
    else if (f === "fav") list = list.filter((b) => favs.has(b.id));
    else if (f === "now") list = list.filter((b) => (b.presence?.[NOW_MONTH] ?? 0) >= 0.5 && b.status !== "vagrant");
    else if (f === "threat") list = list.filter((b) => ["NT", "VU", "EN", "CR"].includes(b.iucn));
    else if (f !== "all") list = list.filter((b) => b.status === f);
    if (state.fam !== "all") list = list.filter((b) => b.fam === state.fam);
    if (state.sort === "name") list = [...list].sort((a, b) => displayName(a).localeCompare(displayName(b), "ar"));
    countNote.textContent = `${fmt.format(list.length)} نوعاً`;
    grid.innerHTML = list.length ? list.slice(0, state.shown).map(card).join("") : `<div class="empty" style="grid-column:1/-1">${state.filter === "fav" && !state.q ? "ما أضفت طيوراً للمفضلة بعد. افتح أي طير واضغط ☆." : "ما لقينا طيراً بهذا البحث."}</div>`;
    more.innerHTML = list.length > state.shown ? `<button class="btn ghost" id="moreBtn">عرض المزيد (${fmt.format(list.length - state.shown)})</button>` : "";
    document.getElementById("moreBtn")?.addEventListener("click", () => { state.shown += 60; apply(); });
  }
  apply();

  let t;
  document.getElementById("q").addEventListener("input", (e) => {
    clearTimeout(t);
    t = setTimeout(() => {
      state.q = e.target.value; state.shown = 60; store.set("q", state.q); apply();
      if (state.q && window.scrollY < 300) document.getElementById("catalog").scrollIntoView({ behavior: "smooth" });
    }, 180);
  });
  document.querySelectorAll("[data-f]").forEach((btn) => btn.addEventListener("click", () => {
    state.filter = btn.dataset.f; state.shown = 60; store.set("filter", state.filter);
    document.querySelectorAll("[data-f]").forEach((b) => b.classList.toggle("on", b === btn));
    apply();
  }));
  document.getElementById("fam").onchange = (e) => { state.fam = e.target.value; state.shown = 60; store.set("fam", state.fam); apply(); };
  document.getElementById("sort").onchange = (e) => { state.sort = e.target.value; store.set("sort", state.sort); apply(); };
}

async function pageBird(id) {
  setActiveNav("");
  const [b, index] = await Promise.all([loadDetail(id), loadIndex()]);
  const st = STATUS[b.status] ?? STATUS.unknown;
  document.title = `${displayName(b)} | شينز`;
  const photos = b.photos ?? [];
  const sameFamily = index.birds.filter((x) => x.fam === b.fam && x.id !== b.id).slice(0, 8);
  const total = b.months.reduce((a, c) => a + c, 0);

  const nameRows = [
    ["الاسم العربي", esc(b.ar ?? "—") + (b.arAlt?.length ? `<div class="muted" style="font-size:.85rem">ويسمى أيضاً: ${b.arAlt.map(esc).join("، ")}</div>` : "")],
    ["الاسم الدارج", b.local ? `<b style="color:var(--primary)">${esc(b.local)}</b>${b.localNote ? ` <span class="muted" style="font-size:.85rem">(${esc(b.localNote)})</span>` : ""}` : `<span class="muted">غير مسجل بعد</span>`],
    ["بالإنجليزي", `<span class="en">${esc(b.en ?? "—")}</span>`],
    ["الاسم العلمي", `<span class="latin">${esc(b.sci)}</span>${b.inatName && b.inatName !== b.sci ? ` <span class="muted latin" style="font-size:.85rem">(${esc(b.inatName)})</span>` : ""}`],
    ["الفصيلة", `${esc(b.famAr ?? "")} <span class="latin muted">${esc(b.fam ?? "")}</span>`],
    ["الرتبة", `${esc(b.ordAr ?? "")} <span class="latin muted">${esc(b.ord ?? "")}</span>`],
  ];

  app.innerHTML = `
    <div class="crumbs"><a href="#home">الطيور</a> / ${b.famAr ? `${esc(b.famAr)} / ` : ""}${esc(displayName(b))}</div>
    <div class="bird-top">
      <div class="gallery">
        <div class="main-ph" id="mainPh">${ART ? pic({ ...b, sp: index.birds.find((x) => x.id === b.id)?.sp }, "big") : photos[0] ? `<img src="${esc(photo(photos[0].u, "large"))}" alt="${esc(displayName(b))}">` : `<div class="empty" style="height:100%;display:grid;place-items:center">لا توجد صورة</div>`}</div>
        <div class="credit" id="credit">${photos[0] ? esc(photos[0].a) : ""}</div>
        ${photos.length > 1 && !ART ? `<div class="thumbs">${photos.map((p, i) => `<button class="${i === 0 ? "on" : ""}" data-i="${i}" aria-label="صورة ${i + 1}"><img loading="lazy" src="${esc(photo(p.u, "square"))}" alt=""></button>`).join("")}</div>` : ""}
      </div>
      <div class="names">
        <h1>${esc(displayName(b))} <button class="fav-btn ${favs.has(b.id) ? "on" : ""}" id="favBtn" aria-label="مفضلة" title="أضف للمفضلة">${favs.has(b.id) ? "★" : "☆"}</button></h1>
        ${b.local && b.local !== b.ar ? `<div class="local-big">${esc(b.local)}</div>` : ""}
        <div class="latin muted" style="font-size:1.1rem">${esc(b.sci)}</div>
        <div class="badges">
          ${b.hunting ? `<span class="badge hunt">من طيور المقناص${b.group ? ` · ${esc(b.group)}` : ""}</span>` : b.group ? `<span class="badge">${esc(b.group)}</span>` : ""}
          <span class="badge" title="${esc(st.hint)}">${st.icon} ${st.label}</span>
          ${b.iucn ? `<span class="badge ${["VU", "EN", "CR"].includes(b.iucn) ? "warn" : ""}">القائمة الحمراء: ${esc(IUCN[b.iucn] ?? b.iucn)}</span>` : ""}
        </div>
        <div class="name-table">${nameRows.map(([k, v]) => `<div><span class="k">${k}</span><span>${v}</span></div>`).join("")}</div>
        ${b.localNote && /محمي|ممنوع|مقيد/.test(b.localNote) ? `<div class="note">⚠ ${esc(b.localNote)}</div>` : ""}
      </div>
    </div>

    <div class="two-col">
      <div class="panel">
        <h3>متى يكون في السعودية؟</h3>
        <p class="muted" style="margin:4px 0 0;font-size:.88rem">${esc(st.hint)}. التقدير مبني على ${fmt.format(total)} سجلاً في GBIF وeBird، بعد موازنته بعدد الراصدين في كل شهر.</p>
        <div class="cal">${b.presence.map((p, i) => `<div class="col ${i === NOW_MONTH ? "now" : ""}" title="${MONTHS[i]}: ${fmt.format(b.months[i])} سجلاً"><div class="bar" style="height:${Math.max(3, p * 100)}%;background:${i === NOW_MONTH ? "" : rampColor(Math.max(p, 0.3))}"></div><span class="lbl">${MONTHS_SHORT[i]}</span></div>`).join("")}</div>
        <div class="legend"><span>الأعمدة الأطول تعني فرصة أكبر لوجوده</span><span>الشهر الحالي باللون الداكن</span></div>
      </div>
      <div class="panel">
        <h3>نبذة</h3>
        ${b.summary ? `<p class="summary">${esc(b.summary)}</p>` : b.summaryEn ? `<p class="summary en" dir="ltr" style="text-align:left">${esc(b.summaryEn)}</p>` : `<p class="muted">لا توجد نبذة عربية لهذا الطير بعد.</p>`}
        <div class="links">
          ${b.arWiki ? `<a href="${esc(b.arWiki)}" target="_blank" rel="noopener">ويكيبيديا العربية</a>` : ""}
          ${b.wiki ? `<a href="${esc(b.wiki)}" target="_blank" rel="noopener">Wikipedia</a>` : ""}
          ${b.ebird ? `<a href="https://ebird.org/species/${esc(b.ebird)}/SA" target="_blank" rel="noopener">eBird في السعودية</a>` : ""}
          ${b.ebird ? `<a href="https://birdsoftheworld.org/bow/species/${esc(b.ebird)}/cur/introduction" target="_blank" rel="noopener">Birds of the World</a>` : ""}
          ${b.inat ? `<a href="https://www.inaturalist.org/taxa/${b.inat}" target="_blank" rel="noopener">iNaturalist</a>` : ""}
          <a href="https://www.gbif.org/species/${b.id}" target="_blank" rel="noopener">GBIF</a>
          <a href="https://xeno-canto.org/explore?query=${encodeURIComponent(b.inatName || b.sci)}" target="_blank" rel="noopener">xeno-canto</a>
        </div>
      </div>
    </div>

    <div class="two-col">
      <div class="panel">
        <h3>الصوت</h3>
        ${b.sounds?.length ? b.sounds.map((s) => `
          <div class="sound">
            <div><b>${esc(soundType(s.type))}</b> <span class="muted">· ${esc(s.cnt ?? "")}${s.len ? ` · ${esc(s.len)}` : ""}</span></div>
            ${ART ? `<a class="btn ghost" style="justify-self:start;padding:5px 14px" href="${esc(s.url)}" target="_blank" rel="noopener">▶ استمع في xeno-canto</a>` : `<audio controls preload="none" src="${esc(s.file)}"></audio>`}
            <div class="meta">تسجيل: ${esc(s.rec)} · <a href="${esc(s.url)}" target="_blank" rel="noopener">XC${esc(s.id)}</a> · <a href="${esc(s.lic?.startsWith("//") ? "https:" + s.lic : s.lic)}" target="_blank" rel="noopener">الرخصة</a></div>
          </div>`).join("") : `<p class="muted">لا توجد تسجيلات محفوظة بعد. تقدر تسمعه مباشرة في <a href="https://xeno-canto.org/explore?query=${encodeURIComponent(b.inatName || b.sci)}" target="_blank" rel="noopener">xeno-canto</a>.</p>`}
        <p class="muted" style="font-size:.8rem;margin-bottom:0">للتعرّف والتعلّم فقط. استخدام الأصوات أو أجهزة النداء لجذب الطيور في الصيد ممنوع نظاماً.</p>
      </div>
      <div class="panel">
        <h3>آخر المشاهدات في المملكة</h3>
        <div id="birdSightings"><div class="skel" style="height:80px"></div></div>
      </div>
    </div>

    <div id="libBox"></div>
    ${sameFamily.length ? `<section class="section"><div class="section-head"><h2>من نفس الفصيلة</h2></div><div class="scroller">${sameFamily.map(card).join("")}</div></section>` : ""}`;

  document.querySelectorAll(".thumbs button").forEach((btn) => btn.addEventListener("click", () => {
    const p = photos[Number(btn.dataset.i)];
    document.getElementById("mainPh").innerHTML = `<img src="${esc(photo(p.u, "large"))}" alt="${esc(displayName(b))}">`;
    document.getElementById("credit").textContent = p.a;
    document.querySelectorAll(".thumbs button").forEach((x) => x.classList.toggle("on", x === btn));
  }));
  document.getElementById("favBtn").addEventListener("click", (e) => {
    toggleFav(b.id);
    e.currentTarget.classList.toggle("on", favs.has(b.id));
    e.currentTarget.textContent = favs.has(b.id) ? "★" : "☆";
  });
  window.scrollTo(0, 0);

  const cornell = await loadCornell();
  const lib = cornell.find((x) => x.sci && (x.sci === b.sci || x.sci === b.inatName));
  const libBox = document.getElementById("libBox");
  if (libBox && lib) libBox.innerHTML = `<div class="panel" style="margin-top:16px"><h3>من مكتبتك: دليل كورنيل (${fmt.format(lib.clips.length)} مقطعاً)</h3>
    <p class="muted" style="font-size:.85rem;margin:4px 0 0">تسجيلات من أمريكا وكندا لنفس النوع. <a href="#lib-${lib.i}">صفحته في المكتبة</a></p>
    ${clipList(lib.clips.slice(0, 6), lib)}</div>`;

  const api = await apiStatus();
  const s = await loadSightings();
  const box = document.getElementById("birdSightings");
  if (!box) return;
  if (!s) { box.innerHTML = `<p class="muted">المشاهدات غير متاحة حالياً.</p>`; return; }
  const sci = new Set([b.sci, b.inatName].filter(Boolean));
  let liveObs = null;
  if (api.ebird && b.ebird) { try { liveObs = (await ebird(`data/obs/SA/recent/${b.ebird}?back=30`)).map(slimObs); } catch {} }
  const obs = liveObs || (b.ebird && s.bySpecies?.[b.ebird]) || [...s.latest, ...s.notable].filter((o) => o.code === b.ebird || sci.has(o.sci));
  const uniq = [...new Map(obs.map((o) => [(o.sub ?? o.dt) + o.code, o])).values()].sort((a, c) => c.dt.localeCompare(a.dt)).slice(0, 8);
  box.innerHTML = uniq.length ? `<ul class="list">${uniq.map(sightingRow).join("")}</ul><p class="muted" style="font-size:.8rem">من eBird خلال آخر 30 يوماً · حُدّثت ${timeAgo(s.generatedAt)}</p>`
    : `<p class="muted">ما سُجّلت له مشاهدات في eBird خلال آخر 30 يوماً.</p>`;
}
function soundType(t) {
  const x = String(t ?? "").toLowerCase();
  if (x.includes("song")) return "تغريد";
  if (x.includes("flight")) return "نداء طيران";
  if (x.includes("alarm")) return "نداء إنذار";
  if (x.includes("call")) return "نداء";
  return t || "تسجيل";
}
function sightingRow(o, bird) {
  const map = o.lat ? `https://www.google.com/maps?q=${o.lat},${o.lng}` : null;
  return `<li>
    ${bird?.id ? `<a class="thumb" href="#bird-${bird.id}">${(ART ? bird.sp : bird.ph) ? pic(bird) : ""}</a>` : bird ? `<span class="thumb"></span>` : ""}
    <div class="grow">
      ${bird?.id ? `<a class="t" href="#bird-${bird.id}">${esc(bird.local || displayName(bird))}</a>` : bird ? `<span class="t en">${esc(displayName(bird))}</span>` : ""}
      <div class="${bird ? "s" : "t"}">${o.hidden ? "الموقع مخفي لحماية النوع" : esc(o.loc)}</div>
      <div class="s">${dateAr(o.dt)}${o.n ? ` · العدد: ${fmt.format(o.n)}` : ""}</div>
    </div>
    <div class="side">${map ? `<a href="${map}" target="_blank" rel="noopener">الخريطة</a><br>` : ""}${o.sub ? `<a href="https://ebird.org/checklist/${esc(o.sub)}" target="_blank" rel="noopener">السجل</a>` : ""}</div>
  </li>`;
}

async function pageHunting() {
  setActiveNav("hunting");
  const data = await loadIndex();
  const hunting = data.birds.filter((b) => b.hunting);
  const groups = new Map();
  for (const b of hunting) {
    const g = b.group || "أخرى";
    if (!groups.has(g)) groups.set(g, []);
    groups.get(g).push(b);
  }
  app.innerHTML = `
    <div class="section-head"><div><h1>طيور المقناص</h1><p>الأنواع المعروفة عند أهل المقناص في المملكة، مرتبة حسب المجموعة، ولكل طير موسم وجوده.</p></div></div>
    <div class="note" style="margin-bottom:20px">الصيد في المملكة يحتاج ترخيصاً من المركز الوطني لتنمية الحياة الفطرية، وله مواسم ومناطق محددة. يُمنع صيد الأنواع المحمية والصيد بالشباك وأجهزة النداء الإلكترونية. تحقق من الأنظمة المحدثة قبل أي طلعة.</div>
    ${(() => {
      const here = hunting.filter((b) => (b.presence?.[NOW_MONTH] ?? 0) >= 0.5 && b.status !== "vagrant").sort((a, b) => b.presence[NOW_MONTH] - a.presence[NOW_MONTH]);
      return here.length ? `<section class="section" style="margin-top:0"><div class="section-head"><div><h2>موجودة في ${MONTHS[NOW_MONTH]}</h2><p>طيور المقناص اللي فرصة وجودها عالية هذا الشهر حسب السجلات.</p></div><span class="muted">${fmt.format(here.length)}</span></div><div class="scroller">${here.map(card).join("")}</div></section>` : "";
    })()}
    ${[...groups.entries()].map(([g, list]) => `
      <section class="section">
        <div class="section-head"><h2>${esc(g)}</h2><span class="muted">${fmt.format(list.length)}</span></div>
        <div class="grid">${list.map(card).join("")}</div>
      </section>`).join("")}
    <p class="muted" style="margin-top:28px">الأسماء الدارجة تختلف من منطقة لمنطقة. إذا عندك تصحيح أو اسم ناقص، عدّله في ملف <span class="en">data/local-names.json</span> في المستودع.</p>`;
}

async function pageMigration(params) {
  setActiveNav("migration");
  const data = await loadIndex();
  const m = Math.min(11, Math.max(0, Number(params.get("m") ?? NOW_MONTH)));
  const present = data.birds.filter((b) => (b.presence?.[m] ?? 0) >= 0.5 && b.status !== "vagrant" && b.n >= 20);
  const order = ["passage", "winter", "summer", "resident", "unknown"];
  const titles = { passage: "عابرون هذا الشهر", winter: "زوار الشتاء", summer: "زوار الصيف", resident: "المقيمون", unknown: "آخرون" };
  const arriving = data.birds.filter((b) => b.status !== "resident" && b.status !== "vagrant" && b.n >= 20 &&
    (b.presence?.[m] ?? 0) >= 0.5 && (b.presence?.[(m + 11) % 12] ?? 0) < 0.3);
  app.innerHTML = `
    <div class="section-head"><div><h1>هجرة ${MONTHS[m]}</h1><p>الطيور اللي فرصة وجودها في المملكة عالية في هذا الشهر، حسب سجلات GBIF وeBird. هذا تقدير مبني على السجلات، وليس رصداً لحظياً.</p></div></div>
    <div class="month-pick">${MONTHS.map((n, i) => `<a class="chip ${i === m ? "on" : ""}" href="#migration-${i}">${n}</a>`).join("")}</div>
    ${arriving.length ? `<section class="section"><div class="section-head"><div><h2>يبدأ وصولها في ${MONTHS[m]}</h2><p>كانت قليلة الشهر الماضي وتزيد هذا الشهر.</p></div></div><div class="scroller">${arriving.map(card).join("")}</div></section>` : ""}
    ${order.map((s) => {
      const list = present.filter((b) => b.status === s).sort((a, b) => (b.presence[m] - a.presence[m]) || (b.n - a.n));
      return list.length ? `<section class="section"><div class="section-head"><h2>${titles[s]}</h2><span class="muted">${fmt.format(list.length)}</span></div><div class="grid">${list.slice(0, 48).map(card).join("")}</div></section>` : "";
    }).join("")}`;
  window.scrollTo(0, 0);
}

async function pageWeather() {
  setActiveNav("weather");
  const [name, lat, lon] = currentRegion();
  app.innerHTML = `
    <div class="wx-head"><div><h1>طقس المقناص</h1><p class="muted" style="margin:4px 0 0">توقعات مباشرة من Open-Meteo لمناطق المملكة، مع مؤشر إرشادي للطلعة وأثر الرياح على الهجرة.</p></div>${regionSelect("wxSel", name)}</div>
    <div id="wxBody"><div class="skel" style="height:300px"></div></div>`;
  document.getElementById("wxSel").onchange = (e) => { store.set("region", e.target.value); pageWeather(); };
  const body = document.getElementById("wxBody");
  try {
    const w = await fetchWeather(lat, lon);
    const c = w.current;
    const d = w.daily;
    const days = d.time.map((t, i) => ({
      t, code: d.weather_code[i], tmax: d.temperature_2m_max[i], tmin: d.temperature_2m_min[i],
      rain: d.precipitation_probability_max[i] ?? 0, rainSum: d.precipitation_sum[i], wind: d.wind_speed_10m_max[i],
      gust: d.wind_gusts_10m_max[i], dir: d.wind_direction_10m_dominant[i], sunrise: d.sunrise[i], sunset: d.sunset[i],
    }));
    const hours = w.hourly.time.map((t, i) => ({ t, temp: w.hourly.temperature_2m[i], wind: w.hourly.wind_speed_10m[i], gust: w.hourly.wind_gusts_10m[i], dir: w.hourly.wind_direction_10m[i], rain: w.hourly.precipitation_probability[i] }));
    const nowIdx = Math.max(0, hours.findIndex((h) => h.t >= c.time.slice(0, 13)));
    const next = hours.slice(nowIdx, nowIdx + 24);
    const hm = (s) => s.slice(11, 16);
    body.innerHTML = `
      <div class="panel">
        <div class="wx-now">
          <div><div class="big">${Math.round(c.temperature_2m)}°</div><div class="muted">${esc(WMO[c.weather_code] ?? "")} · الإحساس ${Math.round(c.apparent_temperature)}°</div></div>
          <div class="kpis">
            <div class="kpi"><small>سرعة الرياح</small><b>${Math.round(c.wind_speed_10m)} كم/س</b></div>
            <div class="kpi"><small>اتجاه الرياح</small><b><span class="arrow" style="transform:rotate(${c.wind_direction_10m + 180}deg)">↑</span> ${dirName(c.wind_direction_10m)}</b></div>
            <div class="kpi"><small>الهبات</small><b>${Math.round(c.wind_gusts_10m)} كم/س</b></div>
            <div class="kpi"><small>الرطوبة</small><b>${Math.round(c.relative_humidity_2m)}٪</b></div>
            <div class="kpi"><small>الغيوم</small><b>${Math.round(c.cloud_cover)}٪</b></div>
            <div class="kpi"><small>الضغط</small><b>${Math.round(c.surface_pressure)} هـ.ب</b></div>
            <div class="kpi"><small>الشروق</small><b>${hm(days[0].sunrise)}</b></div>
            <div class="kpi"><small>الغروب</small><b>${hm(days[0].sunset)}</b></div>
          </div>
        </div>
        ${w.snapshotAt ? `<p class="muted" style="font-size:.8rem;margin:12px 0 0">آخر تحديث للطقس: ${timeAgo(w.snapshotAt)} (يتحدث تلقائياً كل 3 ساعات)</p>` : ""}
        <p class="note" style="margin:16px 0 0">🧭 ${esc(migrationWindNote(c.wind_direction_10m, NOW_MONTH))}</p>
      </div>

      <div class="panel">
        <h3>الأيام السبعة القادمة</h3>
        <div class="days" style="margin-top:12px">${days.map((x, i) => {
          const [cls, label] = dayScore(x);
          const dn = i === 0 ? "اليوم" : i === 1 ? "بكرة" : new Date(x.t).toLocaleDateString("ar-SA-u-ca-gregory-nu-latn", { weekday: "long" });
          return `<div class="day">
            <span class="dname">${dn}</span>
            <span class="muted">${esc(WMO[x.code] ?? "")}</span>
            <span><b>${Math.round(x.tmax)}°</b> / ${Math.round(x.tmin)}°</span>
            <span>رياح ${Math.round(x.wind)} كم/س · ${dirName(x.dir)}</span>
            <span class="muted">هبات ${Math.round(x.gust)} · مطر ${x.rain}٪</span>
            <span class="score ${cls}">${label}</span>
          </div>`;
        }).join("")}</div>
        <p class="muted" style="font-size:.8rem;margin-bottom:0">مؤشر الطلعة إرشادي فقط: يحسب هدوء الرياح وقلة احتمال المطر واعتدال الحرارة.</p>
      </div>

      <div class="panel">
        <h3>الرياح والحرارة خلال 24 ساعة</h3>
        ${hourChart(next)}
        <div class="legend"><span style="color:var(--primary)">━ الرياح (كم/س)</span><span style="color:var(--info)">┅ الهبات</span><span>الأسهم: اتجاه هبوب الرياح</span></div>
      </div>`;
  } catch (e) {
    body.innerHTML = errorView(e);
  }
}
function hourChart(hours) {
  if (!hours.length) return "";
  const W = 720, H = 220, pad = 30;
  const maxV = Math.max(20, ...hours.map((h) => h.gust)) * 1.1;
  const x = (i) => W - pad - (i * (W - 2 * pad)) / (hours.length - 1); // RTL: time flows right to left
  const y = (v) => H - pad - (v / maxV) * (H - 2 * pad - 20);
  const line = (k) => hours.map((h, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(h[k]).toFixed(1)}`).join(" ");
  return `<svg class="chart" viewBox="0 0 ${W} ${H}" preserveAspectRatio="none" role="img" aria-label="الرياح خلال 24 ساعة">
    ${[0, 0.5, 1].map((f) => `<line x1="${pad}" x2="${W - pad}" y1="${y(maxV * f / 1.1)}" y2="${y(maxV * f / 1.1)}" stroke="var(--border)" stroke-width="1"/><text x="${W - 4}" y="${y(maxV * f / 1.1) + 4}" text-anchor="end">${Math.round(maxV * f / 1.1)}</text>`).join("")}
    <path d="${line("gust")}" fill="none" stroke="var(--info)" stroke-width="1.6" stroke-dasharray="4 3"/>
    <path d="${line("wind")}" fill="none" stroke="var(--primary)" stroke-width="2.4"/>
    ${hours.map((h, i) => (i % 3 === 0 ? `<g transform="translate(${x(i)},${pad - 8}) rotate(${h.dir + 180})"><path d="M0,-7 L4,4 L0,1 L-4,4 Z" fill="var(--fg)"/></g><text x="${x(i)}" y="${H - 8}" text-anchor="middle">${h.t.slice(11, 13)}:00</text><text x="${x(i)}" y="${pad + 14}" text-anchor="middle">${Math.round(h.temp)}°</text>` : "")).join("")}
  </svg>`;
}

async function pageSightings(params) {
  setActiveNav("sightings");
  const [data, s] = await Promise.all([loadIndex(), loadSightings()]);
  if (!s) {
    app.innerHTML = `<h1>المشاهدات الحديثة</h1><div class="empty" style="margin-top:16px">المشاهدات تتحدث تلقائياً كل 3 ساعات من eBird، وما وصلت أول دفعة بعد.</div>`;
    return;
  }
  const bySci = new Map();
  for (const b of data.birds) { bySci.set(b.sci, b); if (b.eb) bySci.set(b.eb, b); }
  const huntingOnly = params.get("h") === "1";
  const rows = s.latest
    .map((o) => ({ o, b: bySci.get(o.code) || bySci.get(o.sci) }))
    .filter((r) => !huntingOnly || r.b?.hunting)
    .sort((a, b) => b.o.dt.localeCompare(a.o.dt));
  const notable = s.notable
    .map((o) => ({ o, b: bySci.get(o.code) || bySci.get(o.sci) }))
    .sort((a, b) => b.o.dt.localeCompare(a.o.dt));
  const uniqNotable = [...new Map(notable.map((r) => [r.o.code + (r.o.loc ?? r.o.dt), r])).values()].slice(0, 30);
  app.innerHTML = `
    <div class="section-head"><div><h1>المشاهدات الحديثة</h1><p>آخر رصد لكل نوع في المملكة خلال 30 يوماً، من سجلات راصدي eBird. ${s.live ? "مباشر من eBird الآن." : `حُدّثت ${timeAgo(s.generatedAt)}.`}</p></div></div>
    <div class="filters">
      <a class="chip ${huntingOnly ? "" : "on"}" href="#sightings">كل الطيور (${fmt.format(s.latest.length)})</a>
      <a class="chip ${huntingOnly ? "on" : ""}" href="#sightings-h">طيور المقناص فقط</a>
    </div>
    ${s.live ? `<div class="panel" style="margin-bottom:16px"><div class="wx-head" style="margin:0"><h3>قريب من منطقتي (50 كم · آخر 14 يوماً)</h3>${regionSelect("nearSel", currentRegion()[0])}</div><div id="nearBox"><div class="skel" style="height:60px;margin-top:10px"></div></div></div>` : ""}
    <div class="two-col" style="margin-top:0">
      <div class="panel"><h3>آخر مشاهدة لكل نوع</h3>
        ${rows.length ? `<ul class="list">${rows.slice(0, 120).map((r) => sightingRow(r.o, r.b ?? { id: "", local: null, ar: r.o.en, sci: r.o.sci })).join("")}</ul>` : `<p class="muted">لا توجد مشاهدات.</p>`}
      </div>
      <div class="panel"><h3>مشاهدات لافتة</h3><p class="muted" style="font-size:.85rem;margin-top:4px">أنواع نادرة أو في غير موسمها حسب eBird.</p>
        ${uniqNotable.length ? `<ul class="list">${uniqNotable.map((r) => sightingRow(r.o, r.b ?? { id: "", local: null, ar: r.o.en, sci: r.o.sci })).join("")}</ul>` : `<p class="muted">لا شيء لافت مؤخراً.</p>`}
      </div>
    </div>`;
  if (s.live) {
    const near = async () => {
      const [, lat, lng] = currentRegion();
      const nb = document.getElementById("nearBox");
      try {
        const obs = (await ebird(`data/obs/geo/recent?lat=${lat}&lng=${lng}&dist=50&back=14&maxResults=200`)).map(slimObs)
          .map((o) => ({ o, b: bySci.get(o.code) || bySci.get(o.sci) })).filter((r) => !huntingOnly || r.b?.hunting);
        nb.innerHTML = obs.length ? `<ul class="list">${obs.slice(0, 60).map((r) => sightingRow(r.o, r.b ?? { id: "", local: null, ar: r.o.en, sci: r.o.sci })).join("")}</ul>` : `<p class="muted">ما فيه مشاهدات قريبة مسجلة.</p>`;
      } catch (e) { nb.innerHTML = errorView(e); }
    };
    document.getElementById("nearSel").onchange = (e) => { store.set("region", e.target.value); near(); };
    near();
  }
}

// ---------- Cornell library (personal) ----------
function libLink(x) {
  if (!ART || x.part == null) return "";
  return `${ART.libUrls[x.part]}#b${x.bi}`;
}
function clipList(clips, x) {
  if (ART) return `<ul class="list">${clips.map((c) => `<li><div class="grow">${esc(c.l)}</div></li>`).join("")}</ul>
    ${x ? `<a class="btn" style="margin-top:10px" href="${esc(libLink(x))}" target="_blank" rel="noopener">▶ استمع لكل المقاطع في المكتبة</a>` : ""}`;
  return clips.map((c) => `<div class="sound"><div><b>${esc(c.l)}</b></div><audio controls preload="none" src="${esc(audioSrc(c.p))}"></audio></div>`).join("");
}
async function pageLibrary(params) {
  setActiveNav("library");
  const list = await loadCornell();
  if (!list.length) {
    app.innerHTML = `<h1>المكتبة</h1><div class="empty" style="margin-top:16px">المكتبة غير متاحة هنا. شغّل الموقع من ملف «شغّل الموقع» داخل مجلد مكتبة كورنيل.</div>`;
    return;
  }
  const fams = [...new Set(list.map((x) => x.fam))];
  const state = { q: store.get("libq", ""), fam: store.get("libfam", "all"), only: store.get("libonly", "all"), shown: 80 };
  const total = list.reduce((a, x) => a + x.clips.length, 0);
  const saudi = new Set((await loadIndex()).birds.map((b) => b.sci));
  app.innerHTML = `
    <div class="section-head"><div><h1>المكتبة الصوتية</h1><p>دليل كورنيل لأصوات الطيور (أمريكا وكندا)${ART ? "" : " من جهازك"}: ${fmt.format(list.length)} نوعاً و${fmt.format(total)} مقطعاً. للاستخدام الشخصي فقط.</p></div></div>
    <label class="search" style="margin-bottom:12px">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>
      <input id="lq" type="search" placeholder="ابحث بالعربي أو الدارج أو الإنجليزي أو العلمي" value="${esc(state.q)}" autocomplete="off">
    </label>
    <div class="filters">
      ${[["all", "الكل"], ["local", "له اسم دارج"], ["saudi", "موجود في السعودية"]].map(([k, l]) => `<button class="chip ${state.only === k ? "on" : ""}" data-o="${k}">${l}</button>`).join("")}
      <select class="sel" id="lfam"><option value="all">كل الفصائل</option>${fams.map((f) => `<option ${state.fam === f ? "selected" : ""}>${esc(f)}</option>`).join("")}</select>
      <span class="count-note" id="lcount"></span>
    </div>
    <ul class="list panel" id="llist"></ul>
    <div class="more" id="lmore"></div>`;
  const idx = list.map((x) => ({ x, t: norm([x.ar, x.local, x.en, x.sci, x.fam].join(" ")) }));
  const draw = () => {
    const q = norm(state.q);
    let r = idx.filter((y) => !q || y.t.includes(q)).map((y) => y.x);
    if (state.fam !== "all") r = r.filter((x) => x.fam === state.fam);
    if (state.only === "local") r = r.filter((x) => x.local);
    if (state.only === "saudi") r = r.filter((x) => saudi.has(x.sci));
    document.getElementById("lcount").textContent = `${fmt.format(r.length)} نوعاً`;
    document.getElementById("llist").innerHTML = r.length ? r.slice(0, state.shown).map((x) => `<li><div class="grow"><a class="t" href="#lib-${x.i}">${esc(x.ar)}</a>${x.local ? ` <span style="color:var(--primary);font-weight:600">· ${esc(x.local)}</span>` : ""}
      <div class="s"><span class="en">${esc(x.en)}</span> · <span class="latin">${esc(x.sci ?? "")}</span></div></div>
      <div class="side">${fmt.format(x.clips.length)} مقطع${saudi.has(x.sci) ? "<br>🇸🇦" : ""}</div></li>`).join("") : `<li class="muted">ما فيه نتائج.</li>`;
    document.getElementById("lmore").innerHTML = r.length > state.shown ? `<button class="btn ghost" id="lmb">عرض المزيد</button>` : "";
    document.getElementById("lmb")?.addEventListener("click", () => { state.shown += 120; draw(); });
  };
  draw();
  let t;
  document.getElementById("lq").addEventListener("input", (e) => { clearTimeout(t); t = setTimeout(() => { state.q = e.target.value; state.shown = 80; store.set("libq", state.q); draw(); }, 150); });
  document.getElementById("lfam").onchange = (e) => { state.fam = e.target.value; store.set("libfam", state.fam); draw(); };
  document.querySelectorAll("[data-o]").forEach((b) => b.addEventListener("click", () => {
    state.only = b.dataset.o; store.set("libonly", state.only);
    document.querySelectorAll("[data-o]").forEach((x) => x.classList.toggle("on", x === b)); draw();
  }));
}
async function pageLibBird(i) {
  setActiveNav("library");
  const list = await loadCornell();
  const x = list[Number(i)];
  if (!x) throw new Error("الطير غير موجود في المكتبة");
  const sa = (await loadIndex()).birds.find((b) => b.sci === x.sci);
  document.title = `${x.ar} | المكتبة`;
  app.innerHTML = `
    <div class="crumbs"><a href="#library">المكتبة</a> / ${esc(x.fam)} / ${esc(x.ar)}</div>
    <div class="bird-top">
      <div class="gallery"><div class="main-ph" id="lph">${(ART ? sa?.sp : sa?.ph) ? pic(sa, "big") : ART ? `<div class="ph-empty">لا توجد صورة</div>` : `<div class="skel" style="height:100%"></div>`}</div><div class="credit" id="lcr"></div></div>
      <div class="names">
        <h1>${esc(x.ar)}</h1>
        ${x.local ? `<div class="local-big">${esc(x.local)}</div>` : ""}
        <div class="latin muted" style="font-size:1.1rem">${esc(x.sci ?? "")}</div>
        <div class="name-table">
          <div><span class="k">بالإنجليزي</span><span class="en">${esc(x.en)}</span></div>
          <div><span class="k">الاسم العلمي</span><span class="latin">${esc(x.sci ?? "")}</span></div>
          <div><span class="k">الفصيلة</span><span>${esc(x.fam)}</span></div>
          <div><span class="k">في السعودية</span><span>${sa ? `<a href="#bird-${sa.id}" style="color:var(--primary)">نعم، افتح صفحته ←</a>` : `<span class="muted">غير مسجّل في السعودية</span>`}</span></div>
        </div>
      </div>
    </div>
    <div class="panel" style="margin-top:16px"><h3>المقاطع (${fmt.format(x.clips.length)})</h3>${clipList(x.clips, x)}
      <p class="muted" style="font-size:.8rem;margin-bottom:0">من The Cornell Guide to Bird Sounds، مكتبة ماكولي. للاستخدام الشخصي فقط، واستخدام الأصوات لجذب الطيور في الصيد ممنوع.</p></div>`;
  window.scrollTo(0, 0);
  if (!ART && !sa?.ph && x.sci) {
    try {
      const r = await fetch(`https://api.inaturalist.org/v1/taxa?q=${encodeURIComponent(x.sci)}&rank=species&per_page=1`).then((r) => r.json());
      const p = r.results?.[0]?.default_photo;
      const el = document.getElementById("lph");
      if (el) el.innerHTML = p ? `<img src="${esc(String(p.medium_url).replace("/medium.", "/large."))}" alt="">` : `<div class="empty" style="height:100%;display:grid;place-items:center">لا توجد صورة</div>`;
      const cr = document.getElementById("lcr");
      if (cr && p) cr.textContent = p.attribution;
    } catch {}
  }
}
async function pageSettings() {
  setActiveNav("settings");
  if (!LOCAL) { app.innerHTML = `<h1>الإعدادات</h1><div class="empty" style="margin-top:16px">الإعدادات متاحة لما تشغّل الموقع من جهازك.</div>`; return; }
  const st = await fetch("/api/status").then((r) => r.json()).catch(() => ({}));
  app.innerHTML = `
    <h1>الإعدادات</h1>
    <div class="panel" style="margin-top:16px">
      <h3>المفاتيح</h3>
      <p class="muted" style="font-size:.88rem">تنحفظ على جهازك فقط في ملف config.json، وما تطلع للمتصفح.</p>
      <div class="name-table">
        <div><span class="k">eBird</span><span>${st.ebird ? "✅ مضبوط" : "❌ غير مضبوط"}</span></div>
        <div><span class="k">xeno-canto</span><span>${st.xc ? "✅ مضبوط" : "❌ غير مضبوط"}</span></div>
      </div>
      <form id="keys" style="display:grid;gap:10px;max-width:520px">
        <label class="search"><input name="ebird" type="password" placeholder="مفتاح eBird (اتركه فاضي إذا ما تبي تغيّره)" autocomplete="off"></label>
        <label class="search"><input name="xc" type="password" placeholder="مفتاح xeno-canto (اختياري)" autocomplete="off"></label>
        <button class="btn" type="submit" style="justify-self:start">حفظ</button>
        <div id="kmsg" class="muted"></div>
      </form>
    </div>
    <div class="panel">
      <h3>تحديث بيانات الطيور</h3>
      <p class="muted" style="font-size:.88rem">يسحب من جديد قائمة طيور السعودية وصورها وأسماءها وأصواتها (ياخذ 10 إلى 20 دقيقة). المشاهدات ما تحتاج تحديث، لأنها مباشرة.</p>
      ${st.node ? `<button class="btn ghost" id="upd">ابدأ التحديث</button>` : `<p class="note">يحتاج برنامج Node.js على جهازك. تحمّله مجاناً من nodejs.org ثم أعد تشغيل الموقع.</p>`}
      <pre id="ulog" class="muted" style="white-space:pre-wrap;font-size:.8rem;max-height:220px;overflow:auto;direction:ltr;text-align:left">${esc(st.updateLog ?? "")}</pre>
    </div>`;
  document.getElementById("keys").addEventListener("submit", async (e) => {
    e.preventDefault();
    const f = new FormData(e.target);
    const body = { ebird: String(f.get("ebird") || "").trim(), xc: String(f.get("xc") || "").trim() };
    const r = await fetch("/api/config", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    document.getElementById("kmsg").textContent = r.ok ? "تم الحفظ." : "تعذّر الحفظ.";
    statusPromise = null; sightingsPromise = null;
    if (r.ok) setTimeout(pageSettings, 600);
  });
  document.getElementById("upd")?.addEventListener("click", async (e) => {
    e.currentTarget.disabled = true;
    await fetch("/api/update", { method: "POST" });
    const tick = async () => {
      const s2 = await fetch("/api/status").then((r) => r.json()).catch(() => ({}));
      const el = document.getElementById("ulog");
      if (!el) return;
      el.textContent = s2.updateLog ?? "";
      el.scrollTop = el.scrollHeight;
      if (s2.updating) setTimeout(tick, 3000); else { indexPromise = null; detailCache.clear(); }
    };
    tick();
  });
}

// ---------- router ----------
async function route() {
  const raw = decodeURIComponent(location.hash.replace(/^#\/?/, ""));
  const [path, qs] = raw.split("?");
  const params = new URLSearchParams(qs ?? "");
  const m = path.match(/^([a-z]+)[-/]?(.*)$/) ?? [];
  const parts = [m[1] ?? "", m[2] ?? ""].filter(Boolean);
  if (parts[0] === "migration" && parts[1]) params.set("m", parts[1]);
  if (parts[0] === "sightings" && parts[1] === "h") params.set("h", "1");
  document.title = "شينز | دليل طيور السعودية";
  try {
    if (parts[0] === "bird" && parts[1]) await pageBird(parts[1]);
    else if (parts[0] === "hunting") await pageHunting();
    else if (parts[0] === "migration") await pageMigration(params);
    else if (parts[0] === "weather") await pageWeather();
    else if (parts[0] === "sightings") await pageSightings(params);
    else if (parts[0] === "library") await pageLibrary(params);
    else if (parts[0] === "lib" && parts[1]) await pageLibBird(parts[1]);
    else if (parts[0] === "settings") await pageSettings();
    else await pageHome(params);
  } catch (e) {
    app.innerHTML = errorView(e);
  }
}
window.addEventListener("hashchange", () => { route(); if (!/bird|lib-/.test(location.hash)) window.scrollTo(0, 0); });
route();

loadIndex().then((d) => {
  const el = document.getElementById("dataStamp");
  if (el && d.generatedAt) el.textContent = `آخر تحديث لبيانات الطيور: ${new Date(d.generatedAt).toLocaleDateString("ar-SA-u-ca-gregory-nu-latn", { day: "numeric", month: "long", year: "numeric" })}`;
}).catch(() => {});

document.getElementById("themeBtn").addEventListener("click", () => {
  const root = document.documentElement;
  const dark = root.dataset.theme ? root.dataset.theme === "dark" : matchMedia("(prefers-color-scheme: dark)").matches;
  root.dataset.theme = dark ? "light" : "dark";
  store.set("theme", root.dataset.theme);
});

document.addEventListener("error", (e) => {
  const img = e.target;
  if (img?.tagName === "IMG" && !img.dataset.failed) { img.dataset.failed = "1"; img.style.visibility = "hidden"; }
}, true);
