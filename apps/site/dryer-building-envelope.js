import * as THREE from '../shared/vendor/three.module.js';

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
    floor: s._material(0x537b69, .96, .01), trim: s.mat?.trim || s._material(0xb8c1b7, .58, .27),
    column: s._material(0xc9c6b5, .9, .05), wall: s._material(0xe2dfd0, .95, 0),
    roof: s._material(0xa2a99e, .97, .02), dark: s._material(0x41554b, .8, .08),
    reference: s._material(0xaeb9ae, .8, .12, { transparent: true, opacity: .5 }),
    sign: s._material(0xe7dbc1, .92, .01),
  };
  const mesh = (parent, geom, material, position = [0, 0, 0]) => s._mesh(geom, material, parent, position);
  const box = (parent, size, position, material = m.wall) => mesh(parent, geometry(`box:${size}`, () => new THREE.BoxGeometry(...size)), material, position);
  const deck = group(s.scene, [0, elevation, 0]), structure = group(s.scene, [0, elevation, 0]),
    facade = group(s.scene, [0, elevation, 0]), cover = group(s.scene, [0, elevation, 0]),
    architectureFixtures = group(s.scene, [0, elevation, 0]), ducts = group(s.scene, [0, elevation, 0]);
  for (const [key, root] of Object.entries({ deck, structure, facade, cover, architectureFixtures, ducts })) {
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
  const positions = [];
  for (const x of xs) for (const z of zs) {
    if (level === 3 && (x > 8.6 || z > 13.4)) continue;
    positions.push([x, columnHeight / 2, z]);
  }
  const columns = new THREE.InstancedMesh(columnGeo, m.column, positions.length), matrix = new THREE.Matrix4();
  positions.forEach((position, index) => columns.setMatrixAt(index, matrix.makeTranslation(...position)));
  columns.instanceMatrix.needsUpdate = true; columns.computeBoundingBox(); columns.computeBoundingSphere(); structure.add(columns);
  for (const bounds of level <= 2 ? [spec.bounds] : [spec.mainBounds]) traceRect(structure, bounds, columnHeight - .12, m.column, .18);
  for (const opening of spec.voids || []) {
    traceRect(structure, opening, .04, m.trim, .08);
    // A minimal open guard represents the boundary, rather than an opaque
    // floor over the clearly labelled VOID.
    for (const z of [opening.minZ, opening.maxZ]) {
      box(structure, [opening.maxX - opening.minX, .035, .035], [(opening.minX + opening.maxX) / 2, 1.05, z], m.trim);
    }
  }

  function wallSegment(parent, a, b, height, openings = []) {
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
      const panel=(bottom,top)=>{if(top-bottom>1e-5)box(wallRoot,[right-left,top-bottom,.12],[(left+right)/2,(bottom+top)/2,0]);};
      for(const gap of active){if(gap.bottom>cursor)panel(cursor,gap.bottom);cursor=Math.max(cursor,gap.top);}
      if(cursor<height)panel(cursor,height);
    }
    wallRoot.userData.wallOpenings = openings; return wallRoot;
  }
  function doorway(a, b, opening) {
    if (opening.doorKind === 'custom' || opening.doorKind === 'none' || opening.sill > 0) return;
    const width = opening.width, height = opening.height, dx = b[0] - a[0], dz = b[1] - a[1], length = Math.hypot(dx,dz);
    const root = group(architectureFixtures, [a[0] + dx / length * opening.offset, 0, a[1] + dz / length * opening.offset]);
    root.rotation.y = -Math.atan2(dz,dx); root.name = `dryer-building-${level}-door-${architectureFixtures.children.length}`;
    Object.assign(root.userData,{ architecturalDoor:true, openingWidth:width, openingHeight:height, illustratedOpen:false, proximityOperated:true, observedDoorStyle:opening.doorStyle || !!opening.doorKind });
    for (const x of [-width/2,width/2]) box(root,[.065,height,.15],[x,height/2,0],m.trim);
    box(root,[width+.13,.075,.15],[0,height+.0375,0],m.trim);
    box(root,[width,.018,.23],[0,.009,0],m.dark);
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
      const side = pairs ? i===0 ? -1 : 1 : -1, pivot=group(root,[side*(width/2-.035),0,0]);
      pivot.name='architectural-open-door-leaf';
      pivot.userData.proximityDoor={enterable:width>=.75&&height>=1.9,groupId:root.name,label:`건조실 ${spec.displayLevel ?? level}층 출입문`,accessBasis:'architectural opening cut through the modelled floor envelope',kind:'hinge',axis:'y',closed:0,open:side*Math.PI*.48,trigger:[0,0,0],width,height,openDistance:2.2,closeDistance:3.1};
      const center=-side*leafWidth/2;
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
    wallSegment(facade, a, b, Math.min(spec.wallHeight || 3.5, columnHeight), openings);
    for (const opening of openings) doorway(a,b,opening);
  }
  for (const partition of spec.partitions || []) {
    wallSegment(facade, partition.a, partition.b, Math.min(partition.height || 3.1, columnHeight), partition.openings);
    const cutaway = wallSegment(structure, partition.a, partition.b, .78, partition.openings);
    cutaway.userData.lowPartition = true;
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
  wallSegment(facade, [elevator.bounds.minX, elevator.bounds.maxZ], [elevator.bounds.maxX, elevator.bounds.maxZ], Math.min(spec.height, 3), elevatorService ? [elevatorDoor] : []);
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
    const flights = core.flights || (stairHeight > 4.5 ? 4 : 2), lane = Math.min(1.25, (width - .25) / (flights === 1 ? 1 : 2)), run = Math.max(1.8, Math.min(flights === 1 ? 10 : 4, depth - 1.7)), count = Math.ceil(stairHeight / flights / .18);
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
      const direction = (flight % 2 ? -1 : 1)*firstDirection, x = flights === 1 ? 0 : flight % 2 ? lane / 2 + .06 : -lane / 2 - .06;
      const y0=stairHeight/flights*flight,rise=stairHeight/flights;
      for (let index = 0; index < count; index++) {
        const y = stairHeight / flights * (flight + (index + 1) / count), z = direction * (-run / 2 + (index + .5) * run / count);
        const tread=box(stairRoot,[lane,.075,run/count+.025],[x,y-.0375,z],treadMaterial);tread.name='architectural-stair-tread';
        const riser=box(stairRoot,[lane,rise/count,.035],[x,y-rise/count/2,direction*(-run/2+index*run/count)],treadMaterial);riser.name='architectural-stair-riser';
        if(core.observed){const nosing=box(stairRoot,[lane,.009,.045],[x,y+.0045,direction*(-run/2+index*run/count+.0225)],m.dark);nosing.name='architectural-stair-nosing';}
      }
      const landing=box(stairRoot,[landingWidth,.1,.8],[0,y0+rise-.05,direction*(run/2+.4)],treadMaterial);landing.name='architectural-stair-landing';
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
      const endZ=direction*(run/2+.77);
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
      const b = compressor.bounds, height = 2.7;
      wallSegment(facade, [b.minX, b.minZ], [b.maxX, b.minZ], height);
      wallSegment(facade, [b.minX, b.minZ], [b.minX, b.maxZ], height);
      wallSegment(facade, [b.maxX, b.minZ], [b.maxX, b.maxZ], height);
      wallSegment(facade, [b.minX, b.maxZ], [b.maxX, b.maxZ], height, [{ offset: 3, width: 1.4, height: 2.2 }]);
      box(cover, [b.maxX - b.minX, .1, b.maxZ - b.minZ], [(b.minX + b.maxX) / 2, height, (b.minZ + b.maxZ) / 2], m.roof);
      cover.userData.compressorRoomHeightBasis = 'illustrative-unmeasured';
    }
  }
  return { deck, structure, facade, cover, architectureFixtures, ducts };
}
