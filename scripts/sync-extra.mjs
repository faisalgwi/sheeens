// Weather snapshot for every region (Open-Meteo) + one openly licensed photo per bird saved into data/ph/.
// Used by the private Claude page, which cannot call outside sites itself.
import { readFile, writeFile, mkdir, access } from "node:fs/promises";
const DATA = new URL("../data/", import.meta.url);
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
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const params = `&current=temperature_2m,relative_humidity_2m,apparent_temperature,precipitation,weather_code,cloud_cover,wind_speed_10m,wind_direction_10m,wind_gusts_10m,surface_pressure,visibility` +
  `&hourly=temperature_2m,wind_speed_10m,wind_direction_10m,wind_gusts_10m,precipitation_probability` +
  `&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,precipitation_sum,wind_speed_10m_max,wind_gusts_10m_max,wind_direction_10m_dominant,sunrise,sunset` +
  `&timezone=Asia%2FRiyadh&forecast_days=7&wind_speed_unit=kmh`;
const weather = {};
for (const [name, lat, lon] of REGIONS) {
  try {
    const r = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}${params}`);
    if (r.ok) weather[name] = await r.json();
  } catch (e) { console.log("weather", name, e.message); }
  await sleep(150);
}
await writeFile(new URL("weather.json", DATA), JSON.stringify({ generatedAt: new Date().toISOString(), regions: weather }));
console.log(`weather: ${Object.keys(weather).length} regions`);

const idx = JSON.parse(await readFile(new URL("birds.json", DATA), "utf8"));
await mkdir(new URL("ph/", DATA), { recursive: true });
let got = 0;
for (const b of idx.birds) {
  if (!b.ph) continue;
  const f = new URL(`ph/${b.id}.jpg`, DATA);
  try { await access(f); continue; } catch {}
  try {
    const r = await fetch(b.ph.replace("{s}", "medium"));
    if (r.ok) { await writeFile(f, Buffer.from(await r.arrayBuffer())); got++; }
  } catch (e) { console.log("photo", b.id, e.message); }
  await sleep(120);
}
console.log(`photos: downloaded ${got}`);
