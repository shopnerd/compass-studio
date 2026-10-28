// node test/spinner-test.mjs [outDir] — builds the Spin Compass, checks solids and fits, prints layout + balance, writes STLs.
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import Module from '../vendor/manifold.js';
import opentype from '../vendor/opentype.module.js';
import { createKit, meshToSTL } from '../core.js';
import { buildSpinner, spinLayout, segmentsOf, SPIN_DEFAULTS, INSERT, CAP, SCREW, screwR } from '../spinner.js';

const here = dirname(fileURLToPath(import.meta.url));
const fb = readFileSync(join(here, '../fonts/nunito-latin-800-normal.woff'));
const K = createKit(await Module().then(w => { w.setup(); return w; }), opentype.parse(fb.buffer.slice(fb.byteOffset, fb.byteOffset + fb.byteLength)));
const out = process.argv[2]; if (out) mkdirSync(out, { recursive: true });
let fails = 0; const fail = (m) => { fails++; console.log('  FAIL', m); };

function run(S, label) {
  const t0 = performance.now(); const sp = buildSpinner(K, S); const ms = performance.now() - t0;
  const P = sp.parts;
  for (const [k, m] of Object.entries(P)) if (m && (!K.valid(m) || m.isEmpty())) fail(`${label}: ${k} invalid/empty`);
  // assembled: tray, lid, inlays must not overlap; caps placed on the bearing must not touch tray or lid
  const A = sp.assembly, { zTopCap, zB0 } = A, Mf = K.Manifold;
  const capFull = P.cap.add(P.capPtr), capTop = capFull.translate([0, 0, zTopCap]), capBot = capFull.rotate([180, 0, 0]).translate([0, 0, A.zBotCap]);
  const pin = P.pin.translate([0, 0, A.zPin]);
  const solids = { tray: P.tray, lid: P.lid, white: P.white, gold: P.gold, capTop, capBot };
  const names = Object.keys(solids);
  for (let i = 0; i < names.length; i++) for (let j = i + 1; j < names.length; j++) {
    const v = solids[names[i]].intersect(solids[names[j]]).volume(); if (v > 0.01) fail(`${label}: ${names[i]} ∩ ${names[j]} = ${v.toFixed(3)} mm³`);
  }
  { // matched caps: one piece each, flat on the bed, the boss is the only thing touching the bearing, ribs grip the pin
    if (P.cap.decompose().length !== 1) fail(`${label}: cap is not one piece`);
    const bb = P.cap.boundingBox();
    if (Math.abs(bb.min[2]) > 1e-6) fail(`${label}: cap does not sit on the bed`);
    const ring = (r0, r1, z0, h) => Mf.cylinder(h, r1, r1, 96).subtract(Mf.cylinder(h + 2, r0, r0, 96).translate([0, 0, -1])).translate([0, 0, z0]);
    // bed-side contact: boss (r 4.4–6) and outer rim on the bed, nothing over the bearing's shields and outer ring (r 6.2–11.4)
    if (P.cap.intersect(ring(6.2, 11.4, 0, 0.4)).volume() > 0.001) fail(`${label}: cap back would rub the bearing's outer ring`);
    if (P.cap.intersect(ring(4.5, 5.9, 0, 0.2)).volume() < 2) fail(`${label}: cap boss is missing (nothing bears on the inner ring)`);
    // nothing in the socket but the ribs; pin reaches into both sockets, never bottoms out; grip only through the ribs
    const grip = pin.intersect(capTop).volume() + pin.intersect(capBot).volume();
    if (grip < 0.1 || grip > 2) fail(`${label}: pin grip ${grip.toFixed(3)} mm³ (expected only the crush ribs)`);
    const pb = pin.boundingBox();
    if (pb.max[2] > zTopCap + CAP.sockD - 0.05 || pb.min[2] < A.zBotCap - CAP.sockD + 0.05) fail(`${label}: pin bottoms out in a socket`);
    if (pb.max[2] < zTopCap + 1.2 || pb.min[2] > A.zBotCap - 1.2) fail(`${label}: pin barely enters a socket`);
    // the pin slides through the 608 bore (Ø8) and nothing printed touches it but the caps
    if (CAP.pinR > 3.99) fail(`${label}: pin too fat for the 608 bore`);
    for (const [k, m] of [['tray', P.tray], ['lid', P.lid]]) if (m.intersect(pin).volume() > 0.001) fail(`${label}: pin touches the ${k}`);
    // both caps clear the tray by the hub step: grow each cap 0.4 down/up toward the tray and still no contact
    const near = capTop.translate([0, 0, -0.4]).add(capBot.translate([0, 0, 0.4]));
    if (near.intersect(P.tray).subtract(Mf.cylinder(20, 11, 11, 96).translate([0, 0, -2])).volume() > 0.01) fail(`${label}: cap rim is within 0.4 mm of the hub`);
    // bearing outer ring (r 9.4–11) never touched by a cap
    const outer = ring(9.4, 11, zB0, 7);
    if (outer.intersect(capTop).volume() > 0.001 || outer.intersect(capBot).volume() > 0.001) fail(`${label}: a cap touches the bearing's outer ring`);
    // the hall sensor stays covered by the hub after the step
    const hallTop = A.zHall + 0.9, hubTop = zB0 + 7 - CAP.step;
    if (hubTop - hallTop < 0.5) fail(`${label}: only ${(hubTop - hallTop).toFixed(2)} mm over the hall sensor`);
    // pointer is a real white inlay on the face
    if (P.capPtr.volume() < 3) fail(`${label}: pointer inlay is nearly empty`);
    const proud = zTopCap + A.capT - sp.S.H;
    if (proud < 0.2 || proud > 1.2) fail(`${label}: top cap stands ${proud.toFixed(2)} mm proud of the case`);
  }
  if (P.trayWhite) { // bottom text: a real inlay, flush with the bed side, no overlap with the tray, clear of the grille and the well
    const tw = P.trayWhite, bb = tw.boundingBox();
    if (tw.volume() < 5) fail(`${label}: bottom text is nearly empty`);
    if (Math.abs(bb.min[2]) > 1e-6 || bb.max[2] > sp.S.floor - 0.4) fail(`${label}: bottom text is not a flush inlay (z ${bb.min[2]}–${bb.max[2]})`);
    if (tw.intersect(P.tray).volume() > 0.001) fail(`${label}: bottom text overlaps the tray`);
    const spk = sp.L.parts.find(p => p.key === 'speaker');
    if (spk) { const a = spk.angle * Math.PI / 180, c = K.Manifold.cylinder(2, spk.d / 2 - 2.5, spk.d / 2 - 2.5, 48).translate([spk.r * Math.sin(a), spk.r * Math.cos(a), -0.5]); if (tw.intersect(c).volume() > 0.001) fail(`${label}: bottom text runs over the speaker grille`); }
    if (tw.intersect(K.Manifold.cylinder(2, sp.S.wellR + 0.5, sp.S.wellR + 0.5, 64).translate([0, 0, -0.5])).volume() > 0.001) fail(`${label}: bottom text runs into the finger well`);
  }
  const L = sp.L, bal = L.balance;
  { // lid screws from the bottom: insert in each lid pillar's tip, screw up through the floor, head flush, pillar clears the tray
    const Mf = K.Manifold, zP = sp.assembly.zPillar, rs = screwR(L.rOut), cyl = (h, r, x, y, z) => Mf.cylinder(h, r, r, 32).translate([x, y, z]);
    const knurlWall = INSERT.bossR - INSERT.knurl / 2, grip = Math.min(INSERT.screwLen - zP, INSERT.len), spare = zP + INSERT.depth - INSERT.screwLen;
    if (knurlWall < 1.3) fail(`${label}: only ${knurlWall.toFixed(2)} mm of plastic round the insert knurl (ruthex wants 1.3)`);
    if (grip < 2.5) fail(`${label}: M2 × ${INSERT.screwLen} engages only ${grip.toFixed(1)} mm of the insert`);
    if (spare < 0.3) fail(`${label}: screw tip bottoms out in the pillar's hole`);
    if (P.lid.intersect(P.tray).volume() > 0.01) fail(`${label}: lid pillars touch the tray`);
    for (const a of L.screws) {
      const [x, y] = [rs * Math.sin(a * Math.PI / 180), rs * Math.cos(a * Math.PI / 180)];
      if (P.lid.intersect(cyl(INSERT.len - 0.2, INSERT.hole / 2 - 0.1, x, y, zP + 0.1)).volume() > 0.01) fail(`${label}: insert hole at ${a}° is blocked`);
      const ring = cyl(INSERT.len - INSERT.chamfer - 0.1, INSERT.bossR - 0.2, x, y, zP + INSERT.chamfer + 0.05).subtract(cyl(INSERT.len + 1, INSERT.hole / 2 + 0.1, x, y, zP - 0.5));
      { const gap = ring.subtract(P.lid); if (gap.volume() > 0.01) fail(`${label}: pillar wall at ${a}° has a gap of ${gap.volume().toFixed(3)} mm³`); }
      const shank = cyl(INSERT.screwLen - 1, 0.95, x, y, 0.95);   // below the head, up to the tip
      if (shank.intersect(P.tray).volume() > 0.01 || shank.intersect(P.lid).volume() > 0.01) fail(`${label}: screw path at ${a}° is blocked`);
      const head = Mf.cylinder(0.9, INSERT.head / 2 - 0.05, 1.0, 32).translate([x, y, 0.02]);
      if (head.intersect(P.tray).volume() > 0.01) fail(`${label}: screw head at ${a}° does not sit flush in its countersink`);
      if (P.trayWhite && P.trayWhite.intersect(cyl(3, INSERT.head / 2 + 0.8, x, y, -1)).volume() > 0.001) fail(`${label}: bottom text runs into the screw at ${a}°`);
    }
    // the face is clean: nothing cut through the lid's top 0.4 mm except the inlays
    const faceTop = Mf.cylinder(0.4, sp.S.R - 0.5, sp.S.R - 0.5, 192).translate([0, 0, sp.S.H - 0.4]).subtract(Mf.cylinder(1, sp.S.wellR + 0.5, sp.S.wellR + 0.5, 96).translate([0, 0, sp.S.H - 0.7]));
    const filled = P.lid.add(P.white).add(P.gold).intersect(faceTop).volume(), full = faceTop.volume();
    if (full - filled > 0.5) fail(`${label}: ${(full - filled).toFixed(2)} mm³ of holes in the face`);
  }
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
{ // eight values (a ValueCore compass): eight value segments, no game words, even a value spelled like one
  const eight = ['Integrity', 'Courage', 'Empathy', 'Curiosity', 'Justice', 'Honesty', 'Truth', 'Service'];
  const segs = segmentsOf({ ...SPIN_DEFAULTS, order: 'eight', values: eight });
  if (segs.length !== 8 || segs.some(s => s.kind !== 'value') || segs.map(s => s.label).join() !== eight.join()) fail('eight values: segments wrong ' + JSON.stringify(segs.map(s => [s.label, s.kind])));
  run({ ...SPIN_DEFAULTS, order: 'eight', values: eight }, 'eight values');
}
run({ ...SPIN_DEFAULTS, bottom: ['Maya Rodriguez', 'WRIT 340 · Fall 2026'] }, 'bottom text');
run({ ...SPIN_DEFAULTS, speaker: 'none', bottom: ['A much longer line of text that cannot fit', ''] }, 'bottom text, too long, no speaker');
run({ ...SPIN_DEFAULTS, disc: '90', leds: '16', battery: '502025', speaker: '15' }, 'Ø90, 16 LEDs, 220 mAh, 15 mm');
run({ ...SPIN_DEFAULTS, disc: '86', leds: '8', battery: '302025', speaker: 'none' }, 'Ø86, 8 LEDs, 120 mAh, no sound');
if (out) {
  const w = (n, m) => writeFileSync(join(out, n), Buffer.from(meshToSTL([K.toMesh(m)], n)));
  const { zTopCap, zB0 } = sp.assembly;
  w('sp-tray.stl', sp.parts.tray); w('sp-lid.stl', sp.parts.lid); w('sp-white.stl', sp.parts.white); w('sp-gold.stl', sp.parts.gold);
  w('sp-cap.stl', sp.parts.cap); w('sp-capptr.stl', sp.parts.capPtr); w('sp-pin.stl', sp.parts.pin);
  w('sp-hub-assembled.stl', sp.parts.cap.add(sp.parts.capPtr).translate([0, 0, zTopCap]).add(sp.parts.cap.add(sp.parts.capPtr).rotate([180, 0, 0]).translate([0, 0, sp.assembly.zBotCap])).add(sp.parts.pin.translate([0, 0, sp.assembly.zPin])));
  console.log('wrote STLs to', out);
}
console.log(fails ? `${fails} FAILURES` : 'all spinner checks passed');
process.exit(fails ? 1 : 0);
