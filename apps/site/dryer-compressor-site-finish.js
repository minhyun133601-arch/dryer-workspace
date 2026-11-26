import * as THREE from '../shared/vendor/three.module.js';

// Installed condition of the 3F air compressor room on 2026-11-24: worn epoxy,
// insulated panels, steel frame, air piping, valves, cabinets and cables. Read
// frame by frame from the continuous video (01:34–04:28) and photos 010–100.
// Coordinates are metres in the building frame with Y measured from the 3F
// slab. They follow the surveyed machines, and are not field measurements.
const ROOM = { minX: 13.4, maxX: 22.2, minZ: -13.4, maxZ: -3.4, west: 4.4, east: 3.3 };
const FACE = { w: 13.472, e: 22.128, n: -13.328, s: -3.472 };
const SLOPE = (ROOM.west - ROOM.east) / (ROOM.maxX - ROOM.minX);
const ceiling = x => ROOM.west - (x - ROOM.minX) * SLOPE;
const DOOR = { x: 16.85, half: .99, top: 2.28 };
const WINDOW = { x0: 14.4, x1: 21.2, y0: 1.75, y1: 2.9 };
const LAMPS = [[16.95, 3.18, -6.35], [16.95, 3.18, -10.05]];
const HALF = Math.PI / 2;
const UP = new THREE.Vector3(0, 1, 0);

// ---------------------------------------------------------------------------
// Local lighting. The site-wide sky light gives every surface an open-air look
// and paints downward faces green. Inside this room the two pendant lamps, the
// north glazing and the sun entering through it are evaluated per fragment.
// ---------------------------------------------------------------------------
function lightingChunk(elevation) {
  const f = v => Number(v) < 0 ? `(${Number(v).toFixed(4)})` : Number(v).toFixed(4);
  return `
varying vec3 vAirWorld;
bool airInside(vec3 p){return p.x>${f(ROOM.minX - .02)}&&p.x<${f(ROOM.maxX + .02)}&&p.z>${f(ROOM.minZ - .02)}&&p.z<${f(ROOM.maxZ + .02)}&&p.y>${f(elevation - .05)}&&p.y<${f(elevation + ROOM.west + .08)};}
float airBox(vec3 o,vec3 d,vec3 lo,vec3 hi){vec3 a=(lo-o)/d,b=(hi-o)/d;vec3 n=min(a,b),x=max(a,b);float t0=max(max(n.x,n.y),n.z),t1=min(min(x.x,x.y),x.z);return (t1>max(t0,.02))?0.:1.;}
float airSun(vec3 p){
  vec3 d=normalize(vec3(.17,.53,-.84));
  float t=(${f(ROOM.minZ)}-p.z)/d.z; vec3 h=p+d*t;
  vec2 c=vec2(h.x,h.y);
  float glass=smoothstep(${f(WINDOW.x0)},${f(WINDOW.x0 + .07)},c.x)*(1.-smoothstep(${f(WINDOW.x1 - .07)},${f(WINDOW.x1)},c.x))*smoothstep(${f(WINDOW.y0)},${f(WINDOW.y0 + .06)},c.y)*(1.-smoothstep(${f(WINDOW.y1 - .06)},${f(WINDOW.y1)},c.y));
  float m=abs(fract((c.x-${f(WINDOW.x0)})/1.7+.5)-.5)*1.7; glass*=smoothstep(.02,.10,m);
  if(glass<.01)return 0.;
  glass*=airBox(p,d,vec3(14.20,0.,-12.21),vec3(15.50,1.95,-10.09));
  glass*=airBox(p,d,vec3(18.14,0.,-11.27),vec3(19.16,1.70,-9.73));
  glass*=airBox(p,d,vec3(20.46,0.,-12.04),vec3(21.74,1.78,-10.36));
  glass*=airBox(p,d,vec3(18.10,0.,-8.63),vec3(19.21,1.90,-6.87));
  glass*=airBox(p,d,vec3(14.43,2.06,-12.49),vec3(21.94,2.76,-11.81));
  glass*=airBox(p,d,vec3(14.43,2.06,-11.81),vec3(15.09,2.76,-10.16));
  glass*=airBox(p,d,vec3(18.3,2.0,-11.04),vec3(21.94,2.76,-10.40));
  glass*=airBox(p,d,vec3(20.8,.3,-9.05),vec3(21.8,1.8,-6.95));
  return glass;
}
vec3 airLight(vec3 p,vec3 n){
  float up=n.y*.5+.5;
  vec3 light=mix(vec3(.235,.245,.228),vec3(.305,.312,.300),up);
  vec3 lamps[2]; lamps[0]=vec3(${LAMPS[0].map(f).join(',')}); lamps[1]=vec3(${LAMPS[1].map(f).join(',')});
  for(int i=0;i<2;i++){
    vec3 l=lamps[i]-p; float r2=dot(l,l); float c=dot(n,l/sqrt(r2));
    light+=vec3(1.0,.985,.93)*max(c*.86+.14,0.)*1.55/(1.+.40*r2);
  }
  for(int i=0;i<3;i++){
    vec3 w=vec3(15.5+2.3*float(i),2.32,${f(ROOM.minZ + .05)})-p; float r2=dot(w,w)+.95; vec3 d=w/sqrt(r2);
    light+=vec3(.93,1.0,1.04)*max(dot(n,d)*.8+.2,0.)*max(-d.z,0.)*1.75/r2;
  }
  light+=vec3(1.0,.95,.82)*airSun(p)*max(dot(n,normalize(vec3(.17,.53,-.84))),0.)*2.5;
  float side=min(min(p.x-${f(ROOM.minX)},${f(ROOM.maxX)}-p.x),min(p.z-${f(ROOM.minZ)},${f(ROOM.maxZ)}-p.z));
  light*=mix(.70,1.,smoothstep(0.,.95,side));
  light*=mix(.66,1.,smoothstep(0.,.85,p.y+max(n.y,0.)*.75));
  return light;
}
vec3 airGloss(vec3 p,vec3 n,vec3 v,float rough,vec3 f0){
  vec3 r=reflect(-v,n); float a=max(rough*rough,.03); vec3 result=vec3(0.);
  float facing=pow(1.-clamp(dot(n,v),0.,1.),5.); vec3 fr=f0+(1.-f0)*facing*(1.-rough*.75);
  vec3 lamps[2]; lamps[0]=vec3(${LAMPS[0].map(f).join(',')}); lamps[1]=vec3(${LAMPS[1].map(f).join(',')});
  for(int i=0;i<2;i++){
    vec3 l=normalize(lamps[i]-p); vec3 h=normalize(l+v); float nh=max(dot(n,h),0.);
    float b=nh*nh*(a*a-1.)+1.; result+=vec3(1.,.98,.93)*min(a*a/(b*b)*.35,7.)*max(dot(n,l),0.);
  }
  if(r.z<-.02){
    float t=(${f(ROOM.minZ)}-p.z)/r.z; vec3 q=p+r*t; float s=.05+rough*t*.34;
    float hit=smoothstep(${f(WINDOW.x0)}-s,${f(WINDOW.x0)}+s,q.x)*(1.-smoothstep(${f(WINDOW.x1)}-s,${f(WINDOW.x1)}+s,q.x))*smoothstep(${f(WINDOW.y0)}-s,${f(WINDOW.y0)}+s,q.y)*(1.-smoothstep(${f(WINDOW.y1)}-s,${f(WINDOW.y1)}+s,q.y));
    result+=vec3(.95,1.,1.04)*hit*2.0*(1.-rough*.7);
  }
  return result*fr;
}
`;
}

function roomLit(material, elevation) {
  if (!material?.isMeshStandardMaterial || material.userData.airRoomLit) return;
  material.userData.airRoomLit = true;
  const head = lightingChunk(elevation);
  material.onBeforeCompile = shader => {
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vAirWorld;')
      .replace('#include <project_vertex>', `#include <project_vertex>
        vec4 airPosition = vec4( transformed, 1.0 );
        #ifdef USE_INSTANCING
          airPosition = instanceMatrix * airPosition;
        #endif
        vAirWorld = ( modelMatrix * airPosition ).xyz;`);
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\n' + head)
      .replace('#include <aomap_fragment>', `#include <aomap_fragment>
        if (airInside(vAirWorld)) {
          vec3 airN = inverseTransformDirection(normal, viewMatrix);
          vec3 airP = vAirWorld - vec3(0., ${Number(elevation).toFixed(4)}, 0.);
          vec3 airV = normalize(cameraPosition - vAirWorld);
          vec3 airE = airLight(airP, airN);
          bool airAbove = cameraPosition.y > ${Number(elevation + 5).toFixed(4)};
          if (airAbove) airE = vec3(.80 + .85 * max(airN.y, 0.));
          reflectedLight.directDiffuse = material.diffuseColor * airE;
          reflectedLight.indirectDiffuse = vec3(0.);
          reflectedLight.directSpecular = airGloss(airP, airN, airV, material.roughness, material.specularColor);
          if (airAbove) reflectedLight.directSpecular = vec3(0.);
          reflectedLight.indirectSpecular *= .34 + .5 * min(dot(airE, vec3(.333)), 1.2);
          #ifdef USE_ENVMAP
            reflectedLight.indirectSpecular *= .98 / max(envMapIntensity, .05); // the room keeps its own reflection level
          #endif
        }`);
  };
  material.customProgramCacheKey = () => 'air-room-light-4:' + elevation;
  material.needsUpdate = true;
}

// ---------------------------------------------------------------------------
// Procedural surfaces. They follow the photographed wear without projecting a
// photographed shadow. Headless checks build the same textures at a low size.
// ---------------------------------------------------------------------------
const LATTICE = new Float32Array(65536);
for (let i = 0, seed = 20261124; i < 65536; i++) { seed = Math.imul(seed ^ (seed >>> 15), 0x2c1b3c6d) + 0x9e3779b9 | 0; LATTICE[i] = ((seed ^ (seed >>> 13)) >>> 0) / 4294967296; }
const hash = (x, y) => { const v = Math.sin(x * 127.1 + y * 311.7) * 43758.5453; return v - Math.floor(v); };
function noise(x, y) {
  const ix = Math.floor(x), iy = Math.floor(y), fx = x - ix, fy = y - iy;
  const u = fx * fx * (3 - 2 * fx), v = fy * fy * (3 - 2 * fy), x0 = ix & 255, x1 = (ix + 1) & 255, r0 = (iy & 255) << 8, r1 = ((iy + 1) & 255) << 8;
  const a = LATTICE[r0 | x0], b = LATTICE[r0 | x1], c = LATTICE[r1 | x0], d = LATTICE[r1 | x1];
  return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
}
const fbm = (x, y, octaves = 4) => {
  let sum = 0, gain = .5, scale = 1;
  for (let i = 0; i < octaves; i++) { sum += noise(x * scale, y * scale) * gain; gain *= .5; scale *= 2.03; }
  return sum / (1 - .5 ** octaves);
};
const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const blend = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
const drawable = () => typeof document !== 'undefined' && typeof document.createElement === 'function';

function dataTexture(s, name, width, height, fill, { srgb = true, repeat = false } = {}) {
  const data = new Uint8Array(width * height * 4);
  for (let y = 0; y < height; y++) for (let x = 0; x < width; x++) {
    const c = fill((x + .5) / width, (y + .5) / height), i = (y * width + x) * 4;
    data[i] = Math.max(0, Math.min(255, c[0])); data[i + 1] = Math.max(0, Math.min(255, c[1]));
    data[i + 2] = Math.max(0, Math.min(255, c[2])); data[i + 3] = c[3] ?? 255;
  }
  const texture = new THREE.DataTexture(data, width, height, THREE.RGBAFormat);
  texture.name = name; if (srgb) texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = texture.wrapT = repeat ? THREE.RepeatWrapping : THREE.ClampToEdgeWrapping;
  texture.magFilter = THREE.LinearFilter; texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.generateMipmaps = true; texture.anisotropy = 8; texture.needsUpdate = true;
  s.textures.add(texture); return texture;
}

// Bodies that rest on the floor: dark dirt and contact shade gather beneath and
// around them (03:54, photos 034, 052, 057, 075, 095).
const FOOTPRINTS = [
  [14.85, -11.15, .645, 1.055], [18.65, -10.5, .503, .765], [18.65, -7.75, .555, .88], [21.1, -11.2, .64, .84],
  [14.48, -8.15, .81, .21], [14.72, -6.92, .66, .27], [14.6, -5.6, .42, .52], [14.58, -4.15, .40, .42],
  [13.82, -4.55, .24, .31], [18.6, -4.3, .64, .30], [21.22, -5.2, .59, 1.12], [21.3, -8.0, .5, 1.05], [21.2, -9.49, .2, .2],
];
const ROUND = [[14.55, -9.25, .53], [18.55, -5.72, .44]];

function floorTextures(s) {
  const fine = drawable(), w = fine ? 640 : 24, h = fine ? 720 : 28;
  const at = (u, v) => [ROOM.minX + .07 + u * 8.66, ROOM.maxZ - .07 - v * 9.86];
  // Contact dirt is smooth, so it is sampled on a coarse grid; the scuffs are
  // rasterised only where they lie.
  const gw = fine ? 160 : 12, gh = fine ? 180 : 14, grid = new Float32Array(gw * gh), scratch = new Float32Array(w * h);
  for (let j = 0; j < gh; j++) for (let i = 0; i < gw; i++) {
    const [x, z] = at((i + .5) / gw, (j + .5) / gh); let shade = 0;
    for (const [cx, cz, rx, rz] of FOOTPRINTS) {
      const d = Math.hypot(Math.max(Math.abs(x - cx) - rx, 0), Math.max(Math.abs(z - cz) - rz, 0)); if (d > 2) continue;
      shade = Math.max(shade, d === 0 ? .86 : .74 * Math.exp(-d / .13) + .16 * Math.exp(-d / .5));
    }
    for (const [cx, cz, r] of ROUND) {
      const d = Math.max(Math.hypot(x - cx, z - cz) - r, 0);
      shade = Math.max(shade, d === 0 ? .84 : .62 * Math.exp(-d / .12) + .14 * Math.exp(-d / .45));
    }
    const wall = Math.min(x - ROOM.minX, ROOM.maxX - x, z - ROOM.minZ, ROOM.maxZ - z);
    grid[j * gw + i] = Math.max(shade, .58 * Math.exp(-wall / .24));
  }
  const contact = (u, v) => {
    const x = Math.min(gw - 1.001, Math.max(0, u * gw - .5)), y = Math.min(gh - 1.001, Math.max(0, v * gh - .5)), i = x | 0, j = y | 0, fx = x - i, fy = y - j, o = j * gw + i;
    return (grid[o] * (1 - fx) + grid[o + 1] * fx) * (1 - fy) + (grid[o + gw] * (1 - fx) + grid[o + gw + 1] * fx) * fy;
  };
  for (let n = 0; n < 34; n++) {
    const sx = 15.9 + hash(n, 3) * 2.4, sz = -4 - hash(n, 7) * 8.6, angle = hash(n, 11) * 6.28, len = .08 + hash(n, 13) * .34, c = Math.cos(angle), k = Math.sin(angle);
    for (let q = -len; q < len; q += .006) {
      const px = Math.floor((sx + c * q - ROOM.minX - .07) / 8.66 * w), py = Math.floor((ROOM.maxZ - .07 - sz - k * q) / 9.86 * h);
      if (px >= 0 && py >= 0 && px < w && py < h) scratch[py * w + px] = Math.max(scratch[py * w + px], 1 - Math.abs(q) / len);
    }
  }
  const PATCHES = [[16.35, -10.95, .52, .34], [15.75, -12.65, .7, .26], [19.75, -10.75, .36, .5], [17.6, -12.5, .95, .2], [15.4, -4.35, .25, .2]];
  const wear = (x, z) => {
    // North corridor and the foot of both filmed cabinets are worn through to
    // pale concrete; the receiver base is rust stained (photos 010, 018, 052).
    let worn = z < -11.65 ? smooth(.56, .70, fbm(x * 1.5 + 4, z * 1.4 + 9, 4)) * smooth(-11.7, -12.9, z) * .95 : 0, edge = null;
    for (const [cx, cz, rx, rz] of PATCHES) {
      const d = Math.hypot((x - cx) / rx, (z - cz) / rz); if (d > 1.9) continue;
      if (edge === null) edge = (fbm(x * 3.1, z * 3.1, 4) - .5 + .35 * (noise(x * 17, z * 17) - .5)) * 1.5;
      worn = Math.max(worn, smooth(1.02, .66, d + edge) * .62);
    }
    return worn;
  };
  const out = [0, 0, 0, 255], mix = (r, g, b, k) => { if (k > 0) { out[0] += (r - out[0]) * k; out[1] += (g - out[1]) * k; out[2] += (b - out[2]) * k; } };
  const color = dataTexture(s, 'compressor-floor-worn-epoxy', w, h, (u, v) => {
    const [x, z] = at(u, v), large = fbm(x * .55 + 2, z * .55 + 5, 3), mid = fbm(x * 2.6, z * 2.6 + 7, 3), grain = fbm(x * 21, z * 21, 2);
    const k = large * .75 + mid * .25; out[0] = 60 + 32 * k; out[1] = 88 + 32 * k; out[2] = 68 + 28 * k;
    mix(47, 68, 54, smooth(.50, .74, fbm(x * 1.05 + 11, z * .95 + 3, 3)) * .62);
    // Fresh green touch-up between the HX601K and the aftercooler (photo 076).
    if (x > 15.2 && x < 16.3 && z > -8.5 && z < -7) for (const [cx, cz, rx, rz] of [[15.72, -7.48, .34, .22], [15.5, -7.95, .12, .36]])
      if (Math.abs(x - cx) < rx + .05 * mid && Math.abs(z - cz) < rz + .04 * grain) mix(52, 118, 68, .5 * smooth(.25, .5, grain));
    const worn = wear(x, z); mix(126 + 32 * mid, 131 + 25 * mid, 118 + 22 * mid, worn * .85);
    const rust = smooth(.74, .5, Math.hypot(x - 15.02, z + 9.15) * 1.15 + (grain - .5) * .4) * .6 + smooth(.3, .15, Math.hypot(x - 18.2, z + 5.2) + (mid - .5) * .25) * .35;
    mix(116, 74, 60, rust * .55);
    mix(170, 172, 158, smooth(.80, .90, noise(x * 46, z * 46)) * smooth(.55, .75, large) * .26);
    mix(156, 172, 150, scratch[Math.min(h - 1, v * h | 0) * w + Math.min(w - 1, u * w | 0)] * .42);
    const dirt = contact(u, v); mix(66, 58, 46, Math.min(.55, dirt * .5) * smooth(.3, .7, mid));
    const g = (.93 + grain * .14) * (1 - dirt * .72); out[0] *= g; out[1] *= g; out[2] *= g; return out;
  });
  const gloss = dataTexture(s, 'compressor-floor-gloss', w >> 2, h >> 2, (u, v) => {
    const [x, z] = at(u, v);
    out[0] = 0; out[2] = 0; out[1] = Math.min(.95, .25 + .24 * fbm(x * 2.4 + 6, z * 2.2, 3) + wear(x, z) * .42 + contact(u, v) * .3 + smooth(.6, .8, fbm(x * 1.05 + 11, z * .95 + 3, 3)) * .12) * 255; return out;
  }, { srgb: false });
  return { color, gloss };
}

function wallTexture(s, name, ribbed, base) {
  const fine = drawable(), w = fine ? 224 : 8, h = fine ? 560 : 16;
  // U repeats every 2.4 m; V covers the 4.4 m wall so floor grime stays low.
  return dataTexture(s, name, w, h, (u, v) => {
    const y = v * 4.4, x = u * 2.4, wrap = Math.min(u, 1 - u) < .06 ? Math.min(u, 1 - u) / .06 : 1;
    const broad = fbm(x * 1.1, y * .8 + 3) * wrap + .5 * (1 - wrap), fineGrain = noise(x * 60, y * 60);
    let c = blend(base, [base[0] * .93, base[1] * .95, base[2] * .9], broad);
    if (ribbed) {
      const cell = (y / .155) % 1, d = Math.min(cell, 1 - cell) * .155;
      if (d < .0052) c = blend(c, [128, 132, 112], .62);
      else if (cell > .035 && cell < .12) c = blend(c, [244, 246, 232], .35);
      else if (cell > .9) c = blend(c, [172, 175, 154], .34);
    }
    const run = smooth(.6, .82, noise(x * 9, y * .7)) * smooth(1.7, .25, y) * .5 + smooth(.63, .8, noise(x * 7 + 40, y * .5 + 9)) * .10;
    const soil = smooth(.62, .10, y + (broad - .5) * .5) * .62;
    c = blend(c, [103, 91, 70], Math.min(.8, (soil + run * .55) * wrap + soil * .35 * (1 - wrap)));
    c = blend(c, [150, 148, 128], smooth(.6, .78, fbm(x * 2.2 + 20, y * 2.6)) * .20 * wrap);
    const g = .985 + fineGrain * .03;
    return [c[0] * g, c[1] * g, c[2] * g];
  }, { repeat: true });
}

// ---------------------------------------------------------------------------
// One merged mesh per finish keeps hundreds of fittings to a few draw calls.
// ---------------------------------------------------------------------------
function batcher() {
  const sets = new Map(), templates = new Map(), m4 = new THREE.Matrix4(), n3 = new THREE.Matrix3(), p = new THREE.Vector3(), q = new THREE.Quaternion(), e = new THREE.Euler(), sc = new THREE.Vector3(), tr = new THREE.Vector3();
  const template = (key, make) => { if (!templates.has(key)) templates.set(key, make()); return templates.get(key); };
  function add(parent, paint, geometry, matrix) {
    if (!sets.has(parent)) sets.set(parent, new Map());
    const group = sets.get(parent);
    if (!group.has(paint)) group.set(paint, { position: [], normal: [], uv: [], index: [] });
    const out = group.get(paint), base = out.position.length / 3, { position, normal, uv } = geometry.attributes;
    n3.getNormalMatrix(matrix);
    for (let i = 0; i < position.count; i++) {
      p.fromBufferAttribute(position, i).applyMatrix4(matrix); out.position.push(p.x, p.y, p.z);
      p.fromBufferAttribute(normal, i).applyMatrix3(n3).normalize(); out.normal.push(p.x, p.y, p.z);
      if (uv) out.uv.push(uv.getX(i), uv.getY(i)); else out.uv.push(0, 0);
    }
    if (geometry.index) for (let i = 0; i < geometry.index.count; i++) out.index.push(base + geometry.index.getX(i));
    else for (let i = 0; i < position.count; i++) out.index.push(base + i);
  }
  const place = (size, at, rot) => {
    if (rot?.isQuaternion) q.copy(rot); else q.setFromEuler(e.set(...(rot || [0, 0, 0])));
    return m4.compose(tr.set(...at), q, sc.set(...size));
  };
  const unitBox = () => template('box', () => new THREE.BoxGeometry(1, 1, 1));
  const unitCyl = seg => template('cyl' + seg, () => new THREE.CylinderGeometry(1, 1, 1, seg));
  const box = (parent, paint, size, at, rot) => add(parent, paint, unitBox(), place(size, at, rot));
  function soft(parent, paint, size, at, rot, r = .018) {
    const key = 'soft:' + size.join() + ':' + r;
    add(parent, paint, template(key, () => roundedBox(...size, r)), place([1, 1, 1], at, rot));
  }
  function cyl(parent, paint, r, h, at, axis = 'y', seg = 18) {
    const rot = axis === 'x' ? [0, 0, HALF] : axis === 'z' ? [HALF, 0, 0] : axis?.isQuaternion || Array.isArray(axis) ? axis : undefined;
    add(parent, paint, unitCyl(seg), place([r, h, r], at, rot));
  }
  function rod(parent, paint, a, b, r = .01, seg = 10) {
    const A = new THREE.Vector3(...a), B = new THREE.Vector3(...b), d = B.clone().sub(A), len = d.length();
    if (len < 1e-5) return;
    cyl(parent, paint, r, len, A.add(B).multiplyScalar(.5).toArray(), new THREE.Quaternion().setFromUnitVectors(UP, d.normalize()), seg);
  }
  const ring = (parent, paint, r, t, at, rot, seg = 26) => add(parent, paint, template(`ring:${t / r}:${seg}`, () => new THREE.TorusGeometry(1, t / r, 8, seg)), place([r, r, r], at, rot));
  const ball = (parent, paint, size, at, rot) => add(parent, paint, template('ball', () => new THREE.SphereGeometry(1, 18, 12)), place(size, at, rot));
  const lathe = (parent, paint, key, profile, at, rot, seg = 24) => add(parent, paint, template('lathe:' + key, () => new THREE.LatheGeometry((profile[0][1] > profile[profile.length - 1][1] ? [...profile].reverse() : profile).map(v => new THREE.Vector2(...v)), seg)), place([1, 1, 1], at, rot));
  const plane = (parent, paint, width, height, at, rot) => add(parent, paint, template(`plane:${width}:${height}`, () => new THREE.PlaneGeometry(width, height)), place([1, 1, 1], at, rot));

  // Sweep a circular section through straight runs joined by true bends. Every
  // end is capped, so no pipe finishes as an open shell in mid-air.
  function pipe(parent, paint, points, r, { bend = r * 1.9, seg = 14, collar = null, weld = null } = {}) {
    const pts = points.map(v => new THREE.Vector3(...v)), path = [pts[0].clone()], joints = [];
    for (let i = 1; i < pts.length - 1; i++) {
      const a = pts[i - 1], b = pts[i], c = pts[i + 1], d1 = a.clone().sub(b), d2 = c.clone().sub(b);
      const cut = Math.min(bend, d1.length() * .49, d2.length() * .49);
      if (Math.abs(d1.clone().normalize().dot(d2.clone().normalize())) > .9995) { path.push(b.clone()); continue; }
      const s0 = b.clone().add(d1.normalize().multiplyScalar(cut)), s1 = b.clone().add(d2.normalize().multiplyScalar(cut));
      for (let k = 0; k <= 7; k++) {
        const t = k / 7; path.push(new THREE.Vector3().addScaledVector(s0, (1 - t) ** 2).addScaledVector(b, 2 * t * (1 - t)).addScaledVector(s1, t * t));
      }
      joints.push([s0, b.clone().sub(s0).normalize()], [s1, s1.clone().sub(b).normalize()]);
    }
    path.push(pts[pts.length - 1].clone());
    sweep(parent, paint, path, r, seg);
    for (const [at, dir] of joints) {
      const quat = new THREE.Quaternion().setFromUnitVectors(UP, dir);
      if (collar) cyl(parent, collar, r * 1.17, Math.max(.028, r * .62), at.toArray(), quat, seg);
      if (weld) cyl(parent, weld, r * 1.035, .010, at.toArray(), quat, seg);
    }
  }
  function sweep(parent, paint, path, r, seg) {
    const geo = { attributes: {}, index: null }, pos = [], nor = [], uv = [], idx = [];
    let normal = null, length = 0;
    for (let i = 0; i < path.length; i++) {
      const t = path[Math.min(i + 1, path.length - 1)].clone().sub(path[Math.max(i - 1, 0)]).normalize();
      if (!normal) normal = (Math.abs(t.y) < .9 ? UP.clone() : new THREE.Vector3(1, 0, 0)).cross(t).normalize();
      else normal.addScaledVector(t, -normal.dot(t)).normalize();
      const side = t.clone().cross(normal);
      if (i) length += path[i].distanceTo(path[i - 1]);
      for (let k = 0; k <= seg; k++) {
        const a = k / seg * Math.PI * 2, nx = normal.clone().multiplyScalar(Math.cos(a)).addScaledVector(side, Math.sin(a));
        pos.push(path[i].x + nx.x * r, path[i].y + nx.y * r, path[i].z + nx.z * r); nor.push(nx.x, nx.y, nx.z); uv.push(k / seg, length * 2.2);
      }
    }
    const row = seg + 1;
    for (let i = 0; i < path.length - 1; i++) for (let k = 0; k < seg; k++) {
      const a = i * row + k, b = a + row; idx.push(a, a + 1, b, b, a + 1, b + 1);
    }
    for (const end of [0, path.length - 1]) {
      const dir = (end ? path[end].clone().sub(path[end - 1]) : path[0].clone().sub(path[1])).normalize(), base = pos.length / 3;
      for (let k = 0; k <= seg; k++) { const j = (end * row + k) * 3; pos.push(pos[j], pos[j + 1], pos[j + 2]); nor.push(dir.x, dir.y, dir.z); uv.push(0, 0); }
      for (let k = 1; k < seg - 1; k++) end ? idx.push(base, base + k, base + k + 1) : idx.push(base, base + k + 1, base + k);
    }
    geo.attributes.position = new THREE.Float32BufferAttribute(pos, 3); geo.attributes.normal = new THREE.Float32BufferAttribute(nor, 3); geo.attributes.uv = new THREE.Float32BufferAttribute(uv, 2);
    geo.index = new THREE.Uint32BufferAttribute(idx, 1);
    add(parent, paint, geo, m4.identity());
  }
  const cable = (parent, paint, points, r = .012, seg = 8) => {
    const curve = new THREE.CatmullRomCurve3(points.map(v => new THREE.Vector3(...v)), false, 'centripetal');
    sweep(parent, paint, curve.getPoints(Math.max(10, points.length * 7)), r, seg);
  };
  const shape = (parent, paint, key, make, at, rot) => add(parent, paint, template(key, make), place([1, 1, 1], at, rot));
  function flush(s, materials) {
    let count = 0;
    for (const [parent, group] of sets) for (const [paint, data] of group) {
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute('position', new THREE.Float32BufferAttribute(data.position, 3));
      geometry.setAttribute('normal', new THREE.Float32BufferAttribute(data.normal, 3));
      geometry.setAttribute('uv', new THREE.Float32BufferAttribute(data.uv, 2));
      geometry.setIndex(data.index); geometry.computeBoundingBox(); geometry.computeBoundingSphere();
      s.geometries.add(geometry);
      const mesh = s._mesh(geometry, materials[paint], parent);
      mesh.name = 'site-finish-' + paint; quiet(mesh); count++;
    }
    for (const geometry of templates.values()) geometry.dispose?.();
    return count;
  }
  return { box, soft, cyl, rod, ring, ball, lathe, plane, pipe, cable, shape, flush };
}

function roundedBox(w, h, d, r) {
  const geometry = new THREE.BoxGeometry(1, 1, 1, 5, 5, 5), pos = geometry.attributes.position, nor = geometry.attributes.normal;
  const v = new THREE.Vector3(), half = new THREE.Vector3(w / 2, h / 2, d / 2), radius = Math.min(r, w / 2, h / 2, d / 2);
  const core = half.clone().subScalar(radius), steps = [-1, -.62, 0, 0, .62, 1];
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    const grid = ['x', 'y', 'z'].map(k => Math.round((v[k] + .5) * 5));
    const inner = new THREE.Vector3(), dir = new THREE.Vector3();
    ['x', 'y', 'z'].forEach((k, j) => { const g = grid[j]; inner[k] = core[k] * (g < 3 ? -1 : 1); dir[k] = steps[g]; });
    if (dir.lengthSq() < 1e-6) dir.fromBufferAttribute(nor, i);
    dir.normalize(); const at = inner.addScaledVector(dir, radius);
    pos.setXYZ(i, at.x, at.y, at.z); nor.setXYZ(i, dir.x, dir.y, dir.z);
  }
  return geometry;
}

// Fittings describe the room; they never block the surveyed walking routes or
// a click on the machine behind them.
function quiet(mesh) {
  mesh.userData.personCollision = false; mesh.raycast = () => {};
  mesh.castShadow = false; mesh.receiveShadow = true; return mesh;
}

// ---------------------------------------------------------------------------
// Printed faces: door plates, panel names, gauges and notices. Phone numbers
// and personal names on the originals are left out.
// ---------------------------------------------------------------------------
function printed(s, parent, name, size, at, yaw, draw, { px = 256, pitch = 0, roll = 0, elevation, rough = .62, clear = false } = {}) {
  if (!drawable()) return null;
  const canvas = document.createElement('canvas');
  canvas.width = px; canvas.height = Math.max(16, Math.round(px * size[1] / size[0]));
  const ctx = canvas.getContext?.('2d'); if (!ctx) return null;
  draw(ctx, canvas.width, canvas.height);
  const map = new THREE.CanvasTexture(canvas); map.colorSpace = THREE.SRGBColorSpace; map.anisotropy = 8; s.textures.add(map);
  const material = s._material(0xffffff, rough, .02, { map, ...(clear ? { transparent: true, depthWrite: false } : {}) });
  roomLit(material, elevation);
  const geometry = new THREE.PlaneGeometry(size[0], size[1]); s.geometries.add(geometry);
  const mesh = quiet(s._mesh(geometry, material, parent, at));
  mesh.rotation.set(pitch, yaw, roll, 'YXZ'); mesh.name = name; return mesh;
}
const inkText = (ctx, text, x, y, font, color = '#1f2426', align = 'center') => { ctx.font = font; ctx.fillStyle = color; ctx.textAlign = align; ctx.textBaseline = 'middle'; ctx.fillText(text, x, y); };
function dialFace(ctx, w, h) {
  const r = w / 2; ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = '#f4f3ea'; ctx.beginPath(); ctx.arc(r, r, r - 2, 0, 7); ctx.fill();
  ctx.lineWidth = w * .05; ctx.strokeStyle = '#c7a43a'; ctx.beginPath(); ctx.arc(r, r, r * .72, -.4, .6); ctx.stroke();
  ctx.strokeStyle = '#20262a';
  for (let i = 0; i <= 30; i++) {
    const a = Math.PI * .75 + i / 30 * Math.PI * 1.5, major = i % 5 === 0; ctx.lineWidth = major ? w * .016 : w * .008;
    ctx.beginPath(); ctx.moveTo(r + Math.cos(a) * r * .88, r + Math.sin(a) * r * .88); ctx.lineTo(r + Math.cos(a) * r * (major ? .72 : .8), r + Math.sin(a) * r * (major ? .72 : .8)); ctx.stroke();
  }
  inkText(ctx, 'MPa', r, h * .68, `600 ${w * .1}px Arial`);
  ctx.strokeStyle = '#111'; ctx.lineWidth = w * .025; ctx.beginPath(); ctx.moveTo(r, r); ctx.lineTo(r + r * .28, r - r * .52); ctx.stroke();
  ctx.fillStyle = '#111'; ctx.beginPath(); ctx.arc(r, r, w * .045, 0, 7); ctx.fill();
}
function safetyRules(ctx, w, h) {
  // 압력용기 안전수칙 board on the aftercooler and hall door (photo 070).
  const g = ctx.createLinearGradient(0, 0, w, 0); g.addColorStop(0, '#2b4a9d'); g.addColorStop(.72, '#2b4a9d'); g.addColorStop(1, '#f08a2c');
  ctx.fillStyle = g; ctx.fillRect(0, 0, w, h); ctx.fillStyle = '#fbfbf7'; ctx.beginPath(); ctx.roundRect?.(w * .035, h * .03, w * .89, h * .87, w * .06); ctx.fill();
  ctx.textBaseline = 'middle'; ctx.textAlign = 'left'; ctx.font = `800 ${w * .094}px "Malgun Gothic",sans-serif`; ctx.fillStyle = '#26303a'; ctx.fillText('압력용기', w * .10, h * .095); ctx.fillStyle = '#d5402c'; ctx.fillText('안전수칙', w * .50, h * .095);
  const rows = ['과압 폭발을 막기 위해 압력계의 지시치와', '용기 동체와 용접부의 부식, 마모, 균열 및', '용기 내부의 응축수로 인한 부식을 방지하기 위해', '운전 중 비정상적인 진동, 소음, 이상 온도가', '압력 방출 시 재해를 막기 위해 안전밸브 및', '내부 점검 및 보수 작업 시에는 밸브를'];
  rows.forEach((row, i) => {
    const y = h * (.19 + i * .112); ctx.fillStyle = '#d5402c'; ctx.beginPath(); ctx.arc(w * .105, y, w * .022, 0, 7); ctx.fill();
    ctx.fillStyle = '#2d3439'; ctx.font = `700 ${w * .042}px "Malgun Gothic",sans-serif`; ctx.fillText(row, w * .145, y, w * .76); ctx.fillStyle = '#7d8387'; ctx.fillRect(w * .145, y + h * .034, w * (.46 + hash(i, 2) * .24), h * .012);
  });
  ctx.textAlign = 'center'; ctx.fillStyle = '#27313a'; ctx.font = `800 ${w * .045}px Arial`; ctx.fillText('HEE CHANG', w * .48, h * .87);
  ctx.fillStyle = '#fff'; ctx.font = `700 ${w * .052}px "Malgun Gothic",sans-serif`; ctx.fillText('안전 ✚ 제일', w * .48, h * .95);
}
function inspectionCard(ctx, w, h) {
  ctx.fillStyle = '#f6f5ee'; ctx.fillRect(0, 0, w, h); ctx.strokeStyle = '#3c4145'; ctx.lineWidth = w * .006; ctx.strokeRect(w * .02, h * .03, w * .96, h * .94);
  for (let i = 1; i < 8; i++) { ctx.fillStyle = '#6c7174'; ctx.fillRect(w * .02, h * (.03 + i * .117), w * (i > 4 ? .60 : .96), 1.5); }
  for (const x of [.2, .42, .62, .8]) ctx.fillRect(w * x, h * .03, 1.5, h * .5);
  [['설비번호', .31], ['V-3', .71], ['0.24 ㎥', .31], ['425 mm', .51], ['1480 mm', .71]].forEach(([t, x], i) => inkText(ctx, t, w * x, h * (i < 2 ? .09 : .2), `600 ${w * .04}px "Malgun Gothic",sans-serif`));
  ctx.fillStyle = '#3c6fa8'; ctx.fillRect(w * .66, h * .58, w * .3, h * .36); ctx.fillStyle = '#d8d7cc'; for (const x of [.72, .80]) ctx.fillRect(w * x, h * .62, w * .06, h * .3);
  ctx.fillStyle = '#2d6ea4'; for (const x of [.88, .92]) ctx.fillRect(w * x, h * .63, w * .025, h * .28);
}

// ---------------------------------------------------------------------------
export function buildDryerCompressorSiteFinish(s, environment, spec) {
  if (Number(spec?.id) !== 3) return null;
  const fixtures = environment?.architectureFixtures, room = fixtures?.getObjectByName('dryer-compressor-3-room');
  const facade = environment?.facade?.getObjectByName('dryer-compressor-3-facade-extras');
  if (!room || !facade || room.userData.siteFinishBuilt) return null;
  const Y = spec.elevation;
  const group = (parent, name, data = {}) => {
    const node = s._group(parent); node.name = name;
    Object.assign(node.userData, { personCollision: false, source: 'dryer-3f-compressor-20261124', sourceVideoSeconds: [94, 268], dimensionsMeasured: false, ...data });
    return node;
  };
  const low = group(room, 'compressor-site-finish'), shell = group(facade, 'compressor-site-shell'), loose = group(room, 'compressor-site-loose-items', { observedOn: '2026-11-24', transient: true });

  // --- finishes -----------------------------------------------------------
  const shared = s.dryerCompressorMaterials, brushed = shared.brushedCladding?.map || null;
  const fine = drawable();
  const chipped = dataTexture(s, 'compressor-yellow-lagging', fine ? 128 : 8, fine ? 256 : 8, (u, v) => {
    const n = fbm(u * 6, v * 9, 4), chip = smooth(.74, .79, fbm(u * 11 + 5, v * 14, 4));
    let c = blend([196, 156, 82], [172, 128, 60], n); c = blend(c, [170, 172, 164], chip * .7); return blend(c, [92, 70, 40], smooth(.6, .8, fbm(u * 5 + 9, v * 5)) * .3);
  }, { repeat: true });
  const mottled = dataTexture(s, 'compressor-silver-pipe', fine ? 128 : 8, fine ? 256 : 8, (u, v) => {
    const n = fbm(u * 8, v * 10, 4), dull = smooth(.5, .75, fbm(u * 3 + 3, v * 3)), top = smooth(.16, .0, Math.abs(u - .25));
    const g = 214 + n * 34 - dull * 34; return [g - top * 12, g - top * 14, g - top * 20];
  }, { repeat: true });
  const spangle = dataTexture(s, 'compressor-galvanised-pipe', fine ? 128 : 8, fine ? 256 : 8, (u, v) => {
    const cell = noise(u * 34, v * 50), n = fbm(u * 5, v * 6), g = 182 + cell * 52 - n * 30, stain = smooth(.66, .82, fbm(u * 4 + 8, v * 7));
    return [g * (1 - stain * .18), g * (1 - stain * .22), g * (1 - stain * .3)];
  }, { repeat: true });
  const wrapTape = dataTexture(s, 'compressor-taped-insulation', fine ? 96 : 8, fine ? 192 : 8, (u, v) => {
    const spiral = (v * 14 + u) % 1, n = fbm(u * 7, v * 9), g = 232 - smooth(.0, .07, spiral) * 0 - (spiral < .06 ? 62 : 0) - n * 40;
    return [g, g * .97, g * .87];
  }, { repeat: true });
  const palette = {
    silver: [0xd3d6d5, .40, .50, { map: mottled }], galv: [0xb4b9b8, .46, .58, { map: spangle }], iron: [0x55524c, .72, .45], fitting: [0x9fa09b, .46, .58],
    blue: [0x3c6f9f, .58, .04], navyFilter: [0x2d6fc6, .34, .08], skyFilter: [0x1788cf, .30, .06], black: [0x1b1e20, .55, .08], rubber: [0x1a1c1d, .86, .02],
    red: [0xb23a2c, .48, .06], orange: [0xe2552f, .44, .04], wheel: [0xa91f35, .42, .12], valveBlue: [0x234fb0, .42, .05], arrow: [0xf0e81e, .55, 0, { emissive: 0x6b6400, emissiveIntensity: .25 }],
    beam: [0xcfc0ae, .74, .06], purlin: [0xcdbfb0, .72, .08], kerb: [0x2a6440, .62, .03], concrete: [0x8c887d, .94, .01], raceway: [0x77756d, .7, .3],
    panel: [0xcdc9b8, .56, .08], panelGrey: [0x8c9598, .42, .34], boxYellow: [0xb69a55, .66, .06], white: [0xe9e7dd, .55, .04], cream: [0xd9d4c2, .6, .05],
    yellowLag: [0xffffff, .66, .04, { map: chipped }], lagging: [0xe6dfca, .86, .02, { map: wrapTape }], teal: [0x2d4750, .5, .18], foam: [0x33383b, .95, 0],
    brownPipe: [0x6f5a3d, .7, .12], copper: [0x8a7058, .5, .5], strut: [0x9ea5a6, .5, .5], tealHose: [0x3aa58d, .5, 0], greenHose: [0x2e6b52, .72, 0], blueHose: [0x2a7fd0, .5, 0], creamHose: [0xc9b479, .6, 0],
    screenGlow: [0x1e2a44, .3, .05, { emissive: 0x2c4bff, emissiveIntensity: .9 }], lampRed: [0xd7362c, .35, 0, { emissive: 0xff2211, emissiveIntensity: 1.2 }], lampGreen: [0x2f9e57, .4, 0, { emissive: 0x1d8f44, emissiveIntensity: .5 }],
    bulb: [0xffffff, .4, 0, { emissive: 0xfffbf0, emissiveIntensity: 5.5 }], socket: [0xd8d6cc, .5, .1], daylight: [0xffffff, .9, 0, { emissive: 0xf4fbff, emissiveIntensity: 4.2 }],
    plastic: [0xdcdad0, .5, .02], jerry: [0xb98634, .5, .02], cardboard: [0xb08a5d, .94, 0], cardboardDark: [0x8a6a45, .95, 0], film: [0xd9dee0, .2, .05, { transparent: true, opacity: .38, depthWrite: false, side: THREE.DoubleSide }], palletGrey: [0x6b6c6a, .85, .02],
    fanOrange: [0xe06a44, .5, .02], duct: [0x9aa2a1, .42, .34], stainless: [0xbfc3c2, .34, .7, { map: brushed }], fanGreen: [0x6d7f7e, .55, .25], gap: [0x2a2c2a, .9, 0], greyPvc: [0x9b978c, .6, .05], ductEdge: [0xd2d6d4, .42, .35], ductSeam: [0x8e9694, .5, .4], dusty: [0x6d6860, .88, .05], kaeserLeaf: [0xe9b50f, .40, .06],
  };
  const m = Object.fromEntries(Object.entries(palette).map(([key, [color, rough, metal, extra]]) => [key, s._material(color, rough, metal, extra || {})]));
  const k = batcher();

  // --- 1. floor -----------------------------------------------------------
  const floor = room.getObjectByName('compressor-interior-green-floor'), worn = floorTextures(s);
  floor.material = s._material(0xffffff, 1, .02, { map: worn.color, roughnessMap: worn.gloss });
  floor.material.name = 'compressor-worn-epoxy-floor';

  // --- 2. wall and ceiling lining ----------------------------------------
  // Ribbed insulated panels, with flat plaster in the north-west bay (03:02).
  const panelWall = s._material(0xffffff, .78, .03, { map: wallTexture(s, 'compressor-ribbed-panel-wall', true, [217, 219, 200]) });
  const plasterWall = s._material(0xffffff, .9, .0, { map: wallTexture(s, 'compressor-plaster-wall', false, [228, 227, 212]) });
  const ceilingMat = s._material(0xffffff, .8, .02, { map: dataTexture(s, 'compressor-ceiling-panels', fine ? 256 : 8, fine ? 256 : 8, (u, v) => {
    const seam = Math.min(u * 4 % 1, 1 - u * 4 % 1) / 4 * 4, line = seam * 1 < .012 ? 1 : 0, n = fbm(u * 5, v * 7);
    return blend(blend([199, 205, 192], [184, 191, 178], n), [150, 156, 142], line * .7);
  }, { repeat: true }) });
  const lining = (name, outline, holes, material, at, yaw) => {
    const shape = new THREE.Shape(outline.map(v => new THREE.Vector2(...v)));
    for (const hole of holes) shape.holes.push(new THREE.Path(hole.map(v => new THREE.Vector2(...v))));
    const geometry = new THREE.ShapeGeometry(shape), pos = geometry.attributes.position, uv = geometry.attributes.uv;
    for (let i = 0; i < pos.count; i++) uv.setXY(i, pos.getX(i) / 2.4, pos.getY(i) / 4.4);
    s.geometries.add(geometry);
    const mesh = quiet(s._mesh(geometry, material, shell, at)); mesh.rotation.y = yaw; mesh.name = name; return mesh;
  };
  const rect = (x0, y0, x1, y1) => [[x0, y0], [x1, y0], [x1, y1], [x0, y1]];
  const LX = FACE.e - FACE.w;
  lining('compressor-lining-north', [[0, 0], [LX, 0], [LX, ceiling(FACE.e)], [0, ceiling(FACE.w)]], [rect(WINDOW.x0 - FACE.w, WINDOW.y0, WINDOW.x1 - FACE.w, WINDOW.y1)], panelWall, [FACE.w, 0, FACE.n], 0);
  // Viewed from inside, local +X of the south lining runs west.
  lining('compressor-lining-south', [[0, 0], [FACE.e - DOOR.x - DOOR.half, 0], [FACE.e - DOOR.x - DOOR.half, DOOR.top], [FACE.e - DOOR.x + DOOR.half, DOOR.top], [FACE.e - DOOR.x + DOOR.half, 0], [LX, 0], [LX, ceiling(FACE.w)], [0, ceiling(FACE.e)]], [], panelWall, [FACE.e, 0, FACE.s], Math.PI);
  const PLASTER = -10.02;
  lining('compressor-lining-west-panels', rect(0, 0, FACE.s - PLASTER, ceiling(FACE.w)), [], panelWall, [FACE.w, 0, FACE.s], HALF);
  lining('compressor-lining-west-plaster', rect(0, 0, PLASTER - FACE.n, ceiling(FACE.w)), [], plasterWall, [FACE.w, 0, PLASTER], HALF);
  lining('compressor-lining-east', rect(0, 0, FACE.s - FACE.n, ceiling(FACE.e)), [], panelWall, [FACE.e, 0, FACE.n], -HALF);
  const ceilingLength = LX / Math.cos(Math.atan(SLOPE)), ceilingGeometry = new THREE.PlaneGeometry(ceilingLength, FACE.s - FACE.n);
  const cuv = ceilingGeometry.attributes.uv; for (let i = 0; i < cuv.count; i++) cuv.setXY(i, cuv.getX(i) * 2.2, cuv.getY(i) * 2.46);
  s.geometries.add(ceilingGeometry);
  const lid = quiet(s._mesh(ceilingGeometry, ceilingMat, shell, [(FACE.w + FACE.e) / 2, ceiling((FACE.w + FACE.e) / 2) - .05, (FACE.n + FACE.s) / 2]));
  lid.rotation.set(HALF, 0, 0); lid.rotation.order = 'ZXY'; lid.rotation.z = -Math.atan(SLOPE); lid.name = 'compressor-lining-ceiling';

  // --- 3. steel frame -----------------------------------------------------
  // Superseded placeholder rafters, purlins, lamps and overhead headers.
  for (const root of [facade, room]) root.traverse(node => {
    if (['compressor-roof-rafter', 'compressor-ceiling-lamp', 'comp-overhead-blue-header-west', 'comp-overhead-blue-header-east', 'comp-overhead-blue-cross-1', 'comp-overhead-blue-cross-2', 'comp-north-pipe-stand'].includes(node.name)) { node.visible = false; node.userData.personCollision = false; }
  });
  const tilt = -Math.atan(SLOPE), cx = (FACE.w + FACE.e) / 2;
  for (const z of [-13.16, -10.1, -6.95, -3.64]) {
    const drop = .05 + .06, y = ceiling(cx) - drop - .17;
    k.box(shell, 'beam', [ceilingLength, .30, .022], [cx, y, z], [0, 0, tilt]);
    for (const side of [-1, 1]) k.box(shell, 'beam', [ceilingLength, .016, .17], [cx, y + side * .15, z], [0, 0, tilt]);
    for (const x of [FACE.w + .12, FACE.e - .12]) {
      const h = ceiling(x) - .33; k.box(shell, 'beam', [.20, h, .022], [x, h / 2, z]);
      for (const side of [-1, 1]) k.box(shell, 'beam', [.016, h, .18], [x + side * .1, h / 2, z]);
      // Haunch stiffener and bolted splice seen at 04:08.
      k.box(shell, 'beam', [.5, .14, .02], [x + (x < cx ? .33 : -.33), h + .01, z], [0, 0, (x < cx ? -.5 : .5)]);
      for (let i = 0; i < 4; i++) for (const side of [-1, 1]) k.cyl(shell, 'fitting', .012, .03, [x + (x < cx ? .62 : -.62), h + .02 + i * .06, z + side * .02], 'z', 6);
      k.box(shell, 'concrete', [.34, .05, .30], [x, .025, z]);
    }
  }
  for (let x = FACE.w + .55; x < FACE.e - .2; x += .93) {
    const y = ceiling(x) - .10; k.box(shell, 'purlin', [.012, .10, 9.82], [x, y, -8.4], [0, 0, tilt]);
    for (const side of [-1, 1]) k.box(shell, 'purlin', [.05, .010, 9.82], [x + .022, y + side * .047, -8.4], [0, 0, tilt]);
  }
  k.box(shell, 'beam', [.018, .20, 9.6], [17.62, ceiling(17.62) - .32, -8.4]); for (const side of [-1, 1]) k.box(shell, 'beam', [.11, .014, 9.6], [17.62, ceiling(17.62) - .32 + side * .10, -8.4]);
  // Wall girts, eave beams and slim posts.
  const girt = (a, b, y, h = .12, d = .07, paint = 'beam') => k.box(shell, paint, [Math.max(Math.abs(b[0] - a[0]), d), h, Math.max(Math.abs(b[1] - a[1]), d)], [(a[0] + b[0]) / 2, y, (a[1] + b[1]) / 2]);
  girt([FACE.w + .03, -3.6], [FACE.w + .03, -10.0], 2.52); girt([FACE.w + .03, -3.6], [FACE.w + .03, -13.2], .30, .10);
  girt([FACE.e - .03, -3.6], [FACE.e - .03, -13.2], 2.92, .24, .09); girt([FACE.e - .03, -3.6], [FACE.e - .03, -13.2], .30, .10); girt([FACE.e - .03, -6.9], [FACE.e - .03, -13.2], 1.62, .09);
  girt([FACE.w + .1, FACE.n + .03], [FACE.e - .1, FACE.n + .03], 1.63, .20, .06); girt([FACE.w + .1, FACE.n + .04], [FACE.e - .1, FACE.n + .04], 3.02, .12, .08);
  girt([FACE.w + .1, FACE.s - .04], [FACE.e - .1, FACE.s - .04], 2.58, .16, .08); girt([FACE.w + .1, FACE.s - .03], [DOOR.x - 1.14, FACE.s - .03], 1.30, .09, .06);
  for (const [x, z] of [[FACE.w + .04, -8.52], [FACE.e - .04, -8.9], [FACE.e - .04, -5.2]]) k.box(shell, 'beam', [.08, ceiling(x) - .3, .11], [x, (ceiling(x) - .3) / 2, z]);
  for (const x of [DOOR.x - 1.1, DOOR.x + 1.1]) k.box(shell, 'beam', [.13, 2.5, .12], [x, 1.25, FACE.s - .06]);
  for (const x of [14.32, 17.8, 21.28]) k.box(shell, 'beam', [.11, 3.0, .08], [x, 1.5, FACE.n + .05]);

  // --- 4. green kerb, threshold and floor raceway ------------------------
  const kerbRun = (x0, z0, x1, z1) => k.box(low, 'kerb', [Math.max(Math.abs(x1 - x0), .09), .20, Math.max(Math.abs(z1 - z0), .09)], [(x0 + x1) / 2, .10, (z0 + z1) / 2]);
  kerbRun(FACE.w + .045, FACE.s, FACE.w + .045, FACE.n); kerbRun(FACE.e - .045, FACE.s, FACE.e - .045, FACE.n); kerbRun(FACE.w, FACE.n + .045, FACE.e, FACE.n + .045);
  kerbRun(FACE.w, FACE.s - .045, DOOR.x - DOOR.half, FACE.s - .045); kerbRun(DOOR.x + DOOR.half, FACE.s - .045, FACE.e, FACE.s - .045);
  k.box(low, 'white', [.07, 2.04, .09], [16.858, 1.16, -3.415]);
  // Conduits laid along the foot of the door (01:40).
  k.pipe(low, 'galv', [[15.75, .05, -3.62], [17.95, .05, -3.62]], .020); k.pipe(low, 'blueHose', [[15.8, .025, -3.68], [17.9, .025, -3.68]], .010);
  // Steel cable raceway crossing in front of 1호 and 2호 (photos 052, 04:14).
  k.box(low, 'raceway', [4.55, .058, .13], [15.83, .035, -10.02]);
  for (const side of [-1, 1]) k.box(low, 'iron', [4.55, .062, .012], [15.83, .034, -10.02 + side * .071]);
  for (let x = 13.9; x < 18.0; x += .58) k.box(low, 'gap', [.05, .004, .022], [x, .066, -10.02]);
  k.cable(low, 'rubber', [[18.08, .06, -10.02], [18.4, .06, -9.62], [19.1, .06, -9.5], [19.5, .06, -9.9], [19.42, .16, -10.5], [19.18, .34, -10.62]], .036, 10);
  for (let i = 0; i < 2; i++) k.cable(low, 'foam', [[15.3 - i * .12, .07, -10.02], [15.5 - i * .1, .10, -9.86], [15.55, .16, -9.98], [15.38, .2, -10.1]], .026, 9);

  // --- 5. pendant lamps ---------------------------------------------------
  for (const [x, y, z] of LAMPS) {
    k.rod(shell, 'strut', [x, y + .20, z], [x, ceiling(x) - .12, z], .010);
    k.cyl(shell, 'socket', .046, .11, [x, y + .15, z]); k.cyl(shell, 'fitting', .030, .06, [x, y + .23, z]);
    k.ball(shell, 'bulb', [.072, .105, .072], [x, y, z]);
  }

  // --- 6. north glazing ---------------------------------------------------
  const pane = quiet(s._mesh(geometryFor(s, new THREE.PlaneGeometry(WINDOW.x1 - WINDOW.x0, WINDOW.y1 - WINDOW.y0)), m.daylight, shell, [17.8, 2.325, ROOM.minZ + .012]));
  pane.name = 'compressor-north-daylight';
  const tinted = room.getObjectByName('comp-north-glass'); if (tinted) tinted.visible = false;
  for (let i = 0; i <= 8; i++) { const x = WINDOW.x0 + i * .85, heavy = i % 2 === 0; k.box(shell, heavy ? 'white' : 'strut', [heavy ? .058 : .036, 1.12, .05], [x, 2.325, FACE.n - .02 + (heavy ? 0 : .02)]); }
  for (const y of [WINDOW.y0 + .03, WINDOW.y1 - .03]) k.box(shell, 'white', [6.84, .06, .085], [17.8, y, FACE.n - .01]);
  k.box(shell, 'cream', [6.9, .03, .16], [17.8, WINDOW.y0 - .012, FACE.n + .06]);

  if (drawable()) {
    const halo = document.createElement('canvas'); halo.width = halo.height = 128; const hc = halo.getContext?.('2d');
    if (hc?.createRadialGradient) {
      const g = hc.createRadialGradient(64, 64, 0, 64, 64, 64); g.addColorStop(0, 'rgba(255,252,242,.95)'); g.addColorStop(.16, 'rgba(255,252,242,.42)'); g.addColorStop(.45, 'rgba(255,252,242,.10)'); g.addColorStop(1, 'rgba(255,252,242,0)');
      hc.fillStyle = g; hc.fillRect(0, 0, 128, 128);
      const map = new THREE.CanvasTexture(halo); map.colorSpace = THREE.SRGBColorSpace; s.textures.add(map);
      const glow = new THREE.SpriteMaterial({ map, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: .55, toneMapped: false }); s.materials.add(glow);
      for (const [x, y, z] of LAMPS) { const sprite = new THREE.Sprite(glow); sprite.position.set(x, y, z); sprite.scale.set(1.15, 1.15, 1); sprite.name = 'compressor-lamp-glow'; sprite.userData.personCollision = false; sprite.raycast = () => {}; shell.add(sprite); }
      const haze = new THREE.MeshBasicMaterial({ map, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: .30, toneMapped: false }); s.materials.add(haze);
      const veil = quiet(s._mesh(geometryFor(s, new THREE.PlaneGeometry(9.4, 3.4)), haze, shell, [17.8, 2.32, -13.22])); veil.name = 'compressor-window-haze'; veil.receiveShadow = false;
    }
  }

  // --- fittings -----------------------------------------------------------
  const V = (a) => new THREE.Vector3(...a);
  const unit = { x: [1, 0, 0], y: [0, 1, 0], z: [0, 0, 1], '-x': [-1, 0, 0], '-y': [0, -1, 0], '-z': [0, 0, -1] };
  const turn = dir => new THREE.Quaternion().setFromUnitVectors(UP, V(unit[dir] || dir).normalize());
  const along = (at, dir, d) => { const u = unit[dir] || dir; return [at[0] + u[0] * d, at[1] + u[1] * d, at[2] + u[2] * d]; };
  function flangePair(p, at, dir, r, paint = 'silver', gap = .03, bolts = 8) {
    const quat = turn(dir);
    for (const side of [-1, 1]) k.cyl(p, paint, r, .020, along(at, dir, side * (gap / 2 + .010)), quat, 22);
    const a = V(unit[dir] || dir), u = (Math.abs(a.y) < .9 ? UP.clone() : new THREE.Vector3(1, 0, 0)).cross(a).normalize(), w = a.clone().cross(u);
    for (let i = 0; i < bolts; i++) {
      const t = i / bolts * Math.PI * 2, o = u.clone().multiplyScalar(Math.cos(t) * r * .80).addScaledVector(w, Math.sin(t) * r * .80);
      k.cyl(p, 'fitting', Math.max(.007, r * .085), gap + .075, [at[0] + o.x, at[1] + o.y, at[2] + o.z], quat, 6);
    }
  }
  function ballValve(p, at, dir, r, lever, paint = 'orange', body = 'fitting', len = .15) {
    const quat = turn(dir), l = unit[lever] || lever;
    k.cyl(p, body, r * 1.32, r * 2.7, at, quat, 8); for (const side of [-1, 1]) k.cyl(p, body, r * 1.5, r * .62, along(at, dir, side * r * 1.55), quat, 6);
    const stem = along(at, lever, r * 1.9); k.rod(p, 'fitting', at, stem, r * .30, 8);
    const d = unit[dir] || dir, vertical = Math.abs(d[1]) > .5, mid = [stem[0] + d[0] * len * .45, stem[1] + d[1] * len * .45, stem[2] + d[2] * len * .45];
    const tip = [stem[0] + d[0] * len, stem[1] + d[1] * len, stem[2] + d[2] * len];
    k.rod(p, paint, along(stem, dir, -.02), tip, .0075, 6);
    k.soft(p, paint, vertical ? (Math.abs(l[0]) > .5 ? [.012, len * .72, .026] : [.026, len * .72, .012]) : (Math.abs(d[0]) > .5 ? [len * .72, .012, .026] : [.026, .012, len * .72]), [mid[0] + d[0] * len * .2, mid[1] + d[1] * len * .2, mid[2] + d[2] * len * .2], null, .005);
  }
  function handwheel(p, at, dir, stem, r = .085) {
    const hub = along(at, dir, stem), quat = turn(dir), face = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), V(unit[dir] || dir));
    k.rod(p, 'fitting', at, hub, .012, 8); k.cyl(p, 'black', .030, .05, along(at, dir, stem * .35), quat, 10);
    k.ring(p, 'wheel', r, .011, hub, face); k.cyl(p, 'wheel', .020, .024, hub, quat, 10);
    const a = V(unit[dir] || dir), u = (Math.abs(a.y) < .9 ? UP.clone() : new THREE.Vector3(1, 0, 0)).cross(a).normalize(), w = a.clone().cross(u);
    for (let i = 0; i < 3; i++) { const t = i * Math.PI * 2 / 3 + .4, o = u.clone().multiplyScalar(Math.cos(t) * r).addScaledVector(w, Math.sin(t) * r); k.rod(p, 'wheel', hub, [hub[0] + o.x, hub[1] + o.y, hub[2] + o.z], .008, 6); }
  }
  function butterfly(p, at, dir, r, side, stem = .20, wheelR = .085) {
    flangePair(p, at, dir, r * 1.75, 'silver', .07, 8); k.cyl(p, 'iron', r * 1.45, .05, at, turn(dir), 20);
    k.soft(p, 'black', [.08, .08, .08], along(at, side, r * 1.75 + .05), null, .012); handwheel(p, along(at, side, r * 1.75 + .04), side, stem, wheelR);
  }
  const arrowShape = () => {
    const o = new THREE.Shape(); o.moveTo(-.085, -.018); o.lineTo(.02, -.018); o.lineTo(.02, -.038); o.lineTo(.085, 0); o.lineTo(.02, .038); o.lineTo(.02, .018); o.lineTo(-.085, .018); o.closePath();
    return new THREE.ExtrudeGeometry(o, { depth: .002, bevelEnabled: false });
  };
  // Yellow direction markers on the outside of a pipe.
  function flow(p, at, dir, out, r) {
    const X = V(unit[dir]), Z = V(unit[out]), Yv = Z.clone().cross(X), matrix = new THREE.Matrix4().makeBasis(X, Yv, Z), quat = new THREE.Quaternion().setFromRotationMatrix(matrix);
    k.shape(p, 'arrow', 'flow-arrow', arrowShape, along(at, out, r + .002), quat);
  }
  function gauge(p, at, dir, r = .055) {
    const quat = turn(dir); k.cyl(p, 'black', r, .035, at, quat, 24); k.ring(p, 'fitting', r * .98, .006, along(at, dir, .019), new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), V(unit[dir])));
    const yaw = { x: HALF, '-x': -HALF, z: 0, '-z': Math.PI }[dir] ?? 0;
    printed(s, p, 'site-gauge-face', [r * 1.9, r * 1.9], along(at, dir, .0205), yaw, dialFace, { px: 128, elevation: Y, clear: true });
  }
  // Large JEMACO line filter: black cast head, two-step sky blue bowl (04:02).
  function skyFilter(p, at, axis = 'z') {
    const [x, y, z] = at;
    k.lathe(p, 'black', 'sky-head', [[0, .085], [.074, .085], [.088, .07], [.090, -.075], [0, -.075]], at);
    for (const side of [-1, 1]) k.cyl(p, 'black', .064, .05, along(at, axis, side * .1), axis, 18);
    k.lathe(p, 'skyFilter', 'sky-bowl', [[.089, 0], [.089, -.21], [.078, -.225], [.074, -.55], [.064, -.60], [.03, -.628], [0, -.632]], [x, y - .075, z]);
    for (let i = 0; i < 12; i++) { const a = i * Math.PI / 6; k.box(p, 'skyFilter', [.006, .12, .010], [x + Math.sin(a) * .076, y - .40, z + Math.cos(a) * .076], [0, a, 0]); }
    k.cyl(p, 'fitting', .012, .07, [x, y - .74, z]); ballValve(p, [x, y - .77, z], 'y', .012, 'x', 'orange', 'fitting', .05);
    k.cyl(p, 'white', .030, .105, [x, y - .87, z]); k.cyl(p, 'black', .031, .02, [x, y - .84, z]); k.cable(p, 'creamHose', [[x, y - .92, z], [x + .01, y - 1.1, z + .02], [x - .02, .05, z + .06]], .004, 6);
    printed(s, p, 'site-filter-label', [.075, .095], [x + .0755, y - .42, z], HALF, (c, w, h) => { c.fillStyle = '#eef1f3'; c.fillRect(0, 0, w, h); c.fillStyle = '#1f74b8'; c.fillRect(0, 0, w, h * .16); c.fillStyle = '#7c8589'; for (let i = 0; i < 6; i++) c.fillRect(w * .1, h * (.28 + i * .1), w * (.5 + .3 * hash(i, 4)), h * .03); c.strokeStyle = '#c03027'; c.lineWidth = 3; c.beginPath(); c.moveTo(w * .25, h * .55); c.lineTo(w * .45, h * .45); c.lineTo(w * .75, h * .56); c.stroke(); }, { px: 96, elevation: Y });
  }
  // Cast navy filter with ribbed bowl (photos 048, 055–057).
  function navyFilter(p, at, axis, { drain = 'trap' } = {}) {
    const [x, y, z] = at, other = axis === 'x' ? 'z' : 'x';
    k.soft(p, 'navyFilter', axis === 'x' ? [.20, .11, .15] : [.15, .11, .20], at, null, .025);
    for (const side of [-1, 1]) { k.cyl(p, 'navyFilter', .058, .05, along(at, axis, side * .115), axis, 8); k.cyl(p, 'iron', .050, .05, along(at, axis, side * .16), axis, 6); k.box(p, 'navyFilter', axis === 'x' ? [.03, .15, .06] : [.06, .15, .03], along([x, y - .03, z], other, side * .075)); }
    k.lathe(p, 'navyFilter', 'navy-bowl', [[.078, 0], [.082, -.04], [.082, -.11], [.071, -.125], [.066, -.50], [.058, -.545], [.02, -.56], [0, -.56]], [x, y - .05, z]);
    for (let i = 0; i < 10; i++) { const a = i * Math.PI / 5; k.box(p, 'navyFilter', [.012, .10, .014], [x + Math.sin(a) * .078, y - .225, z + Math.cos(a) * .078], [0, a, 0]); }
    k.cyl(p, 'fitting', .014, .06, [x, y - .635, z]); ballValve(p, [x, y - .69, z], 'y', .013, 'x', 'orange', 'copper', .06);
    if (drain === 'trap') { k.soft(p, 'navyFilter', [.10, .075, .085], [x - .03, y - .80, z], null, .018); k.cyl(p, 'fitting', .022, .03, [x - .09, y - .79, z], 'x', 8); k.cable(p, 'rubber', [[x - .08, y - .80, z], [x - .16, y - .98, z - .02], [x - .10, .18, z + .04], [x - .02, .03, z + .18]], .007, 6); }
    else { k.cyl(p, 'plastic', .028, .10, [x, y - .80, z]); k.cyl(p, 'iron', .030, .02, [x, y - .755, z]); k.cable(p, 'rubber', [[x, y - .85, z], [x + .05, y - 1.0, z + .03], [x + .10, .03, z]], .006, 6); }
    printed(s, p, 'site-filter-plate', [.055, .11], axis === 'x' ? [x, y - .32, z - .0715] : [x - .0715, y - .32, z], axis === 'x' ? Math.PI : -HALF, (c, w, h) => { c.fillStyle = '#c9c7bb'; c.fillRect(0, 0, w, h); c.fillStyle = '#54585a'; for (let i = 0; i < 9; i++) c.fillRect(w * .1, h * (.08 + i * .1), w * (.4 + .4 * hash(i, 8)), h * .03); }, { px: 64, elevation: Y });
  }
  function wallBracket(p, at, dir, reach, drop = .16) {
    const tip = along(at, dir, reach); k.rod(p, 'strut', at, tip, .012, 6); k.rod(p, 'strut', [at[0], at[1] - drop, at[2]], along(at, dir, reach * .85), .009, 6); k.box(p, 'strut', [.03, drop + .06, .03], [at[0], at[1] - drop / 2, at[2]]);
  }
  function cabinet(p, size, at, face, paint, { handle = .8, label = null, meter = false, lamps = 0, seam = true, legs = 0 } = {}) {
    // size = [depth, height, width], face is the outward direction.
    const [d, h, w] = size, xFace = face.endsWith('x'), sign = face.startsWith('-') ? -1 : 1;
    const dims = xFace ? [d, h, w] : [w, h, d]; k.soft(p, paint, dims, at, null, .012);
    const out = o => along(at, face, d / 2 + o), side = (o, u, v) => { const b = out(o); return xFace ? [b[0], b[1] + v, b[2] - sign * u] : [b[0] + sign * u, b[1] + v, b[2]]; };
    if (seam) { const t = xFace ? [.004, h - .05, .006] : [.006, h - .05, .004]; for (const u of [-w / 2 + .025, w / 2 - .025]) k.box(p, 'gap', t, side(.001, u, 0)); const b = xFace ? [.004, .006, w - .05] : [w - .05, .006, .004]; for (const v of [-h / 2 + .025, h / 2 - .025]) k.box(p, 'gap', b, side(.001, 0, v)); }
    k.soft(p, 'black', xFace ? [.018, .11, .032] : [.032, .11, .018], side(.009, (handle - .5) * w, -.02), null, .006); k.box(p, 'fitting', xFace ? [.012, .07, .014] : [.014, .07, .012], side(.02, (handle - .5) * w, -.01));
    const yaw = { x: HALF, '-x': -HALF, z: 0, '-z': Math.PI }[face];
    if (label) printed(s, p, 'site-panel-label', [.15, .034], side(.004, 0, h / 2 - .07), yaw, (c, W, H) => { c.fillStyle = '#f4f3ec'; c.fillRect(0, 0, W, H); inkText(c, label, W / 2, H / 2 + 1, `700 ${H * .62}px Arial`); }, { px: 220, elevation: Y });
    if (meter) { const b = side(.018, w * .12, h * .16); k.soft(p, 'black', xFace ? [.036, .095, .085] : [.085, .095, .036], b, null, .012); printed(s, p, 'site-panel-meter', [.062, .03], along(b, face, .0195), yaw, (c, W, H) => { c.fillStyle = '#aab5a3'; c.fillRect(0, 0, W, H); inkText(c, '▮▮▮▮▮', W / 2, H / 2, `700 ${H * .6}px monospace`, '#3d463a'); }, { px: 96, elevation: Y }); k.box(p, 'arrow', xFace ? [.003, .02, .06] : [.06, .02, .003], side(.003, w * .12, h * .16 + .075)); }
    for (let i = 0; i < lamps; i++) k.cyl(p, i === 0 ? 'lampRed' : i % 2 ? 'lampGreen' : 'black', .013, .022, side(.010, -w * .28 + i * .055, h * .22), xFace ? 'x' : 'z', 12);
    if (lamps) for (let i = 0; i < Math.min(3, lamps); i++) k.cyl(p, 'black', .011, .02, side(.010, -w * .28 + i * .055, h * .10), xFace ? 'x' : 'z', 12);
    for (let i = 0; i < legs; i++) { const u = legs === 1 ? 0 : -w * .32 + i * w * .64 / (legs - 1), b = side(-d * .6, u, -h / 2); k.box(p, 'strut', [.09, b[1], .06], [b[0], b[1] / 2, b[2]]); }
  }

  // --- 7. north run: yellow lagged pipe, silver header, risers -----------
  // The lagged pipe enters through the west wall, drops in the corner and runs
  // the length of the glazing (02:14, 03:02, 03:08–03:12).
  for (const name of ['comp-north-yellow-pipe', 'comp-north-silver-pipe']) { const node = room.getObjectByName(name); if (node) { node.visible = false; node.userData.personCollision = false; } }
  k.pipe(low, 'yellowLag', [[13.45, 2.98, -9.22], [13.78, 2.98, -9.22], [13.78, 2.98, -13.02], [13.78, .93, -13.02], [22.1, .93, -13.02]], .088, { bend: .2, seg: 18, weld: 'brownPipe' });
  k.cyl(low, 'brownPipe', .14, .02, [13.485, 2.98, -9.22], 'x', 22);
  for (const z of [-9.75, -11.2, -12.45]) { wallBracket(low, [13.49, 2.88, z], 'x', .36, .26); k.ring(low, 'strut', .094, .006, [13.78, 2.98, z], [0, 0, 0]); }
  for (const x of [15.1, 17.0, 18.9, 20.7]) { k.ring(low, 'strut', .092, .006, [x, .93, -13.02], [0, HALF, 0]); k.box(low, 'iron', [.05, .62, .05], [x, .52, -13.02]); }
  k.pipe(low, 'silver', [[13.64, 1.04, -9.3], [13.64, 1.04, -12.78], [13.9, .74, -12.78], [21.95, .74, -12.78]], .056, { bend: .13, seg: 16, weld: 'fitting' });
  for (const x of [14.7, 16.75, 18.75, 20.6]) { k.box(low, 'cream', [.045, .70, .04], [x, .35, -12.78]); k.ring(low, 'fitting', .061, .006, [x, .74, -12.78], [0, HALF, 0]); k.box(low, 'iron', [.12, .012, .12], [x, .012, -12.78]); }
  // 1호 discharge: black hose, union, two orange levers, riser (photo 012).
  k.pipe(low, 'rubber', [[15.28, .36, -12.18], [15.28, .36, -12.42], [15.28, .80, -12.42]], .036, { bend: .07, collar: 'iron' });
  k.cyl(low, 'fitting', .046, .07, [15.28, .84, -12.42], 'y', 6); ballValve(low, [15.28, 1.12, -12.42], 'y', .036, '-x', 'orange', 'fitting', .22); ballValve(low, [15.20, .98, -12.42], 'x', .018, 'y', 'orange', 'fitting', .10);
  k.pipe(low, 'galv', [[15.28, .86, -12.42], [15.28, 1.98, -12.42], [16.1, 1.98, -12.42], [16.1, 1.98, -12.78], [16.1, .76, -12.78]], .036, { bend: .09, collar: 'fitting' });
  // 2호 discharge: braided hose and blue lever on the north end (photo 020).
  k.pipe(low, 'stainless', [[18.22, .52, -11.30], [18.22, .52, -11.46], [18.22, .88, -11.46]], .036, { bend: .07, collar: 'fitting' });
  ballValve(low, [18.22, 1.18, -11.46], 'y', .034, 'x', 'valveBlue', 'fitting', .17); ballValve(low, [18.30, 1.02, -11.46], 'x', .016, 'y', 'fitting', 'fitting', .07);
  k.pipe(low, 'galv', [[18.22, .9, -11.46], [18.22, 1.98, -11.46], [18.22, 1.98, -12.78], [18.22, .76, -12.78]], .036, { bend: .09, collar: 'fitting' });
  // 4호 discharge, with the black flexible lead clipped to it (photo 029).
  k.pipe(low, 'galv', [[20.15, .76, -12.78], [20.15, 1.96, -12.78], [20.15, 1.96, -12.30], [20.62, 1.96, -12.30], [20.62, 1.62, -12.14], [20.62, 1.62, -12.02]], .028, { bend: .06, collar: 'fitting' });
  for (const [x, top] of [[16.1, 1.9], [20.15, 1.85]]) { k.pipe(low, 'rubber', [[x - .055, .82, -12.76], [x - .055, top, -12.76]], .014, {}); for (const y of [.95, 1.3, 1.65]) k.ring(low, 'black', .046, .005, [x - .02, y, -12.77], [HALF, 0, 0]); }
  k.cable(low, 'foam', [[20.6, 1.60, -12.10], [20.45, 1.2, -12.16], [20.9, .95, -12.10], [21.3, 1.25, -12.06]], .016, 8);
  // Cable bundle and junction box below the sill (03:10).
  for (let i = 0; i < 4; i++) k.cable(low, i % 2 ? 'rubber' : 'black', [[13.62, 1.22 + i * .02, -13.2], [14.6, 1.26 - i * .018, -13.22], [15.5, 1.36 - i * .022, -13.24], [16.3, 1.34 + i * .012, -13.22], [17.1, 1.22 - i * .02, -13.2], [17.8, 1.02 - i * .014, -13.12], [18.3, .88, -12.95 + i * .02], [19.0, .62, -12.72], [19.35, .3, -12.5 + i * .04]], .015, 7);
  k.soft(low, 'white', [.16, .20, .09], [16.35, 1.44, -13.25], null, .012); for (const x of [16.28, 16.42]) k.cable(low, 'rubber', [[x, 1.35, -13.22], [x + .05, 1.24, -13.18], [x + .2, 1.3, -13.2]], .012, 7);
  for (const x of [14.55, 14.62]) k.box(low, 'strut', [.04, 1.42, .04], [x + .3, .71, -13.2]);
  k.soft(low, 'white', [.09, .13, .06], [15.35, 1.52, -13.24], null, .01); k.soft(low, 'red', [.07, .04, .03], [14.2, 1.2, -13.26], null, .008);

  // --- 8. west wall: long air headers, conduits, boxes -------------------
  k.pipe(low, 'silver', [[13.66, 2.16, -13.0], [13.66, 2.16, -4.95]], .058, { seg: 16 });
  k.pipe(low, 'galv', [[13.60, 2.36, -13.1], [13.60, 2.36, -4.1]], .024, {}); k.pipe(low, 'rubber', [[13.58, 2.42, -10.0], [13.58, 2.42, -4.4]], .016, {});
  for (const z of [-12.6, -11.0, -9.55, -8.0, -6.35, -5.1]) { wallBracket(low, [13.49, 2.09, z], 'x', .24); k.ring(low, 'strut', .062, .006, [13.66, 2.16, z]); k.box(low, 'strut', [.05, .03, .05], [13.60, 2.33, z]); }
  k.pipe(low, 'galv', [[13.64, 1.04, -9.32], [13.64, .92, -9.32], [13.64, .92, -7.55]], .05, { bend: .06, collar: 'fitting' });
  ballValve(low, [13.64, .92, -8.72], 'z', .05, 'x', 'orange', 'iron', .22);
  // Yellowed junction box and conduit behind the 2 m³ receiver (photos 050, 053).
  cabinet(low, [.13, .32, .27], [13.55, 1.66, -8.86], 'x', 'boxYellow', { handle: .5 }); k.pipe(low, 'iron', [[13.53, 1.5, -8.86], [13.53, .3, -8.86]], .018, {}); k.pipe(low, 'black', [[13.53, 1.5, -8.80], [13.53, .9, -8.80], [13.6, .6, -8.7]], .014, {});
  // White sub-panel, steel switch box, leads swept onto the pipe (03:02–03:06).
  cabinet(low, [.14, .42, .30], [13.56, 1.50, -9.62], 'x', 'white', { handle: .5 });
  cabinet(low, [.20, .58, .46], [13.60, 1.44, -10.72], 'x', 'panelGrey', { handle: .32 });
  for (const y of [1.2, 1.68]) for (const z of [-10.47, -10.97]) k.box(low, 'strut', [.04, .03, .05], [13.5, y, z]);
  for (let i = 0; i < 5; i++) k.cable(low, 'rubber', [[13.6, 1.3, -9.52 - i * .045], [13.58 + i * .006, 1.12, -9.62 - i * .06], [13.64, 1.12 + i * .012, -10.1], [13.66, 1.125 + i * .012, -11.2], [13.66, 1.12 + i * .01, -12.4], [13.7, 1.18, -13.1]], .014, 7);
  for (let i = 0; i < 4; i++) k.cable(low, 'rubber', [[13.62, 1.15, -10.62 - i * .05], [13.64, 1.06, -10.68 - i * .07], [13.67, 1.12, -11.0 - i * .1]], .015, 7);
  k.cable(low, 'black', [[13.7, 1.45, -10.97], [13.72, 1.2, -11.08], [13.68, 1.13, -11.4]], .018, 8);
  k.soft(low, 'white', [.06, .11, .08], [13.52, 2.0, -10.42], null, .01); k.cable(low, 'foam', [[13.5, 2.3, -10.14], [13.5, 1.2, -10.14], [13.5, .25, -10.14]], .012, 7); k.pipe(low, 'iron', [[13.52, 4.0, -10.2], [13.52, .2, -10.2]], .022, {});
  k.soft(low, 'white', [.05, .12, .08], [13.5, .62, -9.82], null, .008); k.cable(low, 'black', [[13.52, .56, -9.82], [13.6, .3, -9.86], [13.75, .06, -9.75], [14.1, .03, -9.95]], .008, 6);
  // Wall fans: grey-green cast bodies with a hanging supply lead (02:10).
  for (const [x, y, z, sx] of [[13.50, 2.75, -7.8, 1], [22.10, 2.55, -8.5, -1]]) {
    const dir = sx > 0 ? 'x' : '-x';
    k.soft(low, 'fanGreen', [.07, .56, .56], [x + sx * .04, y, z], null, .03);
    k.cyl(low, sx < 0 ? 'daylight' : 'gap', .225, .085, [x + sx * .05, y, z], 'x', 30); k.ring(low, 'fanGreen', .235, .018, [x + sx * .095, y, z], [0, HALF, 0], 34);
    k.cyl(low, 'fanGreen', .075, .13, [x + sx * .11, y, z], 'x', 18); k.cyl(low, 'lampGreen', .035, .004, [x + sx * .178, y, z], 'x', 14);
    for (let i = 0; i < 4; i++) { const a = i * HALF + .5; k.box(low, 'fanGreen', [.02, .022, .24], [x + sx * .10, y + Math.sin(a) * .13, z + Math.cos(a) * .13], [-a, 0, 0]); }
    for (let i = 0; i < 5; i++) { const a = i * Math.PI * 2 / 5; k.box(low, 'fanGreen', [.008, .10, .15], [x + sx * .075, y + Math.sin(a) * .14, z + Math.cos(a) * .14], [-a, .5, 0]); }
    k.cable(low, 'black', [[x + sx * .12, y - .06, z + .03], [x + sx * .17, y - .28, z - .16], [x + sx * .10, y - .42, z - .22], [x + sx * .03, y - .66, z - .26]], .011, 7);
  }
  for (const name of ['comp-west-wall-fan', 'comp-east-wall-fan']) { const node = room.getObjectByName(name); if (node) node.visible = false; }

  // --- 9. control cabinets behind the desiccant dryers -------------------
  cabinet(low, [.22, 1.02, .78], [13.60, 1.42, -6.15], 'x', 'panel', { label: 'P4C-02 PANEL', handle: .9, meter: true, legs: 2 });
  cabinet(low, [.18, .52, .38], [13.59, 1.72, -5.48], 'x', 'panel', { label: 'P4C-03 PANEL', handle: .12, meter: true, legs: 1 });
  cabinet(low, [.18, .74, .46], [13.59, 1.52, -4.92], 'x', 'panel', { label: 'MCC-04 PANEL', handle: .85, lamps: 4 });
  cabinet(low, [.16, .46, .26], [13.57, 1.45, -3.98], 'x', 'cream', { lamps: 2, handle: .5 });
  k.cable(low, 'rubber', [[13.62, 1.93, -6.0], [13.64, 2.2, -5.98], [13.60, 2.44, -5.7], [13.58, 2.46, -5.2], [13.56, 2.46, -3.9]], .036, 10);
  k.box(low, 'strut', [.05, .05, 2.6], [13.55, 1.0, -5.3]); k.box(low, 'brownPipe', [.34, .10, 2.9], [13.68, .30, -5.45]);
  for (let i = 0; i < 3; i++) k.cable(low, 'rubber', [[13.62, .92, -5.95 - i * .12], [13.66, .55, -5.85 - i * .1], [13.7, .36, -5.6], [13.72, .38, -4.8]], .02, 8);
  for (const z of [-5.18, -5.82]) k.pipe(low, 'iron', [[13.78, .34, z], [13.78, .62, z], [13.6, .62, z]], .02, { collar: 'iron' });
  // South-west corner: two wall panels, cable trunking and four hoses (01:52).
  cabinet(low, [.24, 1.08, .76], [15.02, 1.36, -3.60], '-z', 'panel', { handle: .86 });
  cabinet(low, [.20, .92, .46], [14.12, 1.40, -3.58], '-z', 'cream', { handle: .85 });
  for (let i = 0; i < 4; i++) k.cable(low, 'rubber', [[15.3 - i * .16, .84, -3.58], [15.28 - i * .16, .5, -3.60], [15.12 - i * .17, .22, -3.72], [14.8 - i * .16, .07, -3.85]], .032, 9);
  k.pipe(low, 'galv', [[14.55, .1, -3.60], [14.55, 2.28, -3.60], [14.55, 2.42, -3.56], [15.6, 2.42, -3.56]], .032, { bend: .08, collar: 'strut' });
  k.box(low, 'strut', [2.9, .10, .12], [14.95, 2.74, -3.58]); k.box(low, 'strut', [.12, .55, .10], [13.95, 2.46, -3.58]); k.box(low, 'strut', [.10, .35, .10], [13.78, 2.1, -3.58], [0, 0, .5]);
  k.soft(low, 'white', [.08, .12, .03], [14.72, 1.12, -3.49], null, .008);

  // --- 10. silver air header and its valve trees (02:00–02:08, 04:02) ----
  for (const node of room.getObjectByName('comp-dryer-ps600k').children) if (node.name === 'ps600-header-drum') { node.visible = false; node.userData.personCollision = false; }
  const HX = 14.02, HY = .80, HR = .155;
  k.cyl(low, 'silver', HR, 1.5, [HX, HY, -5.72], 'z', 28); for (const [z, d] of [[-6.47, -1], [-4.97, 1]]) k.ball(low, 'silver', [HR, HR, .085], [HX, HY, z]);
  for (const z of [-6.42, -5.02]) k.cyl(low, 'fitting', HR * 1.012, .012, [HX, HY, z], 'z', 28);
  for (const z of [-6.15, -5.25]) { k.pipe(low, 'galv', [[HX, HY - HR + .01, z], [HX, .03, z]], .036, {}); k.box(low, 'cream', [.26, .012, .18], [HX, .02, z]); }
  const tree = (z, top, { loop = true, side = 1, x = HX } = {}) => {
    const y = HY + HR;
    k.pipe(low, 'galv', [[x, y - .02, z], [x, top, z]], .036, {}); k.cyl(low, 'fitting', .048, .05, [x, y + .02, z], 'y', 8);
    ballValve(low, [x, y + .16, z], 'y', .036, 'x', 'valveBlue', 'fitting', .15);
    k.cyl(low, 'fitting', .046, .11, [x, y + .33, z], 'y', 14); flow(low, [x, y + .48, z], 'y', 'x', .036);
    ballValve(low, [x, y + .64, z], 'y', .036, 'x', 'red', 'fitting', .17);
    flangePair(low, [x, y + .84, z], 'y', .082, 'galv'); k.soft(low, 'stainless', [.10, .20, .10], [x, y + .98, z], null, .01); flangePair(low, [x, y + 1.12, z], 'y', .082, 'galv');
    k.box(low, 'fitting', [.02, .02, .09], [x, y + 1.0, z + .07 * side]); k.soft(low, 'wheel', [.05, .075, .075], [x, y + 1.0, z + .13 * side], null, .01); k.box(low, 'white', [.004, .045, .05], [x + .027, y + 1.0, z + .13 * side]);
    ballValve(low, [x, y + 1.28, z], 'y', .036, 'x', 'red', 'fitting', .17);
    if (loop) { const b = x + .18; k.pipe(low, 'silver', [[x, y + 1.46, z], [b, y + 1.5, z], [b, y + .48, z], [x + .02, y + .48, z]], .034, { bend: .075, weld: 'fitting' }); flow(low, [b, y + 1.0, z], 'y', 'x', .034); }
  };
  tree(-5.12, 2.75); tree(-5.52, 2.7, { side: -1 }); tree(-5.92, 2.2, { loop: false });
  k.pipe(low, 'galv', [[HX, 1.33, -5.14], [HX, 1.33, -5.5]], .032, {}); ballValve(low, [HX, 1.33, -5.31], 'z', .030, 'x', 'valveBlue', 'fitting', .15);
  k.pipe(low, 'galv', [[HX, 1.9, -5.54], [HX, 1.9, -5.9]], .030, {}); ballValve(low, [HX, 1.62, -5.72], 'z', .026, 'x', 'orange', 'fitting', .14); k.pipe(low, 'galv', [[HX, 1.62, -5.54], [HX, 1.62, -5.9]], .026, {});
  gauge(low, [HX + .06, 1.22, -4.94], 'x', .062); k.pipe(low, 'galv', [[HX, .92, -4.96], [HX, 1.22, -4.96]], .012, {}); for (let i = 0; i < 3; i++) k.cable(low, 'creamHose', [[HX + .04, 1.35, -5.1], [HX + .15, 1.25 - i * .02, -5.2], [HX + .12, 1.1, -5.28], [HX + .03, 1.2, -5.2], [HX + .05, 1.38, -5.12]], .006, 6);
  ballValve(low, [HX, 1.02, -6.32], 'y', .014, 'x', 'orange', 'copper', .07); k.cyl(low, 'black', .02, .10, [HX, 1.16, -6.32]); k.cable(low, 'black', [[HX, 1.2, -6.32], [HX - .12, 1.26, -6.42], [13.75, 1.1, -6.6], [13.6, .8, -6.7]], .008, 6);
  // Black flexible conduit laced through the trees (photo 087).
  k.cable(low, 'rubber', [[13.86, 3.2, -5.34], [13.9, 2.4, -5.36], [13.88, 1.9, -5.30], [13.9, 1.5, -5.4], [13.95, 1.16, -5.42], [13.86, 1.02, -5.7], [13.82, .8, -5.9]], .022, 9); k.cable(low, 'greenHose', [[13.9, 1.9, -5.2], [14.14, 1.5, -5.32], [14.16, 1.18, -5.46], [14.04, 1.22, -5.6], [14.12, 1.46, -5.5]], .007, 6);
  // Three risers into the high wall, then the silver down-leg onto the panel.
  for (const [z, top, x] of [[-5.12, 3.1, 13.94], [-5.52, 3.18, 13.94]]) k.pipe(low, 'galv', [[HX, 2.7, z], [x, 2.82, z], [x, top, z], [13.48, top, z]], .034, { bend: .08, collar: 'fitting' });
  k.pipe(low, 'silver', [[13.66, 2.16, -5.0], [13.92, 2.16, -5.0], [13.92, 2.16, -6.18], [13.92, 1.66, -6.18], [13.92, 1.60, -5.98], [13.96, 1.60, -5.92], [13.96, .95, -5.92]], .044, { bend: .09, weld: 'fitting' }); flow(low, [13.92, 1.88, -6.18], '-y', 'x', .044); flow(low, [13.96, 1.2, -5.92], '-y', 'x', .044);
  k.pipe(low, 'galv', [[13.9, 2.3, -6.62], [13.9, .12, -6.62]], .030, {}); ballValve(low, [13.9, 1.86, -6.62], 'y', .03, 'x', 'red', 'iron', .16); k.cyl(low, 'fitting', .045, .06, [13.9, 1.62, -6.62], 'y', 8); k.soft(low, 'white', [.06, .06, .06], [13.95, 1.5, -6.62], null, .012); k.pipe(low, 'iron', [[13.9, .62, -6.62], [13.9, .62, -6.86], [13.66, .62, -6.86]], .022, { collar: 'iron' }); ballValve(low, [13.9, .7, -6.7], 'z', .02, 'x', 'orange', 'iron', .1);
  k.box(low, 'white', [.012, .2, .3], [13.66, .74, -6.48], [0, 0, .1]);

  // --- 11. HX601K, sky-blue filters, aftercooler and bypass ---------------
  // Dryer outlet: thick silver pipe forward of the wall into the black head.
  k.pipe(low, 'silver', [[14.2, .74, -6.86], [14.2, 1.42, -6.86], [14.28, 1.42, -6.62], [14.28, 1.42, -6.12]], .056, { bend: .13, seg: 18, weld: 'fitting' });
  flow(low, [14.28, 1.42, -6.36], 'z', 'x', .056); skyFilter(low, [14.28, 1.42, -6.0], 'z'); k.pipe(low, 'silver', [[14.28, 1.42, -5.9], [14.28, 1.42, -5.78], [14.15, 1.42, -5.72], [14.02, 1.42, -5.72]], .052, { bend: .07, seg: 16 });
  // Inlet: comes down beside the second filter with an arrow (02:10, 04:00).
  k.pipe(low, 'silver', [[14.08, .54, -7.05], [13.92, .46, -7.22], [13.92, .46, -7.42], [13.92, 1.98, -7.42]], .054, { bend: .15, seg: 18, weld: 'fitting' });
  k.pipe(low, 'silver', [[13.92, 1.9, -7.42], [13.92, 2.0, -7.42], [13.86, 2.0, -7.56], [13.80, 2.0, -7.62]], .054, { bend: .1, seg: 16 }); flow(low, [13.92, 1.15, -7.42], '-y', 'x', .054);
  skyFilter(low, [13.76, 1.96, -7.72], 'z'); k.pipe(low, 'silver', [[13.76, 1.96, -7.82], [13.76, 1.96, -8.15]], .05, { seg: 16 }); flangePair(low, [13.76, 1.96, -7.90], 'z', .10, 'silver'); flow(low, [13.76, 1.96, -7.98], 'z', 'x', .05); butterfly(low, [13.76, 1.96, -8.06], 'z', .05, '-y', .17, .075);
  // Rear aftercooler riser, its handwheel valve and the closed front bypass.
  k.pipe(low, 'silver', [[13.96, 1.03, -8.15], [13.96, 1.96, -8.15], [13.76, 1.96, -8.15]], .054, { bend: .1, seg: 18 }); k.pipe(low, 'silver', [[13.96, 1.86, -8.15], [13.96, 2.3, -8.15], [13.96, 2.3, -8.0], [13.96, 2.3, -5.2]], .05, { bend: .12, seg: 16, weld: 'fitting' });
  flangePair(low, [13.96, 1.18, -8.15], 'y', .098, 'silver'); butterfly(low, [13.96, 1.44, -8.15], 'y', .054, 'z', .20, .085); butterfly(low, [13.96, 2.3, -6.95], 'z', .05, '-y', .2, .09); flow(low, [13.96, 2.3, -7.5], 'z', 'x', .05);
  k.pipe(low, 'iron', [[13.96, 1.70, -8.15], [14.98, 1.70, -8.15]], .046, { seg: 16 }); flangePair(low, [14.42, 1.70, -8.15], 'x', .108, 'silver', .03, 8); k.soft(low, 'black', [.07, .12, .07], [14.42, 1.88, -8.15], null, .012); handwheel(low, [14.42, 1.86, -8.15], 'z', .12, .07);
  // Front riser: two flange sets and the bend across to the 2 m³ receiver.
  k.pipe(low, 'silver', [[14.99, 1.03, -8.15], [14.99, 1.98, -8.15], [15.36, 1.98, -8.45], [15.36, 1.98, -9.25], [15.36, 1.63, -9.25], [15.10, 1.63, -9.25]], .062, { bend: .14, seg: 18, weld: 'fitting' });
  flangePair(low, [14.99, 1.15, -8.15], 'y', .112, 'silver'); flangePair(low, [14.99, 1.40, -8.15], 'y', .112, 'silver', .07, 8); k.cyl(low, 'iron', .09, .05, [14.99, 1.40, -8.15], 'y', 20); k.soft(low, 'black', [.10, .13, .12], [14.99, 1.40, -7.975], null, .018); k.soft(low, 'white', [.004, .03, .06], [15.042, 1.43, -7.975]); handwheel(low, [15.0, 1.40, -7.88], 'x', .12, .10); flow(low, [14.99, 1.83, -8.15], '-y', 'x', .062); flow(low, [15.36, 1.98, -8.85], 'z', 'x', .062); flangePair(low, [15.16, 1.63, -9.25], 'x', .108, 'silver');
  k.cable(low, 'black', [[15.1, 1.05, -8.22], [15.2, 1.07, -8.12], [15.24, 1.06, -8.22], [15.12, 1.06, -8.28]], .006, 6);
  k.box(low, 'dusty', [1.63, .008, .425], [14.48, 1.032, -8.15]); for (const side of [-1, 1]) k.box(low, 'black', [1.63, .03, .012], [14.48, 1.016, -8.15 + side * .213]); for (const x of [13.70, 14.2, 14.75, 15.26]) for (const side of [-1, 1]) k.cyl(low, 'fitting', .009, .012, [x, 1.04, -8.15 + side * .19], 'y', 6);
  // Three taped refrigerant lines arching off the wall (02:08).
  for (let i = 0; i < 4; i++) k.pipe(low, 'lagging', [[13.5, 1.10 - i * .03, -7.02 - i * .075], [13.80 + i * .015, .98 - i * .02, -6.98 - i * .075], [13.84 + i * .02, .05, -6.98 - i * .075]], .036, { bend: .13, seg: 12 });
  k.soft(low, 'lagging', [.08, .07, .34], [13.53, 1.10, -7.13], null, .02); k.pipe(low, 'iron', [[13.5, .78, -7.48], [13.74, .78, -7.48], [13.74, .34, -7.48]], .028, { collar: 'iron' }); for (let i = 0; i < 2; i++) k.cable(low, 'black', [[13.55, 1.2, -7.3], [13.55, .95, -7.6 - i * .1], [13.6, .62, -8.0], [13.62, .42, -8.6 + i * .1]], .007, 6);
  for (const [a, b] of [[[13.8, .12, -4.6], [13.95, .10, -7.7]], [[14.0, .10, -4.7], [14.1, .10, -6.6]]]) k.pipe(low, 'iron', [a, b], .022, {});

  // --- 12. dryer skids and safety boards ---------------------------------
  const ps = room.getObjectByName('comp-dryer-ps600k');
  if (ps) { for (const side of [-1, 1]) { k.box(low, 'cream', [1.0, .09, .10], [14.82, .05, -5.6 + side * .55]); k.soft(low, 'cream', [.46, .62, .03], [14.70, .37, -5.6 + side * .60], null, .012); k.soft(low, 'cream', [.40, .03, .26], [14.70, .67, -5.6 + side * .49], [side * -.35, 0, 0], .01); } }
  // Manifold above the two grey vessels with relief and gauge (01:56).
  for (const side of [-1, 1]) { const z = -5.6 + side * .34; k.cyl(low, 'iron', .052, .07, [14.67, 2.0, z], 'y', 6); k.pipe(low, 'fitting', [[14.67, 1.94, z], [14.67, 2.30, z], [14.67, 2.30, z - side * .10]], .036, { bend: .05, collar: 'iron' }); }
  k.pipe(low, 'fitting', [[14.67, 2.30, -5.84], [14.67, 2.30, -5.36]], .036, {}); k.ball(low, 'fitting', [.085, .08, .09], [14.67, 2.30, -5.52]); for (const z of [-5.78, -5.42]) k.cyl(low, 'iron', .052, .05, [14.67, 2.30, z], 'z', 6);
  for (const z of [-5.74, -5.46]) k.pipe(low, 'copper', [[14.72, 2.28, z], [14.80, 2.22, z], [14.80, 1.96, z]], .014, { collar: 'fitting' }); k.pipe(low, 'copper', [[14.80, 1.96, -5.74], [14.80, 1.96, -5.46]], .012, {}); gauge(low, [14.84, 2.08, -5.62], 'x', .055); k.cable(low, 'arrow', [[14.75, 2.36, -5.5], [14.84, 2.2, -5.44], [14.88, 1.7, -5.46], [14.92, 1.36, -5.5]], .006, 6);
  k.pipe(low, 'galv', [[14.67, 2.26, -5.94], [14.60, 2.14, -5.80], [14.52, 2.14, -5.72]], .034, { bend: .05 }); skyFilter(low, [14.40, 2.14, -5.72], 'x'); flangePair(low, [14.23, 2.14, -5.72], 'x', .09, 'silver'); k.pipe(low, 'silver', [[14.30, 2.14, -5.72], [13.92, 2.14, -5.72], [13.92, 2.14, -5.95], [13.92, 2.16, -6.18]], .046, { bend: .08, weld: 'fitting' }); butterfly(low, [14.08, 2.14, -5.72], 'x', .046, '-y', .16, .075); flow(low, [13.97, 2.14, -5.72], '-x', 'z', .046);
  k.pipe(low, 'silver', [[14.34, 2.2, -5.66], [14.26, 2.52, -6.12], [14.16, 2.52, -6.24], [14.16, .95, -6.24]], .030, { bend: .14, weld: 'fitting' });
  printed(s, low, 'site-inspection-card', [.22, .155], [14.93, 1.42, -5.24], HALF, inspectionCard, { px: 420, elevation: Y, roll: -.10 });
  printed(s, low, 'site-ps600-approval', [.085, .06], [14.899, 1.30, -5.94], HALF, (c, w, h) => { c.fillStyle = '#e8d53a'; c.fillRect(0, 0, w, h); inkText(c, '안전검사합격필증', w / 2, h * .2, `700 ${h * .17}px "Malgun Gothic"`); c.fillStyle = '#7a6f1e'; for (let i = 0; i < 5; i++) c.fillRect(w * .08, h * (.36 + i * .11), w * .84, 1); }, { px: 180, elevation: Y });
  printed(s, low, 'site-ps600-maker', [.19, .125], [14.72, .50, -6.2165], Math.PI, (c, w, h) => { c.fillStyle = '#20427c'; c.fillRect(0, 0, w, h); inkText(c, 'DESICCANT AIR DRYER', w / 2, h * .13, `700 ${h * .12}px Arial`, '#eef'); c.fillStyle = '#aebad0'; for (let i = 0; i < 6; i++) for (const x of [.25, .74]) c.fillRect(w * x, h * (.28 + i * .09), w * .2, h * .05); inkText(c, 'JEMACO FLAIR CORPORATION', w / 2, h * .92, `600 ${h * .09}px Arial`, '#dfe6f2'); }, { px: 220, elevation: Y });
  const jac = room.getObjectByName('comp-aftercooler-jac100');
  if (jac) printed(s, low, 'site-pressure-vessel-rules', [.30, .40], [15.302, .74, -8.15], HALF, safetyRules, { px: 384, elevation: Y });
  printed(s, low, 'site-hl350-team', [.12, .12], [14.748, 1.36, -4.45], HALF, (c, w, h) => { c.clearRect(0, 0, w, h); c.strokeStyle = '#15324f'; c.lineWidth = 4; c.beginPath(); c.arc(w / 2, h / 2, w * .44, 0, 7); c.stroke(); inkText(c, '3팀', w / 2, h / 2 + 3, `700 ${w * .36}px "Malgun Gothic"`, '#15324f'); }, { px: 128, elevation: Y, clear: true });
  printed(s, low, 'site-hl350-danger', [.16, .17], [14.748, 1.60, -3.85], HALF, (c, w, h) => { c.fillStyle = '#f2f1ea'; c.fillRect(0, 0, w, h); c.fillStyle = '#c8332c'; c.fillRect(0, h * .28, w, h * .12); inkText(c, '⚠ DANGER', w / 2, h * .34, `800 ${h * .09}px Arial`, '#fff'); c.fillStyle = '#1c1c1c'; c.fillRect(0, h * .60, w, h * .4); c.fillStyle = '#888'; for (let i = 0; i < 5; i++) c.fillRect(w * .08, h * (.66 + i * .065), w * .84, 2); }, { px: 200, elevation: Y });
  // Dark ribbed filter, its red auto-drain and the line into the panel corner.
  k.pipe(low, 'galv', [[14.2, 1.95, -4.02], [14.02, 1.95, -3.95], [13.95, 1.95, -3.88], [13.95, 2.05, -3.84], [13.95, 3.05, -3.84], [13.95, 3.05, -5.1]], .034, { bend: .08, collar: 'iron' }); navyFilter(low, [14.08, 1.86, -4.36], 'x', { drain: 'bowl' }); k.ball(low, 'red', [.055, .05, .055], [14.08, 1.10, -4.36]);
  k.soft(low, 'blue', [.16, .10, .10], [14.35, 1.98, -4.18], null, .02);

  // --- 13. blue service water, cable tray and east wall --------------------
  const slopeY = x => 3.30 - (x - 13.5) * .032;
  k.pipe(shell, 'blue', [[13.46, slopeY(13.46), -6.34], [20.95, slopeY(20.95), -6.34], [20.95, 3.02, -7.22], [20.95, 1.84, -7.22]], .058, { bend: .14, seg: 16, weld: 'blue' });
  k.pipe(shell, 'blue', [[13.46, slopeY(13.46) + .02, -6.58], [21.2, slopeY(21.2), -6.58], [21.2, 2.99, -6.95], [21.2, 2.99, -9.695], [21.2, .55, -9.695]], .058, { bend: .14, seg: 16, weld: 'blue' });
  k.pipe(shell, 'galv', [[13.46, slopeY(13.46) + .06, -6.10], [18.55, slopeY(18.55) + .06, -6.10], [18.55, slopeY(18.55) + .06, -5.2], [18.55, 2.6, -5.2]], .036, { bend: .1, collar: 'fitting' });
  k.pipe(shell, 'galv', [[14.5, slopeY(14.5) + .06, -6.10], [14.5, 3.10, -6.02], [14.5, 2.28, -6.02]], .032, { bend: .07, collar: 'fitting' });
  for (const x of [14.9, 16.6, 18.3, 20.0]) { for (const z of [-6.34, -6.58]) k.rod(shell, 'strut', [x, slopeY(x), z], [x, ceiling(x) - .25, z], .006, 6); k.box(shell, 'strut', [.03, .025, .62], [x, slopeY(x) - .07, -6.36]); }
  k.cyl(low, 'blue', .078, .05, [20.95, 1.85, -7.22]); flangePair(low, [20.95, 1.90, -7.22], 'y', .10, 'galv');
  k.pipe(low, 'blue', [[21.45, 1.80, -8.85], [21.45, 2.02, -8.85], [21.45, 2.02, -8.35], [21.86, 2.02, -8.35], [21.86, 2.02, -6.4]], .058, { bend: .12, seg: 16 });
  k.pipe(low, 'blue', [[21.45, 1.80, -7.15], [21.45, 2.42, -7.15], [22.02, 2.42, -7.15], [22.02, 2.42, -4.25], [22.02, 2.36, -4.2]], .034, { bend: .08 }); for (const z of [-6.2, -5.0]) k.rod(low, 'strut', [22.02, 2.42, z], [22.02, 2.8, z], .006, 6);
  k.pipe(low, 'galv', [[22.0, 1.98, -13.1], [22.0, 1.98, -4.0]], .034, {}); for (const z of [-10.9, -9.75, -6.75]) flow(low, [22.0, 1.98, z], 'z', '-x', .034); k.cable(low, 'rubber', [[22.06, 2.06, -12.8], [22.06, 2.03, -10.5], [22.06, 2.06, -8.8], [22.06, 2.02, -6.2], [22.08, 2.06, -4.2]], .016, 8); for (const z of [-12.2, -10.2, -8.7, -7.1, -5.5]) wallBracket(low, [22.11, 1.92, z], '-x', .16, .12);
  for (const side of [-1, 1]) k.box(shell, 'strut', [.012, .08, 5.4], [20.15 + side * .15, 3.00, -7.1]); k.box(shell, 'strut', [.30, .008, 5.4], [20.15, 2.97, -7.1]); for (const z of [-9.4, -7.6, -5.8, -4.7]) for (const side of [-1, 1]) k.rod(shell, 'strut', [20.15 + side * .15, 3.02, z], [20.15 + side * .15, ceiling(20.15) - .1, z], .006, 6);
  for (let i = 0; i < 5; i++) k.cable(shell, 'rubber', [[20.06 + i * .04, 3.0, -9.7], [20.06 + i * .04, 3.005, -7.1], [20.06 + i * .04, 3.0, -4.5]], .016, 7);
  // Black supply lead looping off the rafter above 3호 (04:20).
  k.cable(shell, 'rubber', [[18.22, 1.90, -6.92], [18.10, 2.5, -6.80], [17.98, 3.15, -6.78], [18.02, 3.46, -6.78], [18.35, 3.48, -6.78], [18.9, 3.28, -6.78], [19.5, 3.14, -6.78], [20.0, 3.04, -6.80]], .030, 10);
  cabinet(low, [.12, .36, .24], [22.06, 1.66, -6.05], '-x', 'cream', { lamps: 3, handle: .5 }); for (let i = 0; i < 3; i++) k.cable(low, 'rubber', [[22.06, 1.48, -6.0 - i * .04], [22.07, 1.1, -6.0 - i * .03], [22.06, .6, -5.95 - i * .06], [21.9, .25, -5.8]], .014, 7);
  // Chiller water pipework off the east wall (photos 064, 068).
  k.pipe(low, 'brownPipe', [[22.1, 1.32, -4.72], [21.72, 1.32, -4.72], [21.30, 1.32, -4.86]], .042, { bend: .08, collar: 'iron' }); k.pipe(low, 'iron', [[21.98, 1.32, -4.72], [21.98, 1.22, -4.72], [21.98, .12, -4.72]], .030, {}); flangePair(low, [21.5, 1.32, -4.79], 'x', .085, 'cream', .04, 6);
  for (const [x, z0, z1, y] of [[21.95, -6.9, -4.1, .30], [21.85, -6.95, -4.0, .16]]) k.pipe(low, 'iron', [[x, y, z0], [x, y, z1]], .05, {}); k.pipe(low, 'cream', [[20.75, .16, -6.85], [20.75, .16, -4.2]], .03, {});
  k.pipe(low, 'cream', [[21.36, .44, -6.30], [21.36, .44, -6.72], [21.36, .44, -6.95]], .085, { seg: 18 }); flangePair(low, [21.36, .44, -6.52], 'z', .145, 'iron', .03, 8); gauge(low, [20.94, 1.02, -6.55], '-x', .075); k.pipe(low, 'brownPipe', [[20.96, 1.0, -6.55], [20.96, .6, -6.55], [21.3, .46, -6.55]], .014, {});
  // Screw body stays insulated in cream with lagging bands and white lid box.
  k.soft(low, 'cream', [.30, .16, .52], [21.2, 1.32, -4.86], null, .015); k.cable(low, 'cream', [[21.06, 1.36, -4.62], [20.98, 1.46, -4.7], [20.96, 1.42, -5.0], [20.96, 1.3, -5.25]], .022, 9);
  for (const [a, b] of [[[20.6, .05, -4.2], [20.95, .55, -4.7]], [[20.5, .04, -6.6], [20.7, .04, -4.4]]]) k.rod(low, 'white', a, b, .018, 8);
  k.cable(low, 'greenHose', [[20.2, .03, -6.4], [20.45, .03, -6.0], [20.35, .03, -5.5], [20.7, .03, -5.1]], .012, 7);

  // --- 14. upright dryer, HAT-100 receiver, navy filters (photos 048–058) ---
  const dark = room.getObjectByName('comp-dryer-jemaco-dark');
  for (const node of dark.children) if (node.name === 'dark-dryer-inline-filter') { node.visible = false; node.userData.personCollision = false; }
  const fx0 = 18.66;
  k.pipe(low, 'iron', [[18.55, 1.86, -5.27], [18.55, 1.86, -5.1], [fx0, 1.86, -5.0]], .042, { collar: 'iron' }); ballValve(low, [18.56, 1.86, -5.16], 'z', .042, 'y', 'orange', 'iron', .16); navyFilter(low, [fx0, 1.86, -4.83], 'z'); printed(s, low, 'site-hat100-card', [.20, .15], [18.46, 1.77, -5.12], -HALF, inspectionCard, { px: 420, elevation: Y, roll: .12 });
  k.pipe(low, 'galv', [[18.55, 1.86, -5.2], [18.55, 2.65, -5.2]], .042, { collar: 'fitting' });
  k.pipe(low, 'galv', [[fx0, 1.86, -4.68], [fx0, 1.86, -4.58], [fx0, 2.12, -4.58], [fx0, 2.12, -4.14], [19.36, 2.12, -4.14], [19.36, .64, -4.14], [19.22, .64, -4.14]], .045, { bend: .075, collar: 'fitting' }); flow(low, [fx0, 2.12, -4.36], 'z', '-x', .045);
  k.pipe(low, 'galv', [[19.22, .84, -4.46], [19.38, .84, -4.46], [19.38, 1.86, -4.46], [fx0, 1.86, -4.46], [fx0, 1.86, -4.16]], .045, { bend: .075, collar: 'fitting' }); flow(low, [fx0, 1.86, -4.30], 'z', '-x', .045); k.pipe(low, 'rubber', [[19.40, 1.9, -4.32], [19.40, .9, -4.32], [19.24, .5, -4.3]], .022, {});
  navyFilter(low, [fx0, 1.86, -4.03], 'z', { drain: 'bowl' }); k.cyl(low, 'iron', .052, .09, [fx0, 1.86, -3.865], 'z', 6); navyFilter(low, [fx0, 1.86, -3.70], 'z', { drain: 'bowl' });
  // Out of the last filter, up beside the door and over the frame (01:42).
  k.pipe(low, 'iron', [[fx0, 1.86, -3.56], [fx0, 1.86, -3.54], [18.06, 1.86, -3.54], [18.06, 2.44, -3.56], [18.06, 2.74, -3.58], [15.2, 2.74, -3.60], [14.9, 2.86, -3.60], [13.95, 2.86, -3.70]], .036, { bend: .07, collar: 'fitting' });
  k.soft(low, 'white', [.07, .13, .05], [18.25, 1.42, -3.50], null, .01); k.pipe(low, 'rubber', [[18.35, .1, -3.55], [18.35, 2.5, -3.52]], .014, {}); k.cable(low, 'orange', [[18.75, 1.6, -3.52], [18.85, 1.4, -3.56], [18.7, 1.2, -3.52]], .005, 6);
  // Dryer display, yellow warning and caption faces.
  printed(s, low, 'site-dryer-display', [.15, .045], [17.938, .80, -4.30], -HALF, (c, w, h) => { c.fillStyle = '#0d1016'; c.fillRect(0, 0, w, h); c.shadowColor = '#4d6bff'; c.shadowBlur = 6; inkText(c, '⚙ ❄ ⟳', w * .34, h * .52, `700 ${h * .42}px Arial`, '#5a78ff'); inkText(c, '6.8', w * .66, h * .54, `700 ${h * .62}px monospace`, '#f2f6ff'); c.fillStyle = '#e8e8e8'; for (const y of [.32, .7]) { c.beginPath(); c.arc(w * .9, h * y, h * .12, 0, 7); c.fill(); } }, { px: 256, elevation: Y, rough: .25 });
  printed(s, low, 'site-receiver-seal', [.09, .12], [18.085, 1.60, -5.80], -HALF, (c, w, h) => { c.fillStyle = '#eef0ec'; c.fillRect(0, 0, w, h * .45); c.fillStyle = '#2f8d56'; c.fillRect(0, 0, w, h * .12); c.fillStyle = '#e2cf35'; c.fillRect(0, h * .55, w, h * .45); c.fillStyle = '#4b4b3a'; for (let i = 0; i < 4; i++) c.fillRect(w * .1, h * (.62 + i * .09), w * .8, 2); }, { px: 96, elevation: Y });
  // 3호 → HAT-100 discharge at the floor, both flanged ends (02:28, 02:34).
  k.pipe(low, 'silver', [[18.28, .20, -6.88], [18.28, .16, -6.56], [18.86, .16, -6.56], [18.86, .36, -6.50], [18.86, 1.0, -6.50]], .042, { bend: .10, weld: 'fitting' });
  flangePair(low, [18.46, .16, -6.56], 'x', .085, 'brownPipe', .03, 6); k.cyl(low, 'stainless', .048, .16, [18.57, .16, -6.56], 'x', 16); flangePair(low, [18.68, .16, -6.56], 'x', .085, 'brownPipe', .03, 6);
  ballValve(low, [18.86, .72, -6.50], 'y', .040, '-x', 'orange', 'iron', .16); ballValve(low, [18.80, .52, -6.50], 'x', .016, 'y', 'fitting', 'iron', .07); flow(low, [18.86, 1.12, -6.50], 'y', '-x', .042);
  k.pipe(low, 'silver', [[18.86, .95, -6.50], [18.86, 1.86, -6.50], [19.12, 1.86, -6.30], [19.12, 1.86, -5.72], [18.96, 1.86, -5.72]], .042, { bend: .11, weld: 'fitting' });
  k.soft(low, 'arrow', [.03, .035, .06], [18.12, .19, -6.88], null, .004);
  k.cable(low, 'black', [[18.0, .03, -7.2], [17.9, .02, -6.6], [17.95, .02, -5.9], [18.1, .02, -5.1], [18.3, .02, -4.7]], .010, 6);
  for (let i = 0; i < 4; i++) { const a = i * HALF + .6; k.box(low, 'iron', [.10, .16, .014], [18.55 + Math.cos(a) * .48, .09, -5.72 + Math.sin(a) * .48], [0, -a, 0]); const R = .58; k.box(low, 'cream', [.12, .16, .014], [14.55 + Math.cos(a) * R, .09, -9.25 + Math.sin(a) * R], [0, -a, 0]); }

  // --- 15. circulation pump corner (photo 033, 02:50) ----------------------
  k.pipe(low, 'greyPvc', [[21.50, 1.64, -9.06], [21.50, 1.64, -9.20], [21.50, .36, -9.20], [21.28, .36, -9.26]], .026, { bend: .05, collar: 'greyPvc' }); k.cable(low, 'tealHose', [[20.92, 1.55, -9.10], [20.912, 1.0, -9.112], [20.92, .42, -9.10]], .012, 8); for (const y of [.43, 1.54]) k.soft(low, 'fitting', [.05, .05, .06], [20.92, y, -9.08], null, .01);
  flangePair(low, [21.2, .86, -9.695], 'y', .10, 'brownPipe', .03, 8); k.ball(low, 'fitting', [.07, .075, .07], [21.2, .70, -9.695]); k.rod(low, 'fitting', [21.14, .72, -9.695], [21.04, .78, -9.695], .012, 8); k.box(low, 'brownPipe', [.12, .016, .03], [21.02, .79, -9.695], [0, 0, .3]); k.pipe(low, 'fitting', [[21.2, .62, -9.695], [21.2, .42, -9.695], [21.2, .42, -9.6]], .05, { bend: .06, collar: 'brownPipe' });
  gauge(low, [21.10, 1.18, -9.78], '-x', .075); k.ring(low, 'iron', .10, .010, [21.08, 1.42, -9.76], [0, HALF, 0]); k.pipe(low, 'brownPipe', [[21.16, 1.62, -9.72], [21.06, 1.62, -9.76], [21.06, 1.25, -9.78]], .012, { bend: .03 }); ballValve(low, [21.12, 1.62, -9.74], 'x', .014, 'y', 'orange', 'fitting', .06);
  k.soft(low, 'black', [.10, .10, .05], [21.3, .80, -9.36], null, .012); k.cable(low, 'black', [[21.34, .78, -9.34], [21.5, .5, -9.3], [21.6, .1, -9.3], [21.9, .05, -9.6]], .010, 7);

  // --- 15b. extraction ducts (photos 010, 011, 018, 034, 037, 02:16, 04:22) ---
  for (const id of ['comp-unit-1-kaeser-csd125sfc', 'comp-unit-2-kaeser-bsd72', 'comp-unit-3-kaeser-csd125']) { const node = room.getObjectByName(id + '-exhaust-duct'); if (node) { node.visible = false; node.userData.personCollision = false; } }
  const ducts = group(low, 'survey-north-galvanized-ductwork', { sourcePhotoNumbers: [10, 11, 18, 32, 34, 37], sourceTimesSeconds: [136, 149, 166, 171, 193, 254, 262] });
  const D0 = 2.08, D1 = 2.74, DM = (D0 + D1) / 2, DH = D1 - D0;
  const frame = (axis, at, a, b) => { // flange of rolled angle around a duct section
    const [x, y, z] = at;
    if (axis === 'x') { for (const s1 of [-1, 1]) { k.box(ducts, 'ductEdge', [.034, .03, b + .06], [x, y + s1 * (a / 2 + .012), z]); k.box(ducts, 'ductEdge', [.034, a + .06, .03], [x, y, z + s1 * (b / 2 + .012)]); } }
    else if (axis === 'z') { for (const s1 of [-1, 1]) { k.box(ducts, 'ductEdge', [b + .06, .03, .034], [x, y + s1 * (a / 2 + .012), z]); k.box(ducts, 'ductEdge', [.03, a + .06, .034], [x + s1 * (b / 2 + .012), y, z]); } }
    else { for (const s1 of [-1, 1]) { k.box(ducts, 'ductEdge', [a + .06, .034, .03], [x, y, z + s1 * (b / 2 + .012)]); k.box(ducts, 'ductEdge', [.03, .034, b + .06], [x + s1 * (a / 2 + .012), y, z]); } }
  };
  const elbow = (key, inner, outer, depth) => () => { const o = new THREE.Shape(); o.absarc(0, 0, outer, 0, HALF, false); o.lineTo(0, inner); o.absarc(0, 0, inner, HALF, 0, true); o.closePath(); return new THREE.ExtrudeGeometry(o, { depth, curveSegments: 12, bevelEnabled: false }); };
  const seams = (axis, from, to, step, at, a, b) => { for (let v = from + step; v < to - .1; v += step) axis === 'x' ? k.box(ducts, 'ductSeam', [.006, a + .006, b + .006], [v, at[1], at[2]]) : k.box(ducts, 'ductSeam', [b + .006, a + .006, .006], [at[0], at[1], v]); };
  // 1호: louvred south end, long box over the cabinet, horizontal bend to the trunk.
  const c1x = 14.76; k.box(ducts, 'duct', [.66, DH, 1.60], [c1x, DM, -10.96]); seams('z', -11.76, -10.16, .40, [c1x, DM, 0], DH, .66); k.box(ducts, 'galv', [.78, .12, 1.36], [c1x, 2.02, -11.02]); frame('z', [c1x, DM, -11.60], DH, .66);
  k.shape(ducts, 'duct', 'c1-bend', elbow('c1', .06, .72, DH), [15.15, D1, -11.76], [HALF, 0, Math.PI]);
  k.box(ducts, 'duct', [6.78, DH, .66], [18.54, DM, -12.15]); seams('x', 15.15, 21.93, .62, [0, DM, -12.15], DH, .66); for (const x of [15.22, 17.1, 19.0, 20.9]) frame('x', [x, DM, -12.15], DH, .66);
  k.box(ducts, 'gap', [.60, DH - .06, .01], [c1x, DM, -10.158]); frame('z', [c1x, DM, -10.15], DH, .66); k.box(ducts, 'duct', [.70, .03, .16], [c1x, D1 + .02, -10.10]); k.box(ducts, 'duct', [.70, .03, .16], [c1x, D0 - .02, -10.10]); for (const s1 of [-1, 1]) k.box(ducts, 'duct', [.024, DH + .06, .16], [c1x + s1 * .34, DM, -10.10]);
  for (let i = 0; i < 7; i++) k.box(ducts, 'duct', [.64, .10, .010], [c1x, D0 + .06 + i * .092, -10.10], [.75, 0, 0]);
  // 2호: square riser and rolled bend towards the east, over 4호 to the wall.
  const r2 = [18.64, -10.72]; k.box(ducts, 'duct', [.66, .36, .62], [r2[0], 1.86, r2[1]]); frame('y', [r2[0], 2.03, r2[1]], .66, .62);
  k.shape(ducts, 'duct', 'c2-bend', elbow('c2', .05, .71, .62), [19.02, 2.04, r2[1] + .31], [0, Math.PI, 0]);
  k.box(ducts, 'duct', [2.92, .66, .62], [20.48, 2.42, r2[1]]); seams('x', 19.02, 21.94, .55, [0, 2.42, r2[1]], .66, .62); for (const x of [19.06, 20.35]) frame('x', [x, 2.42, r2[1]], .66, .62); frame('x', [21.6, 2.42, r2[1]], .66, .62);
  // 3호: riser into the flanged box that crosses above the water tank.
  k.box(ducts, 'duct', [.60, .44, .58], [18.66, 2.12, -7.72]); frame('y', [18.66, 1.93, -7.72], .60, .58); k.box(ducts, 'duct', [3.76, .56, .62], [20.02, 2.58, -7.72]); seams('x', 18.14, 21.9, .60, [0, 2.58, -7.72], .56, .62);
  for (const x of [18.16, 18.30, 19.02, 19.16, 20.5]) frame('x', [x, 2.58, -7.72], .56, .62); k.box(ducts, 'duct', [.5, .62, .70], [21.86, 2.55, -7.72]); frame('x', [21.6, 2.56, -7.72], .62, .70);
  for (const [x, z] of [[16.2, -12.15], [18.1, -12.15], [20.2, -12.15], [20.0, -10.72], [21.2, -10.72], [19.4, -7.72], [20.8, -7.72]]) for (const s1 of [-1, 1]) { k.rod(ducts, 'strut', [x, D1 - .02, z + s1 * .37], [x, ceiling(x) - .1, z + s1 * .37], .006, 6); }

  // --- 16. K2 POWER cabinet: open bay door, south card face (02:52, 03:42) ---
  const cream4 = 'cream';
  k.soft(low, cream4, [.70, 1.50, .030], [20.12, 1.02, -10.35], null, .008); k.box(low, 'foam', [.64, 1.42, .012], [20.12, 1.02, -10.374]); for (const y of [.45, 1.60]) k.rod(low, 'fitting', [20.47, y - .06, -10.35], [20.47, y + .06, -10.35], .014, 8); k.cyl(low, 'black', .016, .02, [19.84, 1.05, -10.33], 'z', 10);
  printed(s, low, 'site-k50-door-mark', [.22, .075], [20.30, 1.66, -10.333], 0, (c, w, h) => { c.clearRect(0, 0, w, h); inkText(c, 'K50', w / 2, h / 2, `800 ${h * .86}px Arial`, '#3a3d42'); }, { px: 192, elevation: Y, clear: true });
  printed(s, low, 'site-k50-notice', [.16, .44], [19.98, 1.46, -10.333], 0, (c, w, h) => { c.fillStyle = '#ece8da'; c.fillRect(0, 0, w, h); c.fillStyle = '#8b8778'; for (let i = 0; i < 22; i++) c.fillRect(w * .1, h * (.05 + i * .042), w * (.5 + .34 * hash(i, 1)), 2); }, { px: 120, elevation: Y });
  k.soft(low, cream4, [1.22, 1.5, .02], [21.1, 1.02, -10.345], null, .008); k.box(low, 'gap', [.008, 1.46, .006], [20.92, 1.02, -10.333]);
  const k50 = room.getObjectByName('comp-unit-4-k2power-k50'); for (const node of k50.children) if (node.name === 'k50-gauge') { node.visible = false; node.userData.personCollision = false; }
  printed(s, low, 'site-k50-panel', [.60, .345], [20.437, 1.38, -11.55], -HALF, (c, w, h) => {
    c.fillStyle = '#17191c'; c.fillRect(0, 0, w, h); c.strokeStyle = '#8d9296'; c.lineWidth = w * .005; c.strokeRect(w * .05, h * .08, w * .62, h * .36); c.strokeRect(w * .05, h * .50, w * .62, h * .42); c.strokeRect(w * .71, h * .08, w * .24, h * .36); c.strokeRect(w * .71, h * .50, w * .24, h * .42);
    c.fillStyle = '#c0392b'; c.beginPath(); c.moveTo(w * .08, h * .20); c.lineTo(w * .105, h * .12); c.lineTo(w * .13, h * .20); c.fill(); inkText(c, 'K2power', w * .205, h * .165, `italic 700 ${h * .075}px Arial`, '#e9ecee');
    const lamps = ['EMERGENCY STOP', 'FAN MOTOR OVER LOAD', 'OIL TEMPERATURE HIGH', 'REVERSE ROTATION', 'MAIN MOTOR OVER LOAD', 'C.W. WATER DIFF. PRESS.'];
    for (let i = 0; i < 6; i++) { const x = w * (.08 + (i % 2) * .21), y = h * (.26 + (i >> 1) * .065); c.strokeStyle = '#aab0b4'; c.lineWidth = 1.5; c.beginPath(); c.arc(x, y, h * .016, 0, 7); c.stroke(); inkText(c, lamps[i], x + w * .015, y, `500 ${h * .030}px Arial`, '#c9ced2', 'left'); }
    inkText(c, 'HOUR METER', w * .59, h * .18, `600 ${h * .035}px Arial`, '#cfd4d8'); c.fillStyle = '#0b0c0d'; c.fillRect(w * .52, h * .22, w * .14, h * .11); c.strokeRect(w * .52, h * .22, w * .14, h * .11);
    const captions = ['DISCHARGE PRESS.', 'SEPARATOR PRESS.', 'OIL TEMPERATURE'];
    for (const [i, x] of [.16, .36, .56].entries()) {
      const X = w * x, yy = h * .70, r = h * .135; c.fillStyle = '#c9cdd0'; c.beginPath(); c.arc(X, yy, r * 1.12, 0, 7); c.fill(); c.fillStyle = i === 2 ? '#2c3338' : '#2f6ea6'; c.beginPath(); c.arc(X, yy, r, 0, 7); c.fill(); c.fillStyle = '#12181d'; c.beginPath(); c.arc(X, yy, r * .55, 0, 7); c.fill();
      c.strokeStyle = '#eef2f5'; c.lineWidth = 2; for (let q = 0; q < 11; q++) { const a = 2.35 + q * .471; c.beginPath(); c.moveTo(X + Math.cos(a) * r * .92, yy + Math.sin(a) * r * .92); c.lineTo(X + Math.cos(a) * r * .74, yy + Math.sin(a) * r * .74); c.stroke(); }
      c.strokeStyle = '#ff8a3c'; c.lineWidth = 3; c.beginPath(); c.moveTo(X, yy); c.lineTo(X + Math.cos(4.1 + i) * r * .7, yy + Math.sin(4.1 + i) * r * .7); c.stroke(); inkText(c, captions[i], X, h * .88, `600 ${h * .030}px Arial`, '#d2d7da');
    }
    c.fillStyle = '#d8b32c'; c.beginPath(); c.arc(w * .83, h * .26, h * .15, 0, 7); c.fill(); inkText(c, 'EMERGENCY', w * .83, h * .15, `700 ${h * .032}px Arial`, '#222'); inkText(c, 'STOP', w * .83, h * .375, `700 ${h * .036}px Arial`, '#222');
    c.fillStyle = '#b9bdc0'; c.fillRect(w * .755, h * .56, w * .15, h * .30); c.fillStyle = '#17191c'; c.beginPath(); c.arc(w * .83, h * .72, h * .09, 0, 7); c.fill();
  }, { px: 640, elevation: Y, rough: .45 });
  k.cyl(low, 'red', .034, .05, [20.415, 1.463, -11.352], 'x', 20); k.cyl(low, 'black', .026, .05, [20.415, 1.305, -11.352], 'x', 16); k.box(low, 'gap', [.004, .008, .92], [20.455, 1.175, -11.60]); for (const z of [-12.0, -11.2]) k.cyl(low, 'fitting', .010, .02, [20.45, 1.13, z], 'x', 10);
  printed(s, low, 'site-k50-notice-white', [.11, .075], [20.4445, 1.055, -11.42], -HALF, (c, w, h) => { c.fillStyle = '#f1f0ea'; c.fillRect(0, 0, w, h); c.strokeStyle = '#555'; c.strokeRect(2, 2, w - 4, h - 4); inkText(c, '주  의', w / 2, h * .2, `700 ${h * .18}px "Malgun Gothic"`); c.fillStyle = '#777'; for (let i = 0; i < 4; i++) c.fillRect(w * .1, h * (.4 + i * .13), w * .8, 2); }, { px: 110, elevation: Y });
  // HL350K drying panel and lettering (photos 091, 092).
  printed(s, low, 'site-hl350-mimic', [.186, .168], [14.7175, 1.468, -4.15], HALF, (c, w, h) => {
    c.fillStyle = '#22262b'; c.fillRect(0, 0, w, h); c.strokeStyle = '#33393f'; c.strokeRect(2, 2, w - 4, h - 4);
    for (const x of [.30, .60]) { c.fillStyle = '#d9392f'; c.fillRect(w * x, h * .16, w * .10, h * .66); c.fillStyle = '#ff8a7e'; c.beginPath(); c.arc(w * (x + .05), h * .48, w * .018, 0, 7); c.fill(); }
    c.fillStyle = '#2fa24a'; c.fillRect(w * .07, h * .36, w * .11, h * .24); inkText(c, 'I', w * .125, h * .42, `700 ${h * .07}px Arial`, '#fff'); inkText(c, 'O', w * .125, h * .54, `700 ${h * .06}px Arial`, '#fff');
    c.strokeStyle = '#cfd5d9'; c.lineWidth = 1.5; for (const y of [.26, .48, .74]) { c.strokeRect(w * .46, h * y, w * .09, h * .07); c.beginPath(); c.moveTo(w * .41, h * (y + .035)); c.lineTo(w * .46, h * (y + .035)); c.moveTo(w * .55, h * (y + .035)); c.lineTo(w * .60, h * (y + .035)); c.stroke(); } c.beginPath(); c.moveTo(w * .505, h * .12); c.lineTo(w * .505, h * .88); c.stroke();
    for (const y of [.32, .66]) { c.fillStyle = '#c8cdd1'; c.beginPath(); c.arc(w * .85, h * y, w * .035, 0, 7); c.fill(); inkText(c, y < .5 ? 'DRYING TIME' : 'REPRESS. TIME', w * .85, h * (y + .12), `600 ${h * .045}px Arial`, '#d9dee1'); }
  }, { px: 256, elevation: Y, rough: .5 });
  printed(s, low, 'site-hl350-spx', [.13, .045], [14.698, .36, -4.15], HALF, (c, w, h) => { c.clearRect(0, 0, w, h); inkText(c, 'SPX', w / 2, h / 2, `italic 800 ${h * .9}px Arial`, '#e6e9e0'); }, { px: 160, elevation: Y, clear: true });
  // HX601K switch strip (02:07).
  printed(s, low, 'site-hx601-strip', [.31, .046], [15.334, .8165, -6.92], HALF, (c, w, h) => { c.fillStyle = '#6d747b'; c.fillRect(0, 0, w, h); c.fillStyle = '#1f9b45'; c.fillRect(w * .08, h * .2, w * .09, h * .6); c.fillStyle = '#e2542c'; c.fillRect(w * .20, h * .4, w * .03, h * .25); c.fillStyle = '#e8ebee'; for (let i = 0; i < 5; i++) c.fillRect(w * (.34 + i * .12), h * .35, w * .05, h * .28); }, { px: 256, elevation: Y, pitch: -HALF });
  printed(s, low, 'site-k50-front-mark', [.40, .075], [20.444, .40, -11.5], -HALF, (c, w, h) => { c.clearRect(0, 0, w, h); c.fillStyle = '#23282c'; c.beginPath(); c.moveTo(w * .02, h * .85); c.lineTo(w * .10, h * .15); c.lineTo(w * .16, h * .85); c.fill(); inkText(c, 'K2power', w * .58, h * .52, `italic 800 ${h * .8}px Arial`, '#23282c'); }, { px: 320, elevation: Y, clear: true });
  printed(s, low, 'site-k50-log', [.19, .30], [20.435, 1.50, -11.17], -HALF, (c, w, h) => { c.fillStyle = '#e0cd37'; c.fillRect(0, 0, w, h); c.fillStyle = '#f4f2ea'; c.fillRect(w * .06, h * .04, w * .88, h * .92); c.fillStyle = '#a6a69a'; for (let i = 0; i < 14; i++) c.fillRect(w * .12, h * (.10 + i * .06), w * .74, 1.5); }, { px: 128, elevation: Y });
  printed(s, low, 'site-k50-warning', [.11, .07], [20.445, 1.06, -11.62], -HALF, (c, w, h) => { c.fillStyle = '#eacb2e'; c.fillRect(0, 0, w, h); inkText(c, '⚡', w * .18, h * .5, `700 ${h * .6}px Arial`); c.fillStyle = '#333'; for (let i = 0; i < 4; i++) c.fillRect(w * .36, h * (.2 + i * .18), w * .55, 2); }, { px: 128, elevation: Y });

  // --- 17. loose items seen on the day ------------------------------------
  // Removed 1호 frame panel leaning on the west wall (photo 010).
  for (const [size, at] of [[[.03, 1.62, .06], [13.79, .80, -11.02]], [[.03, 1.62, .06], [13.79, .80, -11.62]], [[.03, .08, .66], [13.69, 1.57, -11.32]], [[.03, .60, .60], [13.86, .34, -11.32]]]) k.box(loose, 'teal', size, at, [0, 0, .12]);
  // Duct section and wrapped pedestal fan in the north corridor (03:18).
  k.soft(loose, 'duct', [.92, .78, .40], [19.25, .40, -12.30], [0, .10, 0], .008); for (const y of [.20, .56]) k.box(loose, 'strut', [.93, .012, .41], [19.25, y, -12.30], [0, .10, 0]); k.box(loose, 'strut', [.02, .86, .46], [18.79, .43, -12.26], [0, .10, 0]);
  const fx = 20.35, fz = -12.5; k.cyl(loose, 'white', .20, .03, [fx, .02, fz], 'y', 26); k.cyl(loose, 'white', .022, .95, [fx, .48, fz]); k.cyl(loose, 'white', .07, .20, [fx, 1.0, fz], 'x'); for (const [off, r] of [[-.06, .31], [-.10, .24], [-.10, .16], [-.10, .08]]) k.ring(loose, 'white', r, .006, [fx + off, 1.0, fz], [0, HALF, 0], 34); for (let i = 0; i < 28; i++) { const a = i * Math.PI / 14; k.rod(loose, 'white', [fx - .10, 1.0 + Math.sin(a) * .06, fz + Math.cos(a) * .06], [fx - .055, 1.0 + Math.sin(a) * .31, fz + Math.cos(a) * .31], .003, 5); } for (let i = 0; i < 3; i++) { const a = i * 2.094; k.ball(loose, 'fanOrange', [.012, .13, .09], [fx - .05, 1.0 + Math.sin(a) * .15, fz + Math.cos(a) * .15], [a, 0, 0]); } k.ball(loose, 'film', [.13, .33, .33], [fx - .05, 1.0, fz]);
  // Black suction hose from the 2호 end to the duct (03:18).
  k.cable(loose, 'rubber', [[18.95, .30, -11.36], [19.2, .22, -11.55], [19.45, .07, -11.75], [19.7, .06, -12.2], [20.0, .06, -12.35]], .034, 10); k.box(loose, 'concrete', [.34, .03, .28], [19.15, .02, -11.62], [0, .3, 0]);
  // By the upright dryer: bucket, sack, folded cartons (photos 055–057).
  k.lathe(loose, 'plastic', 'bucket', [[0, .005], [.125, .005], [.135, .02], [.158, .345], [.168, .35], [.168, .37], [.150, .37], [.128, .02], [0, .02]], [17.78, 0, -3.82]); k.ring(loose, 'white', .162, .006, [17.78, .31, -3.82], [HALF, 0, 0]); k.ball(loose, 'film', [.13, .12, .13], [17.78, .36, -3.82]);
  for (let i = 0; i < 5; i++) k.box(loose, i % 2 ? 'cardboardDark' : 'cardboard', [.012, 1.05, .62], [18.62 + i * .016, .52, -3.60], [.0, HALF + .03 * i, 0]); k.box(loose, 'cardboard', [.5, .03, .4], [18.3, .10, -3.72], [.22, .3, -.1]); k.ball(loose, 'fanOrange', [.14, .17, .11], [18.4, .26, -3.62]); k.ball(loose, 'film', [.2, .13, .18], [19.35, .12, -3.85]); k.box(loose, 'lampGreen', [.22, .06, .10], [18.66, 1.08, -3.56]);
  k.lathe(loose, 'cardboardDark', 'drum', [[0, 0], [.2, 0], [.22, .03], [.22, .03], [.2, .06], [0, .06]], [18.04, .28, -3.74], [HALF, 0, 0]);
  // By the blue towers: oil can and grey plastic pallet (photos 090, 095).
  k.soft(loose, 'jerry', [.17, .24, .12], [14.28, .13, -4.98], [0, .5, 0], .03); k.cyl(loose, 'jerry', .025, .04, [14.25, .27, -4.95]);
  for (let i = 0; i < 6; i++) k.box(loose, 'palletGrey', [.036, .44, .028], [15.1 + i * .075, .24, -3.82], [-.25, 0, 0]); for (let i = 0; i < 5; i++) k.box(loose, 'palletGrey', [.44, .026, .03], [15.29, .06 + i * .10, -3.77 - i * .022]);
  k.cable(loose, 'greenHose', Array.from({ length: 26 }, (_, i) => { const a = i * .9; return [14.15 + Math.cos(a) * (.13 + i * .002), .02 + i * .003, -10.2 + Math.sin(a) * .10]; }), .011, 7);
  k.ball(loose, 'film', [.16, .12, .2], [20.72, .12, -4.6]);

  const stray = room.getObjectByName('hx601-rear-filter'); if (stray) { stray.visible = false; stray.userData.personCollision = false; }
  // Each powder coat has its own tone under the same lamps (photos 055, 070, 076, 091).
  const coat = (names, color, rough, metal = .12) => {
    const material = s._material(color, rough, metal);
    for (const name of names) room.traverse(node => { if (node.isMesh && node.name === name) node.material = material; });
    return material;
  };
  coat(['hx601-body'], 0x656d75, .58); coat(['dark-dryer-body'], 0x596067, .50); coat(['jac100-body'], 0x2f3231, .62); coat(['ows-tank'], 0x414446, .74, .02); coat(['spx-center-console'], 0x3a4249, .40);
  coat(['hx601-blue-front', 'spx-blue-tower', 'spx-blue-foot'], 0x1b94cf, .24, .05);
  // Receiver paint: silver-grey with dust on the head and chips low down (044–048),
  // pale cream silver with water runs on the 2 m3 vessel (050–054).
  const vesselTexture = (name, base, dust, chips, runs) => dataTexture(s, name, fine ? 320 : 8, fine ? 320 : 8, (u, v) => {
    const wrap = Math.min(u, 1 - u) < .05 ? Math.min(u, 1 - u) / .05 : 1, n = (fbm(u * 9, v * 6, 4) - .5) * wrap, streak = smooth(.62, .85, noise(u * 46, v * 1.3)) * runs * wrap * smooth(.1, .5, v);
    let c = blend(base, [base[0] * .86, base[1] * .86, base[2] * .85], smooth(.1, .5, n + .25));
    c = blend(c, dust, smooth(.86, .99, v) * .55); c = blend(c, [base[0] * .6, base[1] * .58, base[2] * .54], streak * .5);
    c = blend(c, [86, 58, 46], smooth(.80, .86, noise(u * 170, v * 130)) * smooth(.27, .05, v) * smooth(.42, .6, fbm(u * 11, v * 9)) * chips); c = blend(c, [112, 104, 92], smooth(.10, .0, v) * .5);
    return c;
  }, { repeat: true });
  const hat = s._material(0xffffff, .52, .30, { map: vesselTexture('compressor-hat100-paint', [178, 180, 176], [150, 126, 92], .85, .25) });
  const yujin = s._material(0xffffff, .40, .34, { map: vesselTexture('compressor-yujin-paint', [206, 204, 194], [186, 178, 158], .15, .8) });
  const vessel = s._material(0xffffff, .60, .16, { map: vesselTexture('compressor-ps600-paint', [188, 182, 171], [138, 122, 98], .3, .3) });
  for (const [id, paint] of [['comp-receiver-1', hat], ['comp-receiver-2', yujin]]) room.getObjectByName(id).traverse(node => { if (node.isMesh && [shared.tankGray, shared.tankLight].includes(node.material)) node.material = paint; });
  const hatHead = s._material(0x9d907b, .78, .06), yujinHead = s._material(0xc9c7bd, .44, .28);
  for (const [id, paint] of [['comp-receiver-1', hatHead], ['comp-receiver-2', yujinHead]]) { const head = room.getObjectByName(id + '-dome'); if (head) head.material = paint; }
  room.getObjectByName('comp-dryer-ps600k').traverse(node => { if (node.isMesh && node.material === shared.tankGray) node.material = vessel; });
  coat(['ps600-ctrl-box'], 0xb0ada1, .5); room.getObjectByName('ps600-ctrl-box').position.y = 1.14;
  for (const node of ps.children) if (node.name === 'ps600-gauge') node.position.y = 1.64;
  printed(s, low, 'site-ps600-team', [.10, .06], [15.094, 1.20, -5.74], HALF, (c, w, h) => { c.clearRect(0, 0, w, h); inkText(c, '2팀', w / 2, h / 2, `700 ${h * .7}px "Malgun Gothic"`, '#2a2f36'); }, { px: 96, elevation: Y, clear: true });
  printed(s, low, 'site-ps600-warning', [.085, .13], [15.094, .98, -5.45], HALF, (c, w, h) => { c.fillStyle = '#e6d74a'; c.fillRect(0, 0, w, h * .22); inkText(c, '⚠DANGER', w / 2, h * .12, `800 ${h * .10}px Arial`); c.fillStyle = '#f2f1e8'; c.fillRect(0, h * .22, w, h * .38); c.strokeStyle = '#222'; c.lineWidth = 3; c.beginPath(); c.moveTo(w * .3, h * .55); c.lineTo(w * .5, h * .34); c.lineTo(w * .7, h * .48); c.stroke(); c.fillStyle = '#1b1b1b'; c.fillRect(0, h * .60, w, h * .40); c.fillStyle = '#999'; for (let i = 0; i < 4; i++) c.fillRect(w * .1, h * (.66 + i * .08), w * .8, 2); }, { px: 110, elevation: Y });
  shared.brushedCladding.color.setHex(0xc9cbc8); shared.brushedCladding.metalness = .30; shared.brushedCladding.roughness = .36;
  shared.tankLight.map = null; shared.tankLight.color.setHex(0xb9b7ab); shared.k2Beige.map = null; shared.chillerCream.map = null; shared.chillerCream.color.setHex(0xcfc8b2); for (const key of ['tankLight', 'k2Beige', 'chillerCream']) shared[key].needsUpdate = true;

  // --- KAESER lettering and SIGMA CONTROL faces (photos 011, 023–025, 038, 040) ---
  const mark = (unit, text, size, at, vertical = false, ink = '#23282b') => printed(s, unit, 'site-cabinet-mark', vertical ? [size[1], size[0]] : size, at, 0, (c, w, h) => {
    c.clearRect(0, 0, w, h); c.save(); c.translate(w / 2, h / 2); if (vertical) c.rotate(-HALF);
    c.font = `800 ${(vertical ? w : h) * .92}px Arial`; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillStyle = ink; c.fillText(text, 0, 0, (vertical ? h : w) * .98); c.restore();
  }, { px: vertical ? 96 : 320, elevation: Y, clear: true });
  const sigma = (c, w, h) => {
    c.fillStyle = '#23282b'; c.fillRect(0, 0, w, h); c.fillStyle = '#4a5358'; c.fillRect(w * .20, h * .08, w * .56, h * .50);
    c.fillStyle = '#9aa083'; c.fillRect(w * .23, h * .13, w * .50, h * .40); c.fillStyle = 'rgba(40,46,36,.55)'; for (let i = 0; i < 4; i++) c.fillRect(w * .26, h * (.18 + i * .085), w * (.22 + .2 * hash(i, 6)), h * .025);
    const key = (x, y, color = '#5d666b') => { c.fillStyle = color; c.fillRect(w * x, h * y, w * .062, h * .085); };
    for (let i = 0; i < 4; i++) { key(.035, .1 + i * .14); key(.115, .1 + i * .14); } for (const [x, y] of [[.865, .08], [.80, .22], [.93, .22], [.865, .36], [.80, .50], [.93, .50]]) key(x, y);
    key(.90, .68, '#2ba04b'); key(.90, .83, '#cf3b2e'); for (const x of [.05, .17, .36, .48]) key(x, .80, '#6a747a');
    c.fillStyle = '#66e06a'; for (const [x, y] of [[.02, .72], [.02, .9], [.33, .78]]) { c.beginPath(); c.arc(w * x + 4, h * y, w * .009, 0, 7); c.fill(); } c.fillStyle = '#ff9a2b'; c.beginPath(); c.arc(w * .03, h * .30, w * .011, 0, 7); c.fill();
    inkText(c, 'KAESER', w * .33, h * .67, `800 ${h * .10}px Arial`, '#eef0f0'); inkText(c, 'SIGMA CONTROL 2', w * .68, h * .90, `700 ${h * .062}px Arial`, '#e6e8e8');
    c.strokeStyle = '#e0a51e'; c.lineWidth = w * .014; for (const r of [.03, .055, .08]) { c.beginPath(); c.arc(w * .62, h * .74, w * r, -1.2, .2); c.stroke(); }
  };
  const guide = (c, w, h) => {
    c.fillStyle = '#c62f35'; c.fillRect(0, 0, w, h); c.fillStyle = '#2b3138'; c.fillRect(w * .03, h * .05, w * .94, h * .70); c.fillStyle = '#e9ebec'; for (let r = 0; r < 2; r++) for (let i = 0; i < 4; i++) c.fillRect(w * (.05 + i * .232), h * (.10 + r * .33), w * .20, h * .06);
    c.fillStyle = '#8a97a1'; for (let r = 0; r < 2; r++) for (let i = 0; i < 4; i++) c.fillRect(w * (.09 + i * .232), h * (.20 + r * .33), w * .12, h * .13); c.fillStyle = '#fff'; c.beginPath(); c.moveTo(w * .04, h * .95); c.lineTo(w * .30, h * .95); c.lineTo(w * .14, h * .80); c.fill();
  };
  for (const [number, id, w, h, d] of [[1, 'comp-unit-1-kaeser-csd125sfc', 2.11, 1.95, 1.29], [2, 'comp-unit-2-kaeser-bsd72', 1.53, 1.70, 1.005], [3, 'comp-unit-3-kaeser-csd125', 1.76, 1.90, 1.11]]) {
    const unit = room.getObjectByName(id), z = d / 2 + .036, compact = number === 2, px = compact ? w * .145 : w * .33, py = h * .71;
    printed(s, unit, 'site-sigma-control', [.30, .215], [px, py, z + .079], 0, sigma, { px: 384, elevation: Y, rough: .4 });
    printed(s, unit, 'site-sigma-guide', [.205, .085], [px, py + (compact ? -.155 : .165), z + .070], 0, guide, { px: 256, elevation: Y, rough: .4 });
    if (!compact) {
      mark(unit, 'KAESER', [.52, .085], [-w * .445, h * .80, z + .036], true); mark(unit, number === 1 ? 'CSD 130' : 'CSD 125', [.21, .048], [-w * .235, h * .52, z + .036]); mark(unit, 'SIGMA', [.19, .046], [-w * .055, h * .52, z + .036]);
      if (number === 1) { mark(unit, 'SFC', [.17, .060], [w * .115, h * .50, z + .036]); for (const [i, color] of ['#e7b52c', '#e7b52c', '#2f9d63'].entries()) printed(s, unit, 'site-energy-label', [.075, .09], [w * .165, h * (.885 - i * .058), z + .036], 0, (c, W, H) => { c.fillStyle = '#23282b'; c.fillRect(0, 0, W, H); c.fillStyle = color; c.fillRect(W * .08, H * .08, W * .84, H * .84); inkText(c, i < 2 ? 'IE3' : '1', W / 2, H / 2, `800 ${H * .34}px Arial`, '#1d2124'); }, { px: 72, elevation: Y }); }
    }
  }
  const chiller = room.getObjectByName('comp-chiller-bumyang');
  if (chiller) {
    printed(s, chiller, 'site-chiller-brand', [.26, .085], [-.5345, 1.86, -.74], -HALF, (c, w, h) => { c.clearRect(0, 0, w, h); c.lineWidth = h * .10; c.strokeStyle = '#2f5fb0'; c.beginPath(); c.ellipse(w / 2, h / 2, w * .46, h * .38, 0, 2.6, 5.4); c.stroke(); c.strokeStyle = '#d6402f'; c.beginPath(); c.ellipse(w / 2, h / 2, w * .46, h * .38, 0, 5.6, 8.6); c.stroke(); inkText(c, '범양냉방', w / 2, h / 2 + 1, `800 ${h * .46}px "Malgun Gothic"`, '#30343a'); }, { px: 256, elevation: Y, clear: true });
    printed(s, chiller, 'site-chiller-notice', [.12, .15], [-.5345, 1.00, -.47], -HALF, (c, w, h) => { c.fillStyle = '#efd23c'; c.fillRect(0, 0, w, h); inkText(c, '운전 주의사항', w / 2, h * .10, `800 ${h * .08}px "Malgun Gothic"`); c.fillStyle = '#5b5220'; for (let i = 0; i < 11; i++) c.fillRect(w * .08, h * (.19 + i * .068), w * (.6 + .24 * hash(i, 9)), h * .018); }, { px: 128, elevation: Y });
  }

  const bsdX = 18.65, bsdZ = -9.735;
  k.soft(low, 'kaeserLeaf', [.64, 1.50, .038], [bsdX - .20, .86, bsdZ + .20], [0, -.05, 0], .012);
  for (const x of [bsdX - .50, bsdX + .10]) for (const y of [.30, 1.42]) k.rod(low, 'black', [x, y, bsdZ + .01], [x, y, bsdZ + .19], .010, 6);
  for (const [x, y] of [[bsdX - .19, 1.55], [bsdX - .46, .17], [bsdX + .06, .17]]) k.cyl(low, 'black', .014, .012, [x, y, bsdZ + .222], 'z', 12);
  const leafMark = (text, size, at, vertical) => { const node = mark(low, text, size, at, vertical); if (node) node.rotation.y = -.05; };
  leafMark('KAESER', [.56, .095], [bsdX - .445, 1.26, bsdZ + .236], true); leafMark('BSD 72', [.25, .062], [bsdX - .02, 1.13, bsdZ + .214]);
  for (const [x, y] of [[-.06, 1.47], [.02, 1.40]]) k.box(low, 'white', [.05, .014, .002], [bsdX + x, y, bsdZ + .222]);

  for (const [x, w] of [[18.065, .075], [19.235, .06]]) k.soft(low, 'kaeserLeaf', [w, 1.74, .16], [x, 1.0, -6.93], null, .012);

  // --- 18. softer cabinet edges -------------------------------------------
  // The pressed covers have rolled edges. The measured outer size is unchanged.
  for (const [name, r] of [['jac100-body', .014], ['dark-dryer-body', .022], ['hx601-body', .010], ['hx601-blue-front', .008], ['chiller-control-panel', .014], ['k50-base', .012], ['wtank-stainless-body', .010], ['ows-tank', .05]]) {
    const node = room.getObjectByName(name); if (!node) continue;
    node.geometry = unitRounded(s, node.scale, r);
  }
  for (const number of [1, 2, 3]) {
    const id = { 1: 'comp-unit-1-kaeser-csd125sfc', 2: 'comp-unit-2-kaeser-bsd72', 3: 'comp-unit-3-kaeser-csd125' }[number];
    for (const part of ['-body', '-yellow-front']) { const node = room.getObjectByName(id + part); if (node?.visible) node.geometry = unitRounded(s, node.scale, .014); }
  }

  k.flush(s, m);
  for (const material of Object.values(m)) roomLit(material, Y);
  for (const material of [floor.material, panelWall, plasterWall, ceilingMat, ...Object.values(shared)]) roomLit(material, Y);
  const door = fixtures.children.find(node => node.userData.doorId === 'compressor-room-south');
  if (door) k2(door);
  const curb = environment.deck?.getObjectByName('dryer-building-3-compressor-room-south-entry-curb'); if (curb) k2(curb);
  function k2(root) { root.traverse(node => { if (node.isMesh) roomLit(node.material, Y); }); }
  for (const root of [room, facade]) k2(root);
  // Field finishes: KAESER yellow is a warm golden powder coat in the footage.
  shared.kaeserYellow.color.setHex(0xe9b50f); shared.kaeserYellow.roughness = .40; shared.kaeserDark.color.setHex(0x2d3a3d); shared.kaeserDark.roughness = .46;
  shared.blueBright.color.setHex(0x1d9bd8); shared.blueBright.roughness = .26; shared.white.roughness = .6;
  shared.galv.roughness = .34; shared.k2Beige.color.setHex(0xd9d2bb);
  room.userData.siteFinishBuilt = true;
  return { low, shell, loose };
}

function geometryFor(s, geometry) { s.geometries.add(geometry); return geometry; }
function unitRounded(s, scale, r) {
  const geometry = roundedBox(scale.x, scale.y, scale.z, r), pos = geometry.attributes.position, nor = geometry.attributes.normal;
  for (let i = 0; i < pos.count; i++) {
    pos.setXYZ(i, pos.getX(i) / scale.x, pos.getY(i) / scale.y, pos.getZ(i) / scale.z);
    // Compensate the later inverse-scale normal transform.
    const n = new THREE.Vector3(nor.getX(i) * scale.x, nor.getY(i) * scale.y, nor.getZ(i) * scale.z).normalize();
    nor.setXYZ(i, n.x, n.y, n.z);
  }
  geometry.computeBoundingBox(); geometry.computeBoundingSphere(); s.geometries.add(geometry); return geometry;
}
