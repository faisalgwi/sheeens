// Weekly sync: builds data/birds.json (index) and data/b/<id>.json (details) for all birds recorded in Saudi Arabia.
// Sources: GBIF (species list, monthly records incl. eBird data, IUCN), iNaturalist (Arabic names, photos, Wikipedia),
// eBird taxonomy (Arabic/English names, species codes), Wikidata + Arabic Wikipedia, xeno-canto (sounds).
// Env: EBIRD_API_KEY (optional), XENO_CANTO_API_KEY (optional).
import { readFile, writeFile, mkdir, rm } from "node:fs/promises";

const UA = { "User-Agent": "sheeens-birds/1.0 (https://sheeens.com)" };
const INAT_PLACE_SA = 7358;
const AVES = 212;
const DATA = process.env.DATA_DIR ? new URL(`file://${process.env.DATA_DIR.replace(/\/?$/, "/")}`) : new URL("../data/", import.meta.url);

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const hasArabic = (s) => !!s && /[؀-ۿ]/.test(s);
const stripHtml = (s) =>
  s ? s.replace(/<[^>]+>/g, "").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/\s+/g, " ").trim() || null : null;

async function getJson(url, init = {}, retries = 5) {
  for (let attempt = 0; ; attempt++) {
    let res;
    try {
      res = await fetch(url, { ...init, headers: { ...UA, ...(init.headers || {}) } });
    } catch (e) {
      if (attempt >= retries) throw e;
      await sleep(2000 * (attempt + 1));
      continue;
    }
    if (res.ok) return res.json();
    if (attempt >= retries || (res.status !== 429 && res.status < 500)) {
      throw new Error(`HTTP ${res.status} ${url.slice(0, 140)}`);
    }
    const ra = Number(res.headers.get("retry-after"));
    await sleep(ra ? ra * 1000 : 2500 * (attempt + 1));
  }
}

async function mapLimit(items, limit, fn) {
  const out = new Array(items.length);
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, async () => {
      while (next < items.length) {
        const i = next++;
        out[i] = await fn(items[i], i);
      }
    })
  );
  return out;
}

async function readJson(name, fallback) {
  try {
    return JSON.parse(await readFile(new URL(name, DATA), "utf8"));
  } catch {
    return fallback;
  }
}

const log = (...a) => console.log(new Date().toISOString().slice(11, 19), ...a);

// ---------- 1. GBIF ----------
log("GBIF species list");
const list = await getJson(
  `https://api.gbif.org/v1/occurrence/search?country=SA&classKey=${AVES}&limit=0&facet=speciesKey&facetLimit=3000`
);
const counts = list.facets[0].counts
  .map((c) => ({ key: Number(c.name), count: c.count }))
  .slice(0, Number(process.env.LIMIT) || undefined);
log(`${counts.length} species keys`);

const effortRes = await getJson(
  `https://api.gbif.org/v1/occurrence/search?country=SA&classKey=${AVES}&limit=0&facet=month&facetLimit=12`
);
const effort = Array(12).fill(0);
for (const c of effortRes.facets[0].counts) effort[Number(c.name) - 1] = c.count;

const prev = await readJson("birds.json", { birds: [] });
const prevById = new Map(prev.birds.map((b) => [b.id, b]));

const gbifRows = await mapLimit(counts, 3, async ({ key, count }) => {
  try {
    const sp = await getJson(`https://api.gbif.org/v1/species/${key}`);
    if (sp.rank !== "SPECIES") return null;
    const m = await getJson(
      `https://api.gbif.org/v1/occurrence/search?country=SA&speciesKey=${key}&limit=0&facet=month&facetLimit=12`
    );
    const months = Array(12).fill(0);
    for (const c of m.facets?.[0]?.counts ?? []) months[Number(c.name) - 1] = c.count;
    const iu = await getJson(`https://api.gbif.org/v1/species/${key}/iucnRedListCategory`, {}, 2).catch(() => null);
    return {
      id: key,
      sci: sp.canonicalName || sp.species,
      fam: sp.family ?? null,
      ord: sp.order ?? null,
      n: count,
      months,
      iucn: iu?.code ?? null,
    };
  } catch (e) {
    log(`GBIF failed for ${key}: ${e.message}`);
    const old = prevById.get(key);
    return old ? { id: key, sci: old.sci, fam: old.fam, ord: old.ord, n: count, months: old.months, iucn: old.iucn } : null;
  }
});
const birds = gbifRows.filter(Boolean);
log(`${birds.length} species with data`);

// ---------- 2. Presence & status (effort-corrected, estimate) ----------
const effortTotal = effort.reduce((a, b) => a + b, 0);
for (const b of birds) {
  const total = b.months.reduce((a, c) => a + c, 0);
  let presence = Array(12).fill(0);
  let st = "unknown";
  if (total > 0) {
    const rel = b.months.map((c, i) => (effort[i] ? c / total / (effort[i] / effortTotal) : 0));
    const max = Math.max(...rel, 1e-9);
    presence = rel.map((r) => Math.round((r / max) * 100) / 100);
    const avg = (idx) => idx.reduce((a, i) => a + presence[i], 0) / idx.length;
    const W = avg([10, 11, 0, 1]);
    const S = avg([4, 5, 6, 7]);
    const P = avg([2, 3, 8, 9]);
    const present = presence.filter((p) => p >= 0.25).length;
    if (total < 8) st = "vagrant";
    else if (present >= 10 || Math.min(W, S, P) >= 0.3) st = "resident";
    else if (S < 0.15 && W < 0.2 && P >= 0.35) st = "passage";
    else if (W >= 0.35 && S < 0.15) st = "winter";
    else if (S >= 0.35 && W < 0.15) st = "summer";
    else if (present >= 8) st = "resident";
    else if (W >= S && W >= 0.3) st = "winter";
    else if (S > W && S >= 0.3) st = "summer";
    else if (P >= 0.3) st = "passage";
  }
  b.presence = presence;
  b.status = st;
}

// ---------- 3. iNaturalist ids (cached in data/inat-ids.json) ----------
const inatIds = await readJson("inat-ids.json", {});
log("iNat species_counts");
for (let page = 1; page <= 5; page++) {
  const r = await getJson(
    `https://api.inaturalist.org/v1/observations/species_counts?place_id=${INAT_PLACE_SA}&iconic_taxa=Aves&per_page=500&page=${page}`
  );
  for (const x of r.results) if (!inatIds[x.taxon.name]) inatIds[x.taxon.name] = x.taxon.id;
  if (r.results.length < 500) break;
  await sleep(1100);
}
const missing = birds.filter((b) => inatIds[b.sci] === undefined);
log(`iNat search for ${missing.length} names`);
for (const b of missing) {
  try {
    const r = await getJson(
      `https://api.inaturalist.org/v1/taxa?q=${encodeURIComponent(b.sci)}&iconic_taxa=Aves&per_page=5`
    );
    const hit =
      r.results.find((t) => t.name === b.sci) ??
      r.results.find((t) => t.matched_term === b.sci && ["species", "subspecies"].includes(t.rank));
    inatIds[b.sci] = hit ? (hit.rank === "subspecies" ? hit.parent_id : hit.id) : -1;
  } catch (e) {
    log(`iNat search failed ${b.sci}: ${e.message}`);
  }
  await sleep(1100);
}
await writeFile(new URL("inat-ids.json", DATA), JSON.stringify(inatIds, null, 0));

// ---------- 4. iNaturalist details ----------
const withInat = birds.filter((b) => inatIds[b.sci] > 0);
log(`iNat details for ${withInat.length}`);
for (let i = 0; i < withInat.length; i += 30) {
  const chunk = withInat.slice(i, i + 30);
  const ids = chunk.map((b) => inatIds[b.sci]).join(",");
  let res;
  try {
    res = await getJson(`https://api.inaturalist.org/v1/taxa/${ids}?locale=ar&preferred_place_id=${INAT_PLACE_SA}`);
  } catch (e) {
    log(`iNat details failed: ${e.message}`);
    continue;
  }
  const byId = new Map(res.results.map((t) => [t.id, t]));
  for (const b of chunk) {
    const t = byId.get(inatIds[b.sci]);
    if (!t) continue;
    const anc = (rank) => (t.ancestors ?? []).find((a) => a.rank === rank);
    b.inat = t.id;
    b.inatName = t.name;
    b.arInat = hasArabic(t.preferred_common_name) ? t.preferred_common_name : null;
    b.enInat = t.english_common_name ?? null;
    b.famAr = hasArabic(anc("family")?.preferred_common_name) ? anc("family").preferred_common_name : null;
    b.ordAr = hasArabic(anc("order")?.preferred_common_name) ? anc("order").preferred_common_name : null;
    const summary = stripHtml(t.wikipedia_summary);
    b.summary = hasArabic(summary) ? summary : null;
    b.summaryEn = summary && !hasArabic(summary) ? summary : null;
    b.wiki = t.wikipedia_url ?? null;
    b.inatN = t.observations_count ?? null;
    b.photos = (t.taxon_photos ?? [])
      .map((tp) => tp.photo)
      .filter((p) => p && (p.medium_url || p.url))
      .slice(0, 6)
      .map((p) => ({
        u: String(p.medium_url || p.url).replace(/\/(square|medium|small|large|original)\.(\w+)(\?.*)?$/, "/{s}.$2"),
        a: p.attribution ?? "",
        lic: p.license_code ?? null,
      }));
    if (!b.iucn) {
      const c = (t.conservation_statuses ?? []).find((x) => x.authority === "IUCN Red List" && !x.place);
      if (c?.status) b.iucn = String(c.status).toUpperCase();
    }
  }
  await sleep(1100);
}

// ---------- 5. eBird taxonomy (Arabic + English names, species codes) ----------
const EBIRD = process.env.EBIRD_API_KEY;
if (EBIRD) {
  log("eBird taxonomy");
  try {
    const headers = { "X-eBirdApiToken": EBIRD };
    const en = await getJson(`https://api.ebird.org/v2/ref/taxonomy/ebird?fmt=json&cat=species&locale=en`, { headers });
    const ar = await getJson(`https://api.ebird.org/v2/ref/taxonomy/ebird?fmt=json&cat=species&locale=ar`, { headers });
    const arByCode = new Map(ar.map((x) => [x.speciesCode, x.comName]));
    const bySci = new Map(en.map((x) => [x.sciName, x]));
    for (const b of birds) {
      const x = bySci.get(b.sci) ?? (b.inatName ? bySci.get(b.inatName) : undefined);
      if (!x) continue;
      b.ebird = x.speciesCode;
      b.enEbird = x.comName;
      const a = arByCode.get(x.speciesCode);
      b.arEbird = hasArabic(a) ? a : null;
    }
  } catch (e) {
    log(`eBird taxonomy failed: ${e.message}`);
  }
}

// ---------- 6. Wikidata + Arabic Wikipedia ----------
log("Wikidata");
const names = [...new Set(birds.flatMap((b) => [b.sci, b.inatName]).filter((n) => n && /^[A-Za-z][A-Za-z -]+$/.test(n)))];
const wd = new Map();
for (let i = 0; i < names.length; i += 150) {
  const values = names.slice(i, i + 150).map((n) => `"${n}"`).join(" ");
  const q = `SELECT ?name ?ar ?arTitle WHERE { VALUES ?name { ${values} } ?item wdt:P225 ?name . OPTIONAL { ?item rdfs:label ?ar FILTER(lang(?ar) = "ar") } OPTIONAL { ?s schema:about ?item ; schema:isPartOf <https://ar.wikipedia.org/> ; schema:name ?arTitle } }`;
  try {
    const r = await getJson(`https://query.wikidata.org/sparql?format=json&query=${encodeURIComponent(q)}`, {
      headers: { Accept: "application/sparql-results+json" },
    });
    for (const row of r.results.bindings) {
      const p = wd.get(row.name.value) ?? {};
      wd.set(row.name.value, { label: p.label ?? row.ar?.value ?? null, title: p.title ?? row.arTitle?.value ?? null });
    }
  } catch (e) {
    log(`Wikidata failed: ${e.message}`);
  }
  await sleep(800);
}
const needSummary = [];
for (const b of birds) {
  const w = wd.get(b.sci) ?? (b.inatName ? wd.get(b.inatName) : undefined);
  if (!w) continue;
  b.arWd = hasArabic(w.label) ? w.label : null;
  b.arWikiTitle = w.title ?? null;
  if (!b.summary && w.title) needSummary.push(b);
}
log(`Arabic Wikipedia summaries for ${needSummary.length}`);
await mapLimit(needSummary, 3, async (b) => {
  try {
    const r = await getJson(
      `https://ar.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(b.arWikiTitle.replace(/ /g, "_"))}`,
      {},
      1
    );
    if (hasArabic(r.extract)) b.summary = r.extract;
  } catch {}
});

// ---------- 7. Sounds (xeno-canto v3) ----------
const XC = process.env.XENO_CANTO_API_KEY;
const prevSounds = new Map(prev.birds.map((b) => [b.id, b.hasSounds]));
if (XC) {
  log("xeno-canto sounds");
  const ME = ["Saudi Arabia", "United Arab Emirates", "Oman", "Kuwait", "Qatar", "Bahrain", "Yemen", "Jordan", "Israel", "Iraq", "Iran", "Egypt"];
  await mapLimit(birds, 2, async (b) => {
    try {
      const r = await getJson(
        `https://xeno-canto.org/api/3/recordings?query=${encodeURIComponent(`sp:"${b.inatName || b.sci}" q:A`)}&key=${XC}&per_page=100`,
        {},
        3
      );
      const recs = (r.recordings ?? [])
        .map((x) => ({
          id: x.id,
          file: x.file,
          type: x.type,
          cnt: x.cnt,
          rec: x.rec,
          lic: x.lic,
          len: x.length,
          url: x.url?.startsWith("//") ? "https:" + x.url : x.url,
          me: ME.includes(x.cnt),
        }))
        .filter((x) => x.file);
      recs.sort((a, b2) => Number(b2.me) - Number(a.me));
      const pick = [];
      const song = recs.find((x) => /song/i.test(x.type));
      const call = recs.find((x) => /call/i.test(x.type) && x !== song);
      for (const x of [song, call, ...recs]) if (x && !pick.includes(x) && pick.length < 4) pick.push(x);
      b.sounds = pick;
    } catch (e) {
      log(`xeno-canto failed ${b.sci}: ${e.message}`);
      b.sounds = undefined;
    }
    await sleep(300);
  });
}

// ---------- 8. Local names + final ----------
const local = (await readJson("local-names.json", { names: {} })).names;
for (const b of birds) {
  const l = local[b.sci] ?? (b.inatName ? local[b.inatName] : undefined);
  b.ar = b.arEbird || b.arInat || b.arWd || null;
  b.en = b.enEbird || b.enInat || null;
  b.local = l?.local ?? null;
  b.localNote = l?.note ?? null;
  b.group = l?.group ?? null;
  b.hunting = !!l?.hunting;
}

// keep previous sounds if xeno-canto failed or no key this run
const prevDetails = new Map();
await mkdir(new URL("b/", DATA), { recursive: true });
for (const b of birds) {
  if (b.sounds === undefined) {
    try {
      const old = JSON.parse(await readFile(new URL(`b/${b.id}.json`, DATA), "utf8"));
      if (old.sounds) b.sounds = old.sounds;
    } catch {}
  }
}

birds.sort((a, b) => b.n - a.n);
const index = birds.map((b) => ({
  id: b.id,
  sci: b.sci,
  ar: b.ar,
  en: b.en,
  local: b.local,
  group: b.group,
  hunting: b.hunting || undefined,
  fam: b.fam,
  famAr: b.famAr,
  iucn: b.iucn,
  status: b.status,
  presence: b.presence,
  n: b.n,
  ph: b.photos?.[0]?.u ?? null,
  snd: b.sounds?.length ? 1 : undefined,
  eb: b.ebird ?? undefined,
}));

const generatedAt = new Date().toISOString();
await writeFile(
  new URL("birds.json", DATA),
  JSON.stringify({ generatedAt, effort, count: index.length, birds: index })
);
for (const b of birds) {
  const detail = {
    id: b.id,
    sci: b.sci,
    inatName: b.inatName ?? null,
    ar: b.ar,
    arAlt: [...new Set([b.arEbird, b.arInat, b.arWd].filter((x) => x && x !== b.ar))],
    en: b.en,
    local: b.local,
    localNote: b.localNote,
    group: b.group,
    hunting: b.hunting,
    fam: b.fam,
    famAr: b.famAr,
    ord: b.ord,
    ordAr: b.ordAr,
    iucn: b.iucn,
    status: b.status,
    months: b.months,
    presence: b.presence,
    n: b.n,
    inat: b.inat ?? null,
    inatN: b.inatN ?? null,
    ebird: b.ebird ?? null,
    summary: b.summary ?? null,
    summaryEn: b.summaryEn ?? null,
    wiki: b.wiki ?? null,
    arWiki: b.arWikiTitle ? `https://ar.wikipedia.org/wiki/${encodeURIComponent(b.arWikiTitle.replace(/ /g, "_"))}` : null,
    photos: b.photos ?? [],
    sounds: b.sounds ?? [],
    generatedAt,
  };
  await writeFile(new URL(`b/${b.id}.json`, DATA), JSON.stringify(detail));
}
log(`done: ${index.length} birds`);
