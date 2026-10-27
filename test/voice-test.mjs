// node test/voice-test.mjs [outDir] — robot-voices the whole default clip plan, checks the WAVs and the flash budget.
import { createRequire } from 'node:module';
import { writeFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import { clipPlan, decodeWav, encodeWav, toBoardWav, resample, onFlash, BUDGETS, dataFolderFiles } from '../voice.js';
import { segmentsOf, SPIN_DEFAULTS } from '../spinner.js';
import { DEFAULT_PROMPTS, valuePrompts } from '../firmware.js';

const require = createRequire(import.meta.url);
require('../vendor/mespeak/mespeak-bundle.js');
const ms = globalThis.meSpeak; ms.loadConfig(require('../vendor/mespeak/config.json')); ms.loadVoice(require('../vendor/mespeak/en-us.json'));
const one = process.argv[2] === '--one';
const out = one ? process.argv[5] : process.argv[2]; if (out) mkdirSync(out, { recursive: true });
if (!one) {   // meSpeak leaks memory after ~60 clips, so each plan runs in its own process (the app restarts its worker the same way)
  const { execFileSync } = await import('node:child_process');
  let bad = 0;
  for (const [per, rate] of [[4, 16000], [6, 16000], [Infinity, 11025], [0, 16000]]) {
    try { process.stdout.write(execFileSync(process.execPath, [(await import('node:url')).fileURLToPath(import.meta.url), '--one', String(per), String(rate), out || ''], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] })); }
    catch (e) { bad++; process.stdout.write(e.stdout || 'child failed\n'); }
  }
  console.log(bad ? `${bad} plan(s) FAILED` : 'all voice checks passed'); process.exit(bad ? 1 : 0);
}
let fails = 0; const fail = (m) => { fails++; console.log('  FAIL', m); };

// round trip + resampler sanity: a 440 Hz tone keeps its frequency and level
const tone = new Float32Array(22050).map((_, i) => 0.5 * Math.sin(2 * Math.PI * 440 * i / 22050));
const rt = decodeWav(encodeWav(tone, 22050)); if (rt.rate !== 22050 || Math.abs(rt.x[100] - tone[100]) > 1e-3) fail('WAV round trip');
const r16 = resample(tone, 22050, 16000); let zc = 0; for (let i = 1; i < r16.length; i++) if (r16[i - 1] < 0 && r16[i] >= 0) zc++;
if (Math.abs(zc - 440) > 2) fail(`resampled tone has ${zc} cycles, expected 440`);
let pk = 0; for (const v of r16.slice(100, -100)) pk = Math.max(pk, Math.abs(v)); if (Math.abs(pk - 0.5) > 0.03) fail(`resampled level ${pk.toFixed(3)}`);

const segs = segmentsOf(SPIN_DEFAULTS);
const prompts = { ...DEFAULT_PROMPTS, value: Object.fromEntries(segs.filter(s => s.kind === 'value').map(s => [s.label, valuePrompts(s.label)])) };
for (const [per, rate] of [[Number(process.argv[3]), Number(process.argv[4])]]) {
  const plan = clipPlan(segs, prompts, { promptsPer: per });
  const made = {}; let secs = 0; const t0 = performance.now();
  for (const c of plan.clips) {
    const raw = decodeWav(new Uint8Array(ms.speak(c.text, { rawdata: 'array', speed: 160, pitch: 45 })));
    const b = toBoardWav(raw.x, raw.rate, rate); if (b.silent) fail(`${c.path} came out silent`);
    const d = decodeWav(b.wav); if (d.rate !== rate) fail(`${c.path} rate ${d.rate}`);
    made[c.path] = b.wav; secs += b.seconds;
  }
  const pack = dataFolderFiles(made, plan, { rate });
  const fit = BUDGETS.map(B => `${B.key} ${pack.total <= B.bytes ? 'fits' : 'TOO BIG'}`).join(', ');
  console.log(`prompts per list ${String(per).padEnd(8)} ${rate} Hz: ${plan.clips.length} clips, ${secs.toFixed(0)} s of speech, ${(pack.total / 1e6).toFixed(2)} MB on flash (${fit}) — ${(performance.now() - t0).toFixed(0)} ms`);
  if (out && per === 4 && rate === 16000) for (const [p, bytes] of pack.files) { const f = join(out, p); mkdirSync(join(f, '..'), { recursive: true }); writeFileSync(f, bytes); }
}
if (fails) console.log(`${fails} FAILURES`);
process.exit(fails ? 1 : 0);
