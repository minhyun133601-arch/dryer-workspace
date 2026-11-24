import * as THREE from '../shared/vendor/three.module.js';

// Broad ceiling lights and a darker horizon leave readable highlights on
// curved stainless steel without an external panorama or another scene pass.
export function equipmentReflection(scene) {
  const width = 256, height = 128;
  const data = new Uint8Array(width * height * 4);
  for (let y = 0; y < height; y++) {
    const v = y / height;
    for (let x = 0; x < width; x++) {
      const u = x / width;
      const skylight = v > .53 && v < .84 && ((u > .08 && u < .19) || (u > .5 && u < .71));
      const overhead = v > .82 && v < .92 && Math.cos(u * Math.PI * 6) > .26;
      const value = skylight ? 224 : overhead ? 245 : v < .46 ? 38 + 48 * v : 58 + 44 * v;
      const i = (y * width + x) * 4;
      data.set([value, value * .995, Math.min(255, value * 1.015), 255], i);
    }
  }
  const texture = new THREE.DataTexture(data, width, height, THREE.RGBAFormat);
  texture.mapping = THREE.EquirectangularReflectionMapping;
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.magFilter = texture.minFilter = THREE.LinearFilter;
  texture.needsUpdate = true;
  scene.environment = texture;
  scene.environmentIntensity = .65;
  return texture;
}
