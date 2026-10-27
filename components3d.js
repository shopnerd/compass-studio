// components3d.js — the Spin Compass electronics drawn as the real parts (for the viewer only, not printed).
// Each builder returns a THREE.Group in part space: x = across (tangential), y = outward (radial), z up from the
// part's underside, centred on the part's footprint. app.js turns and places it where the layout put the part.
import * as THREE from 'three';

const mats = {};
function M(color, { rough = 0.55, metal = 0.05, emissive } = {}) {
  const k = color + rough + metal + (emissive || '');
  return mats[k] ||= new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: metal, ...(emissive ? { emissive, emissiveIntensity: 0.6 } : {}) });
}
const SILVER = () => M('#c9cdd2', { rough: 0.3, metal: 0.55 }), GOLD = () => M('#d4a83a', { rough: 0.35, metal: 0.6 });
function box(g, w, d, h, x, y, z, mat) { const m = new THREE.Mesh(new THREE.BoxGeometry(w, d, h), mat); m.position.set(x, y, z + h / 2); g.add(m); return m; }
function disc(g, r, h, x, y, z, mat, seg = 40) { const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, h, seg), mat); m.rotation.x = Math.PI / 2; m.position.set(x, y, z + h / 2); g.add(m); return m; }
function pads(g, n, x0, x1, y, z, w = 0.9, d = 1.2) { for (let i = 0; i < n; i++) box(g, w, d, 0.05, x0 + (x1 - x0) * (n > 1 ? i / (n - 1) : 0.5), y, z, GOLD()); }

// Seeed XIAO ESP32-S3: PCB, RF shield can, USB-C at the outer end (it pokes through the rim slot), castellated pads.
function xiao(p) {
  const g = new THREE.Group(), W = p.tang, D = p.radial, t = 1.0;
  box(g, W, D, t, 0, 0, 0, M('#1f2d4a'));
  box(g, 12.5, 10.5, 2.0, 0, -2.6, t, SILVER());
  box(g, 8.9, 7.3, 2.6, 0, D / 2 - 3.65 + 0.6, t, SILVER());
  for (const s of [-1, 1]) for (let i = 0; i < 7; i++) box(g, 1.4, 0.9, 0.05, s * (W / 2 - 0.7), -D / 2 + 2.4 + i * (D - 4.8) / 6, t, GOLD());   // castellated pads down both long sides
  box(g, 1.6, 2.6, 0.9, -W / 2 + 3, D / 2 - 9, t, M('#e8e8e8'));   // boot / reset buttons
  box(g, 1.6, 2.6, 0.9, W / 2 - 3, D / 2 - 9, t, M('#e8e8e8'));
  return g;
}
// LiPo pouch with its protection board and leads.
function lipo(p) {
  const g = new THREE.Group(), W = p.tang, D = p.radial, H = p.h;
  const pouch = new THREE.Mesh(new THREE.BoxGeometry(W - 2.6, D, H, 1, 1, 1), M('#c3c8cf', { rough: 0.35, metal: 0.45 }));
  pouch.position.set(-1.3, 0, H / 2); g.add(pouch);
  box(g, 2.4, D - 2, H * 0.55, W / 2 - 1.3, 0, H * 0.22, M('#2f6e45'));                  // protection board on the cell's end
  box(g, 2.6, 1.0, 0.8, W / 2 + 0.2, -1.2, H * 0.4, M('#c0392b'));                      // red and black leads
  box(g, 2.6, 1.0, 0.8, W / 2 + 0.2, 1.2, H * 0.4, M('#1b1b1b'));
  return g;
}
// Adafruit MAX98357A: PCB, the amp chip, a row of header pads, speaker pads.
function amp(p) {
  const g = new THREE.Group(), W = p.tang, D = p.radial, t = 1.6;
  box(g, W, D, t, 0, 0, 0, M('#2b2f63'));
  box(g, 3, 3, 0.8, 0, 1, t, M('#151515'));
  pads(g, 7, -W / 2 + 2, W / 2 - 2, -D / 2 + 1.4, t);
  pads(g, 2, -2.5, 2.5, D / 2 - 1.6, t, 2, 2);
  return g;
}
// Motion sensor carriers: Adafruit (black, two STEMMA QT sockets), Pololu (green), SparkFun Micro (red).
function imu(p, kind) {
  const g = new THREE.Group(), W = p.tang, D = p.radial, t = 1.6;
  const col = kind === 'pololu' ? '#1e6b3b' : kind === 'ism330' ? '#c5302b' : '#20242b';
  box(g, W, D, t, 0, 0, 0, M(col));
  box(g, 2.5, 3, 0.9, 0, 0.5, t, M('#151515'));
  if (kind === 'dsox' || !kind) { box(g, 4.2, 6, 2.9, -W / 2 + 2.4, 0, t, M('#f2f2f2')); box(g, 4.2, 6, 2.9, W / 2 - 2.4, 0, t, M('#f2f2f2')); }
  pads(g, kind === 'ism330' ? 4 : 9, -W / 2 + 2.5, W / 2 - 2.5, -D / 2 + 1.2, t);
  return g;
}
// Speaker, cone down over the floor grille: frame ring, magnet cup, solder tabs on the back.
function speaker(p) {
  const g = new THREE.Group(), r = p.d / 2, H = p.h;
  disc(g, r, H * 0.45, 0, 0, 0, M('#232323'), 48);
  disc(g, r * 0.55, H, 0, 0, 0, M('#3a3a3a', { rough: 0.4, metal: 0.4 }), 40);
  box(g, 1.6, 2.4, 0.3, -r * 0.7, 0, H * 0.45, GOLD()); box(g, 1.6, 2.4, 0.3, r * 0.7, 0, H * 0.45, GOLD());
  return g;
}
// US5881 in TO-92S, laid flat in the hub, legs running outward to the wire slot.
function hall(p) {
  const g = new THREE.Group();
  box(g, p.tang, p.radial, p.h, 0, 0, 0, M('#151515'));
  for (const x of [-1.27, 0, 1.27]) box(g, 0.4, 5, 0.25, x, p.radial / 2 + 2.5, p.h / 2 - 0.12, SILVER());
  return g;
}
const BUILD = { board: xiao, battery: lipo, amp, imu, speaker, hall };

export function partModel(p, info) {
  const fn = BUILD[p.key];
  if (fn) return fn(p, info.imu);
  const g = new THREE.Group(); box(g, p.tang || p.d, p.radial || p.d, p.h, 0, 0, 0, M('#888')); return g;
}
// WS2812B on its Ø10 round board, chip up into the lid pocket; lit.
export function ledModel() {
  const g = new THREE.Group();
  disc(g, 5, 1.0, 0, 0, 0, M('#1b1b1b'), 32);
  box(g, 5, 5, 1.6, 0, 0, 1.0, M('#f4f1e8'));
  disc(g, 1.9, 0.1, 0, 0, 2.6, M('#fff3c4', { emissive: '#ffd36b' }), 24);
  pads(g, 3, -3.2, 3.2, -3.9, 1.0, 1.2, 1.2);
  return g;
}
export function magnetModel() { const g = new THREE.Group(); disc(g, 1.585, 1.59, 0, 0, 0, SILVER(), 24); return g; }
// M2 countersunk screw, head flush with the face at z = 0, pointing down.
export function screwModel(len = 8) {
  const g = new THREE.Group(), s = SILVER();
  const head = new THREE.Mesh(new THREE.CylinderGeometry(1.9, 1.0, 1.2, 24), s); head.rotation.x = Math.PI / 2; head.position.z = -0.6; g.add(head);
  const shank = new THREE.Mesh(new THREE.CylinderGeometry(1.0, 1.0, len - 1.2, 16), s); shank.rotation.x = Math.PI / 2; shank.position.z = -1.2 - (len - 1.2) / 2; g.add(shank);
  return g;
}
export const PART_SWATCH = { board: '#1f2d4a', battery: '#c3c8cf', speaker: '#232323', amp: '#2b2f63', imu: '#20242b', hall: '#151515' };
