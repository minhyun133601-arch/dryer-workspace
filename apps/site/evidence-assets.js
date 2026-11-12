import { SITE_ASSETS } from './asset-catalog.js';

// The catalog is the single allowlist for current drawings, branding and Team 3
// cards. Retired photo metadata stays in evidence records without UI requests.
const retained = new Set(SITE_ASSETS.map(asset => asset.path));
export function isRetainedEvidenceImage(reference) {
  if (typeof reference !== 'string' || !reference) return false;
  if (/^data:image\//i.test(reference)) return true;
  let pathname;
  try { pathname = decodeURIComponent(reference.split(/[?#]/)[0]).replaceAll('\\', '/'); }
  catch { return false; }
  if (pathname.startsWith('/apps/site/assets/')) pathname = './' + pathname.slice('/apps/site/'.length);
  else if (pathname.startsWith('../assets/')) pathname = pathname.slice(1);
  else if (pathname.startsWith('assets/')) pathname = './' + pathname;
  return retained.has(pathname);
}
