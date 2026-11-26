import { SITE_ASSETS } from './asset-catalog.js';
import { OUTDOOR_CARD_SIDES } from './outdoor-card-data.js';
import { legacyAssetTarget } from './legacy-asset-paths.js';

// The catalog is the single allowlist for current drawings, branding and Team 3
// cards. Retired photo metadata stays in evidence records without UI requests.
const retained = new Map(SITE_ASSETS.map(asset => [asset.path, asset.label]));

export function evidenceImageCaption(reference) {
  return retained.get(reference);
}

export function evidenceImageKind(reference) {
  if (reference.includes('/equipment-cards/')) return '설비이력카드';
  if (reference.includes('/drawings/')) return '도면';
  if (reference.includes('/documents/')) return '문서';
  return '현장 사진';
}

export function displayEvidenceImage(image, reference) {
  const [file, fragment] = reference.split('#');
  const side = file.includes('/equipment-cards/outdoor/') ? OUTDOOR_CARD_SIDES.indexOf(fragment) : -1;
  image.onload = null;
  if ('objectViewBox' in image.style) {
    image.style.objectViewBox = side < 0 ? '' : `inset(0 ${(3 - side) * 25}% 0 ${side * 25}%)`;
  } else if (side >= 0) {
    // Older browsers can still open the same individual view on static hosts.
    image.onload = () => {
      image.onload = null;
      const crop = image.ownerDocument.createElement('canvas');
      crop.width = image.naturalWidth / 4;
      crop.height = image.naturalHeight;
      crop.getContext('2d').drawImage(image, side * crop.width, 0, crop.width, crop.height, 0, 0, crop.width, crop.height);
      image.src = crop.toDataURL();
    };
  }
  image.src = side < 0 ? reference : file;
}

export function isRetainedEvidenceImage(reference) {
  if (typeof reference !== 'string' || !reference) return false;
  if (/^data:image\//i.test(reference)) return true;
  let pathname;
  try { pathname = decodeURIComponent(reference.split(/[?#]/)[0]).replaceAll('\\', '/'); }
  catch { return false; }
  if (pathname.startsWith('/apps/site/assets/')) pathname = './' + pathname.slice('/apps/site/'.length);
  else if (pathname.startsWith('../assets/')) pathname = pathname.slice(1);
  else if (pathname.startsWith('assets/')) pathname = './' + pathname;
  if (retained.has(pathname)) return true;
  if (pathname.startsWith('./assets/share/')) return false;
  const current = legacyAssetTarget(pathname);
  return !!current && retained.has(current.split('#')[0]);
}
