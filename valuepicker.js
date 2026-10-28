// valuepicker.js — the value boxes search ValueCore's character values as you type.
// Each suggestion shows its category and a dot for how it prints on the current model:
// green = full size or close to it, amber = the letters shrink, red = will not fit (then the short form is offered, if there is one).
// Free typing still works; the picker only suggests.
import { VALUES, CATEGORY } from './data/valuecore.js';

const byName = new Map(VALUES.map(v => [v.n.toLowerCase(), v]));
for (const v of VALUES) if (v.p && !byName.has(v.p.toLowerCase())) byName.set(v.p.toLowerCase(), { ...v, n: v.p, c: v.pc, s: v.ps, p: null, shortOf: v.n });

// size on this model, and how it rates: ok | shrinks | no
function rate(v, model) {
  const size = model === 'spin' ? v.s : v.c, full = model === 'spin' ? 4.6 : 8.2, good = model === 'spin' ? 3.6 : 7;
  return { size, fit: !size ? 'no' : size >= good ? 'ok' : 'shrinks', full: size >= full - 0.05 };
}
const FIT_TEXT = { ok: 'prints well', shrinks: 'letters shrink to fit', no: 'too long to print' };
export const lookupValue = (name) => byName.get(String(name || '').trim().toLowerCase()) || null;

export function mountValuePicker(inputs, { model, onPick, defBox }) {
  const list = document.createElement('ul'); list.className = 'vpick'; list.setAttribute('role', 'listbox'); list.hidden = true;
  let input = null, rows = [], hi = -1;

  function showDef(el) {
    if (!defBox) return;
    const v = lookupValue(el && el.value);
    if (!v) { defBox.hidden = true; return; }
    const r = rate(v, model());
    defBox.hidden = false;
    defBox.innerHTML = '';
    const head = document.createElement('div'); head.className = 'vdef-head';
    const b = document.createElement('b'); b.textContent = v.shortOf ? `${v.n} (${v.shortOf})` : v.n;
    const tag = document.createElement('span'); tag.className = 'vcat'; tag.textContent = CATEGORY[v.k];
    const fit = document.createElement('span'); fit.className = 'vfit ' + r.fit; fit.textContent = r.size ? `${r.full ? 'prints full size' : FIT_TEXT[r.fit]} · ${r.size.toFixed(1)} mm` : FIT_TEXT.no;
    head.append(b, tag, fit);
    const d = document.createElement('p'); d.textContent = v.d;
    defBox.append(head, d);
    if (v.x && v.x.length) { const ul = document.createElement('ul'); for (const e of v.x) { const li = document.createElement('li'); li.textContent = e; ul.append(li); } defBox.append(ul); }
  }

  function render() {
    const q = input.value.trim().toLowerCase(), m = model();
    const scored = [];
    for (const v of VALUES) {
      const n = v.n.toLowerCase(), i = n.indexOf(q);
      const score = !q ? 2 : n === q ? 0 : i === 0 ? 1 : i > 0 ? 2 : v.d.toLowerCase().includes(q) ? 3 : -1;
      if (score >= 0) scored.push([score, v]);
    }
    scored.sort((a, b) => a[0] - b[0] || a[1].n.localeCompare(b[1].n));
    rows = scored.slice(0, 60).map(s => s[1]);
    list.innerHTML = ''; hi = -1;
    rows.forEach((v, i) => {
      const r = rate(v, m), li = document.createElement('li');
      li.setAttribute('role', 'option'); li.id = 'vpick-' + i;
      const dot = document.createElement('i'); dot.className = 'vdot ' + r.fit; dot.title = FIT_TEXT[r.fit];
      const name = document.createElement('span'); name.className = 'vname'; name.textContent = v.n;
      li.append(dot, name);
      if (r.fit === 'no' && v.p) { const s = document.createElement('span'); s.className = 'vshort'; s.textContent = '→ ' + v.p; li.append(s); }
      const tag = document.createElement('span'); tag.className = 'vcat'; tag.textContent = CATEGORY[v.k]; li.append(tag);
      li.addEventListener('mousedown', (e) => { e.preventDefault(); pick(v); });
      list.append(li);
    });
    if (!rows.length) { const li = document.createElement('li'); li.className = 'vnone'; li.textContent = 'Not in the ValueCore list. You can still use it.'; list.append(li); }
  }
  function open(el) {
    input = el; el.closest('label').append(list); list.hidden = false;
    el.setAttribute('aria-expanded', 'true'); render(); showDef(el);
  }
  function close() { list.hidden = true; if (input) input.setAttribute('aria-expanded', 'false'); }
  function move(d) {
    if (!rows.length) return;
    hi = (hi + d + rows.length) % rows.length;
    [...list.children].forEach((li, i) => li.classList.toggle('hi', i === hi));
    const li = list.children[hi]; li.scrollIntoView({ block: 'nearest' }); input.setAttribute('aria-activedescendant', li.id);
  }
  function pick(v) {
    const r = rate(v, model());
    input.value = r.fit === 'no' && v.p ? v.p : v.n;
    close(); showDef(input);
    input.dispatchEvent(new Event('input', { bubbles: true }));
    if (onPick) onPick(input, v);
  }
  for (const el of inputs) {
    el.setAttribute('role', 'combobox'); el.setAttribute('aria-autocomplete', 'list'); el.setAttribute('aria-expanded', 'false');
    el.addEventListener('focus', () => open(el));
    el.addEventListener('input', (e) => { if (e.isTrusted) { if (list.hidden || input !== el) open(el); else render(); showDef(el); } });
    el.addEventListener('blur', () => setTimeout(close, 120));
    el.addEventListener('keydown', (e) => {
      if (list.hidden) { if (e.key === 'ArrowDown') { open(el); e.preventDefault(); } return; }
      if (e.key === 'ArrowDown') { move(1); e.preventDefault(); }
      else if (e.key === 'ArrowUp') { move(-1); e.preventDefault(); }
      else if (e.key === 'Enter' && hi >= 0) { pick(rows[hi]); e.preventDefault(); }
      else if (e.key === 'Escape') { close(); e.preventDefault(); }
    });
  }
  return { refresh: () => { if (!list.hidden && input) render(); showDef(input || inputs[0]); }, showDef };
}

// ?values=Integrity,Courage,Empathy,Curiosity[,…up to 8]&name=…&model=spin — the link ValueCore's "Print my compass" opens
export function readLink(search = location.search) {
  const q = new URLSearchParams(search);
  const raw = q.get('values'); if (!raw) return null;
  const words = raw.split(',').map(s => s.trim()).filter(Boolean).slice(0, 8);
  if (!words.length) return null;
  const m = q.get('model'), model = m === 'spin' || m === 'compass' ? m : (words.length > 4 ? 'spin' : null);
  const values = words.map(s => {   // ValueCore's spelling; its short form when the full name will not print
    const v = lookupValue(s); if (!v) return s.slice(0, 28);
    return rate(v, model || 'compass').fit === 'no' && v.p ? v.p : v.n;
  });
  return { values, name: q.get('name') ? q.get('name').slice(0, 40) : null, model };
}
