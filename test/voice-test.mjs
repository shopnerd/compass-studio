// node test/voice-test.mjs [outDir] — robot-voices whole clip plans (classroom deck, and the funny combo deck),
// checks every WAV and the flash budget.
// meSpeak leaks memory after ~60 clips, so clips are voiced 30 at a time, each batch in its own process
// (the app replaces its voice worker every 30 clips the same way).
import { createRequire } from 'node:module';
import { writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { clipPlan, decodeWav, encodeWav, toBoardWav, resample, BUDGETS } from '../voice.js';
import { segmentsOf, SPIN_DEFAULTS } from '../spinner.js';
import { DEFAULT_PROMPTS, valuePrompts, deckPrompts } from '../firmware.js';

const BATCH = 30;
const segs = segmentsOf(SPIN_DEFAULTS);
const promptsFor = (deck) => ({ ...(deck === 'funny' ? deckPrompts('funny') : DEFAULT_PROMPTS), value: Object.fromEntries(segs.filter(s => s.kind === 'value').map(s => [s.label, valuePrompts(s.label)])) });
const planFor = (deck, per) => clipPlan(segs, promptsFor(deck), { promptsPer: per });

// ---- child: voice one batch of one plan, print a JSON line
if (process.argv[2] === '--batch') {
  const [, , , deck, perS, rateS, startS, out] = process.argv;
  const per = Number(perS), rate = Number(rateS), start = Number(startS);
  const require = createRequire(import.meta.url);
  require('../vendor/mespeak/mespeak-bundle.js');
  const ms = globalThis.meSpeak; ms.loadConfig(require('../vendor/mespeak/config.json')); ms.loadVoice(require('../vendor/mespeak/en-us.json'));
  const res = { bytes: 0, secs: 0, fails: [] };
  for (const c of planFor(deck, per).clips.slice(start, start + BATCH)) {
    const raw = decodeWav(new Uint8Array(ms.speak(c.text, { rawdata: 'array', speed: 160, pitch: 45 })));
    const b = toBoardWav(raw.x, raw.rate, rate); if (b.silent) res.fails.push(`${c.path} came out silent`);
    const d = decodeWav(b.wav); if (d.rate !== rate) res.fails.push(`${c.path} rate ${d.rate}`);
    res.bytes += b.wav.length; res.secs += b.seconds;
    if (out) { const f = join(out, 'SpinCompass', 'data', c.path); mkdirSync(join(f, '..'), { recursive: true }); writeFileSync(f, b.wav); }
  }
  console.log(JSON.stringify(res)); process.exit(0);
}

// ---- parent
const out = process.argv[2]; if (out) mkdirSync(out, { recursive: true });
let fails = 0; const fail = (m) => { fails++; console.log('  FAIL', m); };

// round trip + resampler sanity: a 440 Hz tone keeps its frequency and level
const tone = new Float32Array(22050).map((_, i) => 0.5 * Math.sin(2 * Math.PI * 440 * i / 22050));
const rt = decodeWav(encodeWav(tone, 22050)); if (rt.rate !== 22050 || Math.abs(rt.x[100] - tone[100]) > 1e-3) fail('WAV round trip');
const r16 = resample(tone, 22050, 16000); let zc = 0; for (let i = 1; i < r16.length; i++) if (r16[i - 1] < 0 && r16[i] >= 0) zc++;
if (Math.abs(zc - 440) > 2) fail(`resampled tone has ${zc} cycles, expected 440`);
let pk = 0; for (const v of r16.slice(100, -100)) pk = Math.max(pk, Math.abs(v)); if (Math.abs(pk - 0.5) > 0.03) fail(`resampled level ${pk.toFixed(3)}`);

// the funny deck's plan voices setups and four times as many answer cards
{ const p = planFor('funny', 4); const setups = p.clips.filter(c => c.list === 'truth').length, answers = p.clips.filter(c => c.list === 'answer').length;
  if (setups !== 4 || answers !== 16) fail(`funny plan at 4 per list: ${setups} setups, ${answers} answers (want 4 and 16)`); }

const { execFileSync } = await import('node:child_process');
const self = fileURLToPath(import.meta.url);
for (const [deck, per, rate] of [['classroom', 4, 16000], ['classroom', 6, 16000], ['classroom', Infinity, 11025], ['classroom', 0, 16000], ['funny', 4, 16000]]) {
  const t0 = performance.now(), n = planFor(deck, per).clips.length; let bytes = 0, secs = 0;
  for (let start = 0; start < n; start += BATCH) {
    try {
      const r = JSON.parse(execFileSync(process.execPath, [self, '--batch', deck, String(per), String(rate), String(start), (out && per === 4 && rate === 16000 && deck === 'classroom') ? out : ''], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim().split('\n').pop());
      bytes += r.bytes; secs += r.secs; for (const m of r.fails) fail(`${deck}/${per}: ${m}`);
    } catch (e) { fail(`${deck}/${per}: batch at clip ${start} crashed`); }
  }
  const fit = BUDGETS.map(B => `${B.key} ${bytes <= B.bytes ? 'fits' : 'TOO BIG'}`).join(', ');
  console.log(`${deck.padEnd(9)} prompts per list ${String(per).padEnd(8)} ${rate} Hz: ${n} clips, ${secs.toFixed(0)} s of speech, ${(bytes / 1e6).toFixed(2)} MB on flash (${fit}) — ${(performance.now() - t0).toFixed(0)} ms`);
}
console.log(fails ? `${fails} FAILURES` : 'all voice checks passed');
process.exit(fails ? 1 : 0);
