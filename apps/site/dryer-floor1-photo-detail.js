import * as THREE from '../shared/vendor/three.module.js';

// 1층 현장 사진 241장(2026-11-26, 1.5층 관찰창·1층 바닥)으로 보강한 세부.
// 좌표는 도면 평면 좌표(X 동쪽, Z 남쪽, m)로 적고 루트에서 [-8.6, 0, -13.4]만큼
// 옮긴다. 위치·치수는 사진 비례에서 잡은 추정값이며 실측이 아니다.
// 촬영 원본: references/현장사진_원본/건조실 1층·1.5층-20261126/ (사진 번호는 촬영 시각 HHMMSS, 사진설명.csv).
export const DRYER_F1_PHOTO_SOURCE = 'field-photos-20261126-floor1';

const HALF = Math.PI / 2;
const UP = new THREE.Vector3(0, 1, 0);

function palette(s) {
  if (s.dryerF1PhotoMaterials) return s.dryerF1PhotoMaterials;
  const mat = (color, rough = .7, metal = .05, extra = {}) => s._material(color, rough, metal, extra);
  const m = {
    ss: mat(0xc5cdcf, .3, .78), ssDark: mat(0x8f999c, .38, .7), cream: mat(0xdcd4ba, .72, .06),
    creamDark: mat(0xb9b196, .7, .08), yellow: mat(0xe2b522, .55, .08), black: mat(0x1d2224, .62, .2),
    servo: mat(0x2b3033, .45, .45), orange: mat(0xe06f28, .55, .04), orangeRoller: mat(0xd77a32, .42, .2),
    red: mat(0xb2352b, .55, .05), redFloor: mat(0x8c372d, .78, .02), white: mat(0xeceee8, .6, .02),
    blue: mat(0x2c64b6, .5, .08), belt: mat(0x2c6a4f, .55, .02), roller: mat(0xb8c0c3, .3, .7),
    gray: mat(0x7e8689, .6, .3), dark: mat(0x23292b, .8, .05), cardboard: mat(0xb48e5d, .9, 0),
    sack: mat(0xcfb489, .92, 0), yellowSack: mat(0xe8c234, .85, 0), whiteSack: mat(0xe9e7de, .9, 0),
    pallet: mat(0xc7473a, .7, .02), wood: mat(0xa88052, .85, 0), screen: mat(0x1d3440, .25, .3, { emissive: 0x16303a, emissiveIntensity: .35 }),
    glass: mat(0x86a4ab, .12, .35), fanBlade: mat(0x8e2a26, .5, .2), green: mat(0x2f7d4c, .7, .02),
    yellowMesh: mat(0xe2b62a, .6, .1, { transparent: true, opacity: .38, depthWrite: false, side: THREE.DoubleSide }),
    film: mat(0xe9eef0, .2, 0, { transparent: true, opacity: .22, depthWrite: false }),
    stain: mat(0x9a8458, .95, 0, { transparent: true, opacity: .5, depthWrite: false }),
    lineYellow: mat(0xe8c42e, .6, 0, { emissive: 0x3a2e00, emissiveIntensity: .25 }),
    alu: mat(0xb9c0c3, .35, .6), lampRed: mat(0xd4382c, .4, 0, { emissive: 0x8a1408, emissiveIntensity: .6 }),
    lampGreen: mat(0x37c46a, .4, 0, { emissive: 0x0f7a32, emissiveIntensity: .7 }),
  };
  m.grating = m.ss;
  if (typeof document !== 'undefined' && typeof document.createElement === 'function') {
    const canvas = document.createElement('canvas'); canvas.width = 64; canvas.height = 128;
    const ctx = canvas.getContext?.('2d');
    if (ctx && typeof ctx.arc === 'function') {
      ctx.fillStyle = '#c3c9ca'; ctx.fillRect(0, 0, 64, 128); ctx.fillStyle = '#2a2f30';
      for (let y = 0; y < 8; y++) for (let x = 0; x < 4; x++) { ctx.beginPath(); ctx.arc(8 + x * 16 + (y % 2) * 8, 8 + y * 16, 5, 0, Math.PI * 2); ctx.fill(); }
      const map = new THREE.CanvasTexture(canvas); map.colorSpace = THREE.SRGBColorSpace;
      map.wrapS = map.wrapT = THREE.RepeatWrapping; map.repeat.set(1, 3); s.textures?.add(map);
      m.grating = mat(0xffffff, .35, .6, { map });
    }
  }
  return (s.dryerF1PhotoMaterials = m);
}

function textPlate(s, text, { width = 2.4, height = .36, background = '#f1e7a3', color = '#2b2b2b', border = '#1d1d1d' } = {}) {
  if (typeof document === 'undefined' || typeof document.createElement !== 'function') return null;
  const canvas = document.createElement('canvas'); canvas.width = 1024; canvas.height = Math.round(1024 * height / width);
  const ctx = canvas.getContext?.('2d'); if (!ctx || typeof ctx.strokeRect !== 'function') return null;
  ctx.fillStyle = background; ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.strokeStyle = border; ctx.lineWidth = 10; ctx.strokeRect(5, 5, canvas.width - 10, canvas.height - 10);
  ctx.fillStyle = color; ctx.font = `700 ${Math.round(canvas.height * .5)}px "Malgun Gothic", sans-serif`;
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(text, canvas.width / 2, canvas.height / 2, canvas.width - 40);
  const map = new THREE.CanvasTexture(canvas); map.colorSpace = THREE.SRGBColorSpace; s.textures?.add(map);
  const material = new THREE.MeshBasicMaterial({ map, side: THREE.DoubleSide }); s.materials?.add(material);
  return material;
}

export function buildDryerFloor1PhotoDetail(s, environment, spec) {
  if (Number(spec?.id) !== 1 || !environment?.architectureFixtures) return null;
  if (environment.architectureFixtures.getObjectByName('dryer-f1-photo-detail')) return null;
  const m = palette(s);
  const cache = s.dryerF1PhotoGeometry ||= new Map();
  const geo = (key, make) => { if (!cache.has(key)) { const value = make(); cache.set(key, value); s.geometries?.add(value); } return cache.get(key); };
  const unitBox = geo('box', () => new THREE.BoxGeometry(1, 1, 1));
  const unitCyl = geo('cyl', () => new THREE.CylinderGeometry(1, 1, 1, 18));
  const openCyl = geo('open-cyl', () => new THREE.CylinderGeometry(1, .86, 1, 22, 1, true));
  const disc = geo('disc', () => new THREE.CircleGeometry(1, 20));

  // Repeated parts are batched per assembly, material and shape.
  const batches = new Map(), pose = new THREE.Object3D();
  const put = (parent, geometry, paint, size, at, rotation = [0, 0, 0]) => {
    const key = `${parent.uuid}|${geometry.uuid}|${paint}`;
    if (!batches.has(key)) batches.set(key, { parent, geometry, paint, matrices: [] });
    pose.position.set(...at); pose.scale.set(...size);
    if (rotation.isQuaternion) pose.quaternion.copy(rotation); else pose.rotation.set(...rotation);
    pose.updateMatrix(); batches.get(key).matrices.push(pose.matrix.clone());
  };
  const box = (p, size, at, paint, rotation) => put(p, unitBox, paint, size, at, rotation);
  const cyl = (p, r, h, at, paint, axis = 'y') => put(p, unitCyl, paint, [r, h, r], at, axis === 'x' ? [0, 0, HALF] : axis === 'z' ? [HALF, 0, 0] : [0, 0, 0]);
  const bar = (p, a, b, r, paint) => {
    const start = new THREE.Vector3(...a), end = new THREE.Vector3(...b), axis = end.clone().sub(start), length = axis.length();
    if (length < 1e-4) return;
    put(p, unitCyl, paint, [r, length, r], start.add(end).multiplyScalar(.5).toArray(), new THREE.Quaternion().setFromUnitVectors(UP, axis.normalize()));
  };
  const flat = (p, size, at, paint) => box(p, [size[0], .006, size[1]], at, paint);

  const root = s._group(environment.architectureFixtures, [-8.6, 0, -13.4]);
  root.name = 'dryer-f1-photo-detail';
  Object.assign(root.userData, { source: DRYER_F1_PHOTO_SOURCE, photoCount: 241, dimensionsMeasured: false, positionBasis: 'photo-proportion; plan coordinates estimated' });
  const floorRoot = s._group(environment.deck, [-8.6, 0, -13.4]);
  floorRoot.name = 'dryer-f1-photo-floor-marks'; floorRoot.userData.personCollision = false;
  const overhead = s._group(environment.ducts, [-8.6, 0, -13.4]);
  overhead.name = 'dryer-f1-photo-overhead-services';
  const high = s._group(environment.facade, [-8.6, 0, -13.4]);
  high.name = 'dryer-f1-photo-high-fixtures'; high.userData.personCollision = false;
  const assembly = (parent, name, photos, extra = {}) => {
    const node = s._group(parent); node.name = `dryer-f1-photo-${name}`;
    Object.assign(node.userData, { source: DRYER_F1_PHOTO_SOURCE, photos, positionEstimated: true, dimensionsMeasured: false, ...extra });
    return node;
  };

  // ---------------------------------------------------------------- 조제실
  // 탱크 열 동쪽 바닥의 타공 덮개 배수 트렌치와 양옆 붉은 에폭시 띠(102622~102654).
  const drain = assembly(floorRoot, 'preparation-drain-trench', ['102622', '102625', '102627', '102628', '102630', '102631', '102641', '102643'], { personCollision: false });
  const TX = 28.95, T0 = 18.7, T1 = 28.3, TL = T1 - T0, TZ = (T0 + T1) / 2;
  flat(drain, [1.15, TL + .3], [TX, .022, TZ], 'redFloor');
  flat(drain, [1.0, .9], [28.25, .022, 21.0], 'redFloor');
  box(drain, [.34, .004, TL], [TX, .026, TZ], 'dark');
  for (const dx of [-.185, .185]) box(drain, [.035, .018, TL], [TX + dx, .03, TZ], 'ss');
  const covers = Math.round(TL);
  for (let i = 0; i < covers; i++) {
    const z = T0 + (i + .5) * TL / covers;
    if (i === 4) { box(drain, [.3, .006, TL / covers - .04], [TX, .029, z], 'ssDark'); continue; } // 덮개 하나는 열려 있다(102627).
    box(drain, [.34, .012, TL / covers - .03], [TX, .034, z], 'grating');
  }
  box(drain, [.36, .012, .58], [TX + .32, .07, T0 + 4.5], 'grating', [0, .4, .55]);
  box(drain, [.9, .012, .34], [28.3, .034, 21.0], 'grating');
  // 오래 쓴 에폭시 바닥의 벗겨진 자국.
  for (const [x, z, rx, rz, turn] of [[29.62, 20.2, .16, .42, .3], [28.45, 24.7, .34, .13, -.2], [29.66, 26.5, .12, .5, .1], [28.2, 19.55, .26, .1, .5], [29.75, 23.0, .1, .3, -.4], [29.7, 27.6, .2, .16, .8], [28.0, 26.0, .12, .26, .2], [29.6, 22.1, .09, .2, 0]])
    put(drain, disc, 'stain', [rx, rz, 1], [x, .028, z], [-HALF, 0, turn]);

  // 탱크 하부 이송 펌프·스트레이너·버킷(102625~102651). 기존 공통 헤더 사이 바닥에 둔다.
  const under = assembly(root, 'preparation-under-tank-pumps', ['102625', '102627', '102628', '102647', '102649', '102651']);
  for (const z of [20.2, 23.6, 27.0]) {
    const x = 28.25;
    box(under, [.3, .05, .64], [x, .045, z], 'ssDark');
    for (const dz of [-.26, .26]) for (const dx of [-.11, .11]) box(under, [.04, .05, .04], [x + dx, .01, z + dz], 'dark');
    cyl(under, .13, .4, [x, .23, z - .07], 'ss', 'z');
    cyl(under, .133, .05, [x, .23, z + .02], 'white', 'z');
    cyl(under, .1, .1, [x, .23, z + .2], 'ss', 'z');
    cyl(under, .13, .07, [x, .23, z + .28], 'ss', 'z');
    bar(under, [x, .23, z + .33], [x, .23, z + .42], .028, 'ss');
    bar(under, [x, .32, z + .28], [x, .58, z + .28], .024, 'ss');
    bar(under, [x, .58, z + .28], [x + .32, .58, z + .28], .024, 'ss');
    cyl(under, .035, .05, [x + .17, .58, z + .28], 'red', 'x');
  }
  // 스트레이너 포트: 클램프 뚜껑과 세 다리(102627, 102647).
  for (const [x, z] of [[28.45, 22.3], [28.5, 25.4]]) {
    cyl(under, .19, .48, [x, .5, z], 'ss');
    cyl(under, .2, .05, [x, .76, z], 'ssDark');
    for (let i = 0; i < 6; i++) { const a = i * Math.PI / 3; box(under, [.04, .06, .03], [x + Math.cos(a) * .2, .78, z + Math.sin(a) * .2], 'dark'); }
    for (let i = 0; i < 3; i++) { const a = i * 2 * Math.PI / 3 + .3; bar(under, [x + Math.cos(a) * .14, .27, z + Math.sin(a) * .14], [x + Math.cos(a) * .2, 0, z + Math.sin(a) * .2], .018, 'ss'); }
    bar(under, [x + .19, .4, z], [x + .45, .4, z], .025, 'ss'); cyl(under, .03, .06, [x + .32, .4, z], 'blue', 'x');
  }
  for (const [x, z] of [[29.62, 21.6], [29.6, 25.75], [27.95, 28.6]]) {
    put(under, openCyl, 'white', [.155, .36, .155], [x, .18, z]);
    cyl(under, .135, .012, [x, .006, z], 'white');
    bar(under, [x - .15, .36, z], [x + .15, .36, z], .006, 'gray');
  }
  box(under, [.05, .32, .14], [28.65, .38, 20.9], 'blue');

  // 셔터 앞·작업대 위 원료 포대는 고를 수 있는 적재물 항목이다(dryer-floor1-load-data.js).

  // 조제실 벽 보강(2026-11-26 사용자 요청): 작업대 위에서 보이던 빈틈만 막고 설비는 가리지 않는다.
  // ① 탱크 뒤 서쪽 칸막이(x 25) 위와 1.5층 벽 아래 사이 가로 틈, ② 작업대 남쪽 끝과 1.5층 통로 바닥 사이.
  // ③ 화장실 서쪽 벽 끝(용도 미확인 문을 뺀 자리).
  const closure = assembly(high, 'preparation-wall-closures', ['101702', '101717', '101721'], { userRequest: '2026-11-26', hidesEquipment: false });
  box(closure, [.18, 1.0, 20.5], [25.0, 3.45, 20.15], 'cream');
  box(closure, [10.3, .98, .12], [30.3, 2.94, 31.74], 'cream'); box(closure, [10.3, .1, .13], [30.3, 2.5, 31.74], 'green');
  const stub = assembly(root, 'preparation-toilet-west-wall-stub', ['user-request-20261126'], { replaces: 'corridor-unconfirmed-support door' });
  box(stub, [.12, .85, 1.05], [41.9, .425, 25.9], 'cream'); box(stub, [.13, .12, 1.06], [41.9, .06, 25.9], 'green');
  const stubUpper = assembly(high, 'preparation-toilet-west-wall-stub-upper', ['user-request-20261126']);
  box(stubUpper, [.12, 1.75, 1.05], [41.9, 1.725, 25.9], 'cream');

  // ---------------------------------------------------------------- 외포장실
  // 청정구역 남벽(z 16.6) 바로 아래 띠: 포장기 배출 라인마다 벽 관통구와
  // 관찰창, 녹색 벨트, 케이스 패커, 제어함, 테이핑기, 롤러가 이어진다(102741~103007).
  const WALL = 16.66, LINE_X = [3.3, 7.0, 13.6];
  // 롤러 콘베이어: 크림색 측판, 다리·조절발, 위쪽 가이드 봉과 검은 손잡이 브래킷(102847, 102737).
  const rollers = (p, x0, x1, z0, z1, width, top, paint = 'roller', pitch = .1, guides = true) => {
    const alongZ = Math.abs(z1 - z0) > Math.abs(x1 - x0), length = alongZ ? Math.abs(z1 - z0) : Math.abs(x1 - x0);
    const cx = (x0 + x1) / 2, cz = (z0 + z1) / 2, n = Math.max(2, Math.floor(length / pitch));
    const at = (t, side, y, inset = 0) => alongZ ? [cx + side * (width / 2 + .03 - inset), y, cz + t] : [cx + t, y, cz + side * (width / 2 + .03 - inset)];
    for (let i = 0; i < n; i++) {
      const t = -length / 2 + (i + .5) * length / n;
      put(p, unitCyl, paint, [.024, width, .024], alongZ ? [cx, top - .025, cz + t] : [cx + t, top - .025, cz], alongZ ? [0, 0, HALF] : [HALF, 0, 0]);
    }
    for (const side of [-1, 1]) {
      box(p, alongZ ? [.05, .12, length] : [length, .12, .05], at(0, side, top - .04), 'creamDark');
      if (guides) box(p, alongZ ? [.018, .018, length - .1] : [length - .1, .018, .018], at(0, side, top + .13, .05), 'ss');
    }
    for (let t = -length / 2 + .2; t <= length / 2 - .15; t += Math.max(.8, length / 3)) for (const side of [-1, 1]) {
      box(p, [.05, top - .12, .05], at(t, side, (top - .12) / 2), 'creamDark');
      box(p, [.09, .02, .09], at(t, side, .01), 'dark');
    }
    for (let t = -length / 2 + .2; t <= length / 2 - .15; t += Math.max(.8, length / 3)) box(p, alongZ ? [width + .06, .04, .04] : [.04, .04, width + .06], alongZ ? [cx, .25, cz + t] : [cx + t, .25, cz], 'creamDark');
    if (guides) for (let t = -length / 2 + .25; t < length / 2 - .1; t += .6) for (const side of [-1, 1]) {
      box(p, [.02, .16, .02], at(t, side, top + .05, .02), 'ss');
      cyl(p, .022, .04, at(t, side, top + .13, -.03), 'black', alongZ ? 'x' : 'z');
    }
  };
  // 벨트 콘베이어: 녹색 벨트, 앞뒤 풀리, 아래 복귀 벨트, 흰 모터와 파란 감속기(103006·103007).
  const belt = (p, x, z0, z1, width, top) => {
    const length = z1 - z0, z = (z0 + z1) / 2;
    box(p, [width, .03, length - .1], [x, top - .015, z], 'belt'); box(p, [width - .04, .02, length - .2], [x, top - .13, z], 'belt');
    for (const zz of [z0 + .05, z1 - .05]) cyl(p, .05, width, [x, top - .05, zz], 'ss', 'x');
    for (const side of [-1, 1]) { box(p, [.04, .14, length], [x + side * (width / 2 + .02), top - .05, z], 'ss'); box(p, [.03, .1, length * .92], [x + side * (width / 2 - .02), top + .06, z], 'ss'); }
    for (const zz of [z0 + .15, z1 - .15]) for (const side of [-1, 1]) { box(p, [.06, top - .12, .06], [x + side * (width / 2 - .05), (top - .12) / 2, zz], 'cream'); box(p, [.1, .02, .1], [x + side * (width / 2 - .05), .01, zz], 'dark'); }
    box(p, [width + .1, .05, .05], [x, .22, z0 + .15], 'cream'); box(p, [width + .1, .05, .05], [x, .22, z1 - .15], 'cream');
    cyl(p, .07, .22, [x + width / 2 + .2, top - .12, z1 - .2], 'white', 'x'); box(p, [.13, .15, .15], [x + width / 2 + .06, top - .12, z1 - .2], 'blue');
    box(p, [.05, .1, .08], [x + width / 2 + .2, top - .02, z1 - .2], 'white');
  };
  const wallPort = (p, x, width = .62) => {
    box(p, [width, .44, .1], [x, .95, WALL + .05], 'ss'); box(p, [width - .12, .3, .02], [x, .93, WALL + .1], 'dark');
    for (const side of [-1, 1]) box(p, [.02, .3, .03], [x + side * (width / 2 - .04), .93, WALL + .11], 'black');
    box(p, [1.0, .74, .05], [x, 1.78, WALL + .025], 'white'); box(p, [.86, .6, .02], [x, 1.78, WALL + .05], 'glass'); box(p, [.02, .6, .025], [x, 1.78, WALL + .055], 'white');
    box(p, [.36, .24, .02], [x - .2, 2.42, WALL + .03], 'white'); box(p, [.3, .05, .022], [x - .2, 2.5, WALL + .032], 'blue'); box(p, [.12, .12, .02], [x + .3, 2.42, WALL + .03], 'blue');
  };
  // 스테인리스 제어함: 문 이음·경첩, 터치 화면 테두리, 버튼 줄, 비상정지, 경광등(102741, 102756, 102805).
  const hmi = (p, x, z, facing = 1) => {
    const f = z + facing * .21;
    box(p, [.62, .9, .42], [x, 1.05, z], 'ss'); box(p, [.06, .6, .06], [x, .3, z], 'ss'); box(p, [.5, .04, .4], [x, .02, z], 'ss');
    box(p, [.008, .82, .012], [x + .05, 1.05, f], 'dark'); for (const y of [.75, 1.35]) box(p, [.03, .08, .02], [x - .29, y, f], 'gray');
    box(p, [.4, .31, .015], [x - .08, 1.24, f], 'black'); box(p, [.34, .25, .02], [x - .08, 1.24, f + facing * .004], 'screen');
    for (const [i, paint] of ['lampGreen', 'yellow', 'black', 'blue'].entries()) { cyl(p, .022, .03, [x - .22 + i * .1, .9, f], paint, 'z'); box(p, [.06, .018, .005], [x - .22 + i * .1, .96, f], 'white'); }
    box(p, [.1, .1, .01], [x + .21, .9, f], 'yellow'); cyl(p, .04, .05, [x + .21, .9, f + facing * .02], 'red', 'z');
    cyl(p, .03, .05, [x, .58, z], 'black'); box(p, [.12, .06, .06], [x + .2, 1.22, f], 'gray');
    cyl(p, .035, .5, [x + .25, 1.75, z], 'gray'); cyl(p, .045, .08, [x + .25, 2.04, z], 'lampRed'); cyl(p, .045, .08, [x + .25, 2.12, z], 'yellow'); cyl(p, .045, .08, [x + .25, 2.2, z], 'lampGreen'); cyl(p, .046, .03, [x + .25, 2.26, z], 'black');
  };
  // 케이스 패커(102745·102801·102825·102914): 구멍 뚫린 크림색 쌍기둥, 박스 보,
  // 위로 솟은 Z축과 서보, 노랑·검정 케이블 체인, 집게 둘레 노란 망 보호함.
  const casePacker = (p, x, z) => {
    const cx = x + 1.0, beamY = 2.3, head = x - .05;
    for (const dz of [-.19, .19]) {
      box(p, [.3, 2.2, .26], [cx, 1.1, z + dz], 'cream'); box(p, [.42, .05, .36], [cx, .025, z + dz], 'creamDark');
      for (const y of [.55, 1.0, 1.45, 1.9]) for (const side of [-1, 1]) box(p, [.012, .22, .12], [cx + side * .152, y, z + dz], 'dark');
      box(p, [.04, .3, .24], [cx - .2, 2.2, z + dz], 'cream', [0, 0, -.6]);
    }
    box(p, [.5, .14, .72], [cx, beamY - .07, z], 'cream');
    const length = cx + .1 - (head - .3);
    box(p, [length, .3, .3], [(cx + .1 + head - .3) / 2, beamY + .08, z], 'cream');
    for (const bx of [x + .25, x + .55]) for (const side of [-1, 1]) box(p, [.16, .13, .012], [bx, beamY + .08, z + side * .152], 'dark');
    box(p, [length - .1, .035, .1], [(cx + head) / 2, beamY + .25, z + .05], 'gray');
    const links = [];
    for (let i = 0; i < 14; i++) links.push([cx - .05 - i * .075, beamY + .3, z - .08]);
    links.forEach((at, i) => box(p, [.06, .07, .12], at, i % 2 ? 'yellow' : 'black'));
    for (let i = 0; i < 4; i++) box(p, [.06, .07, .12], [head + .12, beamY + .38 + i * .07, z - .08], i % 2 ? 'yellow' : 'black');
    box(p, [.22, .26, .22], [head, beamY + .32, z], 'servo');
    box(p, [.11, 1.4, .11], [head, beamY + .25, z + .14], 'alu'); box(p, [.13, .05, .13], [head, beamY + .97, z + .14], 'gray');
    box(p, [.16, .3, .16], [head, beamY + .62, z + .14], 'black'); cyl(p, .055, .1, [head, beamY + .82, z + .14], 'black');
    box(p, [.12, .18, .08], [head - .14, beamY + .55, z + .14], 'white');
    bar(p, [head - .14, beamY + .64, z + .14], [head - .05, beamY + 1.0, z + .2], .008, 'blue'); bar(p, [cx, beamY - .2, z - .32], [cx - .1, .9, z - .34], .01, 'blue');
    bar(p, [head, beamY + .9, z + .05], [cx - .3, beamY + .55, z - .2], .02, 'black'); bar(p, [cx - .3, beamY + .55, z - .2], [cx - .15, .95, z - .36], .02, 'black');
    box(p, [.36, .04, .26], [head, 1.47, z], 'dark'); for (const dx of [-.11, .11]) for (const dz of [-.07, .07]) cyl(p, .03, .05, [head + dx, 1.43, z + dz], 'black');
    box(p, [.06, .8, .06], [head, 1.88, z], 'ss');
    const g = [head - .48, head + .44, z - .42, z + .42];
    for (const px of [g[0], g[1]]) for (const pz of [g[2], g[3]]) box(p, [.05, 1.15, .05], [px, 1.58, pz], 'yellow');
    for (const y of [1.02, 2.14]) { box(p, [g[1] - g[0], .05, .05], [(g[0] + g[1]) / 2, y, g[2]], 'yellow'); box(p, [g[1] - g[0], .05, .05], [(g[0] + g[1]) / 2, y, g[3]], 'yellow'); for (const px of [g[0], g[1]]) box(p, [.05, .05, g[3] - g[2]], [px, y, z], 'yellow'); }
    box(p, [g[1] - g[0], 1.06, .01], [(g[0] + g[1]) / 2, 1.58, g[2]], 'yellowMesh'); box(p, [g[1] - g[0], 1.06, .01], [(g[0] + g[1]) / 2, 1.58, g[3]], 'yellowMesh'); box(p, [.01, 1.06, g[3] - g[2]], [g[0], 1.58, z], 'yellowMesh');
    box(p, [.3, .14, .05], [g[1] - .2, 2.24, g[2]], 'yellow'); box(p, [.05, .3, .05], [g[1], 2.3, g[2] + .1], 'yellow');
    for (const pz of [z - .4, z + .4]) box(p, [.96, .05, .05], [head, .95, pz], 'ss');
    box(p, [.42, .3, .34], [head, 1.02, z], 'cardboard'); box(p, [.43, .02, .35], [head, 1.0, z], 'wood');
    box(p, [.36, .32, .26], [x + .55, .95, z - .45], 'orange'); cyl(p, .06, .14, [x + .55, 1.18, z - .45], 'black');
    box(p, [.28, .22, .2], [x + .55, .55, z + .45], 'black');
  };
  // YuKwang 테이핑기(102737·102845·102848): 바깥 크림색 문형 틀, 안쪽 스테인리스 틀,
  // 노란 상부 테이프 헤드, 양옆 구동 벨트와 세운 기어모터, 옆 제어함·테이프 걸이.
  const taperLogo = textPlate(s, 'YuKwang', { width: 1.0, height: .22, background: '#ddd5bb', color: '#2a2a2a', border: '#ddd5bb' });
  const taper = (p, x, z) => {
    box(p, [1.15, .52, .95], [x, .3, z], 'cream'); box(p, [1.16, .03, .96], [x, .04, z], 'creamDark');
    for (const side of [-1, 1]) box(p, [.16, 1.8, .36], [x + side * .66, .9, z], 'cream');
    box(p, [1.48, .3, .36], [x, 1.95, z], 'cream');
    for (const face of [-1, 1]) {
      cyl(p, .07, .01, [x - .42, 1.95, z + face * .182], 'red', 'z');
      if (taperLogo) { const logo = s._mesh(geo('taper-logo-plane', () => new THREE.PlaneGeometry(.78, .16)), taperLogo, p, [x + .08, 1.95, z + face * .183]); logo.rotation.y = face > 0 ? 0 : Math.PI; logo.name = 'dryer-f1-photo-yukwang-logo'; }
    }
    for (const dx of [-.42, .42]) for (const dz of [-.36, .36]) box(p, [.04, 1.0, .04], [x + dx, 1.3, z + dz], 'ss');
    for (const dz of [-.36, .36]) box(p, [.88, .04, .04], [x, 1.8, z + dz], 'ss');
    box(p, [.28, .16, .62], [x, 1.4, z], 'yellow'); box(p, [.3, .05, .64], [x, 1.5, z], 'ss'); cyl(p, .12, .05, [x, 1.62, z + .18], 'black', 'x'); cyl(p, .06, .052, [x, 1.62, z + .18], 'cardboard', 'x');
    for (const side of [-1, 1]) {
      box(p, [.08, .3, .82], [x + side * .3, 1.0, z], 'blue'); box(p, [.02, .26, .78], [x + side * .255, 1.0, z], 'black');
      cyl(p, .085, .3, [x + side * .3, 1.32, z - .18], 'gray'); cyl(p, .07, .1, [x + side * .3, 1.52, z - .18], 'gray');
    }
    bar(p, [x + .5, 2.1, z], [x + .5, 2.32, z], .015, 'gray'); bar(p, [x + .5, 2.32, z], [x + .38, 2.32, z], .012, 'gray'); cyl(p, .025, .08, [x + .38, 2.36, z], 'black');
    box(p, [.36, .72, .56], [x + .97, .36, z + .12], 'cream'); box(p, [.3, .5, .01], [x + .97, .38, z + .4], 'creamDark');
    cyl(p, .08, .07, [x + .97, .79, z + .2], 'red', 'z'); cyl(p, .05, .072, [x + .97, .79, z + .2], 'white', 'z');
    cyl(p, .22, .04, [x - .82, .72, z + .15], 'black', 'x'); cyl(p, .08, .05, [x - .82, .72, z + .15], 'cardboard', 'x');
    for (const side of [-1, 1]) { bar(p, [x + side * .22, .95, z - .9], [x + side * .22, .95, z - .45], .012, 'ss'); box(p, [.02, .14, .02], [x + side * .22, .88, z - .7], 'ss'); }
  };
  const stool = (p, x, z) => { cyl(p, .17, .06, [x, .62, z], 'black'); cyl(p, .025, .55, [x, .33, z], 'gray'); cyl(p, .05, .1, [x, .5, z], 'black'); for (let i = 0; i < 5; i++) { const a = i * 2 * Math.PI / 5; bar(p, [x, .06, z], [x + Math.cos(a) * .26, .03, z + Math.sin(a) * .26], .014, 'gray'); cyl(p, .025, .03, [x + Math.cos(a) * .27, .025, z + Math.sin(a) * .27], 'black'); } };
  const binBag = (p, x, z) => { for (const dx of [-.2, .2]) for (const dz of [-.2, .2]) { box(p, [.03, .9, .03], [x + dx, .45, z + dz], 'ss'); cyl(p, .025, .03, [x + dx, .02, z + dz], 'black'); } box(p, [.44, .03, .44], [x, .9, z], 'ss'); box(p, [.4, .78, .4], [x, .42, z], 'blue'); box(p, [.46, .08, .46], [x, .86, z], 'blue'); };

  const lines = assembly(root, 'outer-packing-line-starts', ['102741', '102744', '102745', '102756', '102801', '102805', '102825', '102832', '102917', '102919'], { lineCount: 3, cardMatchConfirmed: false });
  for (const [index, cx] of LINE_X.entries()) {
    wallPort(lines, cx);
    belt(lines, cx, WALL + .1, 18.0, .42, .86);
    rollers(lines, cx, cx, 18.0, 18.75, .5, .86);
    casePacker(lines, cx, 18.38);
    rollers(lines, cx, cx, 18.83, index === 2 ? 26.8 : 22.05, .55, .8); // 아래 셀 입구·합류 롤러에 맞붙인다
    taper(lines, cx, 20.25);
    hmi(lines, cx - 1.05, 17.95, 1);
    stool(lines, cx - 1.0, 19.25);
    if (index < 2) binBag(lines, cx + 1.05, 19.75);
  }
  // 노란 횡단 계단: 3번 라인 롤러 위를 넘는 작업 발판(102748, 102856, 102921).
  const cross = assembly(root, 'outer-roller-crossover', ['102748', '102856', '102921'], { interFloorConnection: false, topHeight: 1.1 });
  {
    const cz = 21.3, top = 1.1, steps = 4, run = .28, half = .45;
    box(cross, [.92, .06, .9], [13.6, top - .03, cz], 'ss');
    for (const dir of [-1, 1]) {
      for (let i = 0; i < steps; i++) {
        const x = 13.6 + dir * (half + (steps - i - .5) * run), y = (i + 1) * top / (steps + 1);
        box(cross, [run, .05, .9], [x, y, cz], 'ss'); box(cross, [.03, .006, .82], [x - .07, y + .03, cz], 'gray'); box(cross, [.03, .006, .82], [x + .07, y + .03, cz], 'gray');
      }
      const foot = 13.6 + dir * (half + steps * run);
      for (const side of [-1, 1]) {
        bar(cross, [foot, 0, cz + side * .47], [13.6 + dir * half, top, cz + side * .47], .03, 'yellow');
        bar(cross, [foot, .95, cz + side * .47], [13.6 + dir * half, top + .95, cz + side * .47], .025, 'yellow');
        bar(cross, [foot, 0, cz + side * .47], [foot, .95, cz + side * .47], .025, 'yellow');
        bar(cross, [13.6 + dir * half, top, cz + side * .47], [13.6 + dir * half, top + .95, cz + side * .47], .025, 'yellow');
      }
    }
    for (const side of [-1, 1]) bar(cross, [13.6 - half, top + .95, cz + side * .47], [13.6 + half, top + .95, cz + side * .47], .025, 'yellow');
  }
  // 라인 사이 벽 앞 부품 선반(주황 부품함, 102921·102939).
  const shelves = assembly(root, 'outer-orange-bin-shelving', ['102921', '102934', '102939'], { binCountRepresentative: true });
  for (const x0 of [9.95, 11.15]) {
    for (const dx of [0, 1.05]) for (const dz of [0, .42]) box(shelves, [.035, 1.8, .035], [x0 + dx, .9, 16.82 + dz], 'gray');
    for (const y of [.12, .6, 1.08, 1.56]) {
      box(shelves, [1.08, .025, .45], [x0 + .525, y, 17.03], 'gray');
      for (let i = 0; i < 3; i++) box(shelves, [.3, .17, .38], [x0 + .18 + i * .345, y + .1, 17.05], 'orange');
    }
  }
  // 3번 라인 옆에 혼자 서 있던 골판지 묶음은 의미 없는 적재라 뺐다(2026-11-26 사용자 요청).

  // 지대(포대) 라인: 청정구역 벽을 지나 벨트→중량선별기→스테인리스 판→CC-4 곡선 롤러→팔레타이저(102847, 103001~103007).
  const bag = assembly(root, 'outer-bag-line-outfeed', ['102847', '103001', '103003', '103006', '103007'], { conveyorPlate: 'CC-4 콘베어 라인', connectsTo: 'f1-palletizer' });
  const BX = 17.05;
  wallPort(bag, BX, .82);
  belt(bag, BX, WALL + .1, 19.35, .6, .76);
  // 금속검출 터널과 중량 선별 벨트(103006): 스테인리스 틀·바퀴, 흰 벨트, 검은 단자함, 적·녹 경광등, 흰 모터·파란 감속기.
  for (const dx of [-.36, .36]) for (const dz of [-.42, .42]) { box(bag, [.05, .66, .05], [BX + dx, .37, 19.9 + dz], 'ss'); cyl(bag, .04, .03, [BX + dx, .04, 19.9 + dz], 'black', 'x'); }
  for (const dx of [-.36, .36]) box(bag, [.05, .06, .95], [BX + dx, .2, 19.9], 'ss');
  for (const dx of [-.36, .36]) box(bag, [.05, .12, 1.0], [BX + dx, .72, 19.9], 'ss');
  box(bag, [.66, .03, .98], [BX, .775, 19.9], 'white'); box(bag, [.62, .02, .9], [BX, .64, 19.9], 'dark');
  box(bag, [.94, .17, .46], [BX, 1.26, 19.82], 'ss'); for (const side of [-1, 1]) box(bag, [.12, .5, .46], [BX + side * .41, .99, 19.82], 'ss');
  box(bag, [.7, .3, .02], [BX, .95, 19.58], 'dark'); box(bag, [.34, .14, .24], [BX, 1.415, 19.82], 'black'); cyl(bag, .03, .05, [BX + .1, 1.5, 19.82], 'black');
  cyl(bag, .016, .9, [BX - .5, 1.2, 20.3], 'gray'); cyl(bag, .05, .14, [BX - .5, 1.72, 20.3], 'white'); cyl(bag, .05, .08, [BX - .5, 1.83, 20.3], 'lampRed'); cyl(bag, .05, .08, [BX - .5, 1.91, 20.3], 'lampGreen');
  cyl(bag, .08, .26, [BX + .55, .5, 20.25], 'white', 'x'); box(bag, [.16, .17, .17], [BX + .34, .5, 20.25], 'blue'); box(bag, [.08, .1, .1], [BX + .55, .66, 20.25], 'white');
  box(bag, [.42, .28, .22], [BX - .1, .32, 20.55], 'gray'); box(bag, [.14, .14, .1], [BX - .1, .52, 20.55], 'film');
  cyl(bag, .03, .9, [BX + .52, 1.15, 19.6], 'ss'); box(bag, [.34, .26, .06], [BX + .52, 1.62, 19.6], 'ss'); box(bag, [.28, .2, .01], [BX + .52, 1.62, 19.565], 'screen');
  box(bag, [.95, .04, 1.05], [BX, .78, 20.95], 'ss'); for (const dx of [-.42, .42]) for (const dz of [-.45, .45]) box(bag, [.05, .76, .05], [BX + dx, .38, 20.95 + dz], 'ss');
  box(bag, [.95, .1, .04], [BX, .84, 21.47], 'ss');
  binBag(bag, BX - .95, 20.7);
  const arc = (cx, cz, radius, a0, a1, width, top) => {
    const n = Math.ceil(Math.abs(a1 - a0) * radius / .09);
    for (let i = 0; i < n; i++) {
      const a = a0 + (i + .5) * (a1 - a0) / n, dir = [Math.cos(a), Math.sin(a)];
      put(bag, unitCyl, 'orangeRoller', [.024, width, .024], [cx + dir[0] * radius, top - .025, cz + dir[1] * radius], new THREE.Quaternion().setFromUnitVectors(UP, new THREE.Vector3(dir[0], 0, dir[1])));
    }
    const segments = Math.ceil(Math.abs(a1 - a0) * (radius + width / 2) / .25);
    for (let i = 0; i < segments; i++) {
      const a = a0 + (i + .5) * (a1 - a0) / segments, dir = [Math.cos(a), Math.sin(a)];
      for (const r of [radius - width / 2 - .03, radius + width / 2 + .03]) box(bag, [.05, .14, (Math.abs(a1 - a0) * r) / segments + .01], [cx + dir[0] * r, top - .04, cz + dir[1] * r], 'cream', [0, -a, 0]);
      if (i % 3 === 1) for (const r of [radius - width / 2, radius + width / 2]) box(bag, [.05, top - .1, .05], [cx + dir[0] * r, (top - .1) / 2, cz + dir[1] * r], 'cream');
    }
  };
  arc(BX - .85, 21.5, .85, 0, HALF, .62, .8);
  arc(BX - .85, 23.2, .85, -HALF, -Math.PI, .62, .8);
  rollers(bag, 15.35, 15.35, 23.2, 23.45, .62, .8, 'orangeRoller');
  box(bag, [.03, .14, .5], [BX + .02, .7, 22.0], 'white');

  // 회전식 스트레치 랩핑기와 파레트 공급기: 1.5층 남측 통로 아래(102023~102051, 102709~102711).
  const wrap = assembly(root, 'outer-turntable-stretch-wrapper', ['102023', '102025', '102026', '102047', '102051'], { underMezzanineCorridor: true });
  // 큰 원형 회전판 위 두 줄 체인 콘베이어, 필름 롤 마스트, 위에서 누르는 크림색 팔(102023·102025·102047).
  { const x = 15.6, z = 33.9;
    cyl(wrap, 1.05, .1, [x, .05, z], 'creamDark'); cyl(wrap, 1.0, .06, [x, .13, z], 'white'); cyl(wrap, 1.03, .02, [x, .17, z], 'ss');
    for (const dx of [-.33, .33]) { box(wrap, [.1, .04, 1.9], [x + dx, .18, z], 'black'); for (let i = 0; i < 19; i++) box(wrap, [.12, .012, .03], [x + dx, .205, z - .9 + i * .1], 'gray'); }
    box(wrap, [.16, .02, .16], [x + .55, .17, z + .62], 'dark'); box(wrap, [.08, .012, .08], [x + .55, .182, z + .62], 'white');
    box(wrap, [1.1, .14, 1.1], [x, .28, z], 'pallet');
    for (let layer = 0; layer < 6; layer++) for (let i = 0; i < 3; i++) for (let j = 0; j < 2; j++) {
      const along = layer % 2 === 0, a = -.36 + i * .36, b = -.26 + j * .52, y = .43 + layer * .17;
      box(wrap, along ? [.34, .16, .5] : [.5, .16, .34], along ? [x + a, y, z + b] : [x + b, y, z + a], 'sack');
    }
    box(wrap, [1.1, .98, 1.1], [x, .85, z], 'film');
    box(wrap, [.5, .42, .5], [x + 1.58, .21, z], 'yellow'); box(wrap, [.26, 2.55, .26], [x + 1.58, 1.69, z], 'cream'); box(wrap, [.3, .06, .3], [x + 1.58, 2.98, z], 'gray');
    box(wrap, [.36, .5, .3], [x + 1.36, 1.2, z], 'black'); cyl(wrap, .1, .52, [x + 1.24, 1.2, z - .18], 'white'); for (const dy of [-.18, .18]) cyl(wrap, .03, .5, [x + 1.2, 1.2 + dy, z + .08], 'gray');
    for (const dz of [-.92, .92]) { box(wrap, [.24, 2.85, .24], [x - 1.4, 1.425, z + dz], 'cream'); box(wrap, [.4, .04, .4], [x - 1.4, .02, z + dz], 'creamDark'); }
    box(wrap, [.26, .3, 2.08], [x - 1.4, 2.95, z], 'cream');
    for (const dz of [-.22, .22]) box(wrap, [2.95, .2, .14], [x + .05, 2.95, z + dz], 'cream');
    box(wrap, [.9, .1, .9], [x, 2.32, z], 'creamDark'); box(wrap, [.5, .1, .5], [x, 2.42, z], 'cream'); bar(wrap, [x, 2.47, z], [x, 2.85, z], .06, 'ss'); cyl(wrap, .11, .3, [x, 2.88, z], 'cream');
    hmi(wrap, x + 1.6, z + .75, -1);
  }
  const magazine = assembly(root, 'outer-pallet-magazine', ['102709', '102711', '101849'], { feedDoor: 'south-pallet-2' });
  // 크림색 2단 틀, 모서리 회색 안내판, 주황 파레트 적층, 경광등·누름단추함, 아래 체인 이송부(102709·102711).
  { const x = 18.5, z = 33.9;
    for (const dx of [-.72, .72]) for (const dz of [-.62, .62]) { box(magazine, [.12, 2.3, .12], [x + dx, 1.15, z + dz], 'cream'); box(magazine, [.24, .03, .24], [x + dx, .015, z + dz], 'creamDark'); }
    for (const y of [.95, 1.62, 2.25]) { for (const dx of [-.72, .72]) box(magazine, [.12, .12, 1.36], [x + dx, y, z], 'cream'); box(magazine, [1.56, .12, .12], [x, y, z - .62], 'cream'); }
    for (const dx of [-.56, .56]) for (const dz of [-.47, .47]) {
      box(magazine, [.26, 1.7, .03], [x + dx - Math.sign(dx) * .1, 1.6, z + dz], 'gray'); box(magazine, [.03, 1.7, .22], [x + dx, 1.6, z + dz - Math.sign(dz) * .1], 'gray');
      box(magazine, [.2, .05, .16], [x + dx, 2.48, z + dz], 'gray');
    }
    for (let i = 0; i < 9; i++) { box(magazine, [1.1, .14, 1.0], [x, .5 + i * .155, z], 'orange'); box(magazine, [1.0, .02, .9], [x, .575 + i * .155, z], 'pallet'); }
    for (const dx of [-.3, .3]) { box(magazine, [.09, .12, 1.3], [x + dx, .26, z], 'black'); box(magazine, [.12, .2, .12], [x + dx, .1, z - .55], 'creamDark'); }
    box(magazine, [1.3, .08, .08], [x, .14, z + .55], 'creamDark'); box(magazine, [.22, .2, .22], [x + .2, .12, z + .7], 'gray');
    cyl(magazine, .02, .4, [x + .66, 2.45, z - .64], 'gray'); cyl(magazine, .045, .08, [x + .66, 2.68, z - .64], 'lampRed'); cyl(magazine, .045, .08, [x + .66, 2.6, z - .64], 'lampGreen'); cyl(magazine, .045, .1, [x + .66, 2.5, z - .64], 'white');
    box(magazine, [.15, .3, .1], [x + .5, 1.3, z - .7], 'gray'); for (const [i, c] of ['lampGreen', 'black', 'black', 'red'].entries()) cyl(magazine, .025, .03, [x + .5, 1.41 - i * .07, z - .76], c, 'z');
    bar(magazine, [x + .5, 1.15, z - .7], [x + .45, .3, z - .66], .012, 'black');
  }

  // 벽면: 조제실 쪽 칸막이(x 25)의 안전 게시판·소화전(102713, 102813).
  const wall = assembly(root, 'outer-east-wall-safety-board', ['102713', '102813']);
  box(wall, [.03, 1.15, 2.3], [24.88, 1.75, 21.9], 'green');
  for (let i = 0; i < 4; i++) for (let j = 0; j < 2; j++) box(wall, [.01, .34, .26], [24.86, 1.98 - j * .45, 21.05 + i * .55], 'white');
  box(wall, [.02, .34, 2.5], [24.88, 2.65, 21.9], 'yellow');
  const banner = textPlate(s, '안전은 보호구 착용에서 시작된다', { width: 2.5, height: .34, background: '#f6f2dc', color: '#1f3e7a', border: '#e4bd1f' });
  if (banner) { const face = s._mesh(geo('banner-plane', () => new THREE.PlaneGeometry(2.42, .28)), banner, wall, [24.865, 2.65, 21.9]); face.rotation.y = -HALF; face.name = 'dryer-f1-photo-safety-banner'; }
  box(wall, [.16, .95, .62], [24.82, 1.1, 25.2], 'red'); box(wall, [.01, .5, .45], [24.735, 1.2, 25.2], 'white');

  // 1.5층 유리 사무실 아래 1층 모니터링 책상(102014): 모니터 두 대, PC, 의자, 벽시계.
  const desk = assembly(root, 'outer-monitoring-desk', ['102014', '101957'], { function: 'line monitoring PC desk; screen contents not modelled' });
  box(desk, [.72, .04, 1.25], [24.5, .74, 24.0], 'white');
  for (const dx of [-.32, .32]) for (const dz of [-.58, .58]) box(desk, [.04, .72, .04], [24.5 + dx, .36, 24.0 + dz], 'gray');
  for (const z of [23.7, 24.32]) { box(desk, [.05, .34, .52], [24.76, 1.06, z], 'black'); box(desk, [.006, .3, .48], [24.73, 1.06, z], 'screen'); box(desk, [.18, .02, .16], [24.78, .77, z], 'black'); box(desk, [.04, .14, .04], [24.79, .85, z], 'black'); }
  box(desk, [.16, .02, .46], [24.3, .77, 24.0], 'black'); box(desk, [.1, .015, .07], [24.3, .77, 24.38], 'black');
  box(desk, [.42, .42, .2], [24.55, .23, 23.55], 'black');
  cyl(desk, .23, .07, [23.72, .5, 24.0], 'black'); box(desk, [.08, .48, .42], [23.48, .8, 24.0], 'black'); cyl(desk, .03, .4, [23.72, .27, 24.0], 'gray');
  for (let i = 0; i < 5; i++) { const a = i * 2 * Math.PI / 5; bar(desk, [23.72, .07, 24.0], [23.72 + Math.cos(a) * .3, .04, 24.0 + Math.sin(a) * .3], .016, 'gray'); }
  cyl(desk, .17, .04, [24.87, 2.45, 24.0], 'white', 'x'); cyl(desk, .18, .03, [24.885, 2.45, 24.0], 'black', 'x');
  box(desk, [.006, .1, .012], [24.84, 2.48, 24.0], 'black'); box(desk, [.006, .012, .08], [24.84, 2.45, 24.03], 'black');

  // 바닥 노란 파레트 구획선(101809, 102713, 102723).
  const lines2 = assembly(floorRoot, 'outer-floor-pallet-zones', ['101809', '101811', '102713', '102723'], { personCollision: false });
  const zone = (x, z, w, d) => { for (const side of [-1, 1]) { flat(lines2, [w + .07, .07], [x, .024, z + side * d / 2], 'lineYellow'); flat(lines2, [.07, d], [x + side * w / 2, .024, z], 'lineYellow'); } };
  // 홀 가운데 묶음과 3번 라인 옆 묶음을 빼면서 그 구획선도 함께 지웠다.

  // 천장: 대형 실링팬(HVLS, 붉은 날개)과 색상 배관(101809, 102713, 103001).
  // 높이 6 m 근처 설비는 1.5층 바닥이 없는 2층 높이 공간(x 9.5~21.3, z 16.8~30.3)에만 둔다.
  const VOID = { minX: 9.5, maxX: 21.3, minZ: 16.8, maxZ: 30.3 };
  const fans = assembly(high, 'outer-hvls-ceiling-fans', ['101809', '102713'], { bladeCount: 6, rotating: false, keptInsideDoubleHeight: VOID });
  for (const [x, z] of [[12.3, 20.2], [17.6, 27.2]]) {
    cyl(fans, .045, .55, [x, 6.3, z], 'gray'); cyl(fans, .3, .16, [x, 5.98, z], 'gray'); cyl(fans, .18, .1, [x, 5.86, z], 'dark');
    for (let i = 0; i < 6; i++) { const a = i * Math.PI / 3; box(fans, [2.3, .03, .2], [x + Math.cos(a) * 1.4, 5.96, z + Math.sin(a) * 1.4], 'fanBlade', [0, -a, .04]); }
  }
  const pipes = assembly(overhead, 'outer-colored-overhead-pipes', ['103001', '102849', '102853'], { destinationsUnconfirmed: true, keptInsideDoubleHeight: VOID });
  for (const [i, [paint, r]] of [['yellow', .045], ['blue', .042], ['white', .06]].entries()) bar(pipes, [VOID.minX + .1, 4.7 + i * .02, 22.15 + i * .2], [VOID.maxX - .1, 4.7 + i * .02, 22.15 + i * .2], r, paint);
  for (let x = 10.2; x < VOID.maxX; x += 3) { bar(pipes, [x, 4.62, 22.0], [x, 4.62, 22.75], .02, 'gray'); bar(pipes, [x, 4.62, 22.0], [x, 6.6, 22.0], .012, 'gray'); bar(pipes, [x, 4.62, 22.75], [x, 6.6, 22.75], .012, 'gray'); }
  for (const x of [13.6, 17.05]) { bar(pipes, [x + .35, 4.7, 22.35], [x + .35, 2.6, 22.35], .02, 'blue'); bar(pipes, [x + .35, 2.6, 22.35], [x + .35, 2.6, 21.0], .02, 'blue'); }
  // 1번·2번 라인은 OP실 바닥 아래이므로 1.5층 슬래브 밑(3.15 m)으로 공기관을 끌어온다.
  bar(pipes, [VOID.minX + .05, 4.7, 22.35], [VOID.minX + .05, 3.15, 22.35], .02, 'blue');
  bar(pipes, [VOID.minX + .05, 3.15, 22.35], [VOID.minX + .05, 3.15, 21.2], .02, 'blue');
  bar(pipes, [LINE_X[0] + .35, 3.15, 21.2], [VOID.minX + .05, 3.15, 21.2], .02, 'blue');
  for (const x of LINE_X.slice(0, 2)) bar(pipes, [x + .35, 3.15, 21.2], [x + .35, 2.6, 21.2], .02, 'blue');

  // 출하 대기·원료·빈 파레트·골판지 묶음은 설비 목록에서 고르는 적재물 항목(buildDryerFloor1Load)으로 옮겼다.

  // Flush: one instanced mesh per assembly, shape and paint.
  let meshes = 0;
  for (const { parent, geometry, paint, matrices } of batches.values()) {
    const mesh = new THREE.InstancedMesh(geometry, m[paint], matrices.length);
    matrices.forEach((matrix, i) => mesh.setMatrixAt(i, matrix));
    mesh.instanceMatrix.needsUpdate = true; mesh.computeBoundingBox(); mesh.computeBoundingSphere();
    mesh.name = `${parent.name}-${paint}`; mesh.castShadow = false; mesh.receiveShadow = true;
    if (['stain', 'film', 'yellowMesh', 'lineYellow', 'redFloor'].includes(paint) || parent.userData.personCollision === false) mesh.userData.personCollision = false;
    parent.add(mesh); meshes++;
  }
  root.userData.instancedMeshes = meshes;
  return { root, floorRoot, overhead, high, meshes };
}

// ---------------------------------------------------------------- 적재물 항목
// 2팀 3층 렉·평치 적재물처럼 고르고 옮길 수 있는 1층 적재물. 파레트는 g[0],
// 박스·포대·필름은 g[1]에 두고 「적재물 표시」가 g[1]만 끈다.
export function buildDryerFloor1Load(s, root, item) {
  const spec = item?.dryerLoad;
  if (item?.type !== 'f1-load' || !spec) return false;
  const m = palette(s);
  const cache = s.dryerF1PhotoGeometry ||= new Map();
  if (!cache.has('box')) { const g = new THREE.BoxGeometry(1, 1, 1); cache.set('box', g); s.geometries?.add(g); }
  const unitBox = cache.get('box');
  const pallets = s._group(root), cargo = s._group(root);
  pallets.name = `dryer-f1-load-${item.id}-pallets`; cargo.name = `dryer-f1-load-${item.id}-cargo`;
  const batches = new Map(), pose = new THREE.Object3D();
  const box = (parent, size, at, paint, rotation = [0, 0, 0]) => {
    const key = parent.uuid + paint;
    if (!batches.has(key)) batches.set(key, { parent, paint, matrices: [] });
    pose.position.set(...at); pose.scale.set(...size); pose.rotation.set(...rotation); pose.updateMatrix();
    batches.get(key).matrices.push(pose.matrix.clone());
  };
  let seed = [...item.id].reduce((value, char) => (value * 31 + char.charCodeAt(0)) >>> 0, 20261126);
  const rnd = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);
  const y0 = spec.baseHeight || 0;
  const palletBase = (x, z, paint, lift = 0) => {
    const y = y0 + lift;
    if (paint === 'wood') {
      for (const dz of [-.47, 0, .47]) box(pallets, [1.1, .1, .1], [x, y + .05, z + dz], 'wood');
      for (let i = 0; i < 7; i++) box(pallets, [.13, .025, 1.1], [x - .48 + i * .16, y + .113, z], 'wood');
      return y + .125;
    }
    box(pallets, [1.1, .045, 1.1], [x, y + .128, z], paint);
    for (const dx of [-.46, 0, .46]) for (const dz of [-.46, 0, .46]) box(pallets, [.16, .105, .16], [x + dx, y + .053, z + dz], paint);
    return y + .15;
  };
  const film = (x, z, base, top) => box(cargo, [1.1, top - base + .02, 1.1], [x, (top + base) / 2, z], 'film');
  const cartons = (x, z, layers, palletPaint = 'pallet') => {
    const base = palletBase(x, z, palletPaint), h = .27;
    for (let layer = 0; layer < layers; layer++) {
      const y = base + h / 2 + layer * h, turn = layer % 2 === 1;
      for (let i = 0; i < 3; i++) for (let j = 0; j < 4; j++) {
        const a = -.36 + i * .36, b = -.405 + j * .27, at = turn ? [x + b, y, z + a] : [x + a, y, z + b], size = turn ? [.265, h - .01, .355] : [.355, h - .01, .265];
        box(cargo, size, at, 'cardboard'); box(cargo, [size[0] + .004, .055, size[2] + .004], [at[0], y + .06, at[2]], 'red');
        if ((i + j + layer) % 3 === 0) box(cargo, [.12, .004, .08], [at[0], y + h / 2 - .003, at[2]], 'white');
      }
    }
    film(x, z, base, base + layers * h);
  };
  const sacks = (x, z, layers, paint = 'sack', palletPaint = 'pallet', wrapped = true) => {
    const base = palletBase(x, z, palletPaint), h = .16;
    for (let layer = 0; layer < layers; layer++) {
      const y = base + h / 2 + layer * h, turn = layer % 2 === 1;
      for (let i = 0; i < 3; i++) for (let j = 0; j < 2; j++) {
        const a = -.36 + i * .36, b = -.26 + j * .52, w = .33 + rnd() * .03, d = .5 + rnd() * .03, yaw = (rnd() - .5) * .09 + (turn ? HALF : 0);
        const at = turn ? [x + b, y, z + a] : [x + a, y, z + b];
        box(cargo, [w, h - .015, d], at, paint, [0, yaw, 0]); box(cargo, [w * .78, .03, d * .8], [at[0], y + h / 2 - .005, at[2]], paint, [0, yaw, 0]);
        if (paint === 'sack') box(cargo, [.1, .006, .2], [at[0], y + h / 2 + .012, at[2]], 'dark', [0, yaw, 0]);
      }
    }
    if (wrapped) film(x, z, base, base + layers * h);
  };
  const zone = (x, z, w, d) => { for (const side of [-1, 1]) { box(pallets, [w + .07, .006, .07], [x, y0 + .024, z + side * d / 2], 'lineYellow'); box(pallets, [.07, .006, d], [x + side * w / 2, y0 + .024, z], 'lineYellow'); } };
  for (const [x, z, kind, layers, palletPaint] of spec.pallets || []) {
    if (kind === 'carton') cartons(x, z, layers, palletPaint);
    else sacks(x, z, layers, kind, palletPaint, spec.wrapped !== false);
  }
  for (const [x, z, layers] of spec.stacks || []) for (let layer = 0; layer < layers; layer++) {
    const y = y0 + .075 + layer * .15;
    for (const dz of [-.21, .21]) { box(cargo, [.48, .14, .4], [x, y, z + dz], 'sack'); box(cargo, [.49, .02, .12], [x, y + .062, z + dz], 'green'); }
  }
  for (const [x, z, paint, count] of spec.empties || []) for (let i = 0; i < count; i++) palletBase(x + (rnd() - .5) * .04, z + (rnd() - .5) * .04, paint, i * (paint === 'wood' ? .128 : .152));
  for (const [x, z, h] of spec.blanks || []) {
    box(pallets, [1.15, .14, 1.0], [x, y0 + .07, z], 'wood');
    box(cargo, [1.1, h, .95], [x, y0 + .14 + h / 2, z], 'cardboard');
    for (let y = .2; y < h; y += .09) box(cargo, [1.112, .006, .962], [x, y0 + .14 + y, z], 'wood');
    for (const dx of [-.3, .3]) box(cargo, [.03, h + .01, .965], [x + dx, y0 + .14 + h / 2, z], 'white');
    film(x, z, y0 + .14, y0 + .14 + h);
  }
  if (spec.zone) zone(0, 0, ...spec.zone);
  for (const [x, z, w, d] of spec.zones || []) zone(x, z, w, d);
  for (const { parent, paint, matrices } of batches.values()) {
    const mesh = new THREE.InstancedMesh(unitBox, m[paint], matrices.length);
    matrices.forEach((matrix, i) => mesh.setMatrixAt(i, matrix));
    mesh.instanceMatrix.needsUpdate = true; mesh.computeBoundingBox(); mesh.computeBoundingSphere();
    mesh.name = `${parent.name}-${paint}`; mesh.castShadow = true; mesh.receiveShadow = true;
    if (['film', 'lineYellow'].includes(paint)) { mesh.castShadow = false; mesh.userData.personCollision = false; }
    parent.add(mesh);
  }
  Object.assign(root.userData, { dryerLoad: true, source: DRYER_F1_PHOTO_SOURCE, dimensionsMeasured: false });
  root.userData.packagingCargo = cargo;
  return true;
}
