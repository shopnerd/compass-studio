// Turntable orbit that follows the pointer: drag sideways spins about the world Z axis, drag up/down tumbles
// over the top or under the bottom with no stop at the poles. Right drag (or Shift/Ctrl drag) pans, the wheel
// zooms. Touch: one finger orbits, two fingers pinch to zoom and move to pan. No damping, so the part stops
// when the pointer stops.
import * as THREE from 'three';

const Z = new THREE.Vector3(0, 0, 1);

export function makeOrbit(camera, el, onChange) {
  const target = new THREE.Vector3();
  const pointers = new Map();
  let mode = null, last = null, pinch = null;
  const q = new THREE.Quaternion(), q2 = new THREE.Quaternion(), v = new THREE.Vector3(), right = new THREE.Vector3(), up = new THREE.Vector3();

  function rotateAbout(axis, angle) {
    q.setFromAxisAngle(axis, angle);
    v.copy(camera.position).sub(target).applyQuaternion(q);
    camera.position.copy(target).add(v);
    camera.quaternion.premultiply(q);
    camera.up.set(0, 1, 0).applyQuaternion(camera.quaternion);
  }
  function rotate(dx, dy) {
    const k = Math.PI / Math.max(200, el.clientHeight);   // half a turn per view height, the same both ways
    camera.updateMatrixWorld();
    up.setFromMatrixColumn(camera.matrixWorld, 1);
    // spin about the vertical axis; when the view is upside down the same drag has to turn the other way
    rotateAbout(Z, -dx * k * (up.z < -1e-6 ? -1 : 1));
    camera.updateMatrixWorld();
    right.setFromMatrixColumn(camera.matrixWorld, 0);
    rotateAbout(right, -dy * k);
  }
  function pan(dx, dy) {
    const dist = camera.position.distanceTo(target);
    const s = 2 * dist * Math.tan(camera.fov * Math.PI / 360) / Math.max(1, el.clientHeight);
    camera.updateMatrixWorld();
    right.setFromMatrixColumn(camera.matrixWorld, 0).multiplyScalar(-dx * s);
    up.setFromMatrixColumn(camera.matrixWorld, 1).multiplyScalar(dy * s);
    v.copy(right).add(up);
    camera.position.add(v); target.add(v);
  }
  function zoom(f) {
    v.copy(camera.position).sub(target);
    const d = THREE.MathUtils.clamp(v.length() * f, 15, 2000);
    camera.position.copy(target).add(v.setLength(d));
  }

  el.style.touchAction = 'none';
  el.addEventListener('contextmenu', e => e.preventDefault());
  el.addEventListener('pointerdown', e => {
    el.setPointerCapture(e.pointerId);
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointers.size === 1) {
      mode = (e.button === 2 || e.button === 1 || e.shiftKey || e.ctrlKey || e.metaKey) ? 'pan' : 'rotate';
      last = { x: e.clientX, y: e.clientY };
    } else if (pointers.size === 2) { mode = 'pinch'; pinch = null; }
  });
  el.addEventListener('pointermove', e => {
    if (!pointers.has(e.pointerId)) return;
    pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (mode === 'pinch' && pointers.size >= 2) {
      const [a, b] = [...pointers.values()];
      const now = { d: Math.hypot(a.x - b.x, a.y - b.y), x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
      if (pinch) { if (now.d > 1) zoom(pinch.d / now.d); pan(now.x - pinch.x, now.y - pinch.y); onChange(); }
      pinch = now; return;
    }
    if (!last) return;
    const dx = e.clientX - last.x, dy = e.clientY - last.y; last = { x: e.clientX, y: e.clientY };
    if (mode === 'rotate') rotate(dx, dy); else if (mode === 'pan') pan(dx, dy);
    onChange();
  });
  const end = e => {
    pointers.delete(e.pointerId);
    if (pointers.size === 1) { const p = [...pointers.values()][0]; mode = 'rotate'; last = { ...p }; pinch = null; }   // lifting one finger of two: carry on orbiting
    else if (!pointers.size) { mode = null; last = null; pinch = null; }
  };
  el.addEventListener('pointerup', end); el.addEventListener('pointercancel', end);
  el.addEventListener('wheel', e => {
    e.preventDefault();
    zoom(Math.exp(THREE.MathUtils.clamp(e.deltaY * (e.deltaMode ? 33 : 1), -200, 200) * 0.0012));
    onChange();
  }, { passive: false });

  return {
    target,
    // put the camera somewhere and aim it at the target with the given up direction
    set(pos, upVec) { camera.position.copy(pos); camera.up.copy(upVec); camera.lookAt(target); onChange(); },
  };
}
