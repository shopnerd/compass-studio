// core.js — Compass Studio geometry. Isomorphic: runs in the worker and in Node tests.
// The compass is the 2025 student design (Customized compass generator.py), rebuilt with Manifold so it runs in a
// browser in about a second. Units: mm. Print pose: back on the bed (z = 0), face up. Every coloured feature is a flush
// inlay, so a compass is a set of solids that never overlap: body + one solid per filament.
//
// the 2025 numbers, moved up 0.6 mm so the back sits on z = 0:
//   body Ø75 × 7.6, raised ring 28.5–37.5 mm radius, centre dish floor at 5.0, keyring loop r4 (hole r2) at y 41.5, loop top 5.0
//   values: 1 mm inlay at the top, radius 33, letter size 8.2, 0.8 mm tracking, capitals, two longest words N/S
//   rose: 1 mm gold inlay under the dish floor (4.0–5.0)        SC logo + name: 1 mm inlay on the back (0–1.0), name radius 32
//   bearing 695ZZ (5×13×4): pocket r 6.51 from 1.0 to 5.0, relief r 5.51 from 0.8 to 1.0 under the inner ring
//   needle: 50 long, 2 thick, hub r 6, ledge r 3.6 × 0.6, pin Ø5.2 × 3.8        NFC sticker: Ø10.4 × 0.4 recess at y 32 on the back
import { ROSE, SC_LOGO } from './data/design2025.js';
import { SEAL } from './data/seal.js';

export const BEARINGS = {
  '695': { label: '695ZZ, 5 × 13 × 4 mm', bore: 5, od: 13, w: 4 },
  '685': { label: '685ZZ, 5 × 11 × 5 mm', bore: 5, od: 11, w: 5 },
};
export const PRINTERS = {
  mk4s: { label: 'Prusa MK4S + MMU3', w: 250, h: 210, tower: [60, 20] },
  core1: { label: 'Prusa Core One + MMU3', w: 250, h: 220, tower: [60, 20] },
  xl: { label: 'Prusa XL, 5 heads', w: 360, h: 360, tower: [45, 15] },
};
export const DEFAULTS = {
  values: ['Integrity', 'Honor', 'Excellence', 'Service'], autoArrange: true, caps: true,
  name: 'Name Example', back: 'sc',                 // sc | seal | none
  scale: 1,                                          // whole compass; bearing, needle pin, NFC and letter size stay as they are
  textSize: 8.2, track: 0.8, textR: 33, nameR: 32, minText: 5,
  loop: true, backing: true,                         // white skin on the dish floor (the 2025 workflow paints this by hand in the slicer)
  centre: 'needle',                                  // needle | light | fixed
  bearing: '695', boreR: 6.51, pinD: 5.2,
  nfc: 'sticker',                                    // sticker | embedded | none
  slots: { body: 1, white: 2, gold: 3, needle: 1 },
  printer: 'mk4s', gap: 4, margin: 3, layer: 0.2,
};
export const FILAMENTS = { body: '#b8232c', white: '#f3f1ea', gold: '#c99a2e', needle: '#b8232c' };

// The 2025 rule: longest word north, next longest south, then the longer of the other two east.
export function arrangeValues(vals, measure = (s) => s.length) {
  const v = vals.slice(0, 4).map(s => (s || '').trim());
  const s = [...v].sort((a, b) => measure(b) - measure(a));
  const [e, w] = measure(s[2]) >= measure(s[3]) ? [s[2], s[3]] : [s[3], s[2]];
  return [s[0], e, s[1], w];       // N E S W
}
export const LEDGE = 0.2;          // relief under the bearing's inner ring so it never drags on the floor
export const POCKET_WALL = 1.2;    // solid body round the bearing pocket: the rose and its white skin stop this far out
export const BACK_UNDER = 0.4;     // the back inlay is only this deep under the pocket, so the floor stays solid body
export function dims(P) {
  const s = P.scale, R = 37.5 * s, Rd = 28.5 * s, b = BEARINGS[P.bearing];
  const T = 7.6, dishZ = 5.0, inlay = 1.0;
  return { s, R, Rd, T, dishZ, inlay, b, loopY: R + 4, nfcAt: [0, 32 * s], spins: P.centre !== 'fixed',
    pocketZ0: dishZ - b.w, ledgeZ0: dishZ - b.w - LEDGE };
}

// ---------------------------------------------------------------- footprints + bed packing
// A footprint is a list of circles in the part's own frame; the loop points to +y.
export function compassPrint(P) {
  const { R, loopY } = dims(P); const c = [[0, 0, R]];
  if (P.loop) for (let t = 0; t <= 1.0001; t += 0.25) c.push([0, (R - 4) + 8 * t, 8.9 - 4.9 * t]);
  return c;
}
export const NEEDLE_PRINT = [[0, 0, 6], [0, 10, 3.6], [0, -10, 3.6], [0, 16, 2.4], [0, -16, 2.4], [0, 21.5, 1.3], [0, -21.5, 1.3]];
export const LIGHT = { hubT: 3.8, armT: 2.6, leds: [9, 12, 15, 18, 21] };
export const LIGHT_PRINT = [[0, 0, 8.6], [0, 10, 2.6], [0, 15, 2.6], [0, 20, 2.6], [0, 23.5, 1.9], [0, 25.6, 0.9], [0, -9, 4.6], [0, -14, 4.6], [0, -18.5, 4.6]];
export const needlePrint = (P) => P.centre === 'light' ? LIGHT_PRINT : NEEDLE_PRINT;
const rot = (c, a) => { const s = Math.sin(a), k = Math.cos(a); return [c[0] * k - c[1] * s, c[0] * s + c[1] * k, c[2]]; };
const place = (fp, x, y, a) => fp.map(c => { const r = rot(c, a); return [r[0] + x, r[1] + y, r[2]]; });
const hits = (A, B, gap) => { for (const a of A) for (const b of B) if (Math.hypot(a[0] - b[0], a[1] - b[1]) < a[2] + b[2] + gap - 1e-6) return true; return false; };
const inBed = (C, x0, y0, x1, y1) => C.every(c => c[0] - c[2] >= x0 - 1e-6 && c[0] + c[2] <= x1 + 1e-6 && c[1] - c[2] >= y0 - 1e-6 && c[1] + c[2] <= y1 + 1e-6);
const hitsRect = (C, t, gap) => C.some(c => { const cx = Math.max(t[0], Math.min(c[0], t[0] + t[2])), cy = Math.max(t[1], Math.min(c[1], t[1] + t[3])); return Math.hypot(c[0] - cx, c[1] - cy) < c[2] + gap; });

// Rows of compasses, every other row optionally flipped so the loops slot into the gaps; tries both bed directions,
// a few pitches, shifted origins and every wipe-tower position on a 5 mm grid. Then fills what is left with needles.
export function packBed(P, opts = {}) {
  const pr = PRINTERS[P.printer] || PRINTERS.mk4s, g = P.gap, m = P.margin, fp = compassPrint(P), R = dims(P).R;
  const [tw, th] = pr.tower, bw = pr.w, bh = pr.h;
  let best = null;
  for (const turn of [0, Math.PI / 2]) for (const flip of [false, true]) for (const hex of [true, false]) for (let da = 0; da <= 8; da += 2) {
    const a = 2 * R + g + da;
    const pose = (i, j) => { const up = !(flip && j % 2); return { x: i * a + (hex && j % 2 ? a / 2 : 0), y: 0, ang: turn + (up ? 0 : Math.PI) }; };
    // smallest row step that clears a 3 × 3 patch
    let b = null;
    for (let bb = a * (hex ? 0.8 : 0.95) * 0.5; bb < a * 2; bb += 0.5) {
      const patch = []; for (let j = 0; j < 3; j++) for (let i = -1; i < 3; i++) { const p = pose(i, j); patch.push(place(fp, ...rotXY(p.x, j * bb, turn), p.ang)); }
      let ok = true; for (let i = 0; i < patch.length && ok; i++) for (let k = i + 1; k < patch.length; k++) if (hits(patch[i], patch[k], g)) { ok = false; break; }
      if (ok) { b = bb; break; }
    }
    if (!b) continue;
    for (let ox = 0; ox < a; ox += a / 4) for (let oy = 0; oy < b; oy += b / 3) {
      const items = [];
      for (let j = -2; j < 30; j++) for (let i = -2; i < 30; i++) {
        const p = pose(i, j); const [x, y] = rotXY(p.x, j * b, turn); const X = x + ox + m, Y = y + oy + m;
        if (X < -R || Y < -R || X > bw + R || Y > bh + R) continue;
        const C = place(fp, X, Y, p.ang); if (inBed(C, m, m, bw - m, bh - m)) items.push({ x: X, y: Y, ang: p.ang, C });
      }
      if (!items.length || (best && items.length <= best.n)) continue;
      let top = null;
      for (let tx = m; tx <= bw - m - tw; tx += 5) for (let ty = m; ty <= bh - m - th; ty += 5) {
        const t = [tx, ty, tw, th]; const keep = items.filter(it => !hitsRect(it.C, t, g));
        if (!top || keep.length > top.keep.length) top = { keep, t };
      }
      if (top && (!best || top.keep.length > best.n)) best = { n: top.keep.length, items: top.keep, tower: top.t, turn, flip, hex };
    }
  }
  if (!best) return { n: 0, items: [], needles: [], tower: [m, m, tw, th], bed: [bw, bh], printer: pr.label };
  // needles in the leftover space, as many as there are compasses
  const needles = [];
  if (P.centre !== 'fixed' && opts.needles !== false) {
    const taken = best.items.map(it => it.C);
    for (let y = m; y < bh - m && needles.length < best.n; y += 2) for (let x = m; x < bw - m && needles.length < best.n; x += 2) for (const ang of [0, Math.PI / 2, Math.PI / 3, 2 * Math.PI / 3, Math.PI / 6, 5 * Math.PI / 6]) {
      const C = place(needlePrint(P), x, y, ang);
      if (!inBed(C, m, m, bw - m, bh - m) || hitsRect(C, best.tower, g) || taken.some(T => hits(C, T, g))) continue;
      needles.push({ x, y, ang }); taken.push(C); break;
    }
  }
  return { ...best, needles, bed: [bw, bh], printer: pr.label };
}
function rotXY(x, y, a) { const s = Math.sin(a), k = Math.cos(a); return [x * k - y * s, x * s + y * k]; }
export function scaleSweep(P, list = [0.7, 0.8, 0.9, 1, 1.1, 1.2]) {
  return list.map(s => ({ s, d: +(75 * s).toFixed(1), n: packBed({ ...P, scale: s }, { needles: false }).n }));
}
// With the MMU the slicer changes filament inside every layer that holds more than one colour, so the swaps are the
// same for a bed of one or a bed of eight: more compasses per bed = fewer swaps per compass.
export function swapEstimate(P) {
  const d = dims(P), L = P.layer, S = P.slots, bands = [[0, d.inlay, 'white'], [d.dishZ - d.inlay, d.dishZ, 'gold'], [d.T - d.inlay, d.T, 'white']];
  if (P.backing) bands.push([d.dishZ - 0.4, d.dishZ, 'white']);
  let swaps = 0, mixed = 0; const n = Math.round(d.T / L);
  for (let k = 0; k < n; k++) {
    const z = (k + 0.5) * L, used = new Set([S.body]);
    for (const [z0, z1, g] of bands) if (z > z0 && z < z1) used.add(S[g]);
    if (z < 2 && P.centre !== 'fixed') used.add(S.needle);      // needles share the bed, printed in their own slot
    if (used.size > 1) { mixed++; swaps += used.size - 1; }
  }
  return { layers: n, mixed, swaps: swaps + 2, minutes: Math.round((swaps + 2) * 40 / 60) };
}

// ---------------------------------------------------------------- the kit (Manifold wasm + an opentype font)
export function createKit(wasm, font) {
  const { Manifold, CrossSection } = wasm;
  const live = new Set();
  const track = (v) => { if (v instanceof Manifold || v instanceof CrossSection) live.add(v); else if (Array.isArray(v)) v.forEach(track); return v; };
  const SKIP = new Set(['constructor', 'delete', 'deleteLater', 'isDeleted', 'isAliasOf', 'clone']);
  for (const C of [Manifold, CrossSection]) {
    if (C.__tracked) continue; C.__tracked = true;
    for (let proto = C.prototype; proto && proto !== Object.prototype && proto.constructor && proto.constructor.name !== 'ClassHandle'; proto = Object.getPrototypeOf(proto)) {
      for (const name of Object.getOwnPropertyNames(proto)) { const f = proto[name]; if (typeof f !== 'function' || SKIP.has(name)) continue; proto[name] = function (...a) { return track(f.apply(this, a)); }; }
    }
    for (const name of Object.getOwnPropertyNames(C)) { const f = C[name]; if (typeof f !== 'function' || name === 'prototype') continue; C[name] = (...a) => track(f.apply(C, a)); }
  }
  function release() { for (const x of live) { try { if (!x.isDeleted()) x.delete(); } catch (_) {} } live.clear(); }
  const mk = (polys, rule = 'Positive') => track(new CrossSection(polys, rule));
  const empty = () => CrossSection.square([0.001, 0.001]).translate([1e4, 1e4]);
  const unionCS = (l) => { l = l.filter(c => c && !c.isEmpty()); return l.length ? CrossSection.union(l) : null; };
  const disk = (r, n = 128) => CrossSection.circle(r, n);
  const ext = (cs, h, z) => (!cs || cs.isEmpty() || h <= 0) ? null : Manifold.extrude(cs, h).translate([0, 0, z]);
  const cyl = (h, r, z = 0, n = 96, x = 0, y = 0) => Manifold.cylinder(h, r, r, n).translate([x, y, z]);
  const unionM = (l) => { l = l.filter(Boolean); return l.length ? Manifold.union(l) : null; };

  // ---- text from the font: flattened outlines, bent onto a circle
  const upm = font.unitsPerEm, cache = new Map();
  const capH = (font.tables.os2 && font.tables.os2.sCapHeight) || upm * 0.7;
  function glyph(ch) {
    if (cache.has(ch)) return cache.get(ch);
    const g = font.charToGlyph(ch), polys = []; let cur = [], x = 0, y = 0;
    for (const c of g.path.commands) {
      if (c.type === 'M') { if (cur.length > 2) polys.push(cur); cur = [[c.x, c.y]]; x = c.x; y = c.y; }
      else if (c.type === 'L') { cur.push([c.x, c.y]); x = c.x; y = c.y; }
      else if (c.type === 'Q') { for (let k = 1; k <= 6; k++) { const t = k / 6, u = 1 - t; cur.push([u*u*x + 2*u*t*c.x1 + t*t*c.x, u*u*y + 2*u*t*c.y1 + t*t*c.y]); } x = c.x; y = c.y; }
      else if (c.type === 'C') { for (let k = 1; k <= 8; k++) { const t = k / 8, u = 1 - t; cur.push([u*u*u*x + 3*u*u*t*c.x1 + 3*u*t*t*c.x2 + t*t*t*c.x, u*u*u*y + 3*u*u*t*c.y1 + 3*u*t*t*c.y2 + t*t*t*c.y]); } x = c.x; y = c.y; }
      else if (c.type === 'Z') { if (cur.length > 2) polys.push(cur); cur = []; }
    }
    if (cur.length > 2) polys.push(cur);
    const o = { polys, adv: g.advanceWidth, g }; cache.set(ch, o); return o;
  }
  function layout(str, size, trackMM) {
    const s = size / upm, ch = [...str], out = []; let pen = 0;
    ch.forEach((c, i) => {
      const gl = glyph(c); for (const p of gl.polys) out.push(p.map(([px, py]) => [pen + px * s, py * s - capH * s / 2]));
      pen += gl.adv * s; if (i < ch.length - 1) pen += font.getKerningValue(gl.g, glyph(ch[i + 1]).g) * s + (c === ' ' ? 0 : trackMM);
    });
    return { polys: out.map(p => p.map(([x, y]) => [x - pen / 2, y])), w: pen };
  }
  const measure = (str, size, trackMM) => layout(str, size, trackMM).w;
  // centred at angle a (deg, CCW from +x). Outward: tops out, reads clockwise. Inward: tops in, reads counter-clockwise.
  function arcText(str, r, aDeg, size, maxDeg, minSize, trackMM, inward = false) {
    str = (str || '').trim(); if (!str) return { cs: null, size, fits: true };
    let sz = size, L = layout(str, sz, trackMM); const max = r * maxDeg * Math.PI / 180;
    for (let k = 0; k < 12 && L.w > max && sz > minSize; k++) { sz = Math.max(minSize, sz * Math.min(0.995, max / L.w)); L = layout(str, sz, trackMM); }
    const a0 = aDeg * Math.PI / 180;
    const bend = inward ? ([x, y]) => { const phi = a0 + x / r, rr = r - y; return [rr * Math.cos(phi), rr * Math.sin(phi)]; }
                        : ([x, y]) => { const phi = a0 - x / r, rr = r + y; return [rr * Math.cos(phi), rr * Math.sin(phi)]; };
    const polys = L.polys.map(p => { const o = []; for (let i = 0; i < p.length; i++) { const A = p[i], B = p[(i + 1) % p.length]; const n = Math.max(1, Math.ceil(Math.hypot(B[0] - A[0], B[1] - A[1]) / 0.7)); for (let k = 0; k < n; k++) o.push(bend([A[0] + (B[0] - A[0]) * k / n, A[1] + (B[1] - A[1]) * k / n])); } return o; });
    return { cs: mk(polys, 'NonZero'), size: sz, fits: L.w <= max + 0.01 };
  }
  const art = (polys, s) => mk(polys.map(p => p.map(([x, y]) => [x * s, y * s])));

  // ---------------------------------------------------------------- one compass
  function compass(P0) {
    const P = { ...DEFAULTS, ...P0, slots: { ...DEFAULTS.slots, ...(P0.slots || {}) } };
    const d = dims(P), { s, R, Rd, T, dishZ, inlay, b } = d, warn = [];
    const up = (t) => P.caps ? (t || '').toUpperCase() : (t || '');
    const vals4 = P.values.slice(0, 4).map(up);
    const vals = P.autoArrange ? arrangeValues(vals4, w => measure(w, P.textSize, P.track)) : vals4;

    // top ring: the four values, 1 mm deep, flush
    const ring = disk(R - 0.6, 192).subtract(disk(Rd + 0.6, 160));
    // Words share the ring: a long north word may borrow room from short east/west words. Each neighbouring pair must
    // leave a gap of at least one letter space; the longer word of a crowded pair shrinks first, down to minText.
    const rT = P.textR * s, gapDeg = (P.textSize * 0.9 / rT) * 180 / Math.PI;
    const sizes = vals.map(() => P.textSize);
    const span = (i) => vals[i] ? measure(vals[i], sizes[i], P.track) / rT * 180 / Math.PI : 0;
    for (let guard = 0; guard < 400; guard++) {
      let worst = null;
      for (let i = 0; i < 4; i++) { const j = (i + 1) % 4, over = span(i) / 2 + span(j) / 2 + gapDeg - 90; if (over > 0.01 && (!worst || over > worst.over)) worst = { i, j, over }; }
      if (!worst) break;
      const k = span(worst.i) * sizes[worst.i] >= span(worst.j) * sizes[worst.j] && sizes[worst.i] > P.minText ? worst.i : (sizes[worst.j] > P.minText ? worst.j : (sizes[worst.i] > P.minText ? worst.i : -1));
      if (k < 0) { warn.push(`"${vals[worst.i]}" and "${vals[worst.j]}" are too long to fit side by side; try a shorter word`); break; }
      sizes[k] = Math.max(P.minText, sizes[k] * 0.98);
    }
    vals.forEach((v, i) => { if (v && sizes[i] < P.textSize - 0.05) warn.push(`"${v}" prints at ${sizes[i].toFixed(1)} mm (others ${P.textSize})`); });
    const words = [90, 0, 270, 180].map((a, i) => arcText(vals[i], rT, a, sizes[i], 360, P.minText, P.track).cs);
    const topText = unionCS(words); const topTextIn = topText ? topText.intersect(ring) : null;

    // centre: gold rose 1 mm under the dish floor, optional white skin around it
    const holeR = d.spins ? P.boreR : 0;
    let rose = art(ROSE, s); if (holeR) rose = rose.subtract(disk(holeR + POCKET_WALL, 96));
    const backing = P.backing ? disk(Rd, 160).subtract(rose).subtract(disk((holeR || 6.51) + POCKET_WALL, 96)) : null;

    // back: SC logo or the 2024 USC Makers seal, the name along the south edge, NFC recess north
    const backParts = [];
    if (P.back === 'sc') backParts.push(art(SC_LOGO, s));
    if (P.back === 'seal') backParts.push(mk(SEAL.map(p => p.map(([x, y]) => [x * 0.62 * s, (y + 3.46) * 0.62 * s - 1.5 * s]))));
    let nameCS = null;
    if (P.name) {   // built as seen from below (tops toward the centre, reading left to right), then mirrored into model space
      const t = arcText(P.name, P.nameR * s, 270, P.textSize, 120, P.minText, P.track, true);
      if (t.size < P.textSize - 0.01) warn.push(`The name shrinks to ${t.size.toFixed(1)} mm to fit`);
      if (!t.fits) warn.push('The name is too long for the back');
      nameCS = t.cs ? t.cs.mirror([1, 0]) : null;
    }
    const backArt = unionCS(backParts), back = unionCS([backArt, nameCS]);

    // ---- solids
    let outline = disk(R, 192);
    if (P.loop) outline = outline.add(CrossSection.hull([CrossSection.circle(4, 64).translate([0, d.loopY]), CrossSection.circle(8.9 * Math.min(1, s), 64).translate([0, R - 4 * s])]).subtract(CrossSection.circle(2, 48).translate([0, d.loopY])));
    const blank = Manifold.extrude(outline, dishZ).add(ext(disk(R, 192), T - dishZ, dishZ).subtract(cyl(T, Rd, dishZ - 0.01, 160)));
    const cuts = [];
    let pause = null;
    if (holeR) { cuts.push(cyl(b.w + 0.01, holeR, d.pocketZ0, 96)); cuts.push(cyl(LEDGE + 0.01, 5.51, d.ledgeZ0, 96)); }
    if (P.nfc === 'sticker') cuts.push(cyl(0.4, 5.2, -0.01, 96, ...d.nfcAt));
    if (P.nfc === 'embedded') { const z0 = 1.6, h = 0.6; cuts.push(cyl(h, 5.3, z0, 96, ...d.nfcAt)); pause = +((Math.ceil((z0 + h) / P.layer - 1e-6)) * P.layer).toFixed(2); }
    const cut = unionM(cuts);
    // under the bearing pocket the back art is shallower, so the logo never cuts through the floor into the pocket
    const under = holeR && back ? disk(holeR + 0.6, 96) : null;
    const backSolid = under ? unionM([ext(back.subtract(under), inlay, 0), ext(back.intersect(under), BACK_UNDER, 0)]) : ext(back, inlay, 0);
    const whiteSolid = unionM([ext(topTextIn, inlay, T - inlay), backSolid, ext(backing, 0.4, dishZ - 0.4)]);
    const goldSolid = ext(rose, inlay, dishZ - inlay);
    let body = blank; if (cut) body = body.subtract(cut);
    for (const x of [whiteSolid, goldSolid]) if (x) body = body.subtract(x);
    const trim = (x) => x && cut ? x.subtract(cut) : x;
    const groups = { body, white: trim(whiteSolid), gold: trim(goldSolid ? (whiteSolid ? goldSolid.subtract(whiteSolid) : goldSolid) : null) };
    for (const k of Object.keys(groups)) if (!groups[k] || groups[k].isEmpty()) delete groups[k];

    const extras = [];
    if (P.centre === 'needle') extras.push(needle(P));
    if (P.centre === 'light') extras.push(lightNeedle(P));
    if (P.centre !== 'fixed') { const tip = P.centre === 'light' ? 27 : 25; if (tip > d.Rd - 0.8) warn.push(`The ${P.centre === 'light' ? 'light ' : ''}needle (tip ${tip} mm) needs the dish to be at least Ø${(2 * (tip + 0.8)).toFixed(0)}; make the compass bigger`); }
    if (P.nfc === 'sticker' && P.back === 'seal') warn.push('The seal runs close to the NFC recess; check the back view');
    return { groups, extras, warn, pause, vals, d };
  }

  // The 2025 needle, as printed: flat face on the bed, pin up. Installed upside down, pin pressed into the bearing.
  function needleBlank(t = 2) {
    const k = [5.346, 2.723];
    const n = mk([[[0, 25], [-k[0], k[1]], [k[0], k[1]]]]), sth = mk([[[0, -25], [k[0], -k[1]], [-k[0], -k[1]]]]);
    return CrossSection.union([n, sth, disk(6, 64)]);
  }
  function needle(P) {
    const flat = needleBlank();
    let m = Manifold.extrude(flat, 2).add(cyl(0.6, 3.6, 2, 48)).add(cyl(3.8, P.pinD / 2, 2.6, 48));
    return { kind: 'needle', label: 'needle', groups: { needle: m } };
  }
  // The light needle (persistence of vision). Printed face down like the plain needle, then flipped onto the bearing.
  // Hub: a CR1220 cell slides in sideways through a slot (east side) between a 0.8 mm face skin and a 0.8 mm floor;
  // the collar and pin stand on that floor. North arm: straight-sided, five pre-wired 0603 micro LEDs in pockets on the
  // underside shine through 1.1 mm windows in the face. South tail: pocket for a controller board up to 6.4 x 9.4 mm.
  // Wire grooves run on the underside from the cell to the LEDs and to the board.
  function lightNeedle(P) {
    const hubT = LIGHT.hubT, armT = LIGHT.armT, hubR = 8.5;
    const north = mk([[[-2.5, 0], [2.5, 0], [2.5, 21.6], [0, 27], [-2.5, 21.6]]]);
    const tail = CrossSection.hull([CrossSection.square([9, 1]).translate([-4.5, -1]), CrossSection.circle(4.5, 64).translate([0, -18.5])]);
    let m = ext(CrossSection.union([north, tail]), armT, 0).add(cyl(hubT, hubR, 0, 96));
    const box = (x0, x1, y0, y1, z0, z1) => Manifold.cube([x1 - x0, y1 - y0, z1 - z0]).translate([x0, y0, z0]);
    const cuts = [
      cyl(2.2, 6.4, 0.8, 96), box(0, hubR + 1, -6.4, 6.4, 0.8, 3.0),                 // cell pocket + slide-in slot
      box(0.45, 1.35, 5.5, 22, 1.6, 2.7), box(-0.7, 0.7, -9.6, -5.5, 1.6, 2.7),     // wire grooves (tunnel through the hub wall)
      box(-3.2, 3.2, -18.9, -9.3, 1.0, armT + 0.1),                                  // controller board pocket
    ];
    for (const y of LIGHT.leds) cuts.push(cyl(1.0, 0.55, -0.1, 24, 0, y), box(-0.55, 0.55, y - 0.95, y + 0.95, 0.6, armT + 0.1));
    m = m.subtract(unionM(cuts));
    m = m.add(cyl(0.6, 3.6, hubT, 48)).add(cyl(3.8, P.pinD / 2, hubT + 0.6, 48));
    return { kind: 'light', label: 'light needle', groups: { needle: m } };
  }
  // Fitment coupons (the original fitmenttester.py as one plate): five bore sizes around the chosen one, five pin sizes.
  function fitment(P) {
    const b = BEARINGS[P.bearing], out = [];
    for (let k = -2; k <= 2; k++) {
      const r = +(P.boreR + k * 0.04).toFixed(2), pd = +(P.pinD + k * 0.05).toFixed(2);
      const ring = cyl(b.w + 1, r + 3).subtract(cyl(b.w + 0.01, r, 1, 96)).subtract(cyl(1.02, 5.51, -0.01, 96));
      const pin = Manifold.extrude(disk(6, 64), 2).add(cyl(0.6, 3.6, 2, 48)).add(cyl(3.8, pd / 2, 2.6, 48));
      out.push({ label: `bore r ${r.toFixed(2)}`, m: ring, r: r + 3 }, { label: `pin Ø${pd.toFixed(2)}`, m: pin, r: 6 });
    }
    return out;
  }

  function toMesh(m) {
    const mesh = m.getMesh(), np = mesh.numProp, vp = mesh.vertProperties, nv = vp.length / np;
    const v = new Float32Array(nv * 3); for (let i = 0; i < nv; i++) { v[3 * i] = vp[np * i]; v[3 * i + 1] = vp[np * i + 1]; v[3 * i + 2] = vp[np * i + 2]; }
    return { v, t: Uint32Array.from(mesh.triVerts) };
  }
  function valid(m) { const st = m.status(); return st === undefined || st === null || st === 0 || st === 'NoError' || (st && st.value === 0); }
  return { compass, needle, lightNeedle, fitment, toMesh, valid, release, Manifold, CrossSection, liveCount: () => live.size, measure,
    arcText, mk, disk, ext, cyl, unionCS, unionM, art };
}

// ---------------------------------------------------------------- placing meshes + file writers
export function transformMesh(mesh, x, y, ang) {   // rotate about z then move; returns a new mesh
  const v = new Float32Array(mesh.v.length), s = Math.sin(ang), k = Math.cos(ang);
  for (let i = 0; i < v.length; i += 3) { const a = mesh.v[i], b = mesh.v[i + 1]; v[i] = a * k - b * s + x; v[i + 1] = a * s + b * k + y; v[i + 2] = mesh.v[i + 2]; }
  return { v, t: mesh.t };
}
export function meshToSTL(meshes, name = 'compass') {
  let nTri = 0; for (const m of meshes) nTri += m.t.length / 3;
  const buf = new ArrayBuffer(84 + nTri * 50), dv = new DataView(buf);
  new Uint8Array(buf, 0, 80).set(new TextEncoder().encode(('compass studio: ' + name).slice(0, 80)));
  dv.setUint32(80, nTri, true); let o = 84;
  for (const m of meshes) {
    const V = m.v, Tt = m.t;
    for (let i = 0; i < Tt.length; i += 3) {
      const a = 3 * Tt[i], b = 3 * Tt[i + 1], c = 3 * Tt[i + 2];
      const ux = V[b] - V[a], uy = V[b + 1] - V[a + 1], uz = V[b + 2] - V[a + 2], wx = V[c] - V[a], wy = V[c + 1] - V[a + 1], wz = V[c + 2] - V[a + 2];
      let nx = uy * wz - uz * wy, ny = uz * wx - ux * wz, nz = ux * wy - uy * wx; const l = Math.hypot(nx, ny, nz) || 1;
      dv.setFloat32(o, nx / l, true); dv.setFloat32(o + 4, ny / l, true); dv.setFloat32(o + 8, nz / l, true);
      for (const [k, p] of [[0, a], [1, b], [2, c]]) for (let j = 0; j < 3; j++) dv.setFloat32(o + 12 + 12 * k + 4 * j, V[p + j], true);
      dv.setUint16(o + 48, 0, true); o += 50;
    }
  }
  return buf;
}
// PrusaSlicer project 3MF: one object per part, one volume per filament (with its MMU slot), placed on the bed.
// objects: [{ name, x, y, ang, volumes: [{ name, extruder, mesh }] }]  (meshes in the part's own frame)
export function build3MF(objects, meta = {}) {
  const enc = new TextEncoder(), chunks = [];
  const head = '<?xml version="1.0" encoding="UTF-8"?>\n<model unit="millimeter" xml:lang="en-US" xmlns="http://schemas.microsoft.com/3dmanufacturing/core/2015/02" xmlns:slic3rpe="http://schemas.slic3r.org/3mf/2017/06">\n<metadata name="slic3rpe:Version3mf">1</metadata>\n<metadata name="Application">Compass Studio</metadata>\n<metadata name="Title">' + esc(meta.title || 'compasses') + '</metadata>\n<resources>\n';
  let config = '<?xml version="1.0" encoding="UTF-8"?>\n<config>\n';
  objects.forEach((ob, i) => {
    const id = i + 1; let base = 0, tri = 0; const ranges = [];
    chunks.push(`<object id="${id}" type="model">\n<mesh>\n<vertices>\n`);
    for (const vol of ob.volumes) { const V = vol.mesh.v; let s = ''; for (let k = 0; k < V.length; k += 3) s += `<vertex x="${+V[k].toFixed(4)}" y="${+V[k + 1].toFixed(4)}" z="${+V[k + 2].toFixed(4)}"/>\n`; chunks.push(s); }
    chunks.push('</vertices>\n<triangles>\n');
    for (const vol of ob.volumes) { const Tt = vol.mesh.t; let s = ''; for (let k = 0; k < Tt.length; k += 3) s += `<triangle v1="${Tt[k] + base}" v2="${Tt[k + 1] + base}" v3="${Tt[k + 2] + base}"/>\n`; chunks.push(s); ranges.push({ first: tri, last: tri + Tt.length / 3 - 1, vol }); tri += Tt.length / 3; base += vol.mesh.v.length / 3; }
    chunks.push('</triangles>\n</mesh>\n</object>\n');
    config += ` <object id="${id}" instances_count="1">\n  <metadata type="object" key="name" value="${esc(ob.name)}"/>\n  <metadata type="object" key="extruder" value="${ob.volumes[0].extruder}"/>\n`;
    for (const r of ranges) config += `  <volume firstid="${r.first}" lastid="${r.last}">\n   <metadata type="volume" key="name" value="${esc(r.vol.name)}"/>\n   <metadata type="volume" key="volume_type" value="ModelPart"/>\n   <metadata type="volume" key="matrix" value="1 0 0 0 0 1 0 0 0 0 1 0 0 0 0 1"/>\n   <metadata type="volume" key="extruder" value="${r.vol.extruder}"/>\n  </volume>\n`;
    config += ' </object>\n';
  });
  const build = '</resources>\n<build>\n' + objects.map((ob, i) => { const c = Math.cos(ob.ang || 0), s = Math.sin(ob.ang || 0); return `<item objectid="${i + 1}" transform="${c.toFixed(6)} ${s.toFixed(6)} 0 ${(-s).toFixed(6)} ${c.toFixed(6)} 0 0 0 1 ${ob.x.toFixed(3)} ${ob.y.toFixed(3)} 0" printable="1"/>\n`; }).join('') + '</build>\n</model>\n';
  config += '</config>\n';
  return [
    ['[Content_Types].xml', enc.encode('<?xml version="1.0" encoding="UTF-8"?>\n<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="model" ContentType="application/vnd.ms-package.3dmanufacturing-3dmodel+xml"/><Default Extension="config" ContentType="text/xml"/></Types>')],
    ['_rels/.rels', enc.encode('<?xml version="1.0" encoding="UTF-8"?>\n<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Target="/3D/3dmodel.model" Id="rel-1" Type="http://schemas.microsoft.com/3dmanufacturing/2013/01/3dmodel"/></Relationships>')],
    ['3D/3dmodel.model', concat([enc.encode(head), ...chunks.map(c => enc.encode(c)), enc.encode(build)])],
    ['Metadata/Slic3r_PE_model.config', enc.encode(config)],
  ];
}
const esc = (s) => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
function concat(arrs) { let n = 0; for (const a of arrs) n += a.length; const out = new Uint8Array(n); let o = 0; for (const a of arrs) { out.set(a, o); o += a.length; } return out; }
const CRC = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
function crc32(u8) { let c = 0xffffffff; for (let i = 0; i < u8.length; i++) c = CRC[(c ^ u8[i]) & 255] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; }
// Minimal zip. deflate(u8) -> Promise<Uint8Array> raw deflate, or null to store.
export async function zipFiles(files, deflate) {
  const enc = new TextEncoder(), local = [], central = []; let offset = 0;
  for (const [name, data] of files) {
    const nm = enc.encode(name), comp = deflate ? await deflate(data) : data, method = deflate ? 8 : 0, crc = crc32(data);
    const h = new DataView(new ArrayBuffer(30));
    h.setUint32(0, 0x04034b50, true); h.setUint16(4, 20, true); h.setUint16(8, method, true); h.setUint32(14, crc, true); h.setUint32(18, comp.length, true); h.setUint32(22, data.length, true); h.setUint16(26, nm.length, true);
    local.push(new Uint8Array(h.buffer), nm, comp);
    const c = new DataView(new ArrayBuffer(46));
    c.setUint32(0, 0x02014b50, true); c.setUint16(4, 20, true); c.setUint16(6, 20, true); c.setUint16(10, method, true); c.setUint32(16, crc, true); c.setUint32(20, comp.length, true); c.setUint32(24, data.length, true); c.setUint16(28, nm.length, true); c.setUint32(42, offset, true);
    central.push(new Uint8Array(c.buffer), nm);
    offset += 30 + nm.length + comp.length;
  }
  let cs = 0; for (const a of central) cs += a.length;
  const e = new DataView(new ArrayBuffer(22));
  e.setUint32(0, 0x06054b50, true); e.setUint16(8, files.length, true); e.setUint16(10, files.length, true); e.setUint32(12, cs, true); e.setUint32(16, offset, true);
  return concat([...local, ...central, new Uint8Array(e.buffer)]);
}
