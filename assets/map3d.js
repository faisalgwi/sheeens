// 3D map of Saudi Arabia: terrain + where a bird was recorded, month by month.
import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";

const MONTHS = ["يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو", "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر"];
let dataPromise, geoPromise;
const get = (u, kind) => fetch(u).then((r) => { if (!r.ok) throw new Error(u); return r[kind](); });
const loadData = () => (dataPromise ??= Promise.all([
  get("data/map/map.json", "json"), get("data/map/elev.bin", "arrayBuffer"), get("data/map/mask.bin", "arrayBuffer"),
]).catch((e) => { dataPromise = null; throw e; }));
export const loadMapData = () => loadData().then(([m]) => m);
const loadGeo = () => (geoPromise ??= fetch("data/map/geo.json").then((r) => r.json()));

const MIN_EFF = 15;        // records of all birds needed before a place's share counts as reliable
const SCALE = 1;          // 1 unit = 1 degree
const Z_EXAG = 0.00045;   // metres -> units (strong vertical exaggeration so mountains read)

export async function mountMap(el, opts) {
  const [[map, elevBuf, maskBuf], geo] = await Promise.all([loadData(), loadGeo()]);
  const { bbox, elev: E, grid: G } = map.meta;
  const elev = new Int16Array(elevBuf);
  const mask = new Uint8Array(maskBuf);
  const cx = (bbox.w + bbox.e) / 2, cy = (bbox.s + bbox.n) / 2;
  const X = (lon) => (lon - cx) * SCALE;
  const Y = (lat) => (lat - cy) * SCALE;
  const H = (lon, lat) => {
    const c = Math.round((lon - bbox.w) / E.step), r = Math.round((bbox.n - lat) / E.step);
    if (c < 0 || r < 0 || c >= E.cols || r >= E.rows) return 0;
    return Math.max(0, elev[r * E.cols + c]) * Z_EXAG;
  };

  // ---------- scene ----------
  const dark = document.documentElement.dataset.theme === "dark" || (!document.documentElement.dataset.theme && matchMedia("(prefers-color-scheme: dark)").matches);
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  el.innerHTML = "";
  el.appendChild(renderer.domElement);
  const labels = document.createElement("div");
  labels.className = "map-labels";
  el.appendChild(labels);
  const tip = document.createElement("div");
  tip.className = "map-tip";
  el.appendChild(tip);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 200);
  camera.up.set(0, 0, 1);
  // frame the whole map: steeper view on narrow (phone) screens
  const fit = () => {
    const a = Math.max(camera.aspect, 0.3), t = THREE.MathUtils.degToRad(40) / 2;
    const tilt = THREE.MathUtils.degToRad(a < 1.3 ? 30 : 47);
    const W = (bbox.e - bbox.w) * SCALE, Hh = (bbox.n - bbox.s) * SCALE;
    const dist = Math.max((W / 2) / (Math.tan(t) * a) * 1.1, (Hh * Math.cos(tilt) / 2) / Math.tan(t) * 1.4);
    camera.position.set(0, -dist * Math.sin(tilt), dist * Math.cos(tilt));
  };
  let touched = false;
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.maxPolarAngle = Math.PI * 0.47;
  controls.minDistance = 4;
  controls.maxDistance = 60;
  controls.target.set(0, -0.6, 0);
  controls.addEventListener("start", () => { touched = true; });

  scene.add(new THREE.HemisphereLight(0xfff4e6, 0x5a4a3a, 1.1));
  const sun = new THREE.DirectionalLight(0xffffff, 1.6);
  sun.position.set(-8, -6, 12);
  scene.add(sun);

  // ---------- terrain ----------
  const step = 2; // sample every 2 cells (0.1°) for a light mesh
  const tc = Math.floor((E.cols - 1) / step) + 1, tr = Math.floor((E.rows - 1) / step) + 1;
  const geom = new THREE.PlaneGeometry((E.cols - 1) * E.step, (E.rows - 1) * E.step, tc - 1, tr - 1);
  const pos = geom.attributes.position;
  const colors = new Float32Array(pos.count * 3);
  const sand = new THREE.Color(dark ? 0x6b5640 : 0xe8d3ac), rock = new THREE.Color(dark ? 0x9a7b5e : 0xb8875a),
    peak = new THREE.Color(dark ? 0xd8c7ad : 0x7d5a3d), out = new THREE.Color(dark ? 0x2a2e37 : 0xd9d2c4), sea = new THREE.Color(dark ? 0x1f3341 : 0xbcd3dc);
  const tmp = new THREE.Color();
  for (let r = 0; r < tr; r++) {
    for (let c = 0; c < tc; c++) {
      const i = r * tc + c;
      const er = Math.min(E.rows - 1, r * step), ec = Math.min(E.cols - 1, c * step);
      const h = elev[er * E.cols + ec];
      const inside = mask[er * E.cols + ec];
      pos.setZ(i, Math.max(0, h) * Z_EXAG * (inside ? 1 : 0.6));
      const t = Math.min(1, Math.max(0, h) / 2600);
      if (h <= 0 && !inside) tmp.copy(sea);
      else if (!inside) tmp.copy(out).lerp(sand, 0.15);
      else tmp.copy(sand).lerp(rock, Math.min(1, t * 1.6)).lerp(peak, Math.max(0, t - 0.55));
      colors.set([tmp.r, tmp.g, tmp.b], i * 3);
    }
  }
  geom.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  geom.computeVertexNormals();
  const terrain = new THREE.Mesh(geom, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.95, metalness: 0 }));
  terrain.position.set(X(bbox.w) + ((E.cols - 1) * E.step) / 2, Y(bbox.s) + ((E.rows - 1) * E.step) / 2, 0);
  scene.add(terrain);

  // ---------- borders ----------
  const line = (ring, color, lift, opacity = 1) => {
    const pts = ring.map(([lon, lat]) => new THREE.Vector3(X(lon), Y(lat), H(lon, lat) + lift));
    const g = new THREE.BufferGeometry().setFromPoints(pts);
    return new THREE.Line(g, new THREE.LineBasicMaterial({ color, transparent: opacity < 1, opacity }));
  };
  for (const ring of geo.sa) scene.add(line(ring, dark ? 0xf2c7a8 : 0x5a2a14, 0.03));
  for (const reg of geo.regions) for (const ring of reg.rings) scene.add(line(ring, dark ? 0xa99d8b : 0x8a7560, 0.02, 0.45));

  // big cities first; a label that would overlap one already drawn is hidden
  const MAJOR = ["الرياض", "جدة", "مكة المكرمة", "المدينة المنورة", "الدمام", "أبها", "تبوك", "حائل", "جازان", "نجران", "القصيم - بريدة", "الجوف - سكاكا", "عرعر", "الأحساء", "الطائف", "الباحة"];
  const rank = (n) => { const i = MAJOR.indexOf(n); return i < 0 ? 99 : i; };
  const cityEls = [...geo.cities].sort((a, b) => rank(a[0]) - rank(b[0])).map(([name, lon, lat]) => {
    const d = document.createElement("span");
    d.textContent = name.replace(" - ", "، ");
    labels.appendChild(d);
    return { d, v: new THREE.Vector3(X(lon), Y(lat), H(lon, lat) + 0.05), w: 0, h: 0 };
  });

  // ---------- bars ----------
  const maxBars = G.cols * G.rows;
  const barGeo = new THREE.BoxGeometry(G.cell * 0.82, G.cell * 0.82, 1);
  barGeo.translate(0, 0, 0.5);
  const barMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.55, metalness: 0.05 });
  const bars = new THREE.InstancedMesh(barGeo, barMat, maxBars);
  bars.count = 0;
  scene.add(bars);
  const ramp = [new THREE.Color(0xf3c98b), new THREE.Color(0xe0894e), new THREE.Color(0xb4532a), new THREE.Color(0x7a2412)];
  const rampAt = (t) => {
    const x = Math.min(0.999, Math.max(0, t)) * (ramp.length - 1);
    const i = Math.floor(x);
    return tmp.copy(ramp[i]).lerp(ramp[i + 1], x - i);
  };
  const cellCenter = (cell) => {
    const r = Math.floor(cell / G.cols), c = cell % G.cols;
    return [bbox.w + (c + 0.5) * G.cell, bbox.n - (r + 0.5) * G.cell];
  };
  const effort = new Map();
  for (const [cell, m, n] of map.effort) effort.set(cell * 12 + m, n);
  const effortAll = new Map();
  for (const [cell, , n] of map.effort) effortAll.set(cell, (effortAll.get(cell) ?? 0) + n);

  let current = [];
  const m4 = new THREE.Matrix4();
  let lastMode = "rel";
  function show(id, month, mode) {
    lastMode = mode;
    const recs = map.sp[id] ?? [];
    const agg = new Map();
    for (const [cell, m, n] of recs) if (month < 0 || m === month) agg.set(cell, (agg.get(cell) ?? 0) + n);
    current = [...agg.entries()].map(([cell, n]) => {
      const eff = month < 0 ? effortAll.get(cell) ?? n : effort.get(cell * 12 + month) ?? n;
      // smoothed share: places with very few records overall do not jump to the top
      return { cell, n, eff, v: mode === "rel" ? n / (eff + 25) : n };
    });
    // in the density view, places with few records of any bird don't set the scale (too noisy)
    const sure = mode === "rel" ? current.filter((x) => x.eff >= MIN_EFF) : current;
    const vmax = Math.max(1e-9, ...(sure.length ? sure : current).map((x) => x.v));
    bars.count = current.length;
    current.forEach((x, i) => {
      const t = Math.min(1, mode === "rel" ? x.v / vmax : Math.log1p(x.v) / Math.log1p(vmax));
      const [lon, lat] = cellCenter(x.cell);
      x.t = t; x.lon = lon; x.lat = lat;
      m4.makeScale(1, 1, 0.08 + t * 3.2).setPosition(X(lon), Y(lat), H(lon, lat));
      bars.setMatrixAt(i, m4);
      bars.setColorAt(i, rampAt(t));
    });
    bars.instanceMatrix.needsUpdate = true;
    if (bars.instanceColor) bars.instanceColor.needsUpdate = true;
    bars.computeBoundingSphere();
    return current;
  }

  // ---------- hover ----------
  const ray = new THREE.Raycaster();
  const ptr = new THREE.Vector2();
  const onPtr = (e) => {
    const rect = renderer.domElement.getBoundingClientRect();
    ptr.set(((e.clientX - rect.left) / rect.width) * 2 - 1, -((e.clientY - rect.top) / rect.height) * 2 + 1);
    ray.setFromCamera(ptr, camera);
    const hit = ray.intersectObject(bars)[0];
    if (hit && current[hit.instanceId]) {
      const x = current[hit.instanceId];
      tip.style.display = "block";
      tip.style.left = `${e.clientX - rect.left + 12}px`;
      tip.style.top = `${e.clientY - rect.top + 12}px`;
      tip.textContent = `${opts.nearest(x.lon, x.lat)} · ${opts.recs ? opts.recs(x.n) : x.n} (من ${x.eff} لكل الطيور)`;
    } else tip.style.display = "none";
  };
  renderer.domElement.addEventListener("pointermove", onPtr);
  renderer.domElement.addEventListener("pointerup", onPtr);

  // ---------- render loop ----------
  const v = new THREE.Vector3();
  let raf;
  const resize = () => {
    const w = el.clientWidth, h = el.clientHeight;
    renderer.setSize(w, h, false);
    camera.aspect = w / h;
    camera.updateProjectionMatrix();
    if (!touched) fit();
  };
  const ro = new ResizeObserver(resize);
  ro.observe(el);
  resize();
  const loop = () => {
    raf = requestAnimationFrame(loop);
    if (!el.isConnected) { cancelAnimationFrame(raf); ro.disconnect(); renderer.dispose(); return; }
    controls.update();
    renderer.render(scene, camera);
    const w = el.clientWidth, h = el.clientHeight;
    const placed = [];
    for (const c of cityEls) {
      v.copy(c.v).project(camera);
      let vis = v.z < 1 && Math.abs(v.x) < 0.98 && Math.abs(v.y) < 0.98;
      if (vis) {
        if (!c.w) { c.d.style.display = "block"; c.w = c.d.offsetWidth + 4; c.h = c.d.offsetHeight + 2; }
        const px = ((v.x + 1) / 2) * w, py = ((1 - v.y) / 2) * h;
        const box = [px - c.w / 2, py - c.h * 1.2, px + c.w / 2, py - c.h * 0.2];
        vis = !placed.some((b) => box[0] < b[2] && box[2] > b[0] && box[1] < b[3] && box[3] > b[1]);
        if (vis) { placed.push(box); c.d.style.transform = `translate(${px}px, ${py}px) translate(-50%, -120%)`; }
      }
      c.d.style.display = vis ? "block" : "none";
    }
  };
  loop();

  return {
    show,
    reset() { touched = false; fit(); controls.target.set(0, -0.6, 0); },
    // best places first; in the density view, well-watched places rank ahead of barely-watched ones
    top(cells, n = 6) {
      const sure = lastMode === "rel" ? cells.filter((x) => x.eff >= MIN_EFF) : cells;
      return [...(sure.length ? sure : cells)].sort((a, b) => b.v - a.v).slice(0, n);
    },
    months: MONTHS,
  };
}
