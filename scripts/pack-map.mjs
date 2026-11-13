// Packs data/map/sp/*.json into one data/map/map.json for the site.
// "effort" = records of all birds per cell and month (used for the density view).
import { readFile, writeFile } from "node:fs/promises";
const DATA = new URL("../data/", import.meta.url);
const OUT = new URL("map/", DATA);
const idx = JSON.parse(await readFile(new URL("birds.json", DATA), "utf8"));
const meta = JSON.parse(await readFile(new URL("meta.json", OUT), "utf8"));
const sp = {}, yr = {}, effort = new Map();
for (const b of idx.birds) {
  let j;
  try { j = JSON.parse(await readFile(new URL(`sp/${b.id}.json`, OUT), "utf8")); } catch { continue; }
  if (!j.c?.length) continue;
  sp[b.id] = j.c;
  if (j.y) yr[b.id] = j.y;
  for (const [cell, m, n] of j.c) effort.set(cell * 12 + m, (effort.get(cell * 12 + m) ?? 0) + n);
}
const eff = [...effort.entries()].map(([k, n]) => [Math.floor(k / 12), k % 12, n]);
await writeFile(new URL("map.json", OUT), JSON.stringify({ meta, effort: eff, sp, yr }));
console.log(`packed ${Object.keys(sp).length} birds, ${eff.length} cell-months`);
