// worker.js — owns Manifold + the font; builds compasses, beds and files off the main thread.
import Module from './vendor/manifold.js';
import opentype from './vendor/opentype.module.js';
import { createKit, DEFAULTS, packBed, scaleSweep, swapEstimate, build3MF, zipFiles, meshToSTL, transformMesh, dims } from './core.js';
import { buildSpinner, packKits, SPIN_DEFAULTS, CHOICES, INSERT } from './spinner.js';

let K = null;
const ready = (async () => {
  const [wasm, fontBuf] = await Promise.all([
    Module({ locateFile: (f) => new URL('./vendor/' + f, import.meta.url).href }).then(w => { w.setup(); return w; }),
    fetch(new URL('./fonts/nunito-latin-800-normal.woff', import.meta.url)).then(r => r.arrayBuffer()),
  ]);
  K = createKit(wasm, opentype.parse(fontBuf));
})();

const deflate = async (u8) => {
  if (typeof CompressionStream === 'undefined') return null;
  const s = new Blob([u8]).stream().pipeThrough(new CompressionStream('deflate-raw'));
  return new Uint8Array(await new Response(s).arrayBuffer());
};
async function zip(files) {
  if (typeof CompressionStream === 'undefined') return zipFiles(files, null);
  return zipFiles(files, deflate);
}
const progress = (id, text) => postMessage({ id, type: 'progress', text });

// one compass -> meshes per filament (+ needle)
function makeOne(P) {
  const c = K.compass(P);
  const meshes = Object.fromEntries(Object.entries(c.groups).map(([k, m]) => [k, K.toMesh(m)]));
  const extras = c.extras.map(e => ({ kind: e.kind, label: e.label, meshes: Object.fromEntries(Object.entries(e.groups).map(([k, m]) => [k, K.toMesh(m)])) }));
  const volumes = Object.fromEntries(Object.entries(c.groups).map(([k, m]) => [k, m.volume()]));
  K.release();
  return { meshes, extras, warn: c.warn, pause: c.pause, vals: c.vals, volumes };
}
function bedObjects(P, list, bed) {   // list: [{ name, one }] already built, in bed order
  const objs = [];
  list.forEach((s, i) => { const it = bed.items[i]; objs.push({ name: s.name, x: it.x, y: it.y, ang: it.ang, volumes: Object.entries(s.one.meshes).map(([k, mesh]) => ({ name: k, extruder: P.slots[k], mesh })) }); });
  list.forEach((s, i) => { const n = bed.needles[i]; const e = s.one.extras[0]; if (!n || !e) return; objs.push({ name: `${s.name} ${e.label}`, x: n.x, y: n.y, ang: n.ang, volumes: [{ name: e.label, extruder: P.slots.needle, mesh: e.meshes.needle }] }); });
  return objs;
}
const fileName = (s) => (s || 'compass').trim().replace(/&/g, 'and').replace(/[^\w\s-]/g, '').replace(/\s+/g, '_').slice(0, 60) || 'compass';

onmessage = async (e) => {
  const m = e.data, id = m.id;
  try {
    await ready;
    const P = { ...DEFAULTS, ...m.params, slots: { ...DEFAULTS.slots, ...((m.params || {}).slots || {}) } };
    if (m.type === 'init') return postMessage({ id, type: 'ready' });
    if (m.type === 'build') {
      const t0 = performance.now(); const one = makeOne(P); const ms = performance.now() - t0;
      const bed = packBed(P), swaps = swapEstimate(P), sweep = scaleSweep(P);
      const xfer = []; for (const g of [one.meshes, ...one.extras.map(x => x.meshes)]) for (const k in g) xfer.push(g[k].v.buffer, g[k].t.buffer);
      return postMessage({ id, type: 'built', one, ms, bed: { ...bed, items: bed.items.map(({ x, y, ang }) => ({ x, y, ang })) }, swaps, sweep, d: dims(P) }, xfer);
    }
    if (m.type === 'export') {
      const files = [];
      if (m.what === 'one3mf' || m.what === 'bed3mf') {
        progress(id, 'Building the compass');
        const one = makeOne(P), bed = packBed(P);
        const n = m.what === 'one3mf' ? 1 : bed.n;
        const list = Array.from({ length: n }, () => ({ name: P.name || 'compass', one }));
        const b1 = m.what === 'one3mf' ? { items: [{ x: bed.bed[0] / 2, y: bed.bed[1] / 2 - 10, ang: 0 }], needles: [{ x: bed.bed[0] / 2 + 55, y: bed.bed[1] / 2, ang: 0 }] } : bed;
        progress(id, 'Writing the 3MF');
        const bytes = await zip(build3MF(bedObjects(P, list, b1), { title: P.name }));
        files.push([`${fileName(P.name)}${m.what === 'bed3mf' ? `_bed_of_${n}` : ''}.3mf`, bytes]);
      }
      if (m.what === 'stl') {
        const one = makeOne(P);
        for (const [k, mesh] of Object.entries(one.meshes)) files.push([`${fileName(P.name)}_${k}_slot${P.slots[k]}.stl`, new Uint8Array(meshToSTL([mesh], k))]);
        for (const x of one.extras) files.push([`${fileName(P.name)}_${x.kind}.stl`, new Uint8Array(meshToSTL([x.meshes.needle], x.label))]);
        const z = await zip(files.splice(0)); files.push([`${fileName(P.name)}_stl.zip`, z]);
      }
      if (m.what === 'fitment') {
        const items = K.fitment(P); const objs = []; let x = 20, y = 30;
        for (const it of items) { objs.push({ name: it.label, x, y, ang: 0, volumes: [{ name: it.label, extruder: P.slots.body, mesh: K.toMesh(it.m) }] }); x += 2 * it.r + 6; if (x > 220) { x = 20; y += 40; } }
        K.release();
        files.push([`fitment_test_bore_${P.boreR.toFixed(2)}_pin_${P.pinD.toFixed(2)}.3mf`, await zip(build3MF(objs, { title: 'fitment test' }))]);
      }
      if (m.what === 'class') {
        const roster = m.roster, bed = packBed(P), per = Math.max(1, bed.n), beds = [];
        const built = [];
        for (let i = 0; i < roster.length; i++) {
          progress(id, `Compass ${i + 1} of ${roster.length}: ${roster[i].name}`);
          const one = makeOne({ ...P, name: roster[i].name, values: roster[i].values });
          built.push({ name: roster[i].name, one, warn: one.warn });
        }
        for (let b = 0; b * per < built.length; b++) {
          progress(id, `Writing bed ${b + 1} of ${Math.ceil(built.length / per)}`);
          const chunk = built.slice(b * per, b * per + per);
          beds.push([`bed_${String(b + 1).padStart(2, '0')}_${chunk.map(c => fileName(c.name).split('_')[0]).join('-').slice(0, 60)}.3mf`, await zip(build3MF(bedObjects(P, chunk, bed), { title: `bed ${b + 1}` }))]);
        }
        const sheet = ['bed,position,name,north,east,south,west,notes'];
        built.forEach((c, i) => sheet.push([Math.floor(i / per) + 1, (i % per) + 1, c.name, ...c.one.vals, c.warn.join(' / ')].map(v => `"${String(v).replace(/"/g, '""')}"`).join(',')));
        beds.push(['print_sheet.csv', new TextEncoder().encode(sheet.join('\n'))]);
        files.push([`moral_compasses_${roster.length}_students.zip`, await zipFiles(beds, null)]);
      }
      const xfer = files.map(f => f[1].buffer);
      return postMessage({ id, type: 'files', files }, xfer);
    }
    if (m.type === 'spinBuild' || m.type === 'spinExport') {
      const S = { ...SPIN_DEFAULTS, ...m.spin, slots: { ...SPIN_DEFAULTS.slots, ...((m.spin || {}).slots || {}) } };
      const t0 = performance.now(); const sp = buildSpinner(K, S); const ms = performance.now() - t0;
      const L = sp.L, info = { parts: L.parts.map(({ key, label, angle, r, shape, radial, tang, d, h, g, inHub }) => ({ key, label, angle, r, shape, radial, tang, d, h, g, inHub })),
        leds: L.leds, segments: L.segments, balance: L.balance, bbSlots: L.bbSlots, imuClass: (CHOICES.imu[S.imu] || CHOICES.imu.dsox).cls, imuLabel: (CHOICES.imu[S.imu] || CHOICES.imu.dsox).label, screws: L.screws, rScrew: L.rOut - 2.8, lidT: sp.S.lid, insert: { hole: INSERT.hole, len: INSERT.len, knurl: INSERT.knurl, head: INSERT.head, clear: INSERT.clear, screwLen: INSERT.screwLen, bossR: INSERT.bossR, name: INSERT.name }, imu: S.imu, warn: sp.warn, assembly: sp.assembly, R: sp.S.R, H: sp.S.H, floor: sp.S.floor,
        grams: (() => { const g = (m) => m.volume() * 1.24 / 1000, P = sp.parts; return { body: g(P.tray) + g(P.lid), letters: g(P.white) + 2 * g(P.capPtr) + (P.trayWhite ? g(P.trayWhite) : 0), gold: g(P.gold), caps: 2 * g(P.cap) + g(P.pin) }; })() };
      if (m.type === 'spinBuild') {
        const meshes = Object.fromEntries(Object.entries(sp.parts).filter(([, v]) => v && !v.isEmpty()).map(([k, v]) => [k, K.toMesh(v)]));
        const bed = packKits(S); K.release();
        const xfer = []; for (const k in meshes) xfer.push(meshes[k].v.buffer, meshes[k].t.buffer);
        return postMessage({ id, type: 'spinBuilt', meshes, info, bed, ms }, xfer);
      }
      const files = [], base = fileName(S.name || 'spin_compass');
      const printMeshes = Object.fromEntries(Object.entries(sp.print).map(([part, groups]) => [part, Object.fromEntries(Object.entries(groups).map(([g, v]) => [g, K.toMesh(v)]))]));
      K.release();
      const slotOf = (part, g) => g === 'white' ? S.slots.white : g === 'gold' ? S.slots.gold : (part === 'tray' || part === 'lid') ? S.slots.body : S.slots.caps;
      if (m.what === 'kit') {
        const bed = packKits(S);
        const objs = bed.items.map(it => ({ name: `${it.part} ${it.kit + 1}`, x: it.x, y: it.y, ang: 0, volumes: Object.entries(printMeshes[it.part]).map(([g, mesh]) => ({ name: `${it.part} ${g}`, extruder: slotOf(it.part, g), mesh })) }));
        files.push([`${base}_spin_kit_x${bed.k}.3mf`, await zip(build3MF(objs, { title: 'Spin Compass kit' }))]);
      }
      if (m.what === 'stl') {
        const st = [];
        for (const [part, groups] of Object.entries(printMeshes)) for (const [g, mesh] of Object.entries(groups)) st.push([`${base}_${part}_${g}_slot${slotOf(part, g)}.stl`, new Uint8Array(meshToSTL([mesh], `${part} ${g}`))]);
        files.push([`${base}_spin_stl.zip`, await zip(st)]);
      }
      if (m.what === 'firmware') {
        const fw = await import('./firmware.js');
        const prompts = m.prompts || null;
        const imu = CHOICES.imu[S.imu] || CHOICES.imu.dsox;
        const out = fw.firmwareSketch({ name: S.name, segments: L.segments, leds: L.leds, prompts, pins: fw.DEFAULT_PINS, imuClass: imu.cls, imuLabel: imu.label });
        const enc = new TextEncoder();
        files.push([`${base}_SpinCompass_firmware.zip`, await zip(out.files.map(([p, t]) => [p, enc.encode(t)]))]);
      }
      return postMessage({ id, type: 'files', files }, files.map(f => f[1].buffer));
    }
    throw new Error('unknown message ' + m.type);
  } catch (err) {
    postMessage({ id, type: 'error', message: err && err.message ? err.message : String(err) });
  }
};
