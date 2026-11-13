import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../apps/shared/vendor/three.module.js';
import { PREPARATION_MODEL_KINDS, buildPreparationEquipment } from '../apps/site/preparation-models.js';
import { EQUIPMENT } from '../apps/site/building-data.js';

function harness() {
  const s = { geometries: new Set(), materials: new Set(), parts: [],
    _material(color, roughness = .5, metalness = .1) { const material = new THREE.MeshStandardMaterial({ color, roughness, metalness }); this.materials.add(material); return material; },
    _group(parent, position = [0, 0, 0]) { const group = new THREE.Group(); group.position.set(...position); parent.add(group); return group; },
    _mesh(geometry, material, parent, position = [0, 0, 0]) { this.geometries.add(geometry); const mesh = new THREE.Mesh(geometry, material); mesh.position.set(...position); parent.add(mesh); return mesh; },
    _part(root, name, offset) { const group = this._group(root); this.parts.push({ root, name, group, offset }); return group; },
  };
  return { s, dispose() { s.geometries.forEach(value => value.dispose()); s.materials.forEach(value => value.dispose()); } };
}

const vessel = (id, label, options = {}) => ({ id, label, radius: .85, bodyHeight: 2.5, baseHeight: .5, ...options });
const items = [
  { id: 'f1-melting', preparation: { kind: 'tank-group', vessels: [vessel('casein', '카제인 탱크', { motor: true })] } },
  { id: 'f1-mix-a', preparation: { kind: 'tank-group', vessels: [vessel('homo-1', '호모믹스 1', { motor: true })] } },
  { id: 'f1-mix-b', preparation: { kind: 'tank-group', vessels: [vessel('homo-2', '호모믹스 2', { motor: true })] } },
  { id: 'f1-oil-water', preparation: { kind: 'tank-group', vessels: [vessel('oil', '오일 탱크', { x: -1.2, motor: false }), vessel('hot-water', '열수 T', { x: 1.2, motor: false })] } },
  { id: 'f1-s1', preparation: { kind: 'tank-group', vessels: [vessel('s1', 'S-1 탱크', { motor: true })] } },
].map(item => ({ floor: 1, parts: ['외함', '상부', '부속'], ...item }));

test('current filmed tank models preserve the six explicit bodies and part ownership rather than replaying the seven-body historical silhouette', () => {
  const { s, dispose } = harness(), roots = [];
  try {
    const original = structuredClone(items);
    for (const item of items) {
      const root = new THREE.Group(); assert.equal(buildPreparationEquipment(s, root, item), true); roots.push(root);
      assert.deepEqual(s.parts.filter(part => part.root === root).map(part => part.name), item.parts);
      assert.equal(root.userData.hiddenMechanismsAdded, false);
      assert.equal(root.userData.nominalDimensionsMeasured, false);
      assert.equal(root.userData.liveOperatingStateAdded, false);
      const box = new THREE.Box3().setFromObject(root);
      assert.ok([...box.min.toArray(), ...box.max.toArray()].every(Number.isFinite));
      assert.ok(box.min.y >= -.001 && box.max.y < 6.8, 'the tall exposed mixer guard is above the platform and below the filmed double-height ceiling');
      root.traverse(object => { if (object.geometry) assert.ok(s.geometries.has(object.geometry), 'mesh and guard wire geometry belong to scene disposal'); });
    }
    const vessels = []; roots.forEach(root => root.traverse(object => { if (object.userData.preparationVesselId) vessels.push(object.userData.preparationVesselId); }));
    assert.deepEqual(vessels, ['casein', 'homo-1', 'homo-2', 'oil', 'hot-water', 's1']);
    assert.equal(new Set(vessels).size, 6);
    assert.equal(roots.reduce((count, root) => count + root.userData.observedVesselBodies, 0), 6);
    assert.ok(roots[1].getObjectByName('preparation-filmed-mixer-coupling-mesh-guard'));
    assert.ok(roots[1].getObjectByName('preparation-filmed-hinged-manway-and-clamps'));
    assert.deepEqual(items, original, 'geometry construction never changes item IDs, poses or source metadata');
  } finally { dispose(); }
});

test('one owned checkerplate deck leaves actual vessel openings and the central U-shaped aisle clear', () => {
  const { s, dispose } = harness();
  try {
    const root = new THREE.Group(), item = { id: 'f1-prep-platform', floor: 1, parts: ['작업면', '난간', '계단'], preparation: {
      kind: 'platform', elevation: 2.4, outline: [[-4, -4], [4, -4], [4, 4], [2, 4], [2, -2], [-2, -2], [-2, 4], [-4, 4]],
      holes: [{ x: -3, z: 0, radius: .9 }, { x: 3, z: 0, radius: .9 }], stairs: { x: 0, z: -6, width: .85, run: 2 },
    } };
    assert.equal(buildPreparationEquipment(s, root, item), true);
    assert.equal(root.userData.singlePlatformOwner, item.id);
    assert.equal(root.userData.vesselClearanceOpenings, 2);
    const deck = root.getObjectByName('preparation-single-shared-checkerplate-platform');
    root.updateMatrixWorld(true);
    for (const [x, z] of [[-3, 0], [3, 0], [0, 0]]) {
      const ray = new THREE.Raycaster(new THREE.Vector3(x, 5, z), new THREE.Vector3(0, -1, 0));
      assert.equal(ray.intersectObject(deck).length, 0, 'the plate must not cover either a tank or the unused centre of the U');
    }
    const ray = new THREE.Raycaster(new THREE.Vector3(-3, 5, 2), new THREE.Vector3(0, -1, 0));
    assert.ok(ray.intersectObject(deck).length > 0);
    assert.ok(root.getObjectByName('preparation-platform-access-stair'));
    assert.ok(root.getObjectByName('preparation-instanced-checkerplate-relief').count > 100);
  } finally { dispose(); }
});

test('independently filmed accessories have their own identities without counting structures, controls or repeated views as tanks', () => {
  const { s, dispose } = harness();
  try {
    for (const kind of PREPARATION_MODEL_KINDS.filter(kind => !['tank-group', 'platform'].includes(kind))) {
      const root = new THREE.Group();
      const preparation = { kind, ...(kind === 'under-platform-services' ? { runs: [{ id:'visible',points:[[0,.5,0],[2,.5,0]],radius:.06 }] } : {}) };
      assert.equal(buildPreparationEquipment(s, root, { id: `prep-${kind}`, floor: 1, preparation, parts: ['본체', '상부', '배관'] }), true, kind);
      assert.equal(root.userData.observedVesselBodies, 0);
      const box = new THREE.Box3().setFromObject(root);
      assert.ok([...box.min.toArray(), ...box.max.toArray()].every(Number.isFinite));
      assert.ok(box.min.y >= -.001 && box.max.y < 6.8);
      if (kind === 'homogenizer') {
        const heads = []; root.traverse(value => { if (value.name === 'preparation-homogenizer-front-round-head') heads.push(value); });
        assert.equal(heads.length, 3, 'the filmed homogenizer has three external pump-head faces');
        assert.ok(root.getObjectByName('preparation-homogenizer-observed-orange-panel-border'));
        assert.ok(root.getObjectByName('preparation-homogenizer-large-exterior-round-cover'));
      }
      if (kind === 'service-pump') assert.equal(root.userData.photographedInstalledPumpCount, 1);
      if (kind === 'powder-hopper') { assert.equal(root.userData.photographedIntegratedPumpCount, 1); assert.ok(root.getObjectByName('preparation-fristam-observed-arched-stainless-cover')); }
      if (kind === 'filter-pot') assert.equal(root.userData.auxiliaryFunctionConfirmed, false);
    }
    for (const item of [{ floor: 3, preparation: { kind: 'tank-group', vessels: [vessel('extra', '')] } }, { floor: 1, preparation: { kind: 'tank-group', vessels: [] } }, { floor: 1, preparation: { kind: 'unknown' } }, { floor: 1 }]) {
      const root = new THREE.Group(), before = s.parts.length;
      assert.equal(buildPreparationEquipment(s, root, item), false);
      assert.equal(root.children.length, 0); assert.equal(s.parts.length, before);
    }
  } finally { dispose(); }
});

test('the filmed hanging tank has a closed visible dished bottom, real deck lugs and the lower clamp, flexible connector and protected sensor route', () => {
  const {s,dispose}=harness();
  try {
    const root=new THREE.Group(),unit={id:'filmed-hanging-vessel',radius:1.02,baseHeight:.95,bodyHeight:2.35,deckElevation:2.45,motor:true,lowerDetails:{inspectionPort:true,flexConnection:true,sensorCable:true,actuator:true}};
    assert.equal(buildPreparationEquipment(s,root,{id:'fixture',floor:1,preparation:{kind:'tank-group',vessels:[unit]}}),true);
    root.updateMatrixWorld(true);
    const shell=root.getObjectByName('preparation-closed-dished-vessel-shell'), lugs=root.getObjectByName('preparation-tank-deck-support-lugs');
    assert.equal(lugs.userData.restsOnDeck,2.45); assert.equal(shell.material.transparent,false);
    for(const y of [unit.baseHeight+.1,1.6,2.2]) assert.ok(new THREE.Raycaster(new THREE.Vector3(3,y,0),new THREE.Vector3(-1,0,0)).intersectObject(shell).length,'the lower vessel skin is closed and actually visible from the aisle');
    const box=new THREE.Box3().setFromObject(shell);assert.ok(Math.abs(box.min.y-(unit.baseHeight-.12))<1e-5,'the dished bottom remains above the floor instead of acquiring invented floor legs');
    for(const name of ['filmed-under-tank-service-assembly','filmed-sanitary-butterfly-valve','filmed-braided-flex-connector','filmed-bottom-sensor-and-protective-cable','filmed-perforated-lower-pipe-protector','filmed-bottom-valve-actuator-exterior']) assert.ok(root.getObjectByName(`preparation-${name}`),name);
    assert.equal(root.userData.observedVesselBodies,1);assert.equal(root.userData.hiddenMechanismsAdded,false);
    root.traverse(object=>{if(object.geometry)assert.ok(s.geometries.has(object.geometry));});
  }finally{dispose();}
});

test('lower shared services retain visibly separate insulated and sanitary runs without inventing more vessels or hidden destinations',()=>{
  const {s,dispose}=harness();
  try{
    const root=new THREE.Group(),preparation={kind:'under-platform-services',runs:[{id:'red-header',points:[[0,.7,-4],[0,.7,4]],radius:.105,paint:'red',insulated:true},{id:'lower-sanitary',points:[[.3,.28,-4],[.3,.28,4]],radius:.055}],valves:[{position:[.3,.28,0],axis:'z',paint:'blue'}],sourceTimes:[387,399,429]};
    assert.equal(buildPreparationEquipment(s,root,{id:'visible-lower-services',floor:1,preparation}),true);
    assert.equal(root.userData.observedVesselBodies,0);assert.equal(root.userData.filmedVisibleServiceRuns,2);assert.equal(root.userData.hiddenPipeDestinationsAdded,false);
    assert.ok(root.getObjectByName('preparation-insulated-header-metal-bands').count>=10);
    assert.ok(root.getObjectByName('preparation-header-support-stanchions').count>=4);
    const pipe=root.getObjectByName('preparation-under-platform-run-red-header');assert.equal(pipe.userData.hiddenDestinationAdded,false);assert.deepEqual(pipe.userData.sourceTimes,[387,399,429]);
    root.traverse(object=>{if(object.geometry)assert.ok(s.geometries.has(object.geometry));});
    const bounds=new THREE.Box3().setFromObject(root);assert.ok(bounds.min.y>=0&&bounds.max.y<1.2);
  }finally{dispose();}
});

test('the November 13 close-up adds one mobile white appliance and the observed Fristam and homogenizer exterior details',()=>{
  const {s,dispose}=harness();
  try{
    const ids=['f1-prep-bag-dump','f1-prep-homogenizer','f1-prep-mobile-white-unit'],roots=new Map();
    for(const id of ids){
      const item=EQUIPMENT.find(value=>value.id===id),root=new THREE.Group();
      assert(item);assert.equal(buildPreparationEquipment(s,root,item),true);roots.set(id,root);
      assert.equal(root.userData.observedVesselBodies,0,'close-up accessories never introduce another preparation tank');
      assert.equal(root.userData.hiddenMechanismsAdded,false);assert.equal(root.userData.liveOperatingStateAdded,false);
      assert.equal(root.userData.sourceReferences[0].clipId,'first-floor-20261113-clip1');
      root.traverse(node=>{if(node.geometry)assert(s.geometries.has(node.geometry));if(node.material)assert(s.materials.has(node.material));});
    }
    const hopper=roots.get(ids[0]),table=hopper.getObjectByName('preparation-bag-dump-filmed-round-inlet-table');
    assert(table);table.updateWorldMatrix(true,false);
    assert.equal(new THREE.Raycaster(new THREE.Vector3(1.6*.28,3,1.2*.12),new THREE.Vector3(0,-1,0)).intersectObject(table).length,0,'the filmed round inlet is a real opening in the tabletop');
    assert(hopper.getObjectByName('preparation-bag-dump-observed-extraction-hood'));
    assert.equal(hopper.getObjectByName('preparation-bag-dump-extraction-hose-corrugations').count,28);
    assert(hopper.getObjectByName('preparation-fristam-observed-vented-control-box'));
    const homogenizer=roots.get(ids[1]),cover=homogenizer.getObjectByName('preparation-homogenizer-observed-rear-service-cover');
    assert.equal(cover.userData.closedServiceCover,true);assert.equal(cover.userData.internalMechanismAdded,false);
    assert(homogenizer.getObjectByName('preparation-homogenizer-observed-triangular-warning'));
    assert.equal(homogenizer.getObjectByName('preparation-homogenizer-observed-white-bucket').userData.capacityUnconfirmed,true);
    const pulls=[];homogenizer.traverse(node=>{if(node.name==='preparation-homogenizer-rear-cover-black-pull')pulls.push(node);});assert.equal(pulls.length,2);
    const white=roots.get(ids[2]);assert.equal(white.userData.photographedMobileWhiteCabinetCount,1);assert.equal(white.userData.applianceFunctionConfirmed,false);
    assert(white.getObjectByName('preparation-mobile-cabinet-observed-corrugated-upriser'));
    assert(white.getObjectByName('preparation-mobile-cabinet-hanging-blue-cover'));
    assert.equal(white.userData.sourceTimes.length,0,'new-clip seconds are not mixed into the older continuous-walk timeline');
  }finally{dispose();}
});

test('the assembled current catalog keeps every vessel within the double-height room and aligned to its real platform opening', () => {
  const { s, dispose } = harness();
  try {
    const current = EQUIPMENT.filter(item => item.preparation), roots = new Map();
    for (const item of current) {
      const root = new THREE.Group();
      assert.equal(buildPreparationEquipment(s, root, item), true, item.id);
      root.position.set(...item.position); root.rotation.y = item.rotation || 0; root.updateMatrixWorld(true); roots.set(item.id, root);
      const bounds = new THREE.Box3().setFromObject(root);
      assert.ok(bounds.min.y >= item.position[1] - .001 && bounds.max.y < 6.6, `${item.id} fits the photographed double-height space`);
      if (item.preparation.kind === 'tank-group') {
        assert.ok(bounds.min.x >= 16.4 && bounds.max.x <= 28.2 && bounds.min.z >= 4.6 && bounds.max.z <= 18.4, `${item.id} and its visible services fit the registered preparation room`);
      }
    }
    const deckItem = current.find(item => item.preparation.kind === 'platform'), deckRoot = roots.get(deckItem.id), deck = deckRoot.getObjectByName('preparation-single-shared-checkerplate-platform');
    const vessels = current.flatMap(item => (item.preparation.vessels || []).map(vessel => ({ ...vessel, x: item.position[0] + (vessel.x || 0), z: item.position[2] + (vessel.z || 0) })));
    assert.equal(vessels.length, 6); assert.equal(deckItem.preparation.holes.length, 6);
    const sharedItem = current.find(item => item.preparation.kind === 'under-platform-services');
    assert.ok(sharedItem, 'the photographed lower common services must be present in the assembled catalog');
    const sharedRoot = roots.get(sharedItem.id), lowerHeader = sharedRoot.getObjectByName('preparation-under-platform-run-lower-sanitary-header'), headerBounds = new THREE.Box3().setFromObject(lowerHeader);
    assert.equal(sharedRoot.userData.hiddenPipeDestinationsAdded, false);
    for (const item of current.filter(item => item.preparation.kind === 'tank-group')) {
      const assemblies = []; roots.get(item.id).traverse(object => { if (object.name === 'preparation-filmed-under-tank-service-assembly') assemblies.push(object); });
      for (const assembly of assemblies) {
        const tee = assembly.getObjectByName('preparation-filmed-low-outlet-cross-run');
        assert.ok(headerBounds.intersectsBox(new THREE.Box3().setFromObject(tee)), 'the filmed lower tank spur meets the registered sanitary header rather than ending in a visible gap');
      }
    }
    for (const vessel of vessels) {
      const hole = deckItem.preparation.holes.find(hole => Math.hypot(deckItem.position[0] + hole.x - vessel.x, deckItem.position[2] + hole.z - vessel.z) < .01);
      assert.ok(hole && hole.radius > vessel.radius, `${vessel.id} has a larger, co-centred opening`);
      for (let i = 0; i < 24; i++) {
        const a = i * Math.PI / 12, ray = new THREE.Raycaster(new THREE.Vector3(vessel.x + Math.cos(a) * vessel.radius, 6, vessel.z + Math.sin(a) * vessel.radius), new THREE.Vector3(0, -1, 0));
        assert.equal(ray.intersectObject(deck).length, 0, `${vessel.id} does not penetrate the platform plate`);
      }
    }
    const stairs = deckRoot.getObjectByName('preparation-platform-access-stair');
    const stairConfig = deckItem.preparation.stairs, endpoint = stairs.localToWorld(new THREE.Vector3(0, deckItem.preparation.elevation, stairConfig.run + .045));
    assert.ok(new THREE.Raycaster(new THREE.Vector3(endpoint.x, 6, endpoint.z), new THREE.Vector3(0, -1, 0)).intersectObject(deck).length, 'the stair upper end meets the plate through its guardrail opening');
    const console = roots.get('f1-prep-console').getObjectByName('preparation-filmed-sloped-console-face');
    assert.ok(console && console.rotation.x < 0, 'the photographed console has an upward sloped face rather than a full upright cabinet');
    for (const id of ['f1-prep-console', 'f1-prep-main-panel']) {
      const item = current.find(item => item.id === id), { width, depth, elevation } = item.preparation;
      assert.equal(elevation, deckItem.preparation.elevation, `${id} stands on the filmed raised checkerplate rather than the ground floor`);
      for (const [dx, dz] of [[-width * .4, -depth * .4], [width * .4, -depth * .4], [-width * .4, depth * .4], [width * .4, depth * .4]]) {
        const ray = new THREE.Raycaster(new THREE.Vector3(item.position[0] + dx, 6, item.position[2] + dz), new THREE.Vector3(0, -1, 0));
        assert.ok(ray.intersectObject(deck).length, `${id} is supported across its footprint by the connected platform`);
      }
    }
    const supportPositions = []; deckRoot.traverse(object => { if (object.name === 'preparation-platform-support-column') supportPositions.push(object.getWorldPosition(new THREE.Vector3())); });
    for (const position of supportPositions) assert.ok(new THREE.Raycaster(new THREE.Vector3(position.x, 6, position.z), new THREE.Vector3(0, -1, 0)).intersectObject(deck).length, 'every automatic support column sits beneath an actual part of the shaped deck');
  } finally { dispose(); }
});
