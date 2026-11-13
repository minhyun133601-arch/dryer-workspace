import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../apps/shared/vendor/three.module.js';
import { buildCampusBoilerRoom, buildPreparationBoilerRoom } from '../apps/site/boiler-models.js';
import { createProximityDoorController } from '../apps/site/proximity-doors.js';

function harness() {
  const s = {
    geometries: new Set(), materials: new Set(), textures: new Set(), parts: [],
    _material(color, roughness = .7, metalness = .1, extra = {}) { const material = new THREE.MeshStandardMaterial({ color, roughness, metalness, ...extra }); this.materials.add(material); return material; },
    _group(parent, position = [0, 0, 0]) { const group = new THREE.Group(); group.position.set(...position); parent.add(group); return group; },
    _mesh(geometry, material, parent, position = [0, 0, 0]) { this.geometries.add(geometry); const mesh = new THREE.Mesh(geometry, material); mesh.position.set(...position); parent.add(mesh); return mesh; },
    _part(root, name, offset) { const group = this._group(root); this.parts.push({ root, group, name, offset }); return group; },
  };
  return { s, root: new THREE.Group(), dispose() { s.geometries.forEach(value => value.dispose()); s.materials.forEach(value => value.dispose()); s.textures.forEach(value => value.dispose()); } };
}

test('the boiler service mains clear the equipment shutter and roller housing while retaining all five routes',()=>{
  for(const [width,depth] of [[13.5,14],[11,11]]) {
    const {s,root,dispose}=harness();
    try {
      buildCampusBoilerRoom(s,root,{type:'campus-boiler-room',width,depth,height:6.2});root.updateMatrixWorld(true);
      const housing=new THREE.Box3().setFromObject(root.getObjectByName('campus-boiler-room-shutter-roller-housing'));
      assert.ok(housing.max.z<=depth/2-.075-.01,'the roller box front must clear the inside face of the 150mm wall');
      const sx=width/13.5,center=-2.5*sx,doorWidth=Math.min(3.4,3.4*sx);
      const clear=new THREE.Box3(new THREE.Vector3(center-doorWidth/2-.12,.2,depth/2-.6),new THREE.Vector3(center+doorWidth/2+.12,4.5,depth/2+.1));
      for(let i=1;i<=5;i++) {
        const pipe=root.getObjectByName(`campus-boiler-shutter-clear-overhead-main-${i}`);assert.ok(pipe);
        pipe.traverse(mesh=>{if(mesh.isMesh)assert.equal(new THREE.Box3().setFromObject(mesh).intersectsBox(clear),false,'pipes must clear the entire equipment opening and its roller box');});
        assert.ok(new THREE.Box3().setFromObject(pipe).max.y<6,'the diverted mains must stay below the roof deck');
      }
    } finally {dispose();}
  }
});

test('the rear blue wall pipe preserves its riser and clears the real wall and a full-height stair walker in each room scale',()=>{
  for(const [kind,width,depth]of [['campus',13.5,14],['campus',11,11],['campus',8.2,9.8],['preparation',8.2,9.8]]){
    const {s,root,dispose}=harness();
    try{
      const build=kind==='campus'?buildCampusBoilerRoom:buildPreparationBoilerRoom;
      build(s,root,{type:kind==='campus'?'campus-boiler-room':'preparation-boiler-room',width,depth,height:6.6});root.updateMatrixWorld(true);
      const pipe=root.getObjectByName('campus-boiler-stair-clear-blue-wall-pipe'),stair=root.getObjectByName('campus-boiler-internal-concrete-stair');
      assert.ok(pipe&&stair);
      const riser=pipe.children[0];
      assert.ok(Math.abs(riser.position.x-1.4*(kind==='campus'?width:11)/13.5)<1e-8);
      assert.ok(Math.abs(riser.position.z-(-6.35*(kind==='campus'?depth:11)/14))<1e-8,'the existing riser stays in its photographed approximate position');
      assert.ok(Math.abs(riser.position.y-3.175)<1e-8&&Math.abs(riser.scale.y-1.35)<1e-8,'the correction changes neither riser elevation nor its height');
      const pipeBounds=new THREE.Box3().setFromObject(pipe);
      if(kind==='campus'){
        const wall=new THREE.Box3().setFromObject(root.getObjectByName('campus-boiler-room-back-wall'));
        assert.ok(pipeBounds.min.z-wall.max.z>=.005-1e-6,'the full pipe and enlarged elbow clear the inside face of the actual 150mm wall');
      }else assert.ok(pipeBounds.min.x-(-width/2+.075)>=.005-1e-6,'the uniformly fitted pipe uses the actual registered room wall, not its omitted reference shell');
      const points=Array.from({length:13},(_,i)=>{
        const tread=stair.children[i*2],p=tread.getWorldPosition(new THREE.Vector3());p.y=new THREE.Box3().setFromObject(tread).max.y;return p;
      });
      for(let leg=1;leg<points.length;leg++){
        const from=points[leg-1],to=points[leg],count=Math.max(1,Math.ceil(from.distanceTo(to)/.05));
        for(let i=0;i<=count;i++){
          const feet=from.clone().lerp(to,i/count);
          for(let side=0;side<=12;side++){
            const offset=side?new THREE.Vector3(Math.sin(side*Math.PI/6)*.3,.35,Math.cos(side*Math.PI/6)*.3):new THREE.Vector3(0,.35,0);
            const hits=new THREE.Raycaster(feet.clone().add(offset),new THREE.Vector3(0,1,0),.001,1.75-.35).intersectObject(pipe,true);
            assert.equal(hits.length,0,`${kind} ${width}x${depth}: the blue pipe must not enter the 1.75m / 0.3m-radius stair walking body`);
          }
        }
      }
    }finally{dispose();}
  }
});

test('the boiler personnel leaf and shutter open independently of their fixed frames and return closed', () => {
  const { s, root, dispose } = harness();
  let controller;
  try {
    buildCampusBoilerRoom(s, root, { type:'campus-boiler-room',width:13.5,depth:14,height:6.2 });
    root.position.set(12,.3,-6); root.rotation.y=.63; root.updateMatrixWorld(true);
    controller=createProximityDoorController(root); assert.equal(controller.count,2);
    const pivot=root.getObjectByName('campus-boiler-room-personnel-door-pivot'),data=pivot.userData.proximityDoor;
    const frame=pivot.parent, before=frame.matrixWorld.clone(),feet=frame.localToWorld(new THREE.Vector3(...data.trigger));
    assert.equal(pivot.rotation.y,0);
    const passageRay=()=>new THREE.Raycaster(frame.localToWorld(new THREE.Vector3(0,1.1,.5)),new THREE.Vector3(0,0,-1).transformDirection(frame.matrixWorld),0,1).intersectObject(frame,true);
    assert.ok(passageRay().length,'the default personnel leaf fills the doorway');
    for(let i=0;i<8;i++)controller.update(feet,.1,{autoOpen:true});
    root.updateMatrixWorld(true); assert.equal(pivot.rotation.y,data.open);assert.ok(frame.matrixWorld.equals(before));
    assert.equal(passageRay().length,0,'the open leaf leaves a real opening through its fixed tile surround');
    const curtain=root.getObjectByName('campus-boiler-room-moving-shutter-curtain'),curtainData=curtain.userData.proximityDoor;
    const threshold=curtain.parent.localToWorld(new THREE.Vector3(...curtainData.trigger));
    for(let i=0;i<8;i++)controller.update(threshold,.1,{autoOpen:true});
    root.updateMatrixWorld(true);
    const housing=root.getObjectByName('campus-boiler-room-shutter-roller-housing');
    assert.ok(new THREE.Box3().setFromObject(housing).containsBox(new THREE.Box3().setFromObject(curtain)),'the retracted curtain must collect inside its actual three-dimensional roller housing');
    assert.ok(curtain.scale.y<.05);
    for(let i=0;i<18;i++)controller.update(threshold.clone().add(new THREE.Vector3(20,0,20)),.1,{autoOpen:true});
    assert.equal(pivot.rotation.y,0);assert.equal(curtain.position.y,0);assert.equal(curtain.scale.y,1);
  } finally {controller?.dispose();dispose();}
});

test('the photographed 1팀2파트 room contains only the two boiler identities listed on its door and accessible observed services', () => {
  const { s, root, dispose } = harness();
  const item = { type: 'campus-boiler-room', width: 11, depth: 11, height: 6.2, parts: ['건물', '지붕', '내부'] };
  const original = structuredClone(item);
  try {
    assert.equal(buildCampusBoilerRoom(s, root, item), true);
    assert.deepEqual(item, original, 'building the inspection model must not edit catalog or equipment layout');
    const boilers = []; root.traverse(value => { if (value.userData.boilerId) boilers.push(value); });
    assert.deepEqual(boilers.map(value => value.userData.boilerId), ['firetube-3t', 'once-through-1.5t']);
    assert.equal(root.userData.observedBoilerCount, 2);
    assert.equal(root.userData.separateFromLiquidCardReference, true, 'this directly filmed 1팀2파트 room is not merged with the 3팀 boiler cards');
    assert.equal(root.userData.hiddenMechanismsAdded, false);
    assert.equal(root.userData.liveOperatingStateAdded, false);
    assert.equal(root.getObjectByName('campus-boiler-green-inline-pump-pair').userData.observedInstalledPumpCount, 2);
    assert.equal(root.getObjectByName('campus-boiler-visible-parts-shelf').userData.storedComponentsNotEquipment, true);
    assert.equal(s.parts.length, 3);
    const main = root.getObjectByName('campus-boiler-firetube-horizontal-shell');
    main.updateWorldMatrix(true, true);
    const size = new THREE.Box3().setFromObject(main).getSize(new THREE.Vector3());
    assert.ok(size.z > size.y, 'the main round boiler is horizontal; panning past its ends must not create a second vertical boiler');
    const box = new THREE.Box3().setFromObject(root);
    assert.ok([...box.min.toArray(), ...box.max.toArray()].every(Number.isFinite));
    assert.ok(box.min.y >= -.001 && box.max.y < 7.3, 'the observed roof and stacks fit below the surrounding service-terrace datum');
    assert.ok(box.min.x >= -5.7 && box.max.x <= 5.7 && box.min.z >= -5.7 && box.max.z <= 6.7);
    root.traverse(value => { if (value.isMesh) assert.ok(s.geometries.has(value.geometry), 'all boiler model geometries belong to scene disposal'); });
  } finally { dispose(); }
});

test('opening the room removes the perforated entrance and translucent roof while preserving the two closed boilers and their visible exterior hardware', () => {
  const { s, root, dispose } = harness();
  try {
    buildCampusBoilerRoom(s, root, { type: 'campus-boiler-room', width: 11, depth: 11, height: 6.2 });
    assert.equal(root.userData.hasInspectableInterior, true);
    const focus = root.getObjectByName(root.userData.interiorFocusObject);
    assert.ok(focus);
    const cover = []; root.traverse(value => { if (value.userData.campusInteriorCover) { cover.push(value); value.visible = false; } });
    assert.equal(cover.length, 5, 'four enclosing wall groups and one roof cover lift for inspection');
    const visibleMeshes = []; root.traverseVisible(value => { if (value.isMesh) visibleMeshes.push(value); });
    assert.ok(!visibleMeshes.some(value => value.name === 'campus-boiler-door-perforation-reference'));
    assert.ok(visibleMeshes.includes(root.getObjectByName('campus-boiler-firetube-horizontal-shell')));
    assert.ok(visibleMeshes.includes(root.getObjectByName('campus-boiler-once-through-compact-shell')));
    assert.ok(root.getObjectByName('campus-boiler-main-visible-gauges-and-level-column'));
    assert.ok(root.getObjectByName('campus-boiler-main-access-ladder'));
    assert.match(root.getObjectByName('campus-boiler-room-observed-door-plate').userData.text, /1팀2파트.*각 1대/);
    const empty = new THREE.Group();
    assert.equal(buildCampusBoilerRoom(s, empty, { type: 'unrelated-room' }), false);
    assert.equal(empty.children.length, 0);
  } finally { dispose(); }
});

test('the physical boiler model remains available when a scene harness has no canvas text support', () => {
  const previous = globalThis.document;
  try {
    for (const document of [{}, { createElement: () => ({}) }]) {
      globalThis.document = document;
      const { s, root, dispose } = harness();
      try {
        assert.equal(buildCampusBoilerRoom(s, root, { type: 'campus-boiler-room' }), true);
        assert.equal(root.userData.observedBoilerCount, 2);
        assert.ok(root.getObjectByName('campus-boiler-room-observed-door-plate'));
      } finally { dispose(); }
    }
  } finally {
    if (previous === undefined) delete globalThis.document;
    else globalThis.document = previous;
  }
});

test('video-supported small fittings remain external and use shared resources for repeated hardware', (context) => {
  const { s, root, dispose } = harness();
  try {
    buildCampusBoilerRoom(s, root, { type: 'campus-boiler-room' });
    const boilers = [], pumps = [], gauges = [], instanced = [];
    let renderObjects = 0;
    root.traverse(value => {
      if (value.userData.boilerId) boilers.push(value);
      if (value.name === 'campus-boiler-installed-green-inline-pump') pumps.push(value);
      if (value.userData.indication) gauges.push(value);
      if (value.isInstancedMesh) instanced.push(value);
      if (value.isMesh || value.isLine) renderObjects++;
      if (value.geometry) assert.ok(s.geometries.has(value.geometry), 'fine mesh and gauge-line geometry must be released with the scene');
    });
    assert.equal(boilers.length, 2, 'flanges, rear blower and stored components never become extra boilers');
    assert.equal(pumps.length, 2, 'the two filmed green inline pumps are the only installed pump identities');
    assert.ok(gauges.length >= 3 && gauges.every(value => value.userData.indication === 'unreadable-static-reference'), 'graduations and pointers do not invent operating readings');
    assert.ok(instanced.some(value => value.name === 'campus-boiler-instanced-flange-fasteners' && value.count === 8));
    assert.ok(instanced.some(value => value.name === 'campus-boiler-instanced-blower-guard-lattice' && value.count > 20));
    assert.ok(instanced.some(value => value.name === 'campus-boiler-instanced-floor-grating-slats' && value.count > 40));
    assert.equal(root.getObjectByName('campus-boiler-photographed-floor-channel-gratings').userData.undergroundRouteAdded, false);
    assert.equal(root.getObjectByName('campus-boiler-wall-service-clamps-and-junctions').userData.hiddenConnectionsAdded, false);
    assert.ok(root.getObjectByName('campus-boiler-room-translucent-roof-cover').userData.campusInteriorCover, 'the finer roof structure still lifts with its cover');
    assert.ok(renderObjects < 700 && s.geometries.size < 160, 'small repeated hardware must not introduce a draw call per bolt, fin or grating slat');
    context.diagnostic(`${renderObjects} render objects; ${s.geometries.size} shared/owned geometries; ${instanced.reduce((count, value) => count + value.count, 0)} repeated hardware instances`);
  } finally { dispose(); }
});

test('the preparation floor reuses the same two filmed boilers with an always-open adjacent room view', () => {
  const { s, root, dispose } = harness();
  const item = { id: 'f1-boiler-room', type: 'preparation-boiler-room', floor: 1, width: 8.2, depth: 9.8, height: 6.6, parts: ['바닥·골조', '연도', '보일러·부대설비'] };
  const original = structuredClone(item);
  try {
    assert.equal(buildPreparationBoilerRoom(s, root, item), true);
    assert.deepEqual(item, original);
    assert.equal(root.userData.physicalRoomId, 'team1-part2-boiler-room');
    assert.equal(root.userData.samePhysicalRoomAs, 'campus-boiler-room');
    assert.equal(root.userData.observedBoilerCount, 2);
    assert.equal(root.userData.alwaysOpenInterior, true);
    assert.equal(root.userData.hiddenMechanismsAdded, false);
    assert.equal(root.userData.separateFromLiquidCardReference, true);
    assert(root.getObjectByName(root.userData.interiorFocusObject));
    const boilers = [], pumps = [], omitted = [];
    root.traverseVisible(node => {
      if (node.userData.boilerId) boilers.push(node.userData.boilerId);
      if (node.name === 'campus-boiler-installed-green-inline-pump') pumps.push(node);
    });
    root.traverse(node => {
      if (node.userData.preparationEnvelopeOmitted) { omitted.push(node); assert.equal(node.visible, false); }
      assert.equal(!!node.userData.campusInteriorCover, false, 'selection changes must not resurrect the second envelope');
    });
    assert.deepEqual(boilers, ['firetube-3t', 'once-through-1.5t']);
    assert.equal(pumps.length, 2);
    assert.equal(omitted.length, 5);
    assert.equal(s.parts.length, 3);
    assert(s.parts.every(part => part.root === root), 'part controls must still address the floor catalog object');
    const unused = new THREE.Group();
    assert.equal(buildPreparationBoilerRoom(s, unused, { type: 'campus-boiler-room' }), false);
    assert.equal(unused.children.length, 0);
  } finally { dispose(); }
});

test('uniform fitting preserves boiler proportions and contains visible room hardware at the registered 1F location', () => {
  for (const rotation of [0, Math.PI / 2]) {
    const { s, root, dispose } = harness();
    try {
      root.position.set(30.3, .3, -8.5); root.rotation.y = rotation; root.updateMatrixWorld(true);
      buildPreparationBoilerRoom(s, root, { type: 'preparation-boiler-room', width: 8.2, depth: 9.8, height: 6.6 });
      root.updateMatrixWorld(true);
      const content = root.getObjectByName('preparation-boiler-room-video-layout');
      assert(content.scale.x > .5 && content.scale.x < 1);
      assert.equal(content.scale.x, content.scale.y); assert.equal(content.scale.y, content.scale.z);
      assert.equal(content.rotation.y, Math.PI / 2, 'burner/front aisle points toward the east-side road');
      const visible = new THREE.Box3();
      root.traverseVisible(node => { if (node.isMesh || node.isLine) visible.expandByObject(node); });
      visible.applyMatrix4(root.matrixWorld.clone().invert());
      assert(visible.min.x >= -4.1 - 1e-6 && visible.max.x <= 4.1 + 1e-6);
      assert(visible.min.z >= -4.9 - 1e-6 && visible.max.z <= 4.9 + 1e-6);
      assert(visible.min.y >= -1e-6 && visible.max.y <= 6.6 + 1e-6);
      root.traverse(node => {
        if (node.geometry) assert(s.geometries.has(node.geometry));
        assert(node.matrixWorld.elements.every(Number.isFinite));
      });
    } finally { dispose(); }
  }
});
