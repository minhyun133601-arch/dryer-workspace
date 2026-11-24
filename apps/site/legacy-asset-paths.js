import { SITE_ASSETS } from './asset-catalog.js';

const moved = new Map();
for (const { path, sharePath } of SITE_ASSETS) {
  if (path.startsWith('./assets/photos/')) {
    moved.set(path.replace('/photos/', '/'), path);
    if (sharePath && path.includes('/equipment-cards/liquid/')) {
      moved.set(path.replace('photos/equipment-cards/liquid/', 'share/liquid/'), sharePath);
    }
  }
  if (path.includes('/chiller/') && (path.startsWith('./assets/drawings/') || path.startsWith('./assets/documents/'))) {
    const basename = path.split('/').pop();
    if (path.startsWith('./assets/documents/')) moved.set('./assets/drawings/chiller/' + basename, path);
    moved.set('./assets/share/chiller/' + basename, sharePath || path);
  }
  if (path.startsWith('./assets/photos/equipment-cards/outdoor/') && path.endsWith('/overview.jpg')) {
    for (const face of ['front', 'left', 'right', 'rear']) {
      const single = path.replace('overview.jpg', face + '.jpg');
      moved.set(single, path + '#' + face);
      moved.set(single.replace('/photos/', '/'), path + '#' + face);
    }
  }
}

export function legacyAssetTarget(reference) {
  return moved.get(reference);
}
