import * as THREE from '../shared/vendor/three.module.js';
import { buildCampusWastewater } from './wastewater-models.js';
import { buildEntranceProduction } from './entrance-production-models.js';
import { CAMPUS_ROOM } from './campus-data.js';
import { OUTDOOR_EQUIPMENT, OUTDOOR_ROOM } from './outdoor-data.js';
import { buildOutdoorEnvironment, buildOutdoorEquipment } from './outdoor-models.js';
import { buildCampusRearEquipment, addCampusRearDetails } from './campus-rear-models.js';
import { buildCampusBoilerRoom } from './boiler-models.js';
import { buildRearStairDetails } from './rear-stair-models.js';

// Recognizable exterior masses from the actual promotion-video view. Local
// axes and proportions are visual model coordinates, not survey measurements.
const PI = Math.PI;

function palette(s) {
  if (s.campusMaterials) return s.campusMaterials;
  const material = (color, roughness = .8, metalness = .05, extra = {}) => s._material(color, roughness, metalness, extra);
  const m = {
    cream: material(0xe9e7d9), white: material(0xe6e9e2), wall: material(0xc3cbc9),
    blueRoof: material(0x45a6d2, .61, .21), blueTrim: material(0x24769e, .6, .3),
    orangeRoof: material(0xdb895b, .67, .12), greenRoof: material(0x6da287, .85),
    archRoof: material(0x253840, .65, .2, { side: THREE.DoubleSide }),
    glass: material(0x19353e, .29, .35), glassLight: material(0x506c6b, .31, .3),
    glassGreen: material(0x467b6b, .32, .3), steel: material(0x99aba7, .44, .55),
    asphalt: material(0x929b97, .99), concrete: material(0xc5c9bf, .97),
    road: material(0x747f7a, .99), entryGreen: material(0x3e7961, .75, .18),
    roofLight: material(0xd9d8b3, .76, .1), facadeTrim: material(0x9aa5a1, .7, .22),
    yellow: material(0xd2b66c), dark: material(0x25332e), red: material(0x8e3f37),
    leaves: material(0x5a805c), grass: material(0x788f6b), earth: material(0x93917e),
    carWhite: material(0xdde3de, .47, .2), carGray: material(0x5b6565, .45, .3),
    carBlack: material(0x293337, .43, .3),
  };
  if (typeof document !== 'undefined') {
    const logoSource = './assets/brand/heechang-official-logo.svg';
    const logoUrl = !logoSource.startsWith('data:') && typeof location !== 'undefined' && location.pathname.includes('/site/share/') ? `.${logoSource}` : logoSource;
    const texture = new THREE.TextureLoader().load(logoUrl, () => s._invalidate?.());
    texture.colorSpace = THREE.SRGBColorSpace; s.textures.add(texture);
    m.logo = material(0xffffff, .9, 0, { map: texture, transparent: true, alphaTest: .1, depthWrite: false, toneMapped: false });
  } else m.logo = m.blueTrim;
  s.campusMaterials = m; return m;
}

function instances(s, parent, geometry, material, transforms, name) {
  if (!transforms.length) { geometry.dispose(); return null; }
  const mesh = new THREE.InstancedMesh(geometry, material, transforms.length);
  const matrix = new THREE.Matrix4(), quaternion = new THREE.Quaternion();
  transforms.forEach((entry, index) => {
    const position = entry.position || entry;
    quaternion.setFromEuler(new THREE.Euler(...(entry.rotation || [0, 0, 0])));
    matrix.compose(new THREE.Vector3(...position), quaternion, new THREE.Vector3(...(entry.scale || [1, 1, 1])));
    mesh.setMatrixAt(index, matrix);
  });
  mesh.instanceMatrix.needsUpdate = true; mesh.castShadow = true; mesh.receiveShadow = true;
  mesh.name = name || 'campus-repeated-detail'; parent.add(mesh); s.geometries?.add(geometry);
  mesh.computeBoundingBox(); mesh.computeBoundingSphere(); return mesh;
}

function boxes(s, parent, material, values, name) {
  return instances(s, parent, new THREE.BoxGeometry(1, 1, 1), material,
    values.map(([position, scale, rotation]) => ({ position, scale, rotation })), name);
}

function gable(s, parent, width, depth, rise, position, material, name) {
  const shape = new THREE.Shape(); shape.moveTo(-width / 2, 0); shape.lineTo(width / 2, 0); shape.lineTo(0, rise); shape.closePath();
  const geometry = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: false, steps: 1 }); geometry.translate(0, 0, -depth / 2);
  const roof = s._mesh(geometry, material, parent, position); roof.name = name || 'campus-gable-roof'; return roof;
}

function roofVents(s, parent, points) {
  const m = palette(s);
  instances(s, parent, new THREE.CylinderGeometry(1, 1, 1, 10), m.steel,
    points.map(([x, y, z]) => ({ position: [x, y + .28, z], scale: [.35, .55, .35] })), 'campus-roof-vent-bases');
  instances(s, parent, new THREE.CylinderGeometry(1, 1, 1, 12), m.white,
    points.map(([x, y, z]) => ({ position: [x, y + .62, z], scale: [.55, .18, .55] })), 'campus-roof-vent-caps');
}

function foundation(s, parent, width, depth) {
  const m = palette(s);
  s._box(parent, [width + .7, .24, depth + .7], [0, .12, 0], m.concrete);
}

function smallWindows(s, parent, width, depth, rows, material) {
  const values = [];
  for (const y of rows) {
    for (let x = -width / 2 + 2; x <= width / 2 - 1; x += 3.5) values.push([[x, y, depth / 2 + .045], [2.2, 1.2, .09]]);
    for (let z = -depth / 2 + 2; z <= depth / 2 - 1; z += 3.5) values.push([[width / 2 + .045, y, z], [.09, 1.2, 2.2]]);
  }
  boxes(s, parent, material, values, 'campus-repeated-windows');
}

function rainwaterPipes(s, parent, width, depth, height, spacing = 12) {
  const m = palette(s), values = [];
  const count = Math.max(1, Math.round(width / spacing));
  for (let index = 0; index <= count; index++) {
    const x = -width / 2 + .35 + (width - .7) * index / count;
    values.push([[x, height / 2, depth / 2 + .2], [.16, height - .25, .16]]);
    values.push([[x, .25, depth / 2 + .45], [.16, .16, .6]]);
  }
  boxes(s, parent, m.facadeTrim, values, 'campus-rainwater-downpipes');
}

function loadingDetails(s, parent, doors, depth, height, { redIndices = [] } = {}) {
  const m = palette(s), frames = [], bumpers = [], markings = [];
  doors.forEach(([x, width], index) => {
    frames.push([[x, height + .16, depth / 2 + .25], [width + .5, .3, .3]]);
    for (const side of [-1, 1]) {
      frames.push([[x + side * (width / 2 + .15), height / 2, depth / 2 + .25], [.25, height, .3]]);
      bumpers.push([[x + side * (width / 2 + .55), .7, depth / 2 + .65], [.28, 1.3, .32]]);
      markings.push([[x + side * (width / 2 + .55), 1.2, depth / 2 + .65], [.31, .23, .35]]);
    }
    const frame = s._group(parent, [x, .1, depth / 2 + .23]); frame.name = 'campus-loading-shutter';
    // Only the exterior was recorded: retain a dark recess behind the moving
    // curtain rather than inventing an interior beyond this facade.
    s._box(frame, [width, height, .025], [0, height / 2, -.045], m.dark).name = 'campus-loading-door-recess';
    const curtain = s._group(frame); curtain.name = 'campus-loading-moving-curtain';
    curtain.userData.proximityDoor = { enterable: false, kind: 'lift', axis: 'y', closed: 0, open: height + .015, retract: true, openScale: .025, trigger: [0, 0, 0], width, height };
    s._box(curtain, [width, height, .055], [0, height / 2, 0], m.wall).name = 'campus-loading-door-panel';
    if (redIndices.includes(index)) s._box(curtain, [width * .88, height * .76, .025], [0, height * .4, .045], m.red);
    const slats = [];
    for (let row = .5; row < height; row += .45) slats.push([[0, row, .04], [width - .1, .035, .035]]);
    boxes(s, curtain, m.facadeTrim, slats, 'campus-loading-shutter-slats');
    bumpers.push([[x, .12, depth / 2 + .68], [width + .3, .2, 1.2]]);
  });
  boxes(s, parent, m.white, frames, 'campus-loading-door-surrounds');
  boxes(s, parent, m.dark, bumpers, 'campus-loading-thresholds-bollards');
  boxes(s, parent, m.yellow, markings, 'campus-loading-bollard-markers');
}

function office(s, root, item) {
  const m = palette(s), { width: w, depth: d, height: h } = item;
  const sx = w / 38, sy = h / 18, sz = d / 22;
  const shell = s._part(root, item.parts[0], [-5, 1, 0]); shell.name = 'campus-office-body';
  foundation(s, shell, w, d); s._box(shell, [w, h, d], [0, h / 2, 0], m.white);
  s._box(shell, [w - 4.5 * sx, 12.9 * sy, .16], [0, 10.45 * sy, d / 2 + .1], m.glass);
  const piers = [-.447, -.224, 0, .224, .447].map((x) => [[x * w, h * .583, d / 2 + .28], [.65, h * .833, .55]]);
  boxes(s, shell, m.white, piers, 'campus-office-front-piers');
  const roof = s._part(root, item.parts[1], [0, 5, 0]); roof.name = 'campus-office-green-roof';
  s._box(roof, [w - 1, .3, d - 1], [0, h + .2, 0], m.greenRoof);
  boxes(s, roof, m.white, [
    [[0, h + .5, -d / 2], [w, 1, .45]], [[0, h + .5, d / 2], [w, 1, .45]],
    [[-w / 2, h + .5, 0], [.45, 1, d]], [[w / 2, h + .5, 0], [.45, 1, d]],
  ], 'campus-office-parapets');
  roofVents(s, roof, [-13, -5, 3, 11].flatMap((x) => [-6, 2, 7].map((z) => [x * sx, h + .4, z * sz])));
  const facade = s._part(root, item.parts[2], [3, 1, 4]);
  smallWindows(s, facade, w, d, [3, 8, 13].map((y) => y * sy), m.glassGreen);
  boxes(s, facade, m.steel, [6.5, 10.5, 14.5].map((y) => [[0, y * sy, d / 2 + .22], [w - 4.5 * sx, .13, .08]]), 'campus-office-window-rails');
  const mullions = [], cornerBands = [];
  for (let index = 1; index < 16; index++) mullions.push([[(index / 16 - .5) * (w - 4.5 * sx), h * .583, d / 2 + .23], [.055, h * .716, .08]]);
  for (const side of [-1, 1]) for (const level of [.15, .2, .25, .84, .88, .92, .96]) {
    cornerBands.push([[side * (w / 2 - .8), h * level, d / 2 + .2], [1.6, .14, .12]]);
    cornerBands.push([[side * (w / 2 + .05), h * level, d / 2 - 1.1], [.12, .14, 2.3]]);
  }
  boxes(s, facade, m.steel, mullions, 'campus-office-fine-glazing-mullions');
  boxes(s, facade, m.facadeTrim, cornerBands, 'campus-office-corner-facade-bands');
  boxes(s, facade, m.dark, [[[0, .45, d / 2 + .08], [w - 1.2, .65, .16]]], 'campus-office-ground-plinth');
  const entryWidth = 4.3 * sx, entryHeight = 3.5 * sy;
  const entry = s._group(facade, [0, .15 * sy, d / 2 + .35]); entry.name = 'campus-office-glass-entry';
  s._box(entry, [entryWidth, entryHeight, .025], [0, entryHeight / 2, -.04], m.dark);
  for (const side of [-1, 1]) {
    const leaf = s._group(entry, [side * entryWidth / 4, 0, 0]); leaf.name = 'campus-office-entry-leaf';
    leaf.userData.proximityDoor = { enterable: false, kind: 'slide', axis: 'x', closed: side * entryWidth / 4, open: side * entryWidth * .75, trigger: [0, 0, 0], width: entryWidth, height: entryHeight };
    s._box(leaf, [entryWidth / 2 - .015, entryHeight, .18], [0, entryHeight / 2, 0], m.glass);
  }
  s._box(facade, [5.8 * sx, .3, 2.2 * sz], [0, 3.9 * sy, d / 2 + .9], m.steel);
  rainwaterPipes(s, facade, w, d, h, w);
}

function tower(s, root, item) {
  const m = palette(s), { width: w, depth: d, height: h } = item;
  const rearExtension = item.rearSurvey?.towerRearExtension || 0;
  const terrace = item.serviceTerrace || { position: [15, 0, 14], width: 48, depth: 28, elevation: item.thirdFloorElevation ?? 7.3 };
  const [terraceX, , terraceZ] = terrace.position, floorY = terrace.elevation;
  const left = terraceX - terrace.width / 2, right = terraceX + terrace.width / 2;
  const back = terraceZ - terrace.depth / 2, front = terraceZ + terrace.depth / 2;
  const shell = s._part(root, item.parts[0], [-5, 1, 0]); shell.name = 'campus-heechang-tower-body';
  foundation(s, shell, w, d);
  // The employee's CG reference shows a blank high front wall, recessed flat
  // rooftop and three separate vertical service fins, rather than an orange cap.
  s._box(shell, [w * .78, h - 1.4, d - .6 + rearExtension], [-w * .11, (h - 1.4) / 2, -.3-rearExtension/2], m.cream);
  if (rearExtension) s._box(shell,[w,h-1.4,rearExtension],[0,(h-1.4)/2,-d/2-rearExtension/2],m.cream).name='campus-tower-reviewed-rear-volume';
  s._box(shell, [w, h, .6], [0, h / 2, d / 2 - .3], m.cream).name = 'campus-tower-high-sign-wall';
  boxes(s, shell, m.cream, [-d / 2 + .35, 0, d / 2 - .95].map((z) => [[w * .39, h / 2, z], [w * .22, h, .7]]), 'campus-tower-three-service-shafts');
  // The green working surface is the employee-confirmed third-floor terrace.
  // It wraps the lower tower; the neighboring orange-roof building is separate.
  const annexSolid = (name, height, margin, material) => {
    const group=s._group(shell); group.name=name;
    const opening=item.rearElevatorOpening;
    if (!opening) { s._box(group,[terrace.width+margin*2,height,terrace.depth+margin*2],[terraceX,height/2,terraceZ],material); return; }
    const l=left-margin,r=right+margin,b=back-margin,f=front+margin;
    const x0=opening.centerX-opening.width/2,x1=opening.centerX+opening.width/2,z1=back+opening.depth;
    for(const [a,c] of [[l,x0],[x1,r]]) s._box(group,[c-a,height,f-b],[(a+c)/2,height/2,(b+f)/2],material);
    s._box(group,[opening.width,height,f-z1],[opening.centerX,height/2,(z1+f)/2],material);
    if(height>opening.height) s._box(group,[opening.width,height-opening.height,z1-b],[opening.centerX,(height+opening.height)/2,(b+z1)/2],material);
    group.userData.visibleElevatorNotch={...opening};
  };
  annexSolid('campus-third-floor-service-annex-foundation',.24,.35,m.concrete);
  const annexPaint=s._material(0xd9ddc3,.88,.03);
  annexSolid('campus-third-floor-service-annex-body',floorY-.12,0,annexPaint);
  const roof = s._part(root, item.parts[1], [0, 7, 0]); roof.name = 'campus-tower-flat-roof';
  if (rearExtension) s._box(roof,[w*.78,.18,rearExtension],[-w*.11,h-1.32,-d/2-rearExtension/2],m.wall).name='campus-tower-reviewed-rear-roof-extension';
  for (const bay of item.rearSurvey?.shaftBays || []) {
    const bayRoot=s._group(shell,[bay.x,0,bay.back]); bayRoot.name=`campus-rear-${bay.id}`;
    Object.assign(bayRoot.userData,{rearSurveyShaft:true,measuredDimensions:false,interiorStairsAdded:false});
    const bayBox=(size,position,material)=>{
      const opening=item.rearElevatorOpening;
      if(!opening) return s._box(bayRoot,size,position,material);
      const lo=position.map((v,i)=>v-size[i]/2),hi=position.map((v,i)=>v+size[i]/2);
      const cutLo=[opening.centerX-opening.width/2-bay.x,0,back-.4-bay.back];
      const cutHi=[opening.centerX+opening.width/2-bay.x,opening.height,back+opening.depth+.1-bay.back];
      const a=lo.map((v,i)=>Math.max(v,cutLo[i])),b=hi.map((v,i)=>Math.min(v,cutHi[i]));
      if(a.some((v,i)=>v>=b[i])) return s._box(bayRoot,size,position,material);
      const add=(l,r)=>{if(l.some((v,i)=>r[i]-v<.0001))return;s._box(bayRoot,r.map((v,i)=>v-l[i]),l.map((v,i)=>(v+r[i])/2),material);};
      add(lo,[a[0],hi[1],hi[2]]);add([b[0],lo[1],lo[2]],hi);
      add([a[0],lo[1],lo[2]],[b[0],a[1],hi[2]]);add([a[0],b[1],lo[2]],[b[0],hi[1],hi[2]]);
      add([a[0],a[1],lo[2]],[b[0],b[1],a[2]]);add([a[0],a[1],b[2]],[b[0],b[1],hi[2]]);
    };
    const openingWidth=bay.id.startsWith('high')?3.1:2.7, openingBase=.8, openingHeight=bay.id.startsWith('high')?35.2:11.5;
    const pier=(bay.width-openingWidth)/2;
    for (const side of [-1,1]) bayBox([pier,bay.height,.17],[side*(openingWidth/2+pier/2),bay.height/2,0],m.cream);
    bayBox([openingWidth,openingBase,.17],[0,openingBase/2,0],m.cream);
    const top=bay.height-openingBase-openingHeight;
    bayBox([openingWidth,top,.17],[0,openingBase+openingHeight+top/2,0],m.cream);
    for(const side of [-1,1]) {
      bayBox([.17,bay.height,bay.depth],[side*(bay.width/2-.085),bay.height/2,bay.depth/2],m.cream);
      bayBox([.11,bay.height,.07],[side*(bay.width/2-.055),bay.height/2,-.12],m.orangeRoof);
    }
    bayBox([bay.width,bay.height,.12],[0,bay.height/2,bay.depth],m.dark);
    bayBox([bay.width+.16,bay.roofHeight||.22,bay.depth+.12],[0,bay.height+.11,bay.depth/2],m.greenRoof);
  }
  s._box(roof, [w * .78 - 1.1, .16, d - 1.1], [-w * .11, h - 1.32, 0], m.wall).name = 'campus-tower-recessed-roof-deck';
  boxes(s, roof, m.cream, [
    [[-w / 2 + .275, h - .7, 0], [.55, 1.4, d]],
    [[w * .28 - .275, h - .7, 0], [.55, 1.4, d]],
    [[-w * .11, h - .7, -d / 2 + .275], [w * .78, 1.4, .55]],
  ], 'campus-tower-open-parapet');
  boxes(s, roof, m.orangeRoof, [
    [[0, h + .045, d / 2 - .3], [w, .09, .66]],
    [[-w / 2 + .275, h + .045, 0], [.61, .09, d]],
    [[-w * .11, h + .045, -d / 2 + .275], [w * .78, .09, .61]],
  ], 'campus-tower-thin-coping');
  boxes(s, roof, m.cream, [
    [[-w * .14, h - .45, -d * .17], [w * .28, 1.75, d * .2]],
    [[-w * .14, h + .47, -d * .17], [w * .31, .13, d * .23]],
  ], 'campus-tower-small-rooftop-headhouse');
  const serviceRoof = s._group(roof); serviceRoof.name = 'campus-third-floor-service-annex-roof';
  s._box(serviceRoof, [terrace.width, .12, terrace.depth], [terraceX, floorY - .06, terraceZ], m.greenRoof).name = 'campus-third-floor-green-terrace';
  boxes(s, serviceRoof, m.white, [
    [[terraceX, floorY + .35, front], [terrace.width, .7, .4]],
    [[right, floorY + .35, terraceZ], [.4, .7, terrace.depth]],
    [[left, floorY + .35, terraceZ], [.4, .7, terrace.depth]],
    [[terraceX, floorY + .35, back], [terrace.width, .7, .4]],
  ], 'campus-third-floor-terrace-parapet');
  const headhouseX = right - 8, headhouseZ = back + 5.5;
  s._box(serviceRoof, [10.5, 2.6, 10], [headhouseX, floorY + 1.3, headhouseZ], m.white).name = 'campus-third-floor-stair-headhouse';
  gable(s, serviceRoof, 11, 10.5, 1.35, [headhouseX, floorY + 2.6, headhouseZ], m.orangeRoof, 'campus-third-floor-stair-orange-roof');
  boxes(s, serviceRoof, m.white, [
    [[right - 13, floorY + .11, front - 9], [12, .22, .28]],
    [[right - 7.15, floorY + .11, front - 13.8], [.3, .22, 9.4]],
    [[right - 13, floorY + .11, front - 18.5], [12, .22, .28]],
  ], 'campus-third-floor-rooftop-pipe-curbs');
  instances(s, serviceRoof, new THREE.CylinderGeometry(.48, .62, .55, 10), m.orangeRoof,
    [front - 5, front - 11, front - 17].map((z) => ({ position: [right - 13, floorY + .275, z] })), 'campus-third-floor-three-orange-vents');
  boxes(s, serviceRoof, m.white, [
    [[8, floorY + .95, 11], [4.4, 1.9, 3.5]],
    [[13, floorY + .95, 11], [4.4, 1.9, 3.5]],
    [[18, floorY + .72, 11], [4.4, 1.44, 3.5]],
    [[1.6, floorY + .65, Math.min(18,front-2)], [3.5, 1.3, 3.3]],
  ], 'campus-third-floor-white-cabinets-and-hatches');
  const details = s._part(root, item.parts[2], [4, 1, 3]);
  const logoWidth = w * .74;
  const logo = s._mesh(new THREE.PlaneGeometry(logoWidth, logoWidth * 81.694 / 240.318), m.logo, details, [-w * .065, h * .895, d / 2 + .045]);
  logo.name = 'campus-hee-chang-sign'; logo.castShadow = false; logo.receiveShadow = false;
  boxes(s, details, m.orangeRoof, [-1, 1].map((side) => [[side * (w / 2 - .12), h / 2, d / 2 + .035], [.15, h, .09]]), 'campus-tower-corner-pilasters');
  boxes(s, details, m.orangeRoof, [-d / 2 + .35, 0, d / 2 - .35].map((z) => [[w / 2 + .025, h / 2, z], [.075, h, .13]]), 'campus-tower-service-shaft-edge-trim');
  const frontWindows = [], sideWindows = [];
  for (let x = left + 2.5; x <= right - 1.5; x += 3.2) frontWindows.push([[x, floorY * .49, front + .035], [.85, floorY * .72, .07]]);
  // 11/11: long window bands crossed the side-road doors and the attached
  // boiler-room wall. Keep three rows of small windows, but only on wall that
  // the videos show free of doors, canopies and the boiler room.
  const eastOpenings = (item.exteriorDetails || []).filter((f) => Math.abs((f.yaw || 0) - Math.PI / 2) < 1e-6 && f.position[0] >= right - 1)
    .map((f) => ({ z: f.position[2], half: Math.max(f.width || 1, f.canopy?.width || 0) / 2 + .35, top: (f.datum === 'base' ? f.height || 2 : f.position[1] + (f.height || 1) / 2) + (f.canopy ? .95 : .2) }));
  const windowBlocked = (y, z, half) => (item.sideWindowExclusions || []).some((zone) => z + half > zone.from && z - half < zone.to)
    || eastOpenings.some((opening) => Math.abs(z - opening.z) < opening.half + half && y - .46 < opening.top);
  if (item.sideFacadeSurvey) {
    for(const window of item.sideFacadeSurvey.windows) sideWindows.push([[right+.055,window.y,window.z],[.09,window.height,window.width]]);
  } else for (const y of [1.3, 3.55, 5.8]) for (let z = back + 3; z <= front - 2; z += 3.1) if (!windowBlocked(y, z, .8)) sideWindows.push([[right + .045, y, z], [.09, .92, 1.6]]);
  boxes(s, details, m.glassLight, frontWindows, 'campus-third-floor-service-annex-front-glazing');
  boxes(s, details, m.glassLight, sideWindows, 'campus-third-floor-service-annex-three-window-rows');
  if(item.sideFacadeSurvey) {
    const seams=[],frames=[];
    for(let y=.3;y<floorY-.2;y+=.3) {
      let intervals=[[back,front]];
      for(const window of item.sideFacadeSurvey.windows) if(Math.abs(y-window.y)<window.height/2+.025) intervals=intervals.flatMap(([a,b])=>[[a,Math.min(b,window.z-window.width/2-.08)],[Math.max(a,window.z+window.width/2+.08),b]].filter(([l,r])=>r-l>.02));
      for(const [a,b] of intervals) seams.push([[right+.03,y,(a+b)/2],[.025,.016,b-a]]);
    }
    for(const window of item.sideFacadeSurvey.windows) {
      for(const sign of [-1,1]) {
        frames.push([[right+.115,window.y+sign*(window.height/2+.025),window.z],[.065,.05,window.width+.12]]);
        frames.push([[right+.115,window.y,window.z+sign*(window.width/2+.025)],[.065,window.height+.1,.05]]);
      }
      frames.push([[right+.12,window.y,window.z],[.065,window.height,.045]]);
    }
    boxes(s,details,m.facadeTrim,seams,'campus-annex-observed-horizontal-panel-seams');
    boxes(s,details,m.steel,frames,'campus-annex-observed-separate-window-frames');
  }

  // The employee identifies this as the third-floor cyclone, not a ground tank.
  // Its tapered outlet, access frame and return riser are all terrace-relative.
  const cyclone = s._group(details, [12, floorY, 2.5]); cyclone.name = 'campus-third-floor-cyclone';
  const radius = 1.65;
  s._cyl(cyclone, radius, 4.9, [0, 5.35, 0], m.white, radius, 24).name = 'campus-third-floor-cyclone-body';
  s._cyl(cyclone, radius, 2, [0, 1.9, 0], m.white, .45, 24).name = 'campus-third-floor-cyclone-cone';
  s._cyl(cyclone, .45, .65, [0, .575, 0], m.steel, .45, 16).name = 'campus-third-floor-cyclone-outlet';
  s._cyl(cyclone, 1.2, .4, [0, 8, 0], m.white, radius, 24).name = 'campus-third-floor-cyclone-top';
  const support = [];
  for (const x of [-1.45, 1.45]) for (const z of [-1.45, 1.45]) support.push([[x, 1.65, z], [.13, 3.3, .13]]);
  boxes(s, cyclone, m.steel, support, 'campus-third-floor-cyclone-supports');
  instances(s, cyclone, new THREE.TorusGeometry(radius + .025, .07, 4, 18), m.steel,
    [3.15, 4.6, 6.1, 7.65].map((y) => ({ position: [0, y, 0], rotation: [PI / 2, 0, 0] })), 'campus-third-floor-cyclone-horizontal-bands');
  boxes(s, cyclone, m.steel, [
    [[-radius - .3, 4.65, -.35], [.12, 8.3, .12]],
    [[-radius - .3, 4.65, .35], [.12, 8.3, .12]],
    ...Array.from({ length: 12 }, (_, index) => [[-radius - .3, 1 + index * .65, 0], [.12, .1, .7]]),
  ], 'campus-third-floor-cyclone-access-ladder');
  const cage = s._group(cyclone); cage.name = 'campus-third-floor-cyclone-upper-frame';
  const cageHalf = radius + .3, cageBottom = .2, cageTop = 8.6;
  const frame = [];
  for (const x of [-1, 1]) for (const z of [-1, 1]) frame.push([[x * cageHalf, (cageBottom + cageTop) / 2, z * cageHalf], [.085, cageTop - cageBottom, .085]]);
  for (const level of [cageTop - .6, cageTop]) {
    for (const side of [-1, 1]) {
      frame.push([[0, level, side * cageHalf], [cageHalf * 2 + .08, .085, .085]]);
      frame.push([[side * cageHalf, level, 0], [.085, .085, cageHalf * 2 + .08]]);
    }
  }
  for (const offset of [-.34, .34]) frame.push([[offset * cageHalf, cageTop, 0], [.075, .075, cageHalf * 2]]);
  boxes(s, cage, m.steel, frame, 'campus-third-floor-cyclone-square-frame');
  const returnPipe = s._group(details, [0, floorY, 0]); returnPipe.name = 'campus-third-floor-cyclone-return-pipe';
  const pipeX = 12 + radius + .35, pipeZ = 0, pipeRadius = .26;
  const topY = h * .46 - floorY, bendRadius = .55, bottomY = .4, verticalTop = topY - bendRadius;
  s._cyl(returnPipe, pipeRadius, verticalTop - bottomY, [pipeX, (bottomY + verticalTop) / 2, pipeZ], m.white, pipeRadius, 12).name = 'campus-third-floor-cyclone-vertical-riser';
  const bend = s._mesh(new THREE.TorusGeometry(bendRadius, pipeRadius, 8, 12, PI / 2), m.white, returnPipe, [pipeX - bendRadius, verticalTop, pipeZ]);
  bend.name = 'campus-third-floor-cyclone-return-elbow';
  const wallX = w / 2 - .03, horizontalEnd = pipeX - bendRadius;
  const connection = s._cyl(returnPipe, pipeRadius, horizontalEnd - wallX, [(wallX + horizontalEnd) / 2, topY, pipeZ], m.white, pipeRadius, 12);
  connection.rotation.z = PI / 2; connection.name = 'campus-third-floor-cyclone-shaft-connection';
  s._box(returnPipe, [.7, .4, .7], [pipeX, .2, pipeZ], m.concrete).name = 'campus-third-floor-cyclone-riser-plinth';
}

function packagingBuilding(s, root, item) {
  const m = palette(s), { width: w, depth: d, height: h } = item;
  const shell = s._part(root, item.parts[0], [-4, .5, 0]); shell.name = 'campus-packaging-building-body';
  foundation(s, shell, w, d);
  s._box(shell, [w, h, d], [0, h / 2, 0], m.cream).name = 'campus-packaging-three-floor-shell';
  const roof = s._part(root, item.parts[1], [0, 3, 0]); roof.name = 'campus-packaging-orange-roof';
  for(const side of [-1,1]) {
    const bay=gable(s,roof,d/2+.25,w+.5,item.roofRise||1.36,[0,h,side*d/4],m.orangeRoof,'campus-packaging-three-floor-gable');
    bay.rotation.y=PI/2; bay.userData.roofBay=side; bay.userData.ridgeAxis='x';
  }
  boxes(s, roof, m.orangeRoof, [
    [[-w / 2, h - .15, 0], [.2, .25, d + .5]],
    [[w / 2, h - .15, 0], [.2, .25, d + .5]],
  ], 'campus-packaging-roof-eaves');
  const facade = s._part(root, item.parts[2], [3, 1, 2]);
  boxes(s, facade, m.glassLight, [-.37, -.27, -.17].map((offset) => [[w * offset, h * .43, d / 2 + .06], [.75, h * .72, .12]]), 'campus-packaging-vertical-stair-glazing');
  boxes(s, facade, m.orangeRoof, [-1, 1].map((side) => [[side * (w / 2 - .12), h / 2, d / 2 + .045], [.2, h, .12]]), 'campus-packaging-front-edge-trim');
  const entry = s._group(facade, [w * .22, .05, d / 2 + .08]); entry.name = 'campus-packaging-ground-door';
  s._box(entry, [2.2, 2.7, .025], [0, 1.35, -.035], m.dark);
  for (const side of [-1, 1]) {
    const leaf = s._group(entry, [side * 1.1, 0, 0]); leaf.name = 'campus-packaging-entry-leaf';
    leaf.userData.proximityDoor = { enterable: false, kind: 'hinge', axis: 'y', closed: 0, open: side * PI / 2, trigger: [0, 0, 0], width: 2.2, height: 2.7 };
    s._box(leaf, [1.08, 2.7, .12], [-side * .55, 1.35, 0], m.glassLight);
  }
}

function production(s, root, item) {
  const m = palette(s), { width: w, depth: d, height: h } = item;
  const sx = w / 65, sy = h / 10, sz = d / 42;
  const wallHeight = 5.7 * sy, roofRise = 3.35 * sy;
  const shell = s._part(root, item.parts[0], [-5, .5, 0]); shell.name = 'campus-production-body';
  foundation(s, shell, w, d); s._box(shell, [w, wallHeight, d], [0, wallHeight / 2, 0], m.white);
  const fronts = [-25.4, -12.7, 0, 12.7, 25.4].map((x) => x * sx);
  const roof = s._part(root, item.parts[1], [0, 5, 0]); roof.name = 'campus-production-roof-bank';
  const bays = [-25.4, -12.7, 12.7, 25.4].map((x) => x * sx);
  for (const x of bays) gable(s, roof, 12.7 * sx, d + .6, roofRise, [x, wallHeight, 0], m.blueRoof, 'campus-production-blue-gable');
  const archGeometry = new THREE.CylinderGeometry(6.35, 6.35, d + .6, 32, 1, true, -PI / 2, PI);
  archGeometry.rotateX(-PI / 2); archGeometry.scale(sx, .55 * sy, 1);
  const arch = s._mesh(archGeometry, m.archRoof, roof, [0, wallHeight, 0]); arch.name = 'campus-production-central-arched-roof';
  for (const z of [-d / 2, d / 2]) {
    const cap = new THREE.CircleGeometry(6.35, 32, 0, PI); cap.scale(sx, .55 * sy, 1);
    s._mesh(cap, m.archRoof, roof, [0, wallHeight, z]);
  }
  const details = s._part(root, item.parts[2], [4, 1, 3]);
  roofVents(s, details, [...bays.flatMap((x) => [-16, -8, 0, 8, 16].map((z) => [x, 9.1 * sy, z * sz])), ...[-16, -8, 0, 8, 16].map((z) => [0, 9.25 * sy, z * sz])]);
  const seams = [], skylights = [], gutters = [], cladding = [];
  const pitch = Math.atan2(roofRise, 6.35 * sx), slopeWidth = Math.hypot(6.35 * sx, roofRise);
  for (const x of bays) for (const side of [-1, 1]) {
    for (let index = -4; index <= 4; index++) seams.push([[x + side * 3.175 * sx, wallHeight + roofRise / 2 + .055, index * d / 8.4], [slopeWidth, .08, .1], [0, 0, side * -pitch]]);
    for (const z of [-.29, .1, .38]) skylights.push([[x + side * 3.175 * sx, wallHeight + roofRise / 2 + .07, z * d], [slopeWidth * .91, .045, .68 * sz], [0, 0, side * -pitch]]);
  }
  boxes(s, details, m.blueTrim, seams, 'campus-production-roof-ribs');
  boxes(s, details, m.roofLight, skylights, 'campus-production-roof-translucent-strips');
  for (const x of [-31.75, -19.05, -6.35, 6.35, 19.05, 31.75]) {
    gutters.push([[x * sx, wallHeight + .1, 0], [.22, .17, d + .9]]);
    gutters.push([[x * sx, wallHeight / 2, d / 2 + .3], [.15, wallHeight - .15, .15]]);
  }
  boxes(s, details, m.steel, gutters, 'campus-production-gutters-downpipes');
  for (let index = 0; index < 65; index++) {
    const x = (index / 64 - .5) * w;
    if (fronts.some((door) => Math.abs(x - door) < 2.7 * sx)) continue;
    cladding.push([[x, wallHeight / 2, d / 2 + .11], [.055, wallHeight - .2, .06]]);
  }
  boxes(s, details, m.facadeTrim, cladding, 'campus-production-wall-cladding-ribs');
  boxes(s, details, m.steel, fronts.flatMap((x) => [-3.1, 3.1].map((dx) => [[x + dx * sx, 3 * sy, d / 2 + .14], [.12, 6 * sy, .14]])), 'campus-production-front-columns');
  loadingDetails(s, details, fronts.map((x) => [x, 5 * sx]), d, 4.1 * sy, { redIndices: [1, 4] });
}

function warehouse(s, root, item) {
  const m = palette(s), { width: w, depth: d, height: h } = item;
  const shell = s._part(root, item.parts[0], [-5, 1, 0]); shell.name = `${item.id}-body`;
  foundation(s, shell, w, d); s._box(shell, [w, h, d], [0, h / 2, 0], m.wall);
  const roof = s._part(root, item.parts[1], [0, 4, 0]);
  const orange = item.type === 'campus-front-warehouse', blue = item.type === 'campus-blue-annex';
  if (blue) for (const side of [-1, 1]) gable(s, roof, w / 2 + .4, d + .6, 2.4, [side * w / 4, h, 0], m.blueRoof, 'campus-annex-blue-roof');
  else if (orange) s._box(roof, [w + .6, .35, d + .6], [0, h + .18, 0], m.orangeRoof);
  else gable(s, roof, w + .7, d + .7, 1.2, [0, h, 0], m.white, 'campus-rear-light-roof');
  const details = s._part(root, item.parts[2], [3, 1, 2]);
  smallWindows(s, details, w, d, [h - 2.3], m.glassLight);
  const ventPoints = blue ? [-w / 4, w / 4].flatMap((x) => [-d * .27, 0, d * .27].map((z) => [x, h + 3.5, z])) :
    [-w * .28, 0, w * .28].flatMap((x) => [-d * .25, d * .25].map((z) => [x, h + (orange ? .4 : 1.2 * (1 - Math.abs(x) / (w / 2)) + .15), z]));
  roofVents(s, details, ventPoints);
  const roofRibs = [], cladding = [];
  for (let index = -5; index <= 5; index++) {
    const x = index * w / 10, rise = orange ? .35 : blue ? 2.4 * (1 - Math.abs(Math.abs(x) - w / 4) / (w / 4)) : 1.2 * (1 - Math.abs(x) / (w / 2));
    roofRibs.push([[x, h + rise + .09, 0], [.09, .055, d + .5]]);
  }
  for (let x = -w / 2 + 1.5; x < w / 2; x += 4) {
    if ([-w * .31, 0, w * .31].some((door) => Math.abs(x - door) < 3)) continue;
    cladding.push([[x, h / 2, d / 2 + .12], [.13, h - .2, .14]]);
  }
  boxes(s, details, orange ? m.orangeRoof : m.facadeTrim, roofRibs, 'campus-warehouse-roof-seams');
  boxes(s, details, m.facadeTrim, cladding, 'campus-warehouse-facade-panel-joints');
  rainwaterPipes(s, details, w, d, h, w);
  loadingDetails(s, details, [-w * .31, 0, w * .31].map((x) => [x, 5.4]), d, 5.4);
  if (blue) {
    boxes(s, roof, m.white, [-1, 1].flatMap((side) => [
      [[side * w / 4, h + 2.85, 0], [2, .9, d * .82]],
      [[side * w / 4, h + 3.36, 0], [2.45, .18, d * .88]],
    ]), 'campus-annex-raised-roof-ventilation');
    boxes(s, details, m.glassLight, [-1, 1].flatMap((ridge) => [-1.02, 1.02].flatMap((x) => [-.3, -.1, .1, .3].map((z) => [[ridge * w / 4 + x, h + 2.88, z * d], [.05, .45, d * .17]]))), 'campus-annex-clerestory-windows');
  }
}

function frontOffice(s, root, item) {
  const m = palette(s), { width: w, depth: d, height: h } = item;
  const shell = s._part(root, item.parts[0], [-4, 1, 0]); shell.name = 'campus-front-office-body';
  foundation(s, shell, w, d); s._box(shell, [w, h, d], [0, h / 2, 0], m.white);
  const roof = s._part(root, item.parts[1], [0, 4, 0]);
  s._box(roof, [w + .5, .3, d + .5], [0, h + .15, 0], m.orangeRoof);
  const facade = s._part(root, item.parts[2], [3, 1, 3]);
  const mullions = [];
  for (const y of [.21, .55, .82].map((level) => level * h)) {
    s._box(facade, [w - 1.2, 1.65, .1], [0, y, d / 2 + .07], m.glassGreen);
    s._box(facade, [.1, 1.65, d - 1.2], [w / 2 + .07, y, 0], m.glassGreen);
    for (let index = 1; index < 9; index++) mullions.push([[(index / 9 - .5) * (w - 1.2), y, d / 2 + .15], [.065, 1.65, .07]]);
    for (let index = 1; index < 7; index++) mullions.push([[w / 2 + .15, y, (index / 7 - .5) * (d - 1.2)], [.07, 1.65, .065]]);
  }
  boxes(s, facade, m.white, [-w / 2 + .5, 0, w / 2 - .5].map((x) => [[x, h / 2, d / 2 + .14], [.35, h, .2]]), 'campus-front-office-window-piers');
  boxes(s, facade, m.steel, mullions, 'campus-front-office-glazing-divisions');
  boxes(s, facade, m.facadeTrim, [[[0, .35, d / 2 + .09], [w, .55, .15]]], 'campus-front-office-base-course');
}

function footprintPrism(s, parent, points, width, depth, height, y, material, name, margin = 0) {
  const shape = new THREE.Shape();
  points.forEach(([x, z], index) => {
    const px = (x / width - .5) * (width + margin * 2), pz = (z / depth - .5) * (depth + margin * 2);
    if (index) shape.lineTo(px, -pz); else shape.moveTo(px, -pz);
  });
  shape.closePath();
  const geometry = new THREE.ExtrudeGeometry(shape, { depth: height, bevelEnabled: false, steps: 1 }); geometry.rotateX(-PI / 2);
  const mesh = s._mesh(geometry, material, parent, [0, y, 0]); mesh.name = name;
  return mesh;
}

function guardhouse(s, root, item) {
  const m = palette(s), { width: w, depth: d, height: h } = item;
  const footprint = item.footprint || [[0, 0], [w, 0], [w, d], [0, d]];
  const shell = s._part(root, item.parts[0], [-2, .5, 0]); shell.name = 'campus-guardhouse-body';
  footprintPrism(s, shell, footprint, w, d, .22, 0, m.concrete, 'campus-guardhouse-five-sided-foundation', .15);
  footprintPrism(s, shell, footprint, w, d, h, 0, m.white, 'campus-guardhouse-five-sided-shell');
  const frontPoints = footprint.filter((point) => Math.abs(point[1] - d) < .001), frontMinX = Math.min(...frontPoints.map((point) => point[0]));
  const frontWidth = w - frontMinX, frontCenterX = (frontMinX + w) / 2 - w / 2;
  boxes(s, shell, m.concrete, [[[frontCenterX, .18, d / 2 + .3], [frontWidth + .15, .2, .6]]], 'campus-guardhouse-front-step');
  const roof = s._part(root, item.parts[1], [0, 2, 0]); roof.name = 'campus-guardhouse-green-roof';
  footprintPrism(s, roof, footprint, w, d, .16, h + .1, m.greenRoof, 'campus-guardhouse-five-sided-green-roof', .22);
  const edgePoints = footprint.map(([x, z]) => [(x / w - .5) * (w + .44), (z / d - .5) * (d + .44)]);
  const edges = edgePoints.flatMap(([x, z], index) => {
    const next = edgePoints[(index + 1) % edgePoints.length], dx = next[0] - x, dz = next[1] - z;
    if (item.videoRoundedCorner !== false && Math.abs(dx) > .01 && Math.abs(dz) > .01) return [];
    return [[[(x + next[0]) / 2, h + .37, (z + next[1]) / 2], [Math.hypot(dx, dz), .3, .15], [0, Math.atan2(-dz, dx), 0]]];
  });
  boxes(s, roof, m.white, edges, 'campus-guardhouse-five-sided-white-parapet');
  const details = s._part(root, item.parts[2], [1, .3, 1]);
  // Road-side (+X) glazing and door stay on the straight wall span, beside
  // whichever corner the footprint clips for the curved glass.
  const sideZ = footprint.filter(([x]) => Math.abs(x - w) < .001).map(([, z]) => z - d / 2);
  const sideMin = Math.min(...sideZ), sideMax = Math.max(...sideZ);
  const doorZ = Math.min(d * .3, sideMax - .75), glassMin = sideMin + .2, glassMax = doorZ - .75;
  const glassZ = (glassMin + glassMax) / 2, glassDepth = Math.max(.6, glassMax - glassMin);
  boxes(s, details, m.glassGreen, [
    [[frontCenterX, h * .61, d / 2 + .06], [frontWidth * .74, 1.12, .09]],
    [[w / 2 + .06, h * .61, glassZ], [.09, 1.12, glassDepth]],
  ], 'campus-guardhouse-road-facing-glazing');
  boxes(s, details, m.steel, [
    ...[-.42, -.14, .14, .42].map((offset) => [[frontCenterX + offset * frontWidth * .74, h * .61, d / 2 + .13], [.07, 1.15, .08]]),
    [[frontCenterX, h * .61 + .59, d / 2 + .12], [frontWidth * .77, .09, .11]],
    [[frontCenterX, h * .61 - .59, d / 2 + .12], [frontWidth * .77, .09, .11]],
    [[w / 2 + .13, h * .61, glassZ], [.08, 1.15, .07]],
  ], 'campus-guardhouse-window-frames');
  const entrance = s._group(details, [w / 2 + .08, .035, doorZ]); entrance.rotation.y = PI / 2; entrance.name = 'campus-guardhouse-entry';
  s._box(entrance, [1.1, 2.25, .025], [0, 1.125, -.025], m.dark);
  const door = s._group(entrance, [-.55, 0, 0]); door.name = 'campus-guardhouse-entry-leaf';
  door.userData.proximityDoor = { enterable: false, kind: 'hinge', axis: 'y', closed: 0, open: -PI / 2, trigger: [0, 0, 0], width: 1.1, height: 2.25 };
  s._box(door, [1.1, 2.25, .11], [.55, 1.125, 0], m.glass);
  s._box(door, [.06, .14, .1], [.94, 1.115, -.1], m.steel);
  boxes(s, details, m.steel, [
    [[w / 2 + .17, 1.2, doorZ - .48], [.09, 2.3, .07]],
    [[w / 2 + .17, 1.2, doorZ + .48], [.09, 2.3, .07]],
  ], 'campus-guardhouse-door-surround');
}

function polyhedron(vertices, faces) {
  const positions = [];
  faces.forEach((face) => {
    for (let index = 1; index + 1 < face.length; index++) for (const point of [face[0], face[index], face[index + 1]]) positions.push(...vertices[point]);
  });
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3)); geometry.computeVertexNormals();
  return geometry;
}

function combineGeometry(parts) {
  const positions = [];
  parts.forEach((part) => {
    const geometry = part.index ? part.toNonIndexed() : part;
    positions.push(...geometry.attributes.position.array);
    if (geometry !== part) geometry.dispose(); part.dispose();
  });
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3)); geometry.computeVertexNormals();
  return geometry;
}

function passengerCarBody() {
  const rings = [[-2.2, .76, .42, .73], [-1.75, .925, .34, .87], [1.75, .925, .34, .87], [2.2, .77, .42, .77]];
  const vertices = rings.flatMap(([z, width, low, high]) => [[-width, low, z], [width, low, z], [width, high, z], [-width, high, z]]);
  const faces = [[0, 3, 2, 1], [12, 13, 14, 15]];
  for (let ring = 0; ring < rings.length - 1; ring++) for (let side = 0; side < 4; side++) {
    const next = (side + 1) % 4, start = ring * 4;
    faces.push([start + side, start + next, start + next + 4, start + side + 4]);
  }
  const parts = [polyhedron(vertices, faces), new THREE.BoxGeometry(1.5, .08, 1.38).translate(0, 1.46, .025)];
  for (const side of [-1, 1]) {
    parts.push(new THREE.BoxGeometry(.055, .53, .085).translate(side * .805, 1.15, .04));
    parts.push(new THREE.BoxGeometry(.055, .76, .065).rotateX(.79).translate(side * .795, 1.15, -.93));
    parts.push(new THREE.BoxGeometry(.055, .77, .065).rotateX(-.8).translate(side * .795, 1.15, .98));
  }
  return combineGeometry(parts);
}

function passengerCarGlazing() {
  return polyhedron([
    [-.86, .89, -1.22], [.86, .89, -1.22], [.86, .89, 1.26], [-.86, .89, 1.26],
    [-.735, 1.42, -.65], [.735, 1.42, -.65], [.735, 1.42, .7], [-.735, 1.42, .7],
  ], [[4, 5, 1, 0], [5, 6, 2, 1], [6, 7, 3, 2], [7, 4, 0, 3], [7, 6, 5, 4]]);
}

function cars(s, parent, parking, sideParking = false) {
  const m = palette(s), positions = [];
  if (sideParking) {
    // Keep the entrance end empty so parked cars do not obscure the approach.
    for (let z = parking.fromZ, index = 0; z <= parking.toZ - parking.step * 2; z += parking.step, index++) if (index % 5 !== 3) positions.push([parking.centerX, z]);
  }
  else parking.rows.forEach((z, row) => {
    for (let x = parking.fromX, index = 0; x <= parking.toX; x += parking.step, index++) if ((index + row * 2) % 7 !== 5) positions.push([x, z]);
  });
  const prefix = sideParking ? 'campus-side-parking' : 'campus-parking', yaw = sideParking ? parking.angleDegrees * PI / 180 : 0;
  const cosine = Math.cos(yaw), sine = Math.sin(yaw);
  const colors = [m.carWhite, m.carGray, m.carBlack];
  colors.forEach((material, color) => instances(s, parent, passengerCarBody(), material,
    positions.filter((_, i) => i % 3 === color).map(([x, z]) => ({ position: [x, 0, z], rotation: [0, yaw, 0] })), `${prefix}-car-bodies`));
  instances(s, parent, passengerCarGlazing(), m.glass, positions.map(([x, z]) => ({ position: [x, 0, z], rotation: [0, yaw, 0] })), `${prefix}-car-sloped-glazing`);
  const wheels = positions.flatMap(([x, z]) => [-.87, .87].flatMap((dx) => [-1.35, 1.35].map((dz) => ({ position: [x + cosine * dx + sine * dz, .32, z - sine * dx + cosine * dz], rotation: [0, yaw, PI / 2] }))));
  instances(s, parent, new THREE.CylinderGeometry(.31, .31, .18, 12), m.dark, wheels, `${prefix}-car-wheels`);
  instances(s, parent, new THREE.CylinderGeometry(.16, .16, .185, 10), m.steel, wheels, `${prefix}-car-wheel-hubs`);
  for (const [material, localZ, name] of [[m.white, -2.18, 'headlights'], [m.red, 2.18, 'tail-lights']]) {
    boxes(s, parent, material, positions.flatMap(([x, z]) => [-.58, .58].map((dx) => [[x + cosine * dx + sine * localZ, .65, z - sine * dx + cosine * localZ], [.36, .16, .075], [0, yaw, 0]])), `${prefix}-car-${name}`);
  }
}

function sideParkingArea(s, deck, structure, parking) {
  const m = palette(s), yaw = parking.angleDegrees * PI / 180, cosine = Math.cos(yaw), sine = Math.sin(yaw);
  const length = parking.toZ - parking.fromZ + parking.depth + parking.width, z = (parking.fromZ + parking.toZ) / 2;
  s._box(deck, [7, .035, length], [parking.centerX, .035, z], m.asphalt).name = 'campus-side-parking-surface';
  const lines = [];
  for (let slot = parking.fromZ; slot <= parking.toZ; slot += parking.step) {
    for (const side of [-1, 1]) {
      const offset = side * parking.width / 2;
      lines.push([[parking.centerX + cosine * offset, .075, slot - sine * offset], [.1, .025, parking.depth], [0, yaw, 0]]);
    }
    lines.push([[parking.centerX + sine * parking.depth / 2, .075, slot + cosine * parking.depth / 2], [parking.width, .025, .1], [0, yaw, 0]]);
  }
  boxes(s, deck, m.white, lines, 'campus-side-parking-lines');
  cars(s, structure, parking, true);
}

function yardShape(points, cutout = []) {
  const shape = new THREE.Shape();
  points.forEach(([x, z], index) => index ? shape.lineTo(x, -z) : shape.moveTo(x, -z)); shape.closePath();
  if (cutout.length) {
    const hole = new THREE.Path();
    cutout.forEach(([x, z], index) => index ? hole.lineTo(x, -z) : hole.moveTo(x, -z)); hole.closePath();
    shape.holes.push(hole);
  }
  return shape;
}

// Clip each convex paving triangle against the rectangular excavation. This
// also supports a moved plant straddling the parcel edge without filling its
// tanks or treating a boundary-crossing polygon as an invalid interior hole.
function clippedYardSurface(points, cutout) {
  const source = new THREE.ShapeGeometry(yardShape(points)), positions = [];
  const p = source.getAttribute('position'), indices = source.index.array;
  const clip = (polygon, a, b, keepInside) => {
    const result = [], side = q => (b[0]-a[0])*(q[1]-a[1])-(b[1]-a[1])*(q[0]-a[0]);
    for (let i=0; i<polygon.length; i++) {
      const current=polygon[i], next=polygon[(i+1)%polygon.length], dc=side(current), dn=side(next);
      const currentIn=keepInside ? dc>=0 : dc<=0, nextIn=keepInside ? dn>=0 : dn<=0;
      if (currentIn) result.push(current);
      if (currentIn!==nextIn) { const t=dc/(dc-dn); result.push([current[0]+t*(next[0]-current[0]),current[1]+t*(next[1]-current[1])]); }
    }
    return result;
  };
  const append = polygon => {
    for (let i=1; i+1<polygon.length; i++) {
      const a=polygon[0], b=polygon[i], c=polygon[i+1];
      const cross=(b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]);
      if (Math.abs(cross)<1e-9) continue;
      for (const v of (cross>0 ? [a,c,b] : [a,b,c])) positions.push(v[0],0,v[1]);
    }
  };
  for (let i=0;i<indices.length;i+=3) {
    let remaining=Array.from(indices.slice(i,i+3), index => [p.getX(index),-p.getY(index)]);
    for (let edge=0;edge<cutout.length && remaining.length;edge++) {
      const a=cutout[edge],b=cutout[(edge+1)%cutout.length];
      append(clip(remaining,a,b,false)); remaining=clip(remaining,a,b,true);
    }
  }
  source.dispose();
  const geometry=new THREE.BufferGeometry(); geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3)); geometry.computeVertexNormals();
  return geometry;
}

function parcelSurface(s, parent, points, y, material, name) {
  const shape = yardShape(points);
  const geometry = new THREE.ShapeGeometry(shape); geometry.rotateX(-PI / 2);
  const mesh = s._mesh(geometry, material, parent, [0, y, 0]); mesh.name = name;
  return mesh;
}

function entryFence(s, parent, entrance, parcel) {
  const m = palette(s), left = entrance.laneX - entrance.laneWidth / 2, right = entrance.laneX + entrance.laneWidth / 2;
  const minX = Math.min(...parcel.map((point) => point[0])), maxX = Math.max(...parcel.map((point) => point[0]));
  const z = entrance.gateZ + 2, posts = [], rails = [], mesh = [], bases = [];
  for (const [start, end] of [[minX, left - .3], [right + .3, maxX]]) {
    if (end <= start) continue;
    const width = end - start, middle = (start + end) / 2;
    bases.push([[middle, .2, z], [width, .38, .28]]);
    for (let x = start; x <= end + .01; x += width / Math.max(1, Math.ceil(width / 3.8))) posts.push([[x, 1.12, z], [.11, 2.2, .11]]);
    for (const y of [.45, 1.22, 2.05]) rails.push([[middle, y, z], [width, .065, .075]]);
    for (let x = start + .3; x < end; x += .6) mesh.push([[x, 1.24, z], [.022, 1.58, .022]]);
    for (let y = .65; y < 2; y += .28) mesh.push([[middle, y, z], [width, .022, .022]]);
  }
  boxes(s, parent, m.concrete, bases, 'campus-entry-fence-plinths');
  boxes(s, parent, m.entryGreen, posts, 'campus-entry-fence-posts');
  boxes(s, parent, m.entryGreen, rails, 'campus-entry-fence-rails');
  boxes(s, parent, m.steel, mesh, 'campus-entry-fence-mesh');
  const barrier = s._group(parent); barrier.name = 'campus-entry-open-barrier';
  const x = left - .8;
  s._box(barrier, [.45, 1.25, .55], [x, .625, entrance.gateZ], m.entryGreen);
  s._box(barrier, [.9, .12, .95], [x, .06, entrance.gateZ], m.concrete);
  s._box(barrier, [.14, 5.2, .16], [x, 3.7, entrance.gateZ], m.white);
  boxes(s, barrier, m.red, [1.6, 2.6, 3.6, 4.6, 5.6].map((y) => [[x, y, entrance.gateZ + .01], [.16, .38, .18]]), 'campus-open-barrier-visible-stripes');
}

function loadingTruck(s, parent, apron) {
  const m = palette(s), truck = s._group(parent, apron.position); truck.name = 'campus-loading-truck';
  s._box(truck, [11, 3.5, 3.6], [0, 2.4, 0], m.red);
  s._box(truck, [2.4, 2.8, 3.3], [-6.7, 1.9, 0], m.carWhite);
  s._box(truck, [.12, 1.3, 2.5], [-7.95, 2.4, 0], m.glass);
  boxes(s, truck, m.facadeTrim, Array.from({ length: 16 }, (_, index) => [-1, 1].map((side) => [[-5 + index * .66, 2.4, side * 1.82], [.065, 3.3, .065]])).flat(), 'campus-loading-truck-container-ribs');
  boxes(s, truck, m.yellow, [-1, 1].map((side) => [[-7.96, 1.05, side * 1.1], [.12, .25, .45]]), 'campus-loading-truck-headlights');
  instances(s, truck, new THREE.CylinderGeometry(.48, .48, .24, 12), m.dark,
    [-1, 1].flatMap((side) => [-6.65, 2.3, 3.65].map((x) => ({ position: [x, .5, side * 1.65], rotation: [PI / 2, 0, 0] }))), 'campus-loading-truck-wheels');
}

export function buildCampusEnvironment(s) {
  const m = palette(s), groups = {};
  for (const key of ['deck', 'structure', 'ducts']) groups[key] = s._group(s.scene);
  groups.deck.name = 'campus-yard'; groups.structure.name = 'campus-surroundings'; groups.ducts.name = 'campus-fixed-services';
  const { deck, structure } = groups;
  const { ground, parcel, entrance, parking, sideParking, loadingApron } = CAMPUS_ROOM.layout;
  const width = ground.maxX - ground.minX, depth = ground.maxZ - ground.minZ;
  const center = [(ground.minX + ground.maxX) / 2, -.45, (ground.minZ + ground.maxZ) / 2];
  const contextGround = s._box(deck, [width, .8, depth], center, m.concrete);
  contextGround.name = 'campus-context-ground';
  const paving = parcelSurface(s, deck, parcel, -.015, m.asphalt, 'campus-factory-parcel-paving');
  // The drawing places tanks below grade. Cut the yard itself so an opened
  // tank is not filled by the campus ground. Rebuild only when its pose changes.
  let subsurfacePose = null;
  deck.userData.updateSubsurfaceCutout = () => {
    const item = s.equipment?.find(entry => entry.subsurfaceFootprint);
    if (!item) return;
    const signature = JSON.stringify([item.position, item.rotation, item.subsurfaceFootprint]);
    if (signature === subsurfacePose) return;
    subsurfacePose = signature;
    const { width: w, depth: d } = item.subsurfaceFootprint;
    const angle = item.rotation || 0, c = Math.cos(angle), sn = Math.sin(angle);
    const hole = [[-w/2,-d/2],[w/2,-d/2],[w/2,d/2],[-w/2,d/2]].map(([x,z]) =>
      [item.position[0] + c*x + sn*z, item.position[2] - sn*x + c*z]);
    const inside = (point, polygon) => {
      let value = false;
      for (let i=0,j=polygon.length-1;i<polygon.length;j=i++) {
        const a=polygon[i],b=polygon[j];
        if ((a[1]>point[1]) !== (b[1]>point[1]) && point[0] < (b[0]-a[0])*(point[1]-a[1])/(b[1]-a[1])+a[0]) value=!value;
      }
      return value;
    };
    const rectangle = [[ground.minX,ground.minZ],[ground.maxX,ground.minZ],[ground.maxX,ground.maxZ],[ground.minX,ground.maxZ]];
    const replace = (mesh, geometry) => {
      s.geometries?.delete(mesh.geometry); mesh.geometry.dispose();
      mesh.geometry=geometry; s.geometries?.add(geometry);
    };
    const solid = new THREE.ExtrudeGeometry(yardShape(rectangle,hole), { depth: .8, bevelEnabled: false, steps: 1 });
    solid.rotateX(-PI/2); contextGround.position.set(0,-.85,0); replace(contextGround,solid);
    let surface;
    if (hole.every(point => inside(point,parcel))) { surface=new THREE.ShapeGeometry(yardShape(parcel,hole)); surface.rotateX(-PI/2); }
    else surface=clippedYardSurface(parcel,hole);
    replace(paving,surface);
    deck.userData.subsurfaceCutout = hole;
  };
  deck.userData.updateSubsurfaceCutout();
  const roadLength = Math.abs(entrance.fromZ - entrance.toZ), roadZ = (entrance.fromZ + entrance.toZ) / 2;
  const road = s._box(deck, [entrance.laneWidth, .065, roadLength], [entrance.laneX, .028, roadZ], m.road);
  road.name = 'campus-main-entrance-road';
  const left = entrance.laneX - entrance.laneWidth / 2, right = entrance.laneX + entrance.laneWidth / 2;
  boxes(s, deck, m.concrete, [
    [[left - 1.1, .055, (entrance.fromZ + entrance.gateZ + 7)/2], [1.45, .11, entrance.fromZ-entrance.gateZ-7]],
    [[right + 1.1, .055, roadZ], [1.45, .11, roadLength]],
  ], 'campus-entrance-sidewalks');
  boxes(s, structure, m.white, [
    [[left-.17,.13,(entrance.fromZ+entrance.gateZ+7)/2],[.28,.26,entrance.fromZ-entrance.gateZ-7]],
    [[right+.17,.13,roadZ],[.28,.26,roadLength]],
  ], 'campus-entrance-road-curbs');
  const route=CAMPUS_ROOM.layout.entranceRoute;
  if(route) {
    const fixed=s._group(deck); fixed.name='campus-reviewed-entrance-turn-and-crosswalk';
    const p=route.crossPassage;
    s._box(fixed,[p.toX-p.fromX,.025,p.maxZ-p.minZ],[(p.fromX+p.toX)/2,.035,(p.minZ+p.maxZ)/2],m.asphalt).name='campus-middle-left-turn-open-passage';
    const zebra=[];
    for(let x=left+.5;x<right-.3;x+=1.05)zebra.push([[x,.075,route.crosswalkZ],[.5,.02,3]]);
    boxes(s,fixed,m.white,zebra,'campus-observed-zebra-crossing');
    const bump=s._group(fixed); bump.name='campus-observed-yellow-white-speed-bump';
    for(let i=0;i<10;i++)s._box(bump,[entrance.laneWidth/10,.065,.85],[left+(i+.5)*entrance.laneWidth/10,.06,route.speedBumpZ],i%2?m.white:m.yellow);
    const mirror=s._group(fixed,[right+1.3,0,route.turnZ]);mirror.name='campus-observed-corner-traffic-mirror';
    s._cyl(mirror,.055,2.6,[0,1.3,0],m.steel,.055,10);
    const disc=s._cyl(mirror,.4,.065,[0,2.6,0],m.orangeRoof,.4,32);disc.rotation.x=Math.PI/2;
    const face=s._cyl(mirror,.35,.075,[0,2.6,.045],m.glassLight,.35,32);face.rotation.x=Math.PI/2;
    fixed.userData.source=route.source;
  }
  const parkingWidth = parking.toX - parking.fromX + parking.step, parkingCenterX = (parking.fromX + parking.toX) / 2;
  const lines = [];
  parking.rows.forEach((z) => {
    for (let x = parking.fromX - parking.step / 2; x <= parking.toX + parking.step / 2; x += parking.step) lines.push([[x, .065, z], [.1, .025, parking.depth]]);
    for (const edge of [-1, 1]) lines.push([[parkingCenterX, .065, z + edge * parking.depth / 2], [parkingWidth, .025, .1]]);
  });
  boxes(s, deck, m.white, lines, 'campus-parking-lines');
  s._box(deck, [loadingApron.width, .035, loadingApron.depth], [loadingApron.position[0], .04, loadingApron.position[2]], m.concrete).name = 'campus-production-loading-apron';
  const markings = [];
  for (let z = Math.min(entrance.fromZ, entrance.toZ) + 4; z < Math.max(entrance.fromZ, entrance.toZ) - 3; z += 12) markings.push([[entrance.laneX, .08, z], [.13, .025, 5]]);
  boxes(s, deck, m.yellow, markings, 'campus-access-road-marking');
  boxes(s, deck, m.white, [[[entrance.laneX, .08, entrance.gateZ + 4], [entrance.laneWidth - .5, .025, .35]]], 'campus-entry-stop-line');
  cars(s, structure, parking); sideParkingArea(s, deck, structure, sideParking); entryFence(s, structure, entrance, parcel);
  // The walking videos continue past the former rear crop. Connect only the
  // recorded fixed rear/side approaches; loose storage is deliberately absent.
  const rearAccess = s._group(deck); rearAccess.name = 'campus-rear-service-approaches';
  for (const [index, segment] of (CAMPUS_ROOM.layout.rearAccess || []).entries()) {
    const a = new THREE.Vector3(...segment.start), b = new THREE.Vector3(...segment.end), length = Math.hypot(b.x - a.x, b.z - a.z);
    const surface = s._box(rearAccess, [length + .12, .055, segment.width || 3], [(a.x + b.x) / 2, .035, (a.z + b.z) / 2], m.concrete);
    surface.rotation.y = -Math.atan2(b.z - a.z, b.x - a.x); surface.name = `campus-rear-service-paving-${index + 1}`;
    surface.userData.source = segment.source || '20261110-rear-side-walking-videos';
  }
  const frontZ = Math.max(...parcel.map((point) => point[1]));
  const rearZ = Math.min(...parcel.map((point) => point[1]));
  const maxParcelX = Math.max(...parcel.map((point) => point[0]));
  // Stepped retaining terraces follow every rear edge of the parcel, so the
  // wall bends with the slope foot behind the LPG yard and the tank bund.
  const middleZ = (frontZ + rearZ) / 2, retaining = s._group(structure); retaining.name = 'campus-rear-retaining-terraces';
  parcel.forEach((a, index) => {
    const b = parcel[(index + 1) % parcel.length], dx = b[0] - a[0], dz = b[1] - a[1], length = Math.hypot(dx, dz);
    if (!(length > 0) || Math.abs(dx) <= Math.abs(dz) || a[1] > middleZ || b[1] > middleZ) return;
    let nx = dz / length, nz = -dx / length; if (nz > 0) { nx = -nx; nz = -nz; }
    const yaw = -Math.atan2(dz, dx), midX = (a[0] + b[0]) / 2, midZ = (a[1] + b[1]) / 2;
    for (let row = 0; row < 3; row++) {
      const offset = 2 + row * 3, run = length + 2 + offset * .6;
      s._box(retaining, [run, 2.1, 1.1], [midX + nx * offset, 1.05 + row * 2, midZ + nz * offset], m.concrete).rotation.y = yaw;
      s._box(retaining, [run, .2, 1.9], [midX + nx * (offset + .1), 2.2 + row * 2, midZ + nz * (offset + .1)], m.grass).rotation.y = yaw;
    }
  });
  retaining.userData.source = CAMPUS_ROOM.layout.rearBoundarySource || 'parcel rear edge';
  // Context-only masses observed in the rear videos (not selectable).
  for (const block of CAMPUS_ROOM.layout.rearContext || []) {
    const context = s._group(structure, block.position); context.name = `campus-context-${block.id}`;
    s._box(context, [block.width, block.height, block.depth], [0, block.height / 2, 0], m.cream);
    s._box(context, [block.width + .3, .22, block.depth + .3], [0, block.height + .11, 0], m.greenRoof);
    s._box(context, [1.6, .5, .22], [-block.width / 2 + 2.2, block.height - .9, block.depth / 2 + .1], m.steel);
    Object.assign(context.userData, { source: block.source, selectable: false, nominalDimensionsMeasured: false });
  }
  const guard = entrance.guard, shrubs = [];
  for (const offset of [-1, 1]) shrubs.push({ position: [guard.position[0] - guard.width / 2 - 1.3, .8, guard.position[2] + offset * (guard.depth / 2 + 1.1)], scale: [1.1, .8, 1.1] });
  instances(s, structure, new THREE.SphereGeometry(1, 10, 7), m.leaves, shrubs, 'campus-entry-landscape-shrubs');
  boxes(s, structure, m.concrete, shrubs.map(({ position }) => [[position[0], .18, position[2]], [2.5, .36, 2.5]]), 'campus-entry-planter-edging');
  const trees = [[ground.minX + 6, rearZ + 8], [ground.minX + 6, frontZ - 4], [maxParcelX + 3, frontZ + 8]];
  instances(s, structure, new THREE.CylinderGeometry(.22, .3, 2.8, 8), m.earth, trees.map(([x, z]) => ({ position: [x, 1.4, z] })), 'campus-yard-tree-trunks');
  instances(s, structure, new THREE.SphereGeometry(1, 10, 7), m.leaves, trees.map(([x, z]) => ({ position: [x, 3.4, z], scale: [1.7, 1.9, 1.7] })), 'campus-yard-trees');
  deck.userData.campusBounds = { width, depth };
  // Paving receives the buildings' shadows, but its broad, near-flat surfaces
  // must not self-shadow into repeating bands at the driver's shallow angle.
  deck.traverse((mesh) => { if (mesh.isMesh) mesh.castShadow = false; });
  return groups;
}

// Campus and room views share the same photographed equipment geometry. Keep
// source parts isolated: the campus area remains one selectable three-part item.
function outdoorUtilityArea(s, root, item) {
  const m = palette(s);
  const pad = s._part(root, item.parts[0], [0, 0, 0]); pad.name = 'campus-outdoor-area-pad';
  const equipment = s._part(root, item.parts[1], [0, 1, 0]); equipment.name = 'campus-outdoor-area-equipment';
  const boundary = s._part(root, item.parts[2], [-.4, 0, 0]); boundary.name = 'campus-outdoor-boundary-wall';
  const adapter = Object.create(s);
  adapter.scene = new THREE.Group(); adapter.parts = [];
  const environment = buildOutdoorEnvironment(adapter, { factoryFacade: false });
  if (!s.outdoorMaterials) s.outdoorMaterials = adapter.outdoorMaterials;
  const sourceToLocal = new THREE.Matrix4().makeTranslation(-OUTDOOR_ROOM.length / 2, 0, -.32)
    .multiply(new THREE.Matrix4().makeRotationY(-OUTDOOR_ROOM.rotation))
    .multiply(new THREE.Matrix4().makeTranslation(-OUTDOOR_ROOM.anchor[0], -OUTDOOR_ROOM.anchor[1], -OUTDOOR_ROOM.anchor[2]));
  const mount = (parent, source) => {
    const frame = s._group(parent); frame.applyMatrix4(sourceToLocal); frame.add(source); return frame;
  };
  environment.deck.name = 'campus-outdoor-area-aisle';
  mount(pad, environment.deck);
  mount(boundary, environment.structure); mount(boundary, environment.ducts);
  const sourceEquipment = new THREE.Group();
  for (const sourceItem of OUTDOOR_EQUIPMENT) {
    const child = adapter._group(sourceEquipment, sourceItem.position);
    child.name = `campus-outdoor-source-${sourceItem.id}`;
    child.rotation.y = sourceItem.rotation || 0;
    child.userData.outdoorSourceId = sourceItem.id;
    buildOutdoorEquipment(adapter, child, sourceItem);
  }
  mount(equipment, sourceEquipment);
  equipment.userData.outdoorSourceCount = OUTDOOR_EQUIPMENT.length;

  // The employee places the office entrance at the end of this corridor.
  // Preserve the existing front door and join its open front approach; a new
  // side door or enclosed connection is not established by the historic plans.
  const officeItem = item.officeApproach;
  if (officeItem) {
    root.updateWorldMatrix(true, false);
    const inverse = root.matrixWorld.clone().invert();
    const points = officeItem.map((point) => new THREE.Vector3(...point).applyMatrix4(inverse));
    const approach = s._group(pad); approach.name = 'campus-outdoor-office-approach';
    for (let i = 1; i < points.length; i++) {
      const a = points[i - 1], b = points[i], length = Math.hypot(b.x - a.x, b.z - a.z);
      const surface = s._box(approach, [length + .15, .05, 1.8], [(a.x + b.x) / 2, .035, (a.z + b.z) / 2], m.concrete);
      surface.rotation.y = -Math.atan2(b.z - a.z, b.x - a.x);
    }
  }
}

export function buildCampusEquipment(s, root, item) {
  if (item.type === 'campus-rear-stair-details') {
    for (const [index,name] of item.parts.entries()) s._part(root,name,[[0,0,0],[0,1,0],[.5,0,.5]][index]);
    return buildRearStairDetails(s,root,item);
  }
  if (buildCampusBoilerRoom(s, root, item, { materials: palette(s) })) return true;
  if (buildCampusWastewater(s, root, item, { materials: palette(s) })) return true;
  if (item.entranceRouteSurvey && buildEntranceProduction(s, root, item, { materials: palette(s) })) return true;
  if (buildCampusRearEquipment(s, root, item, { materials: palette(s) })) return true;
  const builders = {
    'campus-office': office, 'campus-dryer-tower': tower, 'campus-production': production,
    'campus-packaging-building': packagingBuilding,
    'campus-outdoor-area': outdoorUtilityArea,
    'campus-rear-warehouse': warehouse, 'campus-front-office': frontOffice,
    'campus-front-warehouse': warehouse, 'campus-blue-annex': warehouse, 'campus-guardhouse': guardhouse,
  };
  const builder = builders[item.type]; if (!builder) return false;
  builder(s, root, item); addCampusRearDetails(s, root, item, { materials: palette(s) }); buildRearStairDetails(s,root,item); return true;
}
