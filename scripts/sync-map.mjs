// Map data for the 3D map: Saudi terrain heightmap + where each bird was recorded, per month (GBIF, includes eBird).
// Output: data/map/meta.json, data/map/elev.bin (Int16 LE), data/map/effort.json, data/map/sp/<gbifKey>.json
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { PNG } from "pngjs";

const DATA = new URL("../data/", import.meta.url);
const OUT = new URL("map/", DATA);
const BBOX = { w: 34.5, e: 56.0, s: 16.0, n: 32.5 };
const ELEV_STEP = 0.05;   // terrain grid
const CELL = 0.25;        // occurrence grid
const UA = { "User-Agent": "sheeens-birds/1.0 (personal map)" };
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
await mkdir(new URL("sp/", OUT), { recursive: true });

async function get(url, as = "json", tries = 5) {
  for (let i = 0; ; i++) {
    try {
      const r = await fetch(url, { headers: UA });
      if (r.ok) return as === "json" ? r.json() : Buffer.from(await r.arrayBuffer());
      if (r.status !== 429 && r.status < 500) throw new Error(`HTTP ${r.status}`);
    } catch (e) { if (i >= tries) throw e; }
    await sleep(2000 * (i + 1));
  }
}

// ---------- terrain (AWS Terrain Tiles, terrarium encoding) ----------
const Z = 7;
const lon2x = (lon) => ((lon + 180) / 360) * 2 ** Z;
const lat2y = (lat) => ((1 - Math.log(Math.tan((lat * Math.PI) / 180) + 1 / Math.cos((lat * Math.PI) / 180)) / Math.PI) / 2) * 2 ** Z;
const tiles = new Map();
async function tile(tx, ty) {
  const k = `${tx}/${ty}`;
  if (!tiles.has(k)) {
    const buf = await get(`https://s3.amazonaws.com/elevation-tiles-prod/terrarium/${Z}/${tx}/${ty}.png`, "buf");
    tiles.set(k, PNG.sync.read(buf));
  }
  return tiles.get(k);
}
const cols = Math.round((BBOX.e - BBOX.w) / ELEV_STEP) + 1;
const rows = Math.round((BBOX.n - BBOX.s) / ELEV_STEP) + 1;
const elev = new Int16Array(cols * rows);
for (let r = 0; r < rows; r++) {
  const lat = BBOX.n - r * ELEV_STEP;
  for (let c = 0; c < cols; c++) {
    const lon = BBOX.w + c * ELEV_STEP;
    const fx = lon2x(lon), fy = lat2y(lat);
    const t = await tile(Math.floor(fx), Math.floor(fy));
    const px = Math.min(255, Math.floor((fx % 1) * 256)), py = Math.min(255, Math.floor((fy % 1) * 256));
    const i = (py * 256 + px) * 4;
    const h = t.data[i] * 256 + t.data[i + 1] + t.data[i + 2] / 256 - 32768;
    elev[r * cols + c] = Math.max(-500, Math.round(h));
  }
}
await writeFile(new URL("elev.bin", OUT), Buffer.from(elev.buffer));
const gcm = Math.round((BBOX.e - BBOX.w) / CELL), grm = Math.round((BBOX.n - BBOX.s) / CELL);
await writeFile(new URL("meta.json", OUT), JSON.stringify({ generatedAt: new Date().toISOString(), bbox: BBOX, elev: { step: ELEV_STEP, cols, rows }, grid: { cell: CELL, cols: gcm, rows: grm } }));
console.log(`terrain ${cols}x${rows}, ${tiles.size} tiles`);

// ---------- occurrences per species ----------
const gc = Math.round((BBOX.e - BBOX.w) / CELL), gr = Math.round((BBOX.n - BBOX.s) / CELL);
const cellOf = (lat, lon) => {
  const c = Math.floor((lon - BBOX.w) / CELL), r = Math.floor((BBOX.n - lat) / CELL);
  return c >= 0 && c < gc && r >= 0 && r < gr ? r * gc + c : -1;
};
const idx = JSON.parse(await readFile(new URL("birds.json", DATA), "utf8"));
const MAX = 10000;           // records per bird is plenty for a map
const FRESH = 6 * 864e5;     // skip birds fetched in the last 6 days (lets a cut-off run resume)
const LEGACY_T = Date.parse("2026-11-13T12:00:00Z"); // files from the first run carry no time stamp
let done = 0;
async function species(b) {
  try {
    const old = JSON.parse(await readFile(new URL(`sp/${b.id}.json`, OUT), "utf8"));
    if (Date.now() - (old.t ?? LEGACY_T) < FRESH) { done++; return; }
  } catch {}
  const counts = new Map();
  let years = [];
  for (let off = 0; off < MAX; off += 300) {
    const r = await get(`https://api.gbif.org/v1/occurrence/search?country=SA&speciesKey=${b.id}&hasCoordinate=true&hasGeospatialIssue=false&limit=300&offset=${off}`);
    for (const o of r.results) {
      if (o.decimalLatitude == null || !o.month) continue;
      const cell = cellOf(o.decimalLatitude, o.decimalLongitude);
      if (cell < 0) continue;
      const k = cell * 12 + (o.month - 1);
      counts.set(k, (counts.get(k) ?? 0) + 1);
      if (o.year) years.push(o.year);
    }
    if (r.endOfRecords || !r.results.length) break;
  }
  const c = [...counts.entries()].map(([k, n]) => [Math.floor(k / 12), k % 12, n]);
  years.sort((a, b2) => a - b2);
  await writeFile(new URL(`sp/${b.id}.json`, OUT), JSON.stringify({ id: b.id, t: Date.now(), c, y: years.length ? [years[0], years[years.length - 1]] : null }));
  if (++done % 25 === 0) console.log(`species ${done}/${idx.birds.length}`);
}
const queue = [...idx.birds];
await Promise.all(Array.from({ length: 6 }, async () => {
  while (queue.length) {
    const b = queue.shift();
    try { await species(b); } catch (e) { console.log("fail", b.id, e.message); }
  }
}));
console.log("species done");
