import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../apps/shared/vendor/three.module.js';
import { DRYER_BUILDING_FLOORS } from '../apps/site/dryer-building-data.js';
import { buildDryerBuildingEnvironment } from '../apps/site/dryer-building-envelope.js';
import { buildDryerRouteEnvironment } from '../apps/site/dryer-route-environment.js';
import { createProximityDoorController } from '../apps/site/proximity-doors.js';

function fixture(level){
  const s={scene:new THREE.Scene(),geometries:new Set(),materials:new Set(),textures:new Set(),
    _group(parent,p=[0,0,0]){const node=new THREE.Group();node.position.set(...p);parent.add(node);return node;},
    _material(color,roughness=.7,metalness=.1,extra={}){const value=new THREE.MeshStandardMaterial({color,roughness,metalness,...extra});this.materials.add(value);return value;},
    _mesh(geometry,material,parent,p=[0,0,0]){this.geometries.add(geometry);const node=new THREE.Mesh(geometry,material);node.position.set(...p);parent.add(node);return node;},
  },spec=DRYER_BUILDING_FLOORS[level],environment=buildDryerBuildingEnvironment(s,{floor:level,spec});
  buildDryerRouteEnvironment(s,environment,spec);s.scene.updateMatrixWorld(true);
  return{s,spec,environment,dispose(){for(const set of [s.geometries,s.materials,s.textures])for(const resource of set)resource.dispose();}};
}
const bounds=node=>new THREE.Box3().setFromObject(node);
const cast=(origin,direction,objects,far=2)=>new THREE.Raycaster(new THREE.Vector3(...origin),new THREE.Vector3(...direction),0,far).intersectObjects(objects,true);
const named=(root,name)=>{const all=[];root.traverse(node=>{if(node.name===name)all.push(node);});return all;};

test('the blue first-floor finish stays on its real slab and the yellow stair glazing has an actual wall opening',()=>{
  const h=fixture(1);
  try{
    const blue=h.environment.deck.getObjectByName('dryer-route-observed-packing-blue-floor');
    assert.ok(blue);assert.equal(blue.userData.positionBasis,'video-observed floor color; approximate registration');
    const b=bounds(blue);assert.ok(b.max.y-h.spec.elevation<.03&&b.min.x>=h.spec.bounds.minX&&b.max.x<=h.spec.bounds.maxX);
    const window=h.environment.architectureFixtures.getObjectByName('dryer-route-1-entrance-stair-yellow-window-glazing');
    assert.ok(window);
    const point=window.localToWorld(new THREE.Vector3(.55,2.1,0));
    assert.ok(cast([point.x-.6,point.y,point.z],[1,0,0],[window],1.2).some(hit=>hit.object.name==='dryer-route-observation-window-glass'));
    assert.equal(cast([point.x-.6,point.y,point.z],[1,0,0],[h.environment.facade,h.environment.structure],1.2).length,0,'the yellow stair glass is not backed by an uncut opaque exterior wall');
  }finally{h.dispose();}
});

test('both mezzanine room doors have real wall gaps and open their leaves without moving their jambs',()=>{
  const h=fixture(2);let controller;
  try{
    controller=createProximityDoorController(h.s.scene);
    for(const [id,data]of [['dressing',h.spec.routeSurvey.dressingRoom],['op',h.spec.routeSurvey.opRoom]]){
      const root=h.environment.architectureFixtures.getObjectByName(`dryer-route-2-${id}-doorway`),fixed=root.matrixWorld.clone();
      assert.ok(root);
      const normal=new THREE.Vector3(0,0,1).transformDirection(root.matrixWorld),point=root.localToWorld(new THREE.Vector3(0,1.25,0));
      const origin=point.clone().addScaledVector(normal,.6);
      assert.equal(cast(origin.toArray(),normal.clone().negate().toArray(),[h.environment.structure,h.environment.facade],1.2).length,0,`${id} door gap is open through both wall layers`);
      assert.ok(cast(origin.toArray(),normal.clone().negate().toArray(),[root],1.2).some(hit=>hit.object.name==='dryer-route-door-upper-window'),'the doorway starts with a physical glazed leaf');
      const at=root.localToWorld(new THREE.Vector3(0,0,.35));
      for(let i=0;i<10;i++)controller.update(at,.1,{autoOpen:true});
      h.s.scene.updateMatrixWorld(true);
      assert.ok(root.matrixWorld.equals(fixed));
      const leaf=root.children.find(node=>node.userData.proximityDoor);
      assert.equal(leaf.rotation.y,leaf.userData.proximityDoor.open);
      assert.equal(cast(origin.toArray(),normal.clone().negate().toArray(),[root],1.2).length,0,`${id} opens a clear central passage`);
      assert.ok(data.bounds.minX-1e-6<=data.door[0]&&data.bounds.maxX+1e-6>=data.door[0]);
    }
  }finally{controller?.dispose();h.dispose();}
});

test('dressing lockers stand on the raised floor and the model keeps one anonymous dressing room',()=>{
  const h=fixture(2);
  try{
    const room=h.environment.architectureFixtures.getObjectByName('dryer-route-2-dressing-room-furnishings'),wood=bounds(h.environment.deck.getObjectByName('dryer-route-dressing-raised-wood-floor'));
    const tan=named(room,'dryer-route-tan-dressing-locker'),gray=named(room,'dryer-route-gray-dressing-locker');
    assert.equal(tan.length,12);assert.equal(gray.length,4);
    const bottom=Math.min(...tan.map(node=>bounds(node).min.y),...gray.map(node=>bounds(node).min.y));
    assert.ok(Math.abs(bottom-wood.max.y)<1e-5,'the observed two-tier lockers meet the wood floor instead of floating above it');
    assert.equal(h.environment.architectureFixtures.getObjectByName('dryer-route-2-dressing-doorway').userData.genderConfirmed,false);
    assert.ok(room.getObjectByName('dryer-route-split-airconditioner'));
    assert.ok(room.getObjectByName('dryer-route-recessed-stainless-service-cabinet'));
    for(const node of tan)assert.equal(node.userData.anonymousLocker,true);
    assert.equal(named(h.environment.architectureFixtures,'dryer-route-2-dressing-room-furnishings').length,1);
    const count=h.environment.architectureFixtures.children.length;
    buildDryerRouteEnvironment(h.s,h.environment,h.spec);
    assert.equal(h.environment.architectureFixtures.children.length,count,'calling the builder twice cannot duplicate the room');
  }finally{h.dispose();}
});

test('OP observation glazing has no opaque backing while the tall production void remains open',()=>{
  const h=fixture(2);
  try{
    const north=h.environment.architectureFixtures.getObjectByName('dryer-route-2-op-north-glazing');
    assert.ok(north);
    const pane=north.children.find(node=>node.name==='dryer-route-observation-window-glass'),point=pane.getWorldPosition(new THREE.Vector3());
    assert.equal(cast([point.x,point.y,point.z-.5],[0,0,1],[h.environment.structure,h.environment.facade],1).length,0,'the north OP windows overlook the blue-floor filling hall through a genuine opening');
    assert.ok(cast([point.x,point.y,point.z-.5],[0,0,1],[north],1).some(hit=>hit.object.material.transparent));
    assert.equal(cast([-4.5,20,0],[0,-1,0],[h.environment.deck],25).length,0,'the high blue packing hall stays genuinely double-height');
    assert.ok(cast([-8,20,0],[0,-1,0],[h.environment.deck],25).length,'the narrow west route retains a supported walkway');
    const op=h.environment.architectureFixtures.getObjectByName('dryer-route-2-op-room-furnishings');
    const controls=op.getObjectByName('dryer-route-2-observed-control-cabinet-row');
    assert.equal(controls.userData.liveOperatingValuesAdded,false);
    assert.ok(op.getObjectByName('dryer-route-2-office-printer-and-binders'));
    assert.ok(op.getObjectByName('dryer-route-2-office-bookcase'));
  }finally{h.dispose();}
});

test('the photographed yellow enclosure opens to its shelving without expanding the third-floor envelope',()=>{
  const h=fixture(3);let controller;
  try{
    const room=h.environment.architectureFixtures.getObjectByName('dryer-route-3-yellow-glazed-storage-room'),door=h.environment.architectureFixtures.getObjectByName('dryer-route-3-yellow-storage-doorway');
    assert.equal(room.userData.interiorObserved,true);assert.equal(room.userData.functionInferred,true);
    assert.ok(room.getObjectByName('dryer-route-3-observed-storage-shelving'));
    const normal=new THREE.Vector3(0,0,1).transformDirection(door.matrixWorld),point=door.localToWorld(new THREE.Vector3(0,1.25,0)),origin=point.clone().addScaledVector(normal,.55);
    assert.equal(cast(origin.toArray(),normal.clone().negate().toArray(),[h.environment.structure,h.environment.facade],1.1).length,0);
    controller=createProximityDoorController(h.s.scene);for(let i=0;i<10;i++)controller.update(door.localToWorld(new THREE.Vector3(0,0,.3)),.1,{autoOpen:true});h.s.scene.updateMatrixWorld(true);
    assert.equal(cast(origin.toArray(),normal.clone().negate().toArray(),[door],1.1).length,0);
    const details=h.environment.architectureFixtures.getObjectByName('dryer-route-3-details');
    const b=bounds(details);assert.ok(b.min.x>=h.spec.mainBounds.minX&&b.max.x<=h.spec.northEastBay.maxX&&b.min.z>=h.spec.mainBounds.minZ&&b.max.z<=h.spec.mainBounds.maxZ,'all added room context fits the tower and its real adjoining stair landing');
    assert.equal(cast([20,20,10],[0,-1,0],[h.environment.deck],25).length,0,'the low-wing roof is not turned into indoor third-floor space');
  }finally{controller?.dispose();h.dispose();}
});

test('room furniture leaves the recorded door approaches and usable interior aisles clear',()=>{
  const two=fixture(2),three=fixture(3),instance=new THREE.Matrix4();
  try{
    const overlaps=(a,b)=>['x','y','z'].every(axis=>Math.min(a.max[axis],b.max[axis])-Math.max(a.min[axis],b.min[axis])>.005);
    const inspect=(root,volume)=>{
      const collisions=[];
      root.traverse(node=>{
        if(!node.isMesh)return;node.geometry.computeBoundingBox();
        const testMatrix=matrix=>{if(overlaps(node.geometry.boundingBox.clone().applyMatrix4(matrix),volume))collisions.push(node.name);};
        if(node.isInstancedMesh)for(let i=0;i<node.count;i++){node.getMatrixAt(i,instance);testMatrix(node.matrixWorld.clone().multiply(instance));}
        else testMatrix(node.matrixWorld);
      });
      assert.deepEqual(collisions,[],`${root.name} retains the modelled walking aisle`);
    };
    const base=two.spec.elevation;
    for(const [x,z]of [[33.7,19.3],[33.7,17.8],[30.4,17.8]])assert.ok(cast([x,10,z],[0,-1,0],[two.environment.deck],12).length,'the stair landing and dressing-room approach remain on real floor beside the open stairwell');
    inspect(two.environment.architectureFixtures.getObjectByName('dryer-route-2-dressing-room-furnishings'),new THREE.Box3(new THREE.Vector3(29.95,base+.1,15.1),new THREE.Vector3(30.85,base+1.8,18.2)));
    const op=two.environment.architectureFixtures.getObjectByName('dryer-route-2-op-room-furnishings');
    inspect(op,new THREE.Box3(new THREE.Vector3(-5.35,base+.1,8.65),new THREE.Vector3(-1,base+1.8,9.55)));
    inspect(op,new THREE.Box3(new THREE.Vector3(-4.15,base+.1,4.7),new THREE.Vector3(-3.25,base+1.8,9.55)));
    const enclosure=three.spec.routeSurvey.glazedEnclosure,[doorX,doorZ]=three.spec.routeSurvey.storageDoor.position;
    inspect(three.environment.architectureFixtures.getObjectByName('dryer-route-3-yellow-glazed-storage-room'),new THREE.Box3(new THREE.Vector3(doorX-.45,three.spec.elevation+.1,doorZ+.05),new THREE.Vector3(doorX+.45,three.spec.elevation+1.8,enclosure.maxZ-.1)));
  }finally{two.dispose();three.dispose();}
});

test('the recorded white connecting door opens from the conveyor return into the older process area',()=>{
  const h=fixture(3);
  try{
    const gate=h.spec.routeSurvey.hallRegistration.connectingDoor;
    const model=h.environment.architectureFixtures.getObjectByName('dryer-route-3-'+gate.id+'-doorway');
    const leaf=model.children.find(n=>n.userData.doorLeaf);
    const inside=model.localToWorld(new THREE.Vector3(0,1.45,-.42));
    const outside=model.localToWorld(new THREE.Vector3(0,1.45,.42));
    const direction=inside.clone().sub(outside).normalize();
    assert.deepEqual(model.userData.sourceTimesSeconds,gate.sourceTimes);
    assert.equal(leaf.userData.proximityDoor.enterable,true);
    assert.ok(leaf.getObjectByName('dryer-route-process-side-horizontal-bar'));
    assert.ok(cast(outside.toArray(),direction.toArray(),[leaf],.85).length);
    const controller=createProximityDoorController(h.s.scene);
    try{
      const visitor=model.localToWorld(new THREE.Vector3(0,0,.63));
      for(let i=0;i<16;i++)controller.update(visitor,.1,{autoOpen:true});
      h.s.scene.updateMatrixWorld(true);
      for(const offset of [-.28,0,.28]){
        const start=model.localToWorld(new THREE.Vector3(offset,1.45,.42));
        assert.equal(cast(start.toArray(),direction.toArray(),[h.environment.structure,h.environment.facade,model],.85).length,0,'the capsule-width opening is physically clear');
      }
    }finally{controller.dispose();}
  }finally{h.dispose();}
});

test('the native overlook room keeps six open jet outlets and two wrapped bundles as independently owned context',()=>{
  const h=fixture(1);
  try{
    const context=h.environment.architectureFixtures.getObjectByName('dryer-route-1-blue-packing-room-context');
    const hvac=context.getObjectByName('dryer-route-1-six-jet-plenum-and-lower-cabinet');
    assert.equal(hvac.userData.observedJetOutlets,6);
    const jets=named(hvac,'dryer-route-1-round-jet-outlet');assert.equal(jets.length,6);
    for(const jet of jets){
      const center=jet.getWorldPosition(new THREE.Vector3());
      const shell=jet.getObjectByName('dryer-route-open-jet-bore');
      assert.equal(cast([center.x,center.y,center.z+.5],[0,0,-1],[shell],1).length,0,'the round nozzle is a hollow outlet rather than a solid white disc');
    }
    assert.ok(hvac.getObjectByName('dryer-route-lower-air-cabinet'));
    const bundles=h.environment.architectureFixtures.getObjectByName('dryer-route-1-green-wrapped-corrugated-bundles');
    assert.equal(bundles.userData.observedMinimumTallBundles,2);
    assert.equal(named(bundles,'dryer-route-wrapped-cardboard-bundle').length,2);
    assert.equal(context.getObjectByName('dryer-route-1-observed-floor-fan').userData.operatingAnimationAdded,false);
  }finally{h.dispose();}
});

test('the packing clean room has a closed rear wall, an open observation face and cutaway ceilings over the filmed corridor',()=>{
  const one=fixture(1),two=fixture(2);
  try{
    assert.ok(cast([0,one.spec.elevation+3,-5.8],[0,0,-1],[one.environment.facade],1.2).length,'the green hall and elevator behind the packing machines are screened by the clean-room rear wall');
    const upper=one.environment.facade.getObjectByName('dryer-route-1-blue-clean-room-west-upper-wall');
    assert.equal(cast([-6,one.spec.elevation+5.1,0],[1,0,0],[upper],1).length,0,'the elevated west observation window is cut through the inner corridor wall');
    const glazing=one.environment.architectureFixtures.getObjectByName('dryer-route-1-blue-clean-room-upper-observation-glazing');
    assert.ok(cast([-6,one.spec.elevation+5.1,0],[1,0,0],[glazing],1).some(hit=>hit.object.name==='dryer-route-observation-window-glass'));
    assert.equal(cast([0,one.spec.elevation+2.5,2.6],[0,0,1],[one.environment.structure,one.environment.facade],.7).length,0,'no extra wall closes the existing OP observation face');
    for(const [name,point]of [['south-observation-corridor',[10,17.8]],['west-observation-corridor',[-7,15]],['op-room',[-2,8]]]){
      const ceiling=two.environment.facade.getObjectByName(`dryer-route-2-${name}-suspended-ceiling`);
      assert.ok(ceiling);assert.equal(ceiling.userData.cutawayWithFacade,true);
      assert.ok(cast([point[0],two.spec.elevation+2,point[1]],[0,1,0],[ceiling],1).length,'a person in the corridor sees the tiled ceiling rather than the upper floor machinery');
    }
    const arrows=named(two.environment.architectureFixtures,'dryer-route-yellow-floor-direction-arrow');
    for(const arrow of arrows){const p=arrow.getWorldPosition(new THREE.Vector3());assert.ok(cast([p.x,p.y-.005,p.z],[0,-1,0],[two.environment.deck],.1).length,'direction arrows stay over real walkable floor');}
  }finally{one.dispose();two.dispose();}
});

test('the upper stair faces its landing window and returns straight to the third-floor door with continuous floor support',()=>{
  const two=fixture(2),three=fixture(3);let controller;
  try{
    const core=two.spec.stairs[0],stair=two.environment.architectureFixtures.getObjectByName('dryer-building-2-northeast-stair');
    assert.equal(core.runAxis,'z');assert.equal(core.startDirection,-1);
    const width=core.bounds.maxX-core.bounds.minX,depth=core.bounds.maxZ-core.bounds.minZ,lane=Math.min(1.25,(width-.25)/2),offset=lane/2+.06,run=Math.max(1.8,Math.min(4,depth-1.7)),rise=two.spec.height/2,count=Math.ceil(rise/.18);
    const roots=[two.environment.deck,two.environment.architectureFixtures,three.environment.deck];
    const supported=(point,y,label)=>{const hits=cast([point.x,y+.12,point.z],[0,-1,0],roots,.25);assert.ok(hits.some(hit=>Math.abs(hit.point.y-y)<.012),label);};
    const world=local=>stair.localToWorld(new THREE.Vector3(...local));
    const lowerZ=two.spec.routeSurvey.upperStair.lowerDoor[1];
    for(const [x,z]of [[-8,-5.6],[-7,-6],[-7,lowerZ],[-7,-7.25]])supported(new THREE.Vector3(x,0,z),two.spec.elevation,'the lower corridor reaches the stair door on real floor');
    for(let flight=0;flight<2;flight++){
      const direction=flight===0?-1:1;
      for(let step=0;step<count;step++){
        const point=world([flight===0?-offset:offset,0,direction*(-run/2+(step+.5)*run/count)]),y=two.spec.elevation+rise*(flight+(step+1)/count);
        supported(point,y,`flight ${flight+1} tread ${step+1} supports the person`);
      }
    }
    for(let i=0;i<=8;i++)supported(world([-offset+2*offset*i/8,0,-run/2-.4]),two.spec.elevation+rise,'the window landing supports the half-turn between flights');
    const door=three.environment.architectureFixtures.children.find(node=>node.userData.observedDoorStyle==='perforated'),doorPosition=door.getWorldPosition(new THREE.Vector3());
    const elevator=three.spec.cores.elevator.bounds,start=three.spec.personStart.position;
    assert.ok(start[0]<elevator.minX||start[0]>elevator.maxX||start[2]<elevator.minZ||start[2]>elevator.maxZ,'the third-floor arrival stands in the hall, clear of the historical elevator shaft');
    const upper=world([offset,0,run/2+.4]);assert.ok(Math.abs(upper.x-doorPosition.x)<1e-6,'the upper flight points directly at the perforated door');
    for(let i=0;i<=12;i++){const z=upper.z+(start[2]-upper.z)*i/12;supported(new THREE.Vector3(upper.x,0,z),three.spec.elevation,'the upper landing reaches the door and indoor hall without a floor hole');}
    controller=createProximityDoorController(three.s.scene);const at=new THREE.Vector3(doorPosition.x,three.spec.elevation,doorPosition.z-.4);assert.ok(controller.toggleNearest(at));for(let i=0;i<10;i++)controller.update(at,.1,{autoOpen:false});three.s.scene.updateMatrixWorld(true);
    const leaf=door.getObjectByName('architectural-open-door-leaf');assert.equal(leaf.rotation.y,leaf.userData.proximityDoor.open,'the upper door responds from the actual stair landing');
    assert.equal(cast([doorPosition.x,three.spec.elevation+1.2,doorPosition.z-.4],[0,0,1],[door],.8).length,0,'the opened upper door leaves the arrival passage clear');
    assert.equal(DRYER_BUILDING_FLOORS[1].stairs[0].id,'southeast-stair');assert.equal(DRYER_BUILDING_FLOORS[1].stairs[0].runAxis,'x','the confirmed entrance stair is retained');
  }finally{controller?.dispose();two.dispose();three.dispose();}
});

test('the corrected mezzanine keeps a full-width overlook, a shared dressing landing and separate down/up stair choices',()=>{
  const two=fixture(2),three=fixture(3);
  try{
    const base=two.spec.elevation;
    for(const z of [-5.8,-3,0,2.8,4,8,12,16])for(const x of [-8.1,-7,-5.9]){
      const hits=cast([x,base+.12,z],[0,-1,0],[two.environment.deck],.25);
      assert.ok(hits.some(hit=>Math.abs(hit.point.y-base)<.03),`the same 2.9 m corridor supports ${x},${z}`);
    }
    const dressing=two.spec.routeSurvey.dressingRoom,entry=DRYER_BUILDING_FLOORS[1].stairs[0],landing=dressing.arrivalLanding;
    assert.equal(dressing.adjacentStairId,entry.id);
    assert.ok(landing.minZ>=dressing.bounds.maxZ-1e-6&&landing.maxZ<=entry.bounds.minZ+1e-6,'the landing fits between the room wall and stair opening');
    assert.ok(landing.maxZ-landing.minZ>=1.2-1e-6,'the dressing door has usable landing depth instead of overlapping the stair');
    for(const id of ['route-turn-down-stair','route-end-down-stair']){
      const stair=two.environment.architectureFixtures.getObjectByName(`dryer-building-2-${id}`);
      assert.equal(stair.userData.fromY,.3);assert.equal(stair.userData.toY,base);
      assert.deepEqual(stair.userData.visibleFloors,[1,2]);
    }
    assert.equal(cast([-7,8,-10],[0,-1,0],[three.environment.deck],1).length,0,'neither the 3F slab nor its floor finish fills the return stair opening');
    const ibcs=three.environment.architectureFixtures.getObjectByName('dryer-route-3-three-observed-ibc-containers');
    assert.ok(bounds(ibcs).min.x>-5.5,'the IBC row stands beside the new stair opening instead of above its ascending lane');
  }finally{two.dispose();three.dispose();}
});
