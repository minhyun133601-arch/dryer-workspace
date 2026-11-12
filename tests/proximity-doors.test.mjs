import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import * as THREE from '../apps/shared/vendor/three.module.js';
import { createProximityDoorController, PROXIMITY_DOOR_RULES } from '../apps/site/proximity-doors.js';

function leaf(parent, options = {}) {
  const object = new THREE.Group(); parent.add(object);
  object.userData.proximityDoor = { kind: 'hinge', axis: 'y', closed: 0, open: Math.PI / 2,
    enterable: true, trigger: [0, 0, 0], width: 1, height: 2.2, ...options };
  object.rotation.y = .7;
  return object;
}
const advance = (controller, position, seconds = 1.5, options) => {
  for (let i = 0; i < Math.ceil(seconds * 60); i++) controller.update(position, 1 / 60, { autoOpen:true,...options });
};
const near = (actual, expected) => assert.ok(Math.abs(actual - expected) < 1e-8, `${actual} != ${expected}`);

test('a transverse curtain exposes its actual transformed threshold plane instead of a perpendicular phantom barrier', () => {
  const root=new THREE.Group(),frame=new THREE.Group();root.add(frame);frame.position.set(7,1,4);frame.rotation.y=Math.PI/3;
  leaf(frame,{kind:'lift',normal:[-1,0,0],trigger:[-.28,0,0],width:2.85,height:2.4});
  const controller=createProximityDoorController(root);
  try {
    root.updateMatrixWorld(true);
    const passage=controller.getPassages({includeAll:true})[0],actualCentre=frame.localToWorld(new THREE.Vector3(-.28,0,0));
    passage.point.forEach((v,i)=>near(v,actualCentre.toArray()[i]));
    const normal=new THREE.Vector3(...passage.normal);
    const tangent=frame.localToWorld(new THREE.Vector3(-.28,0,1)).sub(actualCentre).normalize();
    near(normal.dot(tangent),0);near(normal.length(),1);
    const outward=frame.localToWorld(new THREE.Vector3(-1.28,0,0)).sub(actualCentre).normalize();
    near(normal.dot(outward),1);
  } finally {controller.dispose();}
});

test('manual mode requires an explicit nearby interaction, persists after leaving and ignores non-enterable doors', () => {
  const root=new THREE.Group(),frame=new THREE.Group();root.add(frame);
  const door=leaf(frame,{label:'출입문'}),blocked=leaf(root,{enterable:false}),legacy=leaf(root);
  delete legacy.userData.proximityDoor.enterable;
  const blockedRotation=blocked.rotation.y,legacyRotation=legacy.rotation.y;
  const controller=createProximityDoorController(root);
  assert.equal(controller.count,1,'equipment panels and unreviewed facades are excluded');
  for(let i=0;i<90;i++)controller.update([0,0,1],1/60);
  near(door.rotation.y,0);
  assert.equal(controller.getInteraction([0,0,1]).action,'open');
  assert.equal(controller.toggleNearest([0,0,1]),true);
  advance(controller,[0,0,1],1.5,{autoOpen:false});near(door.rotation.y,Math.PI/2);
  advance(controller,[20,0,20],3,{autoOpen:false});near(door.rotation.y,Math.PI/2);
  assert.equal(controller.toggleNearest([20,0,20]),false,'F cannot operate a distant door');
  assert.equal(controller.getInteraction([0,4,1]),null,'the other floor is out of reach');
  assert.equal(controller.getInteraction([0,0,1]).action,'close');
  controller.toggleNearest([0,0,1]);advance(controller,[0,0,1],1.5,{autoOpen:false});near(door.rotation.y,0);
  near(blocked.rotation.y,blockedRotation);near(legacy.rotation.y,legacyRotation);
  controller.dispose();assert.equal(controller.toggleNearest([0,0,1]),false);assert.equal(controller.getInteraction([0,0,1]),null);
});

test('a manual action opens and closes the whole telescopic or paired-leaf entrance', () => {
  const root=new THREE.Group(),frame=new THREE.Group();root.add(frame);
  const left=leaf(frame,{kind:'slide',axis:'x',closed:-.5,open:-1.5,width:2}),right=leaf(frame,{kind:'slide',axis:'x',closed:.5,open:-1.5,width:2});
  const secondFrame=new THREE.Group();secondFrame.position.x=1.8;root.add(secondFrame);const adjacent=leaf(secondFrame);
  const controller=createProximityDoorController(root);
  assert.equal(controller.groupCount,2);
  controller.toggleNearest([0,0,.8]);advance(controller,[0,0,.8],1.5,{autoOpen:false});
  near(left.position.x,-1.5);near(right.position.x,-1.5);near(adjacent.rotation.y,0);
  controller.toggleNearest([0,0,.8]);advance(controller,[0,0,.8],1.5,{autoOpen:false});near(left.position.x,-.5);near(right.position.x,.5);
  controller.dispose();
});

test('a linked passage can open its entire reviewed group immediately or animate without affecting other doors', () => {
  const root=new THREE.Group(),frame=new THREE.Group();root.add(frame);
  const portal={area:'campus',entry:'team2-rear'};
  const left=leaf(frame,{groupId:'linked-entry',portal}),right=leaf(frame,{groupId:'linked-entry',kind:'slide',axis:'x',closed:.5,open:1.5});
  const other=leaf(frame,{groupId:'other-entry'}),blocked=leaf(frame,{enterable:false,groupId:'blocked-entry'});
  const blockedAngle=blocked.rotation.y,controller=createProximityDoorController(root);
  assert.equal(controller.setPassageOpen('missing',true,{immediate:true}),false);
  assert.equal(controller.setPassageOpen('blocked-entry',true,{immediate:true}),false);
  assert.equal(controller.setPassageOpen('linked-entry',true,{immediate:true}),true);
  near(left.rotation.y,Math.PI/2);near(right.position.x,1.5);near(other.rotation.y,0);near(blocked.rotation.y,blockedAngle);
  assert.equal(controller.getPassages()[0].open,true);
  advance(controller,[20,0,20],1.5,{autoOpen:false});near(left.rotation.y,Math.PI/2);
  assert.equal(controller.setPassageOpen('linked-entry',false,{immediate:true}),true);
  near(left.rotation.y,0);near(right.position.x,.5);assert.equal(controller.getPassages()[0].open,false);
  assert.equal(controller.setPassageOpen('linked-entry',true),true);near(left.rotation.y,0);
  controller.update(null,1/60);assert.ok(left.rotation.y>0&&left.rotation.y<Math.PI/2);
  advance(controller,null,1.5,{autoOpen:false});near(left.rotation.y,Math.PI/2);near(right.position.x,1.5);near(other.rotation.y,0);
  controller.dispose();assert.equal(controller.setPassageOpen('linked-entry',true,{immediate:true}),false);
});

test('switching automatic sensors off preserves an opened entrance until the next manual action', () => {
  const root=new THREE.Group(),door=leaf(root),controller=createProximityDoorController(root);
  advance(controller,[0,0,1]);near(door.rotation.y,Math.PI/2);
  advance(controller,[10,0,10],2,{autoOpen:false});near(door.rotation.y,Math.PI/2);
  controller.toggleNearest([0,0,1]);advance(controller,[0,0,1],1.5,{autoOpen:false});near(door.rotation.y,0);
  advance(controller,[0,0,1],1.5,{autoOpen:true});near(door.rotation.y,Math.PI/2);
  advance(controller,[10,0,10],2,{autoOpen:true});near(door.rotation.y,0);
  controller.dispose();
});

test('manual targeting respects facing and named groups stay scoped to their own equipment', () => {
  const root=new THREE.Group(),a=new THREE.Group(),b=new THREE.Group();root.add(a,b);
  a.userData.equipment='building-a';b.userData.equipment='building-b';b.position.z=3;
  const first=leaf(a,{groupId:'entrance'}),second=leaf(b,{groupId:'entrance'}),controller=createProximityDoorController(root);
  assert.equal(controller.groupCount,2);
  const at=[0,0,1.5];
  assert.equal(controller.getInteraction(at,{direction:[0,0,-1]}).id,'building-a:entrance');
  assert.equal(controller.getInteraction(at,{direction:[0,0,1]}).id,'building-b:entrance');
  controller.toggleNearest(at,{direction:[0,0,1]});advance(controller,at,1.5,{autoOpen:false});
  near(first.rotation.y,0);near(second.rotation.y,Math.PI/2);
  controller.dispose();
});

test('a reviewed portal exposes its transformed threshold only when visible and reports actual opening progress', () => {
  const root=new THREE.Group(),frame=new THREE.Group();root.add(frame);frame.position.set(10,6,-4);frame.rotation.y=-Math.PI/2;frame.scale.set(.8,.8,.8);
  leaf(frame,{width:2,height:2.5,trigger:[.2,0,.1]});
  const portal={area:'packaging',level:1,position:[2,0,3]},door=leaf(frame,{portal,width:2,height:2.5,trigger:[.2,0,.1]});
  const controller=createProximityDoorController(root),expectedPoint=frame.localToWorld(new THREE.Vector3(.2,0,.1));
  const closed=controller.getPassages();assert.equal(closed.length,1);assert.equal(closed[0].open,false);
  closed[0].point.forEach((v,i)=>near(v,expectedPoint.toArray()[i]));near(closed[0].normal[0],-1);near(closed[0].normal[2],0);
  near(closed[0].width,1.6);near(closed[0].height,2);assert.equal(closed[0].portal,portal);
  assert.equal(controller.getPassages({includeAll:true})[0].portal,portal,'an ordinary first panel cannot hide its partner portal metadata');
  const person=frame.localToWorld(new THREE.Vector3(.2,0,1));controller.toggleNearest(person);advance(controller,person,1.5,{autoOpen:false});assert.equal(controller.getPassages()[0].open,true);
  frame.position.x+=5;const moved=controller.getPassages()[0];near(moved.point[0],expectedPoint.x+5);
  frame.visible=false;assert.deepEqual(controller.getPassages(),[]);controller.update(person,1/60,{autoOpen:false});near(door.rotation.y,0);
  controller.dispose();assert.deepEqual(controller.getPassages(),[]);
});

test('closed ordinary entrances are included in the optional passage list so walking can stop at their plane', () => {
  const root=new THREE.Group(),frame=new THREE.Group();root.add(frame);frame.position.set(4,0,-8);frame.rotation.y=Math.PI/2;
  leaf(frame,{width:1.4,height:2.2});leaf(root,{enterable:false});
  const controller=createProximityDoorController(root);
  assert.deepEqual(controller.getPassages(),[],'ordinary doors are not area portals');
  const entries=controller.getPassages({includeAll:true});
  assert.equal(entries.length,1);assert.equal(entries[0].open,false);assert.equal(entries[0].portal,undefined);
  assert.deepEqual(entries[0].point,[4,0,-8]);near(entries[0].normal[0],1);near(entries[0].width,1.4);
  controller.toggleNearest([5,0,-8]);advance(controller,[5,0,-8],1.5,{autoOpen:false});assert.equal(controller.getPassages({includeAll:true})[0].open,true);
  controller.dispose();
});

test('hinged, sliding and lifting leaves start closed, open from either side and close after the person leaves', () => {
  const root = new THREE.Group(), hinge = leaf(root), slide = leaf(root, { kind: 'slide', axis: 'x', closed: .4, open: -1.2 });
  const lift = leaf(root, { kind: 'lift', axis: 'y', closed: .8, open: 2.5, retract: true });
  lift.scale.y = .7;
  const panel = new THREE.Group(); panel.rotation.y = .35; root.add(panel);
  const controller = createProximityDoorController(root);
  assert.equal(controller.count, 3); near(hinge.rotation.y, 0); near(slide.position.x, .4); near(lift.position.y, .8);
  for (const z of [-1, 1]) {
    controller.reset(); advance(controller, [0, 0, z]);
    near(hinge.rotation.y, Math.PI / 2); near(slide.position.x, -1.2); near(lift.position.y, 2.5); near(lift.scale.y, .7 * .035);
    near(panel.rotation.y, .35);
    controller.update([8, 0, 8], .1, {autoOpen:true});
    near(hinge.rotation.y, Math.PI / 2);
    advance(controller, [8, 0, 8]);
    near(hinge.rotation.y, 0); near(slide.position.x, .4); near(lift.position.y, .8); near(lift.scale.y, .7);
    assert.equal(controller.update([8, 0, 8], 1 / 60), false, 'a settled closed door does not keep rendering');
  }
  controller.dispose(); assert.equal(controller.count, 0);
});

test('door proximity follows moved, rotated and scaled parents and excludes the floor above or below', () => {
  const root = new THREE.Group(), frame = new THREE.Group(); root.add(frame);
  frame.position.set(14, 6, -9); frame.rotation.y = .9; frame.scale.set(.7, .7, .7);
  const door = leaf(frame, { trigger: [.5, .2, 0] }), metadata = JSON.stringify(door.userData);
  const upstairs = new THREE.Group(); upstairs.position.set(14, 12, -9); root.add(upstairs);
  const upperDoor = leaf(upstairs), controller = createProximityDoorController(root);
  const person = frame.localToWorld(new THREE.Vector3(.5, .2, -.8));
  advance(controller, person); near(door.rotation.y, Math.PI / 2); near(upperDoor.rotation.y, 0);
  frame.position.x += 20; frame.rotation.y = -1.2;
  advance(controller, person); near(door.rotation.y, 0);
  advance(controller, frame.localToWorld(new THREE.Vector3(.5, .2, .8)));
  near(door.rotation.y, Math.PI / 2);
  assert.equal(JSON.stringify(door.userData), metadata, 'animation does not put runtime or THREE references in model metadata');
});

test('hysteresis prevents threshold chatter, motion reverses smoothly, and hidden doors settle without background work', () => {
  const root = new THREE.Group(), frame = new THREE.Group(); root.add(frame);
  const door = leaf(frame), controller = createProximityDoorController(root);
  controller.update([0, 0, 1], 1 / 60, {autoOpen:true});
  assert.ok(door.rotation.y > 0 && door.rotation.y < Math.PI / 2, 'opening has a visible intermediate transform');
  advance(controller, [0, 0, 1]);
  advance(controller, [0, 0, (PROXIMITY_DOOR_RULES.openDistance + PROXIMITY_DOOR_RULES.closeDistance) / 2]);
  near(door.rotation.y, Math.PI / 2);
  advance(controller, [0, 0, 10], .6);
  const closingAngle = door.rotation.y;
  assert.ok(closingAngle > 0 && closingAngle < Math.PI / 2);
  controller.update([0, 0, 1], 1 / 60, {autoOpen:true});
  assert.ok(door.rotation.y >= closingAngle && door.rotation.y - closingAngle < .15, 'returning to the sensor reverses from the current angle');
  frame.visible = false;
  assert.equal(controller.update([0, 0, 1], 1 / 60), false); near(door.rotation.y, 0);
  frame.visible = true;
  advance(controller, [0, 0, 1]); near(door.rotation.y, Math.PI / 2);
  controller.reset(); near(door.rotation.y, 0);
  assert.equal(controller.update([0, 0, 1], 1 / 60, { enabled: false }), false);
});

test('scene animation finishes opening and delayed closing even after walking input stops, then stops requesting frames', async () => {
  const source = (await readFile(new URL('../apps/site/scene.js', import.meta.url), 'utf8'))
    .replace(/^import .*;\r?\n/gm, '').replace(/^export\s+(?=(?:function|class|const|let)\b)/gm, '');
  const queue = [], context = vm.createContext({ THREE,
    requestAnimationFrame(callback) { queue.push(callback); return queue.length; }, cancelAnimationFrame() {} });
  new vm.Script(`${source}\nglobalThis.FacilityScene = FacilityScene;`).runInContext(context);
  const world = new THREE.Group(), door = leaf(world), controller = createProximityDoorController(world);
  const scene = Object.create(context.FacilityScene.prototype);
  let person = new THREE.Vector3(0, 0, 1), time = 0, draws = 0;
  Object.assign(scene, { active: true, disposed: false, frame: null, lastTick: null, dirty: false, view: 'person', reducedMotion: false,
    person: {}, placementMode: false, isolated: false, proximityDoors: controller,autoOpenDoors:true,
    target: new THREE.Vector3(), goalTarget: new THREE.Vector3(), orbit: { azimuth: 0, elevation: 0, distance: 1 }, goalOrbit: { azimuth: 0, elevation: 0, distance: 1 },
    amount: 0, explosion: 0, _advancePerson: () => false, _personWorldPosition: () => person.clone(),
    _moveParts() {}, _updateCamera() {}, _draw() { draws++; }, _stopPerson() {}, _clearHover() {}, _cancelPendingPick() {} });
  const settle = () => {
    let frames = 0;
    while (queue.length) { queue.shift()(time += 1000 / 60); assert.ok(++frames < 180, 'settled doors must not request frames forever'); }
    return frames;
  };
  scene._invalidate(); assert.ok(settle() > 1); near(door.rotation.y, Math.PI / 2);
  assert.equal(scene.lastTick, null);
  person = new THREE.Vector3(9, 0, 9); scene._invalidate();
  assert.ok(settle() > 30, 'the close delay and leaf travel keep frames alive after walking stops');
  near(door.rotation.y, 0); assert.ok(draws > 30);
  person = new THREE.Vector3(0, 0, 1); scene._invalidate(); settle(); near(door.rotation.y, Math.PI / 2);
  scene.setActive(false); near(door.rotation.y, 0); assert.equal(scene.frame, null);
});
