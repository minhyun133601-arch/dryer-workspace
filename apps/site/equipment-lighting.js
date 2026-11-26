import * as THREE from '../shared/vendor/three.module.js';

// Factory interior reflection map: green epoxy floor bounce below the horizon,
// ivory panel walls + warm amber/daylight window bands around the horizon, and
// dark corrugated steel ceiling with bright LED high-bay luminaires overhead.
export function equipmentReflection(scene) {
  const width = 256, height = 128;
  const data = new Uint8Array(width * height * 4);
  for (let y = 0; y < height; y++) {
    const v = (y + .5) / height;
    for (let x = 0; x < width; x++) {
      const u = (x + .5) / width;
      let r, g, b;
      if (v < .42) {
        // Glossy deep green epoxy floor reflection on lower curved shells
        const t = v / .42;
        const patch = .5 + .5 * Math.sin(u * Math.PI * 10 + v * 9) * Math.cos(u * Math.PI * 6 - v * 5);
        r = 40 + 44 * t + 12 * patch;
        g = 68 + 46 * t + 14 * patch;
        b = 56 + 42 * t + 12 * patch;
      } else if (v < .72) {
        // Ivory sandwich-panel walls + two warm daylight/amber window bands
        const wt = (v - .42) / .30;
        const winBand = v > .48 && v < .65;
        const paneA = winBand && u > .07 && u < .27 && Math.abs(((u - .07) * 25) % 1 - .5) < .43;
        const paneB = winBand && u > .54 && u < .78 && Math.abs(((u - .54) * 25) % 1 - .5) < .43;
        const mullion = winBand && Math.abs(v - .565) < .012;
        if ((paneA || paneB) && !mullion) {
          const amber = paneB ? 1 : .45;
          r = 246;
          g = Math.round(240 - 16 * amber);
          b = Math.round(228 - 50 * amber);
        } else {
          const seam = Math.abs((wt * 4) % 1 - .5) > .46 ? -14 : 0;
          const base = 188 + 24 * (1 - Math.abs(wt - .45)) + seam;
          r = base + 5;
          g = base + 3;
          b = base - 8;
        }
      } else {
        // Dark gray corrugated steel deckplate + cream beams + bright LED bays
        const ct = (v - .72) / .28;
        const rib = Math.sin(u * Math.PI * 48) * 10;
        const beam = Math.abs((u * 6) % 1 - .5) < .045;
        const led = v > .80 && v < .91 && Math.cos(u * Math.PI * 8) > .58;
        if (led) {
          r = 255; g = 253; b = 246;
        } else if (beam) {
          r = 208; g = 203; b = 186;
        } else {
          const deck = 82 + 18 * (1 - ct) + rib;
          r = deck - 2; g = deck + 2; b = deck + 6;
        }
      }
      const i = (y * width + x) * 4;
      data[i] = Math.max(0, Math.min(255, r));
      data[i + 1] = Math.max(0, Math.min(255, g));
      data[i + 2] = Math.max(0, Math.min(255, b));
      data[i + 3] = 255;
    }
  }
  const texture = new THREE.DataTexture(data, width, height, THREE.RGBAFormat);
  texture.mapping = THREE.EquirectangularReflectionMapping;
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.magFilter = texture.minFilter = THREE.LinearFilter;
  texture.needsUpdate = true;
  scene.environment = texture;
  scene.environmentIntensity = .98;
  return texture;
}

// One sun and a bright sky suit the yard. Inside, the cards and walk videos show
// LED bays under a dark deck: ivory walls stay below white, steel stays mid grey.
export const LIGHT_PROFILES = Object.freeze({
  daylight: { sky: 0xf4fbff, ground: 0x668278, hemisphere: 2.8, sun: 3.6, fill: 1.3, environment: .98 },
  cutaway: { sky: 0xfdfaf3, ground: 0x8f9188, hemisphere: 1.7, sun: 2.1, fill: .75, environment: .74 },
  interior: { sky: 0xfffaf0, ground: 0x97958a, hemisphere: 1.2, sun: .38, fill: .34, environment: .56 },
});
export function lightProfileFor({ floor, view }) {
  if (floor === 'campus' || floor === 'outdoor' || floor === 8) return 'daylight';
  if (floor !== 'all' && (view === 'person' || view === 'aisle')) return 'interior';
  return 'cutaway';
}
export function applyLightProfile({ scene, sun, hemisphere, fill, materials }, name) {
  const profile = LIGHT_PROFILES[name];
  if (!profile || !hemisphere || scene?.userData.lightProfile === name) return false;
  scene.userData.lightProfile = name;
  hemisphere.color.set(profile.sky); hemisphere.groundColor.set(profile.ground); hemisphere.intensity = profile.hemisphere;
  if (sun) sun.intensity = profile.sun;
  if (fill) fill.intensity = profile.fill;
  scene.environmentIntensity = profile.environment;
  // Materials with their own reflection map do not follow scene.environmentIntensity.
  const ratio = Math.sqrt(profile.environment / LIGHT_PROFILES.daylight.environment);
  for (const material of materials || []) {
    if (!material.envMap) continue;
    material.userData.fullEnvIntensity ??= material.envMapIntensity;
    material.envMapIntensity = material.userData.fullEnvIntensity * ratio;
  }
  return true;
}
