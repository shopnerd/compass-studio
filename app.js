// app.js — UI + three.js viewer. The worker does all geometry.
import * as THREE from 'three';
import { makeOrbit } from './orbit.js';
import { DEFAULTS, FILAMENTS, compassPrint, needlePrint, LIGHT } from './core.js';
import { mountPlay } from './play.js';
import { partModel, ledModel, magnetModel, insertModel, flatScrewModel, PART_SWATCH } from './components3d.js';
import { DEFAULT_PROMPTS, valuePrompts } from './firmware.js';
import { mountVoice } from './voice-ui.js';
import { spinBom, bomCSV } from './bom.js';

const $ = (id) => document.getElementById(id);
const worker = new Worker('./worker.js', { type: 'module' });
let seq = 0; const pending = new Map();
worker.onmessage = (e) => {
  const m = e.data, p = pending.get(m.id); if (!p) return;
  if (m.type === 'progress') return setStatus(m.text, true);
  pending.delete(m.id);
  m.type === 'error' ? p.reject(new Error(m.message)) : p.resolve(m);
};
const call = (msg) => new Promise((resolve, reject) => { const id = ++seq; pending.set(id, { resolve, reject }); worker.postMessage({ id, ...msg }); });
function setStatus(t, busy = false) { const s = $('status'); s.textContent = t; s.classList.toggle('busy', busy); }

// ---------------------------------------------------------------- settings
const SLOT_GROUPS = ['body', 'white', 'gold', 'needle'];
for (const g of SLOT_GROUPS) { const s = $('slot-' + g); for (let i = 1; i <= 5; i++) s.add(new Option(`Slot ${i}`, i)); s.value = DEFAULTS.slots[g]; }
function params() {
  return {
    name: $('name').value, values: [0, 1, 2, 3].map(i => $('v' + i).value), autoArrange: $('autoArrange').checked, caps: $('caps').checked,
    back: $('back').value, backing: $('backing').checked, loop: $('loop').checked, scale: +$('scale').value,
    centre: $('centre').value, nfc: $('nfc').value, boreR: +$('boreR').value || 6.51, pinD: +$('pinD').value || 5.2,
    printer: $('printer').value, gap: +$('gap').value,
    slots: Object.fromEntries(SLOT_GROUPS.map(g => [g, +$('slot-' + g).value])),
  };
}
try { const saved = JSON.parse(localStorage.getItem('compass-studio') || 'null'); if (saved) restore(saved); } catch (_) {}
function restore(p) {
  const set = (id, v) => { if (v !== undefined && $(id)) { if ($(id).type === 'checkbox') $(id).checked = v; else $(id).value = v; } };
  set('name', p.name); (p.values || []).forEach((v, i) => set('v' + i, v));
  for (const k of ['autoArrange', 'caps', 'back', 'backing', 'loop', 'scale', 'centre', 'nfc', 'boreR', 'pinD', 'printer', 'gap']) set(k, p[k]);
  if (p.slots) for (const g of SLOT_GROUPS) set('slot-' + g, p.slots[g]);
}

// ---------------------------------------------------------------- viewer
const view = $('view');
const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
renderer.setPixelRatio(Math.min(2, devicePixelRatio));
view.prepend(renderer.domElement);
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(32, 1, 1, 2000);
const controls = makeOrbit(camera, renderer.domElement, () => draw());
if (location.search.includes('debug')) window.__view = { camera, controls, renderer, THREE, draw: () => draw() };
scene.add(new THREE.HemisphereLight(0xffffff, 0x8a8478, 1.6));
const sun = new THREE.DirectionalLight(0xffffff, 1.6); sun.position.set(60, -80, 160); scene.add(sun);
const rim = new THREE.DirectionalLight(0xffffff, 0.6); rim.position.set(-80, 90, -60); scene.add(rim);
const group = new THREE.Group(); scene.add(group);
const mats = {};
function mat(key) {
  const col = { body: FILAMENTS.body, white: FILAMENTS.white, gold: FILAMENTS.gold, needle: FILAMENTS.needle, bearing: '#a9adb1', light: '#ffe9a8' }[key];
  return mats[key] ||= new THREE.MeshStandardMaterial({ color: col, roughness: key === 'bearing' ? 0.25 : 0.55, metalness: key === 'gold' ? 0.35 : key === 'bearing' ? 0.5 : 0.02 });
}
// A ball bearing as it looks: silver outer and inner races, a darker shield between, the bore open. Axis along z, centred.
function bearingMesh(od, id, w) {
  const g = new THREE.Group(), ring = (r0, r1, h, col, metal) => {
    const sh = new THREE.Shape(); sh.absarc(0, 0, r1, 0, Math.PI * 2, false);
    const hole = new THREE.Path(); hole.absarc(0, 0, r0, 0, Math.PI * 2, true); sh.holes.push(hole);
    const m = new THREE.Mesh(new THREE.ExtrudeGeometry(sh, { depth: h, bevelEnabled: false, curveSegments: 48 }), new THREE.MeshStandardMaterial({ color: col, roughness: 0.35, metalness: metal }));
    m.position.z = -h / 2; g.add(m);
  };
  const R = od / 2, r = id / 2, t = (R - r) * 0.22;
  ring(R - t, R, w, '#c9cdd2', 0.45); ring(r, r + t, w, '#c9cdd2', 0.45); ring(r + t, R - t, w - 0.5, '#7d848c', 0.2);
  return g;
}
function geo(mesh) {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(mesh.v, 3)); g.setIndex(new THREE.BufferAttribute(mesh.t, 1));
  const ng = g.toNonIndexed(); ng.computeVertexNormals(); g.dispose(); return ng;
}
let last = null, mode = '3d', model = 'compass', spinLast = null;
function showCompass(res) {
  for (const c of [...group.children]) { group.remove(c); c.traverse(o => o.geometry && o.geometry.dispose()); }
  const { one, d } = res, ex = mode === 'explode';
  for (const [k, mesh] of Object.entries(one.meshes)) {
    const m = new THREE.Mesh(geo(mesh), mat(k));
    if (ex && k !== 'body') m.position.z = k === 'gold' ? 14 : 22;
    group.add(m);
  }
  if (one.extras.length) {
    const e = one.extras[0], t = e.kind === 'light' ? LIGHT.hubT : 2;
    // installed: flipped over, ledge on the bearing's inner race at the dish floor
    const n = new THREE.Mesh(geo(e.meshes.needle), mat('needle'));
    n.rotation.x = Math.PI; n.position.z = d.dishZ + t + 0.6 + (ex ? 34 : 0.05);
    group.add(n);
    if (e.kind === 'light') for (const y of LIGHT.leds) {   // the LEDs, lit, in their face windows (the flip sends north to -y)
      const l = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.6, 0.3, 16), mat('light')); l.rotation.x = Math.PI / 2;
      l.position.set(0, -y, n.position.z + 0.1); group.add(l);
    }
    const bearing = bearingMesh(13, 5, 4); bearing.position.z = d.dishZ - 2 + (ex ? 8 : 0); if (ex) group.add(bearing);
  }
  frame();
}
let fitK = 1;   // >1 on tall, narrow views (phones): back the camera off so the sides are not cut
function frame() {
  fitK = Math.max(1, 1.3 / camera.aspect);
  const R = (model === 'spin' ? (spinLast ? spinLast.info.R : 41) : 37.5 * +$('scale').value) * fitK;
  controls.target.set(0, 3, model === 'spin' && mode === 'explode' ? 22 : 3);
  const t = controls.target, V = (x, y, z) => new THREE.Vector3(t.x + x, t.y + y, t.z + z);
  if (mode === 'top') controls.set(V(0, 0, R * 4.4), new THREE.Vector3(0, 1, 0));
  else if (mode === 'back') controls.set(V(0, 0, -R * 4.4), new THREE.Vector3(0, 1, 0));
  else if (mode === 'explode') controls.set(model === 'spin' ? V(R * 2.6, -R * 3.8, R * 2.4) : V(R * 2.2, -R * 3.2, R * 2.6), new THREE.Vector3(0, 0, 1));
  else controls.set(V(R * 1.6, -R * 2.6, R * 2.7), new THREE.Vector3(0, 0, 1));
}
function size() {
  const w = view.clientWidth, h = view.clientHeight; renderer.setSize(w, h, false);
  camera.aspect = w / Math.max(1, h); camera.updateProjectionMatrix();
  if (Math.abs(Math.max(1, 1.3 / camera.aspect) - fitK) > 0.05) frame();
  drawBed(); draw();
}
let raf = 0; function draw() { if (raf) return; raf = requestAnimationFrame(() => { raf = 0; renderer.render(scene, camera); }); }
new ResizeObserver(size).observe(view);

// ---------------------------------------------------------------- bed drawing
function drawBed() {
  if (model === 'spin') return drawSpinBed();
  const cv = $('bedCanvas'); if (cv.hidden || !last) return;
  const b = last.bed, dpr = Math.min(2, devicePixelRatio), W = view.clientWidth, H = view.clientHeight;
  cv.width = W * dpr; cv.height = H * dpr; const x = cv.getContext('2d'); x.setTransform(dpr, 0, 0, dpr, 0, 0); x.clearRect(0, 0, W, H);
  const [bw, bh] = b.bed, k = Math.min((W - 40) / bw, (H - 50) / bh), ox = (W - bw * k) / 2, oy = (H - bh * k) / 2 + 10;
  const css = getComputedStyle(document.documentElement), ink = css.getPropertyValue('--ink').trim(), muted = css.getPropertyValue('--muted').trim();
  const P = (px, py) => [ox + px * k, oy + (bh - py) * k];   // bed origin at the front left
  x.fillStyle = css.getPropertyValue('--panel').trim(); x.strokeStyle = muted; x.lineWidth = 1;
  x.fillRect(ox, oy, bw * k, bh * k); x.strokeRect(ox, oy, bw * k, bh * k);
  x.strokeStyle = css.getPropertyValue('--line').trim();
  for (let gx = 50; gx < bw; gx += 50) { x.beginPath(); x.moveTo(...P(gx, 0)); x.lineTo(...P(gx, bh)); x.stroke(); }
  for (let gy = 50; gy < bh; gy += 50) { x.beginPath(); x.moveTo(...P(0, gy)); x.lineTo(...P(bw, gy)); x.stroke(); }
  const t = b.tower; x.fillStyle = muted; x.globalAlpha = 0.35; x.fillRect(...P(t[0], t[1] + t[3]), t[2] * k, t[3] * k); x.globalAlpha = 1;
  x.fillStyle = ink; x.font = '11px ui-monospace, monospace'; x.fillText('wipe tower', ...P(t[0] + 2, t[1] + t[3] / 2 - 1));
  const p = { ...DEFAULTS, ...params() }, fp = compassPrint(p);
  const outline = (circles, cx, cy, ang, fill) => {
    x.fillStyle = fill; for (const c of circles) { const s = Math.sin(ang), co = Math.cos(ang); const [X, Y] = P(cx + c[0] * co - c[1] * s, cy + c[0] * s + c[1] * co); x.beginPath(); x.arc(X, Y, c[2] * k, 0, 7); x.fill(); }
  };
  b.items.forEach((it, i) => {
    outline(fp, it.x, it.y, it.ang, FILAMENTS.body);
    const [X, Y] = P(it.x, it.y); x.fillStyle = FILAMENTS.gold; x.beginPath(); x.arc(X, Y, 21 * p.scale * k, 0, 7); x.fill();
    x.fillStyle = '#fff'; x.font = `600 ${Math.max(11, 14 * k)}px system-ui`; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(String(i + 1), X, Y); x.textAlign = 'start'; x.textBaseline = 'alphabetic';
  });
  b.needles.forEach(n => outline(needlePrint(p), n.x, n.y, n.ang, '#7d1a20'));
  x.fillStyle = muted; x.font = '12px system-ui';
  x.fillText(`${b.printer}: ${bw} × ${bh} mm · ${b.n} compasses${b.needles.length ? ` + ${b.needles.length} needles` : ''} · 50 mm grid · front edge at the bottom`, ox, oy + bh * k + 18);
}

// ---------------------------------------------------------------- rebuild
let timer = 0, building = false, again = false;
function schedule() { clearTimeout(timer); timer = setTimeout(rebuild, 160); }
async function rebuild() {
  if (model === 'spin') return rebuildSpin();
  if (building) { again = true; return; }
  building = true; setStatus('Building…', true);
  const p = params();
  try { localStorage.setItem('compass-studio', JSON.stringify(p)); } catch (_) {}
  try {
    const res = await call({ type: 'build', params: p });
    last = res; showCompass(res); render(res, p); drawBed();
    setStatus(`Built in ${(res.ms / 1000).toFixed(2)} s`);
  } catch (err) { setStatus('Could not build: ' + err.message); }
  building = false; if (again) { again = false; rebuild(); }
}
function render(res, p) {
  const { one, bed, swaps, sweep, d } = res;
  const [n, e, s, w] = one.vals;
  $('where').textContent = `N ${n || '—'} · E ${e || '—'} · S ${s || '—'} · W ${w || '—'}`;
  $('warn').innerHTML = ''; for (const t of one.warn) { const li = document.createElement('li'); li.textContent = t; $('warn').append(li); }
  $('scaleOut').textContent = `Ø${(75 * p.scale).toFixed(1)} mm`; $('gapOut').textContent = `${p.gap} mm`;
  const g = (v) => (v / 1000 * 1.24).toFixed(1);
  const total = Object.values(one.volumes).reduce((a, b) => a + b, 0);
  $('bedStats').innerHTML = `
    <div class="stat"><b>${bed.n}</b><span>compasses per bed</span></div>
    <div class="stat"><b>${Math.ceil(30 / Math.max(1, bed.n))}</b><span>beds for 30 students</span></div>
    <div class="stat"><b>~${swaps.swaps}</b><span>colour changes per bed, the same for 1 or ${bed.n}</span></div>
    <div class="stat"><b>~${(swaps.minutes / Math.max(1, bed.n)).toFixed(1)} min</b><span>of swapping per compass</span></div>
    <div class="stat wide"><span>Compasses per bed at other sizes (needles fill the gaps)</span><div class="sweep">${sweep.map(r => `<span class="${Math.abs(r.s - p.scale) < 0.01 ? 'on' : ''}">Ø${r.d}: ${r.n}</span>`).join('')}</div></div>
    <div class="stat wide"><span>Filament if printed solid: body ${g(one.volumes.body || 0)} g, letters ${g(one.volumes.white || 0)} g, rose ${g(one.volumes.gold || 0)} g (${g(total)} g a compass). Real prints with infill use less.</span></div>`;
  $('insideInfo').innerHTML = insideInfo(p, one, d);
  const used = [...new Set(SLOT_GROUPS.filter(k => k !== 'needle' || p.centre !== 'fixed').map(k => p.slots[k]))].length;
  $('legend').innerHTML = [['body', 'body'], ['white', 'letters, logo, white centre'], ['gold', 'rose'], ...(p.centre !== 'fixed' ? [['needle', p.centre === 'light' ? 'light needle' : 'needle']] : [])]
    .map(([k, l]) => `<span><i style="background:${FILAMENTS[k]}"></i>${l}: slot ${p.slots[k]}</span>`).join('') + `<span>${used} filaments on the MMU</span>`;
}
function insideInfo(p, one, d) {
  const parts = [];
  if (p.centre === 'needle') parts.push(`<h4>Spinning needle</h4><ul><li>695ZZ bearing, 5 × 13 × 4 mm. Clamp it into the pocket until flush.</li><li>Clamp the needle's pin into the bearing; the ledge keeps it clear of the outer race.</li><li>Pocket r ${p.boreR.toFixed(2)} and pin Ø${p.pinD.toFixed(2)}: print the fitment test plate first if the filament or printer changed.</li></ul>`);
  if (p.centre === 'light') parts.push(`<h4>Light needle (persistence of vision)</h4><p>Five LEDs flash in a timed pattern; spinning the needle smears them into rings and shapes, like an LED fidget spinner.</p><ul><li>CR1220 coin cell slides into the hub through the slot on one side; copper tape on each face of the cell for contacts, a strip of Kapton tape closes the slot</li><li>5 pre-wired 0603 micro LEDs (the model-railway kind, with enamelled leads) drop into the pockets under the long arm and shine through the 1.1 mm windows</li><li>Controller board up to 6.4 × 9.4 mm in the tail pocket (an ATtiny10 or CH32V003 board); wires run in the grooves underneath</li><li>Same 695 bearing and pin as the plain needle. The hub stands 1.8 mm above the rim.</li><li>Wiring and firmware are not part of this file; nothing here has been built yet.</li></ul>`);
  if (p.centre === 'fixed') parts.push('<h4>No needle</h4><p>Solid centre, nothing to assemble.</p>');
  if (p.nfc === 'sticker') parts.push('<h4>NFC sticker</h4><p>Ø10 mm NTAG213 sticker in the 0.4 mm recess on the back, under the loop. Program it with the student\'s page before sticking it down.</p>');
  if (p.nfc === 'embedded') parts.push(`<h4>NFC sealed inside</h4><p>In PrusaSlicer add a pause at <b>${one.pause} mm</b>, drop a Ø10 × 0.6 mm tag into each pocket, resume. The tag sits under the ring, away from the steel bearing.</p>`);
  return parts.join('');
}

// ---------------------------------------------------------------- inputs, views, exports
document.querySelectorAll('#panel input, #panel select').forEach(el => { if (el.id !== 'roster' && el.id !== 'bomQty') el.addEventListener('input', (e) => { if (!e.target.closest('#voiceBox')) schedule(); }); });
document.querySelectorAll('.tabs [data-view]').forEach(b => b.addEventListener('click', () => {
  document.querySelectorAll('.tabs [data-view]').forEach(x => x.setAttribute('aria-selected', x === b));
  mode = b.dataset.view; const bed = mode === 'bed', playing = mode === 'play';
  $('bedCanvas').hidden = !bed; $('playBox').hidden = !playing; renderer.domElement.hidden = bed || playing;
  if (playing) return showPlay();
  if (bed) drawBed(); else if (model === 'spin') { if (spinLast) showSpin(spinLast); } else if (last) showCompass(last);
}));
function parseRoster() {
  return $('roster').value.split(/\r?\n/).map(l => l.split(/\t|,/).map(s => s.trim())).filter(r => r[0]).map(r => ({ name: r[0], values: [r[1] || '', r[2] || '', r[3] || '', r[4] || ''] }));
}
function rosterInfo() { const r = parseRoster(), per = last ? last.bed.n : 0; $('rosterInfo').textContent = `${r.length} students${per ? ` → ${Math.ceil(r.length / per)} beds of up to ${per}` : ''}.`; }
$('roster').addEventListener('input', rosterInfo);
function save(files) {
  for (const [name, bytes] of files) {
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([bytes], { type: name.endsWith('.3mf') ? 'model/3mf' : name.endsWith('.zip') ? 'application/zip' : 'model/stl' }));
    a.download = name; document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  }
}
async function exportIt(what, btn, extra = {}) {
  const btns = document.querySelectorAll('.btn'); btns.forEach(b => b.disabled = true);
  setStatus('Exporting…', true);
  try { const res = await call({ type: 'export', what, params: params(), ...extra }); save(res.files); setStatus(`Saved ${res.files.map(f => f[0]).join(', ')}`); }
  catch (err) { setStatus('Export failed: ' + err.message); }
  btns.forEach(b => b.disabled = false);
}
$('exBed').onclick = (e) => exportIt('bed3mf', e.target);
$('exOne').onclick = (e) => exportIt('one3mf', e.target);
$('exStl').onclick = (e) => exportIt('stl', e.target);
$('exFit').onclick = (e) => exportIt('fitment', e.target);
$('exClass').onclick = (e) => { const r = parseRoster(); if (!r.length) return setStatus('Add at least one student to the list'); exportIt('class', e.target, { roster: r }); };

// ================================================================ Spin Compass
for (const g of ['body', 'white', 'gold', 'caps']) { const sel = $('sp-slot-' + g); for (let i = 1; i <= 5; i++) sel.add(new Option(`Slot ${i}`, i)); sel.value = { body: 1, white: 2, gold: 3, caps: 1 }[g]; }
function spinParams() {
  return { name: $('name').value, values: [0, 1, 2, 3].map(i => $('v' + i).value), extras: [0, 1, 2, 3].map(i => $('x' + i).value || ['Truth', 'Dare', 'Again', 'Choose'][i]),
    bottom: [$('spBottom1').value, $('spBottom2').value], order: $('spOrder').value, printer: $('spPrinter').value, disc: $('spDisc').value, leds: $('spLeds').value, battery: $('spBattery').value, speaker: $('spSpeaker').value, imu: $('spImu').value, slots: Object.fromEntries(['body', 'white', 'gold', 'caps'].map(g => [g, +$('sp-slot-' + g).value])) };
}
function setModel(m) {
  model = m;
  document.querySelectorAll('.model button').forEach(b => b.setAttribute('aria-pressed', b.dataset.model === m));
  document.querySelectorAll('.only-compass').forEach(el => el.hidden = m !== 'compass');
  document.querySelectorAll('.only-spin').forEach(el => el.hidden = m !== 'spin');
  const cur = document.querySelector('.tabs [data-view][aria-selected=true]');
  if (cur && cur.hidden) document.querySelector('[data-view="3d"]').click();
  try { localStorage.setItem('compass-studio-model', m); } catch (_) {}
  rebuild();
}
document.querySelectorAll('.model button').forEach(b => b.addEventListener('click', () => setModel(b.dataset.model)));
const PART_COL = PART_SWATCH;
let spinBusy = false, spinAgain = false;
async function rebuildSpin() {
  if (spinBusy) { spinAgain = true; return; }
  spinBusy = true; setStatus('Building the Spin Compass…', true);
  try {
    const res = await call({ type: 'spinBuild', spin: spinParams() });
    spinLast = res; if (mode !== 'play' && mode !== 'bed') showSpin(res); renderSpin(res); drawBed(); if (play) play.refresh();
    if (!voiceUI) voiceUI = mountVoice($('voiceBox'), { info: () => spinLast && { ...spinLast.info, name: $('name').value }, prompts: () => playConfig().prompts, status: setStatus, save });
    voiceUI.refresh();
    $('voiceBox').closest('details').hidden = !res.info.parts.some(p => p.key === 'speaker');
    setStatus(`Built in ${(res.ms / 1000).toFixed(2)} s`);
  } catch (err) { setStatus('Could not build: ' + err.message); }
  spinBusy = false; if (spinAgain) { spinAgain = false; rebuildSpin(); }
}
let spinXray = false, shellSeeThrough = false;
const xmats = {};
function xmat(k) { return xmats[k] ||= Object.assign(mat(k).clone(), { transparent: true, opacity: 0.16, depthWrite: false }); }
function addMesh(mesh, key, fn) { const m = new THREE.Mesh(geo(mesh), shellSeeThrough ? xmat(key) : mat(key)); if (fn) fn(m); group.add(m); return m; }
function showSpin(res) {
  for (const c of [...group.children]) { group.remove(c); c.traverse(o => o.geometry && o.geometry.dispose()); }
  const M = res.meshes, A = res.info.assembly, ex = mode === 'explode', inside = mode === 'inside', xr = spinXray && !inside && !ex;
  shellSeeThrough = xr;
  addMesh(M.tray, 'body');
  if (M.trayWhite) addMesh(M.trayWhite, 'white');   // text on the bottom
  if (!inside) {
    addMesh(M.lid, 'body', m => { m.position.z = ex ? 40 : 0; });
    addMesh(M.white, 'white', m => { m.position.z = ex ? 48 : 0; });
    addMesh(M.gold, 'gold', m => { m.position.z = ex ? 44 : 0; });
    addMesh(M.capTop, 'needle', m => { m.position.z = A.zTopCap + (ex ? 64 : 0); });
    addMesh(M.capPtr, 'white', m => { m.position.z = A.zTopCap + (ex ? 64 : 0); });
  }
  addMesh(M.capBot, 'needle', m => { m.position.z = A.zBotCap - (ex ? 18 : 0); });   // peg up into the bearing
  if (A.capJ && res.info.insert) {   // the cap clamp: insert in the bottom peg's tip, M2 flat-head down through the top cap
    const J = A.capJ, ins = res.info.insert;
    const iv = insertModel(ins.len, ins.knurl); iv.position.z = A.zBotCap + A.capT - 1 + 0.5 + J.botPeg - (ex ? 18 : 0); group.add(iv);
    if (!inside) { const sc = flatScrewModel(ins.screwLen, 2, ins.head - 0.2); sc.position.z = A.zTopCap + A.capT - J.cb + (ex ? 76 : 0); group.add(sc); }
  }
  if (M.button && !inside) addMesh(M.button, 'white', m => { m.position.z = A.zButton + (ex ? 84 : 0); });   // press-in button over the cap screw
  addMesh(M.dome, 'white', m => { m.rotation.x = Math.PI; m.position.z = A.zB0 - 0.5 - 2 - (ex ? 26 : 0); });
  const bear = bearingMesh(22, 8, 7); bear.position.z = A.zB0 + 3.5 + (ex ? 12 : 0); group.add(bear);
  if (inside || ex || xr) {   // the electronics, drawn as the real parts
    const lift = ex ? 12 : 0, I = res.info, rad = d => d * Math.PI / 180;
    for (const p of I.parts) {
      const o = partModel(p, I), a = rad(p.angle);
      const z0 = p.inHub ? A.zB0 + 7 - 0.6 - 0.9 - p.h / 2 : I.floor + 0.05;
      o.rotation.z = -a; o.position.set(p.r * Math.sin(a), p.r * Math.cos(a), z0 + (p.inHub ? 0 : lift)); group.add(o);
    }
    for (const l of I.leds) {   // round WS2812B boards, chip up in the lid pockets
      const o = ledModel(), a = rad(l.angle); o.rotation.z = -a;
      o.position.set(l.r * Math.sin(a), l.r * Math.cos(a), A.zLid - 1.0 + (ex ? 28 : 0)); group.add(o);
    }
    const hl = I.parts.find(p => p.key === 'hall');
    if (hl && !inside) { const m = magnetModel(); m.position.set(0, hl.r, A.zTopCap + (ex ? 58 : 0)); group.add(m); }   // in the top cap, over the hall sensor
    if (I.rScrew && I.insert) for (const sa of I.screws) {   // brass inserts flush in the bosses; M2 flat-head screws through the lid's countersinks
      const a = rad(sa), x = I.rScrew * Math.sin(a), y = I.rScrew * Math.cos(a), ins = I.insert;
      const iv = insertModel(ins.len, ins.knurl); iv.position.set(x, y, A.zLid + (ex ? 8 : 0)); group.add(iv);
      if (!inside) { const sc = flatScrewModel(ins.screwLen, 2, ins.head - 0.2); sc.position.set(x, y, A.zLid + I.lidT + (ex ? 54 : 0)); group.add(sc); }
    }
    const b = res.info.balance;
    for (const s of (b.slots || [])) {   // the steel BBs that balance it, in rows in their slots
      const steel = mat('bearing'), a = s.angle * Math.PI / 180, ux = Math.sin(a), uy = Math.cos(a), tx = Math.cos(a), ty = -Math.sin(a);
      for (let k = 0; k < s.n; k++) { const off = (k - (s.n - 1) / 2) * 4.65, o = new THREE.Mesh(new THREE.SphereGeometry(2.25, 20, 14), steel);
        const [dx, dy] = s.radialRow ? [ux * off, uy * off] : [tx * off, ty * off]; o.position.set(s.r * ux + dx, s.r * uy + dy, res.info.floor + 2.25 + lift); group.add(o); }
    }
  }
  frame();
}
function renderSpin(res) {
  const I = res.info, b = I.balance, bed = res.bed;
  $('spWarn').innerHTML = ''; for (const t of I.warn) { const li = document.createElement('li'); li.textContent = t; $('spWarn').append(li); }
  $('where').textContent = I.segments.map((s, i) => `${i + 1} ${s.label}`).join(' · ');
  $('warn').innerHTML = '';
  const dir = (a) => ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'][Math.round(a / 45) % 8];
  const rows = I.parts.map(p => `<tr><td><i style="background:${PART_COL[p.key] || '#888'}"></i>${p.label}</td><td>${p.inHub ? 'hub' : dir(p.angle)} · ${p.g} g</td></tr>`).join('');
  const bbText = b.n ? `, then ${b.n} steel BB${b.n > 1 ? 's' : ''} (4.5 mm) in ${b.slots.length > 1 ? 'slots at ' + b.slots.map(s => dir(s.angle)).join(' and ') : 'the slot at ' + dir(b.angle)} bring it to ${b.residual.toFixed(1)}` : '';
  $('spInside').innerHTML = `
    <p>Everything rides in the disc and spins with it. The two caps and the pointer stay still between your thumb and finger.</p>
    <table class="parts">${rows}<tr><td><i style="background:#ffe9a8"></i>${I.leds.length} × WS2812B LEDs under white windows</td><td>${(I.leds.length * 0.4).toFixed(1)} g</td></tr>
    <tr><td>608 bearing, 2 caps, Ø3 magnet in the top cap, 3 4 M2 × 4 brass heat-set inserts and 4 M2 × 6 flat-head screws (3 hold the lid, 1 clamps the caps through the bearing)${b.n ? `, ${b.n} steel BB${b.n > 1 ? 's' : ''}` : ''}</td><td></td></tr></table>
    <h4 style="margin-top:10px">Balance</h4>
    <p>The parts are placed so the heavy ones oppose each other: ${b.raw.toFixed(1)} g·mm off centre${bbText}. That leftover is like ${((b.n ? b.residual : b.raw) / 38).toFixed(2)} g at the rim. Real parts weigh a little differently, so weigh them and add or remove a BB if it wobbles.</p>
    <h4>Charging</h4><p>USB-C in the rim, straight into the XIAO board, which charges the battery. Micro-USB boards work too but are bigger; USB-C is the current standard.</p>
    <h4>How it knows where it landed</h4><p>The hall sensor in the hub sees the cap's magnet once a turn, which marks the pointer. The IMU's gyro tracks the last slow turns, then the board lights that segment and plays its clip.</p>`;
  renderBom();
  $('spStats').innerHTML = `<div class="stat"><b>${bed.k}</b><span>full kits per bed</span></div><div class="stat"><b>${I.R * 2} mm</b><span>disc, ${I.H} mm thick</span></div>
    <div class="stat wide"><span>Only the lid and the top cap have more than one colour, in their first five layers, so a kit costs about 8 colour changes.</span></div>`;
  const sl = spinParams().slots;
  $('legend').innerHTML = [['body', `body: slot ${sl.body}`], ['white', `letters, lines, LED windows: slot ${sl.white}`], ['gold', `gold segments: slot ${sl.gold}`], ['needle', `caps: slot ${sl.caps}`]].map(([k, l]) => `<span><i style="background:${FILAMENTS[k]}"></i>${l}</span>`).join('');
}
function drawSpinBed() {
  const cv = $('bedCanvas'); if (cv.hidden || !spinLast) return;
  const b = spinLast.bed, dpr = Math.min(2, devicePixelRatio), W = view.clientWidth, H = view.clientHeight;
  cv.width = W * dpr; cv.height = H * dpr; const x = cv.getContext('2d'); x.setTransform(dpr, 0, 0, dpr, 0, 0); x.clearRect(0, 0, W, H);
  const [bw, bh] = b.bed, k = Math.min((W - 40) / bw, (H - 50) / bh), ox = (W - bw * k) / 2, oy = (H - bh * k) / 2 + 10;
  const css = getComputedStyle(document.documentElement), P = (px, py) => [ox + px * k, oy + (bh - py) * k];
  x.fillStyle = css.getPropertyValue('--panel').trim(); x.strokeStyle = css.getPropertyValue('--muted').trim(); x.fillRect(ox, oy, bw * k, bh * k); x.strokeRect(ox, oy, bw * k, bh * k);
  const t = b.tower; x.globalAlpha = 0.35; x.fillStyle = css.getPropertyValue('--muted').trim(); x.fillRect(...P(t[0], t[1] + t[3]), t[2] * k, t[3] * k); x.globalAlpha = 1;
  const col = { tray: FILAMENTS.body, lid: FILAMENTS.gold, capTop: '#7d1a20', capBot: '#7d1a20', dome: FILAMENTS.white, button: FILAMENTS.white };
  const name = { tray: 'tray', lid: 'lid (face down)', capTop: 'top cap', capBot: 'cap', dome: 'dome', button: '' };
  for (const it of b.items) {
    const [X, Y] = P(it.x, it.y); x.fillStyle = col[it.part]; x.beginPath(); x.arc(X, Y, it.r * k, 0, 7); x.fill();
    x.fillStyle = it.part === 'dome' || it.part === 'button' || it.part === 'lid' ? '#222' : '#fff'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.font = `600 ${Math.max(10, 11 * k)}px system-ui`;
    x.fillText(it.r > 20 ? `${name[it.part]} ${it.kit + 1}` : String(it.kit + 1), X, Y);
  }
  x.textAlign = 'start'; x.textBaseline = 'alphabetic'; x.fillStyle = css.getPropertyValue('--muted').trim(); x.font = '12px system-ui';
  x.fillText(`${b.printer}: ${bw} × ${bh} mm · ${b.k} complete Spin Compass kit${b.k > 1 ? 's' : ''} · wipe tower shaded`, ox, oy + bh * k + 18);
}
let play = null, voiceUI = null, bomLast = null;
const money = (v) => '$' + v.toFixed(2);
function renderBom() {
  if (!spinLast) return;
  const qty = Math.max(1, Math.min(200, Math.round(+$('bomQty').value || 1)));
  const b = spinBom(spinParams(), spinLast.info, spinLast.info.grams, qty); bomLast = b;
  let html = '<div class="bomwrap"><table class="bom"><thead><tr><th>Part</th><th class="n">Each</th><th class="n">Buy</th><th class="n">Order</th></tr></thead><tbody>', grp = '';
  for (const r of b.rows) {
    if (r.group !== grp) { grp = r.group; html += `<tr class="grp"><td colspan="4">${grp}</td></tr>`; }
    const name = r.link ? `<a href="${r.link}" target="_blank" rel="noopener">${r.item}</a>` : r.item;
    html += `<tr><td>${name}<small>${r.per}${r.unitLabel === 'ea' ? ' ×' : ' ' + r.unitLabel} · ${r.store}${r.note ? ' · ' + r.note : ''}</small></td><td class="n">${money(r.each)}</td><td class="n">${r.buy}</td><td class="n">${money(r.order)}</td></tr>`;
  }
  html += `</tbody><tfoot><tr><td>Total</td><td class="n">${money(b.each)}</td><td></td><td class="n">${money(b.order)}</td></tr></tfoot></table></div>
    <p class="hint"><b>By store</b> (before shipping and tax): ${Object.entries(b.stores).sort((x, y) => y[1] - x[1]).map(([s, v]) => `${s} ${money(v)}`).join(' · ')}.</p>
    <p class="hint">"Each" is one spinner's parts; "Order" is what ${qty} cost to buy with packs rounded up. Prices from real listings checked ${b.checked}; they change, so check at checkout.</p>`;
  $('bomBox').innerHTML = html;
}
$('bomQty').addEventListener('input', renderBom);
$('bomCsv').onclick = () => { if (!bomLast) return; save([[`spin_compass_parts_x${bomLast.qty}.csv`, new TextEncoder().encode(bomCSV(bomLast))]]); setStatus('Saved the parts list'); };
$('bomCopy').onclick = async () => {
  if (!bomLast) return;
  const t = bomLast.rows.map(r => `${r.buy.padEnd(10)} ${r.item}  (${money(r.order)}, ${r.store})  ${r.link}`).join('\n') + `\nTotal for ${bomLast.qty}: ${money(bomLast.order)} (${money(bomLast.each)} each)`;
  try { await navigator.clipboard.writeText(t); setStatus('Parts list copied'); } catch (_) { setStatus('Copy was blocked; use the CSV'); }
};
function playConfig() {
  const I = spinLast ? spinLast.info : null;
  const segs = I ? I.segments.map(s => ({ label: s.label, kind: s.kind })) : undefined;
  const value = {}; if (segs) for (const s of segs) if (s.kind === 'value') value[s.label] = valuePrompts(s.label);
  return { segments: segs, leds: I ? I.leds : undefined, R: I ? I.R : 41, prompts: { ...DEFAULT_PROMPTS, value }, voice: $('spVoice').checked };
}
function showPlay() { if (!play) play = mountPlay($('playBox'), playConfig); else play.refresh(); }
$('spVoice').addEventListener('change', () => { if (play) play.refresh(); });
async function spinExport(what) {
  const btns = document.querySelectorAll('.btn'); btns.forEach(b => b.disabled = true); setStatus('Exporting…', true);
  try { const res = await call({ type: 'spinExport', what, spin: spinParams() }); save(res.files); setStatus(`Saved ${res.files.map(f => f[0]).join(', ')}`); }
  catch (err) { setStatus('Export failed: ' + err.message); }
  btns.forEach(b => b.disabled = false);
}
$('spKit').onclick = () => spinExport('kit');
$('spStl').onclick = () => spinExport('stl');
$('spFw').onclick = () => spinExport('firmware');
try { if (localStorage.getItem('compass-studio-model') === 'spin') model = 'spin'; } catch (_) {}
document.querySelectorAll('.model button').forEach(b => b.setAttribute('aria-pressed', b.dataset.model === model));
$('xray').addEventListener('click', () => { spinXray = !spinXray; $('xray').setAttribute('aria-pressed', spinXray); if (spinXray && (mode === 'inside' || mode === 'explode' || mode === 'play' || mode === 'bed')) document.querySelector('[data-view="3d"]').click(); else if (spinLast) showSpin(spinLast); });
document.querySelectorAll('.only-compass').forEach(el => el.hidden = model !== 'compass');
document.querySelectorAll('.only-spin').forEach(el => el.hidden = model !== 'spin');

call({ type: 'init' }).then(() => { rebuild().then(rosterInfo); }).catch(err => setStatus('The geometry engine did not load: ' + err.message));
