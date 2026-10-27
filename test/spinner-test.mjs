// node test/spinner-test.mjs [outDir] — builds the Spin Compass, checks solids and fits, prints layout + balance, writes STLs.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import Module from '../vendor/manifold.js';
import opentype from '../vendor/opentype.module.js';
import { createKit, meshToSTL } from '../core.js';
import { buildSpinner, spinLayout, SPIN_DEFAULTS } from '../spinner.js';

const here = dirname(fileURLToPath(import.meta.url));
const fb = readFileSync(join(here, '../fonts/nunito-latin-800-normal.woff'));
const K = createKit(await Module().then(w => { w.setup(); return w; }), opentype.parse(fb.buffer.slice(fb.byteOffset, fb.byteOffset + fb.byteLength)));
const out = process.argv[2]; if (out) mkdirSync(out, { recursive: true });
let fails = 0; const fail = (m) => { fails++; console.log('  FAIL', m); };

function run(S, label) {
  const t0 = performance.now(); const sp = buildSpinner(K, S); const ms = performance.now() - t0;
  const P = sp.parts;
  for (const [k, m] of Object.entries(P)) if (!K.valid(m) || m.isEmpty()) fail(`${label}: ${k} invalid/empty`);
  // assembled: tray, lid, inlays must not overlap; caps placed on the bearing must not touch tray or lid
  const { zTopCap, zB0 } = sp.assembly;
  const capTop = P.capTop.translate([0, 0, zTopCap]), capBot = P.capBot.rotate([180, 0, 0]).translate([0, 0, zB0 - 0.5]);
  const solids = { tray: P.tray, lid: P.lid, white: P.white, gold: P.gold, capTop, capBot };
  const names = Object.keys(solids);
  for (let i = 0; i < names.length; i++) for (let j = i + 1; j < names.length; j++) {
    const v = solids[names[i]].intersect(solids[names[j]]).volume(); if (v > 0.01) fail(`${label}: ${names[i]} ∩ ${names[j]} = ${v.toFixed(3)} mm³`);
  }
  const L = sp.L, bal = L.balance;
  { // walls round the hub: finger wells to cavity, hall pocket to bearing and to cavity
    const hall = L.parts.find(p => p.key === 'hall'), Sx = L.S, half = (hall.radial + 0.4) / 2;
    const walls = { well: L.rIn - Sx.wellR, hallBore: hall.r - half - Sx.boreR, hallCavity: L.rIn - (hall.r + half) };
    for (const [k, v] of Object.entries(walls)) if (v < 0.8) fail(`${label}: hub wall ${k} only ${v.toFixed(2)} mm`);
  }
  console.log(`${label}: ${ms.toFixed(0)} ms | tray ${P.tray.volume().toFixed(0)} lid ${P.lid.volume().toFixed(0)} white ${P.white.volume().toFixed(0)} gold ${P.gold.volume().toFixed(0)} mm³`);
  console.log(`  parts: ${L.parts.map(p => `${p.key}@${p.angle}°/r${p.r.toFixed(1)}`).join('  ')}`);
  console.log(`  balance: off-centre ${bal.raw.toFixed(1)} g·mm → ${bal.n ? `${bal.n} BBs at ${bal.angle}°, r ${bal.r.toFixed(1)} → ${bal.residual.toFixed(1)} g·mm left` : 'no BBs'} | electronics ${bal.mass.toFixed(1)} g | screws at ${L.screws.join(', ')}°`);
  if (sp.warn.length) console.log('  warn: ' + sp.warn.join(' / '));
  return sp;
}
const sp = run(SPIN_DEFAULTS, 'default');
run({ ...SPIN_DEFAULTS, values: ['Accountability', 'Perseverance', 'Compassion', 'Curiosity'] }, 'long values');
run({ ...SPIN_DEFAULTS, order: 'values' }, 'values together');
run({ ...SPIN_DEFAULTS, disc: '90', leds: '16', battery: '502025', speaker: '15' }, 'Ø90, 16 LEDs, 220 mAh, 15 mm');
run({ ...SPIN_DEFAULTS, disc: '86', leds: '8', battery: '302025', speaker: 'none' }, 'Ø86, 8 LEDs, 120 mAh, no sound');
if (out) {
  const w = (n, m) => writeFileSync(join(out, n), Buffer.from(meshToSTL([K.toMesh(m)], n)));
  const { zTopCap, zB0 } = sp.assembly;
  w('sp-tray.stl', sp.parts.tray); w('sp-lid.stl', sp.parts.lid); w('sp-white.stl', sp.parts.white); w('sp-gold.stl', sp.parts.gold);
  w('sp-captop.stl', sp.parts.capTop.translate([0, 0, zTopCap])); w('sp-capptr.stl', sp.parts.capPtr.translate([0, 0, zTopCap]));
  w('sp-capbot.stl', sp.parts.capBot); w('sp-dome.stl', sp.parts.dome);
  console.log('wrote STLs to', out);
}
console.log(fails ? `${fails} FAILURES` : 'all spinner checks passed');
process.exit(fails ? 1 : 0);
