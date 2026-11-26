import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../apps/shared/vendor/three.module.js';
import { EQUIPMENT } from '../apps/site/building-data.js';
import { DRYER_BUILDING_FLOORS } from '../apps/site/dryer-building-data.js';
import { buildDryerBuildingEnvironment } from '../apps/site/dryer-building-envelope.js';
import { buildDryerProcessEquipment } from '../apps/site/dryer-process-models.js';

function fixture(){
  const plain=new THREE.MeshStandardMaterial({color:0xbcc6c0});
  const s={scene:new THREE.Scene(),equipment:EQUIPMENT,parts:[],geometries:new Set(),materials:new Set([plain]),mat:new Proxy({}, {get:()=>plain}),
    _group(parent,p=[0,0,0]){const node=new THREE.Group();node.position.set(...p);parent.add(node);return node;},
    _material(color,roughness=.6,metalness=.1,extra={}){const value=new THREE.MeshStandardMaterial({color,roughness,metalness,...extra});this.materials.add(value);return value;},
    _mesh(geometry,material,parent,p=[0,0,0]){this.geometries.add(geometry);const node=new THREE.Mesh(geometry,material);node.position.set(...p);parent.add(node);return node;},
    _part(root,name,offset){const node=this._group(root);this.parts.push({root,name,group:node,offset});return node;},
  },roots=new Map();
  for(const id of ['f1-conveyor-a','f1-conveyor-b','f1-palletizer']){const item=EQUIPMENT.find(value=>value.id===id),root=s._group(s.scene,item.position);root.rotation.y=item.rotation||0;assert.equal(buildDryerProcessEquipment(s,root,item),true);roots.set(id,root);}
  const spec=DRYER_BUILDING_FLOORS[2],mezzanine=buildDryerBuildingEnvironment(s,{floor:2,spec});s.scene.updateMatrixWorld(true);
  return {s,roots,mezzanine,dispose(){s.geometries.forEach(v=>v.dispose());s.materials.forEach(v=>v.dispose());}};
}
const find=(root,name)=>root.getObjectByName(`dryer-process-${name}`);
const all=(root,name)=>{const result=[];root.traverse(node=>{if(node.name===`dryer-process-${name}`)result.push(node);});return result;};
const bounds=node=>new THREE.Box3().setFromObject(node);
const down=(root,x,z,y=8)=>new THREE.Raycaster(new THREE.Vector3(x,y,z),new THREE.Vector3(0,-1,0),0,10).intersectObject(root,true);

test('the saved palletizer identity owns exactly one palletizing robot (user-confirmed 2026-11-26)',()=>{
  const h=fixture();
  try{
    const root=h.roots.get('f1-palletizer'),arm=find(root,'observed-blue-articulated-arm');
    assert.ok(arm);assert.equal(find(root,'observed-cream-articulated-arm'),undefined);assert.equal(find(root,'observed-cream-arm-base'),undefined);
    assert.equal(root.userData.palletizingRobotCount,1);assert.equal(root.userData.observedMinimumArticulatedArms,1);
    assert.equal(all(root,'observed-blue-arm-base').length,1);
    assert.equal(all(root,'observed-red-vacuum-gripper').length,0);
    assert.equal(find(root,'observed-blue-end-tool').userData.gripperType,'bag-fork');
    assert.ok(find(root,'photo-20261126-sce-kraft-sacks'),'the robot stacks kraft sacks on a red pallet');
    assert.equal(root.userData.operatingAnimationAdded,false);
    const item=EQUIPMENT.find(value=>value.id==='f1-palletizer');
    assert.deepEqual(h.s.parts.filter(value=>value.root===root).map(value=>value.name),item.parts,'the robot cannot create or replace saved catalog identities');
  }finally{h.dispose();}
});

test('three separate alignment lanes and local fences fit the actual mezzanine void and stay below its slab',()=>{
  const h=fixture();
  try{
    const root=h.roots.get('f1-palletizer'),b=bounds(root);
    assert.ok(b.min.x>=5.9&&b.max.x<=13.4&&b.min.z>=10.8&&b.max.z<=17.7,'the robot, lanes, fencing and the west-side operator console/controller occupy the approved cell footprint');
    assert.ok(b.max.y<DRYER_BUILDING_FLOORS[2].elevation,'the highest static links and service hoses remain below the 1.5-floor slab datum');
    assert.equal(root.userData.observedAlignmentLaneCount,3);
    const lanes=[1,2,3].map(i=>find(root,`observed-arm-alignment-lane-${i}`));
    for(const lane of lanes){assert.ok(lane);const bb=bounds(lane),center=bb.getCenter(new THREE.Vector3());assert.equal(down(h.mezzanine.deck,center.x,center.z).length,0,'an alignment lane must lie beneath a real void, not an unseen solid mezzanine');}
    const centers=lanes.map(node=>bounds(node).getCenter(new THREE.Vector3()));
    assert.ok(centers[1].z-centers[0].z>.7&&centers[2].z-centers[1].z>.7,'the observed lanes remain parallel and individually separated');
    for(const arm of ['blue']){const p=find(root,`observed-${arm}-arm-base`).getWorldPosition(new THREE.Vector3());assert.equal(down(h.mezzanine.deck,p.x,p.z).length,0);}
    const wires=all(root,'observed-yellow-fence-wire');assert.ok(wires.every(node=>node.isInstancedMesh));assert.ok(wires.reduce((sum,node)=>sum+node.count,0)>100,'the visible mesh guard is detailed without one draw object per rod');
  }finally{h.dispose();}
});

test('two visible carton machine silhouettes fill separate bays with a real belt opening and column bypass',()=>{
  const h=fixture();
  try{
    const root=h.roots.get('f1-conveyor-a');
    assert.equal(root.userData.visibleCartonMachineSilhouettes,2);
    for(const [i,x]of [[1,-5.3],[2,-1.6]]){
      const machine=find(root,`observed-carton-machine-${i}`),p=machine.getWorldPosition(new THREE.Vector3());
      assert.ok(Math.abs(p.x-x)<1e-5&&Math.abs(p.z-10.3)<1e-5);
      assert.ok(bounds(machine).max.y<DRYER_BUILDING_FLOORS[2].elevation-.16-.05,'the observed upright motor and cable loop retain clearance below the real gallery slab underside');
      const target=machine.localToWorld(new THREE.Vector3(0,.81,-1.8)),direction=new THREE.Vector3(0,0,1).transformDirection(machine.matrixWorld);
      const frame=all(machine,'observed-carton-machine-body');
      assert.equal(new THREE.Raycaster(target,direction,0,3.6).intersectObjects(frame,true).length,0,'side cabinets do not fill the belt corridor through the carton machine');
    }
    assert.ok(find(root,'observed-green-column-bypass'));
    for(const dx of [-.17,0,.17])for(const dz of [-.17,0,.17]){const hits=down(root,-5.3+dx,13.3+dz,3.7);assert.equal(hits.length,0,`the visible outfeed runs beside the concrete column footprint at${dx},${dz}: ${hits.map(hit=>hit.object.name+' in '+hit.object.parent.name).join(',')}`);}
    assert.equal(root.userData.completeTransferTopologyConfirmed,false);
    assert.equal(root.userData.hiddenBlueToGreenConnectionConfirmed,false);
  }finally{h.dispose();}
});

test('the visible curve uses batched brown radial rollers and separate guards without inventing a full return loop',()=>{
  const h=fixture();
  try{
    const root=h.roots.get('f1-conveyor-b'),curve=find(root,'observed-brown-quarter-roller');
    assert.ok(curve);assert.equal(curve.userData.visibleArcDegrees,90);assert.equal(curve.userData.fullReturnLoopConfirmed,false);
    const rollers=find(curve,'observed-orange-brown-radial-rollers');
    assert.ok(rollers.isInstancedMesh&&rollers.count>=16);
    const color=rollers.material.color;assert.ok(color.r>color.g&&color.g>color.b,'the observed orange-brown curve is distinguished from silver straight rollers');
    assert.ok(find(curve,'observed-curved-side-guide-rails').isInstancedMesh);
    assert.ok(find(curve,'observed-curved-support-legs').isInstancedMesh);
    assert.equal(find(root,'observed-green-short-merge'),undefined,'the dead-end angled fragment was removed at the user request (2026-11-26)');
    assert.equal(down(h.roots.get('f1-palletizer'),6.95,14.3).length,0,'the brown infeed passes through a real opening in the yellow cell fence');
    let meshes=0,instances=0;for(const body of h.roots.values())body.traverse(node=>{if(node.isMesh){meshes++;assert.ok(h.s.geometries.has(node.geometry));assert.ok(h.s.materials.has(node.material));if(node.isInstancedMesh)instances+=node.count;}});
    assert.ok(meshes<240&&instances>300,'detailed rollers and fences share geometry instead of multiplying draw objects');
  }finally{h.dispose();}
});
