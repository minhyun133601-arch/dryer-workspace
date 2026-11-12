import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../apps/shared/vendor/three.module.js';
import { DRYER_BUILDING_FLOORS } from '../apps/site/dryer-building-data.js';
import { PACKAGING_ROOMS } from '../apps/site/packaging-data.js';
import { buildDryerBuildingEnvironment } from '../apps/site/dryer-building-envelope.js';
import { buildPreparationEnvironment } from '../apps/site/preparation-environment.js';
import { buildPackagingEnvironmentV2 } from '../apps/site/packaging-environment-v2.js';
import { createProximityDoorController } from '../apps/site/proximity-doors.js';
import { EQUIPMENT } from '../apps/site/building-data.js';
import { buildPreparationEquipment } from '../apps/site/preparation-models.js';

function fixture() {
  return {
    scene:new THREE.Scene(),geometries:new Set(),materials:new Set(),mat:{},parts:[],
    _group(parent,position=[0,0,0]){const node=new THREE.Group();node.position.set(...position);parent.add(node);return node;},
    _material(color,roughness=.7,metalness=.1,extra={}){const m=new THREE.MeshStandardMaterial({color,roughness,metalness,...extra});this.materials.add(m);return m;},
    _mesh(geometry,material,parent,position=[0,0,0]){const mesh=new THREE.Mesh(geometry,material);mesh.position.set(...position);parent.add(mesh);this.geometries.add(geometry);return mesh;},
    _box(parent,size,position,material){return this._mesh(new THREE.BoxGeometry(...size),material,parent,position);},
    _cyl(parent,radius,height,position,material,bottom=radius,segments=16){return this._mesh(new THREE.CylinderGeometry(radius,bottom,height,segments),material,parent,position);},
    _part(root,name,offset){const group=this._group(root);this.parts.push({root,name,group,offset});return group;},
    dispose(){this.geometries.forEach(g=>g.dispose());this.materials.forEach(m=>m.dispose());},
  };
}
const bounds=node=>{node.updateWorldMatrix(true,true);return new THREE.Box3().setFromObject(node);};
const contains=(outer,inner)=>{const box=outer.clone().expandByScalar(1e-6);assert(box.containsBox(inner),`${JSON.stringify(inner)} is outside ${JSON.stringify(outer)}`);};

test('architectural shutter housings stand ahead of the lintel and contain their raised curtains',()=>{
  const s=fixture();
  try {
    for(const spec of Object.values(DRYER_BUILDING_FLOORS)) {
      const env=buildDryerBuildingEnvironment(s,{floor:spec.id,spec});
      for(const door of env.architectureFixtures.children.filter(node=>node.userData.architecturalDoor)) {
        const housing=door.getObjectByName('architectural-raised-roller-door');if(!housing)continue;
        assert(housing.position.z-.08>.06,'housing does not penetrate the 120mm wall');
        assert(housing.position.y-.135>door.userData.openingHeight,'housing does not reduce door headroom');
        const curtain=door.getObjectByName('architectural-proximity-roller-curtain'),controller=createProximityDoorController(s.scene);
        controller.setPassageOpen(curtain.userData.proximityDoor.groupId,true,{immediate:true});
        contains(bounds(housing),bounds(curtain));controller.dispose();
      }
    }
  } finally {s.dispose();}
});

test('preparation fast-door rolls and gathered strips share a clear mounting plane outside the wall',()=>{
  const s=fixture(),spec=DRYER_BUILDING_FLOORS[1],env=buildDryerBuildingEnvironment(s,{floor:1,spec});buildPreparationEnvironment(s,env,spec);
  const controller=createProximityDoorController(s.scene);
  try {
    for(const name of ['inner','outer']) {
      const housing=env.architectureFixtures.getObjectByName(`preparation-${name}-rapid-door-roll-housing`),data=housing.userData;
      assert(data.rollPlane+.2<data.wallPlane-.06,'housing rear stays outside the wall face');
      controller.setPassageOpen(`preparation:${name}-rapid-door`,true,{immediate:true});
      const curtain=env.architectureFixtures.getObjectByName(`preparation-${name}-orange-rapid-door-curtain`);
      contains(bounds(housing),bounds(curtain));
      controller.setPassageOpen(`preparation:${name}-rapid-door`,false,{immediate:true});
      const passage=controller.getPassages({includeAll:true}).find(item=>item.id===`preparation:${name}-rapid-door`);
      const expected=new THREE.Vector3(-1,0,0).transformDirection(curtain.matrixWorld),normal=new THREE.Vector3(...passage.normal);
      assert(normal.distanceTo(expected)<1e-6,'navigation threshold normal follows the actual curtain plane');
      const p=new THREE.Vector3(...passage.point).add(new THREE.Vector3(0,1.2,0)),from=p.clone().addScaledVector(normal,.5);
      curtain.updateWorldMatrix(true,true);
      const hits=new THREE.Raycaster(from,normal.clone().negate(),0,1).intersectObject(curtain,true);
      assert(hits.length&&Math.abs(hits[0].distance-.5)<.04,'closed barrier centre lies in the physical orange curtain');
    }
  } finally {controller.dispose();s.dispose();}
});

test('preparation movable storage, footwear and quality board leave the shutter and washroom approaches open',()=>{
  const s=fixture(),spec=DRYER_BUILDING_FLOORS[1],env=buildDryerBuildingEnvironment(s,{floor:1,spec});buildPreparationEnvironment(s,env,spec);
  try {
    const shutterApproach=new THREE.Box3(new THREE.Vector3(27.175,.4,1.6),new THREE.Vector3(30.025,2.2,7.6)).translate(new THREE.Vector3(0,spec.elevation,0));
    for(const name of ['preparation-daily-raw-material-storage','preparation-weighing-raw-material-storage']) {
      for(const storage of env.architectureFixtures.getObjectByName(name).children) {
        assert(!bounds(storage).intersectsBox(shutterApproach),`${storage.name} blocks the full-width shutter approach`);
      }
    }
    const forklift=bounds(env.architectureFixtures.getObjectByName('preparation-parked-yellow-green-forklift'));
    assert(!forklift.intersectsBox(shutterApproach),'forklift, mast and forks leave three metres on each side of the full-width shutter approach');
    assert(forklift.min.x>shutterApproach.max.x+.5,'parked forklift also clears the approach laterally');
    assert(spec.bounds.maxX-forklift.max.x>.9,'forklift parking retains a side gap to the outer wall');
    for(const key of ['facade','structure','architectureFixtures'])env[key].traverse(node=>{
      if(!node.isMesh||node.name.startsWith('preparation-parked-yellow-green-forklift'))return;
      for(let parent=node.parent;parent;parent=parent.parent)if(parent.name==='preparation-parked-yellow-green-forklift')return;
      node.updateWorldMatrix(true,false);
      const boxes=[];
      if(node.isInstancedMesh) {
        node.geometry.computeBoundingBox();const matrix=new THREE.Matrix4();
        for(let i=0;i<node.count;i++){node.getMatrixAt(i,matrix);boxes.push(node.geometry.boundingBox.clone().applyMatrix4(matrix.clone().premultiply(node.matrixWorld)));}
      } else boxes.push(bounds(node));
      for(const box of boxes)assert(!box.intersectsBox(forklift),`parked forklift clips ${node.name||node.parent.name}`);
    });
    for(const item of EQUIPMENT.filter(item=>item.floor===1&&item.type==='preparation-equipment')) {
      const root=s._group(s.scene,item.position);root.rotation.y=item.rotation||0;buildPreparationEquipment(s,root,item);
      assert(!bounds(root).intersectsBox(forklift),`parked forklift clips the actual ${item.id} model`);
    }
    const board=bounds(env.architectureFixtures.getObjectByName('preparation-corridor-quality-board'));
    assert(board.max.x<34.34&&board.min.x>34.20,'board lies along the outer wall rather than across the corridor');
    assert(board.min.x-33.36>.85,'quality board leaves a useful corridor width');
    const slippers=bounds(env.architectureFixtures.getObjectByName('preparation-washroom-threshold-slippers'));
    const washroomDoorSweep=new THREE.Box3(new THREE.Vector3(32.3,spec.elevation,14.7),new THREE.Vector3(33.8,spec.elevation+.2,15.7));
    assert(!slippers.intersectsBox(washroomDoorSweep),'loose footwear stays off the threshold and leaf sweep');
  } finally {s.dispose();}
});

test('packaging exit signs and tall air cabinets mount on the interior wall face, and indoor door gaps retain their lintels',()=>{
  const s=fixture(),room=PACKAGING_ROOMS[3],env=buildPackagingEnvironmentV2(s,room),b=room.mainBounds;
  try {
    s.scene.updateMatrixWorld(true);
    const signs=[];env.structure.traverse(node=>{if(node.name.startsWith('packaging-wall-mounted-exit-sign-'))signs.push(node);});
    assert(signs.length>=2);
    for(const sign of signs) {
      const n=new THREE.Vector3(...sign.userData.mountNormal),p=sign.getWorldPosition(new THREE.Vector3());
      const hits=new THREE.Raycaster(p,n.clone().negate(),0,.15).intersectObject(env.ceiling,true);
      assert(hits.length,'sign has an actual wall directly behind its mounting plates');
      assert(hits[0].distance>.035&&hits[0].distance<.045,'the 60mm sign body sits clear of the wall');
      assert(n.dot(new THREE.Vector3(-p.x,0,-p.z))>0,'exit sign faces into the production room');
    }
    const units=[];env.structure.traverse(node=>{if(node.name==='packaging-air-unit-cabinet-riser-plenum')units.push(node);});
    assert.equal(units.length,2);
    for(const unit of units)assert(bounds(unit).min.x>b.minX+.13,'cabinet body stays clear of the 100mm perimeter wall');
    const traps=[];env.structure.traverse(node=>{if(node.name.startsWith('packaging-wall-mounted-insect-trap-'))traps.push(node);});
    assert.equal(traps.length,3);
    for(const trap of traps) {
      const casing=trap.getObjectByName('packaging-insect-trap-casing'),box=bounds(casing),p=trap.getWorldPosition(new THREE.Vector3()),n=new THREE.Vector3(...trap.userData.mountNormal);
      assert(box.min.y>2.5,'trap body sits above the window glazing and all doorway heads');
      assert(n.dot(new THREE.Vector3(-p.x,0,-p.z))>0,'trap tubes face into the room');
      const wallHits=new THREE.Raycaster(p,n.clone().negate(),0,.15).intersectObject(env.ceiling,true);
      assert(wallHits.length&&wallHits[0].distance>.08,'trap mounting plates meet a solid wall behind a clear casing');
      for(const door of room.layout.doors) {
        const normal=new THREE.Vector3(Math.sin(door.rotation||0),0,Math.cos(door.rotation||0)),relative=p.clone().sub(new THREE.Vector3(door.x,p.y,door.z));
        if(Math.abs(relative.dot(normal))>.3)continue;
        const across=Math.abs(relative.dot(new THREE.Vector3(normal.z,0,-normal.x)));
        assert(across>door.width/2+.3,'insect trap stays beside the complete doorway head rather than over a leaf corner');
      }
    }
    const door=room.layout.doors.find(d=>d.id==='store-door');
    assert(door,'an internal partition doorway is exercised');
    const origin=new THREE.Vector3(door.x,(door.height||2.25)+.2,door.z-.2);
    const hits=new THREE.Raycaster(origin,new THREE.Vector3(0,0,1),0,.4).intersectObject(env.ceiling,true);
    assert(hits.length,'the partition resumes above the actual door height');
  } finally {s.dispose();}
});
