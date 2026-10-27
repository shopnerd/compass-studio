// voice.js — the Spin Compass's voice clips. Pure functions: runs in the browser and in Node.
// Which clips the board wants, cleaning a recording (trim, level, fade, resample), 16-bit mono WAV in and out,
// the flash budget, and the files to upload to LittleFS. Paths match firmware.js:
//   /clips/<segment>.wav   the segment name, played when it lands
//   /clips/bottle.wav      spun flat on a table           /clips/hello.wav   at power-on (optional)
//   /prompts/<list>-<n>.wav  prompt n of a list: truth, dare, again, choose, or value<segment>

export const RATES = [{ hz: 16000, label: '16 kHz (clearer)' }, { hz: 11025, label: '11 kHz (twice as many clips)' }];
export const BUDGETS = [
  { key: 'custom', bytes: 5.5e6, label: '5.5 MB, with the partitions.csv in the download' },
  { key: 'default', bytes: 1.4e6, label: '1.4 MB, the "8M with spiffs" default scheme' },
];
// LittleFS on ESP32: 4 KB blocks, so every file rounds up; plus a little metadata per file.
export const onFlash = (bytes) => Math.ceil((bytes + 64) / 4096) * 4096;

export function clipPlan(segments, prompts, opts = {}) {
  const per = opts.promptsPer ?? 6;            // prompts voiced per list (0 = names only, Infinity = all)
  const clips = [];
  clips.push({ path: '/clips/hello.wav', text: opts.hello || 'Spin me!', group: 'extra', label: 'Power on' });
  clips.push({ path: '/clips/bottle.wav', text: opts.bottle || 'You! Your turn.', group: 'extra', label: 'Spin the bottle' });
  segments.forEach((s, i) => clips.push({ path: `/clips/${i}.wav`, text: s.kind === 'value' ? `${s.label}!` : `${s.label}!`, group: 'name', label: `Segment ${i + 1}: ${s.label}` }));
  const lists = [];
  segments.forEach((s, i) => {
    if (s.kind === 'value') lists.push({ clip: `value${i}`, title: s.label, items: (prompts.value && prompts.value[s.label]) || [] });
  });
  for (const k of ['truth', 'dare', 'again', 'choose']) if (segments.some(s => s.kind === k)) lists.push({ clip: k, title: k[0].toUpperCase() + k.slice(1), items: prompts[k] || [] });
  for (const L of lists) L.items.slice(0, per).forEach((t, n) => clips.push({ path: `/prompts/${L.clip}-${n}.wav`, text: t, group: 'prompt', label: `${L.title} ${n + 1}`, list: L.clip, n }));
  return { clips, lists: lists.map(L => ({ ...L, voiced: Math.min(per, L.items.length) })) };
}
// Prompt lists cut to the voiced ones, so the board never deals a prompt it can't say.
export function voicedPrompts(prompts, segments, per) {
  if (!isFinite(per)) return prompts;
  const out = { ...prompts, value: {} };
  for (const k of ['truth', 'dare', 'again', 'choose']) out[k] = (prompts[k] || []).slice(0, Math.max(1, per));
  for (const s of segments) if (s.kind === 'value') out.value[s.label] = ((prompts.value || {})[s.label] || []).slice(0, Math.max(1, per));
  return out;
}
// A rough length for a clip not made yet: ~14 characters a second of speech, plus a short tail.
export const guessSeconds = (text) => Math.max(0.7, text.length / 14 + 0.25);

// ---------------------------------------------------------------- WAV
export function decodeWav(u8) {
  const dv = new DataView(u8.buffer, u8.byteOffset, u8.byteLength);
  const tag = (o) => String.fromCharCode(u8[o], u8[o + 1], u8[o + 2], u8[o + 3]);
  if (tag(0) !== 'RIFF' || tag(8) !== 'WAVE') throw new Error('not a WAV file');
  let o = 12, fmt = null, data = null;
  while (o + 8 <= u8.length) {
    const id = tag(o), size = dv.getUint32(o + 4, true);
    if (id === 'fmt ') fmt = { format: dv.getUint16(o + 8, true), ch: dv.getUint16(o + 10, true), rate: dv.getUint32(o + 12, true), bits: dv.getUint16(o + 22, true) };
    if (id === 'data') { data = { o: o + 8, n: Math.min(size, u8.length - o - 8) }; break; }
    o += 8 + size + (size & 1);
  }
  if (!fmt || !data) throw new Error('WAV has no fmt or data chunk');
  if (fmt.format !== 1 || (fmt.bits !== 16 && fmt.bits !== 8)) throw new Error('only PCM 8/16-bit WAV');
  const bps = fmt.bits / 8, frames = Math.floor(data.n / (bps * fmt.ch)), x = new Float32Array(frames);
  for (let i = 0; i < frames; i++) {
    let s = 0;
    for (let c = 0; c < fmt.ch; c++) { const p = data.o + (i * fmt.ch + c) * bps; s += fmt.bits === 16 ? dv.getInt16(p, true) / 32768 : (u8[p] - 128) / 128; }
    x[i] = s / fmt.ch;
  }
  return { rate: fmt.rate, x };
}
export function encodeWav(x, rate) {
  const n = x.length, buf = new ArrayBuffer(44 + n * 2), dv = new DataView(buf), w = (o, s) => { for (let i = 0; i < 4; i++) dv.setUint8(o + i, s.charCodeAt(i)); };
  w(0, 'RIFF'); dv.setUint32(4, 36 + n * 2, true); w(8, 'WAVE'); w(12, 'fmt '); dv.setUint32(16, 16, true);
  dv.setUint16(20, 1, true); dv.setUint16(22, 1, true); dv.setUint32(24, rate, true); dv.setUint32(28, rate * 2, true); dv.setUint16(32, 2, true); dv.setUint16(34, 16, true);
  w(36, 'data'); dv.setUint32(40, n * 2, true);
  for (let i = 0; i < n; i++) { const v = Math.max(-1, Math.min(1, x[i])); dv.setInt16(44 + 2 * i, v < 0 ? v * 32768 : v * 32767, true); }
  return new Uint8Array(buf);
}

// ---------------------------------------------------------------- cleaning
// Windowed-sinc resampler with the cutoff below the lower Nyquist, so downsampling doesn't alias.
export function resample(x, from, to) {
  if (from === to) return x;
  const ratio = from / to, n = Math.floor(x.length / ratio), out = new Float32Array(n);
  const fc = Math.min(1, to / from) * 0.92, N = 16;
  for (let i = 0; i < n; i++) {
    const t = i * ratio, c = Math.floor(t); let s = 0, wsum = 0;
    for (let k = c - N + 1; k <= c + N; k++) {
      if (k < 0 || k >= x.length) continue;
      const d = t - k, a = Math.PI * fc * d, sinc = d === 0 ? 1 : Math.sin(a) / a, win = 0.5 + 0.5 * Math.cos(Math.PI * d / N);
      const wgt = fc * sinc * win; s += x[k] * wgt; wsum += wgt;
    }
    out[i] = wsum ? s / wsum : 0;
  }
  return out;
}
// Trim leading/trailing quiet (below -42 dBFS in 10 ms windows, keep 60 ms), remove DC, peak to -1 dBFS (gain up to ×10),
// 8 ms fades so clips don't click on the little speaker.
export function cleanClip(x, rate, opts = {}) {
  let mean = 0; for (let i = 0; i < x.length; i++) mean += x[i]; mean /= Math.max(1, x.length);
  const y = new Float32Array(x.length); for (let i = 0; i < x.length; i++) y[i] = x[i] - mean;
  const win = Math.max(1, Math.round(rate * 0.01)), thr = Math.pow(10, (opts.gateDb ?? -42) / 20);
  let peak = 0; for (let i = 0; i < y.length; i++) peak = Math.max(peak, Math.abs(y[i]));
  const level = (i0) => { let m = 0; for (let i = i0; i < Math.min(y.length, i0 + win); i++) m = Math.max(m, Math.abs(y[i])); return m; };
  const rel = Math.max(thr, peak * 0.03);
  let a = 0; while (a < y.length && level(a) < rel) a += win;
  let b = y.length; while (b > a && level(Math.max(0, b - win)) < rel) b -= win;
  if (b <= a) return { x: new Float32Array(0), rate, peak: 0, silent: true };
  const pad = Math.round(rate * 0.06); a = Math.max(0, a - pad); b = Math.min(y.length, b + pad);
  const z = y.slice(a, b), gain = Math.min(10, 0.89 / Math.max(1e-6, peak));
  const fade = Math.min(z.length / 2, Math.round(rate * 0.008));
  for (let i = 0; i < z.length; i++) { let g = gain; if (i < fade) g *= i / fade; if (i > z.length - fade) g *= (z.length - i) / fade; z[i] *= g; }
  return { x: z, rate, peak: peak * gain, silent: false };
}
// Raw samples at any rate -> cleaned, resampled, 16-bit WAV bytes ready for the board.
export function toBoardWav(x, rate, outRate) {
  const c = cleanClip(x, rate);
  const r = resample(c.x, rate, outRate);
  return { wav: encodeWav(r, outRate), seconds: r.length / outRate, silent: c.silent };
}

// ---------------------------------------------------------------- packaging
export const PARTITIONS_CSV = `# Compass Studio: XIAO ESP32-S3 (8 MB flash). 2 MB for the sketch, ~5.9 MB LittleFS for voice clips.
# Arduino IDE uses this file automatically when it sits in the sketch folder.
# Name,    Type, SubType,  Offset,   Size,     Flags
nvs,       data, nvs,      0x9000,   0x5000,
otadata,   data, ota,      0xe000,   0x2000,
app0,      app,  ota_0,    0x10000,  0x200000,
spiffs,    data, spiffs,   0x210000, 0x5E0000,
coredump,  data, coredump, 0x7F0000, 0x10000,
`;
export function dataFolderFiles(made, plan, info = {}) {   // made: { path: Uint8Array }  -> [[zipPath, bytes], ...]
  const enc = new TextEncoder(), files = [], lines = [];
  for (const c of plan.clips) {
    const w = made[c.path];
    lines.push(`${w ? 'ok     ' : 'MISSING'} ${c.path.padEnd(26)} ${w ? (w.length / 1024).toFixed(0).padStart(4) + ' KB' : '       '}  ${c.text}`);
    if (w) files.push([`SpinCompass/data${c.path}`, w]);
  }
  const total = files.reduce((s, f) => s + onFlash(f[1].length), 0);
  files.push(['SpinCompass/data/clips.txt', enc.encode(`Voice clips for ${info.name || 'the Spin Compass'}, made in Compass Studio ${info.date || ''}\n${info.rate || 16000} Hz, 16-bit mono WAV. About ${(total / 1e6).toFixed(2)} MB on the board.\n\n${lines.join('\n')}\n`)]);
  return { files, total };
}
