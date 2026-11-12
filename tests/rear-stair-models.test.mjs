import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../apps/shared/vendor/three.module.js';
import { buildRearStairDetails, REAR_SURVEY_FEATURE_KINDS } from '../apps/site/rear-stair-models.js';
import { createProximityDoorController } from '../apps/site/proximity-doors.js';
import { REAR_TOWER_SURVEY, REAR_PACKAGING_SURVEY } from '../apps/site/rear-survey-data.js';

function harness() {
  const s = { geometries: new Set(), materials: new Set(), textures: new Set(), parts: [],
    _material(color, roughness, metalness) { const material = new THREE.MeshStandardMaterial({ color, roughness, metalness }); this.materials.add(material); return material; },
    _group(parent, p = [0, 0, 0]) { const object = new THREE.Group(); object.position.set(...p); parent.add(object); return object; },
    _mesh(geometry, material, parent, p = [0, 0, 0]) { this.geometries.add(geometry); const object = new THREE.Mesh(geometry, material); object.position.set(...p); parent.add(object); return object; },
    _part(parent, name) { const object = this._group(parent); this.parts.push({ object, name }); return object; },
  };
  return { s, root: new THREE.Group(), dispose() { s.geometries.forEach(value => value.dispose()); s.materials.forEach(value => value.dispose()); s.textures.forEach(value => value.dispose()); } };
}

test('explicitly enterable rear door fixtures start shut and open only their leaves in automatic mode', () => {
  const h=harness();let controller;
  try {
    buildRearStairDetails(h.s,h.root,{rearSurvey:{features:[{id:'entry',kind:'perforated-pair',enterable:true,width:2,height:2.3,openAngles:[-.9,1.2]},{id:'roll',kind:'twin-shutter',enterable:true,position:[7,0,0],width:3.5,height:3}]}});
    h.root.position.set(21,3.8,-5);h.root.rotation.y=.72;h.root.updateMatrixWorld(true);
    controller=createProximityDoorController(h.root);assert.equal(controller.count,4);
    const frame=h.root.getObjectByName('rear-survey-entry'),fixed=frame.matrixWorld.clone();
    const leaves=frame.children.filter(node=>node.userData.proximityDoor);assert.equal(leaves.length,2);
    for(const leaf of leaves)assert.equal(leaf.rotation.y,0);
    const threshold=frame.localToWorld(new THREE.Vector3(0,.035,0));
    for(let i=0;i<8;i++)controller.update(threshold,.1,{autoOpen:true});
    h.root.updateMatrixWorld(true);assert.ok(frame.matrixWorld.equals(fixed));
    leaves.forEach(leaf=>assert.equal(leaf.rotation.y,leaf.userData.proximityDoor.open));
    for(let i=0;i<18;i++)controller.update(threshold.clone().add(new THREE.Vector3(20,0,20)),.1,{autoOpen:true});
    leaves.forEach(leaf=>assert.equal(leaf.rotation.y,0));
  } finally {controller?.dispose();h.dispose();}
});

test('the separately filmed single glass door, perforated pair and twin shutters retain their physical leaf and guide arrangements', () => {
  const h = harness();
  try {
    const item = { rearSurvey: { features: [
      { id: 'break', kind: 'glazed-entry', width: 1.05, height: 2.2, leafCount: 1, hingeSide: 'right', plateText: '1팀 2파트 휴게실', ramp: { rise: .075, run: .75 }, canopy: { width: 2, depth: 1.1 } },
      { id: 'metal', kind: 'perforated-pair', position: [3, 0, 0], width: 2, height: 2.3 },
      { id: 'materials', kind: 'twin-shutter', position: [7, 0, 0], width: 3.5, height: 3 },
      { id: 'team2', kind: 'glazed-entry', position: [12, 0, 0], width: 2.2, height: 2.3, leafCount: 2, handleLength: .95 },
    ] } }, original = structuredClone(item);
    assert.equal(buildRearStairDetails(h.s, h.root, item), true); h.root.updateMatrixWorld(true);
    const single = h.root.getObjectByName('rear-survey-break'), perforated = h.root.getObjectByName('rear-survey-metal'), pair = h.root.getObjectByName('rear-survey-team2');
    assert.equal(single.userData.actualDoorLeafCount, 1); assert.equal(single.getObjectByName('rear-survey-door-leaf-1').userData.hingeSide, 'right');
    assert.equal(perforated.userData.actualDoorLeafCount, 2); assert.equal(pair.userData.actualDoorLeafCount, 2);
    assert.equal(h.root.getObjectByName('rear-survey-materials').userData.actualShutterCount, 2);
    const perforation = perforated.getObjectByName('rear-survey-perforated-door-through-hole-lattice');
    const hole = perforation.parent.localToWorld(new THREE.Vector3(.54, .0975, 0));
    assert.equal(new THREE.Raycaster(new THREE.Vector3(hole.x, hole.y, hole.z + 1), new THREE.Vector3(0, 0, -1)).intersectObject(perforation).length, 0, 'perforations are actual openings in a metal lattice');
    const ramp = single.getObjectByName('rear-survey-real-sloped-concrete-door-apron');
    const hitY = z => new THREE.Raycaster(new THREE.Vector3(0, 1, z), new THREE.Vector3(0, -1, 0)).intersectObject(ramp)[0]?.point.y;
    assert.ok(hitY(.1) > hitY(.6), 'the concrete apron rises continuously toward the door, without a floating rectangular step');
    assert.equal(h.root.userData.unseenRearStairFlightsAdded, false);
    assert.deepEqual(item, original);
  } finally { h.dispose(); }
});

test('wall seams stop at real window and door openings while filmed glazing and high canopy bays remain exterior details', () => {
  const h = harness();
  try {
    const features = [
      { id: 'wall', kind: 'panel-wall', width: 6, height: 13.3, openings: [{ x: -1.5, y: 1.2, width: 1.3, height: 2.4 }, { x: 1.5, y: 6.8, width: 2, height: 10 }] },
      { id: 'glass', kind: 'vertical-glazing', position: [7, .8, 0], width: 2.7, height: 11.5, divisions: 9, ventBands: [.04, .37, .7] },
      { id: 'shutters', kind: 'stacked-shutter-bay', position: [12, 0, 0], width: 5.8, levels: [{ y: 7.3, height: 2.4 }, { y: 13.3, height: 2.4 }] },
    ];
    assert.equal(buildRearStairDetails(h.s, h.root, { rearSurvey: { features } }), true); h.root.updateMatrixWorld(true);
    const wall = h.root.getObjectByName('rear-survey-wall');
    for (const [x, y] of [[-1.5, 1.2], [1.5, 6.8]]) assert.equal(new THREE.Raycaster(new THREE.Vector3(x, y, 2), new THREE.Vector3(0, 0, -1)).intersectObject(wall, true).length, 0);
    assert.ok(new THREE.Raycaster(new THREE.Vector3(-2.7, 5, 2), new THREE.Vector3(0, 0, -1)).intersectObject(wall, true).length);
    const vents = []; h.root.getObjectByName('rear-survey-glass').traverse(object => { if (object.name === 'rear-survey-narrow-sliding-vent-band') vents.push(object); }); assert.equal(vents.length, 3);
    const canopies = []; h.root.getObjectByName('rear-survey-shutters').traverse(object => { if (object.name === 'rear-survey-observed-entrance-canopy') canopies.push(object); }); assert.equal(canopies.length, 2);
    const closedHousing = new THREE.Group(); buildRearStairDetails(h.s, closedHousing, { rearSurvey: { features: [{ kind: 'utility-housing' }] } });
    assert.equal(closedHousing.getObjectByName('rear-survey-utility-housing').userData.openWashBasinAdded, false);
  } finally { h.dispose(); }
});

test('the packaging rear bank has only explicitly cataloged units and an open supporting frame with a caged ladder', () => {
  const h = harness();
  try {
    const upperUnits = [0, 1, 2, 3, 4].map((i) => ({ id: `u${i}`, x: (i - 2) * 1.7 })), groundUnits = Array.from({ length: 8 }, (_, i) => ({ id: `g${i}`, x: (i - 3.5) * 1.15, width: 1.05, fanCount: 2 })), wallUnits = [-.5, .5].map((x, i) => ({ id: `w${i}`, x, y: 1.5, z: -.45 }));
    assert.equal(buildRearStairDetails(h.s, h.root, { rearSurvey: { features: [{ id: 'rack', kind: 'steel-hvac-platform', width: 10, depth: 1.5, elevation: 4.1, upperUnits, groundUnits, wallUnits, ladder: { x: 4.5 } }, { id: 'hood', kind: 'wall-hood', position: [4, 4.2, -1] }] } }), true);
    const rack = h.root.getObjectByName('rear-survey-rack'), identities = [];
    rack.traverse(object => { if (object.userData.observedHvacId) identities.push(object.userData.observedHvacId); });
    assert.equal(identities.length, 15); assert.equal(new Set(identities).size, 15); assert.equal(h.root.userData.rearSurveyHvacCount, 15);
    assert.equal(rack.userData.distinctFromLiquidOutdoorEquipment, true);
    for (const id of ['w0', 'w1']) {
      const unit = rack.getObjectByName(`rear-survey-hvac-wall-${id}`), guards = []; unit.traverse(object => { if (object.name === 'rear-survey-static-fan-wire-guard') guards.push(object); });
      assert.equal(unit.userData.observedFrontFanCount, 2); assert.equal(guards.length, 2); assert.notEqual(guards[0].position.y, guards[1].position.y, 'the two small wall units each have two vertically stacked front fans');
    }
    assert.equal(rack.getObjectByName('rear-survey-platform-access-ladder').userData.accessLadderNotStairFlight, true);
    assert.ok(rack.getObjectByName('rear-survey-platform-i-columns-and-floor-joists'));
    assert.ok(h.root.getObjectByName('rear-survey-hood').getObjectByName('rear-survey-open-dark-hood-mouth'));
    const bounds = new THREE.Box3().setFromObject(h.root); assert.ok([...bounds.min.toArray(), ...bounds.max.toArray()].every(Number.isFinite)); assert.ok(bounds.min.y >= -.001 && bounds.max.y < 6.5);
    h.root.traverse(object => { if (object.geometry) assert.ok(h.s.geometries.has(object.geometry), 'all small-repeat and fan-wire geometries are owned for disposal'); });
    const empty = new THREE.Group(); buildRearStairDetails(h.s, empty, { rearSurvey: { features: [{ kind: 'steel-hvac-platform', ladder: false }] } }); assert.equal(empty.userData.rearSurveyHvacCount, 0, 'a frame never invents unlisted machines');
  } finally { h.dispose(); }
});

test('the additive facade builder preserves pre-existing part ownership and works without a DOM canvas', () => {
  const previous = globalThis.document, h = harness();
  try {
    globalThis.document = {};
    const parts = [0, 1, 2].map(() => h.s._group(h.root)), before = h.s.parts.length;
    assert.equal(buildRearStairDetails(h.s, h.root, { rearSurvey: { features: [{ kind: 'glazed-entry', plateText: '1팀 2파트 휴게실', leafCount: 1 }] } }), true);
    assert.equal(h.s.parts.length, before); assert.equal(parts[2].getObjectByName('campus-new-rear-survey-details').parent, parts[2]);
    assert.ok(REAR_SURVEY_FEATURE_KINDS.includes('utility-housing'));
    for (const item of [{}, { rearSurvey: { features: [{ kind: 'unknown-stair-flights' }] } }]) { const root = new THREE.Group(); assert.equal(buildRearStairDetails(h.s, root, item), false); assert.equal(root.children.length, 0); }
  } finally { if (previous === undefined) delete globalThis.document; else globalThis.document = previous; h.dispose(); }
});

function worldBoxes(root) {
  const boxes=[],instance=new THREE.Matrix4();root.updateWorldMatrix(true,true);
  root.traverse(node=>{
    if(!node.isMesh)return;
    node.geometry.computeBoundingBox();
    const add=matrix=>boxes.push({node,bounds:node.geometry.boundingBox.clone().applyMatrix4(matrix)});
    if(node.isInstancedMesh)for(let i=0;i<node.count;i++){node.getMatrixAt(i,instance);add(node.matrixWorld.clone().multiply(instance));}
    else add(node.matrixWorld);
  });
  return boxes;
}
const intersectsVolume=(bounds,volume)=>['x','y','z'].every(axis=>Math.min(bounds.max[axis],volume.max[axis])-Math.max(bounds.min[axis],volume.min[axis])>.008);

test('rear canopy condensers rest on the roof and freight header controls sit on the outside wall face',()=>{
  const h=harness();
  try {
    buildRearStairDetails(h.s,h.root,{rearSurvey:REAR_TOWER_SURVEY});h.root.updateMatrixWorld(true);
    for(const [doorId,unitId]of [['rear-unmarked-glass-pair','rear-elevator-roof-condenser'],['rear-breakroom-single-door','rear-breakroom-roof-condenser']]) {
      const canopy=h.root.getObjectByName(`rear-survey-${doorId}`).getObjectByName('rear-survey-observed-entrance-canopy');
      const roof=new THREE.Box3().setFromObject(canopy),feet=[];
      h.root.getObjectByName(`rear-survey-${unitId}`).traverse(node=>{if(node.name==='rear-survey-condenser-support-foot')feet.push(new THREE.Box3().setFromObject(node));});
      assert.equal(feet.length,4);
      for(const foot of feet)assert.ok(Math.abs(foot.min.y-roof.max.y)<1e-5,'condenser feet sit on the canopy finish instead of sinking into it');
    }
    const freight=h.root.getObjectByName('rear-survey-rear-unmarked-glass-pair');
    for(const name of ['freight-door-air-curtain','freight-call-button-panel','freight-upper-control-box']) {
      const bounds=new THREE.Box3().setFromObject(freight.getObjectByName(`rear-survey-${name}`));
      assert.ok(bounds.max.z<=-17+1e-5,'the rear face stays outside the registered annex wall');
      assert.ok(-17-bounds.max.z<.025,'wall-mounted hardware cannot float twenty centimetres away from the wall');
    }
  } finally {h.dispose();}
});

test('the yellow doorway approach is clear of insulated mains, housing and impact guards',()=>{
  const h=harness();
  try {
    buildRearStairDetails(h.s,h.root,{rearSurvey:REAR_TOWER_SURVEY});h.root.updateMatrixWorld(true);
    const approach=new THREE.Box3(new THREE.Vector3(-6.1,.12,-18.9),new THREE.Vector3(-3.9,2.45,-17.27));
    for(const id of ['rear-two-insulated-mains','rear-closed-stainless-housing','rear-wall-protection-and-drains']) {
      const overlaps=worldBoxes(h.root.getObjectByName(`rear-survey-${id}`)).filter(({bounds})=>intersectsVolume(bounds,approach));
      assert.equal(overlaps.length,0,`${id} must stay beside the yellow door rather than across it`);
    }
    const mains=new THREE.Box3().setFromObject(h.root.getObjectByName('rear-survey-rear-two-insulated-mains'));
    const housing=new THREE.Box3().setFromObject(h.root.getObjectByName('rear-survey-rear-closed-stainless-housing'));
    assert.ok(housing.min.x-mains.max.x>.2,'the two photographed utility assemblies no longer occupy one another');
    const guard=h.root.getObjectByName('rear-survey-rear-wall-protection-and-drains').getObjectByName('rear-survey-observed-low-wall-impact-guards');
    assert.equal(worldBoxes(guard).filter(({bounds})=>intersectsVolume(bounds,housing)).length,0,'wall guards end beside the closed housing');
    const vent=new THREE.Box3().setFromObject(h.root.getObjectByName('rear-survey-observed-utility-housing-top-elbow'));
    assert.ok(vent.max.z<-17.005,'the housing elbow stops before the wall instead of disappearing into it');
  } finally {h.dispose();}
});

test('the Team-2 porch supports its canopy while wall condensers have brackets and the upper window remains unpierced',()=>{
  const h=harness();
  try {
    buildRearStairDetails(h.s,h.root,{rearSurvey:REAR_PACKAGING_SURVEY});h.root.updateMatrixWorld(true);
    const entry=h.root.getObjectByName('rear-survey-team2-stair-glass-entry');
    const canopy=new THREE.Box3().setFromObject(entry.getObjectByName('rear-survey-observed-entrance-canopy').children[0]);
    const jambs=[];entry.traverse(node=>{if(node.name==='rear-survey-porch-projecting-side-jamb')jambs.push(node);});
    assert.equal(jambs.length,2);
    for(const jamb of jambs)assert.ok(Math.abs(new THREE.Box3().setFromObject(jamb).max.y-canopy.min.y)<1e-6,'porch side supports reach the canopy underside');
    const lintel=new THREE.Box3().setFromObject(entry.getObjectByName('rear-survey-porch-canopy-supporting-lintel'));
    assert.ok(lintel.min.y>=2.7-1e-6,'the supported canopy retains full doorway headroom');
    for(const id of ['wall-1','wall-2']) {
      const unit=h.root.getObjectByName(`rear-survey-hvac-wall-${id}`);
      assert.ok(unit.getObjectByName('rear-survey-wall-condenser-support-brackets'));
      assert.ok(Math.abs(unit.userData.wallStandoff-.12)<1e-6,'the wall-mounted case has a 120mm gap and explicit steel supports');
      assert.equal(unit.getObjectByName('rear-survey-condenser-support-foot'),undefined,'wall condensers do not carry ground pads in midair');
    }
    const hood=h.root.getObjectByName('rear-survey-rear-open-square-exhaust-hood');
    const cover=new THREE.Box3().setFromObject(hood.getObjectByName('rear-survey-observed-tall-rectangular-exhaust-riser'));
    const upper=new THREE.Box3().setFromObject(h.root.getObjectByName('rear-survey-packaging-rear-upper-window-band'));
    assert.ok(upper.min.y-cover.max.y>=.1-1e-6,'the separately observed lower cover stops below the upper window');
    assert.equal(hood.userData.riserConnectedToHoodConfirmed,false,'the window is not replaced by an invented continuous duct connection');
    const pier=h.root.getObjectByName('rear-survey-window-band-opaque-service-pier');
    assert.ok(pier,'the middle window is split beside the photographed vertical service cover');
    const pierBounds=new THREE.Box3().setFromObject(pier),coverCenter=cover.getCenter(new THREE.Vector3());
    assert.ok(Math.abs(pierBounds.getCenter(new THREE.Vector3()).x-coverCenter.x)<1e-6,'the rear-facing window group must reverse the local pier offset to align with the actual cover');
    const middle=h.root.getObjectByName('rear-survey-packaging-rear-mid-window-band'),panes=[];
    middle.traverse(node=>{if(node.name==='rear-survey-fixed-exterior-glass')panes.push(node);});
    const glassHits=x=>new THREE.Raycaster(new THREE.Vector3(x,7.6,-2),new THREE.Vector3(0,0,1),0,3).intersectObjects(panes,false);
    assert.equal(glassHits(coverCenter.x).length,0,'the service-pier strip cannot contain a hidden glass sheet');
    for(const side of [-1,1])assert.ok(glassHits(coverCenter.x+side*.6).length>0,'both adjacent window sections retain glazing');
    const rain=h.root.getObjectByName('rear-survey-packaging-rear-rain-pipe');
    const run=new THREE.Box3().setFromObject(rain.getObjectByName('rear-survey-downpipe-visible-run'));
    assert.ok(run.max.z<-.24,'the pipe body sits outside both glazing and projecting window frames');
    const clips=new THREE.Box3().setFromObject(rain.getObjectByName('rear-survey-downpipe-wall-clips'));
    assert.ok(Math.abs(clips.max.z)<1e-6,'standoff clips reach the actual wall instead of leaving the pipe floating');
  } finally {h.dispose();}
});
