import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../apps/shared/vendor/three.module.js';
import { buildRearStairDetails } from '../apps/site/rear-stair-models.js';
import { REAR_TOWER_SURVEY, REAR_PACKAGING_SURVEY } from '../apps/site/rear-survey-data.js';

function build(survey) {
  const root = new THREE.Group();
  const s = {
    geometries: new Set(), materials: new Set(), textures: new Set(),
    _group(parent, position = [0, 0, 0]) {
      const object = new THREE.Group(); object.position.set(...position); parent.add(object); return object;
    },
    _mesh(geometry, material, parent, position = [0, 0, 0]) {
      this.geometries.add(geometry);
      const object = new THREE.Mesh(geometry, material); object.position.set(...position); parent.add(object); return object;
    },
  };
  buildRearStairDetails(s, root, { rearSurvey: survey }); root.updateMatrixWorld(true);
  return {
    root,
    dispose() { for (const set of [s.geometries, s.materials, s.textures]) for (const resource of set) resource.dispose(); },
  };
}

const bounds = object => new THREE.Box3().setFromObject(object);
const feature = (root, id) => root.getObjectByName(`rear-survey-${id}`);
const canopy = object => object.getObjectByName('rear-survey-observed-entrance-canopy');
const slab = object => canopy(object).children[0];
const close = (actual, expected, message) => assert.ok(Math.abs(actual - expected) < 1e-5, `${message}: ${actual} vs ${expected}`);

test('rear canopy slabs and weather caps meet the registered facade without burying their back edges', () => {
  const tower = build(REAR_TOWER_SURVEY), packaging = build(REAR_PACKAGING_SURVEY);
  try {
    for (const id of ['rear-breakroom-single-door', 'rear-unmarked-glass-pair', 'rear-western-material-shutters', 'rear-yellow-stair-door', 'high-floor-shutter-bays']) {
      const roofs = []; feature(tower.root, id).traverse(object => { if (object.name === 'rear-survey-observed-entrance-canopy') roofs.push(object); });
      assert.ok(roofs.length > 0);
      for (const roof of roofs) for (const panel of roof.children.slice(0, 2)) {
        const box = bounds(panel);
        close(box.max.z, -17, `${id} slab/cap rear edge must meet the facade`);
        assert.ok(box.min.z < -17.8, `${id} retains an exterior weather overhang`);
      }
    }
    const entry = feature(packaging.root, 'team2-stair-glass-entry');
    for (const panel of canopy(entry).children.slice(0, 2)) close(bounds(panel).max.x, 9.1, 'the perpendicular Team-2 canopy ends at its return wall');
  } finally { tower.dispose(); packaging.dispose(); }
});

test('the freight canopy clears the full stair-window projection and still covers the doorway', () => {
  const h = build(REAR_TOWER_SURVEY);
  try {
    const freight = feature(h.root, 'rear-unmarked-glass-pair');
    const roof = bounds(slab(freight)), window = bounds(feature(h.root, 'high-east-stair-glazing'));
    assert.ok(roof.min.x - window.max.x > .1, 'no part of the canopy projects across the adjacent stair glass or frame');
    for (const side of [-1, 1]) {
      const jambX = freight.localToWorld(new THREE.Vector3(side * 1.1, 0, 0)).x;
      assert.ok(jambX > roof.min.x && jambX < roof.max.x, 'both freight doorway jambs remain beneath the canopy');
    }
  } finally { h.dispose(); }
});

test('the continuous breakroom canopy shelters the photographed glass, perforated and material entrances', () => {
  const h = build(REAR_TOWER_SURVEY);
  try {
    const roof = bounds(slab(feature(h.root, 'rear-breakroom-single-door')));
    for (const id of ['rear-breakroom-single-door', 'rear-perforated-pair', 'rear-eastern-material-shutters']) {
      const data = REAR_TOWER_SURVEY.features.find(value => value.id === id);
      assert.ok(roof.min.x < data.position[0] - data.width / 2 && roof.max.x > data.position[0] + data.width / 2, `${id} opening must fit under the same long canopy`);
    }
    assert.ok(roof.max.x > 23.6 && roof.max.x < 24.2, 'the canopy ends just beyond the personnel doorway as filmed');
    const longRoof = bounds(canopy(feature(h.root, 'rear-breakroom-single-door')));
    const freightRoof = bounds(slab(feature(h.root, 'rear-unmarked-glass-pair')));
    assert.ok(freightRoof.min.y - longRoof.max.y > .004, 'the stepped canopy junction has no overlapping cap and slab volumes');
  } finally { h.dispose(); }
});

test('canopy condensers have fully supported feet and retain their photographed fan arrangements', () => {
  const h = build(REAR_TOWER_SURVEY);
  try {
    for (const [doorId, unitId, fanCount] of [
      ['rear-unmarked-glass-pair', 'rear-elevator-roof-condenser', 2],
      ['rear-breakroom-single-door', 'rear-breakroom-roof-condenser', 1],
    ]) {
      const roof = bounds(canopy(feature(h.root, doorId)).children[1]);
      const unit = feature(h.root, unitId), feet = [], fans = [];
      unit.traverse(object => {
        if (object.name === 'rear-survey-condenser-support-foot') feet.push(bounds(object));
        if (object.name === 'rear-survey-static-fan-wire-guard') fans.push(object);
      });
      assert.equal(feet.length, 4);
      for (const foot of feet) {
        close(foot.min.y, roof.max.y, `${unitId} foot meets the finished canopy top`);
        assert.ok(foot.min.x >= roof.min.x && foot.max.x <= roof.max.x && foot.min.z >= roof.min.z && foot.max.z <= roof.max.z, `${unitId} entire support footprint rests on its canopy`);
      }
      assert.equal(fans.length, fanCount, `${unitId} filmed front-fan count`);
      if (fanCount === 2) {
        assert.ok(Math.abs(fans[0].position.y - fans[1].position.y) > .5, 'the elevator condenser has vertically stacked front fans');
        close(fans[0].position.x, fans[1].position.x, 'both front fans share the same vertical axis');
      }
    }
  } finally { h.dispose(); }
});
