import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../apps/shared/vendor/three.module.js';
import { buildCampusRearEquipment, addCampusRearDetails } from '../apps/site/campus-rear-models.js';

function harness() {
  const s = {
    geometries: new Set(), materials: new Set(), parts: [],
    _material(color) { const m = new THREE.MeshBasicMaterial({ color }); this.materials.add(m); return m; },
    _group(parent, position = [0, 0, 0]) { const group = new THREE.Group(); group.position.set(...position); parent.add(group); return group; },
    _mesh(geo, mat, parent, position = [0, 0, 0]) { this.geometries.add(geo); const mesh = new THREE.Mesh(geo, mat); mesh.position.set(...position); parent.add(mesh); return mesh; },
    _part(root, name) { const group = this._group(root); this.parts.push({ root, group, name }); return group; },
  };
  return { s, root: new THREE.Group(), dispose() { s.geometries.forEach(g => g.dispose()); s.materials.forEach(m => m.dispose()); } };
}

function finiteBounds(root) {
  root.updateMatrixWorld(true); const bounds = new THREE.Box3().setFromObject(root);
  assert.ok([...bounds.min.toArray(), ...bounds.max.toArray()].every(Number.isFinite)); return bounds;
}

test('door canopies and roller housings sit on the outer wall plane instead of being centred through it', () => {
  const { s, root, dispose } = harness();
  try {
    for(let i=0;i<3;i++)s._part(root,`part-${i}`);
    addCampusRearDetails(s,root,{exteriorDetails:[
      {id:'paired',kind:'paired-door',position:[0,0,0],datum:'base',width:1.9,height:2.3,canopy:{width:3.3,depth:1,height:.3}},
      {id:'roller',kind:'roller-door',position:[8,0,0],datum:'base',width:3.5,height:4.2,paint:'orange',canopy:{width:4.8,depth:1.2,height:.3}},
      {id:'workshop',kind:'workshop-door',position:[16,0,0],datum:'base',width:2.5,height:2.9,canopy:{width:3.4,depth:1.9,height:.5}},
    ]});
    root.updateMatrixWorld(true);
    for(const id of ['paired','roller','workshop']) {
      const canopy=root.getObjectByName(`campus-exterior-${id}`).getObjectByName('campus-exterior-door-canopy');
      assert.ok(new THREE.Box3().setFromObject(canopy).min.z>=-1e-6,`${id} canopy back must end at the supporting facade`);
    }
    const roller=root.getObjectByName('campus-exterior-roller'),matrix=new THREE.Matrix4();
    roller.traverse(mesh=>{
      if(!mesh.isInstancedMesh)return;
      mesh.geometry.computeBoundingBox();
      for(let i=0;i<mesh.count;i++) {
        mesh.getMatrixAt(i,matrix);
        const box=mesh.geometry.boundingBox.clone().applyMatrix4(mesh.matrixWorld.clone().multiply(matrix));
        if(box.min.y>4.2)assert.ok(box.min.z>=-1e-6,'the roller housing and its overhead units must remain outside the wall');
      }
    });
  } finally {dispose();}
});

test('the filmed projecting vestibule canopy ends at its wall while retaining a front weather overhang', () => {
  const {s,root,dispose}=harness();
  try {
    for(let i=0;i<3;i++)s._part(root,`part-${i}`);
    addCampusRearDetails(s,root,{exteriorDetails:[{id:'entry',kind:'projecting-vestibule',position:[0,0,0],datum:'base',width:2.55,height:2.55,depth:1.15}]});
    root.updateMatrixWorld(true);
    const canopy=new THREE.Box3().setFromObject(root.getObjectByName('campus-vestibule-deep-concrete-canopy'));
    const leaves=new THREE.Box3();root.traverse(node=>{if(node.name==='campus-vestibule-glass-door-leaf')leaves.expandByObject(node);});
    assert.ok(canopy.min.z>=-1e-6,'the concrete slab must not bury its rear half inside the supporting building');
    assert.ok(canopy.max.z-leaves.max.z>.25 && canopy.max.z-leaves.max.z<.6,'the recorded concrete slab still shelters the projecting glass entry and handles');
    const approach=new THREE.Box3(new THREE.Vector3(.3,.2,leaves.max.z+.08),new THREE.Vector3(.8,2.2,leaves.max.z+1.5));
    root.traverse(node=>{if(node.isMesh&&!node.isInstancedMesh)assert.equal(new THREE.Box3().setFromObject(node).intersectsBox(approach),false,'fixed hardware must not occupy the front pedestrian strip');});
  } finally {dispose();}
});

test('the fast-door control casing backs onto its facade and stays beside the door opening',()=>{
  const {s,root,dispose}=harness();
  try {
    for(let i=0;i<3;i++)s._part(root,`part-${i}`);
    addCampusRearDetails(s,root,{exteriorDetails:[{id:'control',kind:'door-controller',position:[39.12,1.5,1.75],yaw:Math.PI/2,width:.45,height:.7}]});
    root.updateMatrixWorld(true);
    const frame=root.getObjectByName('campus-exterior-control'),casing=frame.children[0];
    const bounds=new THREE.Box3().setFromObject(casing);
    assert.ok(Math.abs(bounds.min.x-39)<1e-6,'the full casing remains outside and directly against the X39 wall');
    assert.ok(bounds.min.z>.75+.4,'the wall controller must stay beside the orange door jamb');
  } finally {dispose();}
});

test('rear tank bank builds only the vessels listed in its data and their accessible fixed exterior hardware', () => {
  const { s, root, dispose } = harness();
  try {
    const ids = ['S64-LF', 'S64-LB', 'S64-RF', 'S64-RB'];
    const item = { type: 'campus-process-tank-bank', width: 11, depth: 18, vessels: ids.map((id, i) => ({ id, x: i < 2 ? -2.5 : 2.5, z: i % 2 ? -4.5 : 4.5, radius: 1.25, height: 7.5, ladder: true, pump: true, source: 'video-002-064s' })), walkways: [{ id: 'cross', start: [-2.5, 7.55, 4.5], end: [2.5, 7.55, 4.5], width: .8 }] };
    assert.equal(buildCampusRearEquipment(s, root, item), true);
    const bodies = []; root.traverse(n => { if (n.userData.vesselId) bodies.push(n); });
    assert.deepEqual(bodies.map(n => n.userData.vesselId), ids);
    assert.ok(bodies.every(n => n.userData.measurementsConfirmed === false));
    assert.equal(root.userData.observedVesselCount, 4);
    assert.equal(root.userData.internalMechanismsAdded, false);
    assert.equal(s.parts.length, 3);
    assert.ok(root.getObjectByName('campus-storage-low-containment-curb'));
    assert.ok(root.getObjectByName('campus-storage-walkway-cross'));
    assert.ok(ids.every(id => root.getObjectByName(`campus-storage-pump-${id}`)));
    const bounds = finiteBounds(root);
    assert.ok(bounds.min.y >= -.001 && bounds.max.y < 9 && bounds.max.x < 5.51 && bounds.max.z < 9.01);
    const empty = new THREE.Group(); assert.equal(buildCampusRearEquipment(s, empty, { type: item.type, width: 11, depth: 18 }), false, 'unknown tank count does not create a default bank');
  } finally { dispose(); }
});

test('LPG remains two visible gray vessels with fenced external vaporizer and does not add internal machinery', () => {
  const { s, root, dispose } = harness();
  try {
    assert.equal(buildCampusRearEquipment(s, root, { type: 'campus-lpg-bank', width: 9, depth: 5.6 }), true);
    const bodies = []; root.traverse(n => { if (n.userData.vesselId) bodies.push(n); });
    assert.equal(bodies.length, 2); assert.equal(s.parts.length, 3);
    assert.ok(root.getObjectByName('campus-lpg-visible-vaporizer'));
    assert.ok(root.getObjectByName('campus-lpg-fence-and-guards'));
    assert.equal(root.userData.internalMechanismsAdded, false); finiteBounds(root);
  } finally { dispose(); }
});

test('office building and evidence facade features preserve three selectable parts, centre/base datums and outward-facing doors', () => {
  const { s, root, dispose } = harness();
  try {
    const item = { type: 'campus-rear-service-building', width: 8.4, depth: 28, height: 4.6, exteriorDetails: [
      { kind: 'paired-door', id: 'office-door', position: [-4.2, .8, -7], yaw: -Math.PI / 2, width: 1.8, height: 2.2, datum: 'base', steps: { count: 4, rise: .2, run: .3 } },
      { kind: 'horizontal-windows', id: 'office-windows', position: [-4.2, 3.2, 3], yaw: -Math.PI / 2, width: 8.4, height: .75, panes: 7 },
    ] };
    assert.equal(buildCampusRearEquipment(s, root, item), true);
    assert.equal(s.parts.length, 3); assert.equal(root.userData.interiorAdded, false);
    assert.ok(root.getObjectByName('campus-maintenance-office-body'));
    const door = root.getObjectByName('campus-exterior-office-door');
    assert.ok(door && door.parent === s.parts[2].group);
    assert.ok(Math.abs(door.position.y - 1.9) < 1e-10 && Math.abs(door.position.x + 4.25) < 1e-10);
    assert.ok(root.getObjectByName('campus-office-visible-short-metal-stairs'));
    assert.ok(finiteBounds(root).min.y >= -.001);
    const tower = new THREE.Group(); for (let i = 0; i < 3; i++) s._part(tower, `part-${i}`);
    const before = s.parts.length;
    assert.equal(addCampusRearDetails(s, tower, { type: 'campus-dryer-tower', exteriorDetails: [
      { kind: 'paired-door', id: 'entrance', name: '생산1팀 2파트 출입구', position: [39, 0, 16], datum: 'base', yaw: Math.PI / 2, width: 1.9, height: 2.2 },
      { kind: 'roller-door', id: 'fast-roll', position: [39, 0, 7], datum: 'base', yaw: Math.PI / 2, width: 4, height: 4.5, paint: 'orange', canopy: { width: 5, depth: 2, height: .3 } },
      { kind: 'strip-window', id: 'back-glass', position: [4.5, 22, -13.8], yaw: Math.PI, width: 3.2, height: 30 },
      { kind: 'pipe-rack', id: 'overhead', position: [12, 0, -18], datum: 'base', width: 6, height: 4.5, depth: 1.5 },
    ] }), true);
    assert.equal(s.parts.length, before, 'facade observations do not introduce extra explosion levels');
    assert.equal(tower.getObjectByName('campus-exterior-entrance').userData.name, '생산1팀 2파트 출입구'); finiteBounds(tower);
  } finally { dispose(); }
});

test('recycling room is a corrugated shed with its 압축실 door plate, front guard and red bins along the wall only', () => {
  const { s, root, dispose } = harness();
  try {
    const item = { type: 'campus-recycling-room', width: 4.6, depth: 3.8, height: 2.7, bins: [{ x: -3.4 }, { x: -5 }, { x: -6.6 }] };
    assert.equal(buildCampusRearEquipment(s, root, item), true);
    assert.equal(s.parts.length, 3, 'one shell, roof and exterior detail part like the other rear buildings');
    for (const name of ['campus-recycling-room-body', 'campus-recycling-room-roof', 'campus-recycling-room-exterior', 'campus-recycling-room-door', 'campus-recycling-sorting-bins']) assert.ok(root.getObjectByName(name), name);
    assert.equal(root.userData.signText, '압축실'); assert.equal(root.userData.interiorAdded, false);
    const bounds = finiteBounds(root), bins = new THREE.Box3().setFromObject(root.getObjectByName('campus-recycling-sorting-bins'));
    assert.ok(bounds.min.y >= -.001 && bounds.max.y < 3.4, 'a single-storey shed');
    assert.ok(bins.max.x < -item.width / 2 && bins.min.z >= -item.depth / 2 - .01, 'bins line the wall beside the shed instead of standing in the yard');
    const door = new THREE.Box3().setFromObject(root.getObjectByName('campus-recycling-room-door'));
    assert.ok(door.min.z >= item.depth / 2 - .01, 'the door is on the yard-facing front');
  } finally { dispose(); }
});

test('tank bund paints its road sides green, keeps a white empty compartment and adds only labelled road-row plates', () => {
  const { s, root, dispose } = harness();
  try {
    const item = {
      type: 'campus-process-tank-bank', width: 22, depth: 14,
      vessels: [{ id: 'A', label: '야경유 1', x: 1.35, z: 3.1, radius: 1.45, height: 6, topVent: true, pump: true }, { id: 'B', x: 5.05, z: -3.1, radius: 1.45, height: 6, topVent: true }],
      bund: { height: 1, thickness: .25, paints: { '+z': 'greenWall', '+x': 'greenWall', '-z': 'white', '-x': 'white' }, partitions: [{ x: -1, paint: 'white' }] },
      pipeRuns: [{ id: 'centre', points: [[-.6, .45, 0], [10.4, .45, 0]], radius: .1 }],
      roadsideCabinets: { side: '+z', xs: [-.6, .35], signalX: 1.2 },
    };
    assert.equal(buildCampusRearEquipment(s, root, item), true);
    const curb = root.getObjectByName('campus-storage-low-containment-curb');
    const walls = curb.children.filter((child) => child.isInstancedMesh);
    assert.equal(walls.reduce((sum, mesh) => sum + mesh.count, 0), 5, 'four bund walls plus the white partition');
    assert.equal(curb.userData.wallHeight, 1);
    assert.deepEqual(root.userData.labelledVessels, ['야경유 1']);
    assert.ok(root.getObjectByName('campus-storage-floor-pipe-centre'));
    const cabinets = new THREE.Box3().setFromObject(root.getObjectByName('campus-storage-roadside-control-cabinets'));
    assert.ok(cabinets.min.z > item.depth / 2, 'control cabinets stand outside the road-side wall');
    assert.ok(finiteBounds(root).max.y < 7.5);
  } finally { dispose(); }
});

test('tank valve room builds the observed units with hollow walls, a removable cover and only one filmed interior', () => {
  const { s, root, dispose } = harness();
  try {
    const item = { type: 'campus-tank-valve-room', width: 4.4, depth: 6, height: 2.9,
      units: [{ id: 'a', z: 1.75, depth: 2.3, door: { face: '-x', offset: .55 }, windows: [{ face: '+z', offset: -1.1 }] }, { id: 'b', z: -1.75, depth: 2.3, door: { face: '-x', offset: .5 } }],
      stair: { x: -2.75, fromZ: 4.75, toZ: 3.25, rise: 1, width: .9 } };
    assert.equal(buildCampusRearEquipment(s, root, item), true);
    assert.equal(s.parts.length, 3);
    assert.equal(root.userData.unitCount, 2); assert.equal(root.userData.interiorAdded, true); assert.equal(root.userData.signRead, false);
    assert.equal(root.userData.hasInspectableInterior, true);
    assert.equal(root.userData.observedInteriorUnit, 'a');
    assert.ok(root.getObjectByName('campus-tank-valve-room-interior-a'));
    assert.equal(root.getObjectByName('campus-tank-valve-room-interior-b'), undefined, 'the unfilmed unit is not filled with guessed machinery');
    const valves = root.getObjectByName('campus-valve-room-pneumatic-valves');
    assert.equal(valves.children.length, 3, 'the three visible pneumatic actuator assemblies');
    for (const name of ['campus-valve-room-blue-air-lines', 'campus-valve-room-wall-control-box', 'campus-valve-room-finned-heater']) assert.ok(root.getObjectByName(name), name);
    root.updateMatrixWorld(true);
    const a = new THREE.Box3().setFromObject(root.getObjectByName('campus-tank-valve-room-unit-a')), b = new THREE.Box3().setFromObject(root.getObjectByName('campus-tank-valve-room-unit-b'));
    assert.ok(a.min.z - b.max.z > .9, 'a walkable gap separates the two prefabs');
    assert.ok(a.max.y < 2.7 && b.max.y < 2.7, 'container-height walls');
    const door = new THREE.Box3().setFromObject(root.getObjectByName('campus-tank-valve-room-door-a'));
    assert.ok(door.max.x <= -item.width / 2 + .1, 'the door is on the -X end face');
    const stair = new THREE.Box3().setFromObject(root.getObjectByName('campus-tank-valve-room-metal-stair'));
    assert.ok(stair.max.z > a.max.z && stair.max.y < 2.1, 'the short stair climbs the road-side wall');
    assert.ok(finiteBounds(root).max.y < 3.2);
    const interiorBounds = new THREE.Box3().setFromObject(root.getObjectByName('campus-tank-valve-room-interior-a'));
    assert.ok(interiorBounds.min.x > -item.width / 2 && interiorBounds.max.x < item.width / 2 && interiorBounds.min.z > .6 && interiorBounds.max.z < 2.9, 'filmed machinery fits inside its own unit');
    const covers = []; root.traverse(n => { if (n.userData.campusInteriorCover) { covers.push(n); n.visible = false; } });
    assert.ok(covers.includes(root.getObjectByName('campus-tank-valve-room-roof')));
    assert.ok(covers.includes(root.getObjectByName('campus-valve-room-wall-a-+x')));
    assert.ok(covers.includes(root.getObjectByName('campus-valve-room-wall-a-+z')));
    const visibleMeshes = []; root.traverseVisible(n => { if (n.isMesh) visibleMeshes.push(n); });
    root.updateMatrixWorld(true);
    const ray = new THREE.Raycaster(new THREE.Vector3(.85, 4, 2.5), new THREE.Vector3(0, -1, 0));
    const hits = ray.intersectObjects(visibleMeshes, false);
    assert.ok(hits.length > 0 && Math.abs(hits[0].point.y - .12) < 1e-6, 'opening the cover reveals the real empty floor instead of a solid body block');
    assert.equal(buildCampusRearEquipment(s, new THREE.Group(), { type: item.type, width: 4.4, depth: 6 }), false, 'no default prefab without observed units');
  } finally { dispose(); }
});

test('optional tank stair landing clears the bund and descends beside the room to the inside floor', () => {
  const { s, root, dispose } = harness();
  try {
    const item = { type: 'campus-tank-valve-room', width: 4.4, depth: 2.3, height: 2.9,
      units: [{ id: 'road-side', depth: 2.3 }],
      stair: { x: -2.8, fromZ: 3.9, toZ: 2.6, rise: 1.15, width: .9, landingLength: .7, returnToZ: .7 } };
    buildCampusRearEquipment(s, root, item);
    const stair = root.getObjectByName('campus-tank-valve-room-metal-stair');
    const landing = root.getObjectByName('campus-tank-valve-room-stair-landing');
    const inner = root.getObjectByName('campus-tank-valve-room-stair-inner-flight');
    finiteBounds(root);
    const landingBounds = new THREE.Box3().setFromObject(landing), innerBounds = new THREE.Box3().setFromObject(inner);
    assert.ok(landingBounds.min.z < 2.375 && landingBounds.max.z > 2.625, 'level landing spans the full 25cm bund wall');
    assert.ok(landingBounds.min.y > 1, 'the landing underside clears the 1m wall');
    assert.ok(innerBounds.max.z < landingBounds.min.z + .06 && innerBounds.min.z <= .7, 'inside treads descend after the wall crossing');
    assert.ok(Math.abs(innerBounds.min.y - (.12 - .0225)) < 1e-6, 'the inner flight reaches the floor datum');
    assert.ok(innerBounds.max.x < -item.width / 2, 'the inside flight stays beside the room');
    assert.equal(stair.userData.returnToZ, .7);
  } finally { dispose(); }
});

test('new rear footage adds the gas valve, controller, perforated entries, wash basin, insulated pipes and visible workshop tools', () => {
  const { s, root, dispose } = harness();
  try {
    for (let i = 0; i < 3; i++) s._part(root, `part-${i}`);
    const features = [
      { kind: 'gas-riser', id: 'gas', width: .8, height: 5.2, position: [0, 0, 0], datum: 'base' },
      { kind: 'door-controller', id: 'controller', width: .42, height: .7, depth: .16, position: [2, 1.5, 0] },
      { kind: 'perforated-door', id: 'boiler-door', width: 1.8, height: 2.25, position: [4, 0, 0], datum: 'base', name: '보일러실' },
      { kind: 'wash-tank', id: 'wash', width: 1.8, height: 1.1, depth: .9, position: [6, 0, 0], datum: 'base' },
      { kind: 'insulated-mains', id: 'mains', width: 3.8, height: .65, depth: .8, position: [9, 0, 0], datum: 'base' },
      { kind: 'workshop-door', id: 'workshop', width: 1.9, height: 2.3, position: [13, 0, 0], datum: 'base', name: '공무작업장' },
      { kind: 'electrical-gantry', id: 'office-roof-electrical-gantry', width: 3.5, height: 2.6, depth: 1.6, position: [0, 6.5, -5], datum: 'base', source: 'clip-001-178s' },
    ];
    assert.equal(addCampusRearDetails(s, root, { type: 'campus-dryer-tower', exteriorDetails: features }), true);
    assert.equal(s.parts.length, 3, 'facade hardware remains on the existing selectable detail part');
    for (const name of ['campus-yellow-gas-riser', 'campus-gas-riser-handwheel', 'campus-fast-door-red-beacon', 'campus-stainless-raised-wash-tank', 'campus-visible-insulated-floor-mains', 'campus-workshop-visible-tool-shelves']) assert.ok(root.getObjectByName(name), name);
    const holes = root.getObjectByName('campus-door-perforated-pattern');
    assert.ok(holes.isInstancedMesh && holes.count > 200, 'the punched pattern is batched instead of hundreds of draw calls');
    const gantry = root.getObjectByName('campus-exterior-office-roof-electrical-gantry');
    assert.equal(gantry.userData.visibleInsulatorStacks, 3); assert.equal(gantry.userData.transformerAdded, false);
    const bounds = finiteBounds(root);
    const basin = new THREE.Box3().setFromObject(root.getObjectByName('campus-stainless-raised-wash-tank'));
    assert.ok(basin.min.y > -.001 && basin.max.y < 1.13, 'the basin has legs and stays on the floor');
    assert.ok(bounds.min.y > -.001 && bounds.max.y < 9.2, `facade height range ${bounds.min.y}..${bounds.max.y}`);
  } finally { dispose(); }
});

test('the electrical enclosure represents the filmed gate and stair context without invented indoor machinery', () => {
  const { s, root, dispose } = harness();
  try {
    assert.equal(buildCampusRearEquipment(s, root, { type: 'campus-electrical-room', width: 1.6, depth: 5.6, height: 3.2 }), true);
    assert.equal(s.parts.length, 3);
    for (const name of ['campus-electrical-room-foundation', 'campus-electrical-room-concrete-stair', 'campus-electrical-room-gate']) assert.ok(root.getObjectByName(name));
    assert.equal(root.userData.signText, '수변전실');
    assert.equal(root.userData.hasInspectableInterior, false); assert.equal(root.userData.unobservedTransformersAdded, false);
    finiteBounds(root);
    const lattice = []; root.getObjectByName('campus-electrical-room-gate').traverse(node => { if (node.isInstancedMesh) lattice.push(node); });
    assert.ok(lattice.length, 'the moving green gate lattice remains batched');
  } finally { dispose(); }
});

test('a posed tank stair crosses the side partition and preserves the old fixtures without a pose', () => {
  const { s, root, dispose } = harness();
  try {
    buildCampusRearEquipment(s, root, { type: 'campus-tank-valve-room', width: 4.4, depth: 2.3, height: 2.9,
      units: [{ id: 'road-side', depth: 2.3 }],
      stair: { x: 0, axis: 'x', position: [-3.8, 0, .7], rotation: -Math.PI / 2, fromZ: 1.65, toZ: .35, rise: 1.15, width: .9, landingLength: .7, returnToZ: -1.3, wallCrossing: 'side-partition' } });
    const stair = root.getObjectByName('campus-tank-valve-room-metal-stair');
    const landing = root.getObjectByName('campus-tank-valve-room-stair-landing');
    const inner = root.getObjectByName('campus-tank-valve-room-stair-inner-flight');
    finiteBounds(root);
    const landingBounds = new THREE.Box3().setFromObject(landing), inside = new THREE.Box3().setFromObject(inner), whole = new THREE.Box3().setFromObject(stair);
    assert.ok(landingBounds.min.x < -3.925 && landingBounds.max.x > -3.675, 'the landing crosses the 25cm white side partition at local X=-3.8');
    assert.ok(inside.min.x > landingBounds.min.x && inside.max.x < -2.2, 'the inside flight ends beside the valve room west door');
    assert.ok(whole.max.z < 1.5, 'the stair no longer crosses the front road-side wall at local Z=2.5');
    assert.equal(stair.userData.axis, 'x'); assert.equal(stair.userData.wallCrossing, 'side-partition');
  } finally { dispose(); }
});

test('filmed valve and electrical fittings add visible hardware while retaining the original equipment identities', () => {
  const { s, root, dispose } = harness();
  try {
    buildCampusRearEquipment(s, root, { type: 'campus-tank-valve-room', width: 4.4, depth: 2.3, height: 2.9, units: [{ id: 'road-side', depth: 2.3 }] });
    const valves = [], couplings = [];
    root.traverse(node => {
      if (/^campus-valve-room-pneumatic-valve-\d$/.test(node.name)) valves.push(node);
      if (node.name === 'campus-valve-room-air-quick-coupling') couplings.push(node);
    });
    assert.equal(valves.length, 3, 'adding fittings does not invent another actuator');
    assert.equal(couplings.length, 6, 'each filmed actuator retains its two blue-air connections');
    for (let i = 1; i <= 3; i++) {
      const hardware = root.getObjectByName(`campus-valve-room-flange-hardware-${i}`);
      assert.ok(hardware.children.some(node => node.isInstancedMesh && node.count === 16), 'flange bolts share one batch per valve');
    }
    assert.ok(root.getObjectByName('campus-valve-room-heater-side-vents'));
    finiteBounds(root);
    const electrical = new THREE.Group();
    buildCampusRearEquipment(s, electrical, { type: 'campus-electrical-room', width: 1.4, depth: 5.6, height: 3.2 });
    assert.ok(electrical.getObjectByName('campus-electrical-gate-hinges-and-padlock'));
    assert.equal(electrical.userData.hasInspectableInterior, false, 'a detailed exterior gate still does not advertise an unseen interior');
    assert.equal(electrical.userData.unobservedTransformersAdded, false);
  } finally { dispose(); }
});
