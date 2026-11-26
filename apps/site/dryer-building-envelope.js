import * as THREE from '../shared/vendor/three.module.js';
import { createArchitectureKit } from './architecture-kit.js';

// Architectural context only. Historical fixtures do not enter the equipment
// catalog, and walls are separated so the viewer can cut them away.
export function buildDryerBuildingEnvironment(s, options = {}) {
  const level = Number(options.floor), spec = options.spec;
  if (!spec) throw new RangeError(`Unknown dryer architectural floor: ${options.floor}`);
  const elevation = options.elevation ?? spec.elevation;
  const group = (parent, position = [0, 0, 0]) => s._group(parent, position);
  const cache = s.dryerBuildingGeometry ||= new Map();
  const geometry = (key, create) => {
    if (!cache.has(key)) { const value = create(); cache.set(key, value); s.geometries?.add(value); }
    return cache.get(key);
  };
  const m = s.dryerBuildingMaterials ||= {
    floor: s.mat?.slabFloor || s._material(0x1f5e3f, .34, .06), trim: s.mat?.trim || s._material(0xb8c1b7, .35, .65),
    column: s.mat?.creamBeam || s._material(0xdad5c2, .76, .08), wall: s._material(0xe2dfd0, .88, .02),
    roof: s._material(0xa2a99e, .92, .08), dark: s._material(0x374842, .68, .18),
    ceilingDeck: s.mat?.ceilingDeck || s._material(0x4c545a, .58, .48, { side: THREE.DoubleSide }),
    ceilingRib: s._material(0x3a4247, .55, .52),
    tray: s._material(0x2d3538, .56, .46),
    led: s._material(0xfbf9ee, .35, 0, { emissive: 0xfff8e6, emissiveIntensity: 1.15 }),
    reference: s._material(0xaeb9ae, .8, .12, { transparent: true, opacity: .5 }),
    sign: s._material(0xe7dbc1, .92, .01),
  };
  const mesh = (parent, geom, material, position = [0, 0, 0]) => s._mesh(geom, material, parent, position);
  const box = (parent, size, position, material = m.wall) => mesh(parent, geometry(`box:${size}`, () => new THREE.BoxGeometry(...size)), material, position);
  const deck = group(s.scene, [0, elevation, 0]), structure = group(s.scene, [0, elevation, 0]),
    facade = group(s.scene, [0, elevation, 0]), cover = group(s.scene, [0, elevation, 0]),
    architectureFixtures = group(s.scene, [0, elevation, 0]), ducts = group(s.scene, [0, elevation, 0]),
    ceiling = group(s.scene, [0, elevation, 0]);
  ceiling.visible = false;
  for (const [key, root] of Object.entries({ deck, structure, facade, cover, architectureFixtures, ducts, ceiling })) {
    root.name = `dryer-building-${level}-${key}`;
    Object.assign(root.userData, { architecturalFloor: level, historicalPlan: !spec.routeSurvey, positionBasis: spec.positionConfidence || 'plan-proportion', currentVideoReference:!!spec.routeSurvey, drawingPolicy:spec.routeSurvey?.drawingPolicy || 'historical-reference' });
  }
  function rectanglePath(bounds) {
    const path = new THREE.Path(); path.moveTo(bounds.minX, -bounds.minZ); path.lineTo(bounds.minX, -bounds.maxZ);
    path.lineTo(bounds.maxX, -bounds.maxZ); path.lineTo(bounds.maxX, -bounds.minZ); path.closePath(); return path;
  }
  function plate(parent, bounds, holes = [], material = m.floor, thickness = .16) {
    const key = `slab:${JSON.stringify(bounds)}:${JSON.stringify(holes)}:${thickness}`;
    const geom = geometry(key, () => {
      const shape = new THREE.Shape(); shape.moveTo(bounds.minX, -bounds.minZ); shape.lineTo(bounds.maxX, -bounds.minZ);
      shape.lineTo(bounds.maxX, -bounds.maxZ); shape.lineTo(bounds.minX, -bounds.maxZ); shape.closePath();
      for (const opening of holes) {
        if (opening.diameter) { const path = new THREE.Path(); path.absarc(opening.x, -opening.z, opening.diameter / 2, 0, Math.PI * 2, true); shape.holes.push(path); }
        else shape.holes.push(rectanglePath(opening));
      }
      const result = new THREE.ExtrudeGeometry(shape, { depth: thickness, bevelEnabled: false, curveSegments: 48 });
      result.rotateX(-Math.PI / 2); return result;
    });
    const result = mesh(parent, geom, material, [0, -thickness, 0]); result.userData.slabBounds = { ...bounds }; return result;
  }
  for (const bounds of spec.slabs) {
    const holes = [...(spec.voids || [])];
    for(const opening of spec.slabOpenings || []) if(['minX','maxX','minZ','maxZ'].every(key=>Math.abs(opening.bounds[key]-bounds[key])<1e-6))holes.push(...opening.holes);
    if (spec.architecturalOpening && bounds === spec.mainBounds) holes.push(spec.architecturalOpening);
    plate(deck, bounds, holes);
  }
  for (const patch of spec.slabPatches || []) plate(deck, patch);
  if (spec.roofThreshold) {
    const threshold = plate(deck, spec.roofThreshold, [], m.roof, .13);
    threshold.name = 'dryer-building-3-compressor-roof-threshold';
    threshold.userData.lowWingRoof = true;
  }
  for (const [index, bounds] of (spec.roofWalkwayZones || []).entries()) {
    const walk = plate(deck, bounds, [], m.roof, .13);
    walk.name = `dryer-building-${level}-roof-walkway-${index + 1}`;
    walk.userData.lowWingRoof = true;
  }
  for (const bounds of spec.roofZones || []) {
    const result = plate(cover, bounds, [], m.roof, .13); result.userData.lowWingRoof = true;
  }
  Object.assign(deck.userData, { fullBounds: spec.bounds, partialFloor: !!spec.partialFloor, voids: spec.voids || [], lowWingRoofZones: spec.roofZones || [] });

  const traceRect = (parent, bounds, y, material, width = .07) => {
    for (const z of [bounds.minZ, bounds.maxZ]) box(parent, [bounds.maxX - bounds.minX, width, width], [(bounds.minX + bounds.maxX) / 2, y, z], material);
    for (const x of [bounds.minX, bounds.maxX]) box(parent, [width, width, bounds.maxZ - bounds.minZ], [x, y, (bounds.minZ + bounds.maxZ) / 2], material);
  };
  // Main low-wing grid is documented by the axis chain. Individual column
  // sections remain a neutral approximation; the large floor is not filled
  // with invented process equipment.
  const xs = level <= 3 ? [-8.5, -5.3, .8, 5.7, 8.5, 13.6, 16.4, 22.2, 28.2, 34.3] : [-8.25, 8.25];
  const zs = level <= 3 ? [-13.3, -6.7, 3.1, 13.3, 21.5] : [-13.15, -6.7, 0, 6.7, 13.15];
  const columnHeight = spec.structureHeight || spec.height;
  const columnGeo = geometry(`column:${columnHeight}`, () => new THREE.BoxGeometry(.24, columnHeight, .28));
  // Floors with a wall plan take walls, openings and steel columns from the
  // as-built drawings; the remaining floors keep the registered grid.
  const plan = spec.wallPlan, planRoot = plan && group(architectureFixtures);
  if (plan) {
    const kit = createArchitectureKit(s, { key: 'dryer-plan', level, prefix: `dryer-plan-${level}`, structure, facade, fixtures: planRoot, deck });
    planRoot.name = `dryer-building-${level}-plan-openings`; planRoot.userData.architecturePlan = true;
    for (const data of plan.walls) kit.wall({ height: plan.height, skirting: plan.skirting, ...data });
    for (const data of plan.columns) kit.column({ height: columnHeight, plinth: plan.plinth, ...data, x: data.position[0], z: data.position[1] });
    kit.finish();
  }
  const positions = [];
  if (!plan) for (const x of xs) for (const z of zs) {
    if (level === 3 && (x > 8.6 || z > 13.4)) continue;
    positions.push([x, columnHeight / 2, z]);
  }
  const columns = new THREE.InstancedMesh(columnGeo, m.column, positions.length), matrix = new THREE.Matrix4();
  positions.forEach((position, index) => columns.setMatrixAt(index, matrix.makeTranslation(...position)));
  columns.instanceMatrix.needsUpdate = true; columns.computeBoundingBox(); columns.computeBoundingSphere(); if (positions.length) structure.add(columns);
  if (!plan) for (const bounds of level <= 2 ? [spec.bounds] : [spec.mainBounds]) traceRect(structure, bounds, columnHeight - .12, m.column, .18);
  for (const opening of spec.voids || []) {
    traceRect(structure, opening, .04, m.trim, .08);
    // A minimal open guard represents the boundary, rather than an opaque
    // floor over the clearly labelled VOID.
    for (const z of [opening.minZ, opening.maxZ]) {
      box(structure, [opening.maxX - opening.minX, .035, .035], [(opening.minX + opening.maxX) / 2, 1.05, z], m.trim);
    }
  }

  function wallSegment(parent, a, b, height, openings = [], thickness = .12) {
    const dx = b[0] - a[0], dz = b[1] - a[1], length = Math.hypot(dx, dz), wallRoot = group(parent, [a[0], 0, a[1]]);
    wallRoot.rotation.y = -Math.atan2(dz, dx);
    // Subtract the union of openings in both axes. A raised or stacked window
    // starts at its sill; another row must not refill it with a solid panel.
    const gaps=openings.map(gap=>({...gap,min:Math.max(0,gap.offset-gap.width/2),max:Math.min(length,gap.offset+gap.width/2),bottom:Math.max(0,Math.min(height,gap.sill||0)),top:Math.max(0,Math.min(height,(gap.sill||0)+gap.height))})).filter(gap=>gap.max>gap.min&&gap.top>gap.bottom);
    const cuts=[...new Set([0,length,...gaps.flatMap(gap=>[gap.min,gap.max])])].sort((a,b)=>a-b);
    for(let index=1;index<cuts.length;index++){
      const left=cuts[index-1],right=cuts[index],middle=(left+right)/2;
      const active=gaps.filter(gap=>middle>gap.min-1e-6&&middle<gap.max+1e-6).sort((a,b)=>a.bottom-b.bottom);
      let cursor=0;
      const panel=(bottom,top)=>{if(top-bottom>1e-5)box(wallRoot,[right-left,top-bottom,thickness],[(left+right)/2,(bottom+top)/2,0]);};
      for(const gap of active){if(gap.bottom>cursor)panel(cursor,gap.bottom);cursor=Math.max(cursor,gap.top);}
      if(cursor<height)panel(cursor,height);
    }
    wallRoot.userData.wallOpenings = openings; return wallRoot;
  }
  function doorway(a, b, opening) {
    if (opening.doorKind === 'custom' || opening.doorKind === 'none' || opening.sill > 0) return;
    const rise = opening.threshold?.height ?? 0;
    const width = opening.width, height = opening.height - rise, dx = b[0] - a[0], dz = b[1] - a[1], length = Math.hypot(dx,dz);
    const root = group(architectureFixtures, [a[0] + dx / length * opening.offset, rise, a[1] + dz / length * opening.offset]);
    root.rotation.y = -Math.atan2(dz,dx); root.name = `dryer-building-${level}-door-${architectureFixtures.children.length}`;
    Object.assign(root.userData,{ architecturalDoor:true, openingWidth:width, openingHeight:height, illustratedOpen:false, proximityOperated:true, observedDoorStyle:opening.doorStyle || !!opening.doorKind });
    for (const x of [-width/2,width/2]) box(root,[.065,height,.15],[x,height/2,0],m.trim);
    if (opening.id) root.userData.doorId = opening.id;
    if (opening.positionBasis) root.userData.positionBasis = opening.positionBasis;
    box(root,[width+.13,.075,.15],[0,height+.0375,0],m.trim);
    if (opening.threshold) {
      // The return walk shows the green curb on both approaches. Its rise
      // is a door-frame proportion; the adjacent slab elevations are retained.
      const { depth, sourceSeconds } = opening.threshold;
      m.epoxyCurb ||= s._material(0x437858,.77,.04);
      const curb = box(deck, [width + .06, rise, depth], [root.position.x, rise / 2, root.position.z], m.epoxyCurb);
      curb.name = `dryer-building-${level}-${opening.id}-entry-curb`;
      curb.rotation.y = root.rotation.y;
      Object.assign(curb.userData, { sourceSeconds, dimensionsMeasured: false, thresholdFor: opening.id });
      box(root, [width, .008, depth * .74], [0, .003, 0], m.trim);
    } else {
      box(root,[width,.018,.23],[0,.009,0],m.dark);
    }
    if (opening.doorKind === 'slide') {
      const count = opening.slideLeaves === 1 ? 1 : 2, leafWidth = width / count, plane = .18;
      const travel = width / count + .1, railWidth = count === 2 ? width * 2 + .4 : width + travel + .2;
      Object.assign(root.userData, { doorId: opening.id, slidingDoor: true, slideLeafCount: count, slideLayoutEstimated: !!opening.slideLayoutEstimated, operationBasis: opening.operationBasis });
      const rail = box(root, [railWidth, .11, .15], [count === 2 ? 0 : -travel / 2, height + .15, plane], m.trim);
      rail.name = 'architectural-sliding-door-fixed-rail';
      for (let index = 0; index < count; index++) {
        const side = count === 1 ? -1 : index === 0 ? -1 : 1;
        const closed = count === 1 ? 0 : side * width / 4;
        const leaf = group(root, [closed, 0, plane]); leaf.name = 'architectural-sliding-door-leaf';
        leaf.userData.proximityDoor = {
          enterable: width >= .75 && height >= 1.9, groupId: opening.id ? `dryer-building-${level}-${opening.id}-slide` : root.name,
          label: opening.label || `건조실 ${spec.displayLevel ?? level}층 미닫이문`, accessBasis: 'user-confirmed lateral sliding operation in the registered wall opening',
          kind: 'slide', axis: 'x', closed, open: closed + side * travel, trigger: [0, 0, plane], normal: [0, 0, 1],
          width, height, openDistance: 2.2, closeDistance: 3.1,
        };
        box(leaf, [leafWidth, height - .05, .055], [0, height / 2, 0], m.wall);
        if (count === 2 && index === 0) {
          const seal = box(leaf, [.018, height - .05, .025], [leafWidth / 2, height / 2, .025], m.trim);
          seal.name = 'architectural-sliding-door-centre-seal';
        }
        for (const y of [.14, height - .14]) box(leaf, [leafWidth, .055, .065], [0, y, 0], m.trim);
        for (const x of [-leafWidth / 2 + .025, leafWidth / 2 - .025]) box(leaf, [.045, height - .05, .065], [x, height / 2, 0], m.trim);
        for (const z of [-.06, .06]) box(leaf, [.05, .25, .04], [-side * (leafWidth / 2 - .14), 1.04, z], m.dark);
        for (const x of [-leafWidth * .3, leafWidth * .3]) box(leaf, [.06, .07, .08], [x, height + .06, 0], m.dark);
      }
      return;
    }
    if (width >= 2.5 || opening.doorKind === 'roller') {
      // The roll sits on the wall face, rather than half buried in the lintel.
      // Keep the gathered curtain and its guides in this same mounting plane.
      const rollPlane = .16;
      const housing = group(root,[0,height+.18,rollPlane]); housing.name='architectural-raised-roller-door';
      Object.assign(housing.userData,{wallFaceOffset:.06,mountGap:.02,clearOpeningHeight:height});
      box(housing,[width,.27,.16],[0,0,0],m.trim);
      for (let y=-.1;y<=.11;y+=.055) box(housing,[width,.012,.18],[0,y,.01],m.dark);
      for(const x of [-width*.36,width*.36]) box(root,[.1,.12,.06],[x,height+.18,.09],m.trim);
      for(const x of [-width/2+.015,width/2-.015]) box(root,[.055,height,.08],[x,height/2,rollPlane],m.trim);
      const curtain=group(root,[0,0,rollPlane]); curtain.name='architectural-proximity-roller-curtain';
      curtain.userData.proximityDoor={enterable:width>=.75&&height>=1.9,groupId:root.name,label:`건조실 ${spec.displayLevel ?? level}층 셔터`,accessBasis:'architectural opening cut through the modelled floor envelope',kind:'lift',axis:'y',closed:0,open:height+.07,retract:true,trigger:[0,0,rollPlane],width,height,openDistance:2.2,closeDistance:3.1};
      box(curtain,[width-.08,height-.03,.045],[0,(height-.03)/2,0],m.wall);
      for(let y=.16;y<height-.06;y+=.16) box(curtain,[width-.09,.012,.016],[0,y,.032],m.trim);
      return;
    }
    const pairs = width > 1.55, count = pairs ? 2 : 1, leafWidth = width/count-.06;
    for (let i=0;i<count;i++) {
      const side = pairs ? (i===0 ? -1 : 1) : (opening.hingeSide ?? -1);
      const pivot=group(root,[side*(width/2-.035),0,0]);
      const fixed = pairs && opening.passageSide !== undefined && side !== opening.passageSide;
      pivot.name = fixed ? 'architectural-fixed-door-leaf' : 'architectural-open-door-leaf';
      const center=-side*leafWidth/2;
      if (!fixed) {
        const singlePassage = pairs && opening.passageSide !== undefined;
        pivot.userData.proximityDoor={enterable:width/count>=.75&&height>=1.9,groupId:root.name,label:opening.label || `건조실 ${spec.displayLevel ?? level}층 출입문`,accessBasis:opening.positionBasis || 'architectural opening cut through the modelled floor envelope',kind:'hinge',axis:'y',closed:0,open:side*(opening.swingSide ?? 1)*(opening.openAngle ?? Math.PI*.48),trigger:[singlePassage ? side*width/4 : 0,0,0],width:singlePassage ? width/2 : width,height,openDistance:2.2,closeDistance:3.1};
      }
      if (['gray-fire-door','backed-roof-panel','white-service-pair'].includes(opening.doorStyle)) {
        m.fireDoor ||= s._material(0x8c8981,.72,.16);
        m.serviceDoor ||= s._material(0xe6e5da,.72,.10);
        const doorFace = opening.doorStyle === 'gray-fire-door' ? m.fireDoor : m.serviceDoor;
        const face = box(pivot,[leafWidth,height-.045,.043],[center,height/2,0],doorFace);
        face.name='filmed-solid-door-skin';
        if (opening.doorStyle==='gray-fire-door') {
          m.noticeBlue ||= s._material(0x354f88,.82,.04);
          box(pivot,[.29,.38,.007],[center,1.52,.025],m.noticeBlue);
          box(pivot,[.267,.347,.003],[center,1.52,.030],m.serviceDoor);
          box(pivot,[.205,.019,.003],[center,1.65,.034],m.noticeBlue);
        }
        if (opening.doorStyle === 'backed-roof-panel') {
          // Regular square recesses on the outdoor face only. Both faces
          // remain opaque, as they are on the walk out and on the return.
          const stamps=[], step=.032;
          for(let row=0;row<54;row++) for(let col=0;col<19;col++) {
            if((row*7+col*11)%23<Math.max(0,6-col)*2) continue;
            stamps.push([center+(col-9)*step,.24+row*step,.022]);
          }
          const marks=new THREE.InstancedMesh(geometry('roof-door-square-stamp',()=>new THREE.BoxGeometry(.021,.021,.002)),m.trim,stamps.length);
          const matrix=new THREE.Matrix4();
          stamps.forEach(([x,y,z],index)=>marks.setMatrixAt(index,matrix.makeTranslation(x,y,z)));
          marks.name='roof-door-exterior-square-pattern'; marks.userData.personCollision=false;
          marks.instanceMatrix.needsUpdate=true; marks.computeBoundingBox(); marks.computeBoundingSphere(); pivot.add(marks);
        }
        const handleX=-side*(leafWidth-.10);
        for (const sign of [-1,1]) {
          const rose=mesh(pivot,geometry('survey-door-knob-rose',()=>new THREE.CylinderGeometry(.044,.044,.013,16)),m.trim,[handleX,1.02,sign*.031]);
          rose.rotation.x=Math.PI/2;
          const knob=mesh(pivot,geometry('survey-door-round-knob',()=>new THREE.SphereGeometry(.034,16,10)),m.trim,[handleX,1.02,sign*.069]);
          knob.name='service-door-round-knob'; knob.scale.z=.91;
        }
        for (const y of [.24,height-.24]) box(pivot,[.021,.09,.036],[0,y,.018],m.trim);
        continue;
      }
      if(opening.doorStyle==='perforated'){
        const entries=[],rim=.07,pitch=.07,rib=.035,left=center-leafWidth/2;
        for(let x=left+rim;x<=left+leafWidth-rim+.001;x+=pitch)entries.push([[x,height/2,0],[rib,height-rim*2,.028]]);
        for(let y=rim;y<=height-rim+.001;y+=pitch)entries.push([[center,y,0],[leafWidth-rim*2,rib,.028]]);
        for(const x of [left+rim/2,left+leafWidth-rim/2])entries.push([[x,height/2,0],[rim,height,.035]]);
        for(const y of [rim/2,height-rim/2])entries.push([[center,y,0],[leafWidth,rim,.035]]);
        const lattice=new THREE.InstancedMesh(geometry('perforated-door-unit',()=>new THREE.BoxGeometry(1,1,1)),m.trim,entries.length),dummy=new THREE.Object3D();
        entries.forEach(([p,size],index)=>{dummy.position.set(...p);dummy.scale.set(...size);dummy.updateMatrix();lattice.setMatrixAt(index,dummy.matrix);});
        lattice.name='architectural-perforated-door-lattice';lattice.instanceMatrix.needsUpdate=true;lattice.computeBoundingBox();lattice.computeBoundingSphere();pivot.add(lattice);
        pivot.userData.observedPerforatedDoor=true;
      }else box(pivot,[leafWidth,height-.07,.042],[center,(height-.07)/2+.025,0],m.wall);
      box(pivot,[leafWidth,.22,.015],[center,.24,.03],m.trim);
      for (const y of [.28,height-.3]) box(pivot,[.045,.12,.09],[0,y,.012],m.trim);
      const handleX=-side*(leafWidth-.16);
      for (const z of [-.055,.055]) {
        box(pivot,[.055,.19,.025],[handleX,1.02,z],m.trim);
        box(pivot,[.16,.035,.035],[handleX-side*.045,1.04,z*1.35],m.dark);
      }
      box(pivot,[.035,.065,.065],[handleX,.94,.025],m.dark);
    }
  }
  const { minX, maxX, minZ, maxZ } = spec.bounds;
  const perimeter = level <= 2 ? spec.bounds : spec.mainBounds;
  for (const [side, a, b] of [
    ['north', [perimeter.minX, perimeter.minZ], [perimeter.maxX, perimeter.minZ]],
    ['south', [perimeter.minX, perimeter.maxZ], [perimeter.maxX, perimeter.maxZ]],
    ['west', [perimeter.minX, perimeter.minZ], [perimeter.minX, perimeter.maxZ]],
    ['east', [perimeter.maxX, perimeter.minZ], [perimeter.maxX, perimeter.maxZ]],
  ]) {
    const openings = (spec.openings || []).filter(opening => opening.side === side);
    if (!plan) wallSegment(facade, a, b, Math.min(spec.wallHeight || 3.5, columnHeight), openings);
    for (const opening of openings) doorway(a,b,opening);
  }
  function cutFace(root, top, thickness) {
    m.cut ||= s._material(0x4c5650, .95, 0, { polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
    for (const panel of [...root.children]) {
      const p = panel.geometry?.parameters; if (!p || Math.abs(panel.position.y + p.height / 2 - top) > 1e-6) continue;
      const face = mesh(root, geometry(`cut:${p.width}:${thickness}`, () => { const g = new THREE.PlaneGeometry(p.width, thickness); g.rotateX(-Math.PI / 2); return g; }), m.cut, [panel.position.x, top, 0]);
      face.userData.personCollision = false; face.castShadow = false;
    }
  }
  for (const partition of spec.partitions || []) {
    const fullWall = wallSegment(facade, partition.a, partition.b, Math.min(partition.height || 3.1, columnHeight), partition.openings, partition.thickness);
    const cutaway = wallSegment(structure, partition.a, partition.b, .78, partition.openings, partition.thickness);
    cutaway.userData.lowPartition = true;
    cutFace(cutaway, .78, partition.thickness ?? .12);
    if (partition.roomId) {
      for (const section of [fullWall, cutaway]) Object.assign(section.userData, { roomId: partition.roomId, positionBasis: partition.positionBasis });
    }
    for (const opening of partition.openings || []) doorway(partition.a,partition.b,opening);
  }

  const label = (text, bounds, parent = architectureFixtures) => {
    if (!s._groundText) return;
    const width = Math.min(6, Math.max(1.8, bounds.maxX - bounds.minX - .3));
    s._groundText(text, [(bounds.minX + bounds.maxX) / 2, .045, (bounds.minZ + bounds.maxZ) / 2], width, .9, parent, { color: '#244d3b', font: '700 72px "Malgun Gothic", sans-serif', fitText: true });
  };
  for (const room of spec.rooms || []) label(room.displayLabel || room.name, room.labelBounds || room.bounds);
  // A door label that repeats its room name (화장실) printed two overlapping
  // labels; the room label already names that door's room.
  const roomTexts = new Set((spec.rooms || []).map((room) => room.displayLabel || room.name));
  for (const door of (spec.preparationSurvey?.doors || []).filter((entry) => !roomTexts.has(entry.label))) {
    // A west-wall door names itself on the hall floor in front of it rather
    // than across the wall line (outer-packaging door, 11/12).
    const [x, z] = door.labelPosition || door.position;
    const position = door.labelPosition ? [x, .058, z] : [Math.min(spec.bounds.maxX - 1.2, x), .058, z + (door.id === 'raw-inner-shutter' ? .65 : .1)];
    s._groundText?.(door.label, position, door.id === 'team1-part2' ? 3.1 : 2.4, .42, architectureFixtures,
      { color:'#254f40', font:'700 64px "Malgun Gothic", sans-serif', fitText:true });
  }

  const elevator = spec.cores.elevator, elevatorGroup = group(architectureFixtures);
  elevatorGroup.name = `dryer-building-${level}-elevator-shaft`;
  const elevatorService = spec.elevatorService !== false;
  elevatorGroup.userData = { architecturalFixture: true, currentMechanismConfirmed: false, elevatorService, basis: elevator.geometryBasis };
  traceRect(elevatorGroup, elevator.bounds, .08, m.dark, .13);
  for (const x of [elevator.bounds.minX, elevator.bounds.maxX]) for (const z of [elevator.bounds.minZ, elevator.bounds.maxZ]) box(structure, [.15, spec.height, .15], [x, spec.height / 2, z], m.column);
  const elevatorDoor = { offset: (elevator.bounds.maxX - elevator.bounds.minX) / 2, width: 1.4, height: 2.2, doorKind: 'custom' };
  if (!plan?.ownsLift) wallSegment(facade, [elevator.bounds.minX, elevator.bounds.maxZ], [elevator.bounds.maxX, elevator.bounds.maxZ], Math.min(spec.height, 3), elevatorService ? [elevatorDoor] : []);
  // Show the shaft clearly, with landing doors only on served floors. A tinted shaft
  // volume, closed stainless landing doors and an upright sign mark the
  // drawn ELEV core; no car, rope or machine is invented inside it.
  const shaftWidth = elevator.bounds.maxX - elevator.bounds.minX, shaftDepth = elevator.bounds.maxZ - elevator.bounds.minZ;
  const shaftX = (elevator.bounds.minX + elevator.bounds.maxX) / 2, shaftZ = (elevator.bounds.minZ + elevator.bounds.maxZ) / 2;
  const elevatorPaint = s.dryerElevatorMaterials ||= {
    shaft: s._material(0x4f86b8, .5, .05, { transparent: true, opacity: .26, depthWrite: false }),
    edge: s._material(0x2f5f8f, .55, .2), door: s._material(0xc9d1d4, .3, .65), frame: s._material(0x6d7a80, .45, .4),
  };
  const shaftVolume = box(elevatorGroup, [shaftWidth - .1, spec.height - .05, shaftDepth - .1], [shaftX, spec.height / 2, shaftZ], elevatorPaint.shaft);
  shaftVolume.name = `dryer-building-${level}-elevator-shaft-volume`; shaftVolume.castShadow = false; shaftVolume.userData.marker = 'elevator-shaft';
  for (const x of [elevator.bounds.minX + .06, elevator.bounds.maxX - .06]) for (const z of [elevator.bounds.minZ + .06, elevator.bounds.maxZ - .06]) box(elevatorGroup, [.09, spec.height, .09], [x, spec.height / 2, z], elevatorPaint.edge);
  traceRect(elevatorGroup, elevator.bounds, spec.height - .04, elevatorPaint.edge, .08);
  if (elevatorService) {
    const landing = group(architectureFixtures, [shaftX, 0, elevator.bounds.maxZ + .07]); landing.name = `dryer-building-${level}-elevator-landing-doors`;
    Object.assign(landing.userData, { architecturalDoor: true, elevatorLanding: true, openingWidth: elevatorDoor.width, openingHeight: elevatorDoor.height, illustratedOpen: false, closedLandingDoors: true, carAdded: false, source: 'A013-A018 ELEV core; user request to mark elevators clearly 20261111' });
    box(landing, [1.58, 2.36, .08], [0, 1.18, -.03], elevatorPaint.frame);
    for (const side of [-1, 1]) box(landing, [.68, 2.18, .05], [side * .35, 1.09, .03], elevatorPaint.door).name = 'architectural-closed-elevator-doors';
    box(landing, [.012, 2.18, .06], [0, 1.09, .04], m.dark);
    box(landing, [.12, .26, .04], [1.0, 1.15, .02], elevatorPaint.frame);
    for (const y of [1.2, 1.1]) box(landing, [.05, .05, .02], [1.0, y, .05], m.sign);
    if(level===1&&spec.routeSurvey?.supplementalPackagingWalk){
      Object.assign(landing.userData,{sourceReferences:[{clipId:'first-floor-20261113-clip2',times:[90,108]}],sameObservedElevator:'north-elevator',observedDoorFinish:'two closed stainless leaves with a separate adjacent button cabinet'});
      const panel=group(landing,[-1.35,0,.03]);panel.name='architectural-observed-elevator-adjacent-button-cabinet';
      Object.assign(panel.userData,{sourceReferences:[{clipId:'first-floor-20261113-clip2',times:[108]}],internalControlFunctionsConfirmed:false,liveValuesAdded:false,minimumVisibleButtonColumns:4});
      const observedRed=s.dryerElevatorObservedRed ||=s._material(0xc44d43,.45,.08,{emissive:0x8d2520,emissiveIntensity:.35}),observedGreen=s.dryerElevatorObservedGreen ||=s._material(0x305c48,.6,.08);
      box(panel,[.86,1.9,.12],[0,1.05,0],elevatorPaint.door);
      box(panel,[.68,.34,.014],[0,1.76,.068],m.sign);
      for(let row=0;row<4;row++)for(let col=0;col<4;col++){
        box(panel,[.085,.105,.018],[-.275+col*.18,1.43-row*.24,.073],elevatorPaint.frame).name='architectural-elevator-button-backplate';
        box(panel,[.047,.043,.018],[-.275+col*.18,1.43-row*.24,.09],row%2?observedGreen:observedRed).name='architectural-elevator-observed-indicator';
      }
      box(panel,[.7,.12,.016],[0,.46,.071],m.sign);
    }
    if (typeof document !== 'undefined' && typeof document.createElement === 'function') {
      const canvas = document.createElement('canvas'); canvas.width = 512; canvas.height = 160;
      const ctx = canvas.getContext?.('2d');
      if (ctx) {
        ctx.fillStyle = '#2f5f8f'; ctx.fillRect(0, 0, 512, 160); ctx.fillStyle = '#ffffff'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.font = '700 70px "Malgun Gothic", sans-serif'; ctx.fillText('엘리베이터', 256, 62, 480);
        ctx.font = '600 34px "Malgun Gothic", sans-serif'; ctx.fillText(`ELEV · ${spec.displayLevel ?? level}F`, 256, 128, 480);
        const texture = new THREE.CanvasTexture(canvas); texture.colorSpace = THREE.SRGBColorSpace; s.textures?.add(texture);
        const signMaterial = new THREE.MeshBasicMaterial({ map: texture, side: THREE.DoubleSide }); s.materials?.add(signMaterial);
        const sign = mesh(landing, geometry('elevator-sign-plane', () => new THREE.PlaneGeometry(1.5, .47)), signMaterial, [0, 2.68, .06]);
        sign.name = `dryer-building-${level}-elevator-sign`; sign.castShadow = false; sign.userData.text = '엘리베이터';
      }
    }
    label('엘리베이터 · ELEV', elevator.bounds, elevatorGroup);
  } else {
    // 11/13 user confirmation: the lift passes 1.5F without a stop. Retain
    // its registered shaft axis, but no invented landing, buttons or sign.
    const wall = wallSegment(structure, [elevator.bounds.minX, elevator.bounds.maxZ], [elevator.bounds.maxX, elevator.bounds.maxZ], Math.min(.95, spec.height));
    wall.name = `dryer-building-${level}-nonstop-shaft-wall`;
    Object.assign(wall.userData, { elevatorService: false, noLandingDoor: true });
  }

  function stair(core) {
    const stairHeight = core.height ?? spec.height, fromY = core.fromElevation ?? elevation;
    const bounds = core.bounds, spanX = bounds.maxX - bounds.minX, spanZ = bounds.maxZ - bounds.minZ;
    const width = core.runAxis === 'x' ? spanZ : spanX, depth = core.runAxis === 'x' ? spanX : spanZ;
    const stairRoot = group(architectureFixtures, [(bounds.minX + bounds.maxX) / 2, fromY - elevation, (bounds.minZ + bounds.maxZ) / 2]);
    stairRoot.name = `dryer-building-${level}-${core.id}`;
    if (core.runAxis === 'x') stairRoot.rotation.y = Math.PI / 2;
    Object.assign(stairRoot.userData, { architecturalFixture: true, stairId: core.id, visibleFloors: core.visibleFloors || [level], fromY, toY: fromY + stairHeight, geometryBasis: core.geometryBasis, stepsRepresentative: true,currentVideoReference:!!core.observed,sourceTimes:core.sourceTimes || [],sourceReferences:core.sourceReferences||[],connectionBasis:core.connectionBasis });
    const flights = core.flights || (stairHeight > 4.5 ? 4 : 2), lane = Math.min(1.25, (width - .25) / (flights === 1 ? 1 : 2)), run = core.run ?? Math.max(1.8, Math.min(flights === 1 ? 10 : 4, depth - 1.7)), count = Math.ceil(stairHeight / flights / .18);
    const mirror = core.mirror ? -1 : 1, landingDepth = core.landingDepth ?? .8;
    const observedWhite=core.appearance==='white-stringer-yellow-rail';
    const steel=m.trim,handrail=observedWhite?(s.dryerObservedYellowHandrail ||=s._material(0xe2bd36,.62,.06)):(s.dryerBuildingHandrail ||= s._material(0x936739,.65,.05));
    const treadMaterial=observedWhite?(s.dryerObservedWhiteStair ||=s._material(0xe1e0d2,.75,.12)):core.id==='northeast-stair'&&core.observed?(s.dryerStairTerrazzo ||=s._material(0xcbd0c1,.9,.02)):steel;
    const rail=(a,b,radius=.025,material=steel,name='architectural-stair-handrail')=>{
      const start=new THREE.Vector3(...a),end=new THREE.Vector3(...b),delta=end.clone().sub(start);
      const value=mesh(stairRoot,geometry(`stair-rail:${radius}:${delta.length()}`,()=>new THREE.CylinderGeometry(radius,radius,delta.length(),10)),material,start.add(end).multiplyScalar(.5).toArray());
      value.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),delta.normalize());value.name=name;return value;
    };
    const landingWidth=lane*(flights===1?1:2)+.2;
    const firstDirection=core.startDirection ?? 1;
    if (!core.omitLowerLanding) {
      const lowerLanding=box(stairRoot,[landingWidth,.1,.9],[0,-.05,-firstDirection*(run/2+.45)],treadMaterial);
      lowerLanding.name='architectural-stair-landing';
    }
    for (let flight = 0; flight < flights; flight++) {
      const direction = (flight % 2 ? -1 : 1)*firstDirection, x = flights === 1 ? 0 : mirror * (flight % 2 ? lane / 2 + .06 : -lane / 2 - .06);
      const y0=stairHeight/flights*flight,rise=stairHeight/flights;
      for (let index = 0; index < count; index++) {
        const y = stairHeight / flights * (flight + (index + 1) / count), z = direction * (-run / 2 + (index + .5) * run / count);
        const tread=box(stairRoot,[lane,.075,run/count+.025],[x,y-.0375,z],treadMaterial);tread.name='architectural-stair-tread';
        const riser=box(stairRoot,[lane,rise/count,.035],[x,y-rise/count/2,direction*(-run/2+index*run/count)],treadMaterial);riser.name='architectural-stair-riser';
        if(core.observed){const nosing=box(stairRoot,[lane,.009,.045],[x,y+.0045,direction*(-run/2+index*run/count+.0225)],m.dark);nosing.name='architectural-stair-nosing';}
      }
      const landing=box(stairRoot,[landingWidth,.1,landingDepth],[0,y0+rise-.05,direction*(run/2+landingDepth/2)],treadMaterial);landing.name='architectural-stair-landing';
      for(const side of [-1,1]) {
        const edge=x+side*(lane/2-.035);
        rail([edge,y0+1,-direction*run/2],[edge,y0+rise+1,direction*run/2],.035,core.id==='southeast-stair'||observedWhite?handrail:steel);
        if(observedWhite){
          rail([edge,y0+.55,-direction*run/2],[edge,y0+rise+.55,direction*run/2],.022,handrail,'architectural-observed-yellow-midrail');
          const cheek=box(stairRoot,[.065,.27,Math.hypot(run,rise)],[x+side*lane/2,y0+rise/2-.16,0],treadMaterial);cheek.rotation.x=Math.atan2(-rise,direction*run);cheek.name='architectural-observed-white-stair-stringer';
        }
        for(let post=0;post<=4;post++){
          const ratio=post/4,z=direction*(-run/2+ratio*run),y=y0+rise*ratio;
          rail([edge,y,z],[edge,y+1,z],.018,observedWhite?handrail:steel,'architectural-stair-baluster');
        }
      }
      // Open return landing: the crossing between lanes remains clear.
      const endZ=direction*(run/2+landingDepth-.03);
      // The observed upper return lands directly at a doorway. A rail across
      // that final edge would physically block the filmed exit.
      if(!((core.openUpperLanding || (core.id==='northeast-stair'&&core.observed))&&flight===flights-1))rail([-landingWidth/2,y0+rise+1,endZ],[landingWidth/2,y0+rise+1,endZ],.03,core.id==='southeast-stair'?handrail:steel);
      for(const side of [-1,1])rail([side*landingWidth/2,y0+rise,endZ],[side*landingWidth/2,y0+rise+1,endZ],.02,steel,'architectural-stair-baluster');
    }
    return stairRoot;
  }
  for (const core of spec.stairs || [spec.cores.westStair, spec.cores.northEastStair]) { stair(core); if (core.label !== false) label(core.name, core.labelBounds || core.bounds); }

  // Two cistern symbols belong to the historical low-wing roof drawing. They
  // are translucent architectural references, not new selectable machines.
  for (const fixture of spec.historicalFixtures || []) {
    const root = group(architectureFixtures, [fixture.position[0], 0, fixture.position[1]]);
    root.name = fixture.id; Object.assign(root.userData, fixture);
    box(root, [fixture.width, fixture.height, fixture.depth], [0, fixture.height / 2, 0], m.reference);
    traceRect(root, { minX: -fixture.width / 2, maxX: fixture.width / 2, minZ: -fixture.depth / 2, maxZ: fixture.depth / 2 }, fixture.height, m.trim, .055);
    if (s._groundText) s._groundText('도면상 수조 · 현재 미확인', [0, fixture.height + .025, 0], fixture.width, .48, root);
  }
  if (level === 3) {
    const compressor = spec.rooms.find(room => room.id === 'compressor-room');
    if (compressor) {
      const landingWall = box(architectureFixtures,[.10,2.65,4.60],[10.24,1.325,-9.03],m.wall);
      landingWall.name='ne-stair-corridor-side-wall';
      const b = compressor.bounds, width = b.maxX - b.minX, depth = b.maxZ - b.minZ;
      const westH = compressor.height, eastH = compressor.lowEastHeight ?? compressor.height;
      const slopeLen = Math.hypot(width, westH - eastH), tilt = Math.atan2(westH - eastH, width);
      const midX = (b.minX + b.maxX) / 2, midZ = (b.minZ + b.maxZ) / 2, midY = (westH + eastH) / 2;
      // The sloping eave closes against sheet-metal end walls. The original
      // horizontal wall tops left a triangular gap visible above the doors.
      const infill = geometry('3f-compressor-rake-end', () => {
        const outline = new THREE.Shape();
        outline.moveTo(0,0); outline.lineTo(width,0); outline.lineTo(0,westH-eastH); outline.closePath();
        return new THREE.ExtrudeGeometry(outline,{depth:.12,bevelEnabled:false});
      });
      for (const z of [b.minZ,b.maxZ]) mesh(facade,infill,m.wall,[b.minX,eastH,z-.06]).name='compressor-sloping-end-wall';

      // 04:34–04:44 return. The window and orange door trim meet at a
      // right angle. Both lower panes sit in a short sliding sash.
      const recessWindow = spec.openings.find(opening=>opening.id==='third-roof-recess-window');
      const winZ = spec.mainBounds.minZ + recessWindow.offset;
      const win = group(facade,[spec.mainBounds.maxX+.01,recessWindow.sill,winZ]);
      win.name='ne-roof-recess-window';
      m.recessGlass ||= s._material(0xa5b8af,.45,.12,{transparent:true,opacity:.68,depthWrite:false});
      const winW=recessWindow.width, winH=recessWindow.height;
      box(win,[.035,winH-.06,winW-.06],[0,winH/2,0],m.recessGlass);
      for(const dz of [-winW/2,winW/2])box(win,[.09,winH,.04],[0,winH/2,dz],m.trim);
      for(const y of [0,.62,winH])box(win,[.09,.045,winW],[0,y,0],m.trim);
      box(win,[.08,.62,.038],[0,.31,0],m.trim);

      // Raised horizontal joints in the insulated panels visible on both
      // sides of the roof-door recess and along the compressor facade.
      const seams=[], entry=spec.routeSurvey.compressorWalk;
      const strips=(axis,line,lo,hi,h,gapLo,gapHi,sill,head)=>{
        const strip=(from,to,y)=>{
          if(to<=from)return;
          seams.push(axis==='x'?[[ (from+to)/2,y,line ],[to-from,.015,.018]]:[[line,y,(from+to)/2],[.018,.015,to-from]]);
        };
        for(let y=.22;y<h-.02;y+=.31){
          if(y>sill && y<head){strip(lo,gapLo,y);strip(gapHi,hi,y);}
          else strip(lo,hi,y);
        }
      };
      strips('x',-6.633,8.6,10.3,3.4,entry.roofDoor[0]-.57,entry.roofDoor[0]+.57,0,2.24);
      strips('z',8.67,-6.63,-2.47,3.4,winZ-winW/2-.02,winZ+winW/2+.02,recessWindow.sill-.025,recessWindow.sill+winH+.025);
      strips('x',b.maxZ+.068,b.minX,b.maxX,eastH,entry.compressorDoor[0]-.99,entry.compressorDoor[0]+.99,0,2.24);
      strips('z',b.minX-.068,-6.63,b.maxZ,eastH,0,0,0,0);
      m.seam ||= s._material(0xbcb9ab,.79,.08);
      const batch=new THREE.InstancedMesh(geometry('roof-panel-seam',()=>new THREE.BoxGeometry(1,1,1)),m.seam,seams.length);
      const transform=new THREE.Object3D();
      seams.forEach(([position,size],index)=>{
        transform.position.set(...position);transform.scale.set(...size);transform.updateMatrix();batch.setMatrixAt(index,transform.matrix);
      });
      batch.name='roof-recess-cladding-seams';batch.userData.personCollision=false;batch.instanceMatrix.needsUpdate=true;
      batch.computeBoundingBox();batch.computeBoundingSphere();facade.add(batch);
      const roof = group(cover, [midX, midY, midZ]);
      roof.name = 'dryer-building-3-compressor-room-roof';
      Object.assign(roof.userData, { roomId: compressor.id, positionBasis: compressor.positionBasis, heightBasis: compressor.heightBasis, roofSlope: compressor.roofSlope });
      const panel = box(roof, [slopeLen + .32, .12, depth + .35], [0, .06, 0], m.roof);
      panel.rotation.z = -tilt;
      // Orange fascia trim along the south sloped eave observed in 2026-11-24 outdoor photos.
      const orangeTrim = s.dryerCompressorTrimMat ||= s._material(0xd96b27, .65, .08);
      const fascia = box(roof, [slopeLen + .38, .18, .08], [0, .06, depth / 2 + .18], orangeTrim);
      fascia.rotation.z = -tilt;
      fascia.name = 'dryer-building-3-compressor-orange-fascia';
    }
  }

  // Overhead dark corrugated steel deckplate, cream H-beams, cable trays & round LEDs
  // on the ceiling layer (hidden in cutaway/top overview, visible in person/full view).
  if (level === 4 || level === 5 || level === 1) {
    const unitBox = geometry('ceiling-unit-box', () => new THREE.BoxGeometry(1, 1, 1));
    const unitCyl = geometry('ceiling-unit-cyl', () => new THREE.CylinderGeometry(1, 1, 1, 18));
    const putInstances = (name, geo, mat, entries) => {
      if (!entries.length) return null;
      const inst = new THREE.InstancedMesh(geo, mat, entries.length), dummy = new THREE.Object3D();
      entries.forEach((e, i) => {
        dummy.position.set(...e.p); dummy.rotation.set(...(e.r || [0, 0, 0])); dummy.scale.set(...e.s);
        dummy.updateMatrix(); inst.setMatrixAt(i, dummy.matrix);
      });
      inst.name = `dryer-building-${level}-${name}`;
      inst.userData.personCollision = false; inst.castShadow = false; inst.receiveShadow = true;
      inst.instanceMatrix.needsUpdate = true; inst.computeBoundingBox(); inst.computeBoundingSphere();
      ceiling.add(inst); return inst;
    };
    if (level === 4 || level === 5) {
      const cy = level === 5 ? 5.82 : 6.72;
      const holes = [
        { minX: -8.52, maxX: -5.65, minZ: -13.3, maxZ: -9.45 },
        ...(level === 5
          ? [{ x: -1, z: 7.5, diameter: 7.55 }, { x: -3.35, z: -8.2, diameter: 2.32 }, { x: -3.35, z: -5.2, diameter: 2.32 }, { x: -3.35, z: -2.2, diameter: 2.32 }]
          : [{ x: -2.05, z: -1.7, diameter: 2.52 }]),
      ];
      const deckPlate = plate(ceiling, spec.mainBounds, holes, m.ceilingDeck, .06);
      deckPlate.position.y = cy;
      deckPlate.userData.personCollision = false; deckPlate.castShadow = false;
      deckPlate.name = `dryer-building-${level}-corrugated-deck`;
      const ribs = [], beams = [], trays = [], leds = [], shades = [];
      for (let x = -8.35; x <= 8.35; x += .28) {
        if (level === 5 && Math.abs(x + 1) < 3.85) {
          ribs.push({ p: [x, cy - .04, -5.0], s: [.055, .035, 16.4] });
        } else {
          ribs.push({ p: [x, cy - .04, 0], s: [.055, .035, 26.5] });
        }
      }
      const addHBeamX = (x0, x1, z, y, w = .22, d = .32) => {
        const cx = (x0 + x1) / 2, len = x1 - x0;
        beams.push({ p: [cx, y + d / 2 - .012, z], s: [len, .024, w] }, { p: [cx, y - d / 2 + .012, z], s: [len, .024, w] }, { p: [cx, y, z], s: [len, d - .048, .016] });
      };
      const addHBeamZ = (x, z0, z1, y, w = .22, d = .32) => {
        const cz = (z0 + z1) / 2, len = z1 - z0;
        beams.push({ p: [x, y + d / 2 - .012, cz], s: [w, .024, len] }, { p: [x, y - d / 2 + .012, cz], s: [w, .024, len] }, { p: [x, y, cz], s: [.016, d - .048, len] });
      };
      const by = cy - .2;
      for (const z of [-6.7, -.2, 3.3, 11.6, 13.15]) addHBeamX(-8.4, 8.4, z, by);
      for (const x of [-5.4, 5.6]) addHBeamZ(x, -13.2, 13.2, by);
      addHBeamZ(.7, -13.2, 3.3, by);
      if (level === 5) {
        // Framed steel collar beams around the chamber cone penetration (card 23)
        addHBeamZ(-5.0, 3.3, 11.6, by, .2, .28);
        addHBeamZ(3.0, 3.3, 11.6, by, .2, .28);
      } else {
        // Framed steel collar beams around the 4F V/F chamber cone drop (card 02 RIGHT)
        addHBeamX(-3.45, -.65, -3.05, by, .2, .28);
        addHBeamX(-3.45, -.65, -.35, by, .2, .28);
        addHBeamZ(-3.45, -3.05, -.35, by, .2, .28);
        addHBeamZ(-.65, -3.05, -.35, by, .2, .28);
      }
      // Ladder cable trays & overhead utility pipes
      const ty = cy - .48;
      for (const tx of [-5.0, 5.15]) {
        for (const side of [-.16, .16]) trays.push({ p: [tx + side, ty, 0], s: [.025, .075, 25.4] });
        for (let z = -12.4; z <= 12.4; z += .38) trays.push({ p: [tx, ty - .025, z], s: [.32, .018, .028] });
        for (let z = -11; z <= 11; z += 3.6) trays.push({ p: [tx, (ty + cy) / 2, z], s: [.02, cy - ty, .02] });
      }
      for (const side of [-.15, .15]) trays.push({ p: [0, ty + .06, 2.85 + side], s: [10.4, .07, .025] });
      if (level === 5) {
        for (const [py, r] of [[ty + .14, .055], [ty + .02, .042]]) {
          const pipeMesh = mesh(ceiling, geometry(`5f-ceil-pipe:${r}`, () => { const g = new THREE.CylinderGeometry(r, r, 16.6, 14); g.rotateZ(Math.PI / 2); return g; }), s.mat?.insulation || m.trim, [0, py, 3.25]);
          pipeMesh.userData.personCollision = false; pipeMesh.castShadow = false;
        }
        // 5F photographed floor context (cards 28, 29, 30): yellow pallet with white bag stack,
        // yellow/red floor zone lines, north-wall coiled cable reel, and fire extinguisher.
        const ctx5 = group(architectureFixtures, [0, 0, 0]);
        ctx5.name = 'dryer-building-5-field-context';
        ctx5.userData.movableContext = true;
        m.yellowLine ||= s.mat?.yellow || s._material(0xe8b822, .52, .12);
        m.redLine ||= s.mat?.red || s._material(0xb8382e, .55, .12);
        m.whiteBag ||= s._material(0xeeefe9, .86, .02);
        m.cardboard ||= s._material(0xc7a373, .88, .02);
        // Yellow & red floor parking zone lines (card 30 RIGHT, clear of column [-0.5, -6.7])
        const px = .95, pz = -5.85;
        for (const [lx, lz, lw, ld, mat] of [
          [px, pz - .65, 1.45, .045, m.yellowLine], [px, pz + .65, 1.45, .045, m.yellowLine],
          [px - .70, pz, .045, 1.35, m.yellowLine], [px + .70, pz, .045, 1.35, m.yellowLine],
          [px, pz + 1.95, 1.45, .045, m.redLine], [px + .70, pz + 1.30, .045, 1.35, m.redLine],
        ]) {
          const ln = box(deck, [lw, .006, ld], [lx, .004, lz], mat);
          ln.userData.personCollision = false; ln.castShadow = false;
        }
        // Yellow plastic pallet + stacked white sacks + kraft slip sheet (card 28 FRONT & 30 RIGHT)
        box(ctx5, [1.16, .13, 1.02], [px, .065, pz], m.yellowLine);
        for (let tier = 0; tier < 4; tier++) for (const dx of [-.27, .27]) for (const dz of [-.22, .22]) {
          box(ctx5, [.50, .11, .42], [px + dx, .185 + tier * .115, pz + dz], m.whiteBag);
        }
        box(ctx5, [.62, .12, .52], [px - .18, .68, pz + .1], m.cardboard).rotation.z = -.18;
        // Coiled black cable/hose reel on solid north wall pier between shutter & window (card 30 LEFT & RIGHT)
        const reel = group(ctx5, [-.52, 1.15, -13.18]);
        reel.userData.personCollision = false;
        for (const r of [.24, .29, .34]) {
          const loop = mesh(reel, geometry(`5f-cable-loop:${r}`, () => new THREE.TorusGeometry(r, .016, 6, 24)), m.tray, [0, 0, .05]);
          loop.userData.personCollision = false;
        }
        box(reel, [.14, .18, .08], [0, .28, .02], m.trim).userData.personCollision = false;
        // Fire extinguisher beside east lobby door (card 28 LEFT)
        const ext = mesh(ctx5, geometry('5f-fire-ext', () => new THREE.CylinderGeometry(.085, .085, .44, 14)), m.redLine, [8.12, .24, -6.15]);
        ext.userData.personCollision = false;
      }
      for (const lx of [-6.4, -.8, 4.4, 6.8]) for (const lz of [-10.2, -4.2, 1.5, 7.5, 12.1]) {
        if (Math.hypot(lx + 1, lz - 7.5) < (level === 5 ? 4.3 : 2.3)) continue;
        if (lx < -5.5 && lz < -9.2) continue;
        shades.push({ p: [lx, cy - .36, lz], s: [.22, .14, .22] });
        leds.push({ p: [lx, cy - .435, lz], s: [.19, .018, .19] });
      }
      putInstances('ceiling-ribs', unitBox, m.ceilingRib, ribs);
      putInstances('ceiling-hbeams', unitBox, m.column, beams);
      putInstances('ceiling-cable-trays', unitBox, m.tray, trays);
      putInstances('ceiling-lamp-housings', unitCyl, m.tray, shades);
      putInstances('ceiling-led-disks', unitCyl, m.led, leds);
    } else if (level === 1) {
      // Exposed ceiling over the 1F outer packaging & preparation hall where open
      const cy = 6.24, beams = [], leds = [], shades = [];
      const deckPlate = plate(ceiling, { minX: -8.5, maxX: 34.2, minZ: 3.2, maxZ: 17.0 }, [], m.ceilingDeck, .06);
      deckPlate.position.y = cy; deckPlate.userData.personCollision = false; deckPlate.castShadow = false;
      for (const z of [3.5, 9.8, 16.4]) beams.push({ p: [12.8, cy - .18, z], s: [42.4, .32, .22] });
      for (const x of [-5.4, .7, 8.3, 16.4, 22.2, 28.2]) beams.push({ p: [x, cy - .18, 10.1], s: [.22, .32, 13.6] });
      for (const lx of [-4, 3, 10, 20, 28]) for (const lz of [5.5, 10.5, 15.2]) {
        shades.push({ p: [lx, cy - .34, lz], s: [.22, .14, .22] });
        leds.push({ p: [lx, cy - .415, lz], s: [.19, .018, .19] });
      }
      putInstances('ceiling-hbeams', unitBox, m.column, beams);
      putInstances('ceiling-lamp-housings', unitCyl, m.tray, shades);
      putInstances('ceiling-led-disks', unitCyl, m.led, leds);
    }
  }
  return { deck, structure, facade, cover, architectureFixtures, ducts, ceiling };
}

// Register the survey fixtures against the architecture after both have been
// built. The tile, nosings and sign keep the original survey materials.
export function alignDryerCompressorEntrance(environment) {
  const fixtures = environment?.architectureFixtures;
  const stair = fixtures?.getObjectByName('dryer-compressor-3-stair');
  if (!stair || stair.userData.filmedLandingAligned) return;
  const door = fixtures.children.find(node => node.userData.doorId === 'compressor-room-south');
  const fixed = door?.getObjectByName('architectural-fixed-door-leaf');
  const sign = fixtures.getObjectByName('compressor-door-sign');
  if (fixed && sign) {
    fixed.add(sign);
    sign.position.set(.49,1.29,.028);
    sign.userData.personCollision = false;
  }
  const blower = fixtures.getObjectByName('roof-baghouse-and-stack');
  if (blower) {
    blower.userData.model = 'GTF #5-S4';
    blower.userData.motorPowerKw = 30;
    blower.userData.airflowM3PerMinute = 300;
    blower.userData.nameplatePhoto = '20261124_135608.jpg';
  }
  const window = stair.getObjectByName('ne-stair-north-window');
  window.position.x = 10.10;
  const pane = window.getObjectByName('ne-win-glass');
  pane.scale.y = 3.80; pane.position.y = 2.225;
  const mullions = window.children.filter(node => node.name === 'ne-win-mullion');
  // The central meeting stile belongs to the short sliding sash only.
  for (const mullion of mullions) {
    const short = mullion.position.x === 0;
    mullion.scale.y = short ? .52 : 3.85;
    mullion.position.y = short ? 1.63 : 2.225;
  }
  const sashes = window.children.filter(node => node.name === 'ne-win-rail');
  sashes.forEach((bar,index) => { bar.position.y = [.30,1.37,4.15][index]; });
  const sashTop = sashes[1].clone(); sashTop.position.y = 1.89; window.add(sashTop);
  window.children.filter(node => node.name === 'ne-win-safety-bar').forEach((bar,index) => {
    bar.position.y = [.46,.76,1.06][index];
  });

  const lowerTile = stair.getObjectByName('ne-stair-north-landing-tile');
  lowerTile.name = 'ne-stair-half-landing-tile';
  lowerTile.position.set(12.96,-1.436,-12.53);
  lowerTile.scale.set(.78,.06,1.60);
  const pieces = name => stair.children.filter(node => node.name === name);
  const steps = pieces('ne-stair-desc-tread'), nosings = pieces('ne-stair-desc-nosing');
  for (let i = 0; i < steps.length; i++) {
    const x = 10.36 + i * .30, top = -.18 * (i + 1) + .03;
    steps[i].rotation.y = Math.PI / 2;
    steps[i].position.set(x,top-.03,-12.53);
    steps[i].scale.x = 1.59;
    const nose = nosings[i];
    nose.rotation.y = Math.PI / 2;
    nose.position.set(x-.13,top+.005,-12.53);
    nose.scale.x = 1.59;
    const riser = steps[i].clone();
    riser.name = 'architectural-stair-riser';
    riser.scale.set(1.59,.18,.025);
    riser.position.set(x-.147,top+.09,-12.53); stair.add(riser);
  }
  const railZ = -11.76;
  const posts = pieces('ne-stair-rail-post'), finials = pieces('ne-stair-rail-finial');
  const heights = [.0,-.18,-.54,-.90,-1.26,-1.41];
  const distances = [10.18,10.39,10.99,11.59,12.19,12.65];
  for (let i=0; i<posts.length; i++) {
    posts[i].position.set(distances[i],heights[i]+.51,railZ);
    finials[i].position.set(distances[i],heights[i]+1.05,railZ);
  }
  function between(node, from, to) {
    const start = new THREE.Vector3(...from), delta = new THREE.Vector3(...to).sub(start);
    node.position.copy(start).addScaledVector(delta,.5);
    node.scale.y = delta.length();
    node.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),delta.normalize());
  }
  for (const [i,bar] of pieces('ne-stair-west-rail').entries()) {
    const y = [.52,.98][i];
    between(bar,[10.18,y,railZ],[12.65,y-1.41,railZ]);
  }
  for (const [i,bar] of pieces('ne-stair-top-rail').entries()) {
    const y = [.52,.98][i]-1.41;
    between(bar,[12.65,y,railZ],[13.26,y,railZ]);
  }
  // The camera passes a solid partition on the right until the window
  // landing. The black skirting on the opposite wall stops at the fire door.
  const trim = stair.getObjectByName('ne-stair-west-skirting');
  const southTrim = trim.clone(); southTrim.position.z = -7.37; southTrim.scale.z = 1.22;
  stair.add(southTrim);
  trim.position.z = -11.20; trim.scale.z = 4.12;
  stair.userData.filmedLandingAligned = true;
}
