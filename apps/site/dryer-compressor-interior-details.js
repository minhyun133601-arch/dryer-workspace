import * as THREE from '../shared/vendor/three.module.js';

const HALF = Math.PI / 2;
const UP = new THREE.Vector3(0, 1, 0);

// Detail is collected in equipment-local coordinates. Each material/shape is
// drawn in one batch per machine; all machines keep their original scene nodes.
function drawing(s) {
  const m = s.dryerCompressorMaterials;
  const geometries = s.dryerCompressorGeometry;
  function shape(key, make) {
    if (!geometries.has(key)) {
      const value = make();
      geometries.set(key, value);
      s.geometries.add(value);
    }
    return geometries.get(key);
  }
  const box = geometries.get('unit-box'), cyl = geometries.get('unit-cyl');
  const hoop = shape('interior-hoop', () => new THREE.TorusGeometry(1, .064, 5, 36));
  const cap = shape('interior-dished-head', () => new THREE.SphereGeometry(1, 20, 8, 0, 2 * Math.PI, 0, HALF));
  const byParent = new Map(), pose = new THREE.Object3D();
  function part(parent, geometry, paint, size, at, rotation = [0, 0, 0]) {
    if (!byParent.has(parent)) byParent.set(parent, new Map());
    const sets = byParent.get(parent);
    const key = geometry.uuid + paint;
    if (!sets.has(key)) sets.set(key, { geometry, paint, poses: [] });
    pose.position.set(...at);
    pose.scale.set(...size);
    if (rotation.isQuaternion) pose.quaternion.copy(rotation);
    else pose.rotation.set(...rotation);
    pose.updateMatrix();
    sets.get(key).poses.push(pose.matrix.clone());
  }
  function tube(p, a, b, r, paint) {
    const start = new THREE.Vector3(...a), end = new THREE.Vector3(...b), axis = end.clone().sub(start);
    const len = axis.length();
    part(p, cyl, paint, [r, len, r], start.add(end).multiplyScalar(.5).toArray(), new THREE.Quaternion().setFromUnitVectors(UP, axis.normalize()));
  }
  function arc(p, points, radius, paint) {
    const path = new THREE.CatmullRomCurve3(points.map(v => new THREE.Vector3(...v)));
    const geometry = shape('air-detail-path:' + points.join('/') + ':' + radius,
      () => new THREE.TubeGeometry(path, Math.max(6, points.length * 4), radius, 8, false));
    part(p, geometry, paint, [1,1,1], [0,0,0]);
  }
  function flush() {
    let count = 0;
    for (const [parent, batches] of byParent) for (const {geometry, paint, poses} of batches.values()) {
      const mesh = new THREE.InstancedMesh(geometry, m[paint], poses.length);
      poses.forEach((matrix,i) => mesh.setMatrixAt(i,matrix));
      mesh.name = 'photo-detail-' + paint;
      mesh.instanceMatrix.needsUpdate = true;
      mesh.computeBoundingBox(); mesh.computeBoundingSphere();
      mesh.receiveShadow = true;
      parent.add(mesh); count++;
    }
    return count;
  }
  return {
    plate: (p, size, at, paint, rot) => part(p, box, paint, size, at, rot),
    drum: (p,r,h,at,paint,rot) => part(p, cyl, paint, [r,h,r], at, rot),
    ring: (p,r,at,paint,rot) => part(p, hoop, paint, [r,r,r],at,rot),
    cap: (p,r,ry,at,paint,rotation) => part(p, cap, paint, [r,ry,r], at,rotation),
    shape, part, tube, arc, flush
  };
}
function local(s, host, name, photos) {
  const group = s._group(host);
  group.name = name;
  group.userData.sourcePhotoNumbers = photos;
  return group;
}
function omit(u, names) {
  for (const name of names) {
    const part = u.getObjectByName(name);
    if (part) { part.visible = false; part.userData.personCollision = false; }
  }
}
function readout(k,p,x,y,z,w=.29) {
  k.plate(p,[w,.198,.024],[x,y,z],'black');
  k.plate(p,[w*.55,.086,.012],[x,y+.016,z+.019],'lcd');
  for (const side of [-1,1]) for (let i=0;i<3;i++)
    k.plate(p,[.021,.02,.01],[x+side*w*.39,y+.057-i*.04,z+.021],'trim');
  for (let i=0;i<4;i++) k.plate(p,[.026,.015,.009],[x-.073+i*.047,y-.061,z+.021],i===3?'red':'trim');
}
function grille(k,p,at,width,height,face,steps) {
  // Draw the dark cavity behind vertical exchanger fins or horizontal slots.
  const [x,y,z]=at;
  k.plate(p,[.02,height,width],[x,y,z],'black');
  if (face==='fins') {
    for (let i=0;i<steps;i++) k.plate(p,[.019,height-.035,width/(steps*2.2)],[x+.017,y,z-width/2+(i+.5)*width/steps],'galv');
  } else {
    for (let i=0;i<steps;i++) k.plate(p,[.018,height/(steps*3.0),width-.025],[x+.017,y-height/2+(i+.5)*height/steps,z],'trim');
  }
}

// W/H/D of bare cabinets. #1 uses field card HC-T-005; #2 and #3
// use KAESER's model-specific BSD and CSD(X) nominal envelope tables.
const cabinetSizes = { 1: [2.11,1.95,1.29], 2: [1.53,1.70,1.005], 3: [1.76,1.90,1.11] };

function paintedMark(s, unit, name, text, width, height, at, yaw, vertical = false, ink = '#282b29') {
  if (typeof document === 'undefined') return;
  const canvas = document.createElement('canvas');
  canvas.width = vertical ? 100 : 520;
  canvas.height = vertical ? 520 : 100;
  const ctx = canvas.getContext?.('2d');
  if (!ctx) return;
  ctx.translate(canvas.width/2, canvas.height/2);
  if (vertical) ctx.rotate(-HALF);
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
  ctx.fillStyle = ink; ctx.font = 'bold 79px Arial, sans-serif';
  ctx.fillText(text,0,0,495);
  const map = new THREE.CanvasTexture(canvas); map.colorSpace = THREE.SRGBColorSpace; s.textures.add(map);
  const paint = s._material(0xffffff,.66,.04,{map,transparent:true,depthWrite:false});
  const geo = new THREE.PlaneGeometry(width,height);
  const mesh = s._mesh(geo,paint,unit,at);
  mesh.name = name; mesh.rotation.y = yaw; mesh.userData.personCollision = false;
  mesh.castShadow = false;
}

function fitCabinet(unit,id,num) {
  const [w,h,d] = cabinetSizes[num];
  const base = unit.getObjectByName(id+'-base'), body = unit.getObjectByName(id+'-body');
  const scale = new THREE.Vector3(w/base.scale.x, h/(body.scale.y+base.scale.y), d/base.scale.z);
  for (const part of unit.children) {
    part.position.multiply(scale);
    // Only the surviving axis-aligned base, cabinet sheets and box ducts are
    // resized. Cylinders on the original controller and elbow are superseded.
    if (part.isMesh && part.geometry === base.geometry) part.scale.multiply(scale);
  }
  unit.userData.cabinetDimensions = {width:w, depth:d, height:h, unit:'m', includesDuct:false,
    basis:num===1?'설비이력카드 HC-T-005':'KAESER 모델별 카탈로그 표준 외형'};
}

function kaeser(s,k,room,num,id,w,h,d) {
  const unit=room.getObjectByName(id);
  const p=local(s,unit,'survey-kaeser-'+num,num===1?[10,11,12,13]:num===2?[16,18,19,20,22,23,25]:[37,38,40,41,42,43]);
  const z=d/2+.036, compact=num===2;
  omit(unit,['sigma-ctrl','sigma-screen','estop','tag','exhaust-louver','exhaust-elbow'].map(key=>id+'-'+key));
  // The 50HP BSD has its controls in a yellow door; the two CSD units
  // have two yellow service leaves and a tall anthracite controller strip.
  if (compact) {
    omit(unit,[id+'-yellow-front']);
    k.plate(p,[w*.62,h-.22,.042],[w*.12,h/2+.04,z],'kaeserYellow');
    k.plate(p,[w*.19,h-.22,.045],[w*.41,h/2+.04,z+.001],'kaeserYellow');
    k.plate(p,[w*.25,h-.28,.035],[-w*.34,h/2+.05,z],'black');
    k.arc(p,[[-w*.37,.28,z+.02],[-w*.39,.53,z+.04],[-w*.29,.78,z+.045],[-w*.30,1.19,z+.023]],.029,'dark');
    for (const x of [-.11,.14]) for(let i=0;i<6;i++)
      k.plate(p,[.105,.011,.012],[x,.67+i*.024,z+.032],'dark');
  } else {
    k.plate(p,[.013,h-.29,.014],[-w*.16,h/2+.015,z+.007],'dark');
    for(const x of [-w*.23,-w*.09]) k.plate(p,[.049,.026,.018],[x,h*.58,z+.02],'black');
    for(let i=0;i<14;i++) k.plate(p,[.21,.011,.016],[w*.34,.30+i*.022,z+.009],'black');
  }
  const cx=compact?w*.145:w*.33, cy=h*.71;
  readout(k,p,cx,cy,z+.046);
  k.plate(p,[.18,.052,.012],[cx,cy+(num===2?-.15:.15),z+.059],'trim');
  k.plate(p,[.17,.009,.014],[cx,cy+(num===2?-.167:.134),z+.064],'red');
  k.plate(p,[.082,.082,.014],[cx+(compact?-.092:.07),cy-.237,z+.056],'kaeserYellow');
  k.drum(p,.031,.033,[cx+(compact?-.092:.07),cy-.237,z+.075],'red',[HALF,0,0]);
  // The three south-facing end panels seen from the entrance at 02:28 and
  // 04:14 are distinct. The finned service ends are seen from the other side.
  omit(unit,[id+'-yellow-side',id+'-cooler-core']);
  const south = local(s,unit,'survey-south-cabinet-end-'+num,[10,16,43]);
  south.rotation.y = num===1 ? -HALF : HALF;
  const face = w/2+.018;
  k.plate(south,[d*.98,h-.15,.034],[0,h/2+.065,face],num===3?'kaeserDark':'kaeserYellow');
  if (num===1) {
    k.plate(south,[.009,h-.18,.017],[0,h/2+.06,face+.022],'dark');
    for (const side of [-1,1]) {
      for (let j=0;j<13;j++) k.plate(south,[d*.27,.007,.014],[side*d*.26,h*.73+j*.016,face+.025],'dark');
      for (const y of [.31,1.49]) k.drum(south,.012,.014,[side*.053,y,face+.029],'black',[HALF,0,0]);
    }
  } else if (num===2) {
    k.plate(south,[d*.38,h-.15,.021],[d*.295,h/2+.065,face+.024],'kaeserDark');
    paintedMark(s,south,'bsd-yellow-end-maker','KAESER',.075,.45,[-d*.42,h*.78,face+.041],0,true);
    paintedMark(s,south,'bsd-yellow-end-model','BSD 72',.28,.075,[-d*.12,h*.50,face+.041],0);
  } else {
    for(let j=0;j<4;j++) for(let i=0;i<12;i++)
      k.plate(south,[.012,.005,.008],[d*.10+i*.022,h*.32+j*.014,face+.022],'black');
  }
  const end = local(s,unit,'survey-finned-service-end-'+num,num===3?[41,42]:num===1?[13]:[20]);
  if (num!==1) end.rotation.y = Math.PI;
  k.plate(end,[.03,h-.15,d*.98],[w/2+.014,h/2+.065,0],'kaeserDark');
  grille(k,end,[w/2+.038,h*.56,0],d*.67,h*.66,'fins',36);
  for(const side of [-1,1]) k.plate(end,[.036,h*.68,.031],[w/2+.064,h*.56,side*d*.34],'trim');
  if(num===3){
    k.plate(end,[.023,.28,d*.66],[w/2+.047,.33,0],'black');
    k.arc(end,[[w/2+.067,.30,-d*.2],[w/2+.065,.30,d*.19],[w/2+.065,.39,d*.245],[w/2+.065,.58,d*.245]],.025,'galv');
  }
  // Opposite the controllers, the photographed service skins differ from the finned ends.
  const rear = local(s,unit,'survey-rear-service-panel-'+num,[[12],[18],[37]][num-1]);
  rear.rotation.y = Math.PI;
  const back = d/2+.018;
  if (num===1) {
    k.plate(rear,[w*.98,h-.16,.027],[0,h/2+.065,back],'kaeserDark');
    // Perforated strip and upper circular knockout on the CSD 130 SFC.
    for (let row=0;row<3;row++) for (let col=0;col<22;col++) {
      k.plate(rear,[.012,.012,.004],[w*.075+col*.022,h*.34+row*.021,back+.016],'black');
    }
    k.ring(rear,.042,[w*.38,h*.92,back+.016],'black');
  } else if (compact) {
    // In #018 a narrow leaf and a wide removable yellow leaf meet across a reveal.
    k.plate(rear,[w*.25,h-.17,.035],[-w*.365,h/2+.065,back],'kaeserYellow');
    k.plate(rear,[w*.71,h-.17,.047],[w*.125,h/2+.065,back+.009],'kaeserYellow');
    for(const x of [-w*.42,-w*.18,w*.27]) k.drum(rear,.014,.008,[x,h*.90,back+.039],'black',[HALF,0,0]);
  } else {
    // #037 shows a single broad yellow leaf with a small, square, low louvre.
    k.plate(rear,[w*.76,h-.17,.035],[0,h/2+.065,back],'kaeserYellow');
    const vent=[-w*.235,h*.30,back+.023];
    k.plate(rear,[.22,.20,.012],vent,'kaeserYellow');
    for(let i=0;i<8;i++) k.plate(rear,[.19,.007,.012],[vent[0],vent[1]-.067+i*.019,vent[2]+.009],'brown');
    for(const y of [.20,h*.91]) k.drum(rear,.013,.008,[-w*.34,y,back+.024],'black',[HALF,0,0]);
  }
  // The 90-degree BSD duct has rolled square cheeks. It is not a round barrel.
  const hw=w*.26, hd=d*.26;
  if (compact) {
    const bendSection=new THREE.Shape(),inner=.12,outer=.12+2*hd;
    bendSection.absarc(0,0,outer,0,HALF,false);
    bendSection.lineTo(0,inner);
    bendSection.absarc(0,0,inner,HALF,0,true);
    bendSection.closePath();
    const bend=k.shape('bsd72-square-hood-bend',()=>new THREE.ExtrudeGeometry(bendSection,{depth:hw*2,curveSegments:10,bevelEnabled:false}));
    // Local +X of the section points to -Z, its vertical limb continues the riser.
    k.part(p,bend,'galv',[1,1,1],[-w*.08-hw,h+.80,hd+.12],[0,HALF,0]);
  } else {
    const hood=[-w*.08,h+.55,hd+.012];
    k.plate(p,[hw*1.84,.50,.022],hood,'dark');
    for(let i=0;i<7;i++) k.plate(p,[hw*1.82,.055,.072],[hood[0],hood[1]-.22+i*.074,hood[2]+.018],'galv',[-.35,0,0]);
  }
}

function k50ServiceBay(s, k, room) {
  const unit = room.getObjectByName('comp-unit-4-k2power-k50');
  const bay = local(s, unit, 'survey-k50-service-bay', [26, 27, 28, 30, 31]);
  // The 2002 K50 has a cream gauge cabinet beside an open service bay.
  omit(unit, ['k50-body', 'k50-tag']);
  k.plate(bay, [1.26, 1.56, .94], [0, 1, -.36], 'k2Beige');
  k.plate(bay, [1.26, .06, .72], [0, 1.75, .47], 'k2Beige');
  k.plate(bay, [.07, 1.54, .72], [.585, .99, .47], 'dark');
  k.plate(bay, [1.23, 1.52, .045], [0, .99, .81], 'kaeserDark');
  k.drum(bay, .18, .66, [-.32, .78, .48], 'vesselRed');
  k.cap(bay, .18, .12, [-.32, 1.11, .48], 'vesselRed');
  k.tube(bay, [-.32, 1.19, .48], [-.32, 1.48, .48], .049, 'trim');
  k.arc(bay, [[-.37,.47,.48],[-.46,.42,.33],[-.39,.32,.26],[-.2,.34,.25]], .038, 'galv');
  k.arc(bay, [[-.19,.79,.32],[-.26,1.29,.34],[-.16,1.52,.26],[.19,1.54,.22]], .026, 'black');
  k.plate(bay, [.026,.071,.093], [-.499,.94,.48], 'steel');
  k.drum(bay, .04, .03, [-.676, 1.46, -.14], 'kaeserYellow', [0,0,HALF]);
  k.drum(bay, .031, .037, [-.697, 1.46, -.14], 'red', [0,0,HALF]);
  for (const z of [-.53,-.35,-.17]) {
    k.ring(bay, .043, [-.678,1.3,z], 'trim', [0,HALF,0]);
    k.plate(bay,[.008,.045,.006],[-.682,1.31,z],'dark',[.6,0,0]);
  }
}

function operatingCard(s, unit, number, rating, position, yaw) {
  if (typeof document === 'undefined') return;
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext?.('2d');
  if (!ctx) return;
  canvas.width = 480; canvas.height = 590;
  ctx.fillStyle = '#305b93'; ctx.fillRect(0,0,480,590);
  ctx.fillStyle = '#f5f2e7'; ctx.fillRect(12,12,456,566);
  ctx.textAlign = 'center'; ctx.fillStyle = '#33393a';
  const models=['','CSD 130 SFC','BSD 72','CSD 125','K50'];
  const years=['','2026년','2012년','2019년','2002년'];
  const rows=[['설비명','공기압축기 '+number+'호기'],['모델',models[number]],['용량·형식',rating],['구매·가동',years[number]],['사용처','생산 공정용'],['소모품 교체', '6,000시간']];
  ctx.lineWidth=2;ctx.strokeStyle='#97978d';
  for(const [row,[label,value]] of rows.entries()) {
    const y=28+row*46;
    ctx.fillStyle='#e6e5d9';ctx.fillRect(24,y,136,45);
    ctx.fillStyle='#293235';ctx.font='bold 22px sans-serif';ctx.fillText(label,92,y+30,125);
    ctx.font='bold 24px sans-serif';ctx.fillText(value,307,y+30,263);
    ctx.beginPath();ctx.moveTo(24,y+45);ctx.lineTo(455,y+45);ctx.stroke();
  }
  ctx.fillStyle='#a53c27';ctx.fillRect(36,342,408,56);
  ctx.fillStyle='#fff1bc';ctx.font='bold 30px sans-serif';ctx.fillText('공기압축기 주의사항',240,381);
  ctx.fillStyle='#4a473e';ctx.font='17px sans-serif';ctx.textAlign='left';
  const cautions=['안전커버 제거 후 운전 금지','설정 압력 이상 운전 금지','이상 소음·진동 발생 시 즉시 정지',
    '운전 중 점검 및 정비 금지','응축수(드레인) 정기 배출','정비 시 전원 차단 후 작업','오일 및 필터 정기 점검'];
  for(const [i,line] of cautions.entries()) ctx.fillText('• '+line,47,426+i*22);
  const map = new THREE.CanvasTexture(canvas); map.colorSpace = THREE.SRGBColorSpace; s.textures.add(map);
  const mat = s._material(0xffffff,.8,.02,{map});
  const geo = new THREE.PlaneGeometry(.21,.255); s.geometries.add(geo);
  const plate = s._mesh(geo,mat,unit,position);
  plate.rotation.y = yaw; plate.name = 'survey-operating-card-'+number;
  plate.userData.personCollision = false;
}

function hx601Dryer(s,k,room) {
  const unit=room.getObjectByName('comp-dryer-hx601k');
  const hx=local(s,unit,'survey-hx601-side-coil',[76,77,78,79,81]);
  // The narrow blue control end faces the aisle (+X). These are the 2015
  // HX601K catalogue dimensions. Site-installed service pipes have their own heights.
  const depth=1.321, width=.543, height=.811, foot=.025;
  const body=unit.getObjectByName('hx601-body');
  body.scale.set(depth,height-foot,width);
  body.position.y=(height+foot)/2;
  const front=unit.getObjectByName('hx601-blue-front');
  front.scale.set(.068,height-foot+.0002,width+.0002);
  front.position.set(depth/2+.0001-.034,body.position.y,0);
  const strip=unit.getObjectByName('hx601-top-strip');
  strip.scale.set(.048,.002,width*.55);
  strip.position.set(depth/2-.032,height+.001,0);
  k.plate(hx,[.019,.003,.026],[depth/2-.032,height+.003,.105],'lcd');
  for(const z of [-.10,-.065,-.03,.005,.04])
    k.drum(hx,.005,.004,[depth/2-.032,height+.003,z],'trim');
  const face=local(s,hx,'hx-blue-service-panel',[76]);face.rotation.y=HALF;
  paintedMark(s,face,'hx-blue-front-maker','JEMACO',.060,.284,[-.082,.443,depth/2+.001],0,true,'#eef0e8');
  for(const z of [-.18,.18])
    k.plate(hx,[depth-.13,foot,.079],[0,foot/2,z],'dark');
  // #077 shows the exchanger matrix, #081 shows a split fan guard opposite.
  // Recess the old one-sided trim into the skin before installing both guards.
  const coil=unit.getObjectByName('hx601-side-grille');
  coil.scale.set(.70,.56,.005);coil.position.set(.16,.35,-width/2);
  for(const side of [-1,1]) {
    const z=side*(width/2+.0015);
    k.plate(hx,[.70,.565,.003],[.16,.35,z],side<0?'trim':'black');
    for(let i=0;i<23;i++)
      k.plate(hx,[.004,.557,.003],[-.184+i*.031,.35,z+side*.003],side<0?'galv':'trim');
    for(let i=0;i<17;i++)
      k.plate(hx,[.691,.005,.003],[.16,.075+i*.034,z+side*.004],side<0?'galv':'trim');
    if(side>0) k.plate(hx,[.025,.562,.003],[.16,.35,z+.005],'kaeserDark');
  }
  k.arc(hx,[[-depth/2,.59,.19],[-.81,.59,.19],[-.85,.66,.19],[-.85,1.63,.19],[-.84,1.73,.13],[-.79,1.76,-.15]],.037,'galv');
  k.arc(hx,[[-depth/2,.63,-.19],[-.88,.63,-.19],[-.92,.71,-.23],[-.92,1.76,-.26],[-.91,1.85,-.31],[-.91,1.85,-.53]],.041,'galv');
  for(const y of [.84,1.44]) flange(k,hx,[-.92,y,-.24],.062);
  unit.userData.cabinetDimensions={width,depth,height,unit:'m',basis:'경원 2015년 국문 카탈로그 HX601K 외형 · 현장사진 076–081',includesDuct:false};
}

function hl350Dryer(s,k,room) {
  const unit=room.getObjectByName('comp-dryer-spx-blue');
  const blue=local(s,unit,'survey-blue-twin-towers',[90,91,92,93,94]);
  // The 2012 nameplate and long narrow towers match the older HL350K.
  // The catalogue height includes the feet. Keep the rear filter separate.
  const width=.890, depth=.800, height=2.085;
  const radius=.145, pitch=width/2-radius, x=.22;
  const shellBottom=.275, crownBase=height-.032;
  for(const tower of unit.children.filter(n=>n.name==='spx-blue-tower')) {
    const z=Math.sign(tower.position.z)*pitch;
    tower.position.set(x,(shellBottom+crownBase)/2,z);
    tower.scale.set(radius,crownBase-shellBottom,radius);
    k.cap(blue,radius,.032,[x,crownBase,z],'blueBright');
    k.cap(blue,radius,.035,[x,shellBottom,z],'blueBright',[Math.PI,0,0]);
  }
  // Independent longitudinal runners and open upright cheeks in #090.
  const gussetProfile=new THREE.Shape();
  gussetProfile.moveTo(0,0);gussetProfile.lineTo(.252,0);gussetProfile.lineTo(0,.123);gussetProfile.closePath();
  const gusset=k.shape('hl350k-foot-gusset',()=>new THREE.ExtrudeGeometry(gussetProfile,{depth:.018,bevelEnabled:false}));
  for(const runner of unit.children.filter(n=>n.name==='spx-blue-foot')) {
    const z=Math.sign(runner.position.z)*pitch;
    runner.scale.set(depth,.025,.096);runner.position.set(x,.0125,z);
    for(const sign of [-1,1]) {
      k.plate(blue,[.044,.40,.032],[x+sign*.092,.225,z],'blueBright');
      k.part(blue,gusset,'blueBright',[1,1,1],[x+sign*.11,.025,z-sign*.009],sign<0?[0,Math.PI,0]:[0,0,0]);
      k.drum(blue,.013,.018,[x+sign*.367,.034,z],'galv');
    }
  }
  const cabinet=unit.getObjectByName('spx-center-console');
  cabinet.scale.set(.18,1.76,.338);cabinet.position.set(x+.006,1.15,0);
  const frontX=cabinet.position.x+cabinet.scale.x/2;
  for(const gauge of unit.children.filter(n=>n.name==='spx-gauge')) {
    gauge.position.set(frontX+.013,1.63,Math.sign(gauge.position.z)*.059);
    k.ring(blue,.043,[frontX+.027,1.63,gauge.position.z],'trim',[0,HALF,0]);
    k.plate(blue,[.004,.031,.003],[frontX+.027,1.64,gauge.position.z+.004],'dark',[.42,0,0]);
  }
  const mimic=unit.getObjectByName('spx-mimic-panel');
  mimic.scale.set(.012,.163,.182);mimic.position.set(frontX+.007,1.468,0);
  for(const z of [-.033,.034]) k.plate(blue,[.006,.092,.015],[frontX+.016,1.47,z],'red');
  k.plate(blue,[.009,.025,.018],[frontX+.017,1.47,.067],'exitGreen');
  paintedMark(s,blue,'desiccant-column-maker','JEMACO',.061,.32,[frontX+.002,.94,0],HALF,true,'#e6e9e0');
  // The external filter hangs on the rear pipe visible end-on in #094.
  const filter=local(s,blue,'survey-hl350-rear-filter',[90,94]);
  k.drum(filter,.059,.47,[-.168,1.53,-.08],'blueFilter');
  k.drum(filter,.076,.10,[-.168,1.81,-.08],'blueFilter');
  k.drum(filter,.022,.052,[-.168,1.265,-.08],'galv');
  k.drum(filter,.040,.055,[-.168,1.22,-.08],'red');
  k.arc(filter,[[x-.14,1.91,-pitch],[-.10,1.91,-pitch],[-.16,1.87,-pitch],[-.168,1.82,-.21],[-.168,1.82,-.08]],.03,'galv');
  unit.userData.cabinetDimensions={width,depth,height,unit:'m',basis:'경원 2015년 구형 HL350K 표준 외형과 현장사진 090–094 대조 추정',includesDuct:false};
}

function dryerDetails(s, k, room) {
  const dryer = room.getObjectByName('comp-dryer-jemaco-dark');
  const dry = local(s, dryer, 'survey-dryer-top-fan', [55,56,57,58]);
  // Fit the front and top corners in #055 (25 mm equivalent focal length),
  // keeping the estimated skin height. #057 confirms the long service side.
  const body=dryer.getObjectByName('dark-dryer-body');
  body.scale.set(1.28,1.04,.60);
  dryer.userData.cabinetDimensions={width:.60,depth:1.28,height:1.06,unit:'m',
    basis:'사진 055·057 투영 비례 추정 · 본체 높이 기준값 유지',includesDuct:false};
  const fan=dryer.getObjectByName('dark-dryer-top-fan');
  fan.scale.set(.245,.01,.245); fan.position.set(-.292,1.063,0);
  for (const r of [.045,.08,.115,.15,.185,.215,.245])
    k.ring(dry,r,[-.292,1.071,0],'dark',[HALF,0,0]);
  for (let i=0;i<8;i++) {
    const a=i*Math.PI/4;
    k.tube(dry,[-.292,1.073,0],[-.292+Math.sin(a)*.245,1.073,Math.cos(a)*.245],.004,'trim');
  }
  k.drum(dry,.042,.009,[-.292,1.077,0],'tankLight');
  for(const side of [-1,1]) k.plate(dry,[1.18,.02,.068],[0,.01,side*.21],'dark');
  k.plate(dry,[.78,.56,.007],[.065,.40,.302],'black');
  for(let i=0;i<25;i++) k.plate(dry,[.005,.557,.004],[-.313+i*.031,.40,.307],'trim');
  for(let i=0;i<19;i++) k.plate(dry,[.777,.004,.004],[.065,.135+i*.029,.308],'trim');
  const face=local(s,dry,'survey-top-fan-dryer-front',[55]);
  face.rotation.y=-HALF;
  omit(dryer,['dark-dryer-display','dark-dryer-filter-header']);
  k.plate(face,[.245,.059,.008],[0,.80,.642],'black');
  k.plate(face,[.052,.022,.003],[.031,.80,.648],'lcd');
  for(const y of [.789,.811]) k.drum(face,.006,.006,[.094,y,.649],'white',[HALF,0,0]);
  paintedMark(s,face,'dry-air-maker','Jemaco',.252,.047,[0,.102,.643],0,false,'#e1e5dc');
  const filters = dryer.children.filter(child=>child.name==='dark-dryer-inline-filter');
  const pipePositions=[[.03,-.53],[.36,.53],[-.19,.53]];
  for(const [index,filter] of filters.entries()) {
    const [x,z]=pipePositions[index];
    filter.position.set(x,1.62,z);
    filter.getObjectByName('dark-dryer-inline-filter-head').material=s.dryerCompressorMaterials.blueFilter;
    const bowl=filter.children.find(n=>n.name.endsWith('-bowl'));
    bowl.scale.set(.073,.79,.073); bowl.position.y=-.12;
    k.drum(filter,.078,.06,[0,.17,0],'bluePipe');
    k.drum(filter,.028,.085,[0,-.54,0],'galv');
  }
  k.tube(dry,[-.34,1.90,.53],[.51,1.90,.53],.045,'galv');
  k.arc(dry,[[-.12,1.90,-.53],[.03,1.90,-.53],[.21,1.90,-.53],[.26,1.95,-.53],[.26,2.03,-.53],[.31,2.08,-.53],[.59,2.08,-.53]],.044,'galv');
  hx601Dryer(s,k,room);
  const jac=room.getObjectByName('comp-aftercooler-jac100');
  const cooler = local(s,jac,'survey-aftercooler-intake',[70,71,72,73]);
  // Facing the short black end in #070, the HX is to the left and the
  // receiver to the right. Its long axis runs away from the aisle.
  jac.rotation.y=HALF;
  const skin=jac.getObjectByName('jac100-body');
  skin.scale.set(.42,1.015,1.62);skin.position.y=.508;
  for(const child of jac.children.filter(child=>child.name.startsWith('jac100-')&&child!==skin)) {
    child.visible=false;child.userData.personCollision=false;
  }
  for(const side of [-1,1]) {
    const broad=local(s,cooler,'jac-perforated-side-'+side,side<0?[73]:[71]);
    if(side<0) broad.rotation.y=Math.PI;
    k.plate(broad,[.014,.98,1.58],[.218,.514,0],'white');
    grille(k,broad,[.23,.48,.02],1.26,.72,'fins',18);
    for(let i=0;i<21;i++) k.plate(broad,[.014,.017,1.26],[.253,.14+i*.034,.02],'tankLight');
  }
  // #073: only the front grille has the instrument strip, START/STOP switch and dial.
  const instruments=local(s,cooler,'jac-front-instruments',[73]);
  instruments.rotation.y=-HALF;
  k.plate(instruments,[.73,.122,.014],[0,.929,.242],'black');
  for (const x of [-.168,.111]) k.plate(instruments,[.003,.118,.004],[x,.929,.251],'trim');
  k.plate(instruments,[.023,.033,.011],[-.118,.93,.256],'trim');
  k.plate(instruments,[.015,.022,.008],[-.118,.93,.266],'red');
  dial(k,instruments,.041,[.028,.93,.260]);
  paintedMark(s,instruments,'jac-front-maker','JEMACO',.192,.045,[.236,.937,.251],0,false,'#f0f0e9');
  paintedMark(s,instruments,'jac-intake-caption','AFTER COOLER',.153,.024,[-.263,.952,.251],0,false,'#ecefe9');
  k.plate(cooler,[.42,.014,1.62],[0,1.019,0],'trim');
  for (const z of [-.52,.52]) {
    k.plate(cooler,[.188,.012,.206],[0,1.032,z],'steel');
    for(const x of [-.077,.077]) for(const dz of [-.085,.085]) {
      k.drum(cooler,.008,.009,[x,1.044,z+dz],'trim');
    }
    k.tube(cooler,[0,1.02,z],[0,1.69,z],.058,'galv');
    for(const y of [1.09,1.34]) flange(k,cooler,[0,y,z],.107);
  }
  k.plate(cooler,[.27,.34,.008],[0,.75,.817],'tankLight');
  paintedMark(s,cooler,'jac-safety-heading','압력용기 안전수칙',.24,.04,[0,.89,.824],0,false,'#a03b31');
  for(let i=0;i<8;i++) {
    k.plate(cooler,[.199-i%3*.019,.007,.004],[0,.848-i*.027,.823],'trim');
  }
  k.plate(cooler,[.245,.017,.005],[0,.59,.824],'bluePipe');
  // The two silver branches turn away in different directions. Do not close
  // them into an unsupported bypass between inlet and outlet.
  k.arc(cooler,[[0,1.65,-.52],[0,1.76,-.52],[-.07,1.82,-.52],[-.46,1.82,-.52]],.058,'galv');
  k.arc(cooler,[[0,1.65,.52],[0,1.82,.52],[0,1.89,.45],[0,1.89,.22]],.058,'galv');
  k.tube(cooler,[0,1.32,-.52],[.12,1.32,-.52],.02,'galv');
  k.ring(cooler,.087,[.13,1.32,-.52],'red',[0,HALF,0]);
  for(let j=0;j<3;j++) {
    const angle=j*2*Math.PI/3;
    k.tube(cooler,[.13,1.32,-.52],[.13,1.32+.08*Math.cos(angle),-.52+.08*Math.sin(angle)],.008,'red');
  }
  hl350Dryer(s,k,room);
  const silver = local(s,room.getObjectByName('comp-dryer-ps600k'),'survey-silver-twin-towers',[82,86,87,88,89]);
  const controls=local(s,silver,'survey-ps600-front-controls',[82]);
  controls.rotation.y=HALF;
  k.plate(controls,[.50,.59,.013],[0,1.05,.523],'trim');
  k.plate(controls,[.477,.566,.013],[0,1.05,.534],'tankLight');
  for(const [x,paint] of [[-.085,'red'],[.052,'orange']]) {
    k.drum(controls,.026,.015,[x,1.19,.55],paint,[HALF,0,0]);
    k.plate(controls,[.016,.041,.021],[x,1.18,.565],'dark',[0,0,-.18]);
  }
  paintedMark(s,controls,'ps600-front-maker','JEMACO',.37,.065,[0,.81,.545],0,false,'#29345f');
  for(const x of [-.34,.34]) {
    dial(k,controls,.052,[x,1.48,.387]);
    k.plate(controls,[.065,.105,.011],[x,1.22,.351],'tankLight');
    k.arc(controls,[[x,1.9,.12],[x,2.03,.12],[x,2.12,.11],[x*.78,2.15,.10],[x*.45,2.15,.10]],.038,'galv');
    k.plate(controls,[.081,.10,.012],[x,.6,.346],'safetyYellow');
  }
  // Each photographed tower is supported on a small skirt with the head
  // and drains visible over the dark structural base.
  for(const side of [-1,1]) {
    k.plate(controls,[.072,.075,.71],[side*.47,.084,.07],'skirtMetal');
    k.plate(controls,[.985,.075,.063],[0,.084,.07+side*.33],'skirtMetal');
  }
  for (const z of [-.34,.34]) {
    k.cap(silver,.223,.13,[.12,1.78,z],'tankGray');
    k.ring(silver,.222,[.12,1.78,z],'tankGray',[HALF,0,0]);
    k.tube(silver,[.12,1.88,z],[.12,2.09,z],.038,'galv');
    k.arc(silver,[[-.55,.42,z],[-.55,.52,z],[-.45,.56,z],[-.15,.56,z]],.042,'galv');
    k.plate(silver,[.09,.1,.1],[-.36,.64,z],'dark');
  }
  for(const vessel of silver.parent.children.filter(child=>child.name==='ps600-vessel')) {
    vessel.scale.set(.223,1.48,.223);vessel.position.y=1.04;
  }
  for(const z of [-.34,.34]) {
    k.arc(silver,[[.12,2.09,z],[.12,2.15,z],[.12,2.17,z*.8],[.12,2.17,z*.35]],.041,'galv');
    k.tube(silver,[.12,1.84,z],[-.54,1.84,z],.036,'galv');
    k.tube(silver,[-.54,1.84,z],[-.54,.54,z],.036,'galv');
    for(const y of [.62,1.49]) flange(k,silver,[-.54,y,z],.059);
    k.plate(silver,[.028,.08,.015],[-.485,1.56,z],'red');
  }
  k.arc(silver,[[-.53,1.48,-.34],[-.60,1.26,-.23],[-.6,.98,.04],[-.57,1.07,.23],[-.54,1.51,.34]],.012,'dark');
  // Blue filter bowls at different heights, behind the vessels. Both are
  // visible on the same rack in #089, with a low silver cross-header.
  for(const [x,y,z] of [[-.16,2.01,0],[-.53,1.02,-.03]]) {
    k.drum(silver,.071,.45,[x,y-.035,z],'blueFilter');k.drum(silver,.081,.10,[x,y+.21,z],'dark');
    k.drum(silver,.026,.061,[x,y-.29,z],'galv');
    k.tube(silver,[x,y+.21,z-.23],[x,y+.21,z+.23],.038,'galv');
  }
  k.arc(silver,[[-.53,1.23,.20],[-.53,1.23,.31],[-.51,1.29,.34],[-.51,1.66,.34],[-.54,1.73,.34]],.034,'galv');
  k.arc(silver,[[-.16,2.22,-.23],[-.16,2.22,-.33],[-.10,2.16,-.34],[.12,2.12,-.34]],.035,'galv');
}

function flange(k,group,center,radius,axis='y') {
  const rotation = axis==='x' ? [0,0,HALF] : axis==='z' ? [HALF,0,0] : [0,0,0];
  k.drum(group,radius,.027,center,'galv',rotation);
  for(let i=0;i<6;i++) {
    const angle=i*Math.PI/3, a=Math.cos(angle)*radius*.79, b=Math.sin(angle)*radius*.79;
    const bolt=[...center];
    if (axis==='x') { bolt[1]+=a; bolt[2]+=b; }
    else if (axis==='z') { bolt[0]+=a; bolt[1]+=b; }
    else { bolt[0]+=a; bolt[2]+=b; }
    k.drum(group,.012,.045,bolt,'steel',rotation);
  }
}

function dial(k,p,r,at) {
  const [x,y,z]=at;
  k.drum(p,r,.045,[x,y,z],'black',[HALF,0,0]);
  k.drum(p,r*.87,.007,[x,y,z+.025],'white',[HALF,0,0]);
  for(let i=0;i<11;i++) {
    const a=(-.77+i*.154)*Math.PI;
    k.plate(p,[.004,r*.14,.004],[x+Math.sin(a)*r*.67,y+Math.cos(a)*r*.67,z+.03],'dark',[0,0,-a]);
  }
  k.tube(p,[x,y,z+.032],[x-r*.30,y+r*.43,z+.032],.003,'dark');
}

// Preserve the circular inspection opening visible at the bottom of each
// receiver. The holes belong to the skirt, below the bottom pressure head.
function receiverSkirt(radius,height) {
  const positions=[], normals=[], holeR=.102, centerY=.145;
  function vertex(angle,y) {
    positions.push(radius*Math.sin(angle),y,radius*Math.cos(angle));
    normals.push(Math.sin(angle),0,Math.cos(angle));
  }
  function quad(a,b,lowA,highA,lowB,highB) {
    vertex(a,lowA); vertex(b,lowB); vertex(a,highA);
    vertex(a,highA); vertex(b,lowB); vertex(b,highB);
  }
  function opening(angle) {
    const x=angle*radius;
    return Math.abs(x)<holeR ? Math.sqrt(holeR**2-x**2) : 0;
  }
  const edge=holeR/radius, cuts=[-Math.PI,-edge,edge,Math.PI];
  for(let i=1;i<96;i++) cuts.push(-Math.PI+i*2*Math.PI/96);
  cuts.sort((a,b)=>a-b);
  for(let i=1;i<cuts.length;i++) {
    const a=cuts[i-1],b=cuts[i];
    if (b<=-edge || a>=edge) {quad(a,b,.012,height,.012,height);continue;}
    quad(a,b,.012,centerY-opening(a),.012,centerY-opening(b));
    quad(a,b,centerY+opening(a),height,centerY+opening(b),height);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
  geometry.setAttribute('normal',new THREE.Float32BufferAttribute(normals,3));
  return geometry;
}

function separatorDetails(s,k,room) {
  const unit=room.getObjectByName('comp-oil-water-separator');
  const body=local(s,unit,'separator-survey-covers-and-hoses',[95,96,98,99]);
  const lidY=.725;
  const blueCap=unit.getObjectByName('ows-top-module');
  blueCap.material=s._material(0x677fa6,.82,.03);
  blueCap.geometry=k.shape('separator-molded-cover',()=>{
    const outline=new THREE.Shape();
    outline.moveTo(-.31,-.46);
    outline.lineTo(.31,-.46); outline.quadraticCurveTo(.46,-.46,.46,-.31);
    outline.lineTo(.46,.31); outline.quadraticCurveTo(.46,.46,.31,.46);
    outline.lineTo(-.31,.46); outline.quadraticCurveTo(-.46,.46,-.46,.31);
    outline.lineTo(-.46,-.31); outline.quadraticCurveTo(-.46,-.46,-.31,-.46);
    const cover=new THREE.ExtrudeGeometry(outline,{depth:.92,bevelSize:.04,bevelThickness:.04,bevelSegments:3,curveSegments:5});
    return cover.rotateX(-HALF).translate(0,-.46,0);
  });
  const coverZ=blueCap.position.z, coverTop=blueCap.position.y+blueCap.scale.y/2;
  k.plate(body,[.18,.009,.216],[0,coverTop+.004,coverZ],'dark');
  for(let i=-2;i<=2;i++) k.plate(body,[.169,.008,.009],[0,coverTop+.012,coverZ+i*.036],'trim');
  for(const x of [-.047,.006,.059]) k.plate(body,[.007,.008,.205],[x,coverTop+.013,coverZ],'trim');
  for(const x of [-.075,.075]) for(const z of [-.152,.152]) {
    k.plate(body,[.036,.008,.044],[x,lidY,coverZ+z],'dark');
    k.drum(body,.006,.006,[x,lidY+.007,coverZ+z],'steel');
  }
  k.drum(body,.061,.009,[.079,lidY,.205],'dark');
  k.ring(body,.057,[.079,lidY+.005,.205],'trim',[HALF,0,0]);
  for(let i=0;i<6;i++) {
    const a=i*Math.PI/3;
    k.tube(body,[.079,lidY+.011,.205],[.079+.052*Math.sin(a),lidY+.011,.205+.052*Math.cos(a)],.003,'trim');
  }
  for(const x of [-.075,-.022]) k.drum(body,.024,.006,[x,lidY,.074],'black');
  const front=local(s,body,'separator-connection-face',[95,96]);
  front.rotation.y=HALF;
  for(const x of [-.159,.087]) {
    k.plate(front,[.063,.072,.018],[x,.472,.243],'dark');
    k.tube(front,[x,.472,.248],[x,.465,.302],.020,'black');
  }
  k.arc(front,[[-.159,.47,.301],[-.159,.42,.324],[-.16,.27,.34],[-.202,.18,.405]],.016,'black');
  k.arc(front,[[.087,.47,.301],[.087,.44,.325],[.087,.37,.334],[.087,.277,.334]],.017,'black');
  // Fixed two-level sump and two bolted inspection covers beneath the right connection, #095–096.
  const sump=local(s,front,'separator-lower-sump',[95,96]);
  k.plate(sump,[.32,.16,.395],[.087,.09,.431],'kaeserDark');
  k.plate(sump,[.32,.105,.17],[.087,.221,.325],'kaeserDark');
  const cylinder=s.dryerCompressorGeometry.get('unit-cyl');
  for(const [y,z] of [[.275,.334],[.172,.517]]) {
    k.part(sump,cylinder,'dark',[.052,.009,.075],[.087,y,z]);
    for(let i=0;i<8;i++) {
      const a=i*Math.PI/4;
      k.drum(sump,.003,.004,[.087+.043*Math.sin(a),y+.006,z+.064*Math.cos(a)],'steel');
    }
  }
  const label=local(s,body,'separator-product-label',[98]);
  k.plate(label,[.11,.27,.008],[.067,.52,.313],'white');
  paintedMark(s,label,'separator-case-marking','Oil-Water Separator',.063,.207,[.067,.52,.318],0,true);
  // The brown element in front of the label belongs to the neighbouring blue dryer (#090, #098).
  const tower=room.getObjectByName('comp-dryer-spx-blue');
  const silencer=unit.getObjectByName('ows-brown-silencer');
  tower.attach(silencer);
  silencer.name='hl350-exhaust-silencer';
  const support=local(s,tower,'hl350-silencer-connection',[90,98]);
  const {x,y,z}=silencer.position;
  for(const offset of [-.19,.19]) k.drum(support,.083,.016,[x,y+offset,z],'trim');
  k.arc(support,[[x,y-.19,z],[x,y-.22,z],[x+.035,y-.244,z],[x+.13,y-.244,z]],.027,'bluePipe');
}

function receiverNameplate(s,k,parent,number,height) {
  const mount=local(s,parent,'receiver-'+number+'-manufacturer-plate',number===1?[45]:[54]);
  mount.position.set(0,height,.47);
  k.plate(mount,[.195,.144,.014],[0,0,0],'steel');
  const dark=number===1;
  k.plate(mount,[.175,.118,.006],[0,0,.011],dark?'kaeserDark':'tankLight');
  for (const x of [-.085,.085]) for (const y of [-.058,.058]) {
    k.drum(mount,.004,.006,[x,y,.013],'steel',[HALF,0,0]);
  }
  for (let i=0;i<4;i++) k.plate(mount,[.151,.002,.002],[0,-.041+i*.015,.015],dark?'trim':'dark');
  paintedMark(s,mount,'receiver-'+number+'-plate-title',dark?'HAN GANG':'AIR RECEIVER TANK',
    .15,.024,[0,.039,.016],0,false,dark?'#dddeda':'#323633');
  if (!dark) {
    k.plate(mount,[.161,.056,.008],[0,.113,-.003],'white');
    paintedMark(s,mount,'receiver-2-inspection-number','24-05-012242',.133,.021,[0,.111,.003],0);
  }
}

function receiverManhole(s,k,service) {
  // #053 shows a low access cover with two separate bridge clamps and center nuts.
  const hatch=local(s,service,'receiver-2-clamped-manhole',[53]);
  hatch.position.set(0,.70,0);
  const cylinder=s.dryerCompressorGeometry.get('unit-cyl');
  k.part(hatch,cylinder,'tankLight',[.211,.087,.194],[0,0,.427],[HALF,0,0]);
  k.part(hatch,cylinder,'trim',[.182,.067,.158],[0,0,.472],[HALF,0,0]);
  k.part(hatch,cylinder,'dark',[.166,.010,.143],[0,0,.51],[HALF,0,0]);
  const strut=k.shape('air-receiver-manhole-bridge',()=>{
    const profile=new THREE.Shape();
    profile.moveTo(-.013,-.141); profile.quadraticCurveTo(0,-.154,.013,-.141);
    profile.lineTo(.034,-.028); profile.quadraticCurveTo(.042,0,.034,.028);
    profile.lineTo(.013,.141); profile.quadraticCurveTo(0,.154,-.013,.141);
    profile.lineTo(-.034,.028); profile.quadraticCurveTo(-.042,0,-.034,-.028);
    profile.closePath();
    return new THREE.ExtrudeGeometry(profile,{depth:.024,bevelEnabled:false,curveSegments:4});
  });
  const nut=k.shape('air-receiver-manhole-nut',()=>new THREE.CylinderGeometry(1,1,1,6));
  for (const x of [-.067,.067]) {
    k.part(hatch,strut,'steel',[1,1,1],[x,0,.519]);
    k.part(hatch,nut,'galv',[.021,.023,.021],[x,0,.554],[HALF,0,0]);
  }
}

function receiverDetails(s,k,room) {
  for (const number of [1,2]) {
    const id='comp-receiver-'+number, unit=room.getObjectByName(id);
    const skin = number===1 ? 'tankGray' : 'tankLight';
    const p=local(s,unit,'survey-receiver-'+number,number===1?[44,45,46,47,48]:[50,51,52,53,54]);
    if(number===2) {
      // H-T-009 specifies Ø1130 × 2298 mm for this installed receiver.
      unit.scale.set(1.13/.92,2.298/(2.28-.30+.46*.55),1.13/.92);
      unit.userData.vesselDimensions={diameter:1.13,height:2.298,unit:'m',basis:'설비이력카드 H-T-009'};
    }
    p.rotation.y=number===1 ? -HALF : HALF;
    omit(unit,['-skirt','-gauge','-riser-pipe'].map(suffix=>id+suffix));
    const top=number===1 ? 2.22 : 2.28;
    const skirt=k.shape('perforated-air-receiver-skirt',()=>receiverSkirt(.427,.345));
    k.part(p,skirt,'skirtMetal',[1,1,1],[0,0,0]);
    k.cap(p,.438,.13,[0,.365,0],skin,[Math.PI,0,0]);
    for(const y of [.35,top-.30]) k.ring(p,.455,[0,y,0],skin,[HALF,0,0]);
    k.plate(p,[.008,top-.69,.009],[0,top/2,-.46],skin);
    // #046 and #052 show small relief fittings on the heads. The visible
    // process pipes enter the two shells at completely different heights.
    k.drum(p,.027,.066,[0,top-.023,0],'galv');
    k.drum(p,.017,.073,[0,top+.04,0],'skirtMetal');
    if (number===1) {
      receiverNameplate(s,k,p,1,.91);
      const gauge=local(s,p,'receiver-1-head-gauge',[44]);
      gauge.position.set(0,top+.045,.485);
      gauge.rotation.y=HALF;
      dial(k,gauge,.067,[0,0,0]);
      k.tube(p,[0,1.60,.44],[0,1.60,.492],.016,'galv');
      k.tube(p,[0,1.59,.485],[0,top-.02,.485],.011,'galv');
      k.ring(p,.031,[-.026,1.73,.491],'galv');
      // The green lead hangs past the plate and follows the shell to the blind side flange.
      k.arc(p,[[0,1.99,.49],[.086,1.91,.49],[.081,1.80,.50],[-.032,1.69,.51],
        [-.024,1.44,.50],[.042,.99,.50],[.14,.68,.47],[.29,.56,.39],[.46,.61,.08]],.006,'hoseGreen');
      k.drum(p,.033,.087,[0,.51,.481],'galv',[HALF,0,0]);
      const right=local(s,p,'receiver-1-blind-flange-and-outlet',[48]);
      right.rotation.y=HALF;
      k.drum(right,.078,.102,[0,.61,.47],'skirtMetal',[HALF,0,0]);
      flange(k,right,[0,.61,.53],.112,'z');
      k.tube(right,[0,1.64,.445],[0,1.64,.626],.038,'galv');
      const left=local(s,p,'receiver-1-valved-riser',[44,46]);
      left.rotation.y=-HALF;
      k.arc(left,[[0,.41,.43],[0,.41,.55],[0,.46,.58],[0,top+.04,.58],
        [-.045,top+.14,.58],[-.16,top+.16,.58],[-.55,top+.16,.58]],.043,'galv');
      for(const y of [.52,.72]) flange(k,left,[0,y,.58],.065);
      k.plate(left,[.022,.115,.021],[.049,.76,.58],'red');
    } else {
      const service=local(s,p,'receiver-2-cooler-side',[53,54]);
      service.rotation.y=-HALF;
      receiverNameplate(s,k,service,2,1.18);
      receiverManhole(s,k,service);
      k.tube(service,[0,1.49,.442],[0,1.49,.533],.018,'galv');
      k.tube(service,[0,1.49,.533],[0,1.84,.533],.012,'galv');
      k.ring(service,.026,[-.022,1.62,.533],'galv');
      dial(k,service,.064,[0,1.89,.533]);
      k.arc(service,[[-.015,1.79,.53],[-.062,1.66,.541],[-.049,1.42,.54],
        [-.077,1.15,.50],[-.084,.88,.51]],.006,'bluePipe');
      // The prominent silver run in #052 emerges from the upper SIDE of
      // the 2 m³ vessel and turns south, along the top of the cooler row.
      flange(k,p,[0,1.58,.443],.088,'z');
      k.arc(p,[[0,1.58,.444],[0,1.58,.54],[0,1.64,.60],[0,1.83,.60],
        [-.06,1.91,.60],[-.18,1.93,.60],[-1.86,1.93,.60]],.054,'galv');
      k.tube(p,[-1.47,1.93,.60],[-1.80,1.93,.60],.055,'galv');
      const wall=local(s,p,'receiver-2-wall-side-valve',[50,51]);
      wall.rotation.y=Math.PI;
      k.tube(wall,[0,.42,.435],[0,.42,.55],.046,'galv');
      flange(k,wall,[0,.42,.54],.075,'z');
      k.plate(wall,[.026,.115,.022],[0,.51,.56],'red');
    }
    k.tube(p,[.28,.09,-.21],[.28,.26,-.21],.022,'skirtMetal');
  }
}

function chillerAndWaterTank(s,k,room) {
  const chiller = room.getObjectByName('comp-chiller-bumyang');
  chiller.userData.model = '범양냉방 Water Chilling Unit';
  chiller.userData.installedCompressor = {manufacturer:'HANBELL',model:'RC10',manufactured:'2005-08',sourcePhotoNumber:61};
  const p = local(s,chiller,'survey-chiller-compressor-and-controls',[59,60,61,63,64,65,67,68,69]);
  // The front has a broad white controller door. Gauges are stacked on a
  // separate narrow white strip beside it, above the exposed screw housing.
  omit(chiller,['chiller-carel-hmi']);
  for(const child of chiller.children.filter(n=>n.name==='chiller-pressure-gauge')) child.visible=false;
  const panel=local(s,p,'chiller-front-elevation',[59,63]);
  panel.rotation.y=-HALF;
  const face=.55;
  k.plate(panel,[.215,.50,.065],[.085,1.65,face-.04],'white');
  for(const y of [1.53,1.76]) dial(k,panel,.068,[.085,y,face+.009]);
  k.plate(panel,[.3,.21,.024],[-.47,1.16,face+.007],'dark');
  k.plate(panel,[.245,.15,.014],[-.47,1.178,face+.022],'trim');
  k.plate(panel,[.166,.067,.012],[-.47,1.18,face+.036],'lcd');
  for(let i=0;i<6;i++) k.plate(panel,[.025,.014,.012],[-.559+i*.032,1.073,face+.026],'trim');
  k.drum(panel,.068,.012,[-.47,1.42,face+.014],'kaeserYellow',[HALF,0,0]);
  k.drum(panel,.033,.034,[-.47,1.42,face+.035],'red',[HALF,0,0]);
  k.plate(panel,[.035,.14,.032],[-.76,1.12,face+.025],'dark');
  for(const z of [-.83,-.69,-.05,.49,.83]) {
    k.ring(p,.231,[.14,.42,z],'chillerCream');
  }
  for(const z of [-.1,.11,.74,.87]) k.ring(p,.216,[-.05,.92,z],'chillerCream');
  for(let j=0;j<8;j++) {
    const a=2*Math.PI*j/8;
    k.drum(p,.019,.041,[-.05+.184*Math.cos(a),.92+.184*Math.sin(a),.934],'trim',[HALF,0,0]);
  }
  k.arc(p,[[-.05,.90,.95],[-.05,.90,1.03],[.05,.85,1.08],[.15,.72,1.08],[.15,.49,1.02]],.082,'chillerCream');
  k.arc(p,[[-.05,1.33,.44],[-.20,1.32,.42],[-.26,1.17,.39],[-.36,1.10,.23],[-.43,1.1,.01]],.016,'dark');
  for(const z of [-.65,.58]) k.plate(p,[1.09,.085,.095],[0,.17,z],'chillerCream');

  const tank = room.getObjectByName('comp-water-tank-pump');
  const t = local(s,tank,'survey-water-tank-seams-and-pump',[33,34,35,36]);
  // The stainless skin gives two rectangular reference faces in #034/035.
  // Using the 16 mm equivalent focal length gives L/H about 1.42 and W/H
  // about .68. The previous shell height is the scale reference.
  const width=1.00, depth=2.10, height=1.48;
  const tankBody=tank.getObjectByName('wtank-stainless-body');
  tankBody.material=s.dryerCompressorMaterials.brushedCladding;
  tankBody.scale.set(width,height,depth);
  tank.userData.cabinetDimensions={width,depth,height,unit:'m',basis:'사진 034·035 수조 외판 투영 비례 추정 · 다리·펌프 제외'};
  const pumpOffset=-(depth-1.82)/2;
  for(const node of tank.children) {
    if(node.name==='wtank-leg') {node.position.x=Math.sign(node.position.x)*.43;node.position.z=Math.sign(node.position.z)*.96;}
    if(node.name.startsWith('wpump-')) node.position.z+=pumpOffset;
  }
  const motorDetail=local(s,t,'survey-water-pump-stand-and-riser',[33,35,36]);
  motorDetail.position.z=pumpOffset;
  const stand=tank.getObjectByName('wpump-stand');
  stand.scale.set(.34,.043,.34);stand.position.y=.298;
  for(const x of [-.235,.035]) {
    for(const z of [-1.49,-1.21]) k.plate(motorDetail,[.036,.277,.035],[x,.139,z],'trim');
    k.plate(motorDetail,[.057,.025,.42],[x,.013,-1.35],'skirtMetal');
  }
  for(const side of [-1,1]) {
    for(const z of [-1.04,0,1.04]) k.plate(t,[.014,1.47,.013],[side*.502,1.06,z],'trim');
    k.plate(t,[.012,.018,depth],[side*.503,1.57,0],'steel');
    for(let i=0;i<9;i++) k.drum(t,.008,.012,[side*.510,1.57,-.97+i*.243],'trim',[0,0,HALF]);
  }
  for(const side of [-1,1]) {
    const z=side*depth/2;
    k.plate(t,[width,.024,.012],[0,1.788,z],'trim');
    k.plate(t,[width,.012,.008],[0,1.57,z],'steel');
    for(const x of [-.35,.35]) k.plate(t,[.007,1.23,.008],[x,.947,z],'trim');
    for(const x of [-.43,-.15,.15,.43]) k.drum(t,.007,.014,[x,1.57,z],'trim',[HALF,0,0]);
    // The long floor rails, diagonal leg braces and top lifting eyes are
    // visible from opposite ends in #034 and #035.
    k.plate(t,[.085,.044,2.20],[side*.43,.023,0],'skirtMetal');
    for(const end of [-1,1])
      k.plate(t,[.047,.055,.48],[side*.43,.18,end*.79],'tankLight',[end*.55,0,0]);
    k.plate(t,[.048,.036,.031],[side*.39,1.814,side*.92],'steel');
    k.ring(t,.040,[side*.39,1.861,side*.92],'trim');
  }
  for(const y of [.43,1.54])
    k.tube(t,[-.38,y,-depth/2],[-.38,y,-depth/2-.047],.018,'steel');
  k.tube(t,[-.38,.43,-depth/2-.047],[-.38,1.54,-depth/2-.047],.009,'frostedGlass');
  const motor=[-.1,.76,-1.35];
  for(let i=0;i<18;i++) {
    const a=i*2*Math.PI/18;
    k.plate(motorDetail,[.018,.33,.024],[motor[0]+.132*Math.sin(a),motor[1],motor[2]+.132*Math.cos(a)],'trim',[0,a,0]);
  }
  k.drum(motorDetail,.143,.062,[-.1,.987,-1.35],'dark');
  for(let i=-6;i<=6;i++) {
    const offset=i*.018, length=2*Math.sqrt(.124**2-offset**2);
    k.plate(motorDetail,[length,.004,.004],[-.1,1.020,-1.35+offset],'trim');
    k.plate(motorDetail,[.004,.004,length],[-.1+offset,1.021,-1.35],'trim');
  }
  k.ring(motorDetail,.131,[-.1,1.021,-1.35],'trim',[HALF,0,0]);
  for(const z of [-1.03,-1.53]) flange(k,motorDetail,[-.1,.42,z],.098,'z');
  const riser=local(s,motorDetail,'survey-water-riser-gauge',[33]);
  riser.position.set(-.1,1.73,-1.55);riser.rotation.y=-HALF;
  k.tube(riser,[0,0,0],[0,.10,.09],.018,'galv');
  dial(k,riser,.077,[0,.15,.09]);
  // Twin blue runs above the stainless tank, with short rigid stand-offs.
  for(const x of [-.10,.26]) {
    k.arc(motorDetail,[[x,2.62,-1.55],[x,2.73,-1.55],[x,2.79,-1.48],[x,2.79,-1.2],[x,2.79,1.15]],.053,'bluePipe');
    for(const z of [-.67,.75]) k.plate(motorDetail,[.095,.026,.042],[x,2.72,z],'trim');
  }
}

function coatedFloor(s, surface, metresPerTile, outside) {
  // Small variations in the continuous epoxy finish, scaled in floor metres.
  // The photographed footprints of stains and worn patches were not surveyed.
  const side = 96, pixels = new Uint8Array(side * side * 4);
  const turn = 2 * Math.PI / side;
  for (let y = 0; y < side; y++) for (let x = 0; x < side; x++) {
    const wave = Math.sin((x+y)*turn*2) + .6*Math.cos((2*x-y)*turn*3) + .4*Math.sin((x+3*y)*turn);
    const grain = ((x*17 + y*59 + x*y*31) % 19) / 19;
    const value = Math.round(228 + (outside ? 8 : 3) * wave + grain*8);
    pixels.set([value, value, value, 255], (y*side + x)*4);
  }
  const texture = new THREE.DataTexture(pixels, side, side, THREE.RGBAFormat);
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.magFilter = THREE.LinearFilter;
  texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.generateMipmaps = true;
  texture.needsUpdate = true;
  texture.repeat.set(surface.scale.x / metresPerTile, surface.scale.z / metresPerTile);
  s.textures.add(texture);
  surface.material = s._material(outside ? 0x39774e : 0x387049, outside ? .72 : .47, .06, {map: texture});
}

function fieldFinishes(s) {
  const m=s.dryerCompressorMaterials;
  // The inspection photos distinguish powder coat, rolled sheet and worn
  // vessel paint. Use a small shared finish per family, without projecting
  // a photographed shadow or a false gauge/label onto other surfaces.
  function finish(key,brushed) {
    const n=128, data=new Uint8Array(n*n*4);
    for (let y=0;y<n;y++) for (let x=0;x<n;x++) {
      const a=2*Math.PI*x/n, b=2*Math.PI*y/n;
      const grain=((x*31+y*47+x*y*3)%37)/37;
      const shade=brushed
        ? 214+7*Math.sin(a)+6*Math.cos(3*a+b)+6*Math.sin(41*b)+grain*13
        : 221+6*Math.sin(a+2*b)+4*Math.cos(3*a-b)+4*Math.cos(5*a+b)+grain*15;
      data.set([shade,shade,shade,255],(y*n+x)*4);
    }
    const texture=new THREE.DataTexture(data,n,n,THREE.RGBAFormat);
    texture.name=key;texture.colorSpace=THREE.SRGBColorSpace;
    texture.wrapS=texture.wrapT=THREE.RepeatWrapping;
    texture.magFilter=THREE.LinearFilter;texture.minFilter=THREE.LinearMipmapLinearFilter;
    texture.generateMipmaps=true;texture.needsUpdate=true;
    s.textures.add(texture);return texture;
  }
  const brushed=finish('compressor-room-rolled-metal',true),paint=finish('compressor-room-equipment-paint',false);
  for(const key of ['brushedCladding','galv','sheetSeam','steel']) {m[key].map=brushed;m[key].needsUpdate=true;}
  for(const key of ['tankGray','tankLight','chillerCream','k2Beige']) {m[key].map=paint;m[key].needsUpdate=true;}
  m.tankGray.color.setHex(0xa59f8e);m.tankLight.color.setHex(0xc1c0b2);
  m.tankGray.roughness=.72;m.tankLight.roughness=.56;
  m.brushedCladding.roughness=.37;
}

function roomServices(s,k,room,environment,spec) {
  const model = spec.rooms.find(entry=>entry.id==='compressor-room');
  const {minX,maxX,minZ,maxZ}=model.bounds;
  const envelope=environment.facade.getObjectByName('dryer-compressor-3-facade-extras');
  const skin=local(s,envelope,'survey-room-inside-panel-and-rafters',[10,33,50,64,82]);
  skin.userData.personCollision=false;
  const bevel=Math.atan2(model.height-model.lowEastHeight,maxX-minX);
  const ceilingAt=x=>model.height-(x-minX)*Math.tan(bevel);
  const midZ=(minZ+maxZ)/2;
  const midX=(minX+maxX)/2;
  // The exterior roof is green, but #010 and the return video show a pale
  // insulated sheet underside between the rafters inside the compressor room.
  k.plate(skin,[(maxX-minX-.10)/Math.cos(bevel),.022,maxZ-minZ-.09],
    [midX,ceilingAt(midX)-.028,midZ],'ceilingLiner',[0,0,-bevel]);
  // On the inside, the off-white sheet panels have restrained horizontal ribs.
  // Keep all openings clear, including the glazed band in the north wall.
  for(let y=.22;y<model.lowEastHeight-.08;y+=.145) {
    for(const x of [minX+.098,maxX-.098])
      k.plate(skin,[.010,.009,maxZ-minZ-.20],[x,y,midZ],'wallRib');
    if(y<1.71||y>2.94) k.plate(skin,[maxX-minX-.2,.009,.011],[(maxX+minX)/2,y,minZ+.096],'wallRib');
  }
  for(const z of [-11.5,-8.4,-5.3]) for(const dy of [-.072,.072]) {
    const length=(maxX-minX-.22)/Math.cos(bevel);
    k.plate(skin,[length,.022,.22],[(minX+maxX)/2,ceilingAt((minX+maxX)/2)-.12+dy,z],'white',[0,0,-bevel]);
  }
  for(let x=minX+.62;x<maxX-.38;x+=.72)
    k.plate(skin,[.024,.034,maxZ-minZ-.24],[x,ceilingAt(x)-.07,midZ],'wallRib');
  const windows=local(s,room.getObjectByName('compressor-north-window-band'),'survey-window-tracks',[11,16,20]);
  for(const x of [-2.535,-.845,.845,2.535]) {
    k.plate(windows,[.024,1.05,.035],[x,2.32,.059],'trim');
    k.plate(windows,[.052,.12,.025],[x+.035,2.13,.079],'trim');
  }
  k.plate(windows,[6.79,.027,.11],[0,1.798,.038],'steel');
  for(const z of [-10.5,-6.2]) {
    for(const side of [-1,1]) {
      k.tube(skin,[16.85,3.69,z+side*.41],[16.85,ceilingAt(16.85)-.14,z+side*.41],.008,'trim');
      k.plate(skin,[.044,.014,.98],[16.85+side*.085,3.603,z],'ceilingLamp');
    }
  }
  for(const name of ['comp-west-wall-fan','comp-east-wall-fan']) {
    const fan=room.getObjectByName(name), p=local(s,fan,'survey-vent-blades',[33,82]);
    for(let i=0;i<5;i++) {
      const angle=i*2*Math.PI/5;
      k.plate(p,[.075,.149,.018],[Math.sin(angle)*.105,Math.cos(angle)*.105,.082],'galv',[.35,0,-angle+.34]);
    }
    k.drum(p,.047,.038,[0,0,.089],'dark',[HALF,0,0]);
    for(const r of [.121,.173,.205]) k.ring(p,r,[0,0,.104],'dark');
  }
  // Fixed overhead duct faces visible from the entrance at 02:29 and
  // 04:14. Cabinet hoods join a box across the rear bay, above head level.
  const ducts=local(s,room,'survey-north-galvanized-ductwork',[10,11,18,32,37]);
  ducts.userData.sourceTimesSeconds=[149,166,171,193,254];
  const west=14.86, east=18.65, z=-11.14, y=2.95;
  k.plate(ducts,[east-west,.56,.64],[(west+east)/2,y,z],'galv');
  for(let x=west+.22;x<east-.08;x+=.70) {
    k.plate(ducts,[.027,.594,.672],[x,y,z],'sheetSeam');
    k.plate(ducts,[.080,.016,.68],[x,y-.30,z],'trim');
  }
  for(const x of [15.64,17.75]) for(const side of [-1,1])
    k.tube(ducts,[x,y-.30,z+side*.348],[x,ceilingAt(x)-.11,z+side*.348],.008,'dark');
  // Rectangular outlet over the southern end of #1. Across from it the BSD
  // bend meets the overhead trunk, with seams on the straight visible faces.
  k.plate(ducts,[.68,.52,.33],[west,y,-11.52],'galv');
  k.plate(ducts,[.61,.52,.64],[east,y,-10.56],'galv');
  for(const z0 of [-10.83,-10.40]) k.plate(ducts,[.632,.55,.028],[east,y,z0],'sheetSeam');
  const services=local(s,room,'survey-fixed-service-pipes',[12,33,46,56,58,86,87]);
  services.userData.sourceTimesSeconds=[129,139,148,187,193];
  // Walkover floor raceway seen side-on in 02:29 and 04:14, separate
  // from the exposed rigid receiver/air lines. It is flush to the floor.
  const channel=local(s,room,'survey-floor-raceway',[12,41,46]);
  channel.userData.personCollision=false;
  k.plate(channel,[4.03,.015,.12],[16.70,.023,-10.08],'skirtMetal');
  for(const x of [14.75,15.32,15.90,16.48,17.06,17.64,18.22])
    k.plate(channel,[.012,.005,.105],[x,.032,-10.08],'dark');
  // Low 90° floor pipe photographed between receiver #1 and the dark end
  // of compressor #3 (02:28). The central pedestrian aisle remains clear.
  k.arc(services,[[18.48,.27,-6.12],[18.48,.27,-6.42],[18.43,.27,-6.47],[18.09,.27,-6.47],[18.02,.27,-6.53],[18.02,.27,-6.84]],.040,'galv');
  for(const z0 of [-6.26,-6.69]) flange(k,services,[z0===-6.26?18.48:18.02,.27,z0],.07,'z');
  for(const x of [14.5,16.5,18.5,20.5]) {
    k.ring(services,.089,[x,.92,-13.06],'trim',[0,HALF,0]);
    k.ring(services,.053,[x,.64,-12.92],'trim',[0,HALF,0]);
  }
  // Video 03:13 shows small diameter silver pipe turns, upright clips and
  // lever handles behind the rear row, below the windows.
  for(const x of [16.1,19.0]) {
    k.arc(services,[[x,.67,-12.84],[x,.82,-12.84],[x,1.95,-12.84],[x,2.05,-12.80],[x,2.08,-12.68],[x,2.08,-12.31]],.031,'galv');
    for(const y0 of [1.10,1.78]) k.ring(services,.035,[x,y0,-12.84],'trim',[HALF,0,0]);
    k.plate(services,[.018,.12,.024],[x+.045,.77,-12.84],'red');
  }
  for(const x of [14.8,18.5]) for(const z0 of [-10.55,-8.18,-5.16]) {
    const pipeY=x<16?3.18:3.05;
    k.ring(services,.045,[x,pipeY,z0],'trim');
    k.tube(services,[x,pipeY+.038,z0],[x,ceilingAt(x)-.12,z0],.007,'trim');
  }
}

function wallFinish(s, kit, environment, spec) {
  const face = environment.facade.getObjectByName('dryer-compressor-3-facade-extras');
  const room = spec.rooms.find(r=>r.id==='compressor-room');
  const opening = spec.partitions.find(w=>w.roomId===room.id && w.openings?.some(o=>o.id==='compressor-room-south'));
  const door = opening.openings.find(o=>o.id==='compressor-room-south');
  const {minX,maxX,minZ,maxZ} = room.bounds;
  const doorX = opening.a[0]+door.offset;
  const trim = local(s,face,'survey-compressor-exterior-panel-joints',[6,7,8]);
  trim.userData.personCollision=false;
  const southJoint = (start,end,y) => kit.plate(trim,[end-start,.013,.018],[(start+end)/2,y,maxZ+.093],'panelJoint');
  for (let y=.32;y<room.lowEastHeight;y+=.32) {
    kit.plate(trim,[.018,.013,maxZ-minZ],[minX-.093,y,(maxZ+minZ)/2],'panelJoint');
    if (y > door.height + .08) southJoint(minX,maxX,y);
    else {
      southJoint(minX,doorX-door.width/2-.05,y);
      southJoint(doorX+door.width/2+.05,maxX,y);
    }
  }
  for(const name of ['roof-epoxy-alcove','roof-epoxy-terrace','compressor-interior-green-floor']) {
    const surface=environment.architectureFixtures.getObjectByName(name);
    coatedFloor(s,surface,2.1,name!=='compressor-interior-green-floor');
  }
}

export function buildDryerCompressorInteriorDetails(s, environment, spec) {
  if (Number(spec?.id) !== 3) return;
  const room = environment?.architectureFixtures?.getObjectByName('dryer-compressor-3-room');
  if (!room || room.userData.surveyDetailsBuilt) return;
  const m = s.dryerCompressorMaterials;
  m.lcd ||= s._material(0x879b7f, .48, .05);
  m.vesselRed ||= s._material(0x85413f, .65, .22);
  m.panelJoint ||= s._material(0xb6b6a7,.77,.18);
  m.wallRib ||= s._material(0xd0d0bc,.82,.06);
  m.sheetSeam ||= s._material(0x8e9b99,.43,.56);
  m.skirtMetal ||= s._material(0x68655b,.81,.22);
  m.hoseGreen ||= s._material(0x45695d,.80,.01);
  m.brushedCladding ||= s._material(0xabafac,.38,.69);
  m.safetyYellow ||= s._material(0xcdb163,.74,.03);
  m.ceilingLiner ||= s._material(0xd4d2c0,.87,.04);
  fieldFinishes(s);
  const kit = drawing(s);
  wallFinish(s,kit,environment,spec);
  for (const [num,id] of [[1,'comp-unit-1-kaeser-csd125sfc'],[2,'comp-unit-2-kaeser-bsd72'],[3,'comp-unit-3-kaeser-csd125']]) {
    const unit = room.getObjectByName(id);
    fitCabinet(unit,id,num);
    const [w,h,d]=cabinetSizes[num];
    kaeser(s,kit,room,num,id,w,h,d);
    const rating = num===1 ? '100마력 인버터형' : num===2 ? '50마력 정속형' : '100마력 정속형';
    const side = num===1 ? -1 : 1;
    operatingCard(s, unit, num, rating, [side*(w/2+.061),h*.71,num===1 ? .23 : -.26],side*HALF);
    if (num===1) {
      unit.userData.model = 'CSD 130 SFC';
      unit.userData.specText = 'KAESER CSD 130 SFC · 100마력 인버터형 · 2026';
    }
  }
  k50ServiceBay(s,kit,room);
  operatingCard(s,room.getObjectByName('comp-unit-4-k2power-k50'),4,'50마력 정속형',[.12,1.32,-.838],Math.PI);
  dryerDetails(s,kit,room);
  separatorDetails(s,kit,room);
  receiverDetails(s,kit,room);
  chillerAndWaterTank(s,kit,room);
  roomServices(s,kit,room,environment,spec);
  room.getObjectByName('comp-aftercooler-jac100').userData.model = 'JAC-150 After Cooler';
  room.getObjectByName('comp-dryer-ps600k').userData.model = 'PS600K';
  kit.flush();
  room.userData.surveyDetailsBuilt = true;
}
