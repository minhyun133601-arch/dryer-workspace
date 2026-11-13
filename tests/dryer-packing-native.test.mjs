import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../apps/shared/vendor/three.module.js';
import { EQUIPMENT } from '../apps/site/building-data.js';
import { buildDryerProcessEquipment } from '../apps/site/dryer-process-models.js';

const ids=['f1-ica-1','f1-ica-2','f1-ica-3','f1-xray-1','f1-xray-2','f1-xray-3'];
function build(){
  const base=new THREE.MeshStandardMaterial(),s={scene:new THREE.Group(),equipment:EQUIPMENT,geometries:new Set(),materials:new Set([base]),mat:new Proxy({},{get:()=>base}),
    _group(parent,p=[0,0,0]){const g=new THREE.Group();g.position.set(...p);parent.add(g);return g;},
    _part(parent){return this._group(parent);},
    _material(color,roughness,metalness,extra={}){const m=new THREE.MeshStandardMaterial({color,roughness,metalness,...extra});this.materials.add(m);return m;},
    _mesh(geometry,material,parent,p=[0,0,0]){this.geometries.add(geometry);const mesh=new THREE.Mesh(geometry,material);mesh.position.set(...p);parent.add(mesh);return mesh;},
  },roots=new Map();
  for(const id of ids){const item=EQUIPMENT.find(item=>item.id===id),root=s._group(s.scene,item.position);root.rotation.y=item.rotation||0;assert.equal(buildDryerProcessEquipment(s,root,item),true);roots.set(id,root);}
  s.scene.updateMatrixWorld(true);
  return{s,roots,dispose(){for(const resources of[s.geometries,s.materials])for(const resource of resources)resource.dispose();}};
}
const named=(root,name)=>{const nodes=[];root.traverse(node=>{if(node.name===`dryer-process-${name}`)nodes.push(node);});return nodes;};
const bounds=root=>new THREE.Box3().setFromObject(root);
const down=(root,x,z)=>new THREE.Raycaster(new THREE.Vector3(x,6,z),new THREE.Vector3(0,-1,0),0,8).intersectObject(root,true);

test('native344/346 tall feed is a genuine twin-leg V hopper while the other two observed heads are compact round dosers',()=>{
  const h=build();
  try{
    const left=h.roots.get('f1-ica-1'),hopper=named(left,'observed-packing-rectangular-v-hopper')[0];
    assert.ok(hopper);assert.equal(named(left,'observed-packing-twin-outlet-neck').length,2);assert.equal(named(left,'observed-packing-twin-front-drive-cover').length,2);
    const frontHit=x=>{const origin=left.localToWorld(new THREE.Vector3(x,3.3,0));return new THREE.Raycaster(origin,new THREE.Vector3(0,0,-1),0,3).intersectObject(hopper);};
    assert.equal(frontHit(0).length,0,'the lower central V notch is real open space');
    for(const x of[-.34,.34])assert.ok(frontHit(x).length>0,'both sloping outlet legs retain actual volume');
    for(const id of['f1-ica-2','f1-ica-3']){
      const root=h.roots.get(id);assert.equal(named(root,'observed-packing-rectangular-v-hopper').length,0);
      assert.equal(named(root,'observed-packing-round-doser').length,1);
      assert.ok(bounds(named(root,'observed-packing-round-doser-body')[0]).max.y<3.85,'round dosers do not inherit the tall square bin');
      assert.equal(named(root,'observed-packing-flexible-feed-sock').length,1);
      assert.equal(named(root,'observed-packing-vertical-supply-pipe').length,1);
    }
  }finally{h.dispose();}
});

test('the native platform has three machinery landings, two real front recesses and a solid connecting rear walkway',()=>{
  const h=build();
  try{
    const root=h.roots.get('f1-ica-1'),deck=named(root,'observed-packing-common-service-deck')[0];
    assert.equal(deck.userData.observedFrontNotches,2);assert.equal(deck.userData.rearConnectingWalkway,true);
    const centers=['f1-ica-1','f1-ica-2','f1-ica-3'].map(id=>EQUIPMENT.find(item=>item.id===id).position[0]);
    for(const x of centers.slice(1).map((value,index)=>(centers[index]+value)/2)){
      assert.equal(down(deck,x,-4.15).length,0,'the visible recess is not filled by a full rectangular slab');
      assert.ok(down(deck,x,-5.5).length>0,'the rear strip links the individual machinery landings');
    }
    for(const x of centers)assert.ok(down(deck,x+1.2,-4.1).length>0,'each feed retains its adjacent working landing');
    const b=bounds(deck);assert.ok(Math.abs(b.min.x-(centers[0]-1.75))<1e-5&&Math.abs(b.max.x-(centers.at(-1)+1.75))<1e-5&&Math.abs(b.min.z+5.9)<1e-5&&Math.abs(b.max.z+3.7)<1e-5,'the refined outline follows the three actual machine positions inside the mezzanine void');
    assert.equal(named(root,'observed-packing-deck-diagonal-brace').length,6);
    assert.equal(named(root,'observed-packing-ladder-safety-hoop').length,4);
    assert.equal(named(root,'observed-packing-service-ladder').length,1);
    for(const id of['f1-ica-2','f1-ica-3'])assert.equal(named(h.roots.get(id),'observed-packing-ladder-safety-hoop').length,0,'the one observed caged access ladder is not duplicated on every bay');
  }finally{h.dispose();}
});

test('native cabinet differences preserve the stepped roof, full-height controls, one filmed-open service leaf and the far front display',()=>{
  const h=build();
  try{
    const a=h.roots.get('f1-ica-1'),b=h.roots.get('f1-ica-2'),c=h.roots.get('f1-ica-3');
    assert.equal(named(a,'observed-packing-full-height-control-cabinet').length,1);
    assert.equal(named(b,'observed-packing-stepped-rear-roof').length,1);
    const leaf=named(b,'observed-packing-filmed-open-service-leaf');assert.equal(leaf.length,1);assert.ok(Math.abs(leaf[0].rotation.y)>.8);assert.equal(leaf[0].userData.fixedFilmedPose,true);assert.equal(leaf[0].userData.proximityDoor,undefined);
    assert.equal(named(c,'observed-packing-front-control-header').length,1);assert.equal(named(c,'observed-packing-full-height-control-cabinet').length,0);
    for(const root of[a,b,c]){
      assert.equal(root.userData.exactOpenLineToCabinetIdentityConfirmed,false);
      assert.equal(named(root,'observed-packing-lower-metal-panel').length,2);
      assert.equal(named(root,'observed-packing-lower-door-panel').length,2);
      assert.equal(named(root,'observed-packing-door-hinge').length,4);
      assert.equal(named(root,'observed-packing-adjustable-foot').length,4);
      assert.equal(named(root,'observed-packing-sealing-guide').length,4);
    }
    assert.notEqual(bounds(named(a,'observed-packing-flat-roof')[0]).getSize(new THREE.Vector3()).x,bounds(named(c,'observed-packing-flat-roof')[0]).getSize(new THREE.Vector3()).x,'different visible cabinets do not use one repeated cube');
  }finally{h.dispose();}
});

test('observed downstream stainless benches replace unconfirmed black-curtain X-ray tunnels and retain owned finite geometry',()=>{
  const h=build();
  try{
    let trays=0;
    for(const id of['f1-xray-1','f1-xray-2','f1-xray-3']){
      const root=h.roots.get(id);assert.equal(named(root,'observed-stainless-output-bench').length,1);
      assert.equal(named(root,'xray-tunnel').length,0);assert.equal(named(root,'xray-curtain').length,0);
      assert.equal(root.userData.observedDownstreamInspection.blackCurtainTunnelObserved,false);
      trays+=named(root,'observed-output-inset-tray').length;
    }
    assert.equal(trays,4);
    for(const root of h.roots.values())root.traverse(mesh=>{if(mesh.isMesh){assert.ok(h.s.geometries.has(mesh.geometry));assert.ok(h.s.materials.has(mesh.material));mesh.geometry.computeBoundingBox();assert.ok([...mesh.geometry.boundingBox.min.toArray(),...mesh.geometry.boundingBox.max.toArray()].every(Number.isFinite));}});
  }finally{h.dispose();}
});
