import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../apps/shared/vendor/three.module.js';
import { DRYER_BUILDING_FLOORS, DRYER_BUILDING_REFERENCE } from '../apps/site/dryer-building-data.js';
import { buildDryerBuildingEnvironment } from '../apps/site/dryer-building-envelope.js';

function harness() {
  const labels = [], s = { scene: new THREE.Scene(), geometries: new Set(), materials: new Set(), mat: {},
    _group(parent, position = [0, 0, 0]) { const root = new THREE.Group(); root.position.set(...position); parent.add(root); return root; },
    _material(color, roughness, metalness, extra = {}) { const material = new THREE.MeshStandardMaterial({ color, roughness, metalness, ...extra }); this.materials.add(material); return material; },
    _mesh(geometry, material, parent, position = [0, 0, 0]) { const mesh = new THREE.Mesh(geometry, material); mesh.position.set(...position); parent.add(mesh); this.geometries.add(geometry); return mesh; },
    _groundText(text, position, width, height, parent) { labels.push({ text, position, width, height, parent }); },
  };
  const environments = new Map(Object.values(DRYER_BUILDING_FLOORS).map(spec => [spec.id, buildDryerBuildingEnvironment(s, { floor: spec.id, elevation: spec.elevation, spec })]));
  s.scene.updateMatrixWorld(true);
  return { s, environments, labels, dispose() { s.geometries.forEach(value => value.dispose()); s.materials.forEach(value => value.dispose()); } };
}
const down = (root, x, z, y = 50) => new THREE.Raycaster(new THREE.Vector3(x, y, z), new THREE.Vector3(0, -1, 0), 0, 60).intersectObject(root, true);
const size = root => new THREE.Box3().setFromObject(root).getSize(new THREE.Vector3());
const close = (one, two, label) => assert.ok(Math.abs(one - two) < 1e-5, `${label}: ${one} versus ${two}`);

test('ordinary architectural doorways start closed with independent proximity leaves while elevator doors remain fixed', () => {
  const h=harness();
  try {
    for (const spec of Object.values(DRYER_BUILDING_FLOORS)) {
      const openings=[...(spec.openings||[]),...(spec.partitions||[]).flatMap(wall=>wall.openings||[])];
      const expected=openings.filter(gap=>!['custom','none'].includes(gap.doorKind)&&!(gap.sill>0)).length+1;
      const doors=h.environments.get(spec.id).architectureFixtures.children.filter(node=>node.userData.architecturalDoor);
      assert.equal(doors.length,expected,`${spec.id}F models every ordinary gap and its elevator entrance`);
      for(const door of doors) {
        const bounds=new THREE.Box3().setFromObject(door);
        assert.ok(bounds.getSize(new THREE.Vector3()).y>=door.userData.openingHeight, 'door heads retain the full opening height in cutaway views');
        const names=[];door.traverse(node=>names.push(node.name));
        assert.ok(names.includes('architectural-open-door-leaf')||names.includes('architectural-raised-roller-door')||(door.userData.elevatorLanding&&names.includes('architectural-closed-elevator-doors')), 'elevator landings show closed sliding doors instead of swing leaves');
        const leaves=[];door.traverse(node=>{if(node.userData.proximityDoor)leaves.push(node);});
        if(door.userData.elevatorLanding) assert.equal(leaves.length,0,'lift landing doors do not open simply because someone approaches');
        else {
          assert.ok(leaves.length,'every ordinary passage has moving leaves');
          for(const leaf of leaves) {const data=leaf.userData.proximityDoor;assert.equal((data.kind==='hinge'?leaf.rotation:leaf.position)[data.axis],data.closed);}
        }
      }
    }
  } finally {h.dispose();}
});

test('historical low-wing registration preserves the complete outer dimensions and distinguishes the partial second floor', () => {
  assert.deepEqual(Object.keys(DRYER_BUILDING_FLOORS), ['1', '2', '3', '4', '5']);
  for (const [floor, elevation] of [[1, .3], [2, 3.8], [3, 7.3], [4, 13.3], [5, 20.2]]) assert.equal(DRYER_BUILDING_FLOORS[floor].elevation, elevation);
  for (const floor of [1, 2, 3]) {
    const b = DRYER_BUILDING_FLOORS[floor].bounds;
    close(b.maxX - b.minX, 43, `${floor}F width`); close(b.maxZ - b.minZ, 35, `${floor}F depth`);
    assert.deepEqual([b.minX, b.minZ], [-8.6, -13.4], 'the low wing shares the high tower west/north registration');
  }
  assert.equal(DRYER_BUILDING_FLOORS[2].partialFloor, true);
  assert.ok(DRYER_BUILDING_FLOORS[2].voids.length >= 5);
  assert.ok(DRYER_BUILDING_REFERENCE.limitations.some(text => text.includes('7층 외곽 2배')));
  assert.throws(() => buildDryerBuildingEnvironment({}, { floor: 9 }), RangeError);
});

test('the first-floor mesh covers the missing eastern and southern wings, while the second-floor VOID labels become real openings', () => {
  const h = harness();
  try {
    const one = h.environments.get(1).deck, two = h.environments.get(2).deck;
    close(size(one).x, 43, 'full 1F mesh width'); close(size(one).z, 35, 'full 1F mesh depth');
    assert.ok(down(one, 30, 10).length > 0, 'the original narrow model omitted the east wing');
    assert.ok(down(one, 0, 19).length > 0, 'the south strip extends beyond the tower');
    for (const [x, z] of [[0, -2], [29, -8], [26, 0], [21, 10]]) assert.equal(down(two, x, z).length, 0, `2F VOID at ${x},${z}`);
    for (const [x, z] of [[-8, 0], [15, 10], [0, 20], [28.8, 19.3]]) assert.ok(down(two, x, z).length > 0, `1.5F corridor at ${x},${z}`);
    assert.equal(down(two,31,20).length,0,'the actual entrance stair has an open upper slab instead of a ceiling through its flights');
    assert.equal(down(two,-7.3,-4.5).length,0,'the visible tall packing service deck is not cut by the mezzanine slab');
    const voidArea = DRYER_BUILDING_FLOORS[2].voids.reduce((sum, b) => sum + (b.maxX - b.minX) * (b.maxZ - b.minZ), 0);
    assert.ok(voidArea > 43 * 35 * .55, 'the partial floor must not become a large solid intermediate slab');
  } finally { h.dispose(); }
});

test('the third floor shrinks to the tower and keeps unconfirmed drawing-only cisterns in the reference data', () => {
  const h = harness();
  try {
    const three = h.environments.get(3);
    assert.equal(down(three.deck, 20, 10).length, 0, 'east roof area is not additional interior factory floor');
    assert.ok(down(three.cover, 20, 10).length > 0, 'the low-wing roof remains a separate cover');
    assert.ok(down(three.deck, -6, 5).length > 0);
    const tanks = three.architectureFixtures.children.filter(root => root.userData.type === 'reference-water-tank');
    assert.equal(tanks.length,0,'drawing symbols must not become current physical tanks');
    for (const tank of DRYER_BUILDING_FLOORS[3].archivedDrawingFixtures) {
      assert.equal(tank.historicalOnly,true);assert.equal(tank.currentInstallationConfirmed,false);
      assert.equal(tank.referenceOnly,true);assert.equal(tank.selectableEquipment,false);
    }
    assert.ok(!h.labels.some(label=>label.text==='콤프레샤실'),'an unconfirmed historical room is reference-only');
    assert.equal(down(three.deck,10.3,-10).length,0,'the filmed return stair has a real opening in the 3F bay');
    const [doorX,doorZ]=DRYER_BUILDING_FLOORS[3].routeSurvey.entryFromStair.door;
    assert.ok(down(three.deck,doorX+.35,doorZ).length>0,'the top stair landing joins the reduced 3F slab at the observed return door');
    assert.ok(!h.labels.some(label => /펌프기계실|사장.*대기|용도 미확정|세부명 판독/.test(label.text)), 'uncertain room names cannot be invented');
  } finally { h.dispose(); }
});

test('fourth and fifth floors retain the narrow tower, the aligned northeast bay and the fifth-floor chamber penetration', () => {
  const h = harness();
  try {
    for (const floor of [4, 5]) {
      const env = h.environments.get(floor);
      assert.ok(down(env.deck, 11, -10).length > 0, `${floor}F northeast stair bay is not lost`);
      assert.equal(down(env.deck, 22, 0).length, 0, `${floor}F does not inherit the wide low wing`);
      close(size(env.deck).x, 22, `${floor}F tower plus north bay width`); close(size(env.deck).z, 26.8, `${floor}F depth`);
    }
    assert.equal(down(h.environments.get(5).deck, -1, 7.5).length, 0, 'the lower cone retains a real floor penetration');
    assert.ok(down(h.environments.get(5).deck, -5, 7.5).length > 0);
  } finally { h.dispose(); }
});

test('room names remain legible source labels and low cutaway partitions preserve real door gaps', () => {
  const h = harness();
  try {
    for (const name of ['공장', '원료계량창고', '일일원료보관창고', '조제실', '보일러실', 'CIP·세척 설비실', '사무·소독 준비실', '소독실·에어샤워', '위생 전실·신발장', '화장실','탈의실 · 탈의장','OP실','충전·포장 설비 구역','엘리베이터 · ELEV']) assert.ok(h.labels.some(label => label.text === name), name);
    assert.ok(!h.labels.some(label=>['회의실 및 휴게실','사진 및 액자 진열공간'].includes(label.text)),'the filmed walk replaces superseded historical room-use guesses');
    assert.ok(!h.labels.some(label => label.parent === h.environments.get(1).architectureFixtures && /^(?:공무작업실|공무자재창고|준비실|OP실)$/.test(label.text)), 'superseded historical names cannot misidentify the current first-floor rooms');
    const lowWalls = h.environments.get(1).structure.children.filter(root => root.userData.lowPartition);
    assert.equal(lowWalls.length, DRYER_BUILDING_FLOORS[1].partitions.length);
    const wall = lowWalls[0], opening = wall.userData.wallOpenings[0];
    const normal = new THREE.Vector3(0, 0, 1).transformDirection(wall.matrixWorld);
    const rayAt = offset => {
      const target = wall.localToWorld(new THREE.Vector3(offset, .35, 0));
      return new THREE.Raycaster(target.clone().addScaledVector(normal, 1), normal.clone().negate(), 0, 2).intersectObject(wall, true);
    };
    assert.equal(rayAt(opening.offset).length, 0, 'a door gap remains open in the low partition');
    assert.ok(rayAt(1).length > 0, 'the adjoining low wall still distinguishes the rooms');
    close(size(wall).y, .78, 'low cutaway wall height');
    assert.ok(size(h.environments.get(1).facade).y > 3, 'full walls are independently available for walking views');
  } finally { h.dispose(); }
});

test('elevator/stair axes continue between datums and all real meshes and instances own registered finite resources', () => {
  const h = harness();
  try {
    let instances = 0;
    for (const [floor, env] of h.environments) {
      for (const root of [env.deck, env.structure, env.facade, env.cover, env.architectureFixtures]) {
        assert.equal(root.position.y, DRYER_BUILDING_FLOORS[floor].elevation);
        root.traverse(mesh => {
          if (!mesh.isMesh) return;
          assert.ok(h.s.geometries.has(mesh.geometry)); assert.ok(h.s.materials.has(mesh.material));
          mesh.geometry.computeBoundingBox();
          assert.ok([...mesh.geometry.boundingBox.min.toArray(), ...mesh.geometry.boundingBox.max.toArray()].every(Number.isFinite));
          if (mesh.isInstancedMesh) { instances += mesh.count; assert.ok(mesh.boundingBox && mesh.boundingSphere); }
        });
      }
      const stairs = env.architectureFixtures.children.filter(root => root.userData.stepsRepresentative);
      assert.equal(stairs.length,DRYER_BUILDING_FLOORS[floor].stairs.length,'only the selected physical stair cores are built');
      for (const root of stairs) {
        assert.equal(root.userData.fromY, DRYER_BUILDING_FLOORS[floor].elevation);
        close(root.userData.toY, DRYER_BUILDING_FLOORS[floor].elevation + DRYER_BUILDING_FLOORS[floor].height, 'next stair landing');
      }
    }
    assert.ok(instances >= 100, 'repeated structural columns use instances');
    assert.equal(DRYER_BUILDING_FLOORS[1].cores.elevator, DRYER_BUILDING_FLOORS[5].cores.elevator, 'all levels use the same registered shaft axis');
  } finally { h.dispose(); }
});

test('the filmed upper stair door has real perforations and the two observed flights retain dark nosings',()=>{
  const h=harness();
  try{
    const three=h.environments.get(3),doors=three.architectureFixtures.children.filter(node=>node.userData.observedDoorStyle==='perforated');
    assert.equal(doors.length,1);
    const leaf=doors[0].getObjectByName('architectural-open-door-leaf'),lattice=leaf.getObjectByName('architectural-perforated-door-lattice');
    assert.ok(leaf.userData.observedPerforatedDoor && lattice?.isInstancedMesh);
    const normal=new THREE.Vector3(0,0,1).transformDirection(leaf.matrixWorld);
    const hitsAt=x=>{const p=leaf.localToWorld(new THREE.Vector3(x,.105,0));return new THREE.Raycaster(p.clone().addScaledVector(normal,.5),normal.clone().negate(),0,1).intersectObject(lattice);};
    assert.equal(hitsAt(.105).length,0,'a filmed metal-door hole is open space');
    assert.ok(hitsAt(.07).length>0,'the neighboring metal rib retains real thickness');
    for(const level of [1,2]){
      const nodes=[];h.environments.get(level).architectureFixtures.traverse(node=>{if(node.name==='architectural-stair-nosing')nodes.push(node);});
      assert.equal(nodes.length,20,'each observed two-flight route has a dark strip on its representative treads');
    }
  }finally{h.dispose();}
});

test('the two raised window rows remain genuine openings without filling one another or the sill gap',()=>{
  const h=harness();
  try{
    const spec=DRYER_BUILDING_FLOORS[3],facade=h.environments.get(3).facade;
    for(const opening of spec.routeSurvey.exteriorWindowBands){
      const z=spec.mainBounds.minZ+opening.offset,x=opening.side==='west'?spec.mainBounds.minX:spec.mainBounds.maxX,side=opening.side==='west'?1:-1;
      const hits=y=>new THREE.Raycaster(new THREE.Vector3(x+side*.35,spec.elevation+y,z),new THREE.Vector3(-side,0,0),0,.7).intersectObject(facade,true);
      assert.equal(hits(opening.sill+opening.height/2).length,0,'the actual upper/lower glazing row has no opaque wall behind it');
      assert.ok(hits(.5).length>0,'the solid stainless-protected wall sill remains below the two rows');
      assert.ok(hits(1.97).length>0,'a real wall strip separates the rows');
    }
  }finally{h.dispose();}
});
