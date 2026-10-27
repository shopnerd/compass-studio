// tts-worker.js — robot voice (meSpeak / eSpeak) off the main thread. Classic worker.
// In: { id, text, voice, speed, pitch }   Out: { id, wav: Uint8Array (22.05 kHz 16-bit mono) } or { id, error }
// meSpeak leaks memory after ~60 clips; the page replaces this worker every 30 (see voice-ui.js).
importScripts('./vendor/mespeak/mespeak-bundle.js');
let config = null; const voices = {};
async function ready(voice) {
  if (!config) { config = await fetch('./vendor/mespeak/config.json').then(r => r.json()); self.meSpeak.loadConfig(config); }
  if (!voices[voice]) { voices[voice] = await fetch(`./vendor/mespeak/${voice}.json`).then(r => r.json()); }
  self.meSpeak.loadVoice(voices[voice]);
}
onmessage = async (e) => {
  const m = e.data;
  try {
    await ready(m.voice || 'en-us');
    const arr = self.meSpeak.speak(m.text, { rawdata: 'array', speed: m.speed || 160, pitch: m.pitch ?? 45, wordgap: 1 });
    if (!arr) throw new Error('meSpeak returned nothing');
    const wav = new Uint8Array(arr);
    postMessage({ id: m.id, wav }, [wav.buffer]);
  } catch (err) { postMessage({ id: m.id, error: err && err.message ? err.message : String(err) }); }
};
