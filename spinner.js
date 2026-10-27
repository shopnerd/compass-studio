// spinner.js — the Spin Compass: a handheld, light-up, talking version of the Moral Compass.
// A disc spins on a 608 bearing between two finger caps that stay still. The face is a wheel of 8 segments (the four
// values + Truth, Dare, Again, Choose). Inside: a XIAO ESP32-S3 (USB-C + LiPo charging), a LiPo, an IMU, a hall sensor
// that sees a magnet in the top cap once a turn, an I2S amp + speaker, and 12 WS2812B LEDs under white diffuser windows.
// Angles: degrees clockwise from north (the pointer). Units mm. Print: tray floor down, lid face down, caps flat.
//
// Every part size below is a typical datasheet / listing number. Measure the real parts before the first print.

export const SPIN_PARTS = {
  board:   { label: 'Seeed XIAO ESP32-S3', shape: 'rect', radial: 21, tang: 17.8, h: 3.6, g: 2.5, note: 'USB-C and LiPo charging built in' },
  battery: { label: 'LiPo 402025, 3.7 V ~180 mAh', shape: 'rect', radial: 20, tang: 25, h: 4.2, g: 3.8, note: 'lies sideways; with protection board, lead cut short' },
  amp:     { label: 'MAX98357A I2S amp board', shape: 'rect', radial: 18, tang: 17, h: 3, g: 1.2 },
  speaker: { label: 'Speaker Ø20 × 4.5 mm, 8 Ω 1 W', shape: 'circle', d: 20, h: 4.5, g: 3 },
  imu:     { label: 'LSM6DS3TR-C 6-axis IMU board', shape: 'rect', radial: 12, tang: 10, h: 2, g: 0.3 },
  hall:    { label: 'US5881 hall switch (TO-92S, laid flat)', shape: 'rect', radial: 3, tang: 4.1, h: 1.5, g: 0.2 },
  led:     { label: 'WS2812B on Ø10 mm PCB', shape: 'circle', d: 10, h: 3, g: 0.4 },
  bearing: { label: '608ZZ bearing 8 × 22 × 7', od: 22, bore: 8, w: 7, g: 12 },
  magnet:  { label: 'Neodymium magnet 3 × 1.5 mm, south pole down', d: 3.17, h: 1.59 },
  bb:      { label: 'Steel BB 4.5 mm (balance weight)', d: 4.5, g: 0.37 },
  screw:   { label: 'M2 × 6 flat head machine screw' },
};
// Lid screws go into brass heat-set inserts in the tray bosses. ruthex RX-M2x4 numbers (the same as Box Studio's M2):
// printed hole 3.2, insert 4.0 long, knurl 3.6, min wall 1.3; the lid gets a 2.4 clearance hole and a 90° countersink
// for the 4.0 flat head. Screw M2 × 6: 2.4 lid + 4.0 insert, tip 0.4 short of the insert's end.
// Cap joint through the 608's 7 mm bore: top peg + gap + bottom peg = bore length; the screw head sits cb below the
// top cap's face, so an M2 × 6 reaches screwLen - (topPeg + gap + 0.5 + cb + capT - capT) into the insert.
export function capJoint(b = { w: 7 }, capT = 3) {
  const topPeg = 1.2, gap = 0.4, botPeg = b.w - topPeg - gap, cb = 2.0, cs = (INSERT.head + 0.2 - INSERT.clear) / 2;
  const headTop = capT - cb;                                   // in top-cap coordinates (face at capT, shoulder below 0)
  const tip = headTop - INSERT.screwLen;                       // screw tip, top-cap coordinates
  const insertTop = -0.5 - topPeg - gap;                       // bottom peg's tip, top-cap coordinates
  return { topPeg, gap, botPeg, cb, cs, engage: insertTop - tip, spare: tip - (insertTop - INSERT.len), wall: (7.95 - INSERT.knurl) / 2 };
}
// The button that covers the cap screw: plug in the counterbore (3 crush ribs, 0.12 mm interference), a 45° collar in
// the cone at the cap's face, a dome 1 mm proud. The plug stops 0.1 mm above the screw head.
export const BUTTON = { plugR: 2.2, ribR: 2.32, plug: 1.1, collar: 0.8, domeR: 3.0, domeH: 1.0 };
export const INSERT = { name: 'M2 × 4 brass heat-set insert', hole: 3.2, len: 4.0, knurl: 3.6, wall: 1.6, clear: 2.4, head: 4.0, screwLen: 6, chamfer: 0.4,
  get bossR() { return this.hole / 2 + this.wall; }, get depth() { return this.len + 1; },
};
// Choices the panel offers. Each entry overrides the matching SPIN_PARTS entry.
export const CHOICES = {
  // sizes from the listings checked 2026-10-27 (+0.5 mm on the long side where the protection board may add length)
  battery: {
    '302025': { label: 'LiPo 150 mAh, 3.8 × 19.75 × 26 (Adafruit 1317)', radial: 19.8, tang: 26.1, h: 3.8, g: 3.5, mAh: 150 },
    '402025': { label: 'LiPo 402025 140 mAh, 4 × 20 × 25', radial: 20, tang: 26, h: 4.0, g: 3.6, mAh: 140 },
    '502025': { label: 'LiPo 502025 200 mAh, 5 × 20 × 27', radial: 20, tang: 27.5, h: 5.0, g: 4.5, mAh: 200 },
    '402030': { label: 'LiPo 250 mAh, 5 × 20 × 30', radial: 20, tang: 30.5, h: 5.0, g: 5.2, mAh: 250 },
  },
  speaker: {
    '20': { label: 'Speaker Ø20 × 3.7 mm, 8 Ω 1 W', d: 20, h: 3.7, g: 2.5 },
    '15': { label: 'Speaker Ø15 × 3.7 mm, 8 Ω 1 W', d: 15, h: 3.7, g: 1.6 },
    none: null,
  },
  imu: {   // the firmware picks the matching Adafruit_LSM6DS class
    dsox:   { label: 'Adafruit LSM6DSOX 6-DoF (4438)', radial: 17.8, tang: 25.6, h: 4.6, g: 1.5, cls: 'Adafruit_LSM6DSOX' },
    pololu: { label: 'Pololu LSM6DSO carrier (2798)', radial: 13, tang: 23, h: 3, g: 0.9, cls: 'Adafruit_LSM6DSOX' },
    ism330: { label: 'SparkFun Micro ISM330DHCX (SEN-20176)', radial: 7.6, tang: 19.1, h: 2, g: 0.5, cls: 'Adafruit_ISM330DHCX' },
  },
  leds: { '8': [8, 0], '12': [8, 4], '16': [8, 8] },
  disc: { '82': 41, '86': 43, '90': 45 },
};
export const SPIN_DEFAULTS = {
  values: ['Integrity', 'Honor', 'Excellence', 'Service'],
  extras: ['Truth', 'Dare', 'Again', 'Choose'],
  bottom: ['', ''],                // optional text on the bottom: line 1, line 2 (white inlay, printed on the bed side)
  order: 'mix',                    // mix: value, game, value, game…   values: the four values together
  name: 'Name Example',
  battery: '302025', speaker: '20', leds: '12', disc: '86', imu: 'dsox',
  R: 41, H: 13, floor: 1.2, lid: 2.4, wall: 1.6, wellR: 14.6, hubR: 16.2, wellDepth: 3,   // hub ring: bore 11 -> 16.2, 1.6 mm wall round the finger wells
  boreR: 11.0, pegD: 7.95,
  layout: 'auto',                  // 'auto' = best-balanced arrangement that fits, or { part: angle }
  ledsOuter: 8, ledsInner: 4, rOuterLed: 32.5, rInnerLed: 21.8,
  slots: { body: 1, white: 2, gold: 3, caps: 1 },
  printer: 'mk4s', gap: 4, margin: 3, layer: 0.2,
};

const P2 = (r, a) => [r * Math.sin(a * Math.PI / 180), r * Math.cos(a * Math.PI / 180)];
export function resolveChoices(S) {
  const R = CHOICES.disc[S.disc] || S.R, [o, i] = CHOICES.leds[S.leds] || [S.ledsOuter, S.ledsInner];
  return { ...S, R, ledsOuter: o, ledsInner: i, rOuterLed: R - 8.5 };
}
function partTable(S) {
  const t = { ...SPIN_PARTS, battery: { ...SPIN_PARTS.battery, ...(CHOICES.battery[S.battery] || {}), shape: 'rect' }, imu: { ...SPIN_PARTS.imu, ...(CHOICES.imu[S.imu] || CHOICES.imu.dsox), shape: 'rect' } };
  const spk = CHOICES.speaker[S.speaker];
  if (spk === null) { delete t.speaker; delete t.amp; } else if (spk) t.speaker = { ...SPIN_PARTS.speaker, ...spk, shape: 'circle' };
  return t;
}
export function segmentsOf(S) {
  const v = S.values.map(s => (s || '').trim()), e = S.extras;
  const list = S.order === 'values' ? [...v, ...e] : [v[0], e[0], v[1], e[1], v[2], e[2], v[3], e[3]];
  const kind = (l) => ({ truth: 'truth', dare: 'dare', again: 'again', choose: 'choose' }[l.toLowerCase()] || 'value');
  return list.map((label, i) => ({ label, kind: kind(label), a0: i * 45, a1: (i + 1) * 45, centre: i * 45 + 22.5 }));   // segment i runs clockwise from i·45°, like the firmware + game
}
export function ledsOf(S) {
  const out = [];
  for (let i = 0; i < S.ledsOuter; i++) out.push({ angle: i * (360 / S.ledsOuter), r: S.rOuterLed, ring: 'outer' });     // on the segment boundaries
  for (let i = 0; i < S.ledsInner; i++) out.push({ angle: i * (360 / S.ledsInner), r: S.rInnerLed, ring: 'inner' });
  return out;
}

// ---------------------------------------------------------------- layout, clashes, balance (no geometry kernel)
export function autoLayout(S) {
  const T = partTable(S), keys = ['battery', 'speaker', 'board', 'amp', 'imu'].filter(k => T[k]), slots = [0, 45, 90, 135, 180, 225, 270, 315];
  const cands = [];
  const rec = (i, used, lay) => {
    if (i === keys.length) {
      const L = spinLayout({ ...S, layout: lay }, true);
      if (!L.warn.length) cands.push({ raw: L.balance.raw, lay: { ...lay } });
      return;
    }
    for (const a of slots) if (!used.has(a)) { used.add(a); lay[keys[i]] = a; rec(i + 1, used, lay); used.delete(a); }
  };
  rec(0, new Set(), {});
  cands.sort((a, b) => a.raw - b.raw);
  let best = null;
  for (const c of cands.slice(0, 60)) {
    const L = spinLayout({ ...S, layout: c.lay }, false, true);
    if (L.warn.length) continue;
    const score = L.balance.residual + 0.02 * L.balance.n;      // fewer BBs breaks ties
    if (!best || score < best.score - 1e-6) best = { score, lay: c.lay };
  }
  return best ? best.lay : (cands[0] ? cands[0].lay : Object.fromEntries(keys.map((k, n) => [k, n * 72])));
}
let autoCache = null;
export function spinLayout(S, quick = false, coarse = false) {
  S = resolveChoices(S);
  const rIn = S.hubR ?? S.wellR + 1.6, rOut = S.R - S.wall, warn = [], T = partTable(S);
  if (S.layout === 'auto' || !S.layout) { const k = `${S.R}|${S.wellR}|${S.hubR}|${S.wall}|${S.battery}|${S.speaker}|${S.leds}|${S.imu}`; if (!autoCache || autoCache.k !== k) autoCache = { k, lay: autoLayout({ ...S, layout: {} }) }; S = { ...S, layout: autoCache.lay }; }
  const parts = [];
  for (const [key, ang] of Object.entries(S.layout)) {
    const p = T[key]; if (!p) continue; let r;
    const half = p.shape === 'circle' ? p.d / 2 : p.tang / 2, rad = p.shape === 'circle' ? p.d / 2 : p.radial / 2;
    const rMax = Math.sqrt((rOut - 0.6) ** 2 - half * half) - rad, rMin = rIn + 0.6 + rad;
    r = key === 'board' ? rMax : Math.max(rMin, Math.min(rMax, (rMin + rMax) / 2));   // USB-C end of the board against the rim
    parts.push({ key, ...p, angle: ang, r });
  }
  parts.push({ key: 'hall', ...SPIN_PARTS.hall, angle: 0, r: (S.boreR + rIn) / 2, inHub: true });   // mid-ring, ~0.9 mm wall each side
  // footprint as a polygon (rect) or circle, in body frame
  const poly = (p) => {
    if (p.shape === 'circle') return null;
    const a = p.angle * Math.PI / 180, ux = [Math.sin(a), Math.cos(a)], tx = [Math.cos(a), -Math.sin(a)];
    const c = P2(p.r, p.angle), hr = p.radial / 2, ht = p.tang / 2;
    return [[-hr, -ht], [hr, -ht], [hr, ht], [-hr, ht]].map(([u, t]) => [c[0] + ux[0] * u + tx[0] * t, c[1] + ux[1] * u + tx[1] * t]);
  };
  const circ = (p) => ({ c: P2(p.r, p.angle), r: p.d / 2 });
  // sample each footprint as points for simple overlap / bounds tests
  const samples = (p) => {
    if (p.shape === 'circle') { const { c, r } = circ(p); const pts = []; for (let k = 0; k < 24; k++) pts.push([c[0] + r * Math.cos(k * Math.PI / 12), c[1] + r * Math.sin(k * Math.PI / 12)]); pts.push(c); return pts; }
    const q = poly(p), pts = [...q]; for (let i = 0; i < 4; i++) for (let k = 1; k < 6; k++) { const A = q[i], B = q[(i + 1) % 4]; pts.push([A[0] + (B[0] - A[0]) * k / 6, A[1] + (B[1] - A[1]) * k / 6]); }
    pts.push(P2(p.r, p.angle)); return pts;
  };
  const inside = (p, pt) => {
    if (p.shape === 'circle') { const { c, r } = circ(p); return Math.hypot(pt[0] - c[0], pt[1] - c[1]) < r - 0.05; }
    const q = poly(p); let s = 0; for (let i = 0; i < 4; i++) { const A = q[i], B = q[(i + 1) % 4]; const cr = (B[0] - A[0]) * (pt[1] - A[1]) - (B[1] - A[1]) * (pt[0] - A[0]); if (cr > 0.05) s |= 1; if (cr < -0.05) s |= 2; } return s !== 3;
  };
  const cavityParts = parts.filter(p => !p.inHub);
  const headroom = (S.H - S.lid) - SPIN_PARTS.led.h - 0.3 - S.floor;
  for (const p of cavityParts) if (p.h + (p.key === 'board' ? 0 : 0) > headroom + 1e-6) warn.push(`${p.label} is ${p.h} mm tall; only ${headroom.toFixed(1)} mm fits under the LEDs`);
  for (const l of ledsOf(S)) { const e = SPIN_PARTS.led.d / 2 + 0.3; if (l.r - e < rIn - 0.01 || l.r + e > rOut - 1.35) warn.push(`LED at ${l.angle}° (r ${l.r}) hits the ${l.r - e < rIn ? 'bearing hub' : 'lid lip'}`); }
  for (const p of cavityParts) {
    const out = samples(p).filter(pt => { const r = Math.hypot(...pt); return r < rIn - 0.05 || r > rOut + 0.05; });
    if (out.length) warn.push(`${p.label} does not fit between the hub and the rim at ${p.angle}°`);
  }
  for (let i = 0; i < cavityParts.length; i++) for (let j = i + 1; j < cavityParts.length; j++) {
    const a = cavityParts[i], b = cavityParts[j];
    if (samples(a).some(pt => inside(b, pt)) || samples(b).some(pt => inside(a, pt))) warn.push(`${a.label} and ${b.label} overlap; try a bigger disc, a smaller motion sensor, or a smaller battery`);
  }
  // balance: everything off-centre, then the best coin stack to cancel it
  const leds = ledsOf(S);
  let mx = 0, my = 0;
  for (const p of cavityParts) { const [x, y] = P2(p.r, p.angle); mx += p.g * x; my += p.g * y; }
  for (const l of leds) { const [x, y] = P2(l.r, l.angle); mx += SPIN_PARTS.led.g * x; my += SPIN_PARTS.led.g * y; }
  const raw = Math.hypot(mx, my);
  if (quick) return { warn, balance: { raw } };
  // counterweight: a row of steel BBs in a slot, as many as cancel the most (0.37 g each, so it lands within a few g·mm)
  const bb = SPIN_PARTS.bb, pitch = bb.d + 0.15;
  let best = { n: 0, residual: raw, angle: null, r: null };
  const aStep = coarse ? 10 : 3, rStep = coarse ? 2 : 1;
  const slotOf = (b) => b.radialRow ? { shape: 'rect', radial: b.n * pitch + 1.8, tang: bb.d + 1.8, angle: b.angle, r: b.r } : { shape: 'rect', radial: bb.d + 1.8, tang: b.n * pitch + 1.8, angle: b.angle, r: b.r };
  const findSlot = (fx, fy, blocked) => {
    let out = null, bestRes = Math.hypot(fx, fy);
    for (const radialRow of [false, true]) for (let ang = 0; ang < 360; ang += aStep) for (let r = rIn + 4; r <= rOut - 4; r += rStep) {
      const [ux, uy] = P2(1, ang);
      for (let n = 1; n <= 14; n++) {
        const slot = slotOf({ n, angle: ang, r, radialRow });
        if (samples(slot).some(pt => { const q = Math.hypot(...pt); return q < rIn + 0.4 || q > rOut - 0.4; })) break;
        if (blocked.some(p => samples(slot).some(pt => inside(p, pt)) || samples(p).some(pt => inside(slot, pt)))) break;
        const res = Math.hypot(fx + n * bb.g * r * ux, fy + n * bb.g * r * uy);
        if (res < bestRes - 0.05) { bestRes = res; out = { n, angle: ang, r, radialRow, fx: fx + n * bb.g * r * ux, fy: fy + n * bb.g * r * uy }; }
      }
    }
    return out;
  };
  const slots = [];
  if (raw > 2) {
    const s1 = findSlot(mx, my, cavityParts);
    if (s1) { slots.push(s1); if (Math.hypot(s1.fx, s1.fy) > 4) { const s2 = findSlot(s1.fx, s1.fy, [...cavityParts, slotOf(s1)]); if (s2) slots.push(s2); } }
  }
  if (slots.length) { const last = slots[slots.length - 1]; best = { n: slots.reduce((a, s) => a + s.n, 0), residual: Math.hypot(last.fx, last.fy), angle: slots[0].angle, r: slots[0].r, radialRow: slots[0].radialRow, slots: slots.map(({ n, angle, r, radialRow }) => ({ n, angle, r, radialRow })) }; }
  // screw bosses: three, roughly 120° apart, clear of parts, at segment centres so they miss the LED windows
  // screw bosses: three, as evenly spread as possible, clear of parts and pennies, away from the LED windows on the boundaries
  const rs = rOut - 2.8, free = [];
  for (let a = 0; a < 360; a += 2.5) {
    const offB = Math.abs((a % 45) - 22.5);                                   // distance to the nearest segment centre
    if (offB > 11) continue;
    const bp = { shape: 'circle', d: 2 * INSERT.bossR + 0.2, angle: a, r: rs };
    if (cavityParts.some(p => samples(bp).some(pt => inside(p, pt)) || samples(p).some(pt => inside(bp, pt)))) continue;
    if (best.n && best.slots.some(b => { const sl = slotOf(b); return samples(bp).some(pt => inside(sl, pt)) || samples(sl).some(pt => inside(bp, pt)); })) continue;
    { const q = P2(rs, a); if (leds.some(l => { const c = P2(l.r, l.angle); return Math.hypot(c[0] - q[0], c[1] - q[1]) < SPIN_PARTS.led.d / 2 + 0.3 + INSERT.bossR + 0.4; })) continue; }   // boss vs LED boards under the lid
    free.push(a);
  }
  let screws = [], bestGap = 0;
  for (const a of free) for (const b2 of free) for (const c of free) {
    if (!(a < b2 && b2 < c)) continue;
    const g = Math.min(b2 - a, c - b2, 360 - c + a); if (g > bestGap) { bestGap = g; screws = [a, b2, c]; }
  }
  if (bestGap < 60) screws = [];
  if (screws.length < 3) warn.push('No room for three lid screws; move a part');
  const mass = cavityParts.reduce((s, p) => s + p.g, 0) + leds.length * SPIN_PARTS.led.g + best.n * bb.g;
  if (best.residual > 8) warn.push(`Still ${best.residual.toFixed(0)} g·mm off centre after the BBs; it may wobble at full speed. A lighter battery or keeping the speaker balances better.`);
  return { parts, leds, segments: segmentsOf(S), rIn, rOut, warn, balance: { raw, ...best, mass }, screws, polyOf: poly, layout: S.layout, S, bbSlots: best.n ? best.slots.map(slotOf) : [] };
}

// ---------------------------------------------------------------- bed: whole kits (tray + lid + two caps + dome) per bed
const PR = { mk4s: [250, 210, 60, 20, 'Prusa MK4S + MMU3'], core1: [250, 220, 60, 20, 'Prusa Core One + MMU3'], xl: [360, 360, 45, 15, 'Prusa XL, 5 heads'] };
export function kitCircles(S) { const cr = S.wellR - 0.6, R = resolveChoices(S).R; return [['tray', R], ['lid', R], ['capTop', cr], ['capBot', cr], ['dome', cr - 1], ['button', BUTTON.domeR + 0.4]]; }
export function packKits(S) {
  const [bw, bh, tw, th, label] = PR[S.printer] || PR.mk4s, g = S.gap, m = S.margin;
  const tower = [bw - m - tw, bh - m - th, tw, th];
  const tryK = (k) => {
    const items = []; const list = [];
    for (let i = 0; i < k; i++) for (const [part, r] of kitCircles(S)) list.push({ part, r, kit: i });
    list.sort((a, b) => b.r - a.r);
    for (const it of list) {
      let done = false;
      for (let y = m + it.r; y <= bh - m - it.r && !done; y += 1) for (let x = m + it.r; x <= bw - m - it.r && !done; x += 1) {
        const cx = Math.max(tower[0], Math.min(x, tower[0] + tw)), cy = Math.max(tower[1], Math.min(y, tower[1] + th));
        if (Math.hypot(x - cx, y - cy) < it.r + g) continue;
        if (items.some(o => Math.hypot(o.x - x, o.y - y) < o.r + it.r + g)) continue;
        items.push({ ...it, x, y }); done = true;
      }
      if (!done) return null;
    }
    return items;
  };
  let best = { k: 0, items: [] };
  for (let k = 1; k <= 12; k++) { const items = tryK(k); if (!items) break; best = { k, items }; }
  return { ...best, tower, bed: [bw, bh], printer: label };
}

// ---------------------------------------------------------------- geometry (needs the compass kit from core.js)
export function buildSpinner(K, S0) {
  let S = { ...SPIN_DEFAULTS, ...S0, layout: (S0 && S0.layout) || SPIN_DEFAULTS.layout, slots: { ...SPIN_DEFAULTS.slots, ...((S0 || {}).slots || {}) } };
  const { Manifold, CrossSection, mk, disk, ext, cyl, unionCS, unionM, arcText } = K;
  const L = spinLayout(S); S = L.S; const { R, H, floor, lid, wall, wellR, wellDepth } = S, rOut = L.rOut, warn = [...L.warn];
  const zLid = H - lid, b = SPIN_PARTS.bearing, zB0 = (H - b.w) / 2;
  const at = (r, a) => P2(r, a);
  const rectCS = (p, grow = 0) => mk([L.polyOf({ ...p, radial: p.radial + 2 * grow, tang: p.tang + 2 * grow })], 'NonZero');

  // ---- tray: floor, rim, hub ring holding the bearing, guides around each part, USB-C slot, speaker grille, penny cup, screw bosses
  let tray = cyl(zLid, R, 0, 192);
  tray = tray.subtract(ext(disk(rOut, 160).subtract(disk(L.rIn, 96)), zLid, floor));                        // cavity
  tray = tray.subtract(cyl(zB0 + 0.01, wellR, -0.01, 96));                                                  // bottom finger well
  tray = tray.subtract(cyl(b.w + 0.02, S.boreR, zB0 - 0.01, 96));                                             // bearing pocket
  tray = tray.subtract(cyl(zLid - (zB0 + b.w) + 0.02, wellR, zB0 + b.w, 96));                                // top of the top well
  const guides = [];
  for (const p of L.parts) {
    if (p.inHub || p.key === 'speaker') continue;
    if (p.shape === 'rect') guides.push(ext(rectCS(p, 1.4).subtract(rectCS(p, 0.25)).intersect(disk(rOut, 160).subtract(disk(L.rIn, 96))), 1.6, floor));
  }
  const spk = L.parts.find(p => p.key === 'speaker');
  if (spk) {
    const c = at(spk.r, spk.angle);
    guides.push(ext(disk(spk.d / 2 + 1.4, 64).subtract(disk(spk.d / 2 + 0.25, 64)).translate(c).intersect(disk(rOut, 160).subtract(disk(L.rIn, 96))), 2.2, floor));
    const holes = []; for (let i = -4; i <= 4; i++) for (let j = -4; j <= 4; j++) { const x = i * 2.6 + (j % 2 ? 1.3 : 0), y = j * 2.25; if (Math.hypot(x, y) < spk.d / 2 - 3) holes.push(CrossSection.circle(0.8, 16).translate([c[0] + x, c[1] + y])); }
    tray = tray.subtract(ext(unionCS(holes), floor + 0.2, -0.1));
  }
  for (const sl of L.bbSlots) {   // walled slots for the BBs; a drop of CA glue holds them
    guides.push(ext(rectCS(sl, 0).subtract(rectCS({ ...sl, radial: sl.radial - 1.8, tang: sl.tang - 1.8 }, 0)), 4.0, floor));
  }
  const rs = rOut - 2.8;
  for (const a of L.screws) guides.push(cyl(zLid - floor, INSERT.bossR, floor, 40, ...at(rs, a)));
  tray = tray.add(unionM(guides));
  for (const a of L.screws) {   // heat-set insert holes: Ø3.2, insert length + 1 deep for the melt, 0.4 lead-in chamfer
    tray = tray.subtract(cyl(INSERT.depth + 0.01, INSERT.hole / 2, zLid - INSERT.depth, 32, ...at(rs, a)));
    tray = tray.subtract(Manifold.cylinder(INSERT.chamfer + 0.01, INSERT.hole / 2, INSERT.hole / 2 + INSERT.chamfer, 32).translate([...at(rs, a), zLid - INSERT.chamfer]));
  }
  // USB-C through the rim at the board, with a recess for the plug's overmould
  const brd = L.parts.find(p => p.key === 'board');
  if (brd) {
    const zU = floor + 1.0 + 1.6, a = brd.angle;
    const slot = Manifold.cube([9.6, wall + 3, 4.0], true).translate([0, R - wall / 2, zU]).rotate([0, 0, -a]);
    const recess = Manifold.cube([13, 2.2, 7.2], true).translate([0, R, zU]).rotate([0, 0, -a]);
    tray = tray.subtract(slot).subtract(recess);
  }
  // hall sensor pocket in the hub ring, under the well floor, with a wire slot into the cavity
  const hall = L.parts.find(p => p.key === 'hall'), hc = at(hall.r, hall.angle);
  tray = tray.subtract(Manifold.cube([hall.tang + 0.5, hall.radial + 0.4, 1.8], true).translate([0, hall.r, zB0 + b.w - 0.6 - 0.9]).rotate([0, 0, -hall.angle]));
  tray = tray.subtract(Manifold.cube([1.6, 6, 1.4], true).translate([0, hall.r + 2.6, zB0 + b.w - 0.6 - 0.9]).rotate([0, 0, -hall.angle]));

  // ---- lid: the wheel face. Printed face down; white letters, dividers and LED diffusers, gold alternate segments, gold north arrow
  const segs = L.segments, rFaceIn = wellR + 1.2, rFaceOut = R - 1.6;
  const ledWin = unionCS(L.leds.map(l => CrossSection.circle(3, 32).translate(at(l.r, l.angle))));
  const dividers = unionCS(segs.map((s, i) => { const a = (s.centre + 22.5) * Math.PI / 180; const w = 0.5; return mk([[[w * Math.cos(a) + rFaceIn * Math.sin(a), -w * Math.sin(a) + rFaceIn * Math.cos(a)], [w * Math.cos(a) + rFaceOut * Math.sin(a), -w * Math.sin(a) + rFaceOut * Math.cos(a)], [-w * Math.cos(a) + rFaceOut * Math.sin(a), w * Math.sin(a) + rFaceOut * Math.cos(a)], [-w * Math.cos(a) + rFaceIn * Math.sin(a), w * Math.sin(a) + rFaceIn * Math.cos(a)]]], 'NonZero'); }))
    .subtract(ledWin.offset(0.8, 'Round', 2, 16));
  const sector = (a0, a1, r0, r1) => { const pts = []; for (let a = a0; a <= a1 + 1e-6; a += 2) pts.push(at(r1, a)); for (let a = a1; a >= a0 - 1e-6; a -= 2) pts.push(at(r0, a)); return mk([pts], 'NonZero'); };
  const textR = (S.rInnerLed + S.rOuterLed) / 2 + 0.5;
  const labels = []; const labelSizes = [];
  segs.forEach(s => {
    // values as typed, game words in capitals, so the two kinds read differently
    const t = arcText(s.kind === 'value' ? s.label : s.label.toUpperCase(), textR, 90 - s.centre, 4.6, 39, 2.6, 0.3);
    labels.push(t.cs); labelSizes.push(t.size);
    if (!t.fits) warn.push(`"${s.label}" is too long for its segment; try a shorter word`); else if (t.size < 3) warn.push(`"${s.label}" prints small (${t.size.toFixed(1)} mm)`);
  });
  const labelCS = unionCS(labels);
  const arrow = mk([[at(R - 0.7, 0), at(R - 4.6, -5.2), at(R - 4.6, 5.2)]], 'NonZero');
  let goldCS = unionCS(segs.filter((_, i) => i % 2).map(s => sector(s.centre - 22.5, s.centre + 22.5, rFaceIn, rFaceOut)));
  goldCS = goldCS.subtract(dividers.offset(0.3, 'Round', 2, 8)).subtract(ledWin.offset(1.0, 'Round', 2, 16)).subtract(labelCS.offset(0.6, 'Round', 2, 8));
  goldCS = unionCS([goldCS, arrow]);
  const whiteTop = unionCS([dividers, labelCS]).subtract(arrow.offset(0.6, 'Round', 2, 8));
  const screwCS = unionCS(L.screws.map(a => CrossSection.circle(INSERT.clear / 2, 24).translate(at(rs, a))));
  let lidM = ext(disk(R, 192).subtract(disk(wellR + 0.3, 96)), lid, zLid);
  // LED pockets underneath, diffuser windows above them (white, filled flush)
  const ledPocket = ext(unionCS(L.leds.map(l => CrossSection.circle(5.3, 40).translate(at(l.r, l.angle)))), 1.6, zLid - 0.01);
  const ledDiff = ext(ledWin, lid - 1.6 + 0.01, zLid + 1.6 - 0.01);
  const whiteM = unionM([ext(whiteTop, 1.0, H - 1.0), ledDiff]);
  const goldM = ext(goldCS, 0.6, H - 0.6);
  const csH = (INSERT.head + 0.2 - INSERT.clear) / 2;   // 90°: the cone drops as much as it narrows
  const csinks = unionM(L.screws.map(a => Manifold.cylinder(csH + 0.01, INSERT.clear / 2, INSERT.head / 2 + 0.1, 32).translate([...at(rs, a), H - csH])));
  lidM = lidM.subtract(ledPocket).subtract(ext(screwCS, lid + 0.2, zLid - 0.1)).subtract(csinks);
  // the lid's alignment lip into the cavity
  lidM = lidM.add(ext(disk(rOut - 0.15, 160).subtract(disk(rOut - 1.3, 160)).subtract(screwCS.offset(2.2, 'Round', 2, 16)), 1.5, zLid - 1.5));
  const white = whiteM.subtract(ext(screwCS.offset(0.4, 'Round', 2, 8), lid + 0.2, zLid - 0.1));
  const gold = goldM.subtract(whiteM).subtract(ext(screwCS.offset(0.6, 'Round', 2, 8), lid + 0.2, zLid - 0.1)).subtract(csinks);
  lidM = lidM.subtract(whiteM).subtract(goldM);
  const whiteOut = white.subtract(csinks);

  // ---- caps: top cap with a white pointer and a magnet pocket, bottom cap domed so it spins on a table
  const capR = wellR - 0.6, capT = 3;
  const peg = (h) => cyl(0.5, 6, 0, 48).add(cyl(h, S.pegD / 2, 0.5, 48));
  const zTopCap = zB0 + b.w + 0.5;
  // The caps clamp the bearing's inner ring between their shoulders: an M2 × 6 flat-head screw goes down through the
  // top cap into a heat-set insert in the bottom cap's peg. The pegs stop CAP.gap apart, so the screw pulls the shoulders
  // onto the race, not peg onto peg. Top: short centring peg, counterbore + countersink so the head sits below the face.
  const CAPJ = capJoint(b, capT);
  let capTop = cyl(capT, capR, 0, 96).add(peg(CAPJ.topPeg).rotate([180, 0, 0]));
  capTop = capTop.subtract(cyl(capT + CAPJ.topPeg + 1, INSERT.clear / 2, -CAPJ.topPeg - 0.6, 32));                     // screw clearance
  capTop = capTop.subtract(cyl(CAPJ.cb + 0.01, INSERT.head / 2 + 0.2, capT - CAPJ.cb, 40));                           // counterbore
  capTop = capTop.subtract(Manifold.cylinder(CAPJ.cs + 0.01, INSERT.clear / 2, INSERT.head / 2 + 0.1, 32).translate([0, 0, capT - CAPJ.cb - CAPJ.cs]));   // 90° countersink
  // seat for the press-in button: 45° cone at the face (Ø6.1 → Ø4.5, 0.8 deep) over the counterbore, and a fingernail
  // notch opposite the pointer for prying it out to reach the screw
  const BTN = BUTTON;
  capTop = capTop.subtract(Manifold.cylinder(BTN.collar + 0.01, BTN.plugR + 0.05, BTN.domeR + 0.05, 48).translate([0, 0, capT - BTN.collar]));
  capTop = capTop.subtract(Manifold.cube([0.9, BTN.domeR + 0.5 - BTN.plugR, 0.6]).translate([-0.45, -(BTN.domeR + 0.5), capT - 0.6]));
  capTop = capTop.subtract(cyl(1.7, 1.66, -0.01, 24, ...at(hall.r, 0)));                                           // magnet pocket over the hall sensor
  const ptr = mk([[at(capR - 0.6, 0), at(capR - 7, -3.2), at(capR - 7, 3.2)]], 'NonZero');
  const capPtr = ext(ptr, 0.6, capT - 0.6);
  capTop = capTop.subtract(capPtr);
  // bottom cap: flat, peg up (prints without supports). The dome is a separate button glued on for table spins.
  let capBot = cyl(capT - 1, capR, 0, 96).add(peg(CAPJ.botPeg).translate([0, 0, capT - 1]));
  { const top = capT - 1 + 0.5 + CAPJ.botPeg;   // heat-set insert in the peg's tip, flush
    capBot = capBot.subtract(cyl(INSERT.depth + 0.01, INSERT.hole / 2, top - INSERT.depth, 32));
    capBot = capBot.subtract(Manifold.cylinder(INSERT.chamfer + 0.01, INSERT.hole / 2, INSERT.hole / 2 + INSERT.chamfer, 32).translate([0, 0, top - INSERT.chamfer])); }
  const dome = Manifold.sphere(capR * 1.3, 128).translate([0, 0, 2.4 - capR * 1.3]).intersect(cyl(2.4, capR - 1, 0, 96));
  // press-in button over the cap screw, as printed (plug down, dome up, no supports): ribbed plug, 45° collar, low dome
  const btn = (() => {
    const B = BUTTON, zc = B.plug, zd = B.plug + B.collar;
    let m = cyl(zc + 0.01, B.plugR - 0.12, 0, 40);
    for (let i = 0; i < 3; i++) m = m.add(Manifold.cube([0.5, B.ribR - (B.plugR - 0.3), zc - 0.25]).translate([-0.25, B.plugR - 0.3, 0.25]).rotate([0, 0, i * 120]));   // crush ribs
    m = m.add(Manifold.cylinder(B.collar, B.plugR, B.domeR, 48).translate([0, 0, zc]));
    const rs = (B.domeR ** 2 + B.domeH ** 2) / (2 * B.domeH);   // sphere through the rim and the apex
    m = m.add(Manifold.sphere(rs, 96).translate([0, 0, zd + B.domeH - rs]).intersect(cyl(B.domeH, B.domeR, zd, 64)));
    return m;
  })();

  // ---- text on the bottom: white letters inlaid 0.6 mm into the tray's floor from the bed side (the first three layers).
  // Built as seen from below, then mirrored into model space. The lines sit on opposite sides with the speaker grille
  // in the gap between them; each reads upright when you turn the disc so that line is on top.
  let trayWhite = null;
  const lines = (S.bottom || []).map(t => (t || '').trim()).slice(0, 2);
  if (lines.some(Boolean)) {
    const spkB = L.parts.find(p => p.key === 'speaker'), g = spkB ? 90 + spkB.angle : 0;   // grille, in the from-below view
    const rB = (wellR + R) / 2 - 0.5, sizeB = Math.min(5.2, (R - wellR) / 4.6), depthB = 0.6;
    const t1 = arcText(lines[0], rB - sizeB / 2, g + 90, sizeB, 140, 2.6, 0.4), t2 = arcText(lines[1], rB + sizeB / 2, g - 90, sizeB, 140, 2.6, 0.4, true);
    [[t1, lines[0]], [t2, lines[1]]].forEach(([t, txt], i) => { if (!txt) return; if (!t.fits) warn.push(`Bottom line ${i + 1} is too long; shorten it`); else if (t.size < sizeB - 0.05) warn.push(`Bottom line ${i + 1} shrinks to ${t.size.toFixed(1)} mm to fit`); });
    let cs = unionCS([t1.cs, t2.cs]);
    if (cs) {
      cs = cs.mirror([1, 0]);
      if (spk) { const c = at(spk.r, spk.angle); cs = cs.subtract(CrossSection.circle(spk.d / 2 - 1.5, 64).translate(c)); }   // never over the grille
      cs = cs.subtract(disk(wellR + 1.2, 96));
      if (!cs.isEmpty()) { trayWhite = ext(cs, depthB, 0); tray = tray.subtract(trayWhite); }
    }
  }

  const ok = (m) => m && !m.isEmpty();
  const groups = { body: tray, lid: lidM, white: whiteOut, gold };
  for (const k of Object.keys(groups)) if (!ok(groups[k])) delete groups[k];
  return {
    S, L, warn,
    parts: { tray, trayWhite, lid: lidM, white: whiteOut, gold, capTop, capPtr, capBot, dome, button: btn },
    assembly: { zLid, zTopCap, zB0, capT, zBotCap: zB0 - 0.5 - (capT - 1), capJ: CAPJ, zButton: zTopCap + capT - BUTTON.collar - BUTTON.plug },
    print: {   // print poses: tray as is; lid face down (smooth bed-side face); top cap face down; bottom cap + dome flat
      tray: trayWhite ? { body: tray, white: trayWhite } : { body: tray },
      lid: { body: lidM.rotate([180, 0, 0]).translate([0, 0, H]), white: whiteOut.rotate([180, 0, 0]).translate([0, 0, H]), gold: gold.rotate([180, 0, 0]).translate([0, 0, H]) },
      capTop: { body: capTop.rotate([180, 0, 0]).translate([0, 0, capT]), white: capPtr.rotate([180, 0, 0]).translate([0, 0, capT]) },
      capBot: { body: capBot },
      dome: { white: dome },
      button: { white: btn },
    },
  };
}
