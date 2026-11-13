import * as THREE from '../shared/vendor/three.module.js';

// The supplied JPEG is used unchanged, including its original colours and
// square white background. Exporters replace this path with the same bytes.
export const PERSON_LOGO_URL = './assets/branding/company-logo.jpg';

function resolveLogoUrl(source) {
  if (/^(?:data:|blob:|https?:)/i.test(source) || typeof location === 'undefined') return source;
  if (location.pathname.includes('/site/share/')) return `.${source}`;
  if (location.pathname.includes('/presentation/')) return `../site/${source.slice(2)}`;
  return source;
}

export function buildPersonAvatar(s, { logoUrl = PERSON_LOGO_URL, logoTexture = null } = {}) {
  const root = s._group(s.scene);
  root.name = 'facility-person';
  Object.assign(root.userData, { company: '희창유업', role: '현장 안내', logoSource: logoUrl, height: 1.75, eyeHeight: 1.65, radius: .3 });
  const white = s._material(0xf4f7f6, .78, 0), blue = s._material(0x07518b, .7, 0);
  const navy = s._material(0x173b58, .85, 0), skin = s._material(0xe8b995, .86, 0);
  const green = s._material(0x9abb35, .72, 0), black = s._material(0x20313b, .9, 0);
  const mesh = (name, geometry, material, parent, position) => {
    const value = s._mesh(geometry, material, parent, position); value.name = name; return value;
  };
  const box = (name, size, position, material, parent = root) => mesh(name, new THREE.BoxGeometry(...size), material, parent, position);
  const sphere = (name, radius, position, material, parent = root) => mesh(name, new THREE.SphereGeometry(radius, 18, 12), material, parent, position);

  box('person-white-work-jacket', [.48, .58, .29], [0, 1.075, 0], white);
  box('person-blue-shoulders', [.5, .12, .3], [0, 1.32, 0], blue);
  box('person-green-jacket-hem', [.485, .055, .295], [0, .805, 0], green);
  box('person-navy-waist', [.39, .105, .24], [0, .775, 0], navy);
  sphere('person-neck', .065, [0, 1.44, 0], skin);
  sphere('person-head', .115, [0, 1.59, 0], skin);
  for (const side of [-1, 1]) {
    sphere(`person-ear-${side}`, .022, [side * .112, 1.60, 0], skin);
    sphere(`person-eye-${side}`, .01, [side * .039, 1.65, -.102], black);
  }
  sphere('person-nose', .017, [0, 1.615, -.119], skin);
  const helmet = mesh('person-white-safety-helmet', new THREE.SphereGeometry(.13, 22, 12, 0, Math.PI * 2, 0, Math.PI / 2), white, root, [0, 1.675, 0]);
  helmet.scale.y = .075 / .13;
  box('person-helmet-brim', [.31, .025, .3], [0, 1.675, -.015], white);
  box('person-helmet-blue-band', [.25, .02, .018], [0, 1.691, -.128], blue);

  const limbs = [];
  for (const side of [-1, 1]) {
    const arm = s._group(root, [side * .24, 1.29, 0]); arm.name = `person-arm-${side}`;
    box('person-blue-sleeve', [.12, .45, .16], [0, -.215, 0], blue, arm);
    box('person-green-sleeve-band', [.12, .045, .164], [0, -.35, 0], green, arm);
    sphere('person-hand', .06, [0, -.49, 0], skin, arm);
    const leg = s._group(root, [side * .12, .8, 0]); leg.name = `person-leg-${side}`;
    box('person-work-trousers', [.175, .67, .21], [0, -.335, 0], navy, leg);
    box('person-safety-boot', [.2, .13, .31], [0, -.735, -.045], black, leg);
    limbs.push({ arm, leg, side });
  }

  let texture = logoTexture;
  if (!texture && typeof document !== 'undefined' && typeof document.createElementNS === 'function') {
    texture = new THREE.TextureLoader().load(resolveLogoUrl(logoUrl), () => s._invalidate?.());
  }
  if (texture) { texture.colorSpace = THREE.SRGBColorSpace; s.textures.add(texture); }
  const logo = new THREE.MeshBasicMaterial({ color: 0xffffff, map: texture, toneMapped: false, side: THREE.FrontSide });
  s.materials.add(logo);
  for (const [name, size, position, angle] of [
    ['chest', .34, [0, 1.065, -.147], Math.PI],
    ['back', .38, [0, 1.075, .147], 0],
    ['helmet', .065, [0, 1.711, -.132], Math.PI],
  ]) {
    const badge = mesh(`person-company-logo-${name}`, new THREE.PlaneGeometry(size, size), logo, root, position);
    badge.rotation.y = angle;
    Object.assign(badge.userData, { companyLogo: true, logoSource: logoUrl, aspectRatio: 1, originalImageUnmodified: true });
  }
  const ring = mesh('person-location-ring', new THREE.RingGeometry(.48, .58, 32), blue, root, [0, .025, 0]);
  ring.rotation.x = -Math.PI / 2;
  const arrow = mesh('person-heading-arrow', new THREE.ConeGeometry(.17, .44, 3), green, root, [0, .045, -.82]);
  arrow.rotation.x = -Math.PI / 2;
  root.traverse(node => { node.userData.person = true; });
  return { root, limbs };
}
