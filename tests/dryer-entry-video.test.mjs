import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../apps/shared/vendor/three.module.js';
import { CAMPUS_EQUIPMENT } from '../apps/site/campus-data.js';
import { addCampusRearDetails } from '../apps/site/campus-rear-models.js';
import { DRYER_BUILDING_FLOORS } from '../apps/site/dryer-building-data.js';
import { buildDryerBuildingEnvironment } from '../apps/site/dryer-building-envelope.js';
import { buildPreparationEnvironment } from '../apps/site/preparation-environment.js';
import { createProximityDoorController } from '../apps/site/proximity-doors.js';

function harness() {
  const s={scene:new THREE.Scene(),geometries:new Set(),materials:new Set(),textures:new Set(),
    _group(parent,position=[0,0,0]){const root=new THREE.Group();root.position.set(...position);parent.add(root);return root;},
    _material(color,roughness=.7,metalness=.1,extra={}){const m=new THREE.MeshStandardMaterial({color,roughness,metalness,...extra});this.materials.add(m);return m;},
    _mesh(geometry,material,parent,position=[0,0,0]){this.geometries.add(geometry);const mesh=new THREE.Mesh(geometry,material);mesh.position.set(...position);parent.add(mesh);return mesh;},
  };
  return {s,dispose(){for(const set of [s.geometries,s.materials,s.textures])for(const value of set)value.dispose();}};
}
const bounds=node=>new THREE.Box3().setFromObject(node);

test('the filmed outer entry uses full-width frosted sliding panels without a swing across the apron',()=>{
  const h=harness();
  try {
    const outer=CAMPUS_EQUIPMENT.find(item=>item.id==='campus-dryer-tower').exteriorDetails.find(item=>item.id==='production1-part2-entrance');
    const root=h.s._group(h.s.scene);
    addCampusRearDetails(h.s,root,{exteriorDetails:[{...outer,position:[0,0,0],yaw:0}]});
    const entry=root.getObjectByName('campus-exterior-production1-part2-entrance');
    const panels=[];entry.traverse(node=>{if(node.name==='campus-vestibule-glass-door-leaf')panels.push(node);});
    assert.equal(panels.length,2);
    assert.equal(entry.userData.actualDoorType,'two-panel-frosted-sliding');
    for(const panel of panels)assert.ok(panel.children[0].geometry.parameters.width>1,'both panes span the observed full doorway rather than half-width swing panels');
    const moving=panels.find(panel=>panel.userData.proximityDoor),fixed=panels.find(panel=>!panel.userData.proximityDoor);
    const data=moving.userData.proximityDoor;
    assert.equal(data.kind,'slide');assert.equal(data.axis,'x');
    const fixedPosition=fixed.position.clone(),plane=moving.position.z;
    moving.position.x=data.open;h.s.scene.updateMatrixWorld(true);
    assert.equal(moving.rotation.y,0);assert.equal(moving.position.z,plane);
    assert.ok(fixed.position.equals(fixedPosition));
    const clearWidth=bounds(moving).min.x-(-outer.width/2+.09);
    assert.ok(clearWidth>.9,'sliding the outer pane leaves a real person-width opening');
    assert.ok(entry.getObjectByName('campus-vestibule-sliding-door-tracks'));
    assert.equal(entry.userData.interiorAdded,false,'the exterior detail does not invent an unseen room');
  }finally{h.dispose();}
});

test('the inner keyed glass pair remains hinged and its lock hardware follows its leaf',()=>{
  const h=harness();let controller;
  try {
    const spec=DRYER_BUILDING_FLOORS[1],env=buildDryerBuildingEnvironment(h.s,{floor:1,elevation:spec.elevation,spec});
    buildPreparationEnvironment(h.s,env,spec);h.s.scene.updateMatrixWorld(true);
    const entry=env.architectureFixtures.getObjectByName('preparation-controlled-double-glass-entry-lower');
    const leaves=[];entry.traverse(node=>{if(node.userData.doorLeaf)leaves.push(node);});
    assert.equal(leaves.length,2);leaves.forEach(leaf=>assert.equal(leaf.userData.proximityDoor.kind,'hinge'));
    const keypad=entry.getObjectByName('preparation-entry-keypad-and-push-fitting');
    assert.ok(keypad);assert.equal(keypad.userData.accessDigitsStored,false);
    const fixed=entry.matrixWorld.clone(),before=keypad.getWorldPosition(new THREE.Vector3());
    controller=createProximityDoorController(h.s.scene);
    const at=entry.localToWorld(new THREE.Vector3(0,0,.3));
    for(let i=0;i<10;i++)controller.update(at,.1,{autoOpen:true});
    h.s.scene.updateMatrixWorld(true);
    assert.ok(entry.matrixWorld.equals(fixed),'the access frame stays fixed when both glazed leaves open');
    assert.ok(keypad.getWorldPosition(new THREE.Vector3()).distanceTo(before)>.3,'the keypad stays mounted to its moving leaf');
    const basins=[];env.architectureFixtures.traverse(node=>{if(node.name==='preparation-round-handwash-basin')basins.push(node);});
    assert.equal(basins.length,2);
    assert.equal(env.architectureFixtures.getObjectByName('preparation-two-green-wall-lint-rollers').userData.observedCount,2);
  }finally{controller?.dispose();h.dispose();}
});

test('the two lidded foyer boxes rest on their table beside the lower stair approach',()=>{
  const h=harness();
  try {
    const spec=DRYER_BUILDING_FLOORS[1],env=buildDryerBuildingEnvironment(h.s,{floor:1,elevation:spec.elevation,spec});
    buildPreparationEnvironment(h.s,env,spec);h.s.scene.updateMatrixWorld(true);
    const table=env.architectureFixtures.getObjectByName('preparation-entry-folding-table-and-storage-boxes');
    const boxes=table.children.filter(node=>node.name==='preparation-clear-lidded-entry-storage-box');
    assert.equal(boxes.length,2);
    const top=bounds(table.children[0]);
    for(const box of boxes){
      const body=bounds(box.children[0]);
      assert.ok(Math.abs(body.min.y-top.max.y)<1e-6,'each clear storage box stands on the folding tabletop');
      assert.ok(body.min.x>=top.min.x&&body.max.x<=top.max.x&&body.min.z>=top.min.z&&body.max.z<=top.max.z);
    }
    const tableBox=bounds(table),lockers=bounds(env.architectureFixtures.getObjectByName('preparation-under-existing-stair-lockers'));
    const sideGap=Math.max(tableBox.min.x-lockers.max.x,lockers.min.x-tableBox.max.x);
    assert.ok(sideGap>.1&&sideGap<.5,'the table stands beside the retained locker bank on either side of the reversed stair');
    assert.ok(Math.min(tableBox.max.z,lockers.max.z)-Math.max(tableBox.min.z,lockers.min.z)>.1,'the neighboring table and lockers share the same under-stair pocket');
    assert.ok(tableBox.max.z<20.06,'the first flight along Z20.685 remains clear of the table and its boxes');
    const stair=env.architectureFixtures.getObjectByName('dryer-building-1-southeast-stair');
    stair.traverse(node=>{if(node.isMesh)assert.equal(bounds(node).intersectsBox(tableBox),false,'the table and boxes remain below the upper flight without intersecting it');});
  }finally{h.dispose();}
});
