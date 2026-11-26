import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../apps/shared/vendor/three.module.js';
import { EQUIPMENT } from '../apps/site/building-data.js';
import { DRYER_BUILDING_FLOORS, dryerStairWalkPoints } from '../apps/site/dryer-building-data.js';
import { buildDryerBuildingEnvironment } from '../apps/site/dryer-building-envelope.js';
import { buildDryerRouteEnvironment } from '../apps/site/dryer-route-environment.js';
import { buildDryerProcessEquipment } from '../apps/site/dryer-process-models.js';
import { buildPreparationEnvironment } from '../apps/site/preparation-environment.js';

function fixture({levels=[1,2],entryContext=false,openDoors=false}={}){
  const s={scene:new THREE.Scene(),equipment:EQUIPMENT,geometries:new Set(),materials:new Set(),textures:new Set(),
    _group(parent,p=[0,0,0]){const g=new THREE.Group();g.position.set(...p);parent.add(g);return g;},
    _material(color,roughness=.7,metalness=.1,extra={}){const m=new THREE.MeshStandardMaterial({color,roughness,metalness,...extra});this.materials.add(m);return m;},
    _mesh(geometry,material,parent,p=[0,0,0]){const m=new THREE.Mesh(geometry,material);m.position.set(...p);parent.add(m);this.geometries.add(geometry);return m;},
    _part(parent,name){const g=this._group(parent);g.name=name;return g;},
  };
  const base=s._material(0xaaaaaa);s.mat=new Proxy({},{get:()=>base});
  const environments=new Map();
  for(const level of levels){const spec=DRYER_BUILDING_FLOORS[level],env=buildDryerBuildingEnvironment(s,{floor:level,spec});buildDryerRouteEnvironment(s,env,spec);environments.set(level,env);}
  if(entryContext)buildPreparationEnvironment(s,environments.get(1),DRYER_BUILDING_FLOORS[1]);
  for(const item of EQUIPMENT.filter(item=>item.floor===1&&item.dryerRoute?.kind.startsWith('overlook-'))){const root=s._group(s.scene,item.position);root.rotation.y=item.rotation||0;assert.ok(buildDryerProcessEquipment(s,root,item));}
  if(openDoors)s.scene.traverse(node=>{const door=node.userData.proximityDoor;if(door)node[door.kind==='hinge'?'rotation':'position'][door.axis]=door.open;});
  s.scene.updateMatrixWorld(true);
  const meshes=[],solids=[],temp=new THREE.Matrix4();
  s.scene.traverse(m=>{
    if(!m.isMesh)return;meshes.push(m);
    if(!['BoxGeometry','CylinderGeometry'].includes(m.geometry.type)||(m.material.transparent&&m.material.opacity<.99))return;
    m.geometry.computeBoundingBox();
    for(let i=0;i<(m.isInstancedMesh?m.count:1);i++){
      const matrix=m.matrixWorld.clone();if(m.isInstancedMesh){m.getMatrixAt(i,temp);matrix.multiply(temp);}
      solids.push({mesh:m,bounds:m.geometry.boundingBox.clone().applyMatrix4(matrix),inverse:matrix.clone().invert()});
    }
  });
  const opaque=meshes.filter(m=>!(m.material.transparent&&m.material.opacity<.99)).map(mesh=>({mesh,bounds:new THREE.Box3().setFromObject(mesh)}));
  return{s,environments,meshes,solids,opaque,dispose(){for(const set of[s.geometries,s.materials,s.textures])for(const value of set)value.dispose();}};
}
function contains(sample,p){
  if(!sample.bounds.containsPoint(p))return false;
  const q=p.clone().applyMatrix4(sample.inverse),g=sample.mesh.geometry,b=g.boundingBox;
  if(q.y<=b.min.y+.003||q.y>=b.max.y-.003)return false;
  if(g.type==='BoxGeometry')return q.x>b.min.x+.003&&q.x<b.max.x-.003&&q.z>b.min.z+.003&&q.z<b.max.z-.003;
  if(g.parameters.openEnded)return false;
  const t=(q.y-b.min.y)/(b.max.y-b.min.y),r=g.parameters.radiusBottom+(g.parameters.radiusTop-g.parameters.radiusBottom)*t;
  return q.x*q.x+q.z*q.z<(r-.003)**2;
}
function walkSamples(points,inspect){
  for(let leg=1;leg<points.length;leg++){
    const a=new THREE.Vector3(...points[leg-1]),b=new THREE.Vector3(...points[leg]),n=Math.max(1,Math.ceil(a.distanceTo(b)/.08));
    for(let i=0;i<=n;i++)inspect(a.clone().lerp(b,i/n),leg,i/n);
  }
}
function clearBody(h,p,label,height=1.8){
  const offsets=[[0,0],...Array.from({length:12},(_,i)=>[Math.sin(i*Math.PI/6)*.3,Math.cos(i*Math.PI/6)*.3])];
  const volume=new THREE.Box3(new THREE.Vector3(p.x-.3,p.y+.35,p.z-.3),new THREE.Vector3(p.x+.3,p.y+height,p.z+.3));
  const nearby=h.opaque.filter(item=>item.bounds.intersectsBox(volume)).map(item=>item.mesh);
  for(const [dx,dz]of offsets)for(const y of [.35,.9,1.4,height]){
    const hit=h.solids.find(s=>contains(s,p.clone().add(new THREE.Vector3(dx,y,dz))));
    assert.ok(!hit,`${label}: ${p.toArray()} meets ${hit?.mesh.name} / ${hit?.mesh.parent.name}`);
  }
  // A full vertical sweep also catches thin ceilings/plates between the
  // discrete body heights; checking only the head could miss a plate edge.
  for(const [dx,dz]of offsets){
    const ray=new THREE.Raycaster(p.clone().add(new THREE.Vector3(dx,.35,dz)),new THREE.Vector3(0,1,0),.002,height-.35-.002);
    const hit=ray.intersectObjects(nearby,false)[0];
    assert.ok(!hit,`${label}: continuous body height at ${p.toArray()} meets ${hit?.object.name} / ${hit?.object.parent.name}`);
  }
}

test('clip2 end stair physically connects the packaging aisle to the mezzanine before the OP turn',()=>{
  const h=fixture();
  try{
    const spec=DRYER_BUILDING_FLOORS[2],core=spec.stairs.find(c=>c.id==='route-turn-down-stair');
    assert.equal(DRYER_BUILDING_FLOORS[1].routeSurvey.supplementalPackagingWalk.endStairId,core.id);
    const path=[[15.2,.3,19.5],[2,.3,19.5],[2,.3,18],[-5.8,.3,18],[-5.8,.3,20.685],...dryerStairWalkPoints(core,spec),[-4.75,3.8,17.8]];
    const surfaces=[...h.environments.values()].flatMap(env=>[env.deck,env.architectureFixtures]);
    walkSamples(path,(p,leg)=>{
      const hits=new THREE.Raycaster(p.clone().add(new THREE.Vector3(0,.32,0)),new THREE.Vector3(0,-1,0),0,.8).intersectObjects(surfaces,true);
      const support=hits.find(hit=>hit.face&&hit.face.normal.clone().applyNormalMatrix(new THREE.Matrix3().getNormalMatrix(hit.object.matrixWorld)).y>.7);
      assert.ok(support&&Math.abs(support.point.y-p.y)<.15,`leg ${leg}: real support at ${p.toArray()}`);
      clearBody(h,p,`leg ${leg}`);
    });
    const stair=h.environments.get(2).architectureFixtures.getObjectByName('dryer-building-2-route-turn-down-stair');
    assert.ok(stair.getObjectByName('architectural-observed-white-stair-stringer'));
    assert.deepEqual(stair.userData.sourceReferences,[{clipId:'first-floor-20261113-clip2',times:[162]}]);
  }finally{h.dispose();}
});

test('the retained entry and end stairs clear a 1.75m person and join their real landings after manual door opening',()=>{
  const h=fixture({levels:[1,2,3],entryContext:true,openDoors:true});
  try{
    const one=DRYER_BUILDING_FLOORS[1],two=DRYER_BUILDING_FLOORS[2];
    const paths=[
      [[33.75,.3,18.1],...dryerStairWalkPoints(one.stairs[0],one),[33.7,3.8,17.8]],
      [[-7,3.8,-5.3],[-7.785,3.8,-7.4],[-7.785,3.8,-8.55],[-7.3,3.8,-8.95],...dryerStairWalkPoints(two.stairs[0],two),[-7.785,7.3,-7.2]],
    ];
    const surfaces=[...h.environments.values()].flatMap(env=>[env.deck,env.architectureFixtures]);
    for(const [index,path]of paths.entries())walkSamples(path,(p,leg)=>{
      const hits=new THREE.Raycaster(p.clone().add(new THREE.Vector3(0,.32,0)),new THREE.Vector3(0,-1,0),0,.8).intersectObjects(surfaces,true);
      const support=hits.find(hit=>hit.face&&hit.face.normal.clone().applyNormalMatrix(new THREE.Matrix3().getNormalMatrix(hit.object.matrixWorld)).y>.7);
      assert.ok(support&&Math.abs(support.point.y-p.y)<.15,`stair ${index} leg ${leg}: real support at ${p.toArray()}`);
      clearBody(h,p,`stair ${index} leg ${leg}`,1.75);
    });
  }finally{h.dispose();}
});

test('the end-aisle observation can show the new packaging cells and then the confirmed stair without a nearby opaque obstruction',()=>{
  const h=fixture();
  try{
    const from=[4,.3,18.9],to=[1,.3,18.9],a=new THREE.Vector3(-2,1.8,13),b=new THREE.Vector3(-3,1.9,20.5);
    const opaque=h.meshes.filter(m=>!(m.material.transparent&&m.material.opacity<.99));
    walkSamples([from,to],(p,leg,t)=>{
      clearBody(h,p,'observation');
      const eye=p.clone().add(new THREE.Vector3(0,1.65)),direction=a.clone().lerp(b,t).sub(eye),forward=direction.clone().normalize(),right=new THREE.Vector3().crossVectors(forward,new THREE.Vector3(0,1,0)).normalize(),up=new THREE.Vector3().crossVectors(right,forward).normalize();
      let blocked=0;
      for(const x of[-.12,0,.12])for(const y of[-.12,0,.12])if(new THREE.Raycaster(eye,forward.clone().addScaledVector(right,x).addScaledVector(up,y).normalize(),.01,Math.min(direction.length(),1)).intersectObjects(opaque,false).length)blocked++;
      assert.ok(blocked<7,`nearby surfaces cover ${blocked}/9 sight rays at ${p.toArray()}`);
    });
    const one=h.environments.get(1),crossover=one.architectureFixtures.getObjectByName('dryer-route-1-clip2-roller-crossover');
    assert.equal(crossover.userData.interFloorConnection,false);
    assert.ok(crossover.getObjectByName('dryer-route-clip2-crossover-tread'));
    assert.ok(crossover.getObjectByName('dryer-route-clip2-crossover-top-guard'));
    assert.equal(one.architectureFixtures.children.filter(c=>c.userData.elevatorLanding).length,1);
    assert.equal(h.environments.get(2).architectureFixtures.children.filter(c=>c.userData.elevatorLanding).length,0);
  }finally{h.dispose();}
});
