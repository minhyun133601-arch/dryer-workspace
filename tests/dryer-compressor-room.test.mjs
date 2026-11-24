import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../apps/shared/vendor/three.module.js';
import { DRYER_BUILDING_FLOORS } from '../apps/site/dryer-building-data.js';
import { buildDryerBuildingEnvironment, alignDryerCompressorEntrance } from '../apps/site/dryer-building-envelope.js';
import { buildDryerRouteEnvironment } from '../apps/site/dryer-route-environment.js';
import { buildDryerCompressorEnvironment } from '../apps/site/dryer-compressor-environment.js';
import { buildDryerCompressorInteriorDetails } from '../apps/site/dryer-compressor-interior-details.js';

function fixture() {
  const labels = [];
  const s = {
    scene: new THREE.Scene(), geometries: new Set(), materials: new Set(), textures: new Set(),
    _group(parent, p = [0, 0, 0]) { const node = new THREE.Group(); node.position.set(...p); parent.add(node); return node; },
    _material(color, roughness = .7, metalness = .1, extra = {}) { const mat = new THREE.MeshStandardMaterial({ color, roughness, metalness, ...extra }); this.materials.add(mat); return mat; },
    _mesh(geometry, material, parent, p = [0, 0, 0]) { this.geometries.add(geometry); const node = new THREE.Mesh(geometry, material); node.position.set(...p); parent.add(node); return node; },
    _groundText(text, position, width, height, parent) { labels.push({ text, position, width, height, parent }); },
  };
  const spec = DRYER_BUILDING_FLOORS[3];
  const env = buildDryerBuildingEnvironment(s, { floor: 3, elevation: spec.elevation, spec });
  buildDryerRouteEnvironment(s, env, spec);
  buildDryerCompressorEnvironment(s, env, spec);
  alignDryerCompressorEntrance(env);
  s.scene.updateMatrixWorld(true);
  return { s, spec, env, labels, dispose() { for (const set of [s.geometries, s.materials, s.textures]) for (const r of set) r.dispose(); } };
}

const ray = (origin, dir, objects, far = 2) => new THREE.Raycaster(new THREE.Vector3(...origin), new THREE.Vector3(...dir), 0, far).intersectObjects(objects, true);

test('compressor room refit preserves the clear aisle, measured envelopes and south-facing service ends', () => {
  const h=fixture();
  try {
    buildDryerCompressorInteriorDetails(h.s,h.env,h.spec);
    h.s.scene.updateMatrixWorld(true);
    const room=h.env.architectureFixtures.getObjectByName('dryer-compressor-3-room');
    const cases=[
      [1,'comp-unit-1-kaeser-csd125sfc',[2.11,1.95,1.29]],
      [2,'comp-unit-2-kaeser-bsd72',[1.53,1.70,1.005]],
      [3,'comp-unit-3-kaeser-csd125',[1.76,1.90,1.11]],
    ];
    for(const [number,id,[w,h,d]] of cases) {
      const unit=room.getObjectByName(id),end=unit.getObjectByName('survey-south-cabinet-end-'+number);
      const direction=end.getWorldDirection(new THREE.Vector3());
      assert.ok(direction.z>.9999,'service and equipment-card end faces the filmed approach from the south');
      const dims=unit.userData.cabinetDimensions;
      assert.deepEqual([dims.width,dims.height,dims.depth],[w,h,d]);
      const box=new THREE.Box3().setFromObject(unit.getObjectByName(id+'-base'));
      assert.ok(Math.abs((box.max.z-box.min.z)-w)<1e-5 && Math.abs((box.max.x-box.min.x)-d)<1e-5);
    }
    const shell=room.getObjectByName('comp-receiver-2-shell');
    const receiverBounds=new THREE.Box3().setFromObject(shell);
    assert.ok(Math.abs(receiverBounds.max.x-receiverBounds.min.x-1.13)<.001);
    const tank=room.getObjectByName('comp-receiver-2'), measured=tank.userData.vesselDimensions;
    assert.deepEqual([measured.diameter,measured.height],[1.13,2.298]);
    const jac=room.getObjectByName('jac100-body');
    assert.deepEqual(jac.scale.toArray(),[.42,1.015,1.62]);
    assert.equal(room.getObjectByName('jac100-top-run').visible,false,'separate photographed aftercooler pipes have no synthetic bridge');
    const hx=room.getObjectByName('comp-dryer-hx601k');
    const hxBody=new THREE.Box3().setFromObject(hx.getObjectByName('hx601-body'));
    const observed=(actual,expected)=>assert.ok(Math.abs(actual-expected)<.001,`${actual} versus ${expected} m`);
    observed(hxBody.max.x-hxBody.min.x,1.321);
    observed(hxBody.max.z-hxBody.min.z,.543);
    observed(hxBody.max.y-h.spec.elevation,.811);
    const blue=h.env.architectureFixtures.getObjectByName('comp-dryer-spx-blue');
    const towers=new THREE.Box3();
    for(const node of blue.children.filter(n=>n.name==='spx-blue-tower')) towers.expandByObject(node);
    observed(towers.max.z-towers.min.z,.890);
    observed(blue.getObjectByName('spx-blue-foot').scale.x,.80);
    observed(new THREE.Box3().setFromObject(blue).max.y-h.spec.elevation,2.085);
    const topFan=room.getObjectByName('dark-dryer-top-fan');
    const dryerCabinet=new THREE.Box3().setFromObject(room.getObjectByName('dark-dryer-body'));
    observed(dryerCabinet.max.z-dryerCabinet.min.z,.60);
    observed(dryerCabinet.max.x-dryerCabinet.min.x,1.28);
    const fanBounds=new THREE.Box3().setFromObject(topFan);
    assert.ok(fanBounds.min.x>dryerCabinet.min.x && fanBounds.max.x<dryerCabinet.getCenter(new THREE.Vector3()).x,'fan sits over the front half of the cabinet');
    const water=room.getObjectByName('wtank-stainless-body');
    assert.deepEqual(water.scale.toArray(),[1,1.48,2.10]);
    const intake=new THREE.Box3().setFromObject(room.getObjectByName('wpump-suction'));
    assert.ok(intake.intersectsBox(new THREE.Box3().setFromObject(water)),'suction still enters the resized tank end');
    for(const id of ['comp-unit-1-kaeser-csd125sfc-base','jac100-body']) {
      assert.equal(receiverBounds.intersectsBox(new THREE.Box3().setFromObject(room.getObjectByName(id))),false);
    }
    const aisle=new THREE.Box3(new THREE.Vector3(16.10,h.spec.elevation+.08,-11.8),new THREE.Vector3(17.5,h.spec.elevation+1.96,-3.7));
    for(const id of ['comp-receiver-2','comp-receiver-1','comp-aftercooler-jac100','comp-dryer-hx601k',
      'comp-dryer-spx-blue','comp-dryer-jemaco-dark','comp-water-tank-pump',...cases.map(row=>row[1])])
      assert.equal(aisle.intersectsBox(new THREE.Box3().setFromObject(room.getObjectByName(id))),false,id);
    const duct=room.getObjectByName('survey-north-galvanized-ductwork');
    assert.ok(new THREE.Box3().setFromObject(duct).min.y>h.spec.elevation+2.6);
    const count=room.children.length;
    buildDryerCompressorInteriorDetails(h.s,h.env,h.spec);
    assert.equal(room.children.length,count);
  } finally { h.dispose(); }
});

test('3F hall, stair landing, roof and compressor room have separate wall openings and operable doors', () => {
  const h = fixture();
  try {
    const y = h.spec.elevation + 1.2;
    for (const [doorId, origin, dir] of [
      ['third-ne-stair-door', [8.1, y, -8.6], [1, 0, 0]],
      ['third-ne-roof-door', [9.35, y, -7.2], [0, 0, 1]],
      ['compressor-room-south', [16.85, y, -2.9], [0, 0, -1]],
    ]) {
      const door = h.env.architectureFixtures.children.find(n => n.userData.doorId === doorId);
      assert.ok(door, `${doorId} exists`);
      const leaves = door.children.filter(n => n.userData.proximityDoor);
      assert.ok(leaves.length >= 1 && leaves.every(l => l.userData.proximityDoor.enterable), `${doorId} has enterable proximity leaf`);
      assert.equal(ray(origin, dir, [h.env.facade, h.env.structure], 1).length, 0, `${doorId} cuts cleanly through wall layers`);
    }
    const stairGroup = h.env.architectureFixtures.getObjectByName('dryer-compressor-3-stair');
    assert.ok(stairGroup.getObjectByName('third-elevator-button-cabinet'));
    assert.ok(stairGroup.getObjectByName('ne-stair-hydrant-cabinet'));
    assert.ok(stairGroup.getObjectByName('ne-stair-north-window'));
  } finally { h.dispose(); }
});

test('the service doors match the filmed hands, swing, finish and compressor-room sign', () => {
  const h=fixture();
  try {
    const door = id => h.env.architectureFixtures.children.find(node=>node.userData.doorId===id);
    const hall=door('third-ne-stair-door'), roof=door('third-ne-roof-door'), room=door('compressor-room-south');
    const leaf=frame=>frame.getObjectByName('architectural-open-door-leaf');
    const hallLeaf=leaf(hall), roofLeaf=leaf(roof), roomLeaf=leaf(room);
    const world=object=>object.getWorldPosition(new THREE.Vector3());
    const hallKnob=hallLeaf.getObjectByName('service-door-round-knob');
    assert.ok(world(hallKnob).z<world(hallLeaf).z,'left-hand knob as seen from hall');
    hallLeaf.rotation.y=hallLeaf.userData.proximityDoor.open;
    assert.ok(world(hallKnob).x>world(hall).x+.6,'hall door swings into stairwell');
    const pattern=roofLeaf.getObjectByName('roof-door-exterior-square-pattern');
    assert.ok(pattern?.isInstancedMesh);
    const solid=roofLeaf.getObjectByName('filmed-solid-door-skin');
    assert.ok(ray([9.35,h.spec.elevation+1.1,-7.2],[0,0,1],[solid],1).length,'indoor face is opaque behind the pattern');
    roofLeaf.rotation.y=roofLeaf.userData.proximityDoor.open;
    assert.ok(world(roofLeaf.getObjectByName('service-door-round-knob')).z>world(roof).z+.6);
    const sign=room.getObjectByName('compressor-door-sign'), fixed=room.getObjectByName('architectural-fixed-door-leaf');
    assert.equal(sign.parent,fixed); assert.ok(world(sign).x<world(room).x);
    const before=world(sign);
    roomLeaf.rotation.y=roomLeaf.userData.proximityDoor.open;
    assert.ok(world(roomLeaf.getObjectByName('service-door-round-knob')).z>world(room).z+.6,'east leaf opens onto roof');
    h.s.scene.updateMatrixWorld(true);
    assert.deepEqual(world(sign).toArray(),before.toArray());
    assert.equal(roomLeaf.userData.proximityDoor.width,.95);
    assert.equal(room.children.filter(c=>c.userData.proximityDoor).length,1);
    const floorY=h.spec.elevation;
    assert.ok(ray([16.35,floorY+1.2,-2.95],[0,0,-1],[fixed],1).length,'signed leaf is still a physical barrier');
    assert.equal(ray([17.31,floorY+1.2,-2.95],[0,0,-1],[room],1).length,0,'right half is the open passage');
  } finally {h.dispose();}
});

test('at the north stair window the upper landing turns right into an open descending flight', () => {
  const h=fixture();
  try {
    const stair=h.env.architectureFixtures.getObjectByName('dryer-compressor-3-stair');
    const treads=stair.children.filter(n=>n.name==='ne-stair-desc-tread');
    const y=h.spec.elevation;
    assert.equal(treads.length,8);
    const left=ray([9.4,y+1.65,-12.55],[0,-1,0],[h.env.deck]);
    assert.ok(left.length && Math.abs(left[0].point.y-y)<.01,'level corridor leads directly up to north window');
    const glass=stair.getObjectByName('ne-win-glass');
    assert.ok(ray([9.4,y+1.65,-12.52],[0,0,-1],[glass]).length,'window ahead of visitor');
    for (const [i,tread] of treads.entries()) {
      const p=tread.getWorldPosition(new THREE.Vector3());
      const down=ray([p.x,y+1.65,p.z],[0,-1,0],[h.env.deck,stair],4);
      assert.ok(down.length && down[0].point.y < y-.10-i*.17,'slab does not cover the descending tread');
      if(i) assert.ok(p.x>treads[i-1].getWorldPosition(new THREE.Vector3()).x);
    }
    const count=stair.children.length;
    alignDryerCompressorEntrance(h.env);
    assert.equal(stair.children.length,count,'survey alignment can be called again');
  } finally {h.dispose();}
});

test('returning along the roof, the recess window faces east and the sheet-metal wall meets the sloping eave', () => {
  const h = fixture();
  try {
    const y = h.spec.elevation;
    const window = h.env.facade.getObjectByName('ne-roof-recess-window');
    const joints = h.env.facade.getObjectByName('roof-recess-cladding-seams');
    const endWalls = h.env.facade.children.filter(node => node.name === 'compressor-sloping-end-wall');
    assert.ok(ray([9.4,y+1.56,-4.98],[-1,0,0],[window],1.5).length, 'glazing faces the roof recess');
    assert.equal(endWalls.length, 2);
    assert.ok(ray([13.85,y+4.05,-2.8],[0,0,-1],endWalls,1).length, 'wall fills beneath the high end of the roof');
    assert.equal(ray([21.6,y+4.05,-2.8],[0,0,-1],endWalls,1).length, 0, 'wall follows the slope on the low end');
    assert.ok(joints.isInstancedMesh);
    assert.equal(ray([9.35,y+1.15,-5.95],[0,0,-1],[joints],1).length, 0, 'wall joints stop at the roof door');
  } finally { h.dispose(); }
});

test('3F outdoor green roof models the baghouse dust collector, GIHO FANTECH blower, exhaust stack, and 5 condensers', () => {
  const h = fixture();
  try {
    const roof = h.env.architectureFixtures.getObjectByName('dryer-compressor-3-roof');
    assert.ok(roof);
    const dust = roof.getObjectByName('roof-baghouse-and-stack');
    assert.ok(dust, 'baghouse dust collector assembly exists');
    assert.equal(dust.userData.airflowM3PerMinute, 300, 'photo 009 blower nameplate');
    for (const part of [
      'baghouse-pyramidal-hopper', 'baghouse-housing', 'baghouse-tower-intake-duct',
      'baghouse-clean-air-duct', 'blower-yellow-motor', 'blower-yellow-belt-guard',
      'exhaust-stack-silencer', 'exhaust-stack-top-bend',
    ]) assert.ok(dust.getObjectByName(part), `baghouse part ${part} present`);
    const dustBox = new THREE.Box3().setFromObject(dust);
    assert.ok(dustBox.min.x >= 8.5 && dustBox.max.x <= 13.0, 'baghouse stays outside tower east wall and clear of compressor path');
    assert.ok(dustBox.max.y > h.spec.elevation + 10, 'exhaust stack reaches observed full height');
    for (const id of [
      'roof-century-alcove-north', 'roof-century-alcove-east-1', 'roof-century-alcove-east-2',
      'roof-century-compressor-sw', 'roof-vcoil-condenser',
    ]) assert.ok(roof.getObjectByName(id), `outdoor unit ${id} present`);
    const outdoorBoxes = roof.children.filter(node=>node.name.startsWith('roof-century-')).map(node=>{
      assert.equal(node.children.filter(child=>child.name.endsWith('-fan-hub')).length,2);
      assert.deepEqual(node.getObjectByName(node.name+'-body').scale.toArray(),[1.42,1.06,.70]);
      return new THREE.Box3().setFromObject(node);
    });
    assert.equal(outdoorBoxes.length,4);
    for(const [i,box] of outdoorBoxes.entries()) {
      assert.ok(outdoorBoxes.slice(i+1).every(other=>!other.intersectsBox(box)),'installed outdoor cabinets stay separate');
    }
    const vCoil=roof.getObjectByName('roof-vcoil-condenser');
    assert.equal(vCoil.children.filter(node=>node.name==='vcoil-green-curb').length,4);
    const condenserBounds=new THREE.Box3().setFromObject(vCoil);
    assert.ok(condenserBounds.min.z> -3.4 && condenserBounds.max.z> -.6,'deep condenser projects forward from the facade');
    assert.ok(condenserBounds.min.x>17.8,'door swing clears the condenser and its pads');
  } finally { h.dispose(); }
});

test('3F air compressor room models all 13 confirmed units inside A-015 bounds with clear central aisle and registered resources', () => {
  const h = fixture();
  try {
    const room = h.env.architectureFixtures.getObjectByName('dryer-compressor-3-room');
    assert.ok(room);
    const unitIds = [
      'comp-dryer-spx-blue', 'comp-oil-water-separator', 'comp-dryer-ps600k', 'comp-dryer-hx601k',
      'comp-aftercooler-jac100', 'comp-receiver-2', 'comp-unit-1-kaeser-csd125sfc',
      'comp-dryer-jemaco-dark', 'comp-receiver-1', 'comp-unit-3-kaeser-csd125',
      'comp-unit-2-kaeser-bsd72', 'comp-chiller-bumyang', 'comp-water-tank-pump', 'comp-unit-4-k2power-k50',
    ];
    const bounds = h.spec.rooms.find(r => r.id === 'compressor-room').bounds;
    const aisle = new THREE.Box3(
      new THREE.Vector3(16.1, h.spec.elevation + .15, -12.0),
      new THREE.Vector3(17.5, h.spec.elevation + 2.0, -3.55),
    );
    for (const id of unitIds) {
      const node = room.getObjectByName(id);
      assert.ok(node, `${id} present`);
      const box = new THREE.Box3().setFromObject(node);
      assert.ok(box.min.x >= bounds.minX - .05 && box.max.x <= bounds.maxX + .05, `${id} X inside compressor room`);
      assert.ok(box.min.z >= bounds.minZ - .05 && box.max.z <= bounds.maxZ + .05, `${id} Z inside compressor room`);
      assert.ok(box.min.y >= h.spec.elevation - .01, `${id} grounded on 3F slab`);
      assert.equal(box.intersectsBox(aisle), false, `${id} keeps central walking aisle unobstructed`);
    }
    for (const root of [h.env.architectureFixtures, h.env.facade, h.env.cover, h.env.deck]) {
      root.traverse(node => {
        if (!node.isMesh) return;
        assert.ok(h.s.geometries.has(node.geometry), `registered geometry: ${node.name}`);
        assert.ok(h.s.materials.has(node.material), `registered material: ${node.name}`);
      });
    }
    // Calling builder twice stays idempotent
    const count = h.env.architectureFixtures.children.length;
    buildDryerCompressorEnvironment(h.s, h.env, h.spec);
    assert.equal(h.env.architectureFixtures.children.length, count);
  } finally { h.dispose(); }
});
