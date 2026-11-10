// Every few hours: recent eBird sightings in Saudi Arabia -> data/sightings.json. Needs EBIRD_API_KEY.
import { readFile, writeFile } from "node:fs/promises";

const KEY = process.env.EBIRD_API_KEY;
const DATA = new URL("../data/", import.meta.url);
if (!KEY) {
  console.log("EBIRD_API_KEY not set: skipping sightings");
  process.exit(0);
}
const headers = { "X-eBirdApiToken": KEY, "User-Agent": "sheeens-birds/1.0 (https://sheeens.com)" };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function getJson(url) {
  for (let i = 0; i < 4; i++) {
    const r = await fetch(url, { headers });
    if (r.ok) return r.json();
    if (r.status !== 429 && r.status < 500) throw new Error(`HTTP ${r.status} ${url}`);
    await sleep(2000 * (i + 1));
  }
  throw new Error(`failed ${url}`);
}

const slim = (o) => ({
  code: o.speciesCode,
  sci: o.sciName,
  en: o.comName,
  loc: o.locName,
  dt: o.obsDt,
  n: o.howMany ?? null,
  lat: o.lat,
  lng: o.lng,
  sub: o.subId,
  priv: o.locationPrivate || undefined,
  ok: o.obsValid === false ? false : undefined,
});

const latest = (await getJson("https://api.ebird.org/v2/data/obs/SA/recent?back=30&maxResults=10000")).map(slim);
const notable = (await getJson("https://api.ebird.org/v2/data/obs/SA/recent/notable?back=30&detail=simple")).map(slim);

// For hunting birds: every recent observation (several places), not just the latest one.
const index = JSON.parse(await readFile(new URL("birds.json", DATA), "utf8").catch(() => '{"birds":[]}'));
const huntingCodes = [...new Set(index.birds.filter((b) => b.hunting && b.eb).map((b) => b.eb))];
const bySpecies = {};
for (const code of huntingCodes) {
  try {
    bySpecies[code] = (await getJson(`https://api.ebird.org/v2/data/obs/SA/recent/${code}?back=30`)).map(slim);
  } catch (e) {
    console.log(code, e.message);
  }
  await sleep(250);
}

// Hide exact locations of protected, threatened and falconry-sensitive species so the site can't help poaching.
const sensitive = new Set(
  index.birds
    .filter((b) => ["NT", "VU", "EN", "CR"].includes(b.iucn) || ["الصقور", "طرائد الصقارة"].includes(b.group))
    .flatMap((b) => [b.sci, b.eb].filter(Boolean))
);
const hide = (o) => (sensitive.has(o.code) || sensitive.has(o.sci) ? { ...o, loc: null, lat: null, lng: null, sub: null, hidden: true } : o);
for (const k of Object.keys(bySpecies)) bySpecies[k] = bySpecies[k].map(hide);
latest.splice(0, latest.length, ...latest.map(hide));
notable.splice(0, notable.length, ...notable.map(hide));

await writeFile(
  new URL("sightings.json", DATA),
  JSON.stringify({ generatedAt: new Date().toISOString(), latest, notable, bySpecies })
);
console.log(`sightings: latest ${latest.length}, notable ${notable.length}, hunting species ${huntingCodes.length}`);
