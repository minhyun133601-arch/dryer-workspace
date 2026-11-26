import { boot } from './boot.mjs';
const { page, close } = await boot();
const out = await page.evaluate(() => { const S = __scene, T = __THREE; const r = [];
  for (const it of S.equipment) { if (typeof it.floor !== 'number' && it.floor !== 'packaging') continue; const o = S.objects.get(it.id); if (!o) continue; const v=o.visible; o.visible = true; const b = new T.Box3().setFromObject(o); o.visible=v;
    r.push([it.floor === 'packaging' ? 'p' + (it.floorLevel ?? 3) : it.floor, it.id, it.name, [b.min.x, b.max.x, b.min.z, b.max.z].map(v => +v.toFixed(2)), it.position.map(v => +v.toFixed(2)), +b.max.y.toFixed(1)]); }
  return r; });
for (const r of out.sort((a, b) => String(a[0]).localeCompare(String(b[0])))) { const [x0,x1,z0,z1]=r[3]; const p = typeof r[0] === 'number' ? ` plan x ${(x0+8.6).toFixed(1)}~${(x1+8.6).toFixed(1)} z ${(z0+13.4).toFixed(1)}~${(z1+13.4).toFixed(1)}` : ''; console.log(r[0], r[1], r[2], JSON.stringify(r[3]), p, 'top', r[5]); }
await close();
