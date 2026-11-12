import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../apps/shared/vendor/three.module.js';
import {CAMPUS_EQUIPMENT} from '../apps/site/campus-data.js';
import {buildCampusEquipment} from '../apps/site/campus-models.js';
import {createProximityDoorController} from '../apps/site/proximity-doors.js';

function harness(ids) {
  const s={scene:new THREE.Group(),parts:[],geometries:new Set(),materials:new Set(),textures:new Set(),
    _material(color,roughness,metalness,extra={}){const material=new THREE.MeshBasicMaterial({color,...extra});this.materials.add(material);return material;},
    _group(parent,position=[0,0,0]){const group=new THREE.Group();group.position.set(...position);parent.add(group);return group;},
    _mesh(geometry,material,parent,position=[0,0,0]){this.geometries.add(geometry);const mesh=new THREE.Mesh(geometry,material);mesh.position.set(...position);parent.add(mesh);return mesh;},
    _box(parent,size,position,material){return this._mesh(new THREE.BoxGeometry(...size),material,parent,position);},
    _cyl(parent,radius,height,position,material,bottom=radius,segments=24){return this._mesh(new THREE.CylinderGeometry(radius,bottom,height,segments),material,parent,position);},
    _part(root,name,offset,position=[0,0,0]){const group=this._group(root,position);this.parts.push({root,name,group,offset});return group;},
  };
  const roots=new Map();
  for(const id of ids){const item=CAMPUS_EQUIPMENT.find(value=>value.id===id),root=s._group(s.scene,item.position);root.rotation.y=item.rotation||0;assert.equal(buildCampusEquipment(s,root,item),true);roots.set(id,root);}
  s.scene.updateMatrixWorld(true);
  return {s,roots,dispose(){for(const collection of [s.geometries,s.materials,s.textures])collection.forEach(value=>value.dispose());}};
}
const leaves=root=>{const result=[];root.traverse(node=>{if(node.userData.proximityDoor)result.push(node);});return result;};
function assertExcludedDoorStaysClosed(root) {
  const moving=leaves(root),controller=createProximityDoorController(root);
  try{
    assert.ok(moving.length,'the reviewed exterior retains its visible architectural leaves');
    assert.equal(controller.count,0,'exterior-only leaves are excluded from the working door registry');
    for(const leaf of moving){
      const data=leaf.userData.proximityDoor,nearby=leaf.parent.localToWorld(new THREE.Vector3(...data.trigger).add(new THREE.Vector3(0,0,.6)));
      const actual=()=>leaf[data.kind==='hinge'?'rotation':'position'][data.axis];
      for(let i=0;i<10;i++)controller.update(nearby,.1,{autoOpen:true});
      assert.equal(actual(),data.closed,'automatic approach cannot open an exterior-only leaf');
      assert.equal(controller.toggleNearest(nearby),false,'manual F interaction has no eligible entrance to operate');
      for(let i=0;i<10;i++)controller.update(nearby,.1);
      assert.equal(actual(),data.closed,'manual interaction leaves the exterior-only leaf closed');
    }
  }finally{controller.dispose();}
}

test('only the observed elevator cabin is enterable among the tower rear exterior doors',()=>{
  const h=harness(['campus-dryer-tower']);
  try{
    const tower=h.roots.get('campus-dryer-tower'),elevator=tower.getObjectByName('rear-survey-rear-unmarked-glass-pair');
    const cabin=elevator.getObjectByName('rear-survey-observed-freight-cabin');
    assert.ok(cabin && cabin.getObjectByName('rear-survey-freight-dark-checkerplate-floor'));
    const permitted=leaves(tower).filter(node=>node.userData.proximityDoor.enterable===true);
    assert.equal(permitted.length,2,'two telescopic leaves lead to the same modelled freight cabin');
    assert.deepEqual(new Set(permitted.map(node=>node.userData.proximityDoor.groupId)),new Set(['rear-freight-elevator']));
    const opaque= tower.getObjectByName('rear-survey-rear-yellow-stair-door');
    assert.ok(leaves(opaque).every(node=>node.userData.proximityDoor.enterable===false),'an exterior yellow door must not reveal an invented stair interior');
    assertExcludedDoorStaysClosed(opaque);
    const vestibule=tower.getObjectByName('campus-exterior-production1-part2-entrance');
    assert.ok(leaves(vestibule).every(node=>node.userData.proximityDoor.enterable===false),'an exterior-only vestibule is not a through-door');
    assertExcludedDoorStaysClosed(vestibule);
  }finally{h.dispose();}
});

test('the team-2 rear glass pair is one connected indoor portal and the HVAC clearance remains intact',()=>{
  const h=harness(['campus-team2-rear-access']);
  try{
    const root=h.roots.get('campus-team2-rear-access'),entry=root.getObjectByName('rear-survey-team2-stair-glass-entry'),pair=leaves(entry);
    assert.equal(pair.length,2);
    for(const leaf of pair){const access=leaf.userData.proximityDoor;assert.equal(access.enterable,true);assert.equal(access.groupId,'team2-rear-entry');assert.deepEqual(access.portal,{area:'packaging',level:1,entry:'team2-rear'});}
    const floor=entry.getObjectByName('rear-survey-real-sloped-concrete-door-apron');assert.ok(floor,'the portal approach retains its modelled floor ramp');
    const normal=new THREE.Vector3(0,0,1).transformDirection(entry.matrixWorld);assert.ok(normal.x<-.99,'the connected door remains on its perpendicular return wall');
  }finally{h.dispose();}
});

test('boiler-room and photographed valve-room leaves are explicitly connected to their modelled interiors',()=>{
  const h=harness(['campus-boiler-room','campus-tank-valve-room','campus-recycling-room','campus-electrical-room']);
  try{
    const boiler=leaves(h.roots.get('campus-boiler-room'));assert.equal(boiler.length,2);assert.ok(boiler.every(node=>node.userData.proximityDoor.enterable===true));
    assert.equal(new Set(boiler.map(node=>node.userData.proximityDoor.groupId)).size,2,'the personnel door and material shutter are separate operations');
    const valve=leaves(h.roots.get('campus-tank-valve-room'));assert.equal(valve.length,1);assert.equal(valve[0].userData.proximityDoor.enterable,true);
    assert.ok(h.roots.get('campus-tank-valve-room').userData.interiorAdded);
    for(const id of ['campus-recycling-room','campus-electrical-room']){
      const root=h.roots.get(id);
      assert.ok(leaves(root).every(node=>node.userData.proximityDoor.enterable===false),'unmodelled service interiors remain shut');
      assertExcludedDoorStaysClosed(root);
    }
  }finally{h.dispose();}
});
