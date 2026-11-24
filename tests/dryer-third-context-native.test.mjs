import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../apps/shared/vendor/three.module.js';
import { DRYER_BUILDING_FLOORS } from '../apps/site/dryer-building-data.js';
import { buildDryerBuildingEnvironment } from '../apps/site/dryer-building-envelope.js';
import { buildDryerRouteEnvironment } from '../apps/site/dryer-route-environment.js';

function fixture(){
  const s={scene:new THREE.Scene(),geometries:new Set(),materials:new Set(),textures:new Set(),
    _group(parent,p=[0,0,0]){const node=new THREE.Group();node.position.set(...p);parent.add(node);return node;},
    _material(color,roughness=.7,metalness=.1,extra={}){const material=new THREE.MeshStandardMaterial({color,roughness,metalness,...extra});this.materials.add(material);return material;},
    _mesh(geometry,material,parent,p=[0,0,0]){this.geometries.add(geometry);const node=new THREE.Mesh(geometry,material);node.position.set(...p);parent.add(node);return node;},
  },spec=DRYER_BUILDING_FLOORS[3],environment=buildDryerBuildingEnvironment(s,{floor:3,spec});
  buildDryerRouteEnvironment(s,environment,spec);s.scene.updateMatrixWorld(true);
  return{s,spec,environment,dispose(){for(const set of[s.geometries,s.materials,s.textures])for(const resource of set)resource.dispose();}};
}
const named=(root,name)=>{const nodes=[];root.traverse(node=>{if(node.name===`dryer-route-${name}`)nodes.push(node);});return nodes;};
const box=root=>new THREE.Box3().setFromObject(root);
const ray=(origin,direction,objects,far=1)=>new THREE.Raycaster(new THREE.Vector3(...origin),new THREE.Vector3(...direction),0,far).intersectObjects(objects,true);
function meshBoxes(root,visit){
  const instance=new THREE.Matrix4();
  root.traverse(node=>{
    if(!node.isMesh)return;node.geometry.computeBoundingBox();
    if(node.isInstancedMesh)for(let i=0;i<node.count;i++){node.getMatrixAt(i,instance);visit(node,node.geometry.boundingBox.clone().applyMatrix4(node.matrixWorld.clone().multiply(instance)));}
    else visit(node,node.geometry.boundingBox.clone().applyMatrix4(node.matrixWorld));
  });
}

test('both yellow window rows are transparent openings above one stainless sill per wall run',()=>{
  const h=fixture();
  try{
    const details=h.environment.architectureFixtures.getObjectByName('dryer-route-3-details');
    const bands=details.children.filter(node=>node.name.startsWith('dryer-route-3-third-exterior-'));
    assert.equal(bands.length,8);
    for(const band of bands){
      const pane=named(band,'observation-window-glass')[0],point=pane.getWorldPosition(new THREE.Vector3()),side=band.userData.registeredSide==='west'?1:-1;
      assert.ok(ray([point.x+side*.35,point.y,point.z],[-side,0,0],[band],.7).some(hit=>hit.object.material.transparent));
      assert.equal(ray([point.x+side*.35,point.y,point.z],[-side,0,0],[h.environment.structure,h.environment.facade],.7).length,0,'neither stacked row has opaque wall behind its glass');
    }
    const sills=named(details,'stainless-window-lower-protection');assert.equal(sills.length,4);
    for(const sill of sills)assert.ok(box(sill).max.y<h.spec.elevation+1,'stainless protection stays below the first row');
  }finally{h.dispose();}
});

test('the observed minimum three IBCs have separate pallets, tank bodies, protective cages and fill caps',()=>{
  const h=fixture();
  try{
    const row=h.environment.architectureFixtures.getObjectByName('dryer-route-3-three-observed-ibc-containers');
    assert.equal(row.children.length,3);assert.equal(row.userData.observedMinimumContainerCount,3);
    assert.equal(row.userData.contentsConfirmed,false);assert.equal(row.userData.catalogEquipmentAdded,false);
    for(const ibc of row.children){
      const pallet=box(named(ibc,'ibc-black-pallet-base')[0]),tank=box(named(ibc,'ibc-white-container')[0]);
      assert.ok(pallet.min.y>=h.spec.elevation&&pallet.max.y>tank.min.y-.05,'each tank is grounded on its own pallet');
      assert.ok(named(ibc,'ibc-red-fill-cap').length===1);
      for(const name of['ibc-cage-vertical-rails','ibc-cage-front-back-rails','ibc-cage-side-rails']){
        const cage=named(ibc,name)[0];assert.ok(cage?.isInstancedMesh&&cage.count>=10);
      }
      const cage=box(named(ibc,'ibc-cage-front-back-rails')[0]);assert.ok(cage.max.z>tank.max.z&&cage.min.z<tank.min.z,'the cage surrounds the tank instead of lying inside it');
    }
  }finally{h.dispose();}
});

test('drain covers are flush floor details with visible dark gaps, not raised walking barriers',()=>{
  const h=fixture();
  try{
    const drains=h.environment.architectureFixtures.getObjectByName('dryer-route-3-observed-flush-drain-channels');
    assert.equal(drains.children.length,2);assert.equal(drains.userData.fullNetworkConfirmed,false);
    for(const channel of drains.children){
      assert.ok(box(channel).max.y-h.spec.elevation<=.00801);
      const grates=named(channel,'drain-removable-cover-grates')[0],matrix=new THREE.Matrix4();grates.getMatrixAt(0,matrix);
      const center=new THREE.Vector3().setFromMatrixPosition(matrix),p=channel.localToWorld(center.clone());
      const hits=ray([p.x,h.spec.elevation+.3,p.z],[0,-1,0],[channel,h.environment.deck],.6);
      assert.equal(hits[0].object,grates,'grates remain above the floor slab and visible');
      const gap=channel.localToWorld(new THREE.Vector3(center.x-.035,0,0));
      assert.equal(ray([gap.x,h.spec.elevation+.3,gap.z],[0,-1,0],[channel,h.environment.deck],.6)[0].object.name,'dryer-route-drain-dark-recess','a real space between bars shows the channel beneath');
    }
  }finally{h.dispose();}
});

test('overhead ducts and pipe runs have ceiling hangers while the reduced hall and central walking route stay clear',()=>{
  const h=fixture();
  try{
    const overhead=h.environment.ducts.getObjectByName('dryer-route-3-third-hall-overhead-services'),ceiling=h.environment.facade.getObjectByName('dryer-route-3-third-exposed-ceiling-context');
    assert.equal(overhead.userData.connectsToEquipment,false);assert.equal(overhead.userData.unseenConnectionsAdded,false);
    const duct=box(named(overhead,'third-galvanized-open-spiral-duct')[0]),crossbar=box(named(overhead,'third-duct-hanger-crossbars')[0]),rods=box(named(overhead,'third-duct-hanger-rods')[0]);
    assert.ok(Math.abs(crossbar.max.y-duct.min.y)<.001,'the transverse supports meet the duct');
    assert.ok(rods.min.y<=crossbar.max.y&&rods.max.y>box(ceiling).min.y,'the rods reach from supports to ceiling beams');
    assert.equal(named(overhead,'third-visible-blue-silver-run').length,4);
    assert.ok(named(overhead,'third-pipe-tray-hanger-rods')[0].count===8);
    const passage=new THREE.Box3(new THREE.Vector3(.8,7.45,-5.1),new THREE.Vector3(2,9.1,10.5)),b=h.spec.mainBounds;
    const added=[h.environment.architectureFixtures.getObjectByName('dryer-route-3-details'),...h.environment.ducts.children.filter(node=>node.name.startsWith('dryer-route-3-')),ceiling];
    for(const root of added)meshBoxes(root,(node,volume)=>{
      const inside=region=>volume.min.x>=region.minX-.0001&&volume.max.x<=region.maxX+.0001&&volume.min.z>=region.minZ-.0001&&volume.max.z<=region.maxZ+.0001;
      assert.ok(inside(b)||inside(h.spec.northEastBay),`${node.name} stays inside the tower or its real adjoining stair bay`);
      assert.ok(!volume.intersectsBox(passage),`${node.name} leaves the central person route unobstructed`);
      assert.ok(volume.max.y<=h.spec.elevation+h.spec.height+.0001);
    });
    assert.ok(box(overhead).min.y-h.spec.elevation>=3.49,'the only lower branch is the observed wall-side riser');
  }finally{h.dispose();}
});

test('the yellow room uses a narrow real glazed door and the unseen shutter destination remains closed',()=>{
  const h=fixture();
  try{
    const doorway=h.environment.architectureFixtures.getObjectByName('dryer-route-3-yellow-storage-doorway'),leaf=doorway.children.find(node=>node.userData.doorLeaf),glass=named(leaf,'door-upper-window')[0];
    const ratio=glass.scale.x/named(leaf,'door-lower-panel')[0].scale.x;
    assert.ok(ratio>.57&&ratio<.63,'the filmed upper pane occupies about sixty percent of the leaf width');
    const normal=new THREE.Vector3(0,0,1).transformDirection(leaf.matrixWorld);
    for(const [x,transparent]of [[.525,true],[.125,false],[.925,false]]){
      const p=leaf.localToWorld(new THREE.Vector3(x,1.5,0));
      const hits=ray(p.clone().addScaledVector(normal,.3).toArray(),normal.clone().negate().toArray(),[leaf],.6);
      assert.ok(hits.length);assert.equal(!!hits[0].object.material.transparent,transparent,'the narrow pane has actual opaque side panels');
    }
    const shutter=h.environment.architectureFixtures.getObjectByName('dryer-route-3-closed-observed-gray-roller');
    assert.equal(shutter.userData.enterable,false);assert.equal(shutter.userData.unseenInteriorAdded,false);assert.equal(shutter.userData.openingAnimationAdded,false);
    assert.equal(named(shutter,'gray-roller-closed-curtain').length,1);
    shutter.traverse(node=>assert.equal(!!node.userData.proximityDoor,false,'a closed unvisited room is not made enterable'));
    const p=shutter.localToWorld(new THREE.Vector3(0,1.3,0));
    assert.equal(ray([p.x,p.y,p.z-.35],[0,0,1],[h.environment.structure,h.environment.facade],.7).length,0,'the shutter occupies a real opening rather than covering another wall');
    assert.ok(ray([p.x,p.y,p.z-.35],[0,0,1],[shutter],.7).length>0,'the static slatted curtain blocks the opening');
  }finally{h.dispose();}
});

test('the north shutter, yellow enclosure and lift appear west to east and the two hall areas share a walkable reference boundary',()=>{
  const h=fixture();
  try{
    const {glazedEnclosure,shutter,hallRegistration}=h.spec.routeSurvey;
    const elevator=h.environment.architectureFixtures.getObjectByName('dryer-building-3-elevator-landing-doors');
    assert.equal(shutter.side,'north');
    assert.ok(shutter.position[0]+shutter.width/2 <= glazedEnclosure.minX);
    assert.ok(glazedEnclosure.maxX < elevator.position.x);
    assert.ok(glazedEnclosure.maxZ < -8.9);
    const ref=h.environment.architectureFixtures.getObjectByName('dryer-route-3-hall-area-reference');
    assert.equal(ref.userData.floorMapCaption,true);
    assert.equal(ref.userData.personCollision,false);
    assert.equal(hallRegistration.physicalPartitionSurveyed,false);
    assert.deepEqual(hallRegistration.areas.map(a=>a.equipment.length),[1,4]);
    assert.equal(ray([6.8,8.8,-9.48],[0,0,1],[h.environment.facade,h.environment.structure],1.9).length,0,'lift threshold has a clear forward view to the paired drive heads');
    assert.ok(box(ref).max.y < h.spec.elevation+.1,'dashed map notation does not introduce a physical partition');
  }finally{h.dispose();}
});
