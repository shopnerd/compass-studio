// voice-ui.js — the Voice section of the Spin Compass panel: record your own voice or use the robot voice for every clip
// the board plays, hear them, watch the flash budget, download the sketch + data folder ready to upload.
import { clipPlan, voicedPrompts, guessSeconds, decodeWav, encodeWav, resample, toBoardWav, onFlash, RATES, BUDGETS, PARTITIONS_CSV, dataFolderFiles } from './voice.js';
import { firmwareSketch, DEFAULT_PINS } from './firmware.js';
import { zipFiles } from './core.js';

const ACCENTS = [['en-us', 'American'], ['en', 'British'], ['en-sc', 'Scottish'], ['en-n', 'Northern English'], ['en-rp', 'Received Pronunciation'], ['en-wm', 'West Midlands']];
const PER = [[0, 'names only'], [2, '2 per list'], [4, '4 per list'], [6, '6 per list'], [Infinity, 'every prompt']];
const esc = (s) => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

// ---- clip store: IndexedDB in this browser (falls back to memory)
const mem = new Map(); let dbp = null;
function db() {
  if (dbp) return dbp;
  dbp = new Promise((res) => { try { const r = indexedDB.open('compass-voice', 1); r.onupgradeneeded = () => r.result.createObjectStore('clips'); r.onsuccess = () => res(r.result); r.onerror = () => res(null); } catch (_) { res(null); } });
  return dbp;
}
const scopeKey = (scope, path) => `${scope}|${path}`;
async function getClip(scope, path) { const d = await db(); const k = scopeKey(scope, path); if (!d) return mem.get(k) || null; return new Promise(res => { try { const q = d.transaction('clips').objectStore('clips').get(k); q.onsuccess = () => res(q.result || null); q.onerror = () => res(mem.get(k) || null); } catch (_) { res(mem.get(k) || null); } }); }
async function putClip(scope, path, v) { const k = scopeKey(scope, path); mem.set(k, v); const d = await db(); if (!d) return; try { d.transaction('clips', 'readwrite').objectStore('clips').put(v, k); } catch (_) {} }
async function delClip(scope, path) { const k = scopeKey(scope, path); mem.delete(k); const d = await db(); if (!d) return; try { d.transaction('clips', 'readwrite').objectStore('clips').delete(k); } catch (_) {} }

// ---- robot voice worker, replaced every 30 clips (meSpeak leaks)
let tts = null, ttsUses = 0, ttsSeq = 0; const ttsWait = new Map();
function robot(text, opt) {
  if (!tts || ttsUses >= 30) { if (tts) tts.terminate(); tts = new Worker('./tts-worker.js'); ttsUses = 0; tts.onmessage = (e) => { const w = ttsWait.get(e.data.id); if (!w) return; ttsWait.delete(e.data.id); e.data.error ? w.reject(new Error(e.data.error)) : w.resolve(e.data.wav); }; }
  ttsUses++; const id = ++ttsSeq;
  return new Promise((resolve, reject) => { ttsWait.set(id, { resolve, reject }); tts.postMessage({ id, text, ...opt }); });
}

export function mountVoice(root, ctx) {
  // ctx: { info() -> spin info (segments, leds, name), prompts() -> full prompt lists, status(text, busy), save(files) }
  const st = { voice: 'en-us', pitch: 45, speed: 160, rate: 16000, budget: 'custom', per: 4 };
  try { Object.assign(st, JSON.parse(localStorage.getItem('compass-voice-settings') || '{}')); } catch (_) {}
  if (st.per === null) st.per = Infinity;
  const saveSt = () => { try { localStorage.setItem('compass-voice-settings', JSON.stringify({ ...st, per: isFinite(st.per) ? st.per : null })); } catch (_) {} };
  const opt = (list, cur) => list.map(([v, l]) => `<option value="${v}"${String(v) === String(cur) ? ' selected' : ''}>${l}</option>`).join('');
  root.innerHTML = `
    <p class="hint">Every clip the board can say: the segment names, spin-the-bottle, hello, and the prompts. Record your own voice or let the robot voice say it. Clips stay in this browser.</p>
    <div class="row2">
      <label>Robot voice <select id="vcVoice">${opt(ACCENTS, st.voice)}</select></label>
      <label>Prompts with sound <select id="vcPer">${opt(PER, st.per)}</select></label>
      <label>Pitch <span class="val" id="vcPitchOut"></span><input type="range" id="vcPitch" min="0" max="99" value="${st.pitch}"></label>
      <label>Speed <span class="val" id="vcSpeedOut"></span><input type="range" id="vcSpeed" min="110" max="240" step="5" value="${st.speed}"></label>
      <label>Sound quality <select id="vcRate">${opt(RATES.map(r => [r.hz, r.label]), st.rate)}</select></label>
      <label>Board storage <select id="vcBudget">${opt(BUDGETS.map(b => [b.key, b.label]), st.budget)}</select></label>
    </div>
    <div class="meter" id="vcMeter"><div class="bar"><i></i><b></b></div><span></span></div>
    <div class="vbtns"><button class="btn" id="vcAll">Robot voice for every missing clip</button><button class="btn" id="vcClear">Clear all clips</button></div>
    <div class="cliplist" id="vcList"></div>
    <button class="btn primary" id="vcZip">Download sketch + sound files for the board</button>
    <p class="hint" id="vcNote"></p>`;
  const $ = (id) => root.querySelector('#' + id);
  let plan = null, made = {}, scope = '';
  let audio = null, recording = null, micStream = null;

  function key() { const I = ctx.info(); return I ? I.segments.map(s => s.label).join(',') : 'none'; }
  async function refresh() {
    const I = ctx.info(); if (!I) return;
    scope = 'v1';
    plan = clipPlan(I.segments, ctx.prompts(), { promptsPer: st.per });
    made = {};
    for (const c of plan.clips) { const v = await getClip(scope, c.path); if (v) made[c.path] = v; }
    render();
  }
  function bytesFor(c) {
    const v = made[c.path];
    if (v && v.rate === st.rate) return onFlash(v.wav.length);
    const secs = v ? v.seconds : guessSeconds(c.text);
    return onFlash(44 + Math.round(secs * st.rate) * 2);
  }
  function meter() {
    const B = BUDGETS.find(b => b.key === st.budget), total = plan.clips.reduce((s, c) => s + bytesFor(c), 0), done = plan.clips.filter(c => made[c.path]).length;
    const doneBytes = plan.clips.filter(c => made[c.path]).reduce((s, c) => s + bytesFor(c), 0);
    const m = $('vcMeter'), over = total > B.bytes;
    m.querySelector('i').style.width = Math.min(100, 100 * doneBytes / B.bytes) + '%';
    m.querySelector('b').style.width = Math.min(100, 100 * total / B.bytes) + '%';
    m.classList.toggle('over', over);
    m.querySelector('span').textContent = `${done} of ${plan.clips.length} clips made · ${(total / 1e6).toFixed(2)} of ${(B.bytes / 1e6).toFixed(1)} MB${over ? ' — too much: fewer prompts, 11 kHz, or the bigger storage' : ''}`;
    $('vcNote').textContent = st.budget === 'custom' ? 'The download includes partitions.csv, which gives the clips about 5.9 MB of the board\'s 8 MB. The board only deals prompts that have sound.' : 'Uses the stock "8M with spiffs" partition (1.5 MB for files). The board only deals prompts that have sound.';
    return { total, over };
  }
  function render() {
    const groups = [['extra', 'Hello and spin the bottle'], ['name', 'Segment names'], ['prompt', 'Prompts']];
    let html = '';
    for (const [g, title] of groups) {
      const list = plan.clips.filter(c => c.group === g); if (!list.length) continue;
      html += `<h5>${title}</h5>`;
      for (const c of list) {
        const v = made[c.path], stale = v && v.text !== c.text;
        const chip = v ? (stale ? '<em class="chip warn">text changed</em>' : `<em class="chip ${v.source}">${v.source === 'mic' ? 'your voice' : 'robot'} · ${v.seconds.toFixed(1)} s</em>`) : '<em class="chip none">no sound</em>';
        html += `<div class="clip" data-path="${c.path}"><div class="ct"><span class="cl">${esc(c.label)}</span>${chip}<span class="tx">${esc(c.text)}</span></div>
          <div class="cb"><button type="button" data-a="play"${v ? '' : ' disabled'}>Play</button><button type="button" data-a="rec">${recording && recording.path === c.path ? 'Stop' : 'Record'}</button><button type="button" data-a="robot">Robot</button>${v ? '<button type="button" data-a="del" aria-label="Delete clip">×</button>' : ''}</div></div>`;
      }
    }
    $('vcList').innerHTML = html;
    $('vcPitchOut').textContent = st.pitch; $('vcSpeedOut').textContent = st.speed + ' wpm';
    meter();
  }
  async function makeRobot(c) {
    const raw = decodeWav(await robot(c.text, { voice: st.voice, pitch: st.pitch, speed: st.speed }));
    const b = toBoardWav(raw.x, raw.rate, st.rate);
    const v = { text: c.text, source: 'robot', wav: b.wav, rate: st.rate, seconds: b.seconds };
    made[c.path] = v; await putClip(scope, c.path, v);
  }
  function play(v) {
    if (audio) { audio.pause(); URL.revokeObjectURL(audio.src); }
    audio = new Audio(URL.createObjectURL(new Blob([v.wav], { type: 'audio/wav' }))); audio.play().catch(() => {});
  }
  async function record(c) {
    if (recording) { recording.stop(); return; }
    try { micStream = micStream || await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } }); }
    catch (err) { ctx.status('The microphone is blocked or missing. Allow it in the browser\'s address bar, or use the robot voice.'); return; }
    const rec = new MediaRecorder(micStream), chunks = [];
    rec.ondataavailable = (e) => chunks.push(e.data);
    rec.onstop = async () => {
      recording = null; clearTimeout(rec._t);
      try {
        const buf = await new Blob(chunks).arrayBuffer(), ac = new (window.AudioContext || window.webkitAudioContext)();
        const ab = await ac.decodeAudioData(buf); ac.close();
        const x = ab.numberOfChannels > 1 ? ab.getChannelData(0).map((s, i) => (s + ab.getChannelData(1)[i]) / 2) : ab.getChannelData(0);
        const b = toBoardWav(x, ab.sampleRate, st.rate);
        if (b.silent) { ctx.status('That take was silent. Check the microphone and try again.'); render(); return; }
        const v = { text: c.text, source: 'mic', wav: b.wav, rate: st.rate, seconds: b.seconds };
        made[c.path] = v; await putClip(scope, c.path, v); ctx.status(`Recorded ${c.label}: ${b.seconds.toFixed(1)} s`); render(); play(v);
      } catch (err) { ctx.status('Could not read the recording: ' + err.message); render(); }
    };
    recording = rec; rec.path = c.path; rec.start(); rec._t = setTimeout(() => rec.state === 'recording' && rec.stop(), 9000);
    ctx.status(`Recording "${c.text}" — click Stop when done (stops by itself after 9 s)`, true); render();
  }
  $('vcList').addEventListener('click', async (e) => {
    const btn = e.target.closest('button'); if (!btn) return;
    const path = btn.closest('.clip').dataset.path, c = plan.clips.find(x => x.path === path), a = btn.dataset.a;
    if (a === 'play' && made[path]) play(made[path]);
    if (a === 'rec') record(c);
    if (a === 'del') { delete made[path]; await delClip(scope, path); render(); }
    if (a === 'robot') { btn.disabled = true; try { await makeRobot(c); play(made[path]); } catch (err) { ctx.status('Robot voice failed: ' + err.message); } render(); }
  });
  $('vcAll').onclick = async () => {
    const todo = plan.clips.filter(c => !made[c.path] || made[c.path].text !== c.text);
    for (let i = 0; i < todo.length; i++) { ctx.status(`Robot voice ${i + 1} of ${todo.length}: ${todo[i].label}`, true); try { await makeRobot(todo[i]); } catch (err) { ctx.status('Robot voice failed: ' + err.message); break; } if (i % 4 === 3) render(); }
    render(); ctx.status(`${todo.length} clips made`);
  };
  let clearArmed = false;
  $('vcClear').onclick = async () => {
    if (!clearArmed) { clearArmed = true; $('vcClear').textContent = 'Click again to delete every clip'; setTimeout(() => { clearArmed = false; $('vcClear').textContent = 'Clear all clips'; }, 4000); return; }
    clearArmed = false; $('vcClear').textContent = 'Clear all clips';
    for (const c of plan.clips) await delClip(scope, c.path); made = {}; render();
  };
  const bind = (id, k, num) => $(id).addEventListener('input', () => { st[k] = num ? (+$(id).value === Infinity ? Infinity : Number($(id).value)) : $(id).value; if (k === 'per' && $(id).value === 'Infinity') st.per = Infinity; saveSt(); if (k === 'per') refresh(); else render(); });
  bind('vcVoice', 'voice'); bind('vcPitch', 'pitch', true); bind('vcSpeed', 'speed', true); bind('vcRate', 'rate', true); bind('vcBudget', 'budget'); bind('vcPer', 'per', true);

  $('vcZip').onclick = async () => {
    const I = ctx.info(); if (!I) return;
    ctx.status('Packing the sketch and sound files…', true);
    // clips made at another quality are converted to the chosen one
    const out = {};
    for (const c of plan.clips) { const v = made[c.path]; if (!v || v.text !== c.text) continue; if (v.rate === st.rate) out[c.path] = v.wav; else { const d = decodeWav(v.wav); out[c.path] = encodeWav(resample(d.x, d.rate, st.rate), st.rate); } }
    const per = st.per, full = ctx.prompts();
    // the board deals only prompts that have sound (or all of them, as text on Serial, if you voice none)
    const prompts = Object.keys(out).some(p => p.startsWith('/prompts/')) ? voicedPrompts(full, I.segments, per) : full;
    const fw = firmwareSketch({ name: I.name, segments: I.segments, leds: I.leds, prompts, pins: DEFAULT_PINS, imuClass: I.imuClass, imuLabel: I.imuLabel });
    const enc = new TextEncoder(), files = fw.files.map(([p, t]) => [p, enc.encode(t)]);
    const pack = dataFolderFiles(out, plan, { name: I.name, rate: st.rate, date: new Date().toISOString().slice(0, 10) });
    files.push(...pack.files);
    if (st.budget === 'custom') files.push(['SpinCompass/partitions.csv', enc.encode(PARTITIONS_CSV)]);
    files.push(['SpinCompass/HOW_TO_UPLOAD_SOUNDS.txt', enc.encode(uploadHowTo(st, pack.total, Object.keys(out).length, plan.clips.length))]);
    const deflate = typeof CompressionStream === 'undefined' ? null : async (u8) => new Uint8Array(await new Response(new Blob([u8]).stream().pipeThrough(new CompressionStream('deflate-raw'))).arrayBuffer());
    const zip = await zipFiles(files, deflate);
    const name = (I.name || 'spin_compass').replace(/[^\w\s-]/g, '').trim().replace(/\s+/g, '_') || 'spin_compass';
    ctx.save([[`${name}_SpinCompass_with_sounds.zip`, zip]]);
    const B = BUDGETS.find(b => b.key === st.budget);
    ctx.status(`Saved: ${Object.keys(out).length} of ${plan.clips.length} clips, ${(pack.total / 1e6).toFixed(2)} MB${pack.total > B.bytes ? ' — more than the board holds' : ''}`);
  };
  return { refresh };
}

function uploadHowTo(st, total, n, of) {
  return `PUTTING THE SOUNDS ON THE SPIN COMPASS
${n} of ${of} clips, ${st.rate} Hz 16-bit mono WAV, about ${(total / 1e6).toFixed(2)} MB.

1. Unzip. Keep the SpinCompass folder together: SpinCompass.ino, config.h, prompts.h${st.budget === 'custom' ? ', partitions.csv' : ''}, and data/.
2. Arduino IDE 2.x, board "XIAO_ESP32S3", PSRAM "OPI PSRAM".${st.budget === 'custom' ? `
   partitions.csv in the sketch folder replaces the Partition Scheme menu: 2 MB for the sketch, ~5.9 MB for sounds.
   If your IDE ignores it, pick the biggest SPIFFS scheme and use fewer prompts.` : `
   Partition Scheme: "8M with spiffs (3MB APP/1.5MB SPIFFS)".`}
3. Upload the sketch first (it sets the partition table).
4. Install the "arduino-littlefs-upload" plugin (github.com/earlephilhower/arduino-littlefs-upload),
   close the Serial Monitor, then Ctrl+Shift+P -> "Upload LittleFS to Pico/ESP8266/ESP32".
   It copies data/ to the board: data/clips/0.wav becomes /clips/0.wav.
5. Open the Serial Monitor at 115200. Missing clips are named there; the board skips them.

data/clips.txt lists every clip, its text, and which ones are missing.
Not tested on hardware yet.
`;
}
