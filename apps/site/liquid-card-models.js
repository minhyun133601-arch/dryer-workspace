import * as THREE from '../shared/vendor/three.module.js';

// Four-view equipment cards are the shape authority. No background machine,
// internal rotor or manufacturer specification is added from a card title.
export function buildLiquidCardExterior({ h, item, geo, detail = true }) {
  const n = Number(item.cardNumber), features = [], seg = detail ? 28 : 16;
  const feature = (name) => features.push(name);
  const panel = (size, p, paint = 'steel', radius = .025) => {
    const [w, ht, d] = size, r = Math.min(radius, w / 3, ht / 3);
    const g = geo(`card-round-panel:${size}:${r}`, () => {
      const s = new THREE.Shape(); s.moveTo(-w / 2 + r, -ht / 2); s.lineTo(w / 2 - r, -ht / 2); s.quadraticCurveTo(w / 2, -ht / 2, w / 2, -ht / 2 + r); s.lineTo(w / 2, ht / 2 - r); s.quadraticCurveTo(w / 2, ht / 2, w / 2 - r, ht / 2); s.lineTo(-w / 2 + r, ht / 2); s.quadraticCurveTo(-w / 2, ht / 2, -w / 2, ht / 2 - r); s.lineTo(-w / 2, -ht / 2 + r); s.quadraticCurveTo(-w / 2, -ht / 2, -w / 2 + r, -ht / 2);
      const g = new THREE.ExtrudeGeometry(s, { depth: d, bevelEnabled: false, curveSegments: 4 }); g.translate(0, 0, -d / 2); return g;
    }); return h.mesh(g, p, paint);
  };
  const handle = (p, width = .16, height = .035, paint = 'edge') => { const [x, y, z] = p; h.bar([x - width / 2, y, z], [x - width / 2, y, z + height], .011, paint); h.bar([x + width / 2, y, z], [x + width / 2, y, z + height], .011, paint); h.bar([x - width / 2, y, z + height], [x + width / 2, y, z + height], .012, paint); };
  const bolts = (r, p, axis = 'y', count = 8) => {
    if (!detail) count = 4;
    for (let i = 0; i < count; i++) { const a = i * Math.PI * 2 / count, q = [...p]; if (axis === 'y') { q[0] += Math.cos(a) * r; q[2] += Math.sin(a) * r; } else if (axis === 'z') { q[0] += Math.cos(a) * r; q[1] += Math.sin(a) * r; } else { q[1] += Math.cos(a) * r; q[2] += Math.sin(a) * r; } h.cyl(.012, .02, q, 'edge', axis); }
  };
  const port = (r, p, axis = 'y', length = .07) => { h.cyl(r, length, p, 'steel', axis); h.ring(r + .01, .009, p, 'edge', axis); };
  const dial = (p, r = .08) => { h.cyl(r + .012, .035, p, 'edge', 'z'); h.cyl(r, .008, [p[0], p[1], p[2] + .021], 'white', 'z'); h.bar([p[0], p[1], p[2] + .028], [p[0] - r * .4, p[1] + r * .4, p[2] + .028], .004, 'black'); };
  const vents = (p, width = .6, rows = 6, paint = 'dark') => { for (let i = 0; i < rows; i++) h.box([width, .012, .009], [p[0], p[1] + i * .045, p[2]], paint); };
  const wheels = (w, d) => { for (const x of [-w / 2, w / 2]) for (const z of [-d / 2, d / 2]) { h.box([.05, .07, .04], [x, .1, z]); h.cyl(.045, .035, [x, .045, z], 'blue', 'z'); } };
  const squareFeet = (w, d, y = .35) => { for (const x of [-w / 2, w / 2]) for (const z of [-d / 2, d / 2]) { h.box([.055, y, .055], [x, y / 2, z]); h.cyl(.065, .025, [x, .013, z], 'edge'); } };
  const motor = (p, paint = 'blue', vertical = true, scale = 1) => { const body = h.motor(p, paint, vertical, scale); body.userData.cardFeature = `motor-${vertical ? 'vertical' : 'horizontal'}-${paint}`; const [x, y, z] = p; if (vertical) { h.ring(.155 * scale, .013, [x, y - .22 * scale, z]); h.box([.15 * scale, .18 * scale, .13 * scale], [x + .17 * scale, y, z], paint); } else { h.ring(.15 * scale, .013, [x - .23 * scale, y, z], paint, 'x'); h.box([.15 * scale, .14 * scale, .16 * scale], [x, y + .15 * scale, z], paint); } };
  const splitLid = (r, y) => { h.cyl(r, .055, [0, y, 0]); for (const z of [-.16, .16]) h.box([r * 1.8, .06, .035], [0, y + .055, z]); h.box([.025, .025, r * 1.9], [0, y + .035, 0], 'edge'); handle([0, y + .045, r * .65], .22); };
  const tankBody = (r, height, base, flat = false) => {
    const profile = [[0, -.13], [r * .55, -.13], [r * .9, -.08], [r, .08], [r, height - .1], [r * .94, height + .04], [r * .7, height + .17], [r * .3, height + .23], [0, height + .23]];
    if (flat) profile.splice(5, 4, [r, height], [0, height]);
    h.mesh(geo(`card-tank-profile:${r}:${height}:${flat}:${detail}`, () => new THREE.LatheGeometry(profile.map(p => new THREE.Vector2(...p)), seg)), [0, base, 0]).userData.cardFeature = flat ? 'flat-top-tank-shell' : 'domed-tank-shell';
    for (const yy of [base + .07, base + height - .12]) h.ring(r + .008, .018, [0, yy, 0]);
    for (const a of [0, Math.PI * 2 / 3, Math.PI * 4 / 3]) { const x = Math.cos(a) * r * .7, z = Math.sin(a) * r * .7; h.cyl(.055, base, [x, base / 2, z]); h.cyl(.085, .03, [x, .015, z], 'edge'); }
  };
  const hatch = (r, p, tilted = false) => {
    const g = h.cyl(r, .045, p, 'steel', 'z'); if (tilted) g.rotation.x -= .75;
    const q = h.cyl(r * .28, .05, [p[0], p[1] + (tilted ? .04 : 0), p[2] + .03], 'dark', 'z'); if (tilted) q.rotation.x -= .75;
    const ring = h.ring(r, .016, [p[0], p[1] + (tilted ? .02 : 0), p[2] + .025], 'edge', 'z'); if (tilted) ring.rotation.x -= .75;
    for (const x of [-r * .77, r * .77]) handle([p[0] + x, p[1], p[2] + .045], .065);
  };

  function mixingTank() {
    if (n === 100) {
      h.box([1.55, 1.65, 1.05], [0, 1.12, 0]); squareFeet(1.5, 1, .28); h.box([1.57, .035, 1.07], [0, 1.96, 0]);
      h.pipe([[-.72, 1.65, -.3], [-.92, 1.65, -.3], [-.92, .24, .38], [.63, .24, .63]], .045, 'edge'); h.pipe([[.1, .22, .58], [.1, .82, .58]], .025); dial([.6, .92, .56]);
      for (const x of [-.6, .4]) { port(.045, [x, .24, .62], 'x', .16); h.bar([x, .3, .62], [x + .1, .3, .62], .013, 'red'); } feature('rectangular-hot-water-tank;side-gauge;external-drain'); return;
    }
    const pet = n === 43, tall = [77, 78, 79].includes(n), flat = pet || [67, 80, 83].includes(n), small = [67, 80, 81, 82, 83, 93].includes(n), r = pet ? .49 : tall ? .76 : small ? .7 : .88, base = pet ? .18 : .42, ht = pet ? .96 : tall ? 2.15 : small ? 1.02 : 1.3, top = base + ht + (flat ? 0 : .18);
    tankBody(r, ht, base, flat);
    if (pet) {
      h.cyl(r + .01, .025, [0, top + .013, 0]).userData.cardFeature = 'flat-round-lid';
      for (const x of [-.08, .08]) h.bar([x, top + .026, 0], [x, top + .14, 0], .012); h.bar([-.08, top + .14, 0], [.08, top + .14, 0], .012);
      h.box([.6, .65, .15], [0, .78, r + .12]); h.box([.065, .075, .008], [0, 1.06, r + .201], 'black');
      for (const x of [-.2, 0, .2]) for (const [y, c] of [[.87, 'green'], [.66, 'red']]) h.cyl(.027, .025, [x, y, r + .21], c, 'z');
      for (const x of [-.26, .23]) h.pipe([[x, .46, r * .8], [x, .1, r + .23], [x * .4, .07, r + .37], [x * .6, .5, r + .22]], .024, 'black'); feature('small-lidded-round-tank;six-button-side-box;black-cable-loops'); return;
    }
    if (tall) {
      hatch(n === 79 ? .27 : .19, [0, 1.24, r + .015]); if (n === 79) bolts(.24, [0, 1.24, r + .046], 'z', 12); h.pipe([[0, .36, 0], [0, .2, r + .12], [.5, .2, r + .22]], .04);
      h.pipe([[r * .8, 1.85, -.1], [r + .15, 1.86, -.1], [r + .15, .45, .35]], .032, 'black'); feature('tall-cylindrical-vessel;front-round-sightglass;lower-sanitary-outlet'); return;
    }
    if (flat) { splitLid(r + .015, top + .015); feature('flat-split-circular-lid;cross-beams;lift-handles'); }
    else { hatch(.27, [-r * .18, top - .015, r * .62], true); feature('domed-top;inclined-round-manhole;clamp-handles'); }
    if ([71, 93].includes(n)) {
      h.cyl(.24, 1.02, [-.27, top + .51, -.14]); h.cyl(.34, .18, [-.27, top + 1.1, -.14], 'steel', 'y', .24);
      const upperHood = h.mesh(geo('card-tall-neck-square-upper-hood', () => new THREE.CylinderGeometry(.52, .24, .35, 4, 1, true)), [-.27, top + 1.34, -.14], 'hopperSteel'); upperHood.rotation.y = Math.PI / 4; upperHood.scale.z = .8;
      if (n === 71) { h.cyl(.16, .4, [.23, top + .22, .02]); motor([.47, top + .58, .02], 'dark', false, 1.05); feature('tall-process-neck;horizontal-black-side-motor'); }
      else { h.box([.33, .34, .33], [.32, top + .26, .02], 'edge'); h.cyl(.13, .13, [.32, top + .06, .02]); motor([.32, top + .77, .02], 'dark', true, 1.23); feature('parallel-tall-neck;vertical-dark-gearmotor;external-reducer'); }
    } else {
      const column = n === 67 ? .8 : [80, 81, 82, 83].includes(n) ? .62 : .34, paint = [69, 82, 67].includes(n) ? 'edge' : 'blue';
      h.cyl(.15, column, [0, top + column / 2, 0]);
      for (const yy of [top + .035, top + column - .035]) { h.cyl(.2, .05, [0, yy, 0]); bolts(.17, [0, yy + .03, 0], 'y', 6); }
      for (const x of [-.12, .12]) for (const z of [-.12, .12]) h.cyl(.014, column - .05, [x, top + column / 2, z]);
      if ([80, 81, 82, 83].includes(n)) { for (const side of [-1, 1]) { h.box([.065, column * .52, .006], [0, top + column * .52, side * .154], 'dark'); h.box([.006, column * .52, .065], [side * .154, top + column * .52, 0], 'dark'); } if (n === 83) h.box([.075, .14, .055], [r * .85, top + .12, .3], 'yellow'); }
      if ([68, 70].includes(n)) motor([.1, top + column + .2, 0], 'blue', false, 1.2);
      else motor([0, top + column + .25, 0], paint, true, n === 67 ? 1 : 1.18);
      if (n === 67) { for (const y of [top + .22, top + .6]) for (let k = 0; k < 8; k++) { const a = k * Math.PI / 4; h.box([.026, .11, .006], [Math.cos(a) * .153, y, Math.sin(a) * .153], 'dark').rotation.y = -a; } feature('tall-silver-drive-column;two-perforated-guard-bands'); }
      else feature([68, 70].includes(n) ? 'horizontal-blue-top-gearmotor' : `${paint}-vertical-gearmotor;flanged-open-support-column`);
    }
    for (const [x, z] of [[-r * .65, -.1], [r * .65, -.18]]) {
      port(.045, [x, top, z]); h.pipe([[x, top + .03, z], [x, top + .24, z], [x + .12, top + .31, z - .08], [x + .2, top + .13, z - .18]], .028);
    }
    const vx = r * .65, vy = top + .14, vz = .16; h.cyl(.075, .2, [vx, vy, vz], 'edge'); h.cyl(.055, .13, [vx + .015, vy + .14, vz], 'green');
    h.pipe([[r * .8, base + .12, .1], [r + .1, base + .12, .1], [r + .1, .26, r * .7], [.35, .25, r + .12]], .035); port(.065, [r * .45, .25, r + .12], 'x', .1);
    h.pipe([[-r * .8, top + .1, -.1], [-r - .12, top + .16, -.2], [-r - .15, .4, .28]], .025, 'black');
    if (n === 67) {
      h.box([.43, .58, .15], [0, 1.0, -r - .12]);
      for (const [x, y, c] of [[-.11, 1.14, 'green'], [.11, 1.14, 'red'], [-.11, .98, 'black'], [.11, .98, 'white'], [0, .82, 'black']]) h.cyl(.022, .018, [x, y, -r - .205], c, 'z');
      port(.13, [r + .02, .83, 0], 'x', .04); h.cyl(.085, .018, [r + .05, .83, 0], 'dark', 'x'); motor([r + .22, .25, -.13], 'edge', false, .6);
      feature('rear-five-button-box;side-round-connection;low-external-pump');
    }
    feature('visible-sanitary-nozzles;external-valve;lower-elbow;black-service-hose');
  }

  function tubular() {
    squareFeet(3.3, 1.05, .22);
    for (const x of [-1.7, 1.7]) for (const z of [-.52, .52]) h.box([.065, 2.45, .065], [x, 1.44, z]);
    for (const y of [.24, 2.62]) for (const z of [-.52, .52]) h.box([3.47, .065, .065], [0, y, z]);
    for (const z of [-.36, .36]) for (let i = 0; i < 8; i++) { const y = .5 + i * .25, end = i % 2 ? 1 : -1, red = n === 96 && [0, 2, 6].includes(i); h.cyl(.065, 3.05, [0, y, z], red ? 'red' : 'steel', 'x'); for (const x of [-1.49, 1.49]) h.ring(.075, .009, [x, y, z], 'edge', 'x'); if (i < 7) h.pipe([[end * 1.53, y, z], [end * 1.73, y + .06, z], [end * 1.73, y + .19, z], [end * 1.53, y + .25, z]], .047); }
    h.control([n === 95 ? -1.99 : 1.99, 1.27, .18], [.52, 2.1, .4]);
    h.cyl(.22, .7, [-.67, .59, .74]); h.cyl(.23, .035, [-.67, .96, .74]); motor([.7, .36, .68], n === 96 ? 'edge' : 'blue', false, .8);
    h.pipe([[-1.25, .32, .7], [.7, .32, .7], [1.2, .32, .7], [1.25, 1.9, .4]], .04);
    for (const y of [.75, 1.6, 2.15]) { h.pipe([[1.42, y, .36], [1.42, y, .78], [.94, y, .78]], .028); h.ring(.07, .012, [1.11, y + .07, .79], 'blue', 'z'); h.cyl(.04, .11, [1.11, y, .78]); }
    for (const p of [[-1.3, 1.1, .81], [1.4, 1.9, .79]]) dial(p, .065);
    if (n === 96) { h.cyl(.18, 1.78, [0, .68, .78], 'steel', 'x'); h.ring(.19, .015, [-.84, .68, .78], 'edge', 'x'); feature('red-insulated-return-pipes;low-long-horizontal-cylinder'); }
    if (n === 97) { h.cyl(.19, .95, [1.91, .82, .67]); h.cyl(.2, .04, [1.91, 1.31, .67]); h.pipe([[.7, 1.98, .53], [1.94, 1.98, .53], [2.12, 1.8, .53], [2.12, 1.42, .53], [1.6, 1.42, .53]], .06); feature('separate-side-vertical-vessel;large-U-shaped-end-manifold'); }
    feature('eight-level-tubular-bank;return-elbows;sanitary-unions;external-end-manifold;pump-and-gauges'); if (n === 96) feature('red-exposed-return-sections');
  }

  function cage(w, d, bottom, top, glazed = false, orange = false) {
    for (const x of [-w / 2, w / 2]) for (const z of [-d / 2, d / 2]) h.box([.05, top - bottom, .05], [x, (top + bottom) / 2, z], orange && z > 0 ? 'orange' : 'steel');
    for (const y of [bottom, top]) { for (const z of [-d / 2, d / 2]) h.box([w, .05, .05], [0, y, z]); for (const x of [-w / 2, w / 2]) h.box([.05, .05, d], [x, y, 0]); }
    if (glazed) for (const z of [-d / 2, d / 2]) { h.box([w - .08, top - bottom - .06, .012], [0, (top + bottom) / 2, z], 'glass'); for (const x of [-w / 4, w / 4]) { h.box([.018, top - bottom - .04, .025], [x * 2, (top + bottom) / 2, z]); handle([x, (top + bottom) / 2, z + .015], .03, .025); } }
  }
  const stackLight = (p) => { h.cyl(.025, .25, p); for (const [i, c] of ['green', 'orange', 'red'].entries()) h.cyl(.043, .065, [p[0], p[1] + .18 + i * .065, p[2]], c); };
  function filling() {
    if (n === 42) {
      wheels(2.6, 1.9); h.box([2.8, 2.25, 2.1], [0, 1.37, 0]);
      for (const [side, count] of [[1, 3], [-1, 4]]) for (let i = 0; i < count; i++) {
        const width = 2.76 / count, x = (i + .5) * width - 1.38, z = side * 1.064;
        panel([width - .045, 1.66, .025], [x, 1.38, z]); panel([width * .68, 1.29, .028], [x, 1.43, z + side * .016], 'dark', .07).userData.cardFeature = side > 0 ? 'front-window' : 'rear-window';
        h.box([.035, 1.62, .04], [x - width / 2, 1.38, z]); handle([x + width * .4, 1.25, z + .04], .035, .045);
        for (const y of [.76, 2]) h.box([.05, .09, .05], [x - width * .44, y, z + .025]);
      }
      for (const x of [-1.414, 1.414]) for (const z of [-.5, .5]) { const pane = panel([.67, 1.29, .03], [x, 1.43, z], 'dark', .07); pane.rotation.y = Math.PI / 2; pane.userData.cardFeature = x < 0 ? 'left-window' : 'right-window'; }
      for (const side of [-1, 1]) for (const z of [-.07, .07]) { h.bar([side * 1.454, 1.04, z], [side * 1.454, 1.4, z], .012); for (const y of [1.04, 1.4]) h.bar([side * 1.414, y, z], [side * 1.454, y, z], .011); }
      for (const x of [-.9, 0, .9]) h.box([.015, .46, .025], [x, .49, 1.067], 'edge');
      h.belt(3.2, .34, .93, [0, 0, -.28]); motor([1.34, .75, -.4], 'edge', false, .65); h.control([-1.4, .73, .75], [.35, .49, .17]);
      h.pipe([[1.25, .2, .78], [1.25, 1.7, .78], [1.25, 2.6, .5]], .035); feature('front-three-dark-rounded-windows;rear-four-windows;two-side-windows;door-hinges-and-tall-handles;external-drive;unseen-carousel-omitted'); return;
    }
    if (n === 47) {
      h.box([1.25, .78, 1.03], [0, .59, 0]); squareFeet(1.13, .9, .2);
      h.box([1.42, .045, 1.13], [0, 1.01, .12]);
      h.mesh(geo(`card-47-open-hopper:${detail}`, () => new THREE.CylinderGeometry(.57, .57, .42, seg, 1, true)), [-.17, 2.1, -.1], 'hopperSteel');
      h.mesh(geo(`card-47-open-cone:${detail}`, () => new THREE.CylinderGeometry(.57, .105, .6, seg, 1, true)), [-.17, 1.59, -.1], 'hopperSteel'); h.ring(.58, .016, [-.17, 2.32, -.1]);
      for (const x of [-.34, 0, .34]) { h.cyl(.025, .25, [x, 1.24, .53]); h.pipe([[x, 1.53, .15], [x, 1.52, .38], [x, 1.38, .53]], .023, 'white'); }
      h.box([.07, 1.18, .07], [.63, 1.6, -.38]); h.control([.64, 2.15, -.36], [.36, .5, .16]); h.belt(1.55, .28, .94, [0, 0, .61]);
      feature('open-wide-round-hopper;conical-outlet;three-visible-front-fill-stations;cantilever-HMI;low-SS-base'); return;
    }
    if ([48, 49].includes(n)) {
      h.box([1.85, .48, 1.35], [0, .4, 0]); squareFeet(1.72, 1.24, .18); cage(1.9, 1.4, .65, 2.28);
      for (const x of [-.91, .91]) h.box([.035, 1.55, 1.32], [x, 1.45, 0]);
      for (const y of [.96, 1.51, 1.98]) { h.box([1.54, .12, .19], [0, y, .45]); bolts(.027, [-.57, y, .56], 'z', 4); }
      for (let i = 0; i < 6; i++) { const x = -.53 + i * .212; h.cyl(.022, .28, [x, .61, .54]); h.pipe([[x, 1.96, -.1], [x, 2.13, .05], [x, 1.7, .43]], .016, i % 2 ? 'yellow' : 'blue'); h.pipe([[x, 1.15, .27], [x + .08, .7, .3], [x, .68, .54]], .014, 'blue'); }
      panel([1.5, .62, .018], [0, 1.77, .72], 'glass'); handle([.48, 1.73, .75], .025);
      for (const z of [-.69, .69]) { h.bar([-.93, 2.3, z], [-.93, 2.76, z], .019); h.bar([.93, 2.3, z], [.93, 2.76, z], .019); h.bar([-.93, 2.76, z], [.93, 2.76, z], .018); }
      h.box([.53, .45, .44], [0, 2.52, -.24]); h.control([1.07, 1.83, .26], [.46, .55, .14]); stackLight([.87, 2.27, -.46]);
      if (n === 48) { h.box([1.55, .035, .72], [0, .59, 1.08]); for (const x of [-.7, .7]) for (const z of [.77, 1.39]) h.box([.035, .57, .035], [x, .285, z]); feature('open-front-crossbars;blue-and-yellow-hoses;separate-front-SS-receiving-table'); }
      else { h.cyl(.2, .95, [0, .68, -.75], 'white', 'x'); for (const y of [.77, .9, 1.03]) h.box([.92, .085, .018], [0, y, -.79], 'red'); for (const x of [-.6, .6]) h.bar([x, .3, -.75], [x, 1.5, -.75], .02); for (let y = .25; y < 2.3; y += .26) h.bar([1.09, y, -.55], [1.09, y, .15], .018); feature('low-rear-red-printed-film-roll;rear-roller-frame;side-access-ladder'); }
      feature('photographed-front-heads-representative;card-name-16-not-used-as-head-count'); return;
    }
    const cheer = [64, 65, 66].includes(n);
    h.box([2.45, .56, 1.48], [0, .43, 0]); wheels(2.26, 1.3); cage(2.45, 1.48, .73, 2.17, true);
    for (const x of [-.62, .62]) { h.box([1.18, .5, .025], [x, .44, .765]); handle([x + .35, .44, .8], .035); }
    h.cyl(.61, .08, [0, .95, 0]);
    for (let i = 0; i < 6; i++) { const a = i * Math.PI * 2 / 6, x = Math.cos(a) * .64, z = Math.sin(a) * .57; h.box([.14, .29, .13], [x, 1.15, z]); h.cyl(.024, .28, [x, 1.65, z]); h.pipe([[x, 2.14, z - .12], [x, 1.99, z], [x, 1.81, z]], .014, 'white'); }
    h.control([1.36, 1.65, .2], [.38, .63, .18]); stackLight([1.14, 2.1, -.5]); h.belt(1.32, .34, .87, [0, 0, 1.04]);
    if (n === 61) { h.cyl(.38, .42, [-.95, 2.32, -.24]); h.cyl(.38, .53, [-.95, 1.84, -.24], 'steel', 'y', .08); h.ring(.39, .016, [-.95, 2.54, -.24]); feature('large-side-round-hopper-and-cone'); }
    if (n === 62) { for (const x of [-.91, -.56]) { h.cyl(.11, .47, [x, 2.19, -.31], 'white'); port(.12, [x, 2.44, -.31]); } feature('paired-high-cylindrical-metering-assemblies'); }
    if (n === 63) { h.box([.04, 1.45, .04], [-1.05, 1.47, .76], 'blue'); h.control([-.9, 2.04, .8], [.48, .47, .15]); feature('high-front-HMI;blue-side-service-upright'); }
    if (cheer) {
      h.box([2.36, .08, .025], [0, 1.05, .78], n === 64 ? 'blue' : 'orange');
      if (n !== 64) { const ramp = h.box([.52, 1.35, .12], [-.92, 2.05, -.52]); ramp.rotation.z = -.5; for (let i = 0; i < 8; i++) h.box([.49, .045, .07], [-1.2 + i * .086, 1.52 + i * .156, -.44], 'edge'); feature('inclined-pouch-magazine-with-visible-guide-slats'); }
      feature(n === 64 ? 'blue-front-band;SS-frame-and-transparent-double-doors;red-building-pipe-not-machine-frame' : 'orange-front-band;inclined-pouch-feed-magazine');
    }
    feature('rotary-bed-observed-stations;guard-doors;SS-lower-cabinet;external-fill-hoses');
  }

  function packaging() {
    if (n === 102) {
      squareFeet(.82, .65, .62); panel([.94, .81, .72], [0, 1.08, 0], 'white', .09); panel([.82, .71, .735], [0, 1.08, .01], 'blue', .075); h.box([.34, .57, .33], [0, 1.78, -.08], 'blue');
      h.control([0, 1.08, .39], [.4, .43, .05], 'blue'); h.box([.76, .4, .03], [0, 1.05, -.39], 'dark');
      for (let i = 0; i < 4; i++) { const x = -.25 + i * .16; port(.035, [x, 1.02, -.42], 'z'); h.pipe([[x, 1.02, -.43], [x, .5, -.6], [x + .15, .18, -.55], [x + .25, .5, -.4]], .025, 'blue'); }
      feature('rounded-blue-enclosure;white-edge;high-blue-top-box;four-visible-rear-hose-connections'); return;
    }
    if (n === 105) {
      squareFeet(1.68, 1.35, .2); h.box([1.86, .26, 1.56], [0, .32, 0]); cage(1.86, 1.56, .48, 2.77, true, true);
      for (const x of [-.93, .93]) h.box([.012, 2.2, 1.47], [x, 1.6, 0], 'glass');
      h.cyl(.47, .14, [0, 2.62, 0], 'white'); h.cyl(.24, .23, [0, 2.46, 0], 'white');
      for (let i = 0; i < 3; i++) { const a = i * Math.PI * 2 / 3, inner = [Math.cos(a) * .3, 2.5, Math.sin(a) * .3], elbow = [Math.cos(a) * .64, 2.18, Math.sin(a) * .64]; h.bar(inner, elbow, .055, 'white'); for (const side of [-1, 1]) h.bar([elbow[0] + Math.cos(a + Math.PI / 2) * side * .035, elbow[1], elbow[2] + Math.sin(a + Math.PI / 2) * side * .035], [Math.cos(a) * .12 + Math.cos(a + Math.PI / 2) * side * .025, 1.18, Math.sin(a) * .12 + Math.sin(a + Math.PI / 2) * side * .025], .014, 'black'); }
      h.cyl(.13, .08, [0, 1.12, 0], 'dark'); h.box([1.5, .04, 1.15], [0, .56, 0], 'white');
      for (const x of [-.8, .8]) for (const y of [.82, 2.48]) h.box([.04, .09, .04], [x, y, .8], 'dark');
      h.pipe([[-.75, .3, -.55], [-.74, 1.1, -.55], [-.6, 1.4, -.5], [-.55, .7, -.35]], .015, 'blue'); feature('parallel-delta-robot;white-upper-arms;three-paired-black-rods;transparent-four-side-guard;orange-front-uprights'); return;
    }
    if (n === 52) {
      h.belt(1.47, .57, .82); h.belt(.77, .57, .82, [.98, 0, 0], true); h.box([.68, .08, .55], [-.2, .69, 0], 'edge'); h.belt(.55, .57, .82, [-.94, 0, 0], true);
      h.box([.07, 1.35, .07], [.48, .68, -.5]); h.control([.48, 1.45, -.46], [.43, .34, .12]); stackLight([.48, 1.54, -.48]);
      feature('three-part-weighing-belt;separate-blue-roller-outlet;load-bed;screen-pole;background-taper-omitted'); return;
    }
    if (n === 54) {
      h.belt(2.2, .85, .75, [0, 0, 0], true); cage(1.25, 1, .35, 1.82);
      h.box([1.25, .12, .2], [0, 1.29, .19], 'orange'); for (const x of [-.48, .48]) h.box([.11, .29, .62], [x, .96, 0], 'orange');
      h.box([.26, .47, .31], [-.1, 1.54, .12], 'orange'); h.cyl(.23, .09, [-.4, 1.71, .13], 'yellow', 'x'); h.cyl(.06, .12, [-.4, 1.71, .13], 'dark', 'x');
      h.control([-.8, 1.1, -.25], [.29, .56, .18]); stackLight([-.76, 1.49, -.24]); feature('orange-taping-bridge;yellow-side-tape-roll;open-roller-bed;vertical-SS-frame'); return;
    }
    if (n === 45) {
      h.belt(3.65, .5, .88); h.box([1.2, .61, 1.0], [0, .6, -.1]); wheels(1.08, .88);
      for (const x of [-.55, .55]) { h.cyl(.29, .055, [x, 1.28, -.34], 'white'); h.cyl(.065, .17, [x, 1.4, -.34], 'dark'); }
      h.bar([-.85, .3, -.6], [-.85, 1.88, -.6], .027); h.bar([-.85, 1.88, -.6], [.9, 1.88, -.6], .027); h.control([1.05, 1.42, -.48], [.36, .48, .16]);
      h.pipe([[-1.6, 1.07, .18], [-1.2, 1.07, .64], [-.5, 1.07, .7], [.2, 1.07, .3]], .022, 'white'); feature('long-bottle-conveyor;two-horizontal-label-reels;white-guide-loop;overhead-support;side-HMI'); return;
    }
    h.box([2.85, .62, 1.32], [0, .43, 0]); wheels(2.62, 1.14); cage(2.85, 1.32, .78, 2.18, true);
    for (const x of [-1.05, -.35, .35, 1.05]) { h.box([.018, 1.37, .03], [x + .34, 1.48, .68]); handle([x + .22, 1.4, .71], .03); h.box([.63, .52, .018], [x, .45, .68]); }
    h.belt(1.8, .44, .86, [0, 0, .96]); h.control([-1.6, 1.57, .4], [.35, .62, .16]); stackLight([1.3, 2.06, -.45]);
    for (const x of [-.78, 0, .78]) { h.cyl(.045, .62, [x, 1.13, 0], 'dark', 'z'); h.box([.16, .25, .23], [x, 1.52, .1]); }
    if (n === 55) { motor([0, 2.37, -.24], 'edge', true, .75); h.cyl(.19, .62, [1.58, 1.1, -.1], 'white', 'x'); h.pipe([[1.45, 1.6, .2], [1.55, 2.25, .2], [.8, 2.39, -.1]], .025, 'black'); feature('multipack-door-cabinet;visible-high-drive;side-film-roll-and-cable'); }
    else feature('cartoning-glazed-multiple-doors;SS-lower-doors;visible-top-pack-guides;short-discharge-belt');
  }

  function utility() {
    if (n === 51) {
      h.cyl(.22, 1.69, [-.3, .94, 0], 'blue').userData.cardFeature = 'blue-resin-cylinder'; h.cyl(.23, .15, [-.3, .12, 0], 'black'); h.cyl(.16, .16, [-.3, 1.85, 0], 'dark');
      panel([.36, .35, .26], [-.3, 2.04, -.015], 'white', .04).userData.cardFeature = 'softener-white-valve-head';
      h.ring(.15, .012, [-.3, 2.04, .133], 'edge', 'z');
      h.cyl(.115, .025, [-.3, 2.04, .151], 'blue', 'z').userData.cardFeature = 'softener-blue-front-dial';
      for (let i = 0; i < 8; i++) { const a = i * Math.PI / 4, tick = h.box([.018, .035, .01], [-.3 + Math.cos(a) * .138, 2.04 + Math.sin(a) * .138, .154], 'white'); tick.rotation.z = a - Math.PI / 2; }
      h.cyl(.31, .82, [.37, .43, -.25], 'blue'); h.cyl(.32, .045, [.37, .87, -.25], 'dark');
      h.pipe([[-.3, 1.87, .03], [-.69, 1.87, .03], [-.69, .27, .03], [-.4, .27, .27]], .031); h.pipe([[-.64, .32, .03], [.67, .32, .03], [.67, 1.8, .03], [-.3, 1.8, -.1]], .025);
      for (const p of [[-.68, 1.57, .09], [.68, 1.58, .09]]) dial(p, .065); feature('tall-blue-resin-column;separate-short-brine-drum;white-square-automatic-valve-head;blue-circular-front-control;two-gauges;small-pipe-bypass'); return;
    }
    if (n === 101) {
      h.box([1.08, 1.62, .94], [0, .89, 0], 'dark'); h.box([1.02, .08, .88], [0, .08, 0], 'black'); h.box([.045, 1.6, .02], [.16, .89, .482], 'blue');
      panel([.3, .23, .025], [.33, 1.31, .49], 'black'); panel([.2, .09, .008], [.33, 1.35, .51], 'screen'); h.cyl(.025, .016, [.33, 1.21, .515], 'red', 'z');
      for (const x of [-.51, .51]) h.box([.015, 1.29, .73], [x, .87, 0], 'edge');
      for (let i = 0; i < 9; i++) { h.box([.7, .018, .012], [0, .9 + i * .055, -.48], 'black'); h.box([.012, .45, .016], [-.35 + i * .088, 1.12, -.49], 'black'); }
      h.pipe([[-.3, 1.64, -.4], [-.3, 1.8, -.47], [.4, 1.8, -.47], [.54, 1.59, -.4]], .026, 'black'); feature('dark-two-door-cabinet;thin-blue-front-stripe;small-recessed-control;rear-square-grid'); return;
    }
    if (n === 103) {
      h.box([1.15, 2.04, 1.08], [0, 1.17, 0]); wheels(.98, .92); panel([.52, 2.04, .27], [-.34, 1.17, .62], 'dark', .065);
      h.box([.4, .35, .02], [-.34, 1.18, .775], 'black'); h.cyl(.055, .035, [-.34, 1.75, .79], 'red', 'z'); h.cyl(.08, .025, [-.34, 1.6, .79], 'yellow', 'z');
      for (const x of [-.45, -.25]) h.cyl(.03, .02, [x, .91, .79], 'white', 'z');
      h.box([.65, .5, .3], [0, 1.8, -.67], 'dark'); motor([.25, .36, -.65], 'blue', false, .8); h.cyl(.13, .5, [-.18, .42, -.67], 'dark');
      h.pipe([[-.42, .3, -.68], [-.65, .3, -.68], [-.65, 2.19, -.68], [.5, 2.19, -.68]], .04); h.pipe([[.5, .3, -.64], [.65, .3, -.64], [.65, 1.75, -.64]], .035); dial([.72, 1.15, -.55], .08);
      for (const x of [-.35, .3]) h.ring(.08, .012, [x, 2.25, -.55], 'red', 'z'); h.cyl(.12, .5, [0, 2.42, -.25]); feature('slender-front-control-tower;rectangular-SS-boiler;rear-black-burner-box;blue-lower-pump;external-valve-pipework'); return;
    }
    h.box([1.9, .12, 1.65], [0, .12, 0], 'dark'); h.cyl(.64, 1.89, [0, 1.19, 0], 'white'); h.cyl(.66, .16, [0, 2.2, 0], 'dark');
    bolts(.61, [0, 2.29, 0], 'y', 12); h.cyl(.15, .55, [.07, 2.55, -.17]);
    panel([.48, 2.17, .35], [-.68, 1.2, .6], 'white', .05); h.box([.34, .12, .02], [-.68, 1.77, .79], 'screen');
    h.cyl(.22, .75, [.68, .84, -.1]); motor([.89, .54, -.08], 'blue', false, .95); h.cyl(.24, .62, [.67, 1.44, -.13]); h.cyl(.26, .07, [.67, 1.76, -.13], 'dark');
    h.box([.17, .7, .12], [.57, 1.0, .49], 'black'); for (let i = 0; i < 5; i++) h.cyl(.015, .012, [.57, .74 + i * .135, .56], 'white', 'z');
    h.pipe([[-.55, .24, .52], [.75, .24, .52], [.75, 2.07, .4], [.25, 2.07, .4]], .035, 'edge'); dial([.47, 2.3, .42], .09); feature('single-white-vertical-boiler;black-bolted-top;separate-tall-control-cabinet;side-blue-blower;external-level-column');
  }

  function thermal() {
    if (n === 58) {
      squareFeet(4.35, 1.48, .23); h.box([4.6, 2.55, 1.6], [0, 1.51, 0]);
      for (const x of [-1.73, -.58, .58, 1.73]) { panel([1.11, 2.35, .025], [x, 1.51, .817]); handle([x + .35, 1.29, .85], .025); port(.14, [x, 2.46, .84], 'z', .035); for (const y of [.55, 2.45]) h.box([.045, .08, .035], [x - .48, y, .85]); }
      h.pipe([[-2.18, .4, .92], [-1.6, .4, .92], [1.6, .4, .92], [2.18, .73, .72]], .06); motor([-1.65, .34, .9], 'red', false, .9);
      for (const x of [-1.5, 0, 1.5]) h.cyl(.12, .58, [x, 3.04, -.15]); h.control([2.46, 1.37, .1], [.4, 1.4, .28]); feature('high-multi-door-post-sterilizing-tunnel;upper-round-ports;roof-exhaust-stacks;low-SS-manifold-and-red-pump'); return;
    }
    const pet = n === 46, hot = n === 56, w = pet ? 11.4 : 10.9, d = 1.35;
    squareFeet(w - .23, d - .18, .3); h.box([w, pet ? .95 : .7, d], [0, pet ? .86 : .7, 0]);
    if (pet) {
      h.box([w, .41, d], [0, 1.5, 0]);
      for (let i = 0; i < 7; i++) { const x = (i - 3) * w / 7, paneW = w / 7 - .1; panel([paneW, .16, .025], [x, 1.55, .69], 'dark'); for (const dx of [-paneW / 6, paneW / 6, paneW / 2]) h.box([.015, .2, .02], [x + dx, 1.55, .71]); }
      for (const x of [-w * .29, w * .27]) { motor([x, .44, -.92], 'green', true, .9); h.box([.38, .18, .3], [x, .23, -.92]); motor([x, 1.96, 0], 'edge', false, .65); h.pipe([[x, .5, -.82], [x, 1.05, -.82], [x + .25, 1.05, -.65]], .04); }
      h.pipe([[-w * .46, .77, -.82], [w * .46, .77, -.82], [w * .46, 1.3, -.68]], .045); feature('long-low-pasteurizer;thin-upper-window-strip;two-roof-blowers;green-side-pumps');
    } else {
      h.box([w - .2, .025, d - .15], [0, 1.065, 0], 'dark');
      for (let x = -w / 2 + .14; x < w / 2; x += .16) h.box([.018, .023, d - .15], [x, 1.085, 0], 'steel');
      for (const z of [-d / 2 + .08, d / 2 - .08]) h.bar([-w / 2 + .1, 1.25, z], [w / 2 - .1, 1.25, z], .018);
      if (hot) { const hood = h.box([1.27, .58, 1.43], [w / 2 - .9, 1.45, 0]); hood.rotation.z = -.12; feature('open-mesh-hot-water-trough;angular-end-hood;external-blue-drive'); }
      else { h.bar([-w / 2 + .23, 1.73, -.25], [w / 2 - .23, 1.73, -.25], .019); for (let x = -w / 2 + .38; x < w / 2 - .38; x += .7) h.cyl(.024, .11, [x, 1.66, -.25], 'orange'); feature('long-open-cooling-trough;mesh-bed;overhead-spray-bar-and-small-nozzles'); }
      motor([w / 2, 1.03, .38], 'blue', false, .85); h.belt(.95, 1.02, .99, [-w / 2 - .35, 0, 0]);
    }
    h.pipe([[-w / 2 + .2, .46, .83], [w / 2 - .2, .46, .83], [w / 2 - .2, .88, .64]], .05); port(.055, [.6, .46, .87], 'x', .16); h.box([.18, .22, .18], [.6, .64, .87], 'orange');
  }

  function transport() {
    if (n === 50) {
      squareFeet(1.03, .92, .72); h.box([1.15, .06, 1.06], [0, .75, 0]);
      const hopper = h.mesh(geo(`card-50-square-cap-hopper:${detail}`, () => new THREE.CylinderGeometry(.56, .2, .55, 4, 1, true)), [0, .98, .08], 'hopperSteel'); hopper.rotation.y = Math.PI / 4;
      h.box([.35, 2.17, .2], [0, 1.77, -.46], 'blue'); for (let y = .88; y < 2.83; y += .14) h.box([.28, .025, .035], [0, y, -.344], 'white'); h.box([.54, .17, .53], [0, 2.93, -.26]);
      h.cyl(.13, .33, [.27, 2.83, -.4], 'edge', 'x'); h.box([.23, .2, .14], [.42, .93, .53]); for (const [x, paint] of [[.37, 'green'], [.47, 'red']]) h.cyl(.022, .016, [x, .94, .61], paint, 'z'); feature('blue-vertical-cap-elevator-track;square-open-lower-hopper;top-return-box;floor-frame'); return;
    }
    if (n === 60) {
      squareFeet(3.2, 1.22, .33); h.box([3.42, .64, 1.35], [0, .68, 0]);
      for (const side of [-1, 1]) { port(.2, [0, .71, side * .69], 'z', .04); handle([0, .71, side * .72], .18); for (const x of [-.15, .15]) h.box([.025, .13, .04], [x, .7, side * .74]); }
      h.box([3.23, .025, 1.15], [0, 1.02, 0], 'dark'); for (let x = -1.5; x < 1.6; x += .13) h.box([.015, .02, 1.13], [x, 1.04, 0], 'steel');
      for (const z of [-.55, .55]) h.bar([-1.5, 1.19, z], [1.5, 1.19, z], .02);
      const hood = h.box([.8, .32, 1.4], [1.36, 1.34, 0]); hood.rotation.z = -.22; h.belt(.86, 1.05, .97, [-2.04, 0, 0]);
      for (const x of [-.7, -.38]) h.cyl(.06, 1.52, [x, 1.78, -.42]); h.box([.47, .48, .16], [.24, 1.62, -.5]); for (const x of [.12, .35]) for (const [y, paint] of [[1.77, 'green'], [1.62, 'red'], [1.47, 'black']]) h.cyl(.021, .018, [x, y, -.409], paint, 'z'); feature('long-trough-main-body;round-clamped-side-hatches;exposed-mesh-belt;angled-end-cover;two-vertical-pipes;central-button-box'); return;
    }
    const curve = new THREE.CatmullRomCurve3([[-1.5, 0, 0], [.5, 0, 0], [1.12, 0, .35], [1.18, 0, 1.01], [.72, 0, 1.45], [-.7, 0, 1.47]].map(p => new THREE.Vector3(...p)), false, 'centripetal');
    const points = [[], []]; for (let i = 0; i <= 32; i++) { const p = curve.getPointAt(i / 32), t = curve.getTangentAt(i / 32), normal = new THREE.Vector3(-t.z, 0, t.x).normalize(); for (let side = 0; side < 2; side++) points[side].push(p.clone().addScaledVector(normal, (side ? -1 : 1) * .27)); }
    const shape = new THREE.Shape(); [...points[0], ...points[1].reverse()].forEach((p, i) => i ? shape.lineTo(p.x, -p.z) : shape.moveTo(p.x, -p.z)); shape.closePath();
    h.mesh(geo(`card-curved-belt:${detail}`, () => { const g = new THREE.ExtrudeGeometry(shape, { depth: .07, bevelEnabled: false }); g.rotateX(-Math.PI / 2); return g; }), [0, .81, 0], n === 59 ? 'white' : 'green');
    for (const side of [-1, 1]) { const rail = []; for (let i = 0; i <= 16; i++) { const p = curve.getPointAt(i / 16), t = curve.getTangentAt(i / 16), normal = new THREE.Vector3(-t.z, 0, t.x).normalize(); p.addScaledVector(normal, side * .3); rail.push([p.x, .98, p.z]); } h.pipe(rail, .018); }
    for (const t of [.05, .4, .68, .94]) { const p = curve.getPointAt(t); for (const side of [-1, 1]) h.cyl(.025, .8, [p.x, .4, p.z + side * .2]); }
    h.box([1.98, .51, .75], [-.2, .56, -.55]);
    for (let i = 0; i < 6; i++) { const x = -1.03 + i * .3; h.cyl(.024, .31, [x, 1.17, -.37]); h.pipe([[x, 1.71, -.62], [x, 1.52, -.45], [x, 1.34, -.37]], .015, n === 59 ? 'blue' : 'white'); }
    cage(2.08, .76, .82, 1.75); h.control([1.1, 1.48, -.37], [.33, .43, .15]);
    feature(n === 44 ? 'small-open-filling-bed;exposed-nozzle-tubes;curved-green-bottle-conveyor' : 'low-SS-unloader-bed;blue-clamp-array;white-curved-slat-discharge;independent-HMI');
  }

  function process() {
    if (n === 94) {
      h.cyl(.32, .44, [0, .27, 0], 'edge'); h.cyl(.45, .32, [0, .65, 0], 'steel', 'y', .27);
      for (let i = 0; i < 3; i++) { const y = .98 + i * .22; h.cyl(.53, .18, [0, y, 0]); h.ring(.54, .022, [0, y + .09, 0]); const a = i * Math.PI * 2 / 3, p = h.box([.49, .065, .19], [Math.cos(a) * .57, y, Math.sin(a) * .57]); p.rotation.y = -a; for (const x of [-.48, .48]) h.box([.025, .1, .035], [x, y + .07, .15], 'edge'); }
      h.cyl(.54, .03, [0, 1.56, 0]); h.cyl(.055, .08, [0, 1.61, 0]); feature('three-stacked-sieve-rings;three-radial-discharge-chutes;low-flat-lid;short-central-base'); return;
    }
    if (n === 98) {
      cage(1.78, .76, .09, .69); h.box([1.92, .035, .7], [0, .72, 0]);
      for (const z of [-.3, .3]) h.box([1.55, .14, .025], [.14, .81, z]);
      h.cyl(.26, .65, [-.62, 1.14, -.08]).userData.cardFeature = 'pearl-small-round-vessel'; h.cyl(.27, .04, [-.62, 1.48, -.08]); h.cyl(.26, .18, [-.62, .72, -.08], 'steel', 'y', .12);
      for (const x of [-.1, .35, .8]) { h.cyl(.05, .26, [x, .87, .11], 'steel', 'x'); h.cyl(.035, .14, [x, 1.0, .11]); }
      motor([-.64, .35, .1], 'blue', false, .7); h.pipe([[-.62, .62, -.08], [-.62, .3, .13], [.18, .3, .21], [.18, .8, .21]], .03, 'black'); feature('low-long-transfer-trough;small-independent-round-vessel;short-exposed-feed-fittings;no-large-invented-cone'); return;
    }
    if (n === 99) {
      panel([1.26, 1.02, .91], [0, .67, 0], 'steel', .04); squareFeet(1.1, .76, .16); h.box([1.25, .07, .9], [0, 1.22, 0]);
      for (const x of [-.36, 0, .36]) { h.cyl(.072, .23, [x, 1.35, .55], 'edge', 'z'); h.cyl(.045, .12, [x, 1.5, .4]); h.cyl(.065, .05, [x, 1.58, .4]); }
      dial([-.55, 1.68, .49], .13); h.pipe([[-.53, 1.5, .4], [-.45, 1.89, .2], [.33, 1.83, .05], [.58, 1.06, -.24]], .044, 'steel');
      h.box([.23, .48, .025], [.54, .96, .48], 'blue'); for (const y of [.86, 1.05]) dial([.54, y, .51], .043);
      handle([-.27, .87, -.47], .17); handle([.27, .87, -.47], .17);
      for (const x of [-.644, .644]) for (const z of [-.23, .23]) for (let i = 0; i < 5; i++) h.box([.009, .014, .31], [x, .32 + i * .045, z], 'dark');
      feature('three-front-pump-heads;large-top-pressure-gauge;curved-braided-hose;rounded-SS-lid;paired-side-louvres'); return;
    }
    if (n === 106) {
      h.box([.82, .98, .81], [-.33, .61, 0]); h.box([.63, .78, .81], [.42, .51, 0]); wheels(1.31, .68);
      const funnel = h.mesh(geo('card-106-square-tapered-hopper', () => new THREE.CylinderGeometry(.45, .1, .55, 4, 1, true)), [-.32, 1.54, -.2], 'hopperSteel'); funnel.rotation.y = Math.PI / 4;
      h.cyl(.11, .18, [-.32, 1.17, -.2]); h.cyl(.11, .64, [-.35, 1.45, .38]); h.control([-.35, 1.94, .38], [.59, .43, .12]);
      h.cyl(.12, .4, [.43, 1.11, 0], 'steel', 'y', .22); motor([.43, 1.45, 0], 'blue', true, .52); h.control([.43, 1.87, 0], [.38, .4, .12]);
      for (const x of [-.33, .42]) { handle([x, .65, .42], .12); vents([x, .66, -.419], .48, 5); } feature('two-height-SS-base-cabinets;square-rear-hopper;two-separate-control-boxes;blue-external-drive;blue-castors'); return;
    }
    h.box([.56, 1.57, .65], [.35, .96, 0], 'white'); h.box([1.1, .12, .93], [0, .16, 0], 'white'); panel([1.02, .35, .78], [0, 1.77, 0], 'white', .06);
    const bowlProfile = [[0, 0], [.25, .01], [.4, .1], [.46, .25], [.47, .52]];
    h.mesh(geo(`card-107-bowl:${detail}`, () => new THREE.LatheGeometry(bowlProfile.map(p => new THREE.Vector2(...p)), seg)), [-.3, .47, .05], 'hopperSteel'); h.ring(.475, .013, [-.3, .99, .05]);
    const hood = h.mesh(geo(`card-107-slanted-metal-hood:${detail}`, () => new THREE.CylinderGeometry(.23, .48, .5, seg, 1, true)), [-.24, 1.25, .05], 'hopperSteel'); hood.rotation.z = .28;
    for (const z of [-.3, .3]) h.bar([.27, .57, z], [-.3, .57, z], .025, 'white');
    panel([1.08, 1.15, .045], [.12, .79, .56], 'white'); h.cyl(.035, .06, [.35, 1.39, .5], 'yellow');
    panel([.43, 1.1, .015], [.35, .91, -.34], 'white'); vents([.35, 1.62, -.354], .4, 4); vents([.35, .28, -.354], .4, 4); h.pipe([[.52, 1.4, -.2], [.62, .8, -.3], [.55, .6, -.3]], .015, 'black');
    for (const x of [-.46, .46]) for (const z of [-.38, .38]) h.cyl(.065, .07, [x, .045, z], 'edge'); feature('white-vertical-planetary-bed;side-mounted-round-SS-bowl;slanted-metal-bowl-guard;lift-support-arms;rear-vent-panels;no-invented-mixing-tool');
  }

  if (['tank', 'mixer'].includes(item.type)) mixingTank();
  else if (item.type === 'sterilizer') tubular();
  else if (item.type === 'filler') filling();
  else if (item.type === 'cartoner') packaging();
  else if (['boiler', 'compressor', 'softener'].includes(item.type)) utility();
  else if (item.type === 'pasteurizer') thermal();
  else if (item.type === 'conveyor') transport();
  else if (['sieve', 'hopper', 'homogenizer', 'pellet', 'kneader'].includes(item.type)) process();
  else return null;
  return { features, sourceCards: [n], basis: 'four-direction-card-exterior', hiddenMechanismsAdded: false };
}
