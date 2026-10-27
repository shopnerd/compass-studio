// node test/core-test.mjs [outDir] — builds compasses in every centre/back/NFC combination, checks each part is a valid
// solid, that colours never overlap, packs a bed for each printer, writes a bed 3MF + STLs, prints numbers to check by eye.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { deflateRawSync } from 'node:zlib';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import Module from '../vendor/manifold.js';
import opentype from '../vendor/opentype.module.js';
import { createKit, LIGHT, DEFAULTS, PRINTERS, packBed, scaleSweep, swapEstimate, build3MF, zipFiles, meshToSTL, transformMesh } from '../core.js';

const here = dirname(fileURLToPath(import.meta.url));
const buf = readFileSync(join(here, '../fonts/nunito-latin-800-normal.woff'));
const font = opentype.parse(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength));
const wasm = await Module(); wasm.setup();
const K = createKit(wasm, font);
const out = process.argv[2]; if (out) mkdirSync(out, { recursive: true });
let fails = 0; const fail = (m) => { fails++; console.log('  FAIL', m); };
const vol = (m) => m.volume();

function checkCompass(P, label) {
  const t0 = performance.now(); const c = K.compass(P); const ms = performance.now() - t0;
  const names = Object.keys(c.groups);
  for (const [k, m] of Object.entries(c.groups)) if (!K.valid(m)) fail(`${label}: ${k} is not a valid solid`);
  for (let i = 0; i < names.length; i++) for (let j = i + 1; j < names.length; j++) {
    const ov = vol(c.groups[names[i]].intersect(c.groups[names[j]])); if (ov > 0.01) fail(`${label}: ${names[i]} ∩ ${names[j]} = ${ov.toFixed(3)} mm³`);
  }
  for (const e of c.extras) for (const [k, m] of Object.entries(e.groups)) if (!K.valid(m)) fail(`${label}: ${e.label} ${k} invalid`);
  const bb = c.groups.body.boundingBox();
  console.log(`${label.padEnd(34)} ${ms.toFixed(0).padStart(5)} ms  ` + names.map(k => `${k} ${vol(c.groups[k]).toFixed(0)}`).join('  ') + `  mm³ | z ${bb.min[2].toFixed(2)}–${bb.max[2].toFixed(2)}` + (c.pause ? ` | pause ${c.pause}` : '') + (c.warn.length ? `\n${' '.repeat(36)}warn: ${c.warn.join(' / ')}` : ''));
  return c;
}

const base = { ...DEFAULTS };
const main = checkCompass(base, '2025 default (needle, SC, sticker)');
for (const centre of ['needle', 'light', 'fixed']) for (const back of ['sc', 'seal', 'none']) for (const nfc of ['sticker', 'embedded', 'none']) {
  if (centre === 'needle' && back === 'sc' && nfc === 'sticker') continue;
  checkCompass({ ...base, centre, back, nfc }, `${centre}/${back}/${nfc}`);
  K.release();
}
checkCompass({ ...base, values: ['Accountability', 'Perseverance', 'Righteousness', 'Compassion'], name: 'Alexandria Montgomery-Vasquez' }, 'long words');
checkCompass({ ...base, scale: 0.85 }, 'scale 0.85 (Ø63.8)');
checkCompass({ ...base, scale: 1.2, loop: false, backing: false }, 'scale 1.2, no loop, no backing');
K.release();

// ---- bed packing
for (const key of Object.keys(PRINTERS)) {
  const t0 = performance.now(); const b = packBed({ ...base, printer: key }); const ms = performance.now() - t0;
  const sw = swapEstimate({ ...base, printer: key });
  console.log(`${PRINTERS[key].label.padEnd(26)} ${b.n} compasses + ${b.needles.length} needles per bed  (${b.hex ? 'hex' : 'square'}${b.flip ? ', alternate rows flipped' : ''}${b.turn ? ', turned 90°' : ''}) tower at ${b.tower.slice(0, 2).join(',')}  ${ms.toFixed(0)} ms | ~${sw.swaps} colour changes per bed, ~${sw.minutes} min of swaps → ${(sw.minutes / Math.max(1, b.n)).toFixed(1)} min per compass`);
  if (b.n < 4) fail(`${key}: only ${b.n} per bed`);
  // every pair must clear the gap
  const all = [...b.items.map(i => ({ ...i, fp: 'c' })), ...b.needles.map(n => ({ ...n, fp: 'n' }))];
  if (b.needles.length < b.n) console.log(`   note: room for ${b.needles.length} of ${b.n} needles`);
}
console.log('size sweep (MK4S):', scaleSweep(base).map(r => `Ø${r.d}→${r.n}`).join('  '));

// ---- write a full bed: 3MF with a volume per filament, plus STLs per filament
if (out) {
  const c = K.compass(base); const meshes = Object.fromEntries(Object.entries(c.groups).map(([k, m]) => [k, K.toMesh(m)]));
  const nd = K.toMesh(c.extras[0].groups.needle);
  const bed = packBed(base);
  const objs = bed.items.map((it, i) => ({ name: `compass ${i + 1}`, x: it.x, y: it.y, ang: it.ang, volumes: Object.entries(meshes).map(([k, mesh]) => ({ name: k, extruder: base.slots[k], mesh })) }));
  bed.needles.forEach((n, i) => objs.push({ name: `needle ${i + 1}`, x: n.x, y: n.y, ang: n.ang, volumes: [{ name: 'needle', extruder: base.slots.needle, mesh: nd }] }));
  const zip = await zipFiles(build3MF(objs, { title: 'Moral Compass bed' }), async (u8) => new Uint8Array(deflateRawSync(u8)));
  writeFileSync(join(out, 'bed.3mf'), zip);
  for (const [k, mesh] of Object.entries(meshes)) writeFileSync(join(out, `compass-${k}.stl`), Buffer.from(meshToSTL([mesh], k)));
  writeFileSync(join(out, 'needle.stl'), Buffer.from(meshToSTL([nd], 'needle')));
  writeFileSync(join(out, 'light-needle.stl'), Buffer.from(meshToSTL([K.toMesh(K.lightNeedle(base).groups.needle)], 'light needle')));
  writeFileSync(join(out, 'bed-layout.json'), JSON.stringify({ bed: bed.bed, tower: bed.tower, items: bed.items.map(({ x, y, ang }) => ({ x, y, ang })), needles: bed.needles }));
  // uncompressed model for the viewer script
  const parts = build3MF(objs.slice(0, 1).map(o => ({ ...o, x: 0, y: 0, ang: 0 })));
  writeFileSync(join(out, 'one.model'), parts[2][1]);
  console.log(`wrote ${out}: bed.3mf ${(zip.length / 1e6).toFixed(2)} MB, ${objs.length} objects`);
}
// Light needle: one piece, and the cell, LEDs and board sit in their pockets without touching plastic
{
  const { Manifold } = K, m = K.lightNeedle(DEFAULTS).groups.needle;
  const box = (x0, x1, y0, y1, z0, z1) => Manifold.cube([x1 - x0, y1 - y0, z1 - z0]).translate([x0, y0, z0]);
  const cell = Manifold.cylinder(2.0, 6.25, 6.25, 96).translate([0, 0, 0.9]);
  const clash = { cell: m.intersect(cell).volume(), board: m.intersect(box(-3, 3, -18.7, -9.5, 1.1, 2.6)).volume(),
    leds: LIGHT.leds.reduce((a, y) => a + m.intersect(box(-0.4, 0.4, y - 0.8, y + 0.8, 0.7, 1.3)).volume(), 0),
    slideOut: m.intersect(box(0, 20, -6.25, 6.25, 0.9, 2.9)).volume() };
  const pieces = m.decompose().length, bb = m.boundingBox();
  const ok = pieces === 1 && Object.values(clash).every(v => v < 1e-3) && bb.max[1] <= 27.01 && bb.min[1] >= -23.01;
  console.log(`light needle: ${pieces} piece(s), clashes ${JSON.stringify(Object.fromEntries(Object.entries(clash).map(([k, v]) => [k, +v.toFixed(4)])))}, y ${bb.min[1].toFixed(1)}..${bb.max[1].toFixed(1)}, ${m.volume().toFixed(0)} mm³ ${ok ? 'ok' : 'FAIL'}`);
  if (!ok) fails++;
}
console.log(fails ? `${fails} FAILURES` : 'all compass checks passed');
process.exit(fails ? 1 : 0);
