// play.js — the Play tab: a top-down Spin Compass you can flick. Simulates the LED light show
// (persistence of vision at speed, chase, ticker, landed pulse) and deals the prompt card.
// mountPlay(container, getConfig) -> { refresh(), destroy() }. No DOM access at import time.

const D2R = Math.PI / 180;
const PERSIST = 0.07;          // s an eye holds a moving LED (sets the smear length)
const WIN_MM = 3.2;            // diffuser window radius
const KIND_RGB = { value: [255, 204, 0], truth: [70, 170, 255], dare: [255, 96, 56], again: [90, 220, 130], choose: [190, 130, 255] };
const KIND_NAME = { value: 'Value', truth: 'Truth', dare: 'Dare', again: 'Again', choose: 'Choose' };
const DEFAULT_SEGMENTS = [
  { label: 'Integrity', kind: 'value' }, { label: 'Truth', kind: 'truth' }, { label: 'Courage', kind: 'value' }, { label: 'Dare', kind: 'dare' },
  { label: 'Empathy', kind: 'value' }, { label: 'Again', kind: 'again' }, { label: 'Curiosity', kind: 'value' }, { label: 'Choose', kind: 'choose' },
];
const DEFAULT_LEDS = [
  ...Array.from({ length: 8 }, (_, k) => ({ angle: k * 45, r: 33, ring: 'outer' })),
  ...Array.from({ length: 4 }, (_, k) => ({ angle: 45 + k * 90, r: 19, ring: 'inner' })),
];
const FALLBACK = {
  truth: ['What is one thing you would refuse to build, no matter the pay?'],
  dare: ['Explain your major using only hand gestures for 20 seconds.'],
  again: ['Spin again!'],
  choose: ["Spinner's choice: Truth or Dare?"],
};

const mod = (a, n) => ((a % n) + n) % n;
const angDist = (a, b) => { const d = mod(a - b, 360); return d > 180 ? 360 - d : d; };
const rgba = (c, a) => `rgba(${c[0] | 0},${c[1] | 0},${c[2] | 0},${a})`;
function hsv(h, s = 1, v = 1) {
  const f = (n) => { const k = mod(n + h / 60, 6); return v - v * s * Math.max(0, Math.min(k, 4 - k, 1)); };
  return [255 * f(5), 255 * f(3), 255 * f(1)];
}
const isOuter = (l) => typeof l.ring === 'string' ? /out|bound/i.test(l.ring) : typeof l.ring === 'number' ? l.ring === 0 : l.r > 26;

// POV patterns, both functions of WORLD angle (deg clockwise from the pointer). Same idea as the firmware.
const povOuter = (w, t) => angDist(w, 0) < 8 ? [255, 255, 255] : hsv(mod(w + t * 30, 360));
const povInner = (w) => mod(w, 90) < 14 ? [255, 214, 90] : null;

export function mountPlay(container, getConfig) {
  const reduce = typeof matchMedia === 'function' ? matchMedia('(prefers-reduced-motion: reduce)') : { matches: false };
  const dark = typeof matchMedia === 'function' ? matchMedia('(prefers-color-scheme: dark)') : { matches: false };

  // ---------------------------------------------------------------- DOM
  const style = document.createElement('style');
  style.textContent = `
.csp-root{position:absolute;inset:0;overflow:hidden;user-select:none;-webkit-user-select:none}
.csp-root canvas{position:absolute;inset:0;width:100%;height:100%;touch-action:none;outline:none;cursor:grab}
.csp-root canvas:active{cursor:grabbing}
.csp-read{position:absolute;left:12px;top:10px;font:12px ui-monospace,Consolas,monospace;color:var(--muted,#777);pointer-events:none}
.csp-bar{position:absolute;left:0;right:0;bottom:14px;display:flex;justify-content:center;align-items:center;gap:12px;padding:0 16px;flex-wrap:wrap}
.csp-hint{font-size:12.5px;color:var(--muted,#777)}
.csp-btn{font:600 15px system-ui,sans-serif;border:0;border-radius:999px;padding:10px 26px;background:var(--accent,#9e1f27);color:var(--accent-ink,#fff);cursor:pointer}
.csp-btn.ghost{background:transparent;color:var(--ink,#222);border:1px solid var(--line,#bbb);padding:8px 18px;font-size:14px}
.csp-btn:focus-visible{outline:2px solid var(--ink,#222);outline-offset:2px}
.csp-card{position:absolute;left:16px;right:16px;bottom:68px;margin:0 auto;max-width:420px;background:var(--panel,#fff);color:var(--ink,#222);
  border:1px solid var(--line,#ccc);border-left:6px solid var(--k,#c90);border-radius:10px;padding:14px 16px 14px;box-shadow:0 10px 30px rgba(0,0,0,.25);
  animation:csp-in .28s ease-out}
.csp-card[hidden]{display:none}
.csp-kind{font:600 11.5px system-ui,sans-serif;letter-spacing:.08em;text-transform:uppercase;color:var(--muted,#777)}
.csp-label{font:800 24px/1.15 system-ui,sans-serif;margin:2px 0 6px}
.csp-prompt{margin:0;font-size:16px;line-height:1.4}
.csp-acts{display:flex;gap:8px;margin-top:12px;flex-wrap:wrap}
.csp-x{position:absolute;right:6px;top:4px;border:0;background:none;color:var(--muted,#777);font-size:20px;cursor:pointer;padding:4px 8px}
@keyframes csp-in{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:none}}
@media (prefers-reduced-motion:reduce){.csp-card{animation:none}}`;
  const root = document.createElement('div'); root.className = 'csp-root';
  const canvas = document.createElement('canvas');
  canvas.tabIndex = 0; canvas.setAttribute('role', 'img'); canvas.setAttribute('aria-label', 'Spin Compass wheel. Drag or flick to spin, or press Space.');
  const read = document.createElement('div'); read.className = 'csp-read';
  const bar = document.createElement('div'); bar.className = 'csp-bar';
  const spinBtn = document.createElement('button'); spinBtn.className = 'csp-btn'; spinBtn.type = 'button'; spinBtn.textContent = 'Spin';
  const hint = document.createElement('span'); hint.className = 'csp-hint'; hint.textContent = 'Flick the wheel, or press Space';
  bar.append(spinBtn, hint);
  const card = document.createElement('div'); card.className = 'csp-card'; card.hidden = true; card.setAttribute('aria-live', 'polite');
  root.append(canvas, read, card, bar);
  container.append(style, root);
  const ctx = canvas.getContext('2d');

  // ---------------------------------------------------------------- state
  let cfg, colors, W = 0, H = 0, dpr = 1;
  let theta = 0, omega = 0, dragging = false, counted = false, landed = -1;
  let samples = [], lastA = 0, pid = null, raf = 0, lastT = 0, clock = 0, lastClick = 0;
  let flashes = [];       // per-LED flash time left (s)
  let bags = {}, lastPick = {};
  let ac = null;

  function normalize(c = {}) {
    const segments = Array.isArray(c.segments) && c.segments.length ? c.segments.map((s) => ({ label: String(s.label ?? ''), kind: KIND_RGB[s.kind] ? s.kind : 'value' })) : DEFAULT_SEGMENTS;
    const leds = Array.isArray(c.leds) && c.leds.length ? c.leds : DEFAULT_LEDS;
    return { segments, leds, R: +c.R || 40, prompts: c.prompts || {}, voice: !!c.voice };
  }
  function readColors() {
    const cs = getComputedStyle(container), v = (n, f) => cs.getPropertyValue(n).trim() || f;
    const dk = dark.matches;
    colors = { ink: v('--ink', dk ? '#e8e9e6' : '#1f2221'), muted: v('--muted', dk ? '#9aa29e' : '#626a66'), panel: v('--panel', dk ? '#1f2221' : '#f7f6f3'),
      accent: v('--accent', '#9e1f27'), font: v('--sans', 'system-ui, sans-serif') };
  }
  const n = () => cfg.segments.length;
  const span = () => 360 / n();
  const underPointer = () => mod(-theta, 360);                 // disc angle sitting under the fixed pointer
  const segAt = (u) => Math.min(n() - 1, Math.floor(u / span()));
  const ledInSeg = (l, i) => { const a0 = i * span(), d = mod(l.angle - a0, 360); return d <= span() + 0.5 || d >= 359.5; };
  const mode = () => {
    if (landed >= 0 && !dragging && omega === 0) return 'landed';
    const w = Math.abs(omega);
    if (w > 900) return 'pov'; if (w > 240) return 'chase'; if (w > 0 || dragging) return 'tick'; return 'idle';
  };

  // ---------------------------------------------------------------- prompts + card
  function list(kind, label) {
    const P = cfg.prompts || {};
    if (kind === 'value') { const L = P.value && P.value[label]; return L && L.length ? L : [`${label}: name a time it cost you something to live it.`, `${label}: who shows it best in your life, and how?`, `${label}: describe an engineering decision where it should come first.`]; }
    return P[kind] && P[kind].length ? P[kind] : FALLBACK[kind];
  }
  function pick(kind, label) {
    const L = list(kind, label), key = kind + ':' + label + ':' + L.length;
    if (L.length === 1) return L[0];
    if (!bags[key] || !bags[key].length) {
      const b = L.map((_, i) => i);
      for (let i = b.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [b[i], b[j]] = [b[j], b[i]]; }
      if (b[b.length - 1] === lastPick[key]) [b[0], b[b.length - 1]] = [b[b.length - 1], b[0]];
      bags[key] = b;
    }
    const i = bags[key].pop(); lastPick[key] = i; return L[i];
  }
  function speak(text) {
    if (!cfg.voice || typeof speechSynthesis === 'undefined') return;
    try { speechSynthesis.cancel(); const u = new SpeechSynthesisUtterance(text); u.rate = 1.02; speechSynthesis.speak(u); } catch (_) {}
  }
  function button(text, ghost, fn) { const b = document.createElement('button'); b.type = 'button'; b.className = 'csp-btn' + (ghost ? ' ghost' : ''); b.textContent = text; b.onclick = fn; return b; }
  function showCard(seg) {
    const { label, kind } = seg, prompt = pick(kind, label);
    card.style.setProperty('--k', rgba(KIND_RGB[kind], 1));
    card.replaceChildren();
    const x = button('×', true, clearCard); x.className = 'csp-x'; x.setAttribute('aria-label', 'Close');
    const k = document.createElement('div'); k.className = 'csp-kind'; k.textContent = kind === 'value' ? 'Your value' : KIND_NAME[kind];
    const h = document.createElement('div'); h.className = 'csp-label'; h.textContent = label || KIND_NAME[kind];
    const p = document.createElement('p'); p.className = 'csp-prompt'; p.textContent = prompt;
    const acts = document.createElement('div'); acts.className = 'csp-acts';
    if (kind === 'again') acts.append(button('Spin again', false, () => spin()));
    if (kind === 'choose') for (const kk of ['truth', 'dare']) acts.append(button(KIND_NAME[kk], true, () => {
      const q = pick(kk, KIND_NAME[kk]); k.textContent = 'Choose → ' + KIND_NAME[kk]; p.textContent = q;
      card.style.setProperty('--k', rgba(KIND_RGB[kk], 1)); acts.replaceChildren(); speak(`${KIND_NAME[kk]}! ${q}`);
    }));
    card.append(x, k, h, p); if (acts.childNodes.length) card.append(acts);
    card.hidden = false;
    speak(`${label || KIND_NAME[kind]}! ${prompt}`);
  }
  function clearCard() { card.hidden = true; card.replaceChildren(); if (typeof speechSynthesis !== 'undefined') try { speechSynthesis.cancel(); } catch (_) {} }

  // ---------------------------------------------------------------- sound (only after a gesture)
  function ensureAudio() {
    try { const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return; ac ||= new AC(); if (ac.state === 'suspended') ac.resume(); } catch (_) { ac = null; }
  }
  function blip(freq, dur, vol, type = 'square', at = 0) {
    if (!ac || ac.state !== 'running') return;
    const t = ac.currentTime + at, o = ac.createOscillator(), g = ac.createGain();
    o.type = type; o.frequency.value = freq; g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(ac.destination); o.start(t); o.stop(t + dur + 0.02);
  }
  const click = () => blip(2300, 0.025, 0.05);
  const chime = () => { blip(660, 0.35, 0.08, 'sine'); blip(990, 0.5, 0.07, 'sine', 0.12); };

  // ---------------------------------------------------------------- motion
  function spin() {
    ensureAudio(); clearCard(); landed = -1; dragging = false;
    omega = reduce.matches ? 900 + Math.random() * 500 : 1500 + Math.random() * 1100;
    counted = true; hint.textContent = 'Spinning…'; kick();
  }
  function friction() { return reduce.matches ? { k: 0.9, c: 120 } : { k: 0.35, c: 40 }; }   // ~3 s / ~8 s from a strong spin
  function step(dt) {
    clock += dt;
    if (!dragging && omega !== 0) {
      const { k, c } = friction(), s = Math.sign(omega), next = omega - s * (k * Math.abs(omega) + c) * dt;
      const prev = theta; theta += (omega + next) / 2 * dt;
      omega = Math.sign(next) === s ? next : 0;
      boundaries(prev, theta);
      if (Math.abs(omega) < 3) omega = 0;
      if (omega === 0) settle();
    }
    flashes = flashes.map((f) => Math.max(0, f - dt));
  }
  function boundaries(prev, now) {       // boundary LED under the pointer flashes as each boundary passes
    const sp = span(), a = Math.floor(-prev / sp), b = Math.floor(-now / sp);
    if (a === b || Math.abs(omega) > 900) return;
    const lo = Math.min(a, b) + 1, hi = Math.max(a, b);
    for (let kk = lo; kk <= hi; kk++) {
      const ba = mod(kk * sp, 360); let best = -1, bd = 1e9;
      cfg.leds.forEach((l, i) => { if (!isOuter(l)) return; const d = angDist(l.angle, ba); if (d < bd) { bd = d; best = i; } });
      if (best >= 0 && bd < sp / 3) flashes[best] = 0.16;
    }
    const t = performance.now(); if (t - lastClick > 28) { click(); lastClick = t; }
  }
  function settle() {
    if (!counted) { hint.textContent = 'Flick harder to play'; return; }
    counted = false; landed = segAt(underPointer());
    hint.textContent = 'Flick the wheel, or press Space'; chime(); showCard(cfg.segments[landed]);
  }

  // ---------------------------------------------------------------- pointer
  const geom = () => { const Rpx = Math.max(60, Math.min(W * 0.42, (H - 90) * 0.40)); return { cx: W / 2, cy: Math.max(Rpx * 1.25, (H - 64) / 2 + 8), Rpx, s: Rpx / cfg.R }; };
  const angleAt = (e) => { const r = canvas.getBoundingClientRect(), g = geom(), dx = e.clientX - r.left - g.cx, dy = e.clientY - r.top - g.cy; return { a: Math.atan2(dx, -dy) / D2R, d: Math.hypot(dx, dy), g }; };
  function onDown(e) {
    const { a, d, g } = angleAt(e);
    if (d > g.Rpx * 1.2) return;
    ensureAudio(); clearCard(); landed = -1; counted = false;
    dragging = true; omega = 0; pid = e.pointerId; lastA = a; samples = [{ t: performance.now(), th: theta }];
    try { canvas.setPointerCapture(pid); } catch (_) {}
    e.preventDefault(); kick();
  }
  function onMove(e) {
    if (!dragging || e.pointerId !== pid) return;
    const { a, d, g } = angleAt(e);
    if (d < g.Rpx * 0.18) { lastA = a; return; }       // too close to the hub: angle is jumpy
    const prev = theta; theta += mod(a - lastA + 180, 360) - 180; lastA = a;
    const t = performance.now(); samples.push({ t, th: theta }); while (samples.length > 2 && t - samples[0].t > 100) samples.shift();
    boundaries(prev, theta);
  }
  function onUp(e) {
    if (!dragging || e.pointerId !== pid) return;
    dragging = false; pid = null;
    const t = performance.now(), last = samples[samples.length - 1];
    const old = samples.find((s) => t - s.t <= 80) || samples[0];
    const dt = (last.t - old.t) / 1000;
    omega = dt > 0.008 && t - last.t < 60 ? Math.max(-4000, Math.min(4000, (last.th - old.th) / dt)) : 0;
    counted = Math.abs(omega) >= 300;
    if (!counted) hint.textContent = Math.abs(omega) > 20 ? 'Flick harder to play' : 'Flick the wheel, or press Space';
    kick();
  }
  function onKey(e) {
    if (e.code !== 'Space' && e.key !== ' ') return;
    if (!container.isConnected || !canvas.clientWidth) return;
    const t = e.target, tag = t && t.tagName;
    if (tag && /^(INPUT|TEXTAREA|SELECT|BUTTON)$/.test(tag) && t !== spinBtn || (t && t.isContentEditable)) return;
    if (t === spinBtn) return;      // the button's own click handles it
    e.preventDefault(); spin();
  }
  canvas.addEventListener('pointerdown', onDown);
  canvas.addEventListener('pointermove', onMove);
  canvas.addEventListener('pointerup', onUp);
  canvas.addEventListener('pointercancel', onUp);
  spinBtn.addEventListener('click', () => spin());
  window.addEventListener('keydown', onKey);

  // ---------------------------------------------------------------- drawing
  const P = (r, a) => [r * Math.sin(a * D2R), -r * Math.cos(a * D2R)];     // a: deg clockwise from north
  function arcText(text, ac_, rt, px) {
    ctx.font = `800 ${px}px ${colors.font}`;
    const widths = [...text].map((ch) => ctx.measureText(ch).width + px * 0.04);
    const total = widths.reduce((a, b) => a + b, 0) / rt / D2R;      // degrees
    const flip = ac_ > 90 && ac_ < 270;
    let cur = 0;
    [...text].forEach((ch, i) => {
      const w = widths[i] / rt / D2R, mid = cur + w / 2; cur += w;
      const a = flip ? ac_ + total / 2 - mid : ac_ - total / 2 + mid;
      ctx.save(); ctx.rotate(a * D2R); ctx.translate(0, -rt); if (flip) ctx.rotate(Math.PI);   // lower half: same spot, letter turned to read upright
      ctx.fillText(ch, 0, 0); ctx.restore();
    });
  }
  function fitPx(text, rt, avail, maxPx) {
    ctx.font = `800 ${maxPx}px ${colors.font}`;
    const w = [...text].reduce((a, ch) => a + ctx.measureText(ch).width + maxPx * 0.04, 0);
    return w <= avail ? maxPx : Math.max(maxPx * 0.45, maxPx * avail / w);
  }
  function lightFor(l, i, m, w) {       // returns [rgb, intensity] for a head (non-smear) draw
    const outer = isOuter(l);
    const segU = segAt(underPointer()), kind = cfg.segments[segU].kind;
    if (m === 'landed') {
      const on = ledInSeg(l, landed), k = KIND_RGB[cfg.segments[landed].kind];
      const pulse = reduce.matches ? 1 : 0.55 + 0.45 * Math.sin(clock * 5.2);
      return on ? [k, pulse] : [k, 0.06];
    }
    if (m === 'idle') return outer ? [[255, 255, 255], 0] : [[255, 220, 150], 0.18];
    if (m === 'tick') {
      if (outer) {
        if (reduce.matches) { const ba = Math.round(underPointer() / span()) * span(); return [[255, 255, 255], angDist(l.angle, ba) < 1 ? 0.7 : 0]; }
        return [[255, 255, 255], Math.min(1, (flashes[i] || 0) / 0.16)];
      }
      return [KIND_RGB[kind], 0.55];
    }
    if (m === 'chase') {
      if (outer) {
        const h = mod(-Math.sign(omega) * clock * 300, 360), d = angDist(w, h);
        const f = Math.max(Math.min(1, (flashes[i] || 0) / 0.16), Math.max(0, 1 - d / 70) ** 2);
        return [[255, 224, 140], reduce.matches ? 0.5 : f];
      }
      return [KIND_RGB[kind], 0.35];
    }
    return [[255, 255, 255], 0];
  }
  function draw() {
    if (!W || !H) return;
    const g = geom(), s = g.s, R = cfg.R, m = mode();
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, W, H);
    ctx.translate(g.cx, g.cy); ctx.scale(s, s);

    // shadow + disc (rotating frame)
    ctx.save();
    ctx.shadowColor = 'rgba(0,0,0,.35)'; ctx.shadowBlur = 14 * dpr; ctx.shadowOffsetY = 3;
    ctx.beginPath(); ctx.arc(0, 0, R, 0, Math.PI * 2); ctx.fillStyle = '#990000'; ctx.fill(); ctx.restore();
    ctx.save(); ctx.rotate(theta * D2R);
    const sp = span(), N = n();
    for (let i = 0; i < N; i++) {
      ctx.beginPath(); ctx.moveTo(0, 0); ctx.arc(0, 0, R - 0.6, (i * sp - 90) * D2R, ((i + 1) * sp - 90) * D2R); ctx.closePath();
      ctx.fillStyle = i % 2 ? 'rgba(255,204,0,.20)' : 'rgba(0,0,0,.04)'; ctx.fill();
      if (cfg.segments[i].kind !== 'value') { ctx.fillStyle = rgba(KIND_RGB[cfg.segments[i].kind], 0.10); ctx.fill(); }
    }
    ctx.strokeStyle = 'rgba(255,255,255,.92)'; ctx.lineWidth = 0.7;
    for (let i = 0; i < N; i++) { const [x0, y0] = P(11.5, i * sp), [x1, y1] = P(R - 0.6, i * sp); ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke(); }
    ctx.beginPath(); ctx.arc(0, 0, R - 0.5, 0, Math.PI * 2); ctx.strokeStyle = 'rgba(255,204,0,.85)'; ctx.lineWidth = 0.9; ctx.stroke();
    // labels between the two LED rings
    ctx.fillStyle = '#fff'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    const rt = 26.2;
    cfg.segments.forEach((seg, i) => {
      const t = (seg.label || KIND_NAME[seg.kind]).toUpperCase();
      arcText(t, i * sp + sp / 2, rt, fitPx(t, rt, (sp - 9) * D2R * rt, 4.6));
    });
    // north arrow on the disc (spin-the-bottle pointer)
    ctx.beginPath(); ctx.moveTo(0, -R + 1.2); ctx.lineTo(-2.2, -R + 4.8); ctx.lineTo(2.2, -R + 4.8); ctx.closePath(); ctx.fillStyle = '#fff'; ctx.fill();
    // unlit windows
    for (const l of cfg.leds) { const [x, y] = P(l.r, l.angle); ctx.beginPath(); ctx.arc(x, y, WIN_MM, 0, Math.PI * 2); ctx.fillStyle = '#efe9dd'; ctx.fill(); ctx.strokeStyle = 'rgba(0,0,0,.25)'; ctx.lineWidth = 0.35; ctx.stroke(); }
    ctx.restore();

    // lights, drawn in the world frame
    ctx.save(); ctx.globalCompositeOperation = dark.matches ? 'lighter' : 'source-over';
    const dir = Math.sign(omega) || 1, sweep = Math.min(360, Math.abs(omega) * PERSIST);
    cfg.leds.forEach((l, i) => {
      const head = mod(l.angle + theta, 360), outer = isOuter(l);
      if (m === 'pov' || (m === 'chase' && sweep > 6)) {
        const stepN = Math.max(1, Math.ceil(sweep / 4)), st = sweep / stepN;
        ctx.lineWidth = WIN_MM * 1.8; ctx.lineCap = 'butt';
        for (let k = 0; k < stepN; k++) {
          const w0 = head - dir * k * st, w1 = head - dir * (k + 1) * st;
          let c, a;
          if (m === 'pov') { c = outer ? povOuter(mod(w0, 360), clock) : povInner(mod(w0, 360)); a = 0.9 * (1 - k / stepN) ** 0.6; }
          else { const [cc, ii] = lightFor(l, i, m, mod(w0, 360)); c = cc; a = ii * (1 - k / stepN); }
          if (!c || a < 0.02) continue;
          ctx.beginPath(); ctx.arc(0, 0, l.r, (Math.min(w0, w1) - 90) * D2R, (Math.max(w0, w1) - 90) * D2R + 0.002); ctx.strokeStyle = rgba(c, a); ctx.stroke();
        }
        if (m === 'pov') return;
      }
      const [c, inten] = lightFor(l, i, m, head);
      if (inten < 0.02) return;
      const [x, y] = P(l.r, head);
      ctx.save(); ctx.shadowColor = rgba(c, 0.9); ctx.shadowBlur = 16 * dpr * inten;
      ctx.beginPath(); ctx.arc(x, y, WIN_MM, 0, Math.PI * 2); ctx.fillStyle = rgba(c, Math.min(1, 0.25 + inten)); ctx.fill();
      ctx.beginPath(); ctx.arc(x, y, WIN_MM * 0.45, 0, Math.PI * 2); ctx.fillStyle = `rgba(255,255,255,${0.7 * inten})`; ctx.fill();
      ctx.restore();
    });
    ctx.restore();

    // still centre cap
    ctx.save(); ctx.shadowColor = 'rgba(0,0,0,.35)'; ctx.shadowBlur = 6 * dpr;
    ctx.beginPath(); ctx.arc(0, 0, 11, 0, Math.PI * 2); ctx.fillStyle = colors.panel; ctx.fill(); ctx.restore();
    ctx.beginPath(); ctx.arc(0, 0, 11, 0, Math.PI * 2); ctx.strokeStyle = colors.muted; ctx.lineWidth = 0.5; ctx.stroke();
    ctx.beginPath(); ctx.arc(0, 0, 7.5, 0, Math.PI * 2); ctx.strokeStyle = 'rgba(128,128,128,.35)'; ctx.lineWidth = 0.4; ctx.stroke();
    ctx.beginPath(); ctx.arc(0, 0, 1.4, 0, Math.PI * 2); ctx.fillStyle = colors.muted; ctx.fill();

    // fixed pointer, outside the disc
    ctx.beginPath(); ctx.moveTo(0, -R + 0.5); ctx.lineTo(-4.2, -R - 7.5); ctx.lineTo(4.2, -R - 7.5); ctx.closePath();
    ctx.fillStyle = '#ffcc00'; ctx.fill(); ctx.strokeStyle = colors.ink; ctx.lineWidth = 0.7; ctx.lineJoin = 'round'; ctx.stroke();

    const rpm = Math.round(Math.abs(omega) / 6);
    read.textContent = `${rpm} rpm · ${{ pov: 'POV rings', chase: 'chase', tick: 'ticker', landed: 'landed', idle: 'idle' }[m]}`;
  }

  // ---------------------------------------------------------------- loop + resize
  function frame(t) {
    raf = 0;
    if (!canvas.clientWidth) return;                     // hidden tab: stop; resize restarts
    const dt = Math.min(0.05, Math.max(0, (t - lastT) / 1000)); lastT = t;
    step(dt); draw();
    const busy = dragging || omega !== 0 || flashes.some((f) => f > 0) || (landed >= 0 && !reduce.matches);
    if (busy) raf = requestAnimationFrame(frame);
  }
  function kick() { if (!raf) { lastT = performance.now(); raf = requestAnimationFrame(frame); } }
  function resize() {
    const r = container.getBoundingClientRect(); W = Math.round(r.width); H = Math.round(r.height);
    dpr = Math.min(3, window.devicePixelRatio || 1);
    canvas.width = Math.max(1, Math.round(W * dpr)); canvas.height = Math.max(1, Math.round(H * dpr));
    draw(); kick();
  }
  const ro = new ResizeObserver(resize); ro.observe(container);
  const onScheme = () => { readColors(); draw(); };
  dark.addEventListener?.('change', onScheme);

  cfg = normalize(getConfig && getConfig()); readColors(); resize();

  return {
    refresh() { cfg = normalize(getConfig && getConfig()); bags = {}; if (landed >= n()) landed = -1; readColors(); draw(); kick(); },
    destroy() {
      if (raf) cancelAnimationFrame(raf); raf = 0; ro.disconnect();
      window.removeEventListener('keydown', onKey); dark.removeEventListener?.('change', onScheme);
      if (typeof speechSynthesis !== 'undefined') try { speechSynthesis.cancel(); } catch (_) {}
      if (ac) try { ac.close(); } catch (_) {}
      root.remove(); style.remove();
    },
  };
}
