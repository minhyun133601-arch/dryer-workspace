import test from 'node:test';
import { isRetainedEvidenceImage } from '../apps/site/evidence-assets.js';
import assert from 'node:assert/strict';
import { access, readFile } from 'node:fs/promises';
import vm from 'node:vm';
import * as THREE from '../apps/shared/vendor/three.module.js';
import { PACKAGING_ROOM, PACKAGING_ROOMS, PACKAGING_EQUIPMENT, PACKAGING_OVERVIEW, PACKAGING_FLOOR_ELEVATIONS } from '../apps/site/packaging-data.js';
import { TEAM2_CARDS, TEAM2_IDENTITY } from '../apps/site/team2-card-data.js';
import { SITE_ASSETS } from '../apps/site/asset-catalog.js';
import { PACKAGING_STAIR_PROFILES } from '../apps/site/packaging-routes.js';
import { CAMPUS_ROOM } from '../apps/site/campus-data.js';
import { OUTDOOR_ROOM } from '../apps/site/outdoor-data.js';
import { FLOORS, floorElevation } from '../apps/site/facility-data.js';
import { WALK_RULES } from '../apps/site/person-walk.js';
import { buildPackagingEnvironment, buildPackagingEquipment } from '../apps/site/packaging-models.js';
import { createProximityDoorController } from '../apps/site/proximity-doors.js';
import { PLACEMENT_REGIONS, constrainPlacement, fromRoomPosition, toRoomPosition } from '../apps/site/placement-rules.js';

async function harness() {
  const source = (await readFile(new URL('../apps/site/scene.js', import.meta.url), 'utf8'))
    .replace(/^import .*;\r?\n/gm, '').replace(/^export\s+(?=(?:function|class|const|let)\b)/gm, '');
  const context = vm.createContext({ THREE, PACKAGING_ROOM, PACKAGING_ROOMS, PACKAGING_OVERVIEW, PACKAGING_FLOOR_ELEVATIONS, CAMPUS_ROOM, OUTDOOR_ROOM, FLOORS, WALK_RULES, floorElevation,
    PLACEMENT_REGIONS, constrainPlacement, fromRoomPosition, toRoomPosition });
  new vm.Script(`${source}\nglobalThis.FacilityScene = FacilityScene;`).runInContext(context);
  const scene = Object.create(context.FacilityScene.prototype);
  let viewport = { width: 1100, height: 760 };
  Object.assign(scene, {
    scene: new THREE.Group(), objects: new Map(), parts: [], geometries: new Set(), materials: new Set(), textures: new Set(),
    equipment: PACKAGING_EQUIPMENT.map((item) => ({ ...item, position: [...item.position] })),
    placementDefaults: new Map(PACKAGING_EQUIPMENT.map((item) => [item.id, item])),
    placementFootprints: new Map(), placementResults: new Map(), locationDisks: new Map(),
    activeFloor: 'packaging', packagingLevel:3, packagingCargoVisible:false, view: 'perspective', selected: null,
    canvas: { style: {}, dataset: {}, parentElement: { getBoundingClientRect: () => viewport } }, renderer: { setSize() {} },
    camera: new THREE.PerspectiveCamera(42, 1, .1, 1000), topCamera: new THREE.OrthographicCamera(-18, 18, 18, -18, .1, 300),
    target: new THREE.Vector3(), goalTarget: new THREE.Vector3(), orbit: { azimuth: .65, elevation: .88, distance: 68 }, goalOrbit: {},
    onViewChange() {}, onNavigationChange() {}, _invalidate() {}, _placementGuide() {}, labels: [],
    structureEnabled: true, ductsEnabled: true, surveyEnabled: false, isolated: false, amount: 0, explosion: 0,
    selectionRing: { visible: false, position: new THREE.Vector3(), scale: new THREE.Vector3() },
    _material(color, roughness, metalness, extra = {}) {
      const material = new THREE.MeshBasicMaterial({ color, transparent: !!extra.transparent, opacity: extra.opacity ?? 1, side: THREE.DoubleSide });
      this.materials.add(material); return material;
    },
    _group(parent, position = [0, 0, 0]) { const group = new THREE.Group(); group.position.set(...position); parent.add(group); return group; },
    _mesh(geometry, material, parent, position = [0, 0, 0]) { const mesh = new THREE.Mesh(geometry, material); mesh.position.set(...position); parent.add(mesh); this.geometries.add(geometry); return mesh; },
    _box(parent, size, position, material) { return this._mesh(new THREE.BoxGeometry(...size), material, parent, position); },
    _cyl(parent, radius, height, position, material, bottom = radius, segments = 24) { return this._mesh(new THREE.CylinderGeometry(radius, bottom, height, segments), material, parent, position); },
    _part(root, name, offset, position = [0, 0, 0]) { const group = this._group(root, position); this.parts.push({ root, name, group, home: group.position.clone(), offset: new THREE.Vector3(...offset) }); return group; },
  });
  scene.topCamera.up.set(0, 0, -1);
  scene.packagingEnvironments = new Map(Object.values(PACKAGING_ROOMS).map(room=>[room.floorLevel,buildPackagingEnvironment(scene,room)]));
  scene.packaging = scene.packagingEnvironments.get(3);
  for (const item of scene.equipment) {
    const root = scene._group(scene.scene, item.position); root.rotation.y = item.rotation;
    root.userData.equipment = item.id; scene.objects.set(item.id, root);
    assert.equal(buildPackagingEquipment(scene, root, item), true, item.id);
  }
  scene.floorDecks = new Map([['packaging', scene.packaging.deck], ['campus', new THREE.Group()], ['outdoor', new THREE.Group()], [3, new THREE.Group()]]);
  scene.floorStructures = new Map([['packaging', scene.packaging.structure]]);
  scene.ducts = new THREE.Group(); scene.outdoor = { ducts: new THREE.Group() }; scene.campus = { ducts: new THREE.Group() }; scene.survey = new THREE.Group();
  scene.scene.updateMatrixWorld(true); scene._placementFootprints(); scene._visibility();
  return { scene, resize(width, height) { viewport = { width, height }; scene.resize(); }, dispose() {
    scene.scene.traverse((mesh) => { if (mesh.geometry) mesh.geometry.dispose(); });
    scene.materials.forEach((material) => material.dispose()); scene.textures.forEach((texture) => texture.dispose());
  } };
}

function corners(root) {
  const points = [];
  root.updateMatrixWorld(true);
  root.traverse((mesh) => {
    if (!mesh.isMesh) return;
    const box = new THREE.Box3().setFromObject(mesh);
    for (const x of [box.min.x, box.max.x]) for (const y of [box.min.y, box.max.y]) for (const z of [box.min.z, box.max.z]) points.push(new THREE.Vector3(x, y, z));
  });
  return points;
}

function settled(scene) {
  scene.target.copy(scene.goalTarget); Object.assign(scene.orbit, scene.goalOrbit); scene._updateCamera(); return scene._currentCamera();
}

test('all packaging floors use their own drawing catalog and third-floor material supply stays separate from second-floor fillers', async () => {
  assert.equal(PACKAGING_ROOM.id, 'packaging'); assert.equal(PACKAGING_ROOM.floorLevel, 3);
  assert.equal(PACKAGING_ROOM.mainBounds.maxX - PACKAGING_ROOM.mainBounds.minX, 31.35);
  assert.equal(PACKAGING_ROOM.mainBounds.maxZ - PACKAGING_ROOM.mainBounds.minZ, 30.4);
  assert.equal(new Set(PACKAGING_EQUIPMENT.map((item) => item.id)).size, PACKAGING_EQUIPMENT.length);
  assert.deepEqual(Object.keys(PACKAGING_ROOMS),['1','2','3']);
  const floor=(level)=>PACKAGING_EQUIPMENT.filter(i=>i.floorLevel===level);
  assert.equal(floor(1).filter(i=>i.type==='packaging-rotary-packer').length,2);
  assert.equal(floor(2).filter(i=>i.type==='packaging-stick-filler').length,8);
  assert.equal(floor(2).filter(i=>i.type==='packaging-hopper').length,4);
  assert.equal(floor(2).filter(i=>i.type==='packaging-v-mixer').length,2);
  assert.equal(PACKAGING_EQUIPMENT.filter((item) => item.type === 'packaging-mixer').length, 3);
  assert.equal(floor(3).filter(i=>i.type==='packaging-ribbon-mixer').length,1,'the 로타리2호기 hood stands over the 500 kg ribbon mixer');
  assert.equal(floor(3).filter(i=>/card-agitator|card-hopper/.test(i.type)).length,0,'round agitator hoppers belong to the second floor');
  assert.equal(floor(3).filter(i=>i.type==='packaging-stick-mixer').length,2);
  assert.equal(floor(3).filter(i=>i.type==='packaging-sieve').length,4,'one sieve stands at each main mixer');
  assert.equal(floor(3).filter(i=>i.type==='packaging-stick-hoppers').flatMap(i=>i.boxes).length,8);
  assert.ok(floor(3).every(i=>i.type!=='packaging-stick-filler'));
  const images = new Set(Object.values(PACKAGING_ROOMS).flatMap(r=>r.photos));
  for (const item of PACKAGING_EQUIPMENT) {
    assert.equal(item.floor, 'packaging'); assert.equal(item.position[1], 0);
    assert.ok([1,2,3].includes(item.floorLevel));
    assert.doesNotMatch(item.type, /pallet|bag-stack|stored-cargo/);
    for (const photo of item.photos) images.add(photo);
  }
  for (const photo of images) {
    assert.match(photo, /^\.\/(?:assets\/drawings\/packaging|assets\/photos\/equipment-cards\/packaging|photos\/(?:packaging-3f|team2-cards))\//);
    if (isRetainedEvidenceImage(photo)) await access(new URL(`../apps/site/${photo.slice(2)}`, import.meta.url));
    if (photo.includes('/team2-cards/')) assert.equal(isRetainedEvidenceImage(photo), false, 'team 2 card images are excluded from runtime galleries');
    assert.ok(PACKAGING_ROOM.photoCaptions[photo], `${photo} must keep its time or plan caption`);
  }
  for (const asset of SITE_ASSETS.filter(asset => asset.category === 'drawing-packaging')) {
    assert.ok(PACKAGING_ROOM.photoCaptions[asset.path], `${asset.label} keeps its drawing caption under the current asset path`);
    assert.equal(isRetainedEvidenceImage(asset.path), true);
  }
  for (const room of Object.values(PACKAGING_ROOMS)) {
    assert.match(room.reference, /^\.\/assets\/drawings\/packaging\//);
    assert.equal(isRetainedEvidenceImage(room.reference), true, `${room.name} retains its current floor plan`);
  }
  assert.equal(PACKAGING_ROOM.layout.eaveHeight,6);
  assert.equal(PACKAGING_ROOM.layout.ridgeHeight,7.36);
  assert.equal(PACKAGING_ROOMS[1].layout.floorToFloor,6);
  assert.equal(PACKAGING_ROOMS[2].layout.floorToFloor,6.15);
  assert.equal(TEAM2_CARDS.length,41);
  assert.equal(TEAM2_IDENTITY.buildingNumber,9);
  assert.match(TEAM2_IDENTITY.buildingName,/스틱·소포장/);
  for(const item of PACKAGING_EQUIPMENT.filter(i=>i.historyCardNumber)){
    if(item.historyCardNumber===28){
      assert.deepEqual(item.photos.slice(0,2).map(path=>path.split('/').pop()),['four-views.jpg','adsorption-tank-plate.jpg']);
      assert.match(item.photoCaptions[item.photos[1]],/H9-M-045.*흡착탱크/);
    } else assert.ok(item.photos.slice(0,4).every(photo=>/team2-cards\/card-\d{3}-(front|left|right|rear)\.jpg$/.test(photo)),item.id);
    assert.ok(['direct','same-type'].includes(item.historyCardMatch));
  }
  for(const level of [1,2,3]){
    const front=PACKAGING_ROOMS[level].layout.stairs.find(s=>s.id==='front-stair');
    assert.equal(front.rise,level===1?.1:level===2?6:6.15);
    assert.equal(front.rise,PACKAGING_STAIR_PROFILES[level].rise);
  }
});

test('all three floors have finite three-part assemblies, bounded placement and real CIP equipment', async () => {
  const { scene, dispose } = await harness();
  try {
    const bodies = [];
    const nitrogen = scene.objects.get('packaging-f2-nitrogen');
    assert.equal(nitrogen.getObjectsByProperty('name','packaging-nitrogen-panel-gauge').length,3);
    assert.ok(nitrogen.getObjectByName('packaging-nitrogen-central-door-handle'));
    assert.equal(nitrogen.getObjectByName('packaging-nitrogen-lower-louver-banks').count,4*7*2);
    let meshes = 0, repeated = 0;
    scene.scene.traverse((mesh) => { if (mesh.isMesh) meshes++; if (mesh.isInstancedMesh) repeated += mesh.count; });
    assert.ok(repeated > 300, 'rails, steps and repeated fittings should use instances');
    assert.ok(meshes < 2700, `three packaging floors use ${meshes} meshes`);
    for (const item of scene.equipment) {
      const root = scene.objects.get(item.id), parts = scene.parts.filter((part) => part.root === root);
      assert.equal(parts.length, 3);
      assert.ok(corners(root).every((point) => point.toArray().every(Number.isFinite)), item.id);
      const body = new THREE.Box3().setFromObject(parts[0].group);
      assert.ok(body.min.x >= PACKAGING_ROOM.bounds.minX && body.max.x <= PACKAGING_ROOM.bounds.maxX, item.id);
      assert.ok(body.min.z >= PACKAGING_ROOM.bounds.minZ && body.max.z <= PACKAGING_ROOM.bounds.maxZ, item.id);
      assert.equal(scene._constrainTransform(item, item).valid, true, item.id);
      bodies.push({ id: item.id, floor:item.floorLevel,type:item.type,body });
    }
    for (let a = 0; a < bodies.length; a++) for (let b = a + 1; b < bodies.length; b++) {
      if(bodies[a].floor!==bodies[b].floor)continue;
      // The hopper row, its overhead frame and distributors deliberately share
      // an installation envelope. Independent machine bodies must stay apart.
      const coupled=new Set(['packaging-stick-hoppers','packaging-cyclone-frame','packaging-suspended-distributor']);
      if(coupled.has(bodies[a].type)&&coupled.has(bodies[b].type))continue;
      const overlap = ['x', 'y','z'].every((axis) => Math.min(bodies[a].body.max[axis], bodies[b].body.max[axis]) - Math.max(bodies[a].body.min[axis], bodies[b].body.min[axis]) > .01);
      assert.equal(overlap, false, `${bodies[a].id} overlaps ${bodies[b].id}`);
    }
    const cip = new THREE.Box3().setFromObject(scene.objects.get('packaging-ground-vessel'));
    assert.ok(cip.max.y>2&&cip.min.x>=-13&&cip.max.z<=-12.5,'the observed hot-water tank belongs inside the CIP room');
    assert.ok(scene.objects.has('packaging-wash-sink'));
    assert.equal(scene.objects.has('packaging-cip-area'),false,'retired empty area is not duplicated');
  } finally { dispose(); }
});

test('desktop and phone packaging views retain their fit, expose machinery from above and keep the separate room out of the dryer whole-building view', async () => {
  const { scene, resize, dispose } = await harness();
  try {
    scene._visibility();
    const points = [...corners(scene.packaging.deck),...corners(scene.packaging.structure),
      ...scene.equipment.filter(i=>i.floorLevel===3).flatMap(i=>corners(scene.objects.get(i.id)))];
    for (const [width, height] of [[1100, 760], [390, 520]]) {
      resize(width, height);
      for (const view of ['perspective', 'top']) {
        scene.setView(view); const camera = settled(scene);
        for (const point of points) {
          const projected = point.clone().project(camera);
          assert.ok(Math.abs(projected.x) <= 1 && Math.abs(projected.y) <= 1 && projected.z >= -1 && projected.z <= 1, `${width}x${height} ${view}: ${point.toArray()}`);
        }
        assert.equal(scene.packaging.ceiling.visible, false, 'overhead context must not obscure machinery in the overview');
      }
    }
    scene.setView('aisle'); settled(scene); assert.equal(scene.packaging.ceiling.visible, true);
    scene.select('packaging-main-mixer-1'); scene.focus('packaging-main-mixer-1'); settled(scene);
    assert.equal(scene.packaging.ceiling.visible, false, 'focusing equipment must cut away beams above the camera');
    const focusRay = new THREE.Raycaster(); focusRay.setFromCamera(new THREE.Vector2(0, 0), scene.camera);
    const focusHit = focusRay.intersectObjects(scene.scene.children, true).find((hit) => {
      for (let node = hit.object; node; node = node.parent) if (!node.visible) return false;
      return true;
    });
    let hitRoot = focusHit?.object;
    while (hitRoot && !hitRoot.userData.equipment) hitRoot = hitRoot.parent;
    assert.equal(hitRoot?.userData.equipment, 'packaging-main-mixer-1', 'a nearby control cabinet must not block the focused machine');
    scene.setFloor('all');
    assert.equal(scene.packaging.deck.visible, false); assert.equal(scene.packaging.structure.visible, false);
    scene.setFloor('packaging');
    assert.equal(scene.floorDecks.get(3).visible, false, 'packaging must not share the dryer third-floor geometry');
    assert.equal(scene.packaging.deck.visible, true);
    scene.focusPlacement('packaging-main-mixer-1'); settled(scene);
    assert.equal(scene.selected, 'packaging-main-mixer-1'); assert.equal(scene.packagingTopFit, false);
  } finally { dispose(); }
});

test('all floor walking routes stay clear of fixed geometry and preserve camera height across phone resizes', async () => {
  const { scene, resize, dispose } = await harness();
  try {
    for(const level of [3,2,1]){
    scene.setPackagingLevel(level);
    scene.scene.updateMatrixWorld(true);
    const obstacles = [scene.packaging.structure,...scene.equipment.filter(i=>i.floorLevel===level).map(i=>scene.objects.get(i.id))];
    const path = PACKAGING_ROOMS[level].path;
    for (let index = 0; index < path.length - 1; index++) {
      const a = new THREE.Vector3(...path[index]), b = new THREE.Vector3(...path[index + 1]);
      const direction = b.clone().sub(a).normalize(), side = new THREE.Vector3(-direction.z, 0, direction.x);
      for (const offset of [-.25, 0, .25]) {
        const ray = new THREE.Raycaster(a.clone().addScaledVector(side, offset), direction, .03, a.distanceTo(b) - .03);
        const hit = ray.intersectObjects(obstacles, true).find(hit => {
          for(let node=hit.object;node;node=node.parent) if(node.userData.proximityDoor) return false;
          return true;
        });
        assert.ok(!hit, `floor ${level} walking segment ${index} hits ${hit?.object.name} at ${hit?.distance}`);
      }
    }
    resize(1100, 760); scene.setView('aisle');
    for (const progress of [0, 25, 50, 75, 100, 0]) {
      scene.setPackagingProgress(progress); settled(scene);
      const before = scene.camera.position.clone();
      resize(390, 520); settled(scene);
      assert.ok(scene.camera.position.distanceTo(before) < 1e-7, 'a phone resize must not move the viewer');
      const expected = scene._packagingPathPoint(progress).point;
      assert.ok(scene.camera.position.distanceTo(expected) < .01, 'the viewer must follow the stair height as well as the floor route');
      assert.equal(scene.getPackagingProgress(), progress);
      resize(1100, 760); settled(scene);
    }
    }
  } finally { dispose(); }
});

test('a pedestrian can walk the full main mixing deck aisle with storage loaded', async () => {
  const { scene, dispose } = await harness();
  try {
    scene.setPackagingCargoVisible(true);
    const route = PACKAGING_ROOMS[3].path;
    const index = route.findIndex(([x, , z]) => x === -8.5 && z === -9.85);
    assert.ok(index >= 0);
    const [a, b] = route.slice(index, index + 2);
    assert.equal(b[0], a[0]);
    assert.equal(b[2], 6.4);
    const deck = a[1] - WALK_RULES.eyeHeight;
    const supports = scene._personSupportMeshes(), supportSet = new Set(supports), bodies = scene._personCollisionBodies();
    for (const offset of [-.1, 0, .1]) {
      const count = Math.ceil((b[2] - a[2]) / .05);
      for (let n = 0; n <= count; n++) {
        const at = [a[0] + offset, deck, a[2] + (b[2] - a[2]) * n / count];
        assert.ok(Math.abs(scene._personGroundHeight(at, supports) - deck) < .05, `deck beneath ${at}`);
        assert.ok(scene._personCanOccupy(at, null, bodies, supportSet), `body clearance at ${at}`);
      }
    }
  } finally { dispose(); }
});

test('the posted third-floor labels and six PDA stations remain readable when cargo is hidden', async () => {
  const { scene, dispose } = await harness();
  const items = scene.equipment.filter(item => item.floorLevel === 3);
  try {
    const pda = [];
    scene.packaging.structure.traverse(node => {
      if (!node.userData.pda) return;
      const label = node.getObjectByName('packaging-pda-location-plate');
      assert.equal(label?.userData.printedText, `PDA|${node.userData.pda}`);
      pda.push(node.userData.pda);
    });
    assert.deepEqual(pda.sort(), ['배합(소)', '배합(소)', '배합(소)', '배합(스)', '계량실', '원부자재 보관창고'].sort());
    const hopperSigns = [];
    for (const item of items.filter(item => item.type === 'packaging-stick-hoppers')) {
      scene.objects.get(item.id).traverse(node => {
        if (node.name === 'packaging-hopper-line-nameplate') hopperSigns.push(node.userData.printedText);
      });
    }
    assert.deepEqual(hopperSigns, ['1,2호기 호퍼', '1,2호기 호퍼', '1,2호기 호퍼', '3,4호기 호퍼|(커피)', '3,4호기 호퍼', '3,4호기 호퍼', '5호기 호퍼', '6호기 호퍼', '7호기 호퍼|(커피)', '7호기 호퍼']);
    const locations = items.filter(item => item.locationLabel);
    const letters = [...'ABCDEFGHIJKL'].map(letter => `P3-3층-${letter}`);
    assert.deepEqual([...new Set(locations.map(item => item.locationLabel))].sort(), letters);
    for (const visible of [false, true, false]) {
      scene.setPackagingCargoVisible(visible);
      assert.equal(scene.packaging.cargo.visible, visible);
      for (const item of locations) {
        const root = scene.objects.get(item.id), cargo = root.userData.packagingCargo;
        assert.ok(cargo.children.length > 0, item.id);
        assert.equal(cargo.visible, visible, item.id);
        const plates = [];
        root.traverseVisible(node => { if (node.name === 'packaging-location-label-plate') plates.push(node.userData.printedText); });
        assert.ok(plates.length >= 2 && plates.every(label => label === item.locationLabel), item.id);
      }
    }
  } finally { dispose(); }
});

test('packaging passage doors open on approach and close after departure on every displayed floor', async () => {
  const { scene, dispose } = await harness();
  const controller = createProximityDoorController(scene.scene);
  try {
    assert.ok(controller.count > 10);
    for(const level of [3,2,1]) {
      scene.setPackagingLevel(level); scene.scene.updateMatrixWorld(true);
      const leaves=[];scene.packaging.structure.traverse(node=>{if(node.userData.proximityDoor?.enterable===true)leaves.push(node);});
      assert.ok(leaves.length>0,`floor ${level} has proximity-operated passage doors`);
      const leaf=leaves[0],data=leaf.userData.proximityDoor,parent=leaf.parent;
      const fixed=parent.position.clone(), threshold=parent.localToWorld(new THREE.Vector3(...data.trigger));
      for(let frame=0;frame<8;frame++) controller.update(threshold,.1,{autoOpen:true});
      assert.equal(leaf.rotation.y,data.open,`floor ${level} door opens before the pedestrian crosses`);
      assert.ok(parent.position.equals(fixed),'the jambs and passage frame do not swing with the leaf');
      for(let frame=0;frame<16;frame++) controller.update(threshold.clone().add(new THREE.Vector3(20,0,20)),.1,{autoOpen:true});
      assert.equal(leaf.rotation.y,data.closed,`floor ${level} door closes after departure`);
    }
  } finally {controller.dispose();dispose();}
});

test('level switching, optional cargo and part separation affect only the owning floor and selected assembly',async()=>{
  const {scene,dispose}=await harness();
  try{
    for(const level of [3,2,1]){
      scene.setPackagingLevel(level);
      assert.equal(scene.getPackagingLevel(),level);
      for(const item of scene.equipment)assert.equal(scene.objects.get(item.id).visible,item.floorLevel===level);
      for(const [owned,env] of scene.packagingEnvironments)assert.equal(env.deck.visible,owned===level);
      scene.setPackagingCargoVisible(true);assert.equal(scene.packaging.cargo.visible,true);
      scene.setPackagingCargoVisible(false);assert.equal(scene.packaging.cargo.visible,false);
      const selected=scene.equipment.find(i=>i.floorLevel===level);
      scene.select(selected.id);scene.setExplosion(1);scene.amount=1;scene._moveParts();
      for(const part of scene.parts){
        const expected=part.home.clone();if(part.root.userData.equipment===selected.id)expected.add(part.offset);
        assert.ok(part.group.position.distanceTo(expected)<1e-8);
      }
      scene.setExplosion(0);scene.amount=0;scene._moveParts();
      for(const part of scene.parts)assert.ok(part.group.position.distanceTo(part.home)<1e-8);
    }
    scene.select('packaging-main-mixer-1');assert.equal(scene.getPackagingLevel(),3);
    scene.setFloor('all');
    for(const env of scene.packagingEnvironments.values())assert.equal(env.deck.visible,false);
  }finally{dispose();}
});

test('each selected floor has only its adjacent stairs with supported camera height and no floor through the body',async()=>{
  const {scene,dispose}=await harness();
  try{
    for(const level of [1,2,3]){
      scene.setPackagingLevel(level);scene.scene.updateMatrixWorld(true);
      const env=scene.packaging,stair=env.structure.getObjectByName('packaging-building-front-stair');
      assert.ok(stair,`floor ${level} entry stair`);
      const path=PACKAGING_ROOMS[level].path,end=path.findIndex(p=>p[2]<15.2);
      assert.ok(end>0);const surfaces=[env.deck,stair];
      for(let i=0;i<end;i++){
        const a=new THREE.Vector3(...path[i]),b=new THREE.Vector3(...path[i+1]);
        const horizontal=b.clone().sub(a);horizontal.y=0;horizontal.normalize();
        const side=new THREE.Vector3(-horizontal.z,0,horizontal.x);
        for(let n=0;n<=20;n++)for(const offset of [-.25,0,.25]){
          const eye=a.clone().lerp(b,n/20).addScaledVector(side,offset);
          const hit=new THREE.Raycaster(eye,new THREE.Vector3(0,-1,0),.05,3).intersectObjects(surfaces,true)[0];
          assert.ok(hit,`floor ${level} entry segment ${i} lacks support`);
          assert.ok(hit.distance>=1.45&&hit.distance<=1.85,`floor ${level} entry ${i} eye-to-surface ${hit.distance}`);
        }
      }
    }
  }finally{dispose();}
});

test('team 2 whole view stacks the three real floors while layout coordinates remain local',async()=>{
  const {scene,resize,dispose}=await harness();
  try{
    const base=scene.equipment.map(i=>[i.id,[...i.position]]);
    scene.setPackagingLevel('all');
    assert.equal(scene.getPackagingLevel(),'all');
    const points=[];
    for(const item of scene.equipment){
      const root=scene.objects.get(item.id);
      assert.equal(root.visible,true);
      assert.equal(root.position.y,item.position[1]+PACKAGING_FLOOR_ELEVATIONS[item.floorLevel]);
      points.push(...corners(root));
    }
    for(const [level,env]of scene.packagingEnvironments){
      assert.equal(env.deck.visible,true);
      assert.equal(env.deck.position.y,PACKAGING_FLOOR_ELEVATIONS[level]);
      points.push(...corners(env.deck),...corners(env.structure));
    }
    assert.deepEqual(scene.equipment.map(i=>[i.id,[...i.position]]),base,'display elevations must never change saved local Y');
    for(const [w,h]of [[1100,760],[390,520]]){
      resize(w,h);scene.setView('perspective');const camera=settled(scene);
      for(const p of points){const projected=p.clone().project(camera);assert.ok(Math.abs(projected.x)<=1&&Math.abs(projected.y)<=1,`${w}x${h} stacked point outside view ${p.toArray()}`);}
    }
    scene.setPackagingLevel(2);
    for(const item of scene.equipment)assert.equal(scene.objects.get(item.id).position.y,item.position[1]);
    for(const env of scene.packagingEnvironments.values())assert.equal(env.deck.position.y,0);
  }finally{dispose();}
});

test('drawing transfer networks join floor equipment without crossing the walking lane or structural columns', async () => {
  const {scene,dispose}=await harness();
  try {
    for(const level of [1,2,3]){
      scene.setPackagingLevel(level);
      const env=scene.packagingEnvironments.get(level),lines=PACKAGING_ROOMS[level].layout.transportLines||[];
      assert.equal(lines.length,level===1?17:level===2?11:0);
      assert.equal(env.transport.userData.reviewGaps.length,0,`floor ${level} structural conflict: ${JSON.stringify(env.transport.userData.reviewGaps)}`);
      assert.ok(corners(env.transport).every(p=>p.toArray().every(Number.isFinite)));
      for(const line of lines){
        assert.equal(line.direction,'unspecified');
        assert.match(line.source,new RegExp(`floor-${level}-workplace-2025`));
        for(const [x,z]of line.points)assert.ok(x>=-15.675&&x<=15.675&&z>=-15.2&&z<=15.2,line.id);
        for(let n=1;n<line.points.length;n++)assert.ok(line.points[n][0]===line.points[n-1][0]||line.points[n][1]===line.points[n-1][1],line.id);
      }
      scene.scene.updateMatrixWorld(true);
      const obstacles=[env.transport];
      if(level===1)obstacles.push(scene.objects.get('packaging-f1-conveyor-trunk'));
      const path=PACKAGING_ROOMS[level].path;
      for(let n=1;n<path.length;n++){
        const a=path[n-1],b=path[n];
        if(a[1]!==1.65||b[1]!==1.65)continue;
        const direction=new THREE.Vector3(b[0]-a[0],0,b[2]-a[2]).normalize(),side=new THREE.Vector3(-direction.z,0,direction.x);
        for(const y of [.4,.75,1.05])for(const offset of [-.25,0,.25]){
          const from=new THREE.Vector3(a[0],y,a[2]).addScaledVector(side,offset);
          const hit=new THREE.Raycaster(from,direction,.03,Math.hypot(b[0]-a[0],b[2]-a[2])-.03).intersectObjects(obstacles,true)[0];
          assert.ok(!hit,`floor ${level} walking segment ${n-1} crosses transport ${hit?.object.name}`);
        }
      }
    }
    assert.ok(PACKAGING_EQUIPMENT.filter(i=>i.floorLevel===2&&/packaging-(xray|checkweigher|case-sealer)$/.test(i.type)).every(i=>i.rotation===Math.PI/2));
    const trunk=PACKAGING_EQUIPMENT.find(i=>i.id==='packaging-f1-conveyor-trunk');
    assert.ok(trunk.position[0]<PACKAGING_EQUIPMENT.find(i=>i.id==='packaging-f1-robot-5').position[0]);
    assert.ok(trunk.position[2]+trunk.depth/2>14.5);
  }finally{dispose();}
});
