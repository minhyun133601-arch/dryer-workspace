import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import * as THREE from '../apps/shared/vendor/three.module.js';

const source = (await readFile(new URL('../apps/site/scene.js', import.meta.url), 'utf8'))
  .replace(/^import .*;\r?\n/gm, '').replace(/^export\s+(?=(?:function|class|const|let)\b)/gm, '');
const context = vm.createContext({ THREE });
new vm.Script(`${source}\nglobalThis.FacilityScene = FacilityScene;`).runInContext(context);

function harness(floor = 1) {
  const scene = Object.create(context.FacilityScene.prototype), calls = [];
  const world = new THREE.Group(), room = new THREE.Group(), tank = new THREE.Group();
  room.position.set(4, 0, -2); room.rotation.y = Math.PI / 2;
  tank.position.set(21.5, .3, 9.75); tank.rotation.y = .4;
  world.add(room); room.add(tank); world.updateMatrixWorld(true);
  const equipment = [{ id: 'f1-mix-b', position: tank.position.toArray(), rotation: tank.rotation.y }];
  Object.assign(scene, {
    activeFloor: floor, view: floor === 'campus' ? 'person' : 'top',
    selected: floor === 'campus' ? 'campus-dryer-tower' : 'f1-mix-b',
    isolated: true, amount: .7, explosion: .7, navigationEdited: false,
    scene: world, equipment, objects: new Map([['f1-mix-b', tank]]),
    target: new THREE.Vector3(), goalTarget: new THREE.Vector3(0, 30, 0),
    orbit: { azimuth: .8, elevation: .7, distance: 200 }, goalOrbit: { azimuth: .8, elevation: .7, distance: 200 },
    camera: new THREE.PerspectiveCamera(42, 1.5, .02, 3000),
    topCamera: new THREE.OrthographicCamera(-20, 20, 20, -20, .02, 3000),
    personInputs: new Set(['ArrowUp']),
    setFloor(value) { calls.push(['floor', value]); this.activeFloor = value; this.selected = null; },
    setView(value) { calls.push(['view', value]); this.view = value; this.goalTarget.set(99, 30, 99); },
    setIsolation(value) { calls.push(['isolation', value]); context.FacilityScene.prototype.setIsolation.call(this, value); },
    setExplosion(value) { calls.push(['explosion', value]); context.FacilityScene.prototype.setExplosion.call(this, value); },
    _stopPerson() { calls.push(['stop-person']); this.personInputs.clear(); },
    _clearHover() {}, _visibility() {}, _updatePersonCamera() {},
    _notifyNavigation() { calls.push(['navigation']); }, _invalidate() { calls.push(['invalidate']); },
    setLayout() { assert.fail('a camera shortcut cannot reset saved equipment placement'); },
    setTransform() { assert.fail('a camera shortcut cannot relocate equipment'); },
  });
  return { scene, tank, room, calls, equipment };
}

const closePoint = (actual, expected, message) => assert.ok(actual.distanceTo(expected) < 1e-8, `${message}: ${actual.toArray()} vs ${expected.toArray()}`);

test('preparation lower view follows the relocated tank world pose and places the perspective camera near floor level without moving equipment', () => {
  const h = harness(), { scene, tank, room } = h;
  const actualTankPoint = tank.getWorldPosition(new THREE.Vector3());
  const before = { equipment: structuredClone(h.equipment), tankPosition: tank.position.toArray(), tankRotation: tank.rotation.y, roomPosition: room.position.toArray(), roomRotation: room.rotation.y };
  scene.showPreparationLowerView();
  closePoint(scene.goalTarget, actualTankPoint.clone().add(new THREE.Vector3(.45, 1.05, 0)), 'the target follows the current world root rather than catalog coordinates');
  assert.equal(scene.goalOrbit.azimuth, Math.PI / 2); assert.equal(scene.goalOrbit.elevation, .035); assert.equal(scene.goalOrbit.distance, 7.5);
  assert.equal(scene.view, 'perspective'); assert.equal(scene.isolated, false); assert.equal(scene.explosion, 0);
  assert.equal(scene.personInputs.size, 0); assert.equal(scene.navigationEdited, true);
  assert.ok(!h.calls.some(([kind]) => kind === 'floor'), 'already being on 1F does not re-enter or reset the floor');
  scene.target.copy(scene.goalTarget); Object.assign(scene.orbit, scene.goalOrbit); scene._updateCamera();
  assert.ok(scene.camera.position.y > actualTankPoint.y + 1 && scene.camera.position.y < actualTankPoint.y + 1.5, 'eye height exposes the tank underside and floor piping');
  assert.ok(Math.abs(scene.camera.position.distanceTo(scene.target) - 7.5) < 1e-8);
  closePoint(scene.camera.getWorldDirection(new THREE.Vector3()), scene.target.clone().sub(scene.camera.position).normalize(), 'the perspective camera looks at the lower vessel area');
  assert.deepEqual(h.equipment, before.equipment);
  assert.deepEqual(tank.position.toArray(), before.tankPosition); assert.equal(tank.rotation.y, before.tankRotation);
  assert.deepEqual(room.position.toArray(), before.roomPosition); assert.equal(room.rotation.y, before.roomRotation);
});

test('entering preparation lower view from the campus first switches to 1F and clears isolated person/exploded state while retaining the saved pose', () => {
  const { scene, tank, calls, equipment } = harness('campus');
  const point = tank.getWorldPosition(new THREE.Vector3()), before = structuredClone(equipment);
  scene.showPreparationLowerView();
  assert.equal(scene.activeFloor, 1); assert.equal(scene.view, 'perspective');
  assert.deepEqual(calls.filter(([kind]) => !['invalidate', 'navigation'].includes(kind)), [
    ['floor', 1], ['isolation', false], ['stop-person'], ['view', 'perspective'], ['explosion', 0],
  ]);
  assert.equal(scene.isolated, false); assert.equal(scene.explosion, 0); assert.equal(scene.personInputs.size, 0);
  closePoint(scene.goalTarget, point.clone().add(new THREE.Vector3(.45, 1.05, 0)), 'campus fitting cannot leave the lower-view target at campus scale');
  assert.equal(scene.goalOrbit.distance, 7.5); assert.equal(scene.navigationEdited, true);
  assert.deepEqual(equipment, before); closePoint(tank.getWorldPosition(new THREE.Vector3()), point, 'switching views preserves the actual saved world pose');
});
