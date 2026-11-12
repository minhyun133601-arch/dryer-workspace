import * as THREE from '../shared/vendor/three.module.js';

// 2026-11-11 rear walk, 0–143s. Feature poses are base datums and local +Z
// faces outside. Counts come only from catalog arrays; no unseen stair flights.
const PI = Math.PI, TAU = PI * 2, UP = new THREE.Vector3(0, 1, 0);
export const REAR_SURVEY_FEATURE_KINDS = Object.freeze(['panel-wall', 'vertical-glazing', 'strip-windows', 'glazed-entry', 'perforated-pair', 'opaque-entry', 'recessed-entry', 'freight-elevator', 'single-shutter', 'twin-shutter', 'stacked-shutter-bay', 'steel-hvac-platform', 'canopy-condenser', 'apron-hardware', 'caged-access-ladder', 'wall-hood', 'downpipe', 'insulated-floor-mains', 'utility-housing']);

function tools(s) {
  if (s._rearStairResources) return s._rearStairResources;
  const colors = { wall: 0xd9ddce, trim: 0xa6b1ad, steel: 0x879995, white: 0xdee2d8, dark: 0x35433e, black: 0x26312e, glass: 0x437b70, blueGlass: 0x5e9b9d, concrete: 0xa3a69a, orange: 0xb7795c, yellow: 0xd9ad3e, yellowDoor: 0xcab449, insulation: 0x949b91 };
  const materials = Object.fromEntries(Object.entries(colors).map(([key, color]) => {
    const material = s._material ? s._material(color, ['steel', 'trim'].includes(key) ? .36 : .78, ['steel', 'trim'].includes(key) ? .65 : .08) : new THREE.MeshStandardMaterial({ color });
    s.materials?.add(material); return [key, material];
  }));
  for (const key of ['glass', 'blueGlass']) { materials[key].transparent = true; materials[key].opacity = key === 'glass' ? .62 : .72; materials[key].roughness = .28; materials[key].depthWrite = false; }
  materials.wire = new THREE.LineBasicMaterial({ color: 0xc6cebf }); s.materials?.add(materials.wire);
  const geometries = new Map();
  const geo = (key, make) => { if (!geometries.has(key)) { const geometry = make(); geometries.set(key, geometry); s.geometries?.add(geometry); } return geometries.get(key); };
  const mesh = (parent, geometry, position = [0, 0, 0], paint = 'steel', name) => { const object = s._mesh(geometry, materials[paint] || materials.steel, parent, position); if (name) object.name = `rear-survey-${name}`; return object; };
  const box = (parent, size, p, paint = 'steel', name) => { const object = mesh(parent, geo('box', () => new THREE.BoxGeometry(1, 1, 1)), p, paint, name); object.scale.set(...size); return object; };
  const cylinder = (parent, radius, height, p, paint = 'steel', axis = 'y', name) => { const object = mesh(parent, geo('cylinder', () => new THREE.CylinderGeometry(1, 1, 1, 20)), p, paint, name); object.scale.set(radius, height, radius); if (axis === 'x') object.rotation.z = PI / 2; if (axis === 'z') object.rotation.x = PI / 2; return object; };
  const bar = (parent, a, b, radius = .025, paint = 'steel') => { const start = new THREE.Vector3(...a), end = new THREE.Vector3(...b), delta = end.clone().sub(start); const object = cylinder(parent, radius, delta.length(), start.add(end).multiplyScalar(.5).toArray(), paint); object.quaternion.setFromUnitVectors(UP, delta.normalize()); return object; };
  const boxes = (parent, entries, paint = 'steel', name = 'instanced-hardware') => {
    if (!entries.length) return null;
    const object = new THREE.InstancedMesh(geo('box', () => new THREE.BoxGeometry(1, 1, 1)), materials[paint], entries.length), dummy = new THREE.Object3D();
    entries.forEach(([p, size, rotation = [0, 0, 0]], index) => { dummy.position.set(...p); dummy.scale.set(...size); dummy.rotation.set(...rotation); dummy.updateMatrix(); object.setMatrixAt(index, dummy.matrix); });
    object.instanceMatrix.needsUpdate = true; object.name = `rear-survey-${name}`; object.castShadow = object.receiveShadow = true; object.computeBoundingBox(); object.computeBoundingSphere(); parent.add(object); return object;
  };
  const pipe = (parent, points, radius = .055, paint = 'steel') => {
    const curve = new THREE.CurvePath(); for (let i = 1; i < points.length; i++) curve.add(new THREE.LineCurve3(new THREE.Vector3(...points[i - 1]), new THREE.Vector3(...points[i])));
    return mesh(parent, new THREE.TubeGeometry(curve, Math.max(8, points.length * 6), radius, 10, false), [0, 0, 0], paint);
  };
  const plate = (parent, text, width, position) => {
    const group = s._group(parent, position); group.name = 'rear-survey-photographed-door-plate'; group.userData.text = text;
    box(group, [width, width * .22, .018], [0, 0, 0], 'white'); box(group, [width, width * .035, .021], [0, -width * .09, .012], 'glass');
    if (typeof document !== 'undefined' && typeof document.createElement === 'function') {
      const canvas = document.createElement('canvas'); canvas.width = 768; canvas.height = 160;
      const context = canvas.getContext?.('2d');
      if (context) {
        context.fillStyle = '#e8ece4'; context.fillRect(0, 0, 768, 160); context.fillStyle = '#34423d'; context.font = '600 70px "Malgun Gothic",sans-serif'; context.textAlign = 'center'; context.textBaseline = 'middle'; context.fillText(text, 384, 80, 740);
        const texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace; s.textures?.add(texture);
        const material = new THREE.MeshBasicMaterial({ map: texture }); s.materials?.add(material);
        const face = s._mesh(geo(`plate:${width}`, () => new THREE.PlaneGeometry(width, width * .22)), material, group, [0, 0, .02]); face.castShadow = false;
      }
    }
    return group;
  };
  return s._rearStairResources = { materials, geo, mesh, box, cylinder, bar, boxes, pipe, plate };
}

function cutWall(s, frame, feature, t) {
  const w = feature.width || 6, h = feature.height || 8, d = feature.depth || .1;
  const shape = new THREE.Shape(); shape.moveTo(-w / 2, 0); shape.lineTo(w / 2, 0); shape.lineTo(w / 2, h); shape.lineTo(-w / 2, h); shape.closePath();
  for (const opening of feature.openings || []) {
    const { x = 0, y, width, height } = opening, path = new THREE.Path();
    path.moveTo(x - width / 2, y - height / 2); path.lineTo(x - width / 2, y + height / 2); path.lineTo(x + width / 2, y + height / 2); path.lineTo(x + width / 2, y - height / 2); path.closePath(); shape.holes.push(path);
  }
  t.mesh(frame, new THREE.ExtrudeGeometry(shape, { depth: d, bevelEnabled: false }), [0, 0, -d], feature.paint || 'wall', 'panel-wall-with-real-openings');
  const seams = [], edgeEntries = [], pitch = feature.panelPitch || .32;
  for (let y = pitch; y < h; y += pitch) {
    let intervals = [[-w / 2, w / 2]];
    for (const opening of feature.openings || []) if (Math.abs(y - opening.y) <= opening.height / 2 + .015) {
      intervals = intervals.flatMap(([a, b]) => [[a, Math.min(b, (opening.x || 0) - opening.width / 2)], [Math.max(a, (opening.x || 0) + opening.width / 2), b]].filter(([left, right]) => right - left > .015));
    }
    for (const [a, b] of intervals) seams.push([[(a + b) / 2, y, .012], [b - a, .016, .012]]);
  }
  t.boxes(frame, seams, 'trim', 'horizontal-panel-seams');
  for (const side of [-1, 1]) edgeEntries.push([[side * (w / 2 - .06), h / 2, .025], [.12, h, .07]]);
  t.boxes(frame, edgeEntries, feature.orangeEdges ? 'orange' : 'wall', 'wall-corner-edge-strips');
}

function glazing(s, frame, feature, t, horizontal = false) {
  const w = feature.width || 2.8, h = feature.height || 12, divisions = feature.divisions || Math.max(2, Math.round(h / 1.4)), entries = [];
  let spans=[[-w/2,w/2]];
  const piers=horizontal ? feature.pierGaps || [] : [];
  for(const pier of piers) {
    const left=pier.x-pier.width/2,right=pier.x+pier.width/2;
    spans=spans.flatMap(([a,b])=>[[a,Math.min(b,left)],[Math.max(a,right),b]].filter(([a,b])=>b-a>.01));
    t.box(frame,[pier.width,h,.1],[pier.x,h/2,-.015],'wall','window-band-opaque-service-pier');
    for(const x of [left,right])entries.push([[x,h/2,.055],[.045,h,.09]]);
  }
  for(const [a,b]of spans)t.box(frame, [b-a, h, .035], [(a+b)/2, h / 2, .01], feature.paint || 'blueGlass', 'fixed-exterior-glass');
  for (const side of [-1, 1]) entries.push([[side * (w / 2 + .01), h / 2, .055], [.065, h + .1, .09]]);
  for (const y of [0, h]) for(const [a,b]of spans)entries.push([[(a+b)/2, y, .055], [b-a, .065, .09]]);
  if (horizontal) {
    const panes = feature.panes || Math.max(2, Math.round(w / 1.1));
    for (let i = 1; i < panes; i++) {
      const x=(i/panes-.5)*w;
      if(!piers.some(pier=>Math.abs(x-pier.x)<pier.width/2))entries.push([[x, h / 2, .07], [.045, h, .07]]);
    }
    for(const [a,b]of spans)entries.push([[(a+b)/2, h * .42, .07], [b-a, .045, .07]]);
  } else {
    for (let i = 1; i < divisions; i++) entries.push([[0, i * h / divisions, .065], [w, .06, .08]]);
    for (const ratio of feature.ventBands || []) {
      const y = ratio * h, vh = Math.min(.33, h / divisions * .36);
      t.box(frame, [w - .1, vh, .014], [0, y, .074], 'dark', 'narrow-sliding-vent-band');
      entries.push([[0, y - vh / 2, .105], [w, .045, .08]], [[0, y + vh / 2, .105], [w, .045, .08]], [[0, y, .12], [.04, vh, .1]]);
      t.box(frame, [w * .43, vh - .07, .024], [-w * .24, y, .127], 'blueGlass');
      t.box(frame, [w * .43, vh - .07, .024], [w * .16, y, .154], 'blueGlass');
    }
  }
  t.boxes(frame, entries, 'trim', 'glazing-double-frames-and-transoms');
}

function canopy(s, frame, config, doorHeight, t, wallZ = 0) {
  if (!config) return;
  const w = config.width || 3.4, d = config.depth || 1.3, h = config.height || .3, y = config.elevation ?? doorHeight + .35;
  const group = s._group(frame, [config.offsetX ?? 0, y, wallZ]); group.name = 'rear-survey-observed-entrance-canopy';
  // The slab and finish share a rear edge on the actual supporting facade.
  // Weather overhang belongs at the front, never inside a wall or window.
  t.box(group, [w, h, d], [0, h / 2, d / 2], 'concrete', 'entrance-canopy-slab');
  t.box(group, [w, .06, d + .035], [0, h + .015, (d + .035) / 2], 'wall', 'entrance-canopy-roof-finish');
  t.cylinder(group, .15, .045, [0, -.025, d * .45], 'white', 'y', 'canopy-round-ceiling-light');
  if (config.supports) for (const x of [-w * .43, w * .43]) t.box(group, [.17, y, .2], [x, -y / 2, d * .68], 'wall');
  group.userData.mountingWallPlane = wallZ;
}

function entrance(s, frame, feature, t, perforated = false) {
  const portal = feature.id === 'team2-stair-glass-entry' && feature.kind === 'recessed-entry' ? { area: 'packaging', level: 1, entry: 'team2-rear' } : feature.portal;
  const enterable = !!portal || feature.enterable === true;
  const w = feature.width || (perforated ? 2.1 : 1.9), h = feature.height || 2.3, threshold = feature.threshold ?? feature.ramp?.rise ?? .035, count = perforated ? 2 : feature.leafCount || 2, depth = feature.recess || .16;
  const surround = [];
  for (const side of [-1, 1]) surround.push([[side * (w / 2 + .075), h / 2 + threshold, -.02], [.15, h + .14, depth + .08]]);
  surround.push([[0, h + threshold + .06, -.02], [w + .3, .16, depth + .08]], [[0, threshold, .01], [w + .12, .035, depth + .12]]);
  t.boxes(frame, surround, 'trim', 'door-frame-jambs-head-threshold');
  const leafWidth = w / count - .014, leafGroups = [];
  for (let i = 0; i < count; i++) {
    const side = count === 1 ? (feature.hingeSide === 'left' ? -1 : 1) : i ? 1 : -1, hingeX = count === 1 ? side * w / 2 : side * w / 2;
    const pivot = s._group(frame, [hingeX, threshold, .005]); pivot.name = `rear-survey-door-leaf-${i + 1}`;
    const center = -side * leafWidth / 2; leafGroups.push(pivot);
    Object.assign(pivot.userData, { hingeSide: side < 0 ? 'left' : 'right', filmedOpenAngle: feature.openAngles?.[i] || 0, leafNumber: i + 1,
      proximityDoor: { enterable, groupId: portal?.entry === 'team2-rear' ? 'team2-rear-entry' : feature.groupId || `rear-entry:${feature.id}`, label: portal?.entry === 'team2-rear' ? '2팀 뒷출입문' : feature.plateText || feature.label || '출입문', portal, accessBasis: portal ? 'registered connected indoor scene' : enterable ? 'explicit modelled room access' : 'exterior-only; no modelled interior', kind: 'hinge', axis: 'y', closed: 0, open: feature.openAngles?.[i] || side * PI / 2, trigger: [0, threshold, 0], width: w, height: h, openDistance: 2.2, closeDistance: 3.1 } });
    if (perforated) {
      // Actual square openings, rather than a dark printed pattern on solid metal.
      const ribs = [], pitch = .065, rim = .065, hole = .029, rows = Math.max(1, Math.floor((h - rim * 2) / pitch)), columns = Math.max(1, Math.floor((leafWidth - rim * 2) / pitch));
      for (let column = 0; column <= columns; column++) ribs.push([[center - leafWidth / 2 + rim + column * pitch, h / 2, 0], [pitch - hole, h - rim * 2, .028]]);
      for (let row = 0; row <= rows; row++) ribs.push([[center, rim + row * pitch, 0], [leafWidth - rim * 2, pitch - hole, .028]]);
      for (const x of [center - leafWidth / 2 + rim / 2, center + leafWidth / 2 - rim / 2]) ribs.push([[x, h / 2, 0], [rim, h, .035]]);
      for (const y of [rim / 2, h - rim / 2]) ribs.push([[center, y, 0], [leafWidth, rim, .035]]);
      t.boxes(pivot, ribs, 'trim', 'perforated-door-through-hole-lattice');
      const handleX = center - side * (leafWidth / 2 - .1);
      t.cylinder(pivot, .06, .025, [handleX, h * .43, .035], 'steel', 'z'); t.cylinder(pivot, .034, .065, [handleX, h * .43, .071], 'steel', 'z');
    } else {
      t.box(pivot, [leafWidth - .055, h - .105, .014], [center, h / 2, 0], feature.paint || 'glass', feature.paint ? 'opaque-yellow-door-panel' : 'door-glass-pane');
      t.boxes(pivot, [[[center - leafWidth / 2, h / 2, .015], [.035, h, .04]], [[center + leafWidth / 2, h / 2, .015], [.035, h, .04]], [[center, .035, .015], [leafWidth, .07, .04]], [[center, h - .025, .015], [leafWidth, .05, .04]]], 'trim', 'glass-leaf-stiles-and-rails');
      const hx = center - side * (leafWidth / 2 - .13), length = feature.handleLength || .75, cy = h * .47;
      for (const face of [-1, 1]) {
        for (const y of [cy - length / 2 + .07, cy + length / 2 - .07]) t.bar(pivot, [hx, y, 0], [hx, y, face * .075], .014);
        t.bar(pivot, [hx, cy - length / 2, face * .075], [hx, cy + length / 2, face * .075], .02);
      }
      t.box(pivot, [.2, .045, .055], [center + side * leafWidth * .2, h - .06, -.045], 'steel', 'door-top-closing-fitting');
    }
    for (const y of [.2, h * .51, h - .22]) t.cylinder(pivot, .018, .09, [0, y, .015], 'steel', 'y', 'door-hinge');
  }
  if (feature.ramp) {
    const rise = feature.ramp.rise ?? .08, run = feature.ramp.run || .8, rw = feature.ramp.width || w + .25;
    const shape = new THREE.Shape(); shape.moveTo(0, 0); shape.lineTo(run, 0); shape.lineTo(0, rise); shape.closePath();
    const geometry = new THREE.ExtrudeGeometry(shape, { depth: rw, bevelEnabled: false }); geometry.rotateY(-PI / 2);
    t.mesh(frame, geometry, [rw / 2, 0, .04], 'concrete', 'real-sloped-concrete-door-apron');
  }
  canopy(s, frame, feature.canopy, h + threshold, t, feature.wallPlaneZ ?? 0);
  if (feature.plateText) t.plate(frame, feature.plateText, feature.plateWidth || Math.min(w, 1.2), [0, h + threshold + .16, .08]);
  Object.assign(frame.userData, { actualDoorLeafCount: count, actualDoorType: perforated ? 'perforated-steel' : feature.paint ? 'opaque-yellow-panel' : 'glass', unseenInteriorAdded: false, leafNames: leafGroups.map(leaf => leaf.name) });
}

function stripedBar(frame, a, b, t, radius = .065) {
  t.bar(frame,a,b,radius,'yellow');
  const start=new THREE.Vector3(...a), end=new THREE.Vector3(...b), length=start.distanceTo(end), direction=end.clone().sub(start).normalize();
  for(let distance=.14;distance<length;distance+=.42) {
    const from=start.clone().addScaledVector(direction,distance), to=start.clone().addScaledVector(direction,Math.min(length,distance+.19));
    t.bar(frame,from.toArray(),to.toArray(),radius+.002,'black');
  }
}

function recessedEntrance(s, frame, feature, t) {
  const w=feature.width||2.2,h=feature.height||2.5,d=feature.recessDepth||1.05;
  if(feature.returnMass) {
    const mass=feature.returnMass,mw=mass.width,mh=mass.height,md=mass.depth,thickness=.14;
    const shell=s._group(frame);shell.name='rear-survey-team2-perpendicular-return-mass';
    // A doorway open down to grade is a notch, not a closed interior hole.
    // Separate piers and lintel avoid boundary-touching hole triangulation.
    const openingWidth=w+.55,openingHeight=h+.2,openingX=-.125;
    const left=-mw/2,right=mw/2,openingLeft=openingX-openingWidth/2,openingRight=openingX+openingWidth/2;
    t.box(shell,[openingLeft-left,mh,thickness],[(left+openingLeft)/2,mh/2,-thickness/2],'wall','return-wall-left-pier');
    t.box(shell,[right-openingRight,mh,thickness],[(openingRight+right)/2,mh/2,-thickness/2],'wall','return-wall-right-pier');
    t.box(shell,[openingWidth,mh-openingHeight,thickness],[openingX,(mh+openingHeight)/2,-thickness/2],'wall','return-wall-lintel');
    const frontSeams=[];
    for(let y=.28;y<mh;y+=.28) {
      const spans=y<openingHeight?[[left,openingLeft],[openingRight,right]]:[[left,right]];
      for(const [a,b]of spans)frontSeams.push([[(a+b)/2,y,.009],[b-a,.016,.012]]);
    }
    t.boxes(shell,frontSeams,'trim','return-wall-horizontal-panel-seams');
    for(const side of [-1,1]) {
      t.box(shell,[thickness,mh,md],[side*(mw/2-thickness/2),mh/2,-md/2],'wall','return-mass-side-wall');
      t.box(shell,[thickness+.025,.65,md],[side*(mw/2-thickness/2),.325,-md/2],'white','return-mass-textured-lower-plinth');
    }
    t.box(shell,[mw,.2,md],[0,mh+.1,-md/2],'wall','return-mass-flat-roof-edge');
    t.box(shell,[.16,mh+.15,.15],[-mw/2+.07,mh/2,.075],'orange','return-mass-photographed-orange-corner');
    const seams=[];
    for(let y=.8;y<mh;y+=.28)for(const side of [-1,1])seams.push([[side*(mw/2+.006),y,-md/2],[.014,.018,md-.03]]);
    t.boxes(shell,seams,'trim','return-mass-horizontal-cladding-seams');
    Object.assign(shell.userData,{mountingWall:'perpendicular-return',openingIsReal:true,nominalDimensionsMeasured:false,unseenStairFlightsAdded:false});
  }
  entrance(s,frame,feature,t);
  const alcove=s._group(frame);alcove.name='rear-survey-team2-recessed-porch';
  const porchHeight=feature.canopy?.elevation??h+.35;
  for(const side of [-1,1]) {
    const x=side<0?-w/2-(feature.fixedSideLight||0)-.2:w/2+.2;
    t.box(alcove,[.2,porchHeight,d],[x,porchHeight/2,d/2-.08],'wall','porch-projecting-side-jamb');
    t.box(alcove,[.22,.65,d+.02],[x,.325,d/2-.08],'white','porch-white-base-plinth');
  }
  const headHeight=Math.max(0,porchHeight-h-.2);
  if(headHeight>.01)t.box(alcove,[w+(feature.fixedSideLight||0)+.6,headHeight,d],[-(feature.fixedSideLight||0)/2,porchHeight-headHeight/2,d/2-.08],'wall','porch-canopy-supporting-lintel');
  if(feature.fixedSideLight) {
    const sw=feature.fixedSideLight;
    t.box(alcove,[sw,h,.018],[-w/2-sw/2-.035,h/2+.05,.035],'glass','entry-fixed-side-light');
    t.box(alcove,[.035,h+.1,.04],[-w/2-sw-.05,h/2+.05,.05],'trim');
  }
  // The new view shows only the entrance alcove, not the stair flights inside.
  frame.userData.observedRecessDepth=d;frame.userData.unseenInteriorAdded=false;frame.userData.mountingWall=feature.mountingWall||'recessed-face';
}

function freightElevator(s, frame, feature, t) {
  const w=feature.width||2.2,h=feature.height||2.5,d=feature.cabinDepth||2.3,threshold=.06,wallZ=feature.wallPlaneZ??0;
  const cabin=s._group(frame);cabin.name='rear-survey-observed-freight-cabin';
  t.box(cabin,[w,.035,d],[0,threshold-.0175,-d/2],'dark','freight-dark-checkerplate-floor');
  t.box(cabin,[w+.08,h,.06],[0,h/2,-d],'steel','freight-stainless-back-wall');
  for(const side of [-1,1]) {
    t.box(cabin,[.055,h,d],[side*(w/2+.025),h/2,-d/2],'steel','freight-stainless-side-wall');
    t.box(cabin,[.06,.27,d],[side*(w/2+.018),.19,-d/2],'trim','freight-low-wall-protection');
  }
  for(const x of [-w/6,w/6])t.box(cabin,[.013,h-.08,.012],[x,h/2,-d+.037],'trim','freight-back-wall-panel-seam');
  t.box(cabin,[w,.27,.018],[0,.19,-d+.04],'trim','freight-low-back-protection');
  t.box(cabin,[w,.045,d],[0,h+.035,-d/2],'steel','freight-cabin-ceiling');
  t.box(cabin,[w*.58,.018,.12],[0,h+.004,-.55],'white','freight-visible-ceiling-strip-light');
  const tread=[];
  for(let x=-w/2+.12;x<w/2-.07;x+=.14)for(let z=-d+.12;z<-.05;z+=.14)tread.push([[x,threshold+.003,z],[.057,.009,.016],[0,(Math.round(x*100+z*100)%2?1:-1)*PI/4,0]]);
  t.boxes(cabin,tread,'trim','freight-checkerplate-raised-lozenges');
  for(const z of [-.07,-.015,.04])t.box(frame,[w+.08,.017,.015],[0,threshold,z],'trim','freight-parallel-threshold-door-tracks');
  for(const [index,side]of [-1,1].entries()) {
    const closed=side*w/4,open=-w*.75;
    const leaf=s._group(frame,[closed,threshold,-.045-index*.065]);leaf.name='rear-survey-freight-stainless-sliding-leaf';
    leaf.userData.proximityDoor={enterable:true,groupId:'rear-freight-elevator',label:'화물 엘리베이터',accessBasis:'photographed opening sequence + modelled cabin floor/walls',kind:'slide',axis:'x',closed,open,trigger:[0,0,0],width:w,height:h};
    leaf.userData.observedOpeningDirection='left-telescopic';leaf.userData.telescopicTravelRatio=index+1;
    t.box(leaf,[w/2-.015,h,.045],[0,h/2,0],'steel','freight-brushed-stainless-panel');
    const seams=[];for(let y=.17;y<h;y+=.18)seams.push([[0,y,.027],[w/2-.07,.006,.008]]);
    t.boxes(leaf,seams,'trim','freight-stainless-horizontal-brushing');
    t.box(frame,[.12,h+.16,.17],[side*(w/2+.07),h/2,.01],'trim');
  }
  t.box(frame,[w+.35,.18,.2],[0,h+.08,0],'trim');
  const portal=s._group(frame);portal.name='rear-survey-freight-yellow-black-protection';
  for(const side of [-1,1])stripedBar(portal,[side*(w/2+.18),.02,.25],[side*(w/2+.18),h+.28,.25],t,.085);
  stripedBar(portal,[-w/2-.18,h+.28,.25],[w/2+.18,h+.28,.25],t,.085);
  // Low guards project beside the door, leaving the actual doorway clear.
  for(const side of [-1,1]) {
    const x=side*(w/2+.42);
    stripedBar(portal,[x,.05,.24],[x,.45,.24],t);
    stripedBar(portal,[x,.45,.24],[x,.45,1.18],t);
    stripedBar(portal,[x,.45,1.18],[x,.05,1.18],t);
  }
  t.box(frame,[w+.3,.32,.22],[0,h+.5,wallZ+.11],'white','freight-door-air-curtain');
  const slots=[];for(let x=-w/2;x<=w/2;x+=.07)slots.push([[x,h+.5,wallZ+.227],[.024,.23,.015]]);
  t.boxes(frame,slots,'dark','air-curtain-intake-slots');
  t.box(frame,[.18,.48,.08],[-w/2-.43,1.25,wallZ+.052],'trim','freight-call-button-panel');
  t.box(frame,[.085,.24,.016],[-w/2-.43,1.34,wallZ+.102],'black','freight-red-floor-indicator-window');
  t.box(frame,[.012,.09,.006],[-w/2-.43,1.34,wallZ+.114],'orange','freight-observed-floor-one-segment');
  for(const [index,y]of [1.12,1.02].entries()){
    const button=t.cylinder(frame,.025,.025,[-w/2-.43,y,wallZ+.107],'white','z','freight-call-button');
    button.userData.elevatorCallButton={action:index===0?'open':'unconfirmed',sourceSeconds:index===0?[232.25,233]:[],observedPress:index===0};
  }
  t.box(frame,[.29,.5,.14],[-w/2-.65,h+.45,wallZ+.08],'trim','freight-upper-control-box');
  canopy(s,frame,feature.canopy,h,t,feature.wallPlaneZ ?? 0);
  Object.assign(frame.userData,{actualDoorType:'stainless-freight-elevator',actualDoorLeafCount:2,observedAirCurtain:true,observedYellowBlackPortal:true,openingDirection:'left-telescopic',observedButtonOpeningSequence:[232.25,234.5,237.25],visibleCabinAdded:true,cabinDepthApproximate:true,unseenInteriorAdded:false,observedCabinFeatures:['stainless-walls','dark-checkerplate-floor','parallel-threshold-tracks','ceiling-strip-light'],unseenInnerSafetyGateAdded:false});
}

function apronHardware(s, frame, feature, t) {
  const guards=s._group(frame);guards.name='rear-survey-observed-low-wall-impact-guards';
  for(const [from,to]of feature.railSegments||[]) {
    stripedBar(guards,[from,.38,.22],[to,.38,.22],t,.045);
    for(const x of [from,to])stripedBar(guards,[x,.02,.22],[x,.38,.22],t,.045);
  }
  for(const [x,z]of feature.drains||[]) {
    t.box(frame,[.9,.025,.58],[x,.005,z],'black','recessed-yard-drain');
    const slats=[];for(let i=0;i<12;i++)slats.push([[x-.41+i*.075,.023,z],[.026,.013,.54]]);
    t.boxes(frame,slats,'steel','drain-grating-bars');
  }
  for(const [x,z]of feature.hatches||[])t.box(frame,[1.15,.015,.72],[x,.01,z],'yellowDoor','observed-yellow-access-hatch');
}

function shutter(s, frame, feature, t, pair = false) {
  const w = feature.width || 3, h = feature.height || 3.1, count = pair ? 2 : 1, seam = .1, leafW = w / count - seam;
  for (let i = 0; i < count; i++) {
    const x = (i + .5) * w / count - w / 2;
    const curtain = s._group(frame); curtain.name = `rear-survey-shutter-curtain-${i + 1}`;
    curtain.userData.proximityDoor = { enterable: feature.enterable === true, groupId: feature.groupId || `rear-shutter:${feature.id}`, label: feature.plateText || '부자재 셔터', accessBasis: 'exterior shutter; no modelled interior unless explicitly connected', kind: 'lift', axis: 'y', closed: 0, open: h * .965, retract: true, trigger: [x, 0, 0], width: leafW, height: h, openDistance: 2.2, closeDistance: 3.1 };
    t.box(curtain, [leafW, h, .035], [x, h / 2, 0], 'trim', 'closed-roller-shutter');
    const ribs = []; for (let y = .055; y < h; y += .082) ribs.push([[x, y, .024], [leafW, .017, .028]]);
    t.boxes(curtain, ribs, 'white', 'roller-shutter-slats');
    t.box(frame, [leafW + .11, .19, .15], [x, h + .08, -.015], 'steel');
  }
  const guides = [];
  for (let i = 0; i <= count; i++) guides.push([[(i / count - .5) * w, h / 2, .04], [.11, h + .22, .12]]);
  t.boxes(frame, guides, 'steel', 'separate-shutter-guides');
  canopy(s, frame, feature.canopy, h, t, feature.wallPlaneZ ?? 0); frame.userData.actualShutterCount = count;
}

function ladder(s, frame, feature, t) {
  const h = feature.height || 4.2, width = feature.width || .55, cageStart = feature.cageStart ?? 2.1, cageRadius = feature.cageRadius || .43, cageTop = h + 1.03;
  const rungs = [], straps = [];
  for (const x of [-width / 2, width / 2]) t.box(frame, [.045, h + 1.05, .055], [x, (h + 1.05) / 2, 0], 'yellow');
  for (let y = .25; y < h + .85; y += .3) rungs.push([[0, y, .015], [width, .03, .035]]);
  for (let y = cageStart; y <= cageTop + .01; y += .72) {
    const hoop = t.mesh(frame, t.geo(`safety-hoop:${cageRadius}`, () => new THREE.TorusGeometry(cageRadius, .018, 6, 36)), [0, y, cageRadius - .015], 'yellow', 'access-ladder-safety-hoop'); hoop.rotation.x = PI / 2;
  }
  for (const angle of [0, PI / 2, PI, -PI / 2]) straps.push([[Math.cos(angle) * cageRadius, (cageStart + cageTop) / 2, cageRadius - .015 + Math.sin(angle) * cageRadius], [.025, cageTop - cageStart, .025]]);
  t.boxes(frame, rungs, 'yellow', 'ladder-rungs'); t.boxes(frame, straps, 'yellow', 'cage-vertical-straps');
  Object.assign(frame.userData, { accessLadderNotStairFlight: true, ladderCount: 1 });
}

function fanGuard(s, parent, p, radius, t, vertical = false) {
  const geometry = t.geo('unit-fan-guard', () => {
    const vertices = [];
    for (let r = .13; r < 1.01; r += .085) for (let i = 0; i < 48; i++) { const a = i * TAU / 48, b = (i + 1) * TAU / 48; vertices.push(Math.cos(a) * r, 0, Math.sin(a) * r, Math.cos(b) * r, 0, Math.sin(b) * r); }
    for (let i = 0; i < 6; i++) { const a = i * TAU / 6; vertices.push(0, 0, 0, Math.cos(a), 0, Math.sin(a)); }
    return new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
  });
  const wire = new THREE.LineSegments(geometry, t.materials.wire); wire.position.set(...p); wire.scale.setScalar(radius); if (vertical) wire.rotation.x = PI / 2; wire.name = 'rear-survey-static-fan-wire-guard'; parent.add(wire);
  t.cylinder(parent, radius * .13, .023, p, 'trim', vertical ? 'z' : 'y');
}

function hvacUnit(s, frame, unit, index, level, t) {
  const upper = level === 'upper', wall = level === 'wall', w = unit.width || (upper ? 1.55 : wall ? .83 : 1.55), h = unit.height || (upper ? 1.65 : wall ? 1.25 : 1.18), d = unit.depth || (upper ? .8 : wall ? .38 : .78);
  const group = s._group(frame, [unit.x || 0, unit.y || 0, unit.z || 0]); group.name = `rear-survey-hvac-${level}-${unit.id || index + 1}`; group.rotation.y = unit.rotation || 0;
  Object.assign(group.userData, { observedHvacId: unit.id || `${level}-${index + 1}`, observedHvacLevel: level, liveOperatingStateAdded: false, sourceTimes: unit.sourceTimes || [] });
  t.box(group, [w, h, d], [0, h / 2, 0], 'white');
  const grille = [];
  if (upper) {
    t.box(group, [w * .88, h * .35, .018], [0, h * .77, d / 2 + .016], 'black');
    for (let y = h * .62; y < h * .94; y += .065) grille.push([[0, y, d / 2 + .033], [w * .89, .011, .012]]);
    for (let x = -w * .44; x <= w * .44; x += .1) grille.push([[x, h * .78, d / 2 + .035], [.01, h * .34, .014]]);
    for (const x of [-w * .25, w * .25]) {
      t.box(group, [.012, h * .55, .02], [x + w * .25, h * .29, d / 2 + .02], 'trim');
      for (const y of [h * .12, h * .46]) for (let n = 0; n < 5; n++) grille.push([[x, y + n * .025, d / 2 + .025], [w * .15, .009, .014]]);
    }
    t.boxes(group, grille, 'trim', 'upper-unit-front-louvers');
  } else {
    t.box(group, [w * .93, h * .84, .02], [0, h * .52, d / 2 + .014], 'black', 'condenser-dark-coil-face');
    for (let x = -w * .45; x < w * .46; x += .04) grille.push([[x, h * .52, d / 2 + .03], [.008, h * .8, .01]]);
    t.boxes(group, grille, 'steel', 'fine-condenser-coil-fins');
    if (wall) {
      const fanCount = unit.fanCount ?? 2;
      for (let i = 0; i < fanCount; i++) fanGuard(s, group, [0, h * (i + .5) / fanCount, d / 2 + .048], Math.min(w * .4, h / fanCount * .42), t, true);
      group.userData.observedFrontFanCount = fanCount;
    } else {
      const fanCount = unit.fanCount ?? 2;
      for (let i = 0; i < fanCount; i++) {
        const x = (i + .5) * w / fanCount - w / 2, r = Math.min(w / fanCount, d) * .41;
        t.cylinder(group, r, .012, [x, h + .008, 0], 'dark'); fanGuard(s, group, [x, h + .022, 0], r, t);
      }
    }
  }
  if(wall && Number.isFinite(unit.wallPlaneZ)) {
    const wallZ=unit.wallPlaneZ-(unit.z||0),outer=d*.32;
    const bracket=s._group(group);bracket.name='rear-survey-wall-condenser-support-brackets';
    for(const x of [-w*.34,w*.34]) {
      t.box(bracket,[.08,.42,.025],[x,-.015,wallZ+.0125],'steel','condenser-wall-anchor-plate');
      t.box(bracket,[.055,.055,outer-wallZ],[x,-.0775,(outer+wallZ)/2],'steel','condenser-wall-support-arm');
      t.bar(bracket,[x,-.2,wallZ+.025],[x,-.0775,outer-.055],.018,'steel');
      for(const z of [-d*.32,d*.32])t.box(bracket,[.075,.05,.075],[x,-.025,z],'dark','condenser-anti-vibration-pad');
    }
    Object.assign(group.userData,{wallMounted:true,wallStandoff:-(d/2)-wallZ,mountingWallPlane:unit.wallPlaneZ});
  } else for (const x of [-w * .37, w * .37]) for (const z of [-d * .34, d * .34]) t.box(group, [.09, .08, .1], [x, -.04, z], 'concrete','condenser-support-foot');
  return group;
}

function platform(s, frame, feature, t) {
  const w = feature.width || 12, d = feature.depth || 1.6, y = feature.elevation || 4, frameEntries = [], bolts = [];
  t.box(frame, [w, .07, d], [0, y - .035, 0], 'steel', 'open-underneath-hvac-platform');
  const supportCount = Math.max(2, Math.ceil(w / 2.5) + 1), xs = feature.supportXs || Array.from({ length: supportCount }, (_, i) => (i / (supportCount - 1) - .5) * (w - .2));
  for (const x of xs) for (const z of [-d / 2 + .07, d / 2 - .07]) {
    frameEntries.push([[x, y / 2, z], [.13, y, .16]], [[x, y / 2, z + .07], [.22, y, .025]], [[x, y / 2, z - .07], [.22, y, .025]], [[x, .045, z], [.36, .09, .36]]);
    for (const dx of [-.13, .13]) for (const dz of [-.13, .13]) bolts.push([[x + dx, .105, z + dz], [.028, .035, .028]]);
  }
  for (let x = -w / 2 + .15; x < w / 2; x += .65) frameEntries.push([[x, y - .14, 0], [.07, .21, d]]);
  for (const z of [-d / 2, d / 2]) frameEntries.push([[0, y - .14, z], [w, .23, .12]]);
  t.boxes(frame, frameEntries, 'steel', 'platform-i-columns-and-floor-joists'); t.boxes(frame, bolts, 'trim', 'instanced-platform-baseplate-bolts');
  const ladderX = feature.ladder?.x ?? w / 2 - .3, gap = .72, railZ = d / 2 + .015;
  for (const [a, b] of [[-w / 2, Math.max(-w / 2, ladderX - gap / 2)], [Math.min(w / 2, ladderX + gap / 2), w / 2]]) if (b - a > .05) t.bar(frame, [a, y + 1.02, railZ], [b, y + 1.02, railZ], .027, 'yellow');
  for (let x = -w / 2; x <= w / 2 + .01; x += 1.35) if (Math.abs(x - ladderX) > gap / 2) t.bar(frame, [x, y + .02, railZ], [x, y + 1.02, railZ], .025, 'yellow');
  if (feature.ladder !== false) {
    const group = s._group(frame, [ladderX, 0, feature.ladder?.z ?? d / 2 + .18]); group.name = 'rear-survey-platform-access-ladder'; ladder(s, group, { height: y, ...feature.ladder }, t);
  }
  for (const [level, units] of [['upper', feature.upperUnits || []], ['ground', feature.groundUnits || []], ['wall', feature.wallUnits || []]]) units.forEach((unit, index) => hvacUnit(s, frame, { ...unit, ...(level==='wall'&&Number.isFinite(feature.wallPlaneZ)?{wallPlaneZ:feature.wallPlaneZ}:{}), y: (unit.y || 0) + (level === 'upper' ? y + .08 : level === 'ground' ? .1 : 0) }, index, level, t));
  Object.assign(frame.userData, { observedUpperHvacCount: feature.upperUnits?.length || 0, observedGroundHvacCount: feature.groundUnits?.length || 0, observedWallHvacCount: feature.wallUnits?.length || 0, distinctFromLiquidOutdoorEquipment: true });
}

function hood(s, frame, feature, t) {
  const w = feature.width || .95, h = feature.height || .8, d = feature.depth || .65;
  if(feature.riser) {
    const rw=feature.riser.width||.42,rd=feature.riser.depth||.28;
    const base=feature.riser.bottom||0,top=feature.riser.top??feature.position?.[1]??0,originY=feature.position?.[1]||0,length=Math.max(0,top-base);
    t.box(frame,[rw,length,rd],[0,(base+top)/2-originY,rd/2],'steel','observed-tall-rectangular-exhaust-riser');
    const seams=[],supports=[],wallZ=feature.wallPlaneZ??0;
    for(let y=base+.4;y<top-.1;y+=1.2) {
      seams.push([[0,y-originY,rd+.008],[rw+.025,.035,.018]]);
      for(const x of [-rw*.44,rw*.44])supports.push([[x,y-originY,wallZ/2],[.055,.055,-wallZ+.02]],[[x,y-originY,wallZ+.0125],[.11,.12,.025]]);
    }
    t.boxes(frame,seams,'trim','rectangular-duct-section-joints');
    t.boxes(frame,supports,'steel','external-service-cover-wall-brackets');
    frame.userData.observedRiser=true;frame.userData.riserLengthApproximate=length;frame.userData.riserConnectedToHoodConfirmed=false;
  }
  t.box(frame, [w, h, .018], [0, h / 2, .015], 'black', 'open-dark-hood-mouth');
  t.box(frame, [w, .045, d], [0, h, d / 2], 'steel');
  t.box(frame, [w, .045, d], [0, 0, d / 2], 'steel');
  if(Number.isFinite(feature.wallPlaneZ)) {
    const wallZ=feature.wallPlaneZ;
    for(const x of [-w*.42,w*.42])for(const y of [h*.2,h*.8]) {
      t.box(frame,[.075,.13,.025],[x,y,wallZ+.0125],'trim','hood-wall-anchor');
      t.box(frame,[.045,.045,-wallZ+.025],[x,y,wallZ/2+.0125],'steel','hood-wall-standoff');
    }
  }
  for (const side of [-1, 1]) {
    const shape = new THREE.Shape(); shape.moveTo(0, 0); shape.lineTo(d, 0); shape.lineTo(d * .72, h); shape.lineTo(0, h); shape.closePath();
    const geometry = new THREE.ExtrudeGeometry(shape, { depth: .025, bevelEnabled: false }); geometry.rotateY(-PI / 2);
    t.mesh(frame, geometry, [side * w / 2 + .0125, 0, 0], 'steel', 'hood-folded-side');
  }
}

function downpipe(s, frame, feature, t) {
  const h = feature.height || 10, radius = feature.radius || .055;
  t.pipe(frame, feature.points || [[0, h, 0], [0, .2, 0], [.15, .1, .15]], radius, feature.paint || 'steel').name='rear-survey-downpipe-visible-run';
  const clips = [];
  for (let y = .7; y < h; y += 1.6) {
    clips.push([[0, y, -.015], [radius * 2.7, .035, radius * 2.4]]);
    if(Number.isFinite(feature.wallPlaneZ)) {
      const wallZ=feature.wallPlaneZ;
      clips.push([[0,y,wallZ+.02],[.18,.07,.04]],[[0,y,(wallZ-.015)/2],[.055,.035,-wallZ-.015]]);
    } else clips.push([[0,y,-.08],[.18,.07,.04]]);
  }
  t.boxes(frame, clips, 'trim', 'downpipe-wall-clips');
}

function mains(s, frame, feature, t) {
  const w = feature.width || 3.5, assemblies = [];
  for (const [index, y] of [.29, .66].entries()) {
    const z = index ? -.1 : .19;
    t.pipe(frame, [[-w / 2, .1, z], [-w / 2, y, z], [w / 2, y, z], [w / 2, .08, z]], .105, 'insulation');
    for (const x of [-w * .29, w * .3]) {
      const jacket = t.mesh(frame, t.geo('removable-insulation-jacket', () => new THREE.SphereGeometry(1, 14, 10)), [x, y, z], 'insulation', 'visible-padded-valve-jacket'); jacket.scale.set(.23, .16, .18);
      t.cylinder(frame, .025, .25, [x, y + .19, z], 'trim');
      assemblies.push([[x, y + .33, z], [.045, .26, .035]]);
      for (const dx of [-.18, .18]) t.cylinder(frame, .112, .04, [x + dx, y, z], 'white', 'x');
    }
  }
  t.boxes(frame, assemblies, 'white', 'visible-insulated-main-valve-levers');
  frame.userData.observedInsulatedRuns = 2;
}

function utilityHousing(s, frame, feature, t) {
  const w = feature.width || 2.3, h = feature.height || 1.7, d = feature.depth || .75, base = feature.baseHeight ?? .22;
  t.box(frame, [w, h - base, d], [0, base + (h - base) / 2, 0], 'steel', 'closed-stainless-utility-housing');
  t.box(frame, [w + .09, .065, d + .09], [0, h + .025, 0], 'trim');
  for (const x of [-w * .28, w * .28]) {
    for (const dx of [-.07, .07]) t.bar(frame, [x + dx, h + .06, 0], [x + dx, h + .1, 0], .012);
    t.bar(frame, [x - .07, h + .1, 0], [x + .07, h + .1, 0], .012);
  }
  for (const y of [base + .09, base + (h - base) * .6]) t.box(frame, [w + .04, .075, d + .04], [0, y, 0], 'trim', 'utility-housing-horizontal-stiffener');
  for (const x of [-w * .43, w * .43]) for (const z of [-d * .35, d * .35]) {
    t.box(frame, [.065, base, .065], [x, base / 2, z], 'steel'); t.box(frame, [.16, .025, .16], [x, .0125, z], 'trim');
  }
  if (feature.vent !== false) {
    const x = -w * .33;
    t.cylinder(frame, .14, .07, [x, h + .11, -.1], 'trim');
    const endZ=Number.isFinite(feature.wallPlaneZ)?Math.max(-d/2-.14,feature.wallPlaneZ+.13):-d/2-.14;
    const curve = new THREE.CatmullRomCurve3([[x, h + .1, -.1], [x, h + .55, -.1], [x, h + .88, -.18], [x, h + 1.05, endZ+.1], [x, h + 1.05, endZ]].map(p => new THREE.Vector3(...p)));
    t.mesh(frame, new THREE.TubeGeometry(curve, 24, .11, 10, false), [0, 0, 0], 'insulation', 'observed-utility-housing-top-elbow');
  }
  Object.assign(frame.userData, { photographedClosedHousing: true, functionConfirmed: false, openWashBasinAdded: false });
}

function buildFeature(s, parent, feature, t) {
  const frame = s._group(parent, feature.position || [0, 0, 0]); frame.rotation.y = feature.yaw ?? feature.rotation ?? 0; frame.name = `rear-survey-${feature.id || feature.kind}`;
  Object.assign(frame.userData, { rearSurveyFeatureKind: feature.kind, source: feature.source || 'rear-stair-video-20261111', sourceTimes: feature.sourceTimes || [], measurementsConfirmed: false, positionDatum: 'base' });
  if (feature.kind === 'panel-wall') cutWall(s, frame, feature, t);
  else if (feature.kind === 'vertical-glazing' || feature.kind === 'strip-windows') glazing(s, frame, feature, t, feature.kind === 'strip-windows');
  else if (feature.kind === 'glazed-entry' || feature.kind === 'perforated-pair' || feature.kind === 'opaque-entry') entrance(s, frame, feature, t, feature.kind === 'perforated-pair');
  else if (feature.kind === 'recessed-entry') recessedEntrance(s,frame,feature,t);
  else if (feature.kind === 'freight-elevator') freightElevator(s,frame,feature,t);
  else if (feature.kind === 'apron-hardware') apronHardware(s,frame,feature,t);
  else if (feature.kind === 'canopy-condenser') {
    const auxiliary=hvacUnit(s,frame,{width:feature.width,height:feature.height,depth:feature.depth,fanCount:feature.fanCount ?? 1},0,'wall',t);
    // These small entrance/canopy units are distinct from the reviewed rack's
    // 4 upper + 7 ground + 2 wall units; do not recount them as rack equipment.
    delete auxiliary.userData.observedHvacId; delete auxiliary.userData.observedHvacLevel;
    auxiliary.userData.observedAuxiliaryCondenser=true;
  }
  else if (feature.kind === 'single-shutter') shutter(s,frame,feature,t,false);
  else if (feature.kind === 'twin-shutter') shutter(s, frame, feature, t, true);
  else if (feature.kind === 'stacked-shutter-bay') for (const [i, level] of (feature.levels || []).entries()) { const bay = s._group(frame, [0, level.y, 0]); bay.name = `rear-survey-elevated-shutter-bay-${i + 1}`; shutter(s, bay, { width: feature.width, wallPlaneZ: feature.wallPlaneZ, ...level, canopy: { width: (level.width || feature.width || 3) + .45, depth: level.canopyDepth || 1.1, height: .14, elevation: level.height + .12 } }, t); }
  else if (feature.kind === 'steel-hvac-platform') platform(s, frame, feature, t);
  else if (feature.kind === 'caged-access-ladder') ladder(s, frame, feature, t);
  else if (feature.kind === 'wall-hood') hood(s, frame, feature, t);
  else if (feature.kind === 'downpipe') downpipe(s, frame, feature, t);
  else if (feature.kind === 'insulated-floor-mains') mains(s, frame, feature, t);
  else if (feature.kind === 'utility-housing') utilityHousing(s, frame, feature, t);
  return frame;
}

export function buildRearStairDetails(s, root, item) {
  const features = (item.rearSurvey?.features || []).filter(feature => REAR_SURVEY_FEATURE_KINDS.includes(feature.kind));
  if (!features.length) return false;
  const t = tools(s), parent = root.children[2] || (s._part ? s._part(root, item.parts?.[2] || '후면 출입·창·외부 구조', [.7, .2, .7]) : root);
  const group = s._group(parent); group.name = 'campus-new-rear-survey-details';
  for (const feature of features) buildFeature(s, group, feature, t);
  Object.assign(root.userData, { rearSurveySource: item.rearSurvey?.source || 'rear-stair-video-20261111', rearSurveyFeatureCount: features.length, rearSurveyMeasuredDimensions: false, unseenRearStairFlightsAdded: false, rearSurveyHvacCount: features.filter(feature => feature.kind === 'steel-hvac-platform').reduce((n, feature) => n + (feature.upperUnits?.length || 0) + (feature.groundUnits?.length || 0) + (feature.wallUnits?.length || 0), 0) });
  return true;
}
