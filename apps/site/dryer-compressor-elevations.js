import * as THREE from '../shared/vendor/three.module.js';

// Axes are local to each installed model. Left and right are viewed from
// the front, following the field survey's four-photo sheets.
export function elevationAxes(frontAxis, view) {
  const localAxes = {x:[1,0,0], '-x':[-1,0,0], z:[0,0,1], '-z':[0,0,-1]};
  const front = new THREE.Vector3(...localAxes[frontAxis]);
  const right = new THREE.Vector3(front.z, 0, -front.x);
  const up = new THREE.Vector3(0, 1, 0);
  if (view === 'top') return { direction: up, up: front.clone().negate() };
  const direction = {front, left: right.clone().negate(), right, rear: front.clone().negate()}[view];
  return { direction, up };
}

// Render the live assembly without moving its scene, camera or equipment.
// The photo tab can also be opened while the plant's floor is hidden.
export function drawEquipmentElevation(site, station, frontAxis, view, canvas) {
  const renderer = site?.renderer;
  const ctx = canvas.getContext('2d');
  if (!renderer || !ctx || !station) return false;
  const assembly = station.clone(true);
  assembly.position.set(0, 0, 0);
  assembly.quaternion.identity();
  assembly.visible = true;
  assembly.updateMatrixWorld(true);
  const bounds = new THREE.Box3();
  assembly.traverseVisible(node => {
    if (node.isSprite) node.visible = false;
    if (!node.isMesh) return;
    const shape = node.isInstancedMesh ? node : node.geometry;
    if (!shape.boundingBox) shape.computeBoundingBox();
    bounds.union(shape.boundingBox.clone().applyMatrix4(node.matrixWorld));
  });
  if (bounds.isEmpty()) return false;

  const drawing = new THREE.Scene();
  drawing.background = new THREE.Color(0xf6f8f7);
  drawing.environment = site.scene?.environment || null;
  const { direction, up } = elevationAxes(frontAxis, view);
  const right = new THREE.Vector3().crossVectors(up, direction);
  const size = bounds.getSize(new THREE.Vector3());
  const center = bounds.getCenter(new THREE.Vector3());
  const span = axis => Math.abs(axis.x)*size.x + Math.abs(axis.y)*size.y + Math.abs(axis.z)*size.z;
  const ratio = canvas.width / canvas.height;
  const height = Math.max(span(up), span(right)/ratio, .15) * 1.23;
  const distance = size.length() + 1;
  const camera = new THREE.OrthographicCamera(-height*ratio/2, height*ratio/2, height/2, -height/2, .01, 3*distance);
  camera.position.copy(center).addScaledVector(direction, distance);
  camera.up.copy(up);
  camera.lookAt(center);
  drawing.add(assembly, new THREE.HemisphereLight(0xffffff, 0xb7c1bf, 1.7));
  const light = new THREE.DirectionalLight(0xfff7e9, 2.2);
  light.position.copy(center).addScaledVector(direction, distance).addScaledVector(up, distance*.85).addScaledVector(right, -distance*.48);
  light.target.position.copy(center);
  drawing.add(light, light.target);

  const target = new THREE.WebGLRenderTarget(canvas.width, canvas.height, {colorSpace: THREE.SRGBColorSpace});
  const previous = renderer.getRenderTarget();
  const cubeFace = renderer.getActiveCubeFace(), mipLevel = renderer.getActiveMipmapLevel();
  try {
    renderer.setRenderTarget(target);
    renderer.render(drawing, camera);
    const pixels = new Uint8Array(canvas.width * canvas.height * 4);
    renderer.readRenderTargetPixels(target, 0, 0, canvas.width, canvas.height, pixels);
    const img = ctx.createImageData(canvas.width, canvas.height);
    const stride = canvas.width * 4;
    for (let y=0; y<canvas.height; y++) {
      const offset = (canvas.height-1-y)*stride;
      img.data.set(pixels.subarray(offset, offset+stride), y*stride);
    }
    ctx.putImageData(img, 0, 0);
    // Metric scale is computed from the orthographic frustum, including for
    // the plan view. Body dimensions are documented separately from piping.
    const metres = [.1, .2, .5, 1, 2, 5].filter(m => m <= height*ratio*.26).pop() || .05;
    const length = metres*canvas.height/height;
    ctx.fillStyle = '#284747';
    ctx.fillRect(18, canvas.height-16, length, 2);
    for (const x of [18, 18+length]) ctx.fillRect(x, canvas.height-21, 2, 7);
    ctx.font = '16px sans-serif';
    ctx.fillText(metres + ' m', 18, canvas.height-25);
  } finally {
    renderer.setRenderTarget(previous, cubeFace, mipLevel);
    target.dispose();
    // Cloned instances own their instance buffers. Geometry, textures and
    // material still belong to the running plant scene.
    assembly.traverse(node => { if (node.isInstancedMesh) node.dispose(); });
  }
  return true;
}
