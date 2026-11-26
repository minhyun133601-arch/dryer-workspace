// node view.mjs out.png  floor  mode  [args]
// spec: name|floor|mode|eye x,y,z|target x,y,z|fov|w,h  mode: cut (low walls) / full / top / topfull
import { boot } from './boot.mjs'; import fs from 'node:fs'; import path from 'node:path';
const [,, OUT, ...specs] = process.argv;
const storage = process.env.LAYOUT ? fs.readFileSync(process.env.LAYOUT, 'utf8') : null;
const { page, close } = await boot({ storage });
for (const spec of specs) {
  const [name, floor, mode, eye, target, fov = '50', size = '1400,1000'] = spec.split('|');
  const url = await page.evaluate(({ floor, mode, eye, target, fov, size }) => {
    const S = __scene, T = __THREE; S._stopPerson?.();
    if (floor.startsWith('p')) { const l = floor.slice(1) === 'all' ? 'all' : +floor.slice(1); S.setPackagingLevel(l); S.setFloor('packaging'); S.setPackagingLevel(l); }
    else S.setFloor(Number.isNaN(+floor) ? floor : +floor);
    S.setView(mode === 'person' ? 'person' : 'perspective'); S.setPartitions(mode === 'full' || mode === 'topfull');
    for (const l of S.labels || []) ; S._visibility();
    if (mode === 'full' && S.packaging?.ceiling) S.packaging.ceiling.visible = true;
    const [w, h] = size.split(',').map(Number), r = S.renderer;
    const old = new T.Vector2(); r.getSize(old); const pr = r.getPixelRatio(); r.setPixelRatio(1); r.setSize(w, h, false);
    let cam;
    if (mode.startsWith('top')) { const [cx, cz, span] = eye.split(',').map(Number); const a = w / h; cam = new T.OrthographicCamera(-span * a / 2, span * a / 2, span / 2, -span / 2, .1, 400); cam.position.set(cx, 120, cz); cam.up.set(0, 0, -1); cam.lookAt(cx, 0, cz); }
    else { cam = new T.PerspectiveCamera(+fov, w / h, .05, 400); cam.position.set(...eye.split(',').map(Number)); cam.lookAt(...target.split(',').map(Number)); }
    cam.updateProjectionMatrix(); cam.updateMatrixWorld(true);
    S.scene.updateMatrixWorld(true); r.render(S.scene, cam); const u = r.domElement.toDataURL('image/jpeg', .9);
    r.setPixelRatio(pr); r.setSize(old.x, old.y, false); return u;
  }, { floor, mode, eye, target, fov, size });
  const f = path.join(OUT, name + '.jpg'); fs.writeFileSync(f, Buffer.from(url.split(',')[1], 'base64')); console.log(f);
}
await close();
