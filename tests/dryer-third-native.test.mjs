import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../apps/shared/vendor/three.module.js';
import { EQUIPMENT } from '../apps/site/building-data.js';
import { buildDryerProcessEquipment } from '../apps/site/dryer-process-models.js';

function build(){
  const base=new THREE.MeshStandardMaterial(),s={scene:new THREE.Group(),equipment:EQUIPMENT,geometries:new Set(),materials:new Set([base]),textures:new Set(),mat:new Proxy({},{get:()=>base}),
    _group(parent,p=[0,0,0]){const root=new THREE.Group();root.position.set(...p);parent.add(root);return root;},
    _part(parent){return this._group(parent);},
    _material(color,roughness,metalness,extra={}){const material=new THREE.MeshStandardMaterial({color,roughness,metalness,...extra});this.materials.add(material);return material;},
    _mesh(geometry,material,parent,p=[0,0,0]){this.geometries.add(geometry);const mesh=new THREE.Mesh(geometry,material);mesh.position.set(...p);parent.add(mesh);return mesh;},
  },roots=new Map();
  for(const id of['f3-holding','f3-balance-tank','f3-feed-tank']){const item=EQUIPMENT.find(item=>item.id===id),root=s._group(s.scene,item.position);root.rotation.y=item.rotation||0;assert.equal(buildDryerProcessEquipment(s,root,item),true);roots.set(id,root);}
  s.scene.updateMatrixWorld(true);
  return{s,roots,dispose(){for(const set of[s.geometries,s.materials,s.textures])for(const resource of set)resource.dispose();}};
}
const named=(root,name)=>{const nodes=[];root.traverse(node=>{if(node.name===`dryer-process-${name}`)nodes.push(node);});return nodes;};
const box=root=>new THREE.Box3().setFromObject(root);

test('native538 hopper feeds retain one inclined metal route and one wide flexible vertical coupling above the supported twin cone deck',()=>{
  const h=build();
  try{
    const root=h.roots.get('f3-holding');
    assert.equal(named(root,'observed-inclined-hopper-feed').length,1);
    assert.equal(named(root,'observed-hopper-wide-flexible-coupling').length,1);
    assert.equal(named(root,'observed-hopper-flex-coupling-band').length,2);
    assert.equal(named(root,'observed-hopper-vertical-upper-riser').length,1);
    assert.equal(named(root,'observed-hopper-rotary-outlet-detail').length,2);
    assert.equal(named(root,'observed-hopper-rotary-side-flange').length,4);
    assert.equal(named(root,'observed-hopper-underdeck-longitudinal-bearer').length,2);
    assert.equal(named(root,'observed-hopper-underdeck-knee-brace').length,4);
    assert.equal(named(root,'observed-round-drive-motor-fan-cap').length,2);
    assert.equal(named(root,'observed-round-drive-fixed-side-guard').length,4);
    assert.equal(named(root,'observed-covered-transfer-trough').length,3);
    const lid=named(root,'observed-hopper-sloping-cover')[0],sleeve=named(root,'observed-hopper-wide-flexible-coupling')[0];
    assert.ok(lid.geometry.parameters.radiusTop<lid.geometry.parameters.radiusBottom*.3,'the hopper roof slopes inward instead of ending in a flat drum cap');
    assert.ok(sleeve.geometry.parameters.radiusTop>.35,'the pale flexible feed keeps its visibly broad diameter');
    for(const trough of named(root,'observed-covered-transfer-trough')){
      const covers=named(trough,'observed-trough-removable-cover');
      assert.equal(covers.length,3);
      assert.ok(box(covers[0]).max.x<box(covers[1]).min.x,'the separate removable lids retain visible seams');
    }
  }finally{h.dispose();}
});

test('native590 cylinder has its shell joint and green outlet lever beside a regulator manifold with two gauges and a red handwheel',()=>{
  const h=build();
  try{
    const root=h.roots.get('f3-balance-tank'),manifold=named(root,'observed-cylinder-side-manifold')[0];
    assert.equal(named(root,'observed-cylinder-circumferential-shell-joint').length,1);
    assert.equal(named(root,'observed-cylinder-green-outlet-lever').length,1);
    assert.equal(named(manifold,'gauge').length,2);
    assert.equal(named(root,'gauge').length,3,'the cylinder front dial remains separate from the two regulator gauges');
    assert.equal(named(manifold,'observed-cylinder-red-manifold-handwheel').length,1);
    assert.equal(named(manifold,'observed-cylinder-manifold-regulator').length,1);
    assert.equal(manifold.userData.liveReadingsAdded,false);
    assert.equal(manifold.userData.pipeRouteApproximate,true);
  }finally{h.dispose();}
});

test('native708 tank necks retain open bores, attached tilted lids, screw latches and wide bolted mixer flanges',()=>{
  const h=build();
  try{
    const root=h.roots.get('f3-feed-tank'),item=EQUIPMENT.find(item=>item.id==='f3-feed-tank');
    assert.equal(named(root,'observed-cip-wide-mixer-mounting-flange').length,2);
    assert.equal(named(root,'observed-cip-manhole-latch-handle').length,2);
    const hinges=named(root,'observed-cip-manhole-lid-hinge'),pins=named(root,'observed-cip-lid-hinge-pin');
    assert.equal(hinges.length,2);
    for(const [i,hinge]of hinges.entries()){
      assert.ok(Math.abs(hinge.rotation.x)>.1&&Math.abs(hinge.rotation.x)<.35,'the filmed lid lies just above the far rim rather than standing almost upright');
      const lid=box(named(hinge,'observed-open-manhole-lid')[0]),pin=pins[i].getWorldPosition(new THREE.Vector3());
      assert.ok(pin.distanceTo(lid.clampPoint(pin,new THREE.Vector3()))<.04,'the open lid remains attached at the rim hinge');
    }
    for(const z of[-1.15,1.15]){
      const ray=new THREE.Raycaster(new THREE.Vector3(item.position[0]+.33,12,item.position[2]+z+.25),new THREE.Vector3(0,-1,0),0,10),hits=ray.intersectObject(root,true);
      assert.ok(hits.length&&hits[0].point.y<item.position[1]+1,'new latches, flanges and hinged lids do not secretly close the manhole');
    }
    for(const cap of named(root,'observed-tank-cap-with-open-manhole')){
      const center=cap.localToWorld(new THREE.Vector3(-.15,0,0)),edge=cap.localToWorld(new THREE.Vector3(-.78,0,0));
      const cast=p=>new THREE.Raycaster(new THREE.Vector3(p.x,13,p.z),new THREE.Vector3(0,-1,0),0,10).intersectObject(cap)[0].point.y;
      assert.ok(cast(center)-cast(edge)>.055,'the pierced stainless roof has a broad shallow crown rather than a flat plate');
      assert.ok(cap.material.metalness>.3&&cap.material.roughness<.4,'large vessel faces retain the observed metallic surface');
    }
  }finally{h.dispose();}
});

test('native692/714 checker relief uses shared instances only on solid deck plate outside the actual hanging tank openings',()=>{
  const h=build();
  try{
    const root=h.roots.get('f3-feed-tank'),item=EQUIPMENT.find(item=>item.id==='f3-feed-tank'),relief=named(root,'observed-cip-checker-plate-relief')[0];
    assert.equal(relief.isInstancedMesh,true);assert.ok(relief.count>180);assert.equal(relief.userData.tankOpeningsUncovered,true);
    const instance=new THREE.Matrix4(),point=new THREE.Vector3();
    for(let i=0;i<relief.count;i++){
      relief.getMatrixAt(i,instance);const transform=relief.matrixWorld.clone().multiply(instance);
      for(const x of[-.0375,.0375])for(const z of[-.009,.009]){
        point.set(x,0,z).applyMatrix4(transform);
        for(const centerZ of[-1.15,1.15])assert.ok(Math.hypot(point.x-item.position[0],point.z-item.position[2]-centerZ)>.94,'no raised checker fragment bridges the open tank cutout');
      }
    }
    assert.equal(named(root,'observed-cip-landing-checker-relief').length,1);
    assert.ok(h.s.geometries.has(relief.geometry));assert.ok(h.s.materials.has(relief.material));
  }finally{h.dispose();}
});

test('native648 acid plaque faces upright and the three-display cabinet adds no invented current readings or tank identities',()=>{
  const h=build();
  try{
    const root=h.roots.get('f3-feed-tank'),sign=named(root,'observed-cip-upright-nameplate')[0],cabinet=named(root,'observed-cip-three-display-cabinet')[0];
    assert.equal(sign.userData.text,'CIP탱크(산)');
    const normal=new THREE.Vector3(0,0,1).transformDirection(sign.matrixWorld);assert.ok(Math.abs(normal.y)<1e-6,'the label is upright rather than printed horizontally at tank height');
    assert.ok(box(sign).getSize(new THREE.Vector3()).y>.3);
    assert.equal(named(cabinet,'observed-cip-static-display-window').length,3);
    assert.equal(cabinet.userData.liveReadingsAdded,false);
    assert.equal(root.userData.entireCipTankCountConfirmed,false);
    assert.deepEqual(root.userData.readableObservedTankLabels,['CIP탱크(산)']);
    assert.equal(named(root,'observed-cip-parallel-upper-pipe').length,3);
  }finally{h.dispose();}
});
