import * as THREE from '../shared/vendor/three.module.js';

// Shared point-based navigation for the chiller detail; every movement redraws on demand.
export function createDetailCamera(canvas, camera, { objects, draw, select }) {
  const target = new THREE.Vector3(0, 1.1, 0);
  const orbit = { azimuth: .57, elevation: .32, distance: 8 };
  const pointers = new Map(), ray = new THREE.Raycaster(), plane = new THREE.Plane();
  const abort = new AbortController();
  let gesture, tap, clickTimer, lastTouchZoom = -Infinity, home;
  function update() {
    const d = orbit.distance;
    camera.position.set(target.x + Math.sin(orbit.azimuth) * Math.cos(orbit.elevation) * d, target.y + Math.sin(orbit.elevation) * d, target.z + Math.cos(orbit.azimuth) * Math.cos(orbit.elevation) * d);
    camera.near = Math.max(.008, Math.min(.15, d / 100)); camera.far = Math.max(200, d * 4);
    camera.lookAt(target); camera.updateProjectionMatrix(); camera.updateMatrixWorld(); draw();
  }
  function cast(x, y) {
    const rect = canvas.getBoundingClientRect();
    ray.setFromCamera(new THREE.Vector2((x - rect.left) / rect.width * 2 - 1, 1 - (y - rect.top) / rect.height * 2), camera);
    return ray.intersectObjects(objects(), true).find((hit) => {
      for (let object = hit.object; object; object = object.parent) if (!object.visible) return false;
      return true;
    });
  }
  function point(x, y) {
    const hit = cast(x, y); if (hit) return hit.point;
    plane.setFromNormalAndCoplanarPoint(camera.getWorldDirection(new THREE.Vector3()), target);
    return ray.ray.intersectPlane(plane, new THREE.Vector3()) || target.clone();
  }
  function zoom(factor, x, y) {
    const old = orbit.distance, next = THREE.MathUtils.clamp(old * factor, .12, home ? 600 : 180);
    if (x !== undefined) target.lerp(point(x, y), 1 - next / old);
    orbit.distance = next; update();
  }
  function pan(dx, dy) {
    const scale = 2 * orbit.distance * Math.tan(THREE.MathUtils.degToRad(camera.fov / 2)) / Math.max(1, canvas.getBoundingClientRect().height);
    target.addScaledVector(new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld, 0), -dx * scale);
    target.addScaledVector(new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld, 1), dy * scale); update();
  }
  const on = (name, fn, options = {}) => canvas.addEventListener(name, fn, { ...options, signal: abort.signal });
  const pair = () => {
    const [a, b] = [...pointers.values()];
    return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, distance: Math.hypot(a.x - b.x, a.y - b.y) };
  };
  on('contextmenu', (event) => event.preventDefault());
  on('wheel', (event) => { event.preventDefault(); zoom(Math.exp(THREE.MathUtils.clamp(event.deltaY, -400, 400) * .0015), event.clientX, event.clientY); }, { passive: false });
  on('dblclick', (event) => { event.preventDefault(); clearTimeout(clickTimer); if (performance.now() - lastTouchZoom < 650) return; zoom(.42, event.clientX, event.clientY); });
  on('pointerdown', (event) => {
    clearTimeout(clickTimer);
    canvas.focus(); canvas.setPointerCapture(event.pointerId);
    pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (pointers.size === 1) gesture = { x: event.clientX, y: event.clientY, moved: false, pan: event.button !== 0 || event.shiftKey };
    else { gesture.moved = true; gesture.pair = pair(); }
  });
  on('pointermove', (event) => {
    const previous = pointers.get(event.pointerId); if (!previous || !gesture) return;
    pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
    if (pointers.size > 1) {
      const current = pair(), old = gesture.pair || current;
      pan(current.x - old.x, current.y - old.y);
      if (old.distance > 2 && current.distance > 2) zoom(old.distance / current.distance, current.x, current.y);
      gesture.pair = current; gesture.moved = true; return;
    }
    if (!gesture.moved && Math.hypot(event.clientX - gesture.x, event.clientY - gesture.y) < 4) return;
    gesture.moved = true;
    const dx = event.clientX - previous.x, dy = event.clientY - previous.y;
    if (gesture.pan) pan(dx, dy);
    else { orbit.azimuth -= dx * .007; orbit.elevation = THREE.MathUtils.clamp(orbit.elevation + dy * .006, -.8, 1.56); update(); }
  });
  function release(event) {
    if (!pointers.has(event.pointerId)) return;
    const clicked = pointers.size === 1 && gesture && !gesture.moved && event.button === 0;
    pointers.delete(event.pointerId);
    if (!pointers.size) gesture = null;
    if (event.type === 'pointercancel') { tap = null; return; }
    if (!clicked) return;
    const now = performance.now(), hit = cast(event.clientX, event.clientY);
    if (event.pointerType === 'touch' && tap && now - tap.time < 420 && Math.hypot(event.clientX - tap.x, event.clientY - tap.y) < 28) {
      clearTimeout(clickTimer); tap = null; lastTouchZoom = now; zoom(.42, event.clientX, event.clientY); return;
    }
    tap = { time: now, x: event.clientX, y: event.clientY };
    clearTimeout(clickTimer); clickTimer = setTimeout(() => select(hit), 430);
  }
  on('pointerup', release); on('pointercancel', release);
  on('keydown', (event) => { if (event.key.toLowerCase() === 'r') { event.preventDefault(); reset(); } });
  function reset(exploded = false) { target.set(...(home?.target || [0, exploded ? 1.5 : 1.1, 0])); Object.assign(orbit, home?.orbit || { azimuth: .57, elevation: .32, distance: exploded ? 11 : 8 }); update(); }
  return {
    update, zoom, reset,
    setHome(point, distance, azimuth = .57, elevation = .65) { home = { target: point.toArray(), orbit: { distance, azimuth, elevation } }; reset(); },
    focus(point, distance = 2.1) { target.copy(point); orbit.distance = distance; update(); },
    view(name) {
      Object.assign(orbit, name === 'top' ? { azimuth: 0, elevation: 1.56 } : name === 'front' ? { azimuth: 0, elevation: .02 } : name === 'side' ? { azimuth: Math.PI / 2, elevation: .02 } : { azimuth: .57, elevation: .32 }); update();
    },
    dispose() { clearTimeout(clickTimer); pointers.clear(); abort.abort(); },
  };
}
