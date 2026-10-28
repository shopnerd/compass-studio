// node tools/valuecore-snapshot.mjs — snapshot ValueCore's values into compass-studio/data/valuecore.js, with each value's printed size worked out
// for the compass ring (c) and a Spin Compass segment (s). 0 = does not fit; then `p` is the short form to use.
import { readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
const dir = fileURLToPath(new URL('..', import.meta.url)).replace(/\\/g, '/');
const root = 'file:///' + dir;
const { default: Module } = await import(root + 'vendor/manifold.js');
const { default: opentype } = await import(root + 'vendor/opentype.module.js');
const { createKit, DEFAULTS: P, arrangeValues } = await import(root + 'core.js');
const { SPIN_DEFAULTS, resolveChoices, labelBand } = await import(root + 'spinner.js');
const fb = readFileSync(dir + 'fonts/nunito-latin-800-normal.woff');
const K = createKit(await Module().then(w => { w.setup(); return w; }), opentype.parse(fb.buffer.slice(fb.byteOffset, fb.byteOffset + fb.byteLength)));
const raw = await fetch('https://value-core-elisabetharnold.replit.app/api/values').then(r => r.json());

// compass: the word's own size on the ring next to three typical values (same shrink rule as core.js)
const rT = P.textR, gapDeg = (P.textSize * 0.9 / rT) * 180 / Math.PI;
function compassSize(word) {
  const four = [word, 'Honor', 'Courage', 'Service'].map(s => s.toUpperCase());
  const v = arrangeValues(four, w => K.measure(w, P.textSize, P.track));
  const sizes = v.map(() => P.textSize), span = i => K.measure(v[i], sizes[i], P.track) / rT * 180 / Math.PI;
  for (let g = 0; g < 400; g++) {
    let worst = null;
    for (let i = 0; i < 4; i++) { const j = (i + 1) % 4, over = span(i) / 2 + span(j) / 2 + gapDeg - 90; if (over > 0.01 && (!worst || over > worst.over)) worst = { i, j, over }; }
    if (!worst) break;
    const k = span(worst.i) * sizes[worst.i] >= span(worst.j) * sizes[worst.j] && sizes[worst.i] > P.minText ? worst.i : (sizes[worst.j] > P.minText ? worst.j : (sizes[worst.i] > P.minText ? worst.i : -1));
    if (k < 0) return 0;
    sizes[k] = Math.max(P.minText, sizes[k] * 0.98);
  }
  return +sizes[v.indexOf(four[0])].toFixed(1);
}
// spinner: arcText(label as typed, band.base, …, band.size, 39°, min 2.6, track 0.3) on the default Ø86 disc (see labelBand in spinner.js)
const S = resolveChoices(SPIN_DEFAULTS), band = labelBand(S), sMax = band.base * band.deg * Math.PI / 180, sTop = band.size;
function spinSize(word) {
  const w = K.measure(word, sTop, 0.3); if (w <= sMax) return +sTop.toFixed(1);
  let sz = sTop, L = w;
  for (let k = 0; k < 12 && L > sMax && sz > 2.6; k++) { sz = Math.max(2.6, sz * Math.min(0.995, sMax / L)); L = K.measure(word, sz, 0.3); }
  return L <= sMax + 0.01 ? +sz.toFixed(1) : 0;
}
const SHORT = {
  'Community Awareness': 'Awareness', 'Social Responsibility': 'Responsibility', 'Environmental Stewardship': 'Stewardship',
  'Democratic participation': 'Participation', 'Non-discrimination': 'Equality', 'Community-mindedness': 'Community',
  'Family-mindedness': 'Family', 'Freedom of thought': 'Free Thought', 'Freedom of expression': 'Free Speech',
  'Environmentalism': 'Earth Care', 'Respect for nature': 'Nature', 'Personal Growth': 'Growth',
  'Aristotelian Ambition': 'Ambition', 'Aristotelian Friendliness': 'Friendliness', 'Aristotelian Truthfulness': 'Truthfulness',
  'Aristotelian Justice': 'Justice', 'Practical Wisdom (Phronesis)': 'Phronesis', 'Practical Wisdom': 'Phronesis',
  'Scientific Knowledge': 'Science', 'Philosophic Wisdom': 'Philosophy',
};
const seen = new Set(), out = [];
for (const x of raw) {
  const name = x.name.trim(); if (seen.has(name.toLowerCase())) continue; seen.add(name.toLowerCase());
  const c = compassSize(name), s = spinSize(name), e = { n: name, k: x.category[0], d: x.definition.trim(), x: x.examples || [], c, s };
  if ((!c || !s) && SHORT[name]) { e.p = SHORT[name]; e.pc = compassSize(e.p); e.ps = spinSize(e.p); }
  else if (!c || !s) console.warn('no short form:', name, c, s);
  out.push(e);
}
const head = `// ValueCore's character values (Jubilee Centre categories), used with permission. Snapshot ${new Date().toISOString().slice(0, 10)} of
// https://value-core-elisabetharnold.replit.app/api/values, rebuilt by tools/valuecore-snapshot.mjs, not by hand. Duplicates removed.
// n name · k category (i intellectual, m moral, c civic, p performance) · d definition · x examples
// c / s: the word's printed letter height in mm on the compass ring (next to typical values) / a Spin Compass segment; 0 = will not fit
// p: short form to print when the name will not fit (pc / ps: its sizes)
export const VALUECORE_URL = 'https://value-core-elisabetharnold.replit.app/';
export const CATEGORY = { i: 'Intellectual', m: 'Moral', c: 'Civic', p: 'Performance' };
export const VALUES = [\n`;
writeFileSync(dir + 'data/valuecore.js', head + out.map(e => '  ' + JSON.stringify(e)).join(',\n') + '\n];\n');
const nof = out.filter(e => !e.c), nos = out.filter(e => !e.s);
console.log({ n: out.length, compassNoFit: nof.length, spinNoFit: nos.length, spinNoFitNames: nos.map(e => e.n), spinSmall: out.filter(e => e.s && e.s < 3).length, band, shortSizes: out.filter(e => e.p).map(e => `${e.p} ${e.pc}/${e.ps}`) });
