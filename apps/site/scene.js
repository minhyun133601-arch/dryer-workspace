import * as THREE from '../shared/vendor/three.module.js';
import { applyLightProfile, equipmentReflection, lightProfileFor } from './equipment-lighting.js';
import { buildFurnace } from './furnace-model.js';
import { FLOORS, FLOOR_HEIGHT, floorElevation, floorHeight } from './facility-data.js';
import { buildFacilityEquipment } from './facility-models.js';
import { buildDryerProcessEquipment } from './dryer-process-models.js';
import { buildPreparationEquipment } from './preparation-models.js';
import { buildPreparationBoilerRoom } from './boiler-models.js';
import { buildPreparationEnvironment } from './preparation-environment.js';
import { buildDryerRouteEnvironment } from './dryer-route-environment.js';
import { buildDryerCompressorEnvironment } from './dryer-compressor-environment.js';
import { buildDryerCompressorInteriorDetails } from './dryer-compressor-interior-details.js';
import { buildDryerFloor1PhotoDetail, buildDryerFloor1Load } from './dryer-floor1-photo-detail.js';
import { buildDryerUpperEnvironment, buildDryerUpperEquipment } from './dryer-upper-models.js';
import { buildDryerBuildingEnvironment, alignDryerCompressorEntrance } from './dryer-building-envelope.js';
import { OUTDOOR_ROOM } from './outdoor-data.js';
import { buildOutdoorEnvironment, buildOutdoorEquipment } from './outdoor-models.js';
import { CAMPUS_ROOM } from './campus-data.js';
import { buildCampusEnvironment, buildCampusEquipment } from './campus-models.js';
import { PACKAGING_ROOM, PACKAGING_ROOMS, PACKAGING_OVERVIEW, PACKAGING_FLOOR_ELEVATIONS } from './packaging-data.js';
import { buildPackagingEnvironment, buildPackagingEquipment } from './packaging-models.js';
import { PLACEMENT_RULES, PLACEMENT_REGIONS, constrainPlacement, toRoomPosition, fromRoomPosition, rotatedFootprint } from './placement-rules.js';
import { WALK_RULES, createPersonState, advancePerson, lookPerson, isPersonPositionFree } from './person-walk.js';
import { createProximityDoorController } from './proximity-doors.js';
import { buildPersonAvatar } from './person-avatar.js';

const TAU = Math.PI * 2;
const Y = new THREE.Vector3(0, 1, 0);
const clamp = THREE.MathUtils.clamp;

// Narrow-phase walking collision uses the rendered triangles, rather than an
// equipment group's bounding box (which can contain a real room or stair).
const personTriangle = new THREE.Triangle(), personClosest = new THREE.Vector3(), personPlane = new THREE.Plane();
const personDelta = new THREE.Vector3(), personIntersection = new THREE.Vector3();
function personSegmentDistanceSq(p, q, a, b) {
  const ux=q.x-p.x,uy=q.y-p.y,uz=q.z-p.z,vx=b.x-a.x,vy=b.y-a.y,vz=b.z-a.z,wx=p.x-a.x,wy=p.y-a.y,wz=p.z-a.z;
  const aa=ux*ux+uy*uy+uz*uz,bb=ux*vx+uy*vy+uz*vz,cc=vx*vx+vy*vy+vz*vz,dd=ux*wx+uy*wy+uz*wz,ee=vx*wx+vy*wy+vz*wz;
  if(aa<1e-14&&cc<1e-14)return wx*wx+wy*wy+wz*wz;
  let s=aa<1e-14?0:cc<1e-14?clamp(-dd/aa,0,1):Math.abs(aa*cc-bb*bb)>1e-14?clamp((bb*ee-cc*dd)/(aa*cc-bb*bb),0,1):0;
  let t=cc<1e-14?0:(bb*s+ee)/cc;
  if(t<0){t=0;s=aa<1e-14?0:clamp(-dd/aa,0,1);}else if(t>1){t=1;s=aa<1e-14?0:clamp((bb-dd)/aa,0,1);}
  const x=wx+s*ux-t*vx,y=wy+s*uy-t*vy,z=wz+s*uz-t*vz;return x*x+y*y+z*z;
}
function personTriangleDistanceSq(start,end,a,b,c) {
  personTriangle.set(a,b,c);personTriangle.getPlane(personPlane);personDelta.subVectors(end,start);
  const denominator=personPlane.normal.dot(personDelta);
  if(Math.abs(denominator)>1e-12){const t=-personPlane.distanceToPoint(start)/denominator;if(t>=0&&t<=1&&personTriangle.containsPoint(personIntersection.copy(start).addScaledVector(personDelta,t)))return 0;}
  return Math.min(personTriangle.closestPointToPoint(start,personClosest).distanceToSquared(start),personTriangle.closestPointToPoint(end,personClosest).distanceToSquared(end),personSegmentDistanceSq(start,end,a,b),personSegmentDistanceSq(start,end,b,c),personSegmentDistanceSq(start,end,c,a));
}
function personInsideCollider(collider,world,local,a,b,c) {
  const geometry=collider.mesh.geometry,p=geometry.parameters||{};
  local.copy(world).applyMatrix4(collider.inverse);
  if(!geometry.boundingBox.containsPoint(local))return false;
  if(geometry.type==='BoxGeometry')return true;
  if(geometry.type==='CylinderGeometry'&&!p.openEnded&&p.thetaLength>=TAU-1e-6){const radius=p.radiusBottom+(p.radiusTop-p.radiusBottom)*(local.y/p.height+.5);return Math.hypot(local.x,local.z)<radius;}
  if(geometry.type==='SphereGeometry'&&p.phiLength>=TAU-1e-6&&p.thetaLength>=Math.PI-1e-6)return local.lengthSq()<p.radius*p.radius;
  if(geometry.type==='TorusGeometry'&&p.arc>=TAU-1e-6)return (Math.hypot(local.x,local.y)-p.radius)**2+local.z*local.z<p.tube*p.tube;
  const profile=p.points;
  if(geometry.type!=='ExtrudeGeometry'&&!(geometry.type==='LatheGeometry'&&profile?.[0]?.x<1e-6&&profile.at(-1)?.x<1e-6))return false;
  const ray=new THREE.Ray(world,new THREE.Vector3(1,.371,.217).normalize()),hits=[];
  for(let i=0;i<collider.vertices.length;i+=9){a.fromArray(collider.vertices,i);b.fromArray(collider.vertices,i+3);c.fromArray(collider.vertices,i+6);if(ray.intersectTriangle(a,b,c,false,personIntersection))hits.push(world.distanceTo(personIntersection));}
  hits.sort((x,y)=>x-y);return hits.filter((distance,i)=>!i||distance-hits[i-1]>1e-6).length%2===1;
}

// Dimensions and connections are illustrative. Photo observations live in data.js.
export function createFacilityScene(canvas, options = {}) {
  return new FacilityScene(canvas, options);
}

class FacilityScene {
  constructor(canvas, { equipment = [], floor = 7, packagingLevel = 'all', enabledAreas = ['dryer', 'outdoor', 'campus', 'packaging'], personEnabled = true, controlledPresentation = false, includeAdjacentBoilerRoom = false, survey = [], onTransformChange = () => {}, onSurveyPhoto = () => {}, onSelect = () => {}, onViewChange = () => {}, onFloorChange = () => {}, onPackagingLevelChange = () => {}, onNavigationChange = () => {}, onDoorInteraction = () => {} } = {}) {
    this.canvas = canvas;
    this.presentationOnly = !!controlledPresentation;
    this.presentationInspection = false;
    this.enabledAreas = new Set(this.presentationOnly ? ['dryer'] : enabledAreas);
    this.personEnabled = !!personEnabled;
    this.controlledPresentation = !!controlledPresentation;
    this.autoOpenDoors = false; this.personViewScale = 1;
    this.onDoorInteraction = onDoorInteraction;
    // A floor owns the vertical datum. Legacy photo-layout items have no floor
    // field and must stay on the seventh-floor drawing instead of world Y=0.
    this.equipment = equipment.filter(item => (!this.presentationOnly || ([1, 2, 3, 4, 5, 6, 7, 8].includes(item.floor) && item.id !== 'f1-boiler-room' && !item.samePhysicalRoomAs)) && this._areaEnabled(typeof item.floor === 'string' ? item.floor : 'dryer') &&
      (this._areaEnabled('campus') || !item.samePhysicalRoomAs?.startsWith('campus-') || (includeAdjacentBoilerRoom && !this.presentationOnly && item.id === 'f1-boiler-room'))).map((item) => {
      const level = item.floor ?? 7;
      return { ...item, floor: level, position: [item.position[0], ['outdoor', 'campus', 'packaging'].includes(level) ? item.position[1] : floorElevation(level), item.position[2]] };
    });
    this.placementDefaults = new Map(this.equipment.map((item) => [item.id, { ...item, position: [...item.position], rotation: item.rotation || 0 }]));
    this.placementFootprints = new Map();
    this.placementResults = new Map();
    this.onSelect = onSelect;
    this.onViewChange = onViewChange;
    this.onFloorChange = onFloorChange;
    this.onPackagingLevelChange = onPackagingLevelChange;
    this.onNavigationChange = onNavigationChange;
    this.onSurveyPhoto = onSurveyPhoto;
    this.onTransformChange = onTransformChange;
    this.placementMode = false;
    this.dragPlacement = null;
    this.surveyEnabled = true;
    this.objects = new Map();
    this.parts = [];
    this.pickables = [];
    this.materials = new Set();
    this.geometries = new Set();
    this.textures = new Set();
    this.listeners = [];
    this.selected = null;
    this.hovered = null;
    this.hoverOutline = null;
    this.hoverHint = null;
    this.lastHoverPick = 0;
    this.explosion = 0;
    this.amount = 0;
    this.isolated = false;
    this.labelsEnabled = false;
    this.structureEnabled = true;
    this.columnsEnabled = true;
    this.partitionsEnabled = false;
    this.ductsEnabled = true;
    this.packagingLevel = packagingLevel === 'all' ? 'all' : PACKAGING_ROOMS[Number(packagingLevel)] ? Number(packagingLevel) : 'all';
    this.packagingCargoVisible = true;
    this.active = true;
    this.disposed = false;
    this._pickTimer = null;
    this.frame = null;
    this.lastTick = null;
    this.reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    this.dirty = true;
    this.view = 'perspective';
    this.navigationEdited = false;
    this.activeFloor = 'all';
    this.floorDecks = new Map();
    this.floorStructures = new Map();
    this.target = new THREE.Vector3(0, 2, 0);
    this.goalTarget = this.target.clone();
    this.orbit = { azimuth: .76, elevation: .69, distance: 46 };
    this.goalOrbit = { ...this.orbit };
    this.raycaster = new THREE.Raycaster();
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0xe9eeea);
    this.camera = new THREE.PerspectiveCamera(42, 1, .02, 3000);
    this.personCamera = this.personEnabled ? new THREE.PerspectiveCamera(70, 1, .04, 3000) : null;
    this.personInputs = new Set();
    this.personStates = new Map();
    this.person = null;
    this.personArea = null;
    this.personObstacleCache = null;
    this.topCamera = new THREE.OrthographicCamera(-18, 18, 18, -18, .02, 3000);
    this.topCamera.up.set(0, 0, -1);
    this.topCamera.position.set(0, 60, 0);
    this.topCamera.lookAt(0, 0, 0);
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.7));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.12;
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    this._palette();
    this._lights();
    this._environment();
    this._buildingFloors();
    if (this._areaEnabled('outdoor')) {
      this.outdoor = buildOutdoorEnvironment(this);
      this.floorDecks.set('outdoor', this.outdoor.deck);
      this.floorStructures.set('outdoor', this.outdoor.structure);
    }
    if (this._areaEnabled('campus')) {
      this.campus = buildCampusEnvironment(this);
      this.floorDecks.set('campus', this.campus.deck);
      this.floorStructures.set('campus', this.campus.structure);
    }
    this.packagingEnvironments = new Map((this._areaEnabled('packaging') ? Object.values(PACKAGING_ROOMS) : []).map((room) => [room.floorLevel, buildPackagingEnvironment(this, room)]));
    this.packaging = this.packagingEnvironments.get(this.packagingLevel) || this.packagingEnvironments.get(3);
    if (this.packaging) {
      this.floorDecks.set('packaging', this.packaging.deck);
      this.floorStructures.set('packaging', this.packaging.structure);
    }
    this._survey(this._areaEnabled('outdoor') ? survey : []);
    for (const item of this.equipment) this._equipment(item);
    this._applyPackagingFinishes();
    this._applyOutdoorFinishes();
    this._placementFootprints();
    if (this.personEnabled) this._personModel();
    this.proximityDoors = createProximityDoorController(this.scene);
    // New upper-hall ducts belong to their actual 6F/7F environments.
    this.ducts = this.upperEnvironments.get(6)?.ducts;
    this._labels();
    this._controls();
    this.observer = new ResizeObserver(() => this.resize());
    this.observer.observe(canvas.parentElement || canvas);
    this.resize();
    this.setFloor(floor);
    this.target.copy(this.goalTarget); Object.assign(this.orbit, this.goalOrbit);
    this._updateCamera();
    this._draw();
  }

  _areaEnabled(area) { return this.presentationOnly ? area === 'dryer' : !this.enabledAreas || this.enabledAreas.has(area); }

  _material(color, roughness = .55, metalness = .1, extra = {}) {
    const material = new THREE.MeshStandardMaterial({ color, roughness, metalness, ...extra });
    this.materials.add(material);
    return material;
  }

  _applyPackagingFinishes() {
    const reflection = this.packagingEquipmentV2Materials?.ss?.envMap;
    if (!reflection) return;
    for (const [palette, keys, intensity] of [
      [this.packagingLineMaterials, ['steel', 'polished', 'edge'], 1.05],
      [this.packagingEnvironmentV2Materials, ['steel', 'silver'], .9],
    ]) {
      for (const key of keys) {
        const material = palette?.[key];
        if (!material) continue;
        material.envMap = reflection; material.envMapIntensity = intensity; material.needsUpdate = true;
      }
    }
    // Rolled sheet streaks from the third-floor kit keep flat cabinet faces metallic.
    const sheet = this.packagingFloor3Materials?.ss?.map, polished = this.packagingLineMaterials?.polished;
    if (sheet && polished) { polished.map = sheet; polished.color.set(0xe9eceb); polished.roughness = .4; polished.needsUpdate = true; }
  }

  _applyOutdoorFinishes() {
    const silver = this.outdoorMaterials?.silver;
    if (!silver || typeof document === 'undefined') return;
    // A neutral sky/wall/ground environment keeps bare stainless steel from
    // becoming a dark painted surface. No installation geometry is inferred.
    const faces = Array.from({ length: 6 }, (_, index) => {
      const canvas = document.createElement('canvas'); canvas.width = canvas.height = 64;
      const context = canvas.getContext('2d');
      const gradient = context.createLinearGradient(0, 0, 0, 64);
      if (index === 2) { gradient.addColorStop(0, '#eef2f1'); gradient.addColorStop(1, '#dbe5e8'); }
      else if (index === 3) { gradient.addColorStop(0, '#999d94'); gradient.addColorStop(1, '#777e73'); }
      else {
        gradient.addColorStop(0, '#e3e9ea'); gradient.addColorStop(.46, '#e1e4de');
        gradient.addColorStop(.55, '#bdc3b8'); gradient.addColorStop(1, '#70776c');
      }
      context.fillStyle = gradient; context.fillRect(0, 0, 64, 64); return canvas;
    });
    const reflection = new THREE.CubeTexture(faces); reflection.colorSpace = THREE.SRGBColorSpace; reflection.needsUpdate = true;
    this.textures.add(reflection);
    silver.color.set(0xb7bdbb); silver.envMap = reflection; silver.envMapIntensity = .85; silver.needsUpdate = true;
  }

  _palette() {
    const fine = typeof WebGLRenderingContext !== 'undefined';
    const makeDataTex = (w, h, fill, { srgb = true, repeat = [1, 1] } = {}) => {
      const data = new Uint8Array(w * h * 4);
      for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
        const c = fill((x + .5) / w, (y + .5) / h), i = (y * w + x) * 4;
        data[i] = Math.max(0, Math.min(255, c[0]));
        data[i + 1] = Math.max(0, Math.min(255, c[1]));
        data[i + 2] = Math.max(0, Math.min(255, c[2]));
        data[i + 3] = c[3] ?? 255;
      }
      const tex = new THREE.DataTexture(data, w, h, THREE.RGBAFormat);
      if (srgb) tex.colorSpace = THREE.SRGBColorSpace;
      tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
      tex.repeat.set(repeat[0], repeat[1]);
      tex.magFilter = THREE.LinearFilter;
      tex.minFilter = fine ? THREE.LinearMipmapLinearFilter : THREE.LinearFilter;
      tex.generateMipmaps = fine;
      if (fine) tex.anisotropy = 4;
      tex.needsUpdate = true;
      this.textures.add(tex);
      return tex;
    };
    const hash2 = (x, y) => { const v = Math.sin(x * 127.1 + y * 311.7) * 43758.5453123; return v - Math.floor(v); };
    const vnoise = (x, y) => {
      const ix = Math.floor(x), iy = Math.floor(y), fx = x - ix, fy = y - iy;
      const u = fx * fx * (3 - 2 * fx), v = fy * fy * (3 - 2 * fy);
      const a = hash2(ix, iy), b = hash2(ix + 1, iy), c = hash2(ix, iy + 1), d = hash2(ix + 1, iy + 1);
      return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
    };
    const fbm = (x, y) => vnoise(x, y) * .55 + vnoise(x * 2.07 + 5.2, y * 2.07 + 1.3) * .3 + vnoise(x * 4.31 + 9.7, y * 4.31 + 3.8) * .15;

    // Brushed stainless steel + vertical/horizontal sheet weld seams & subtle patina
    const sw = fine ? 256 : 16;
    const brushed = makeDataTex(sw, sw, (u, v) => {
      const streak = vnoise(u * 140, v * 5) * .6 + vnoise(u * 260, v * 12) * .4;
      const vSeam = Math.min(Math.abs(u - .25), Math.abs(u - .75)) < .004 ? -14 : 0;
      const hBand = Math.abs(v - .5) < .006 ? -9 : 0;
      const warm = Math.max(0, fbm(u * 4 + 2, v * 4 + 7) - .62) * 22;
      const base = 216 + streak * 6 + vSeam + hBand;
      return [base + warm * .45, base - warm * .12, base - warm * .38, 255];
    });
    const stainedMap = makeDataTex(sw, sw, (u, v) => {
      const streak = vnoise(u * 130, v * 5);
      const drip = Math.max(0, fbm(u * 9 + 3, v * 2.2 + 1) - .52) * Math.max(0, 1 - Math.abs(v - .45) * 1.5);
      const base = 202 + streak * 24;
      return [base - drip * 38, base - drip * 72, base - drip * 96, 255];
    });
    const steelRough = makeDataTex(fine ? 128 : 8, fine ? 128 : 8, (u, v) => {
      const r = 156 + vnoise(u * 90, v * 6) * 18 + fbm(u * 3 + 1, v * 3 + 6) * 46 + (Math.abs(v - .5) < .008 ? 22 : 0);
      return [0, r, 0, 255];
    }, { srgb: false });

    // Deep glossy emerald epoxy floor with subtle white powder trails, scuffs & roller fade
    const fw = fine ? 384 : 16;
    const epoxyPixel = (u, v) => {
      const x = u * 7, z = v * 7;
      const tileFade = (Math.floor(u * 2) + Math.floor(v * 2)) % 2 ? .035 : -.025;
      const joint = (Math.min((u * 2) % 1, 1 - (u * 2) % 1) < .007 || Math.min((v * 2) % 1, 1 - (v * 2) % 1) < .007) ? .08 : 0;
      const cloud = fbm(x * .95, z * .95);
      const patch = fbm(x * 2.1 + 11.4, z * 1.9 + 4.2);
      const powder = Math.max(0, patch - .62) * 1.45 * Math.max(0, fbm(x * 4.7 + 2, z * 4.5 + 8) - .35);
      const fineDust = Math.max(0, vnoise(x * 16, z * 16) - .74) * .45;
      const scratch = Math.max(0, vnoise(x * 42 + z * 11, z * 7 - x * 5) - .87) * 1.4;
      let r = 27 + 18 * (cloud + tileFade), g = 74 + 24 * (cloud + tileFade), b = 52 + 18 * (cloud + tileFade);
      const w = Math.min(.48, powder * .65 + fineDust * .28 + scratch * .32 + joint * .25);
      r = r * (1 - w) + 174 * w;
      g = g * (1 - w) + 186 * w;
      b = b * (1 - w) + 172 * w;
      const dark = Math.max(0, .45 - cloud) * .48;
      return [r * (1 - dark), g * (1 - dark), b * (1 - dark), w];
    };
    const epoxyBoxMap = makeDataTex(fw, fw, (u, v) => { const p = epoxyPixel(u, v); return [p[0], p[1], p[2], 255]; }, { repeat: [4, 4] });
    const epoxyBoxRough = makeDataTex(fine ? 192 : 8, fine ? 192 : 8, (u, v) => {
      const p = epoxyPixel(u, v);
      return [0, Math.round(52 + p[3] * 145), 0, 255];
    }, { srgb: false, repeat: [4, 4] });
    const epoxySlabMap = epoxyBoxMap.clone(); epoxySlabMap.repeat.set(.13, .13); epoxySlabMap.needsUpdate = true; this.textures.add(epoxySlabMap);
    const epoxySlabRough = epoxyBoxRough.clone(); epoxySlabRough.repeat.set(.13, .13); epoxySlabRough.needsUpdate = true; this.textures.add(epoxySlabRough);

    // Sky-blue cleanroom epoxy floor (cards 05~07, 11)
    const blueEpoxyMap = makeDataTex(fine ? 192 : 8, fine ? 192 : 8, (u, v) => {
      const c = fbm(u * 5 + 3, v * 5 + 8), scuff = Math.max(0, vnoise(u * 26, v * 26) - .8) * .35;
      return [146 + 22 * c + 40 * scuff, 188 + 20 * c + 30 * scuff, 208 + 18 * c + 22 * scuff, 255];
    }, { repeat: [3, 2] });

    // Corrugated dark charcoal-slate steel ceiling deckplate
    const deckMap = makeDataTex(fine ? 128 : 8, fine ? 128 : 8, (u, v) => {
      const rib = Math.sin(u * Math.PI * 24);
      const shade = 78 + rib * 18 + vnoise(u * 12, v * 8) * 7;
      return [shade + 2, shade + 2, shade + 8, 255];
    }, { repeat: [6, 6] });

    this.mat = {
      steel: this._material(0xdfe3e2, .42, .85, { map: brushed, roughnessMap: steelRough, envMapIntensity: 1.18 }),
      stainedSteel: this._material(0xe4e6e0, .28, .82, { map: stainedMap, roughnessMap: steelRough, envMapIntensity: 1.1 }),
      trim: this._material(0xaeb6b4, .36, .76, { envMapIntensity: 1.05 }),
      dark: this._material(0x2f3f3d, .54, .42),
      floor: this._material(0xffffff, .30, .06, { map: epoxyBoxMap, roughnessMap: epoxyBoxRough, envMapIntensity: .82 }),
      slabFloor: this._material(0xffffff, .30, .06, { map: epoxySlabMap, roughnessMap: epoxySlabRough, envMapIntensity: .82 }),
      curb: this._material(0x165638, .32, .06, { envMapIntensity: .72 }),
      cleanBlueFloor: this._material(0xffffff, .26, .05, { map: blueEpoxyMap, envMapIntensity: .8 }),
      ceilingDeck: this._material(0xffffff, .62, .38, { map: deckMap, emissive: 0x262930, emissiveIntensity: .28, side: THREE.DoubleSide }),
      creamBeam: this._material(0xdcd7c4, .72, .12, { emissive: 0x2c2a24, emissiveIntensity: .14 }),
      plinth: this._material(0xe4e1d2, .85, .03),
      concrete: this._material(0xe2dec9, .86, .03),
      wall: this._material(0xe6e2d3, .88, .02),
      red: this._material(0xb43c32, .56, .24),
      yellow: this._material(0xe9b824, .42, .18),
      motor: this._material(0x4b7f79, .46, .48),
      black: this._material(0x1e2b29, .74, .12),
      copper: this._material(0xa67543, .38, .58),
      white: this._material(0xedf0ea, .56, .04),
      mint: this._material(0x71d5a6, .4, .14),
      blue: this._material(0x2764a6, .48, .18),
      insulation: this._material(0x9ca4a8, .52, .34),
      screen: this._material(0x163d41, .3, .15, { emissive: 0x1c4f4f, emissiveIntensity: .35 }),
    };
  }

  _mesh(geometry, material, parent, position = [0, 0, 0]) {
    const mesh = new THREE.Mesh(geometry, material);
    mesh.position.set(...position);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    parent.add(mesh);
    this.geometries.add(geometry);
    return mesh;
  }

  _box(parent, size, position, material = this.mat.steel) {
    return this._mesh(new THREE.BoxGeometry(...size), material, parent, position);
  }

  _cyl(parent, radius, height, position, material = this.mat.steel, bottom = radius, segments = 48) {
    return this._mesh(new THREE.CylinderGeometry(radius, bottom, height, segments), material, parent, position);
  }

  _group(parent, position = [0, 0, 0]) {
    const group = new THREE.Group(); group.position.set(...position); parent.add(group); return group;
  }

  _bar(parent, start, end, radius = .045, material = this.mat.trim) {
    const a = new THREE.Vector3(...start), b = new THREE.Vector3(...end);
    const mesh = this._cyl(parent, radius, a.distanceTo(b), a.clone().add(b).multiplyScalar(.5).toArray(), material, radius, 10);
    mesh.quaternion.setFromUnitVectors(Y, b.sub(a).normalize());
    return mesh;
  }

  _ring(parent, radius, y, material = this.mat.trim, thickness = .035) {
    const mesh = this._mesh(new THREE.TorusGeometry(radius, thickness, 6, 64), material, parent, [0, y, 0]);
    mesh.rotation.x = Math.PI / 2;
    return mesh;
  }

  _part(root, name, offset, position = [0, 0, 0]) {
    const group = this._group(root, position);
    this.parts.push({ root, name, group, home: group.position.clone(), offset: new THREE.Vector3(...offset) });
    return group;
  }

  _lights() {
    this.textures.add(equipmentReflection(this.scene));
    const hemisphere = new THREE.HemisphereLight(0xf4fbff, 0x668278, 2.8); this.scene.add(hemisphere);
    const sun = new THREE.DirectionalLight(0xfff3d9, 3.6);
    sun.position.set(-28, 85, 35); sun.castShadow = true;
    sun.target.position.set(0, 24, 0); this.scene.add(sun.target);
    sun.shadow.mapSize.set(2048, 2048);
    Object.assign(sun.shadow.camera, { left: -46, right: 46, top: 48, bottom: -48, near: 1, far: 180 });
    sun.shadow.normalBias = .04; sun.shadow.bias = -.00015;
    this.scene.add(sun); this.sun = sun;
    const fill = new THREE.DirectionalLight(0xd8edff, 1.3);
    fill.position.set(15, 12, -12); this.scene.add(fill);
    const lights = { scene: this.scene, sun, hemisphere, fill, materials: this.materials };
    this._updateLighting = () => applyLightProfile(lights, lightProfileFor({ floor: this.activeFloor, view: this.view }));
  }

  _environment() {
    this.upperEnvironments = new Map();
    for (const level of this._areaEnabled('dryer') ? [6, 7, 8] : []) {
      const info = FLOORS.find((floor) => floor.id === level);
      const environment = buildDryerUpperEnvironment(this, {
        floor: level, elevation: floorElevation(level), profile: info.roofProfile,
        roofElevation: floorElevation(8), bounds: info.bounds,
        chamberOpening: info.chamberOpening, equipment: this.equipment,
      });
      this.upperEnvironments.set(level, environment);
      this.floorDecks.set(level, environment.deck); this.floorStructures.set(level, environment.structure);
    }
    this.floor = this.upperEnvironments.get(7)?.deck; this.structure = this.upperEnvironments.get(7)?.structure;
    this.locationDisks = new Map();
    const ringMat = new THREE.MeshBasicMaterial({ color: 0x8ef0bd, transparent: true, opacity: .8, side: THREE.DoubleSide, depthWrite: false });
    this.materials.add(ringMat);
    this.selectionRing = this._mesh(new THREE.RingGeometry(1, 1.07, 72), ringMat, this.scene);
    this.selectionRing.rotation.x = -Math.PI / 2; this.selectionRing.visible = false;
  }

  _buildingFloors() {
    this.buildingEnvironments = new Map();
    for (const floor of FLOORS.filter(entry => entry.id < 6 && this._areaEnabled('dryer'))) {
      const elevation = floorElevation(floor.id);
      const environment = buildDryerBuildingEnvironment(this, { floor: floor.id, elevation, spec: floor });
      buildPreparationEnvironment(this, environment, floor);
      buildDryerRouteEnvironment(this, environment, floor);
      buildDryerCompressorEnvironment(this, environment, floor);
      alignDryerCompressorEntrance(environment);
      buildDryerCompressorInteriorDetails(this, environment, floor);
      buildDryerFloor1PhotoDetail(this, environment, floor);
      if (floor.id === 3) {
        environment.mapCaptions = [];
        environment.architectureFixtures.traverse(node => {
          if (node.userData.floorMapCaption) environment.mapCaptions.push(node);
        });
      }
      this.buildingEnvironments.set(floor.id, environment);
      this.floorDecks.set(floor.id, environment.deck); this.floorStructures.set(floor.id, environment.structure);
      for (const item of this.equipment.filter(entry => entry.floor === floor.id)) {
        const material = this._material(0x0c2418, .95, 0, { transparent: true, opacity: .14, depthWrite: false });
        const disk = this._mesh(new THREE.CircleGeometry(item.type === 'dryer-body' ? 3.0 : 1.5, 24), material, environment.deck, [item.position[0], .016, item.position[2]]);
        disk.rotation.x = -Math.PI / 2; disk.castShadow = false; this.locationDisks.set(item.id, disk);
      }
    }
  }

  _groundText(text, position, width, height, parent = this.floor, style = {}) {
    const canvas = document.createElement('canvas'); canvas.width = 1024; canvas.height = 128;
    if (style.fitText) canvas.width = Math.max(256, Math.min(2048, Array.from(String(text)).length * 76 + 64));
    const ctx = canvas.getContext('2d'); ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.font = style.font || '500 64px "Malgun Gothic", sans-serif'; ctx.fillStyle = style.color || '#c5dbc8';
    ctx.fillText(text, canvas.width / 2, 64);
    const map = new THREE.CanvasTexture(canvas); map.colorSpace = THREE.SRGBColorSpace; this.textures.add(map);
    const mat = new THREE.MeshBasicMaterial({ map, transparent: true, depthWrite: false, side: THREE.DoubleSide }); this.materials.add(mat);
    const mesh = this._mesh(new THREE.PlaneGeometry(width, height), mat, parent, position);
    mesh.userData.floorMapCaption = true;
    mesh.castShadow = false; mesh.receiveShadow = false;
    mesh.rotation.x = -Math.PI / 2;
  }

  _platform(parent, position, width, depth, rail = this.mat.red, rearOnly = false) {
    const group = this._group(parent, position);
    this._box(group, [width, .16, depth], [0, 0, 0], this.mat.dark);
    for (const x of [-width / 2 + .15, width / 2 - .15]) for (const z of [-depth / 2 + .15, depth / 2 - .15]) {
      const height = position[1];
      this._box(group, [.17, height, .17], [x, -height / 2, z], this.mat.trim);
      this._box(group, [.45, .1, .45], [x, -height + .06, z], this.mat.dark);
    }
    for (const z of [-depth / 2, ...(rearOnly ? [] : [depth / 2])]) {
      for (let x = -width / 2; x <= width / 2 + .01; x += width / 4) this._bar(group, [x, 0, z], [x, 1.1, z], .035, rail);
      for (const y of [.55, 1.1]) this._bar(group, [-width / 2, y, z], [width / 2, y, z], .035, rail);
    }
    for (const x of [-width / 2, width / 2]) for (const y of [.55, 1.1]) this._bar(group, [x, y, -depth / 2], [x, y, depth / 2], .035, rail);
    return group;
  }

  _door(parent, width, height, position) {
    const group = this._group(parent, position);
    this._box(group, [width + .12, height + .12, .09], [0, 0, -.02], this.mat.dark);
    this._box(group, [width, height, .12], [0, 0, .03], this.mat.steel);
    for (const x of [-width / 2, width / 2]) for (const y of [-height / 3, height / 3]) {
      this._box(group, [.2, .075, .12], [x, y, .15], this.mat.trim);
      this._bar(group, [x - .1, y, .22], [x + .12, y + .08, .22], .022, this.mat.dark);
    }
    this._bar(group, [width * .28, -.22, .19], [width * .28, .22, .19], .032, this.mat.dark);
    return group;
  }

  _equipment(item) {
    const root = this._group(this.scene, item.position);
    root.rotation.y = item.rotation || 0;
    root.userData.equipment = item.id;
    this.objects.set(item.id, root);
    const photoModel = { chamber: () => this._chamber(root), blower: () => this._blower(root), cyclone: () => this._cyclone(root), heater: () => this._heater(root), panel: () => this._panel(root) }[item.type];
    if (item.floor === 'campus') buildCampusEquipment(this, root, item);
    else if (item.floor === 'packaging') buildPackagingEquipment(this, root, item);
    else if (item.floor === 'outdoor') buildOutdoorEquipment(this, root, item);
    else if ([6, 7, 8].includes(item.floor) && buildDryerUpperEquipment(this, root, item)) { /* New film and architectural floor ownership. */ }
    else if (buildPreparationBoilerRoom(this, root, item)) { /* Same adjacent boiler room, open in the 1F cutaway. */ }
    else if (buildDryerFloor1Load(this, root, item)) { /* 1F selectable loads, as on team 2 floor 3. */ }
    else if (buildPreparationEquipment(this, root, item)) { /* Current 1F continuous walk and room plan. */ }
    else if (buildDryerProcessEquipment(this, root, item)) { /* Preserved OWP silhouettes. */ }
    else if (photoModel) photoModel(); else buildFacilityEquipment(this, root, item);
    root.traverse((object) => { if (object.isMesh) { object.userData.equipment = item.id; this.pickables.push(object); } });
  }

  _chamber(root) {
    this._cyl(root, 3.08, .26, [0, .16, 0], this.mat.floor);
    for (let i = 0; i < 3; i++) {
      const shell = this._part(root, ['하부 외함', '중간 외함', '상부 외함'][i], [i === 1 ? -1.8 : 0, i * 1.3, 0], [0, .35 + i * 2.65, 0]);
      this._cyl(shell, 2.85, 2.65, [0, 1.325, 0]);
      this._ring(shell, 2.87, .06); this._ring(shell, 2.87, 2.59);
      for (let j = 0; j < 8; j++) {
        const a = j / 8 * TAU;
        this._bar(shell, [Math.sin(a) * 2.86, .1, Math.cos(a) * 2.86], [Math.sin(a) * 2.86, 2.6, Math.cos(a) * 2.86], .009, this.mat.trim);
      }
    }
    const cap = this._part(root, '상부 덮개', [0, 4.3, 0], [0, 8.4, 0]);
    this._cyl(cap, .95, .45, [0, 0, 0], this.mat.steel, 2.86);
    this._cyl(cap, .65, .55, [0, .4, 0]);
    const door = this._part(root, '점검문', [0, 0, 2.3], [0, 2.2, 2.83]);
    this._door(door, 1.35, 1.95, [0, 0, 0]);
    for (const x of [-.95, .95]) this._bar(root, [x, .8, 2.71], [x, 7.8, 2.71], .025);
    const gauge = this._cyl(root, .16, .1, [1.65, 2.5, 2.38], this.mat.white); gauge.rotation.x = Math.PI / 2;
    this._bar(root, [1.65, 2.5, 2.45], [1.72, 2.57, 2.46], .009, this.mat.black);
  }

  _blower(root) {
    this._platform(root, [0, 2.45, 0], 4.8, 4, this.mat.red);
    for (const x of [-1.9, 1.9]) this._bar(root, [x, .1, -1.8], [x, 2.45, 1.8], .06, this.mat.red);
    for (const x of [-2.2, -1.65]) this._bar(root, [x, .1, 2.15], [x, 2.5, 2.15], .035, this.mat.red);
    for (let y = .3; y < 2.5; y += .3) this._bar(root, [-2.2, y, 2.15], [-1.65, y, 2.15], .025, this.mat.red);
    this._box(root, [4.1, .22, 2.85], [0, 2.8, 0], this.mat.trim);
    for (const x of [-1.5, 1.5]) for (const z of [-1, 1]) this._cyl(root, .13, .18, [x, 2.61, z], this.mat.black);
    const casing = this._part(root, '송풍기 케이싱', [2.4, .3, -.6], [.55, 4.5, -.25]);
    const shape = new THREE.Shape();
    shape.moveTo(-1.65, -.95); shape.bezierCurveTo(-2.3, .3, -1.4, 2, .25, 1.9);
    shape.bezierCurveTo(1.8, 1.8, 2.1, .2, 1.25, -1.45); shape.lineTo(-1.65, -1.45); shape.closePath();
    const mesh = this._mesh(new THREE.ExtrudeGeometry(shape, { depth: 1.2, bevelEnabled: true, bevelSegments: 1, steps: 1, bevelSize: .05, bevelThickness: .04, curveSegments: 24 }), this.mat.steel, casing, [-.6, 0, 0]);
    mesh.rotation.y = Math.PI / 2;
    this._box(casing, [1.25, 1, 1.25], [0, 1.7, -.45]);
    const inlet = this._cyl(casing, 1.1, .22, [-.72, 0, 0], this.mat.trim); inlet.rotation.z = Math.PI / 2;
    const opening = this._cyl(casing, .91, .24, [-.87, 0, 0], this.mat.black); opening.rotation.z = Math.PI / 2;
    for (let i = 0; i < 12; i++) {
      const a = i / 12 * TAU;
      const bolt = this._cyl(casing, .045, .07, [-1.01, Math.cos(a), Math.sin(a)], this.mat.trim, .045, 6); bolt.rotation.z = Math.PI / 2;
    }
    const motor = this._part(root, '구동 모터', [-2.4, .1, .7], [-1.25, 3.55, .55]);
    this._motor(motor, .52, 1.35);
    const drive = this._part(root, '벨트 · 풀리 (개략)', [0, .2, 1.7], [0, 4.35, 1.2]);
    for (const x of [-1.2, .8]) {
      const pulley = this._cyl(drive, x < 0 ? .37 : .56, .18, [x, 0, 0], this.mat.dark); pulley.rotation.x = Math.PI / 2;
    }
    this._bar(drive, [-1.2, .37, .12], [.8, .56, .12], .035, this.mat.black);
    this._bar(drive, [-1.2, -.37, .12], [.8, -.56, .12], .035, this.mat.black);
    const guard = this._part(root, '노란 구동부 보호커버', [0, 1.8, 2.2], [-.2, 4.35, 1.4]);
    this._box(guard, [2.5, .85, .17], [0, 0, 0], this.mat.yellow);
    for (const x of [-1.25, 1.25]) { const end = this._cyl(guard, .425, .17, [x, 0, 0], this.mat.yellow); end.rotation.x = Math.PI / 2; }
    this._box(guard, [2.65, .61, .03], [0, 0, .105], this.mat.dark);
    for (let x = -1.25; x < 1.3; x += .12) this._bar(guard, [x, -.29, .13], [x, .29, .13], .012, this.mat.yellow);
    const wheel = this._part(root, '내부 임펠러 (개략)', [-1.4, 1.6, -1.4], [.55, 4.5, -.25]);
    const disk = this._cyl(wheel, 1.15, .14, [0, 0, 0], this.mat.dark); disk.rotation.z = Math.PI / 2;
    for (let i = 0; i < 12; i++) {
      const a = i / 12 * TAU;
      const blade = this._box(wheel, [.6, .12, .6], [0, Math.cos(a) * .83, Math.sin(a) * .83], this.mat.trim); blade.rotation.x = -a + .5;
    }
    wheel.userData.revealOnExplode = true; wheel.visible = false;
  }

  _motor(parent, radius, length) {
    const body = this._cyl(parent, radius, length, [0, 0, 0], this.mat.motor); body.rotation.z = Math.PI / 2;
    for (let i = 0; i < 14; i++) {
      const a = i / 14 * TAU;
      this._bar(parent, [-length / 2, Math.cos(a) * radius, Math.sin(a) * radius], [length / 2, Math.cos(a) * radius, Math.sin(a) * radius], .035, this.mat.dark);
    }
    for (const x of [-length / 2, length / 2]) { const end = this._cyl(parent, radius * 1.04, .1, [x, 0, 0], this.mat.motor); end.rotation.z = Math.PI / 2; }
    this._box(parent, [.4, .32, .42], [0, radius, 0], this.mat.motor);
    for (const x of [-length * .3, length * .3]) this._box(parent, [.2, .35, radius * 1.4], [x, -radius, 0], this.mat.motor);
  }

  _cyclone(root) {
    this._cyl(root, 1.93, .25, [0, .15, 0], this.mat.floor);
    const lower = this._part(root, '하부 외통', [0, 0, 0], [0, .3, 0]);
    this._cyl(lower, 1.72, 3.1, [0, 1.55, 0]);
    for (const y of [.12, .45, 2.05, 3.05]) this._ring(lower, 1.74, y, this.mat.trim, .035);
    for (let i = 0; i < 8; i++) {
      const a = i / 8 * TAU;
      const foot = this._box(lower, [.13, .4, .25], [Math.cos(a) * 1.73, .2, Math.sin(a) * 1.73], this.mat.trim); foot.rotation.y = -a;
    }
    const upper = this._part(root, '상부 분리부', [0, 2.3, 0], [0, 3.5, 0]);
    this._cyl(upper, 1.14, 1.8, [0, .85, 0]);
    this._cyl(upper, 1.72, .28, [0, -.13, 0], this.mat.steel, 1.14);
    this._ring(upper, 1.16, .1); this._ring(upper, 1.16, 1.69);
    const cap = this._part(root, '상부 덮개', [0, 3.4, 0], [0, 5.3, 0]);
    this._cyl(cap, 1.17, .09, [0, 0, 0]);
    const outlet = this._part(root, '연결 덕트', [1.3, .7, 0], [1.35, 4.45, 0]);
    const tube = this._cyl(outlet, .46, 1.35, [0, 0, 0]); tube.rotation.z = Math.PI / 2;
    const flange = this._cyl(outlet, .54, .09, [.55, 0, 0], this.mat.trim); flange.rotation.z = Math.PI / 2;
    const door = this._part(root, '점검구', [0, 0, 1.8], [0, 1.35, 1.72]); this._door(door, .8, .75, [0, 0, 0]);
    this._platform(root, [0, 3.48, 0], 4.25, 4.2, this.mat.trim, true);
    for (const y of [1.9, 4.8]) {
      this._ring(root, y < 3 ? 1.78 : 1.2, y, this.mat.dark, .025);
    }
    const gauge = this._cyl(root, .095, .1, [.7, 2.65, 1.6], this.mat.white); gauge.rotation.x = Math.PI / 2;
  }

  _heater(root) {
    buildFurnace(this, root);
  }

  _panel(root) {
    this._box(root, [1.6, .2, .8], [0, .12, 0], this.mat.plinth);
    const cabinet = this._part(root, '제어반 외함', [0, 0, -.8], [0, 1.55, 0]);
    this._box(cabinet, [1.45, 2.6, .55], [0, 0, 0], this.mat.white);
    const door = this._part(root, '조작 패널', [1.2, 0, .5], [0, 1.55, .32]);
    this._box(door, [1.35, 2.48, .07], [0, 0, 0], this.mat.trim);
    this._box(door, [.8, .45, .05], [0, .65, .055], this.mat.screen);
    for (let row = 0; row < 3; row++) for (let col = 0; col < 3; col++) {
      const button = this._cyl(door, .055, .04, [-.38 + col * .38, .15 - row * .36, .09], col === 2 ? this.mat.red : this.mat.mint); button.rotation.x = Math.PI / 2;
    }
    this._bar(door, [.53, -.45, .12], [.53, -.1, .12], .025, this.mat.black);
  }

  _ductwork() {
    this.ducts = this._group(this.scene);
    // Endpoints follow visible forms; intervening routes are only layout references.
    this._duct([[2.05, 6.2, -2.8], [2.05, 8.2, -2.8], [-2, 8.2, -2.8], [-3.5, 7.6, -3]], .68);
    this._duct([[-6, 6.5, 3.6], [-6, 7.8, 3.6], [-6, 8, .2]], .92);
    this._duct([[.7, 4.5, -3.9], [.7, 6.7, -7.5], [4, 6.7, -7.5], [9.6, 6, -7.5], [9.6, 4.45, -7.5], [9.6, 4.45, 6.2]], .48);
    for (const z of [-5, 0, 5]) this._duct([[8.95, 4.45, z], [9.6, 4.45, z]], .46);
    for (const z of [-7.5, 2.5, 6]) {
      for (const x of [9, 10.2]) this._bar(this.ducts, [x, .1, z], [x, 3.9, z], .04);
      this._bar(this.ducts, [9, 3.9, z], [10.2, 3.9, z], .04);
    }
  }

  _duct(points, radius) {
    const vectors = points.map((p) => new THREE.Vector3(...p));
    const curve = new THREE.CurvePath();
    let cursor = vectors[0];
    for (let i = 1; i < vectors.length - 1; i++) {
      const corner = vectors[i], next = vectors[i + 1];
      const rounding = Math.min(radius * 1.5, corner.distanceTo(cursor) * .4, corner.distanceTo(next) * .4);
      const a = corner.clone().add(cursor.clone().sub(corner).normalize().multiplyScalar(rounding));
      const b = corner.clone().add(next.clone().sub(corner).normalize().multiplyScalar(rounding));
      curve.add(new THREE.LineCurve3(cursor, a));
      curve.add(new THREE.QuadraticBezierCurve3(a, corner, b)); cursor = b;
    }
    curve.add(new THREE.LineCurve3(cursor, vectors.at(-1)));
    const length = curve.getLength();
    this._mesh(new THREE.TubeGeometry(curve, Math.max(12, Math.ceil(length * 6)), radius, 20, false), this.mat.steel, this.ducts);
    for (let d = .05; d < length; d += 1.25) {
      const t = d / length;
      const ring = this._mesh(new THREE.TorusGeometry(radius + .01, .02, 5, 24), this.mat.trim, this.ducts, curve.getPointAt(t).toArray());
      ring.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), curve.getTangentAt(t).normalize());
    }
  }

  _survey(photos) {
    this.survey = this._group(this.scene);
    this.surveyPhotos = photos;
    this.surveyPoints = [];
    const blue = this._material(0x278cb0, .65, .1);
    let previous;
    for (const photo of photos) {
      const [x, , z] = photo.position;
      if (previous && Math.hypot(x - previous[0], z - previous[2]) < 1.2) continue;
      const marker = this._cyl(this.survey, .18, .06, [x, .13, z], blue, .18, 16);
      marker.userData.surveyIndex = photo.index;
      this.pickables.push(marker);
      if (previous) this._bar(this.survey, [previous[0], .13, previous[2]], [x, .13, z], .025, blue);
      previous = photo.position;
      this.surveyPoints.push(marker);
    }
    this.surveyArrow = this._group(this.survey);
    this._cyl(this.surveyArrow, .3, .08, [0, .15, 0], this.mat.yellow, .3, 24);
    const ring = this._material(0x278cb0, .8, 0, { transparent: true, opacity: .25, depthWrite: false });
    this.surveyAccuracy = this._mesh(new THREE.RingGeometry(.97, 1, 64), ring, this.surveyArrow, [0, .09, 0]);
    this.surveyAccuracy.rotation.x = -Math.PI / 2;
    this.surveyArrow.visible = false;
  }

  setSurvey(value) { this.surveyEnabled = !!value; this._visibility(); }

  setSurveyPhoto(photo) {
    this.surveyArrow.visible = !!photo;
    if (photo) {
      this.surveyArrow.position.set(photo.position[0], 0, photo.position[2]);
      this.surveyArrow.rotation.y = -photo.heading * Math.PI / 180;
      this.surveyAccuracy.scale.setScalar(photo.accuracy);
    }
    this._invalidate();
  }

  _labels() {
    this.labelLayer = document.createElement('div');
    this.labelLayer.className = 'facility-labels';
    Object.assign(this.labelLayer.style, { position: 'absolute', inset: '0', pointerEvents: 'none', overflow: 'hidden' });
    this.canvas.parentElement.append(this.labelLayer);
    this.leaderLayer = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    this.leaderLayer.setAttribute('class', 'facility-leaders');
    this.labelLayer.append(this.leaderLayer);
    this.labels = this.equipment.map((item) => {
      const button = document.createElement('button'); button.type = 'button';
      button.className = 'facility-label'; button.dataset.equipment = item.id; button.title = '클릭하여 설비 선택';
      button.setAttribute('aria-label', `${item.name} 선택`);
      const tag = document.createElement('span'); tag.className = 'label-tag'; tag.textContent = item.tag;
      const title = document.createElement('span'); title.className = 'label-name'; title.textContent = item.name;
      button.append(tag, title);
      Object.assign(button.style, { position: 'absolute', pointerEvents: 'auto', whiteSpace: 'nowrap' });
      button.addEventListener('click', () => this.onSelect(item.id));
      this.labelLayer.append(button);
      const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      const dot = document.createElementNS('http://www.w3.org/2000/svg', 'circle'); dot.setAttribute('r', '2.2');
      this.leaderLayer.append(line, dot);
      const heights = { chamber: 8.9, blower: 6.7, cyclone: 5.65, heater: 6.6, panel: 3.2 };
      const bounds = new THREE.Box3().setFromObject(this.objects.get(item.id));
      const height = item.labelHeight || heights[item.type] || Math.max(1.5, bounds.max.y - item.position[1] + .2);
      return { element: button, line, dot, id: item.id, floor: item.floor, floorLevel: item.floorLevel, baseY: item.position[1] + height, anchor: new THREE.Vector3(item.position[0], item.position[1] + height, item.position[2]) };
    });
    this.floorLabels = FLOORS.map((floor) => {
      const button = document.createElement('button'); button.type = 'button'; button.className = 'facility-floor-label';
      button.textContent = floor.kind === 'roof' ? '옥상 · 서비스 구역' : `${floor.displayLevel ?? floor.id}F · ${floor.shortName || floor.name}`;
      button.setAttribute('aria-label', floor.kind === 'roof' ? '옥상 보기' : `${floor.displayLevel ?? floor.id}층 보기`);
      button.addEventListener('click', () => this.onFloorChange(floor.id)); this.labelLayer.append(button);
      return { element: button, anchor: new THREE.Vector3(floor.id >= 6 ? -9 : -13.5, floorElevation(floor.id) + 2, floor.kind === 'roof' ? -10 : 11.5) };
    });
    this.packagingFloorLabels = (this._areaEnabled('packaging') ? Object.values(PACKAGING_ROOMS) : []).map((room) => {
      const button = document.createElement('button'); button.type = 'button'; button.className = 'facility-floor-label';
      button.textContent = `${room.floorLevel}F · 스틱·소포장`;
      button.setAttribute('aria-label', `스틱·소포장 ${room.floorLevel}층 보기`);
      button.addEventListener('click', () => this.setPackagingLevel(room.floorLevel)); this.labelLayer.append(button);
      return { element: button, anchor: new THREE.Vector3(-15, (PACKAGING_FLOOR_ELEVATIONS[room.floorLevel] || 0) + 2, 14.7) };
    });
    for (const part of this.parts) {
      const label = document.createElement('span'); label.className = 'facility-part-label'; label.textContent = part.name;
      Object.assign(label.style, { position: 'absolute', pointerEvents: 'none', whiteSpace: 'nowrap' });
      label.hidden = true; this.labelLayer.append(label); part.label = label;
    }
  }

  _updateLabels() {
    if (!this.labelLayer) return;
    const showNames = this.labelsEnabled || !!this.selected;
    this.labelLayer.style.display = showNames ? '' : 'none';
    this.leaderLayer.style.display = showNames ? '' : 'none';
    if (!showNames) return;
    const camera = this._currentCamera(), width = this.width, height = this.height;
    for (const label of this.floorLabels) {
      const p = label.anchor.clone().project(camera);
      label.element.hidden = this.activeFloor !== 'all' || this.isolated || !this.labelsEnabled || p.z < -1 || p.z > 1 || Math.abs(p.x) > 1 || Math.abs(p.y) > 1;
      label.element.style.transform = `translate(${Math.round(clamp((p.x + 1) * width / 2 - 45, 10, width - 150))}px,${Math.round((-p.y + 1) * height / 2 - 12)}px)`;
    }
    for (const label of this.packagingFloorLabels || []) {
      const p = label.anchor.clone().project(camera);
      label.element.hidden = this.activeFloor !== 'packaging' || this.getPackagingLevel() !== 'all' || this.isolated || !this.labelsEnabled || p.z < -1 || p.z > 1 || Math.abs(p.x) > 1 || Math.abs(p.y) > 1;
      label.element.style.transform = `translate(${Math.round(clamp((p.x + 1) * width / 2 - 45, 10, width - 150))}px,${Math.round((-p.y + 1) * height / 2 - 12)}px)`;
    }
    const occupied = [];
    const entries = this.labels;
    for (const label of entries) {
      const onFloor = this.activeFloor === 'all' ? label.id === this.selected : label.floor === this.activeFloor && (label.floor !== 'packaging' || this.getPackagingLevel() === 'all' || (label.floorLevel ?? 3) === this.getPackagingLevel());
      const selected = label.id === this.selected;
      label.element.classList.toggle('selected', selected);
      label.element.classList.toggle('selected-name-dock', selected);
      label.element.setAttribute('aria-pressed', String(selected));
      if (selected) {
        // Selection is a stable readable caption, independent of the camera or
        // name length. It must not participate in projected-label rearranging.
        const dockWidth = Math.max(0, Math.min(360, width - 24));
        label.element.hidden = !onFloor;
        Object.assign(label.element.style, { left: '12px', bottom: '52px', width: `${dockWidth}px`, maxWidth: `${dockWidth}px`, transform: 'none', whiteSpace: 'normal' });
        label.line.style.display = label.dot.style.display = 'none';
        const h = label.element.offsetHeight || 56;
        label.layout = { x: 12, y: height - 52 - h, w: dockWidth, h, docked: true };
        continue;
      }
      if (label.element.style.left) Object.assign(label.element.style, { left: '', bottom: '', width: '', maxWidth: '', whiteSpace: 'nowrap' });
      const p = label.anchor.clone().project(camera);
      const visible = this.labelsEnabled && onFloor && !this.isolated && p.z > -1 && p.z < 1 && Math.abs(p.x) < 1.12 && Math.abs(p.y) < 1.12;
      label.element.hidden = !visible;
      label.line.style.display = label.dot.style.display = visible ? '' : 'none';
      if (!visible) continue;
      const w = label.element.offsetWidth || 120, h = label.element.offsetHeight || 36;
      const anchorX = (p.x + 1) * width / 2, anchorY = (-p.y + 1) * height / 2;
      let best = { score: Infinity, x: 8, y: 55 };
      for (const dx of [0, -w - 10, w + 10, -2 * w - 20, 2 * w + 20]) {
        for (const dy of [0, -h - 8, h + 8, -2 * h - 16, 2 * h + 16]) {
          const x = clamp(anchorX - w / 2 + dx, 8, Math.max(8, width - w - 8));
          const y = clamp(anchorY - h - 10 + dy, 55, Math.max(55, height - h - 25));
          const overlap = occupied.reduce((sum, r) => sum + Math.max(0, Math.min(x + w + 5, r.x + r.w + 5) - Math.max(x, r.x)) * Math.max(0, Math.min(y + h + 5, r.y + r.h + 5) - Math.max(y, r.y)), 0);
          const score = overlap * 1000 + dx * dx + dy * dy;
          if (score < best.score) best = { x, y, score };
        }
      }
      const { x, y } = best;
      occupied.push({ x, y, w, h });
      label.element.style.transform = `translate(${Math.round(x)}px,${Math.round(y)}px)`;
      label.layout = { x, y, w, h, anchorX, anchorY };
      label.line.setAttribute('x1', anchorX); label.line.setAttribute('y1', anchorY);
      label.line.setAttribute('x2', clamp(anchorX, x + 8, x + w - 8)); label.line.setAttribute('y2', y + h / 2);
      label.dot.setAttribute('cx', anchorX); label.dot.setAttribute('cy', anchorY);
    }
    for (const part of this.parts) {
      const visible = this.labelsEnabled && this.amount > .15 && part.root.userData.equipment === this.selected;
      part.label.hidden = !visible;
      if (!visible) continue;
      const bounds = new THREE.Box3().setFromObject(part.group);
      const point = bounds.getCenter(new THREE.Vector3()); point.y = bounds.max.y + .12;
      const p = point.project(camera);
      if (p.z < -1 || p.z > 1 || Math.abs(p.x) > 1 || Math.abs(p.y) > 1) { part.label.hidden = true; continue; }
      const w = part.label.offsetWidth || 100, h = part.label.offsetHeight || 28;
      const x = clamp((p.x + 1) * width / 2 - w / 2, 8, Math.max(8, width - w - 8));
      let y = clamp((-p.y + 1) * height / 2, 55, Math.max(55, height - h - 25));
      for (let pass = 0; pass < 8; pass++) {
        if (!occupied.some((r) => x < r.x + r.w + 5 && x + w + 5 > r.x && y < r.y + r.h + 5 && y + h + 5 > r.y)) break;
        y += h + 6;
      }
      y = Math.min(y, height - h - 20);
      occupied.push({ x, y, w, h });
      part.label.style.transform = `translate(${Math.round(x)}px,${Math.round(y)}px)`;
    }
  }

  _listen(target, event, handler, options) {
    target.addEventListener(event, handler, options);
    this.listeners.push(() => target.removeEventListener(event, handler, options));
  }

  _personModel() {
    if (this.personEnabled === false) return;
    const { root, limbs } = buildPersonAvatar(this);
    this.personAvatar = root; this.personLimbs = limbs;
    this.personMarker = document.createElement('span');
    this.personMarker.className = 'person-marker'; this.personMarker.textContent = '사람';
    this.personMarker.setAttribute('aria-hidden', 'true'); this.personMarker.hidden = true;
    this.canvas.parentElement.append(this.personMarker);
  }

  _personFrame() {
    if (this.activeFloor === 'campus') return PLACEMENT_REGIONS.campus;
    if (this.activeFloor === 'outdoor') {
      // The modelled 100RT rear service apron is part of the same walking
      // space, although equipment placement uses a separate registration box.
      const room=PLACEMENT_REGIONS.outdoor,apron=PLACEMENT_REGIONS.apron;
      return apron?{...room,minX:Math.min(room.minX,apron.minX),maxX:Math.max(room.maxX,apron.maxX),minZ:Math.min(room.minZ,apron.minZ),maxZ:Math.max(room.maxZ,apron.maxZ)}:room;
    }
    if (this.activeFloor === 'packaging') return this._packagingRoom().bounds || PLACEMENT_REGIONS.packaging;
    if (this.activeFloor === 8) return PLACEMENT_REGIONS.roof;
    return typeof this.activeFloor === 'number' && this.activeFloor >= 3 ? PLACEMENT_REGIONS.upper : PLACEMENT_REGIONS.building;
  }

  _personWalkLimits() {
    // On 3F, the 2026-11-24 walk confirms continuous passage from the 3F hall
    // through the NE stairwell landing and green outdoor roof into the air
    // compressor room. Keep the walking rectangle bounded to that confirmed
    // envelope so unfilmed south/far-east roof zones remain off-limits.
    if (this.activeFloor === 3) {
      const floor = FLOORS.find(entry => entry.id === 3);
      const room = floor?.rooms?.find(entry => entry.id === 'compressor-room')?.bounds;
      const walk = floor?.routeSurvey?.compressorWalk?.walkwayBounds;
      if (room && walk) {
        const frame = this._personFrame();
        return {
          ...frame,
          maxX: Math.max(frame.maxX, room.maxX, walk.maxX),
          minZ: Math.min(frame.minZ, room.minZ, walk.minZ),
          maxZ: Math.max(frame.maxZ, walk.maxZ),
        };
      }
    }
    return this._personFrame();
  }

  // 1.5층 관찰창 너머는 1층 홀이다. 입체·통로 보기에서는 1층 바닥·고정물·설비를
  // 원래 높이에 함께 보여 준다(2026-11-26 사용자 요청). 평면과 배치 편집은 층을 분리한다.
  _overlookContextLevels() {
    if (this.activeFloor !== 2 || this.isolated || this.placementMode || !['perspective', 'aisle'].includes(this.view)) return [];
    return [1];
  }

  _dryerRouteContextLevels() {
    if (this.isolated || this.placementMode || ![1, 2, 3].includes(this.activeFloor)) return [];
    // Floor cutaways show only their own deck, rooms and equipment. Keep the
    // adjoining levels at their real elevations only while walking through
    // the stairs or looking down through the mezzanine's observation windows.
    if (this.view !== 'person') return [];
    return FLOORS.filter(floor => [1, 2, 3].includes(floor.id) && floor.routeSurvey).map(floor => floor.id);
  }

  _personSupportMeshes() {
    const routeLevels = this._dryerRouteContextLevels();
    const key = `${this.activeFloor}:${this.activeFloor === 'packaging' ? this.getPackagingLevel() : ''}:${this.view}:${routeLevels.join(',')}`;
    if (this.personSupportCache?.key === key) return this.personSupportCache.meshes;
    const level = this.activeFloor === 'all' ? 1 : this.activeFloor;
    const building = this.buildingEnvironments?.get(level), upper = this.upperEnvironments?.get(level);
    const deck = this.floorDecks?.get(level), roots = new Set([deck, this.floorStructures?.get(level), level === 'packaging' ? this.packaging?.structure : null, building?.architectureFixtures, upper?.stairs]);
    const decks = new Set([deck]);
    for (const [contextLevel, environment] of this.upperEnvironments || []) {
      if (this.activeFloor === 'all' || contextLevel === level || (level === 7 && [6, 8].includes(contextLevel)) || (level === 6 && contextLevel === 7)) {
        roots.add(environment.deck); decks.add(environment.deck); roots.add(environment.stairs);
      }
    }
    if (this.activeFloor === 'all') for (const environment of this.buildingEnvironments?.values() || []) {
      roots.add(environment.deck); decks.add(environment.deck); roots.add(environment.architectureFixtures);
    }
    for (const contextLevel of routeLevels) {
      const environment = this.buildingEnvironments?.get(contextLevel);
      if (!environment) continue;
      roots.add(environment.deck); decks.add(environment.deck);
      roots.add(environment.structure); roots.add(environment.architectureFixtures);
    }
    if (level === 'packaging' && this.getPackagingLevel() === 'all') {
      for (const environment of this.packagingEnvironments?.values() || []) {
        roots.add(environment.deck); roots.add(environment.structure); decks.add(environment.deck);
      }
    }
    for (const item of this.equipment || []) {
      if (item.floor !== level && !routeLevels.includes(item.floor) && !(this.activeFloor === 'all' && typeof item.floor === 'number')) continue;
      if (level === 'packaging' && this.getPackagingLevel() !== 'all' && (item.floorLevel ?? 3) !== this.getPackagingLevel()) continue;
      roots.add(this.objects?.get(item.id));
    }
    const meshes = [], seen = new Set();
    for (const root of roots) root?.traverse(mesh => {
      if (!mesh.isMesh || seen.has(mesh)) return;
      seen.add(mesh);
      let surface = decks.has(root), names = '';
      // The filmed boiler floor is an unnamed thin box inside its shell.
      // Include that base only, without treating the shell's walls as a deck.
      const p = mesh.geometry?.parameters;
      if (['campus-boiler-room-shell', 'preparation-boiler-room-open-base'].includes(mesh.parent?.name) && p?.height * mesh.scale.y <= .2 && p?.width * mesh.scale.x > 2 && p?.depth * mesh.scale.z > 2) surface = true;
      for (let node = mesh; !surface && node; node = node.parent) {
        names += ` ${node.name || ''}`;
        if (/stair|platform|walkway|landing|deck/i.test(node.name || '')) surface = true;
        if (node === root) break;
      }
      if (!surface || /rail|beam|column|post|haunch|support|bracket|nosing|skirting|bollard|relief|kickplate|ladder|pump|motor|pipe|manifold|enclosure|door|sign|label/i.test(names)) return;
      if (mesh.geometry?.type !== 'BoxGeometry' && mesh.geometry?.type !== 'ExtrudeGeometry' && mesh.geometry?.type !== 'PlaneGeometry') return;
      meshes.push(mesh);
    });
    this.personSupportCache = { key, meshes };
    return meshes;
  }

  _personGroundHeight(position, meshes) {
    const level = this.activeFloor === 'all' ? 1 : this.activeFloor;
    const floorY = typeof level === 'number' ? floorElevation(level) : 0;
    // Lower storeys are visible through the 3F cutaway. Their floors must
    // not catch a walker stepping off the surveyed compressor roof apron.
    if ((this.activeFloor === 3 || this.activeFloor === 'all') && Math.abs(position[1] - floorElevation(3)) <= WALK_RULES.maxStep) {
      const roofs = this.buildingEnvironments?.get(3)?.deck.userData.lowWingRoofZones;
      if (roofs?.some(r => position[0] > r.minX && position[0] < r.maxX && position[2] > r.minZ && position[2] < r.maxZ)) return null;
    }
    const world = this.activeFloor === 'outdoor' ? fromRoomPosition(position, OUTDOOR_ROOM) : [...position];
    const offset = level === 'packaging' ? this._packagingDisplayOffset({ floor: 'packaging', floorLevel: this.getPackagingLevel() === 'all' ? 1 : this.getPackagingLevel() }) : 0;
    world[1] += offset;
    const ray = this.personGroundRay ||= new THREE.Raycaster();
    ray.set(new THREE.Vector3(world[0], world[1] + WALK_RULES.maxStep + .001, world[2]), new THREE.Vector3(0, -1, 0));
    ray.near = 0; ray.far = Infinity;
    const candidates = [];
    const bounds = this.personSupportBounds ||= new WeakMap();
    for (const mesh of meshes) {
      let entry = bounds.get(mesh);
      if (!entry || !entry.matrix.equals(mesh.matrixWorld)) {
        entry = { matrix: mesh.matrixWorld.clone(), box: new THREE.Box3().setFromObject(mesh) }; bounds.set(mesh, entry);
      }
      if (world[0] >= entry.box.min.x && world[0] <= entry.box.max.x && world[2] >= entry.box.min.z && world[2] <= entry.box.max.z && entry.box.min.y <= world[1] + WALK_RULES.maxStep + .001) candidates.push(mesh);
    }
    for (const hit of ray.intersectObjects(candidates, false)) {
      if (!hit.face) continue;
      const matrix = hit.object.matrixWorld.clone();
      if (hit.instanceId !== undefined) {
        const instance = new THREE.Matrix4(); hit.object.getMatrixAt(hit.instanceId, instance); matrix.multiply(instance);
      }
      const normal = hit.face.normal.clone().applyNormalMatrix(new THREE.Matrix3().getNormalMatrix(matrix));
      if (normal.y < .7) continue;
      // Narrow rods and vertical posts are never walking surfaces, including
      // unnamed structural members in the older architectural stair meshes.
      if (!hit.object.geometry.boundingBox) hit.object.geometry.computeBoundingBox();
      const box = hit.object.geometry.boundingBox.clone().applyMatrix4(matrix), size = box.getSize(new THREE.Vector3());
      if (Math.min(size.x, size.z) < .11 || Math.max(size.x, size.z) < .45) continue;
      return hit.point.y - offset;
    }
    // Beyond modelled geometry, retain a floor datum for unrestricted inspection.
    // Never pop upward onto that datum after descending a modelled lower stair.
    return Math.min(floorY, position[1]);
  }

  _personObstacles() {
    const ground=this.person?.position[1]??0;
    return this._personCollisionBodies().flatMap(body=>this._personCollisionInstances(body)).filter(body=>body.bounds.max.y>ground+.03&&body.bounds.min.y<ground+WALK_RULES.height).map(body=>{
      const corners=[[body.bounds.min.x,ground,body.bounds.min.z],[body.bounds.max.x,ground,body.bounds.min.z],[body.bounds.min.x,ground,body.bounds.max.z],[body.bounds.max.x,ground,body.bounds.max.z]].map(point=>this.activeFloor==='outdoor'?toRoomPosition(point,OUTDOOR_ROOM):point);
      return {minX:Math.min(...corners.map(p=>p[0])),maxX:Math.max(...corners.map(p=>p[0])),minZ:Math.min(...corners.map(p=>p[2])),maxZ:Math.max(...corners.map(p=>p[2]))};
    });
  }

  _personCollisionBodies() {
    this.scene.updateMatrixWorld(true);
    const level = this.activeFloor === 'all' ? 1 : this.activeFloor;
    const routeLevels=this._dryerRouteContextLevels(),levels=new Set([level,...routeLevels]);
    if(this.activeFloor==='all')for(const floor of FLOORS)levels.add(floor.id);
    if(level===7){levels.add(6);levels.add(8);}else if(level===6)levels.add(7);
    const key=`${this.activeFloor}:${this.activeFloor==='packaging'?this.getPackagingLevel():''}:${[...levels]}`;
    let cache=this.personCollisionMeshCache;
    if(!cache||cache.key!==key){
      const roots=new Set([this.floorDecks?.get(level),this.floorStructures?.get(level)]);
      const addEnvironment=environment=>{for(const root of Object.values(environment||{}))if(root?.isObject3D)roots.add(root);};
      for(const floor of levels){addEnvironment(this.buildingEnvironments?.get(floor));addEnvironment(this.upperEnvironments?.get(floor));}
      if(level==='campus')addEnvironment(this.campus);
      if(level==='outdoor')addEnvironment(this.outdoor);
      if(level==='packaging'){
        if(this.getPackagingLevel()==='all')for(const environment of this.packagingEnvironments?.values()||[])addEnvironment(environment);
        else addEnvironment(this.packaging);
      }
      for(const item of this.equipment||[]){
        if(!levels.has(item.floor)||item.id==='campus-outdoor-area'||(level==='packaging'&&this.getPackagingLevel()!=='all'&&(item.floorLevel??3)!==this.getPackagingLevel()))continue;
        roots.add(this.objects?.get(item.id));
      }
      const bodies=[],seen=new Set();
      for(const root of roots)root?.traverse(mesh=>{
        if(!mesh.isMesh||seen.has(mesh)||!mesh.geometry?.attributes?.position||mesh.userData.personCollision===false||(mesh.userData.buildingColumn&&this.columnsEnabled===false))return;
        for(let node=mesh;node;node=node.parent)if(node.userData.preparationEnvelopeOmitted||node.userData.personCollision===false)return;
        // Text/decal planes are annotations, while transparent physical glass
        // and door glazing still take part in collision.
        const paints=Array.isArray(mesh.material)?mesh.material:[mesh.material];
        if(paints.every(p=>!p||p.visible===false)||(mesh.geometry.type==='PlaneGeometry'&&paints.every(p=>p?.isMeshBasicMaterial&&p.map&&p.transparent&&p.depthWrite===false)))return;
        let stepDetail=/architectural-stair-(?:nosing|riser)|packaging-building-stair-nosing/.test(mesh.name);
        for(let node=mesh;node&&node!==root;node=node.parent)if(node.name==='preparation-platform-cream-beams-and-column-haunches')stepDetail=true;
        seen.add(mesh);bodies.push({mesh,root,stepDetail,matrix:new THREE.Matrix4().set(...Array(16).fill(0)),bounds:new THREE.Box3(),instances:null});
      });
      cache=this.personCollisionMeshCache={key,bodies};
    }
    for(const body of cache.bodies){
      if(body.matrix.equals(body.mesh.matrixWorld))continue;
      body.matrix.copy(body.mesh.matrixWorld);body.instances=null;
      if(body.mesh.isInstancedMesh){body.mesh.computeBoundingBox();body.bounds.copy(body.mesh.boundingBox).applyMatrix4(body.matrix);}
      else {body.mesh.geometry.computeBoundingBox();body.bounds.copy(body.mesh.geometry.boundingBox).applyMatrix4(body.matrix);}
    }
    return cache.bodies;
  }

  _personCollisionInstances(body) {
    if(body.instances)return body.instances;
    const instances=[],temporary=new THREE.Matrix4();
    for(let index=0;index<(body.mesh.isInstancedMesh?body.mesh.count:1);index++){
      const matrix=body.matrix.clone();if(body.mesh.isInstancedMesh){body.mesh.getMatrixAt(index,temporary);matrix.multiply(temporary);}
      instances.push({mesh:body.mesh,stepDetail:body.stepDetail,matrix,inverse:matrix.clone().invert(),bounds:body.mesh.geometry.boundingBox.clone().applyMatrix4(matrix),vertices:null});
    }
    return body.instances=instances;
  }

  _personBodyPenetrations(position,bodies,supports) {
    const world=this.activeFloor==='outdoor'?fromRoomPosition(position,OUTDOOR_ROOM):[...position];
    if(this.activeFloor==='packaging')world[1]+=this._packagingDisplayOffset({floor:'packaging',floorLevel:this.getPackagingLevel()==='all'?1:this.getPackagingLevel()});
    const radius=WALK_RULES.radius-.002,feet=new THREE.Vector3(...world),start=feet.clone().addScaledVector(Y,WALK_RULES.radius),end=feet.clone().addScaledVector(Y,WALK_RULES.height-WALK_RULES.radius);
    const bodyBounds=new THREE.Box3(new THREE.Vector3(world[0]-radius,world[1]+.015,world[2]-radius),new THREE.Vector3(world[0]+radius,world[1]+WALK_RULES.height,world[2]+radius));
    const a=new THREE.Vector3(),b=new THREE.Vector3(),c=new THREE.Vector3(),point=new THREE.Vector3(),result=new Map();
    for(const body of bodies){
      if(!body.bounds.intersectsBox(bodyBounds))continue;
      for(const collider of this._personCollisionInstances(body)){
        // The same reachable-step allowance applies to low door thresholds,
        // floor markings and small floor-level fittings, not only stair treads.
        if(!collider.bounds.intersectsBox(bodyBounds)||collider.bounds.max.y<=world[1]+WALK_RULES.maxStep+.001)continue;
        // Reachable tread noses and risers enter the lower leg space before
        // the support sample reaches their centre; railings remain solid.
        if((supports.has(collider.mesh)||collider.stepDetail)&&collider.bounds.max.y<=world[1]+WALK_RULES.maxStep+WALK_RULES.radius+.01)continue;
        if(!collider.vertices){
          const attr=collider.mesh.geometry.attributes.position,index=collider.mesh.geometry.index,count=index?index.count:attr.count;
          collider.vertices=new Float64Array(count*3);
          for(let i=0;i<count;i++){point.fromBufferAttribute(attr,index?index.getX(i):i).applyMatrix4(collider.matrix);point.toArray(collider.vertices,i*3);}
        }
        const vertices=collider.vertices;
        const inside=personInsideCollider(collider,point.copy(start).lerp(end,.5),new THREE.Vector3(),a,b,c);
        let distance=Infinity;
        for(let i=0;i<vertices.length;i+=9){
          a.fromArray(vertices,i);b.fromArray(vertices,i+3);c.fromArray(vertices,i+6);
          if(!inside&&(Math.max(a.y,b.y,c.y)<world[1]-.01||Math.min(a.y,b.y,c.y)>world[1]+WALK_RULES.height||Math.max(a.x,b.x,c.x)<bodyBounds.min.x||Math.min(a.x,b.x,c.x)>bodyBounds.max.x||Math.max(a.z,b.z,c.z)<bodyBounds.min.z||Math.min(a.z,b.z,c.z)>bodyBounds.max.z))continue;
          distance=Math.min(distance,personTriangleDistanceSq(start,end,a,b,c));
        }
        // A moved solid box may already contain the avatar. Distinguish its
        // interior from an empty room-shaped group so escape can reduce the
        // overlap without permitting a crossing to the opposite wall.
        if(distance<radius*radius-1e-8||inside)result.set(collider,inside?radius+Math.sqrt(distance):radius-Math.sqrt(distance));
      }
    }
    return result;
  }

  _personCanOccupy(position,previous,bodies=this._personCollisionBodies(),supports=new Set(this._personSupportMeshes())) {
    const next=this._personBodyPenetrations(position,bodies,supports);
    if(!next.size)return true;
    if(!previous)return false;
    const before=this._personBodyPenetrations(previous,bodies,supports);
    for(const [body,depth]of next)if(!before.has(body)||!(depth<before.get(body)-1e-6))return false;
    return true;
  }

  _ensurePerson() {
    if (!this.personCamera) return;
    const key = `${this.activeFloor}:${this.activeFloor === 'packaging' ? this.getPackagingLevel() : ''}`;
    if (this.personArea === key && this.person) return;
    if (this.personArea && this.person) this.personStates.set(this.personArea, this.person);
    this.personArea = key; this.personObstacleCache = null; this.personSupportCache = null; this.personEyeY = null;
    this.person = this.personStates.get(key) || null;
    if (!this.person) this.resetPerson();
    this._updatePersonCamera();
  }

  resetPerson({ focus = false } = {}) {
    if (!this.personCamera) return;
    this._stopPerson();
    const frame = this._personFrame(), floor = this.activeFloor === 'all' ? 1 : this.activeFloor;
    let position = [0, typeof floor === 'number' ? floorElevation(floor) : 0, 0], yaw = 0;
    if (floor === 'campus') position = [CAMPUS_ROOM.layout.entrance.laneX, 0, CAMPUS_ROOM.layout.entrance.gateZ + 8];
    else if (floor === 'outdoor') { position = [7, 0, OUTDOOR_ROOM.aisleCenterZ]; yaw = Math.PI / 2; }
    else if (floor === 'packaging') {
      const start = this._packagingRoom().path?.[0] || [0, WALK_RULES.eyeHeight, 13];
      position = [start[0], 0, start[2]];
    } else {
      const start = FLOORS.find(entry => entry.id === floor)?.personStart;
      if (start) { position = [...start.position]; yaw = start.yaw; }
      else position = [Math.min(frame.maxX - 1, 5.5), position[1], frame.maxZ - 1.2];
    }
    this.person = createPersonState({ position, yaw }); this.personObstacleCache = null;
    const bodies=this._personCollisionBodies(),supports=new Set(this._personSupportMeshes());
    // Search from the entrance for a clear footprint, including after the user
    // has moved equipment. Never start the eye inside a machine or wall.
    const available=candidate=>isPersonPositionFree(candidate,{bounds:frame})&&this._personCanOccupy(candidate,null,bodies,supports);
    if (!available(position)) {
      const candidates = [];
      for (let x = frame.minX + .6; x <= frame.maxX - .6; x += .8) for (let z = frame.minZ + .6; z <= frame.maxZ - .6; z += .8) candidates.push([x, position[1], z]);
      candidates.sort((a, b) => Math.hypot(a[0] - position[0], a[2] - position[2]) - Math.hypot(b[0] - position[0], b[2] - position[2]));
      const free = candidates.find(available);
      if (free) this.person = createPersonState({ position: free, yaw });
    }
    this.personStride = 0; this.personEyeY = null; this._updatePersonCamera();
    if (focus && this.view !== 'person') {
      this.goalTarget.copy(this._personWorldPosition()).addScaledVector(Y, this.view === 'top' ? 0 : 1);
      this.navigationEdited = true;
      this.campusTopFit = this.packagingTopFit = this.dryerTopFit = false;
      if (this.view === 'top') { this.topCamera.zoom = 1.7; this.topCamera.updateProjectionMatrix(); }
      else this.goalOrbit.distance = 14;
    }
    this._invalidate();
  }

  _personWorldPosition() {
    const position = this.activeFloor === 'outdoor' ? fromRoomPosition(this.person.position, OUTDOOR_ROOM) : [...this.person.position];
    if (this.activeFloor === 'packaging') position[1] += this._packagingDisplayOffset({ floor: 'packaging', floorLevel: this.getPackagingLevel() === 'all' ? 1 : this.getPackagingLevel() });
    return new THREE.Vector3(...position);
  }

  visitDryerInspectionPoint(origin, target) {
    if (this.activeFloor !== 3 || this.placementMode || !this.personCamera) return false;
    const y = floorElevation(3);
    const [x,z] = origin;
    const previousView = this.view;
    this.setView('person');
    const bodies = this._personCollisionBodies(), supports = new Set(this._personSupportMeshes());
    const offsets = [[0,0],[0,-.35],[0,.35],[-.3,0],[.3,0],[0,-.7],[0,.7],[-.55,0],[.55,0]];
    const position = offsets.map(([dx,dz]) => [x+dx,y,z+dz]).find(p => this._personCanOccupy(p,null,bodies,supports));
    if (!position) { this.setView(previousView); return false; }
    const dx = target[0]-position[0], dz = target[2]-position[2];
    this.person = createPersonState({position, yaw: Math.atan2(dx,-dz),
      pitch: Math.atan2(target[1]-y-WALK_RULES.eyeHeight,Math.hypot(dx,dz))});
    this.personEyeY = null;
    this.personStride = 0;
    this._updatePersonCamera(); this._invalidate(); return true;
  }

  _updatePersonCamera() {
    if (!this.person || !this.personCamera) return;
    const feet = this._personWorldPosition(), yaw = this.person.yaw - (this.activeFloor === 'outdoor' ? OUTDOOR_ROOM.rotation : 0);
    this.personCamera.position.copy(feet).addScaledVector(Y, WALK_RULES.eyeHeight);
    if (Number.isFinite(this.personEyeY)) this.personCamera.position.y = this.personEyeY;
    const pitch = this.person.pitch;
    this.personCamera.lookAt(this.personCamera.position.clone().add(new THREE.Vector3(Math.sin(yaw) * Math.cos(pitch), Math.sin(pitch), -Math.cos(yaw) * Math.cos(pitch))));
    this.personCamera.updateMatrixWorld();
    if (this.personAvatar) {
      this.personAvatar.position.copy(feet); this.personAvatar.rotation.y = -yaw;
      this.personAvatar.visible = this.view !== 'person' && !this.isolated && !this.placementMode;
      for (const { arm, leg, side } of this.personLimbs || []) { arm.rotation.x = Math.sin(this.personStride || 0) * side * .35; leg.rotation.x = -arm.rotation.x; }
    }
    if (this.canvas.dataset) this.canvas.dataset.view = this.view;
  }

  _updatePersonMarker() {
    if (!this.personMarker || !this.personAvatar) return;
    const point = this.personAvatar.position.clone().addScaledVector(Y, 2.1).project(this._currentCamera());
    const visible = this.personAvatar.visible && point.z > -1 && point.z < 1 && Math.abs(point.x) < .95 && Math.abs(point.y) < .95;
    this.personMarker.hidden = !visible;
    if (visible) this.personMarker.style.transform = `translate(${(point.x + 1) * this.width / 2}px,${(1 - point.y) * this.height / 2}px) translate(-50%,-100%)`;
  }

  _stopPerson() {
    this.personInputs?.clear();
    if (this.personStride) { this.personStride = 0; this._updatePersonCamera(); this._invalidate(); }
  }

  _updateProximityDoors(elapsed) {
    if (!this.proximityDoors) return false;
    const position = this.person && this.view === 'person' && !this.placementMode && !this.isolated ? this._personWorldPosition() : null;
    const animating=this.proximityDoors.update(position, elapsed, { autoOpen: !(this.presentationOnly || this.controlledPresentation) && !!this.autoOpenDoors, reducedMotion: this.reducedMotion });
    this._syncDoorInteraction(position);
    return animating;
  }

  _personDoorDirection() {
    const yaw=(this.person?.yaw||0)-(this.activeFloor==='outdoor'?OUTDOOR_ROOM.rotation:0);
    return [Math.sin(yaw),0,-Math.cos(yaw)];
  }

  _syncDoorInteraction(position) {
    const interaction=position ? this.proximityDoors?.getInteraction?.(position,{direction:this._personDoorDirection()}) : null;
    const key=JSON.stringify([interaction?.id,interaction?.action,!!this.autoOpenDoors]);
    if(key!==this._doorInteractionKey){this._doorInteractionKey=key;this.onDoorInteraction?.(interaction);}
  }

  setAutomaticDoors(value) {
    this.autoOpenDoors=!(this.presentationOnly || this.controlledPresentation) && !!value;this._doorInteractionKey=null;this._updateProximityDoors(0);this._invalidate();
  }

  interactDoor() {
    if(this.view!=='person'||!this.person||this.placementMode||this.isolated||this.autoOpenDoors)return false;
    const position=this._personWorldPosition();
    const changed=this.proximityDoors?.toggleNearest?.(position,{direction:this._personDoorDirection()})||false;
    this._syncDoorInteraction(position);if(changed)this._invalidate();return changed;
  }

  getPresentationDoorState(nextPose) {
    if (!(this.presentationOnly || this.controlledPresentation) || !this.person || this.view !== 'person' || this.disposed) return null;
    const valid = value => Array.isArray(value) && value.length === 3 && value.every(Number.isFinite);
    if (nextPose && nextPose.floor !== this.activeFloor) return null;
    const current = this._personWorldPosition().toArray();
    const next = valid(nextPose?.position) ? nextPose.position : current;
    const facing = valid(nextPose?.lookAt) ? new THREE.Vector3(nextPose.lookAt[0]-next[0],0,nextPose.lookAt[2]-next[2]).normalize() : new THREE.Vector3(...this._personDoorDirection());
    let nearest = null;
    for (const door of this.proximityDoors?.getPassages?.({ includeAll: true }) || []) {
      const p = door.point, n = new THREE.Vector3(door.normal[0],0,door.normal[2]).normalize();
      if (n.lengthSq() < .5 || Math.abs(current[1]-p[1]) > Math.min(1.3,door.height/2+.2)) continue;
      const distance = Math.hypot(current[0]-p[0],current[2]-p[2]);
      if (distance > (door.interactionDistance || 2.2)) continue;
      const da = (current[0]-p[0])*n.x+(current[2]-p[2])*n.z;
      const db = (next[0]-p[0])*n.x+(next[2]-p[2])*n.z;
      const lateral = (current[0]-p[0])*-n.z+(current[2]-p[2])*n.x;
      const toward = new THREE.Vector3(p[0]-current[0],0,p[2]-current[2]).normalize();
      const ahead = facing.lengthSq() > .5 && toward.dot(facing) > .55;
      const aligned = Math.abs(lateral) <= door.width/2+.08;
      let crossing = false;
      if (da*db <= 0 && Math.abs(da-db) > 1e-8) {
        const fraction = da/(da-db);
        const x = current[0]+fraction*(next[0]-current[0]), z = current[2]+fraction*(next[2]-current[2]);
        crossing = Math.abs((x-p[0])*-n.z+(z-p[2])*n.x) <= door.width/2+.08;
      }
      // Leave room for a hinged leaf to sweep past the person's 0.3m body
      // radius before the explicit presentation action starts opening it.
      const waitingDistance = 1.35;
      const towardPlane = aligned && Math.abs(db) < Math.abs(da)-1e-6;
      if (nextPose && !crossing && !towardPlane) continue;
      const approaching = towardPlane && Math.min(Math.abs(da),Math.abs(db)) <= waitingDistance;
      const inFront = aligned && ahead && Math.abs(da) <= waitingDistance;
      const blocked = !door.open && (crossing || approaching || inFront);
      // Only the doorway on the walking line opens ahead. Passing along a
      // corridor must not open side-room doors such as the dressing room.
      if (!blocked && !(aligned && ahead) && !door.requestedOpen) continue;
      const state = { id:door.id,label:door.label,action:door.action,blocked,distance,open:door.open,progress:door.progress };
      if (!nearest || (blocked && !nearest.blocked) || (blocked === nearest.blocked && distance < nearest.distance)) nearest = state;
    }
    return nearest;
  }

  interactPresentationDoor(id = this.getPresentationDoorState()?.id) {
    if (!(this.presentationOnly || this.controlledPresentation) || !this.person || this.view !== 'person' || this.disposed || !id) return false;
    const position = this._personWorldPosition();
    const door = this.proximityDoors?.getPassages?.({ includeAll: true }).find(item => item.id === id);
    if (!door || Math.abs(position.y-door.point[1]) > Math.min(1.3,door.height/2+.2) || Math.hypot(position.x-door.point[0],position.z-door.point[2]) > (door.interactionDistance || 2.2)) return false;
    const changed = this.proximityDoors.toggleById(id);
    this._syncDoorInteraction(position); if (changed) this._invalidate();
    return changed;
  }

  resetPresentationDoors() {
    if (!this.presentationOnly || this.disposed) return false;
    this.proximityDoors?.reset();
    this.autoOpenDoors = false; this._doorInteractionKey = null;
    this._invalidate();
    return true;
  }

  setPersonViewScale(value) {
    const scale=Number(value);if(!Number.isFinite(scale))return false;
    this.personViewScale=clamp(scale,.75,1.25);
    this._syncPersonFieldOfView();
    this._invalidate();return true;
  }

  _syncPersonFieldOfView() {
    if (!this.personCamera) return;
    const aspect = Math.max(.01, this.personCamera.aspect || 1);
    const vertical = Math.tan(WALK_RULES.verticalFov * Math.PI / 360);
    const horizontal = Math.tan(WALK_RULES.horizontalFov * Math.PI / 360) / aspect;
    const scale = clamp(this.personViewScale || 1, .75, 1.25);
    this.personCamera.fov = 2 * Math.atan(Math.min(vertical, horizontal) / scale) * 180 / Math.PI;
    this.personCamera.updateProjectionMatrix();
  }

  _resolvePersonDoorCrossing(before) {
    if(this.view!=='person'||!this.proximityDoors?.getPassages)return false;
    const a=this.activeFloor==='outdoor'?fromRoomPosition(before.position,OUTDOOR_ROOM):before.position,b=this._personWorldPosition().toArray();
    for(const door of this.proximityDoors.getPassages({includeAll:true})) {
      const n=door.normal,p=door.point;
      const da=(a[0]-p[0])*n[0]+(a[2]-p[2])*n[2],db=(b[0]-p[0])*n[0]+(b[2]-p[2])*n[2];
      if(da*db>0||Math.abs(da-db)<1e-8)continue;
      const t=da/(da-db),x=a[0]+t*(b[0]-a[0]),z=a[2]+t*(b[2]-a[2]),y=a[1]+t*(b[1]-a[1]);
      if(Math.abs((x-p[0])*-n[2]+(z-p[2])*n[0])>door.width/2+.12||Math.abs(y-p[1])>1.3)continue;
      if(!door.open){this.person=createPersonState(before);return false;}
      if(door.portal?.area==='packaging'&&this.activeFloor==='campus'&&da>0&&db<=0&&this._areaEnabled('packaging')) {
        this._stopPerson();this.select(null);this.onSelect?.(null);
        this.setPackagingLevel(door.portal.level||1);this.setFloor('packaging');this.onFloorChange?.('packaging');
        this.resetPerson();
        const inside=this.proximityDoors.getPassages().find(item=>item.portal?.area==='campus'&&item.portal.entry===door.portal.entry);
        if(inside) {
          const p=inside.point,n=inside.normal;
          this.proximityDoors.setPassageOpen(inside.id,true,{immediate:true});
          this.person=createPersonState({position:[p[0]-n[0]*.9,p[1],p[2]-n[2]*.9],yaw:Math.atan2(-n[0],n[2])});
          this.personEyeY=null;
        }
        this.setView('person');return true;
      }
      if(door.portal?.area==='campus'&&this.activeFloor==='packaging'&&this.getPackagingLevel()===1&&da<0&&db>=0&&this._areaEnabled('campus')) {
        this._stopPerson();this.select(null);this.onSelect?.(null);this.setFloor('campus');this.onFloorChange?.('campus');
        const outside=this.proximityDoors.getPassages().find(item=>item.portal?.area==='packaging'&&item.portal.entry===door.portal.entry);
        if(outside) {
          const p=outside.point,n=outside.normal;
          this.proximityDoors.setPassageOpen(outside.id,true,{immediate:true});
          this.person=createPersonState({position:[p[0]+n[0]*1.7,p[1],p[2]+n[2]*1.7],yaw:Math.atan2(n[0],-n[2])});
          this.personEyeY=null;
        }
        this.setView('person');return true;
      }
    }
    return false;
  }

  setPersonInput(action, pressed) {
    if (this.personEnabled === false || this.controlledPresentation) return;
    if (!this.personInputs || !['forward', 'backward', 'left', 'right', 'fast'].includes(action)) return;
    if (!pressed) { this.personInputs.delete(action); if (!this.personInputs.size) this._stopPerson(); else this._invalidate(); return; }
    if (this.disposed || !this.active || this.placementMode || this.canvas.ownerDocument?.hidden || this.canvas.checkVisibility?.() === false || this.canvas.ownerDocument?.querySelector('dialog[open]')) return;
    this._ensurePerson(); this.personInputs.add(action); this._invalidate();
  }

  _advancePerson(elapsed) {
    if (!this.person || this.controlledPresentation) return false;
    const eyeGoal = this._personWorldPosition().y + WALK_RULES.eyeHeight;
    const settling = this.person.verticalVelocity < 0 || (Number.isFinite(this.personEyeY) && Math.abs(this.personEyeY - eyeGoal) > .001);
    if (!this.personInputs?.size && !settling) return false;
    if (!this.active || this.placementMode || this.canvas.ownerDocument?.hidden || this.canvas.checkVisibility?.() === false || this.canvas.ownerDocument?.querySelector('dialog[open]')) { this._stopPerson(); return false; }
    const before = this.person;
    const meshes = this._personSupportMeshes();
    this.scene.updateMatrixWorld(true);
    const bodies=this._personCollisionBodies(),supports=new Set(meshes);
    if (!Number.isFinite(this.personEyeY)) this.personEyeY = eyeGoal;
    this.person = advancePerson(before, { forward: Number(this.personInputs.has('forward')) - Number(this.personInputs.has('backward')), turn: Number(this.personInputs.has('right')) - Number(this.personInputs.has('left')), fast: this.personInputs.has('fast'), delta: elapsed, bounds:this._personWalkLimits(), groundHeight: position => this._personGroundHeight(position, meshes), canOccupy:(position,previous)=>this._personCanOccupy(position,previous,bodies,supports) });
    if(this._resolvePersonDoorCrossing(before))return true;
    const nextEye = this._personWorldPosition().y + WALK_RULES.eyeHeight;
    this.personEyeY += (nextEye - this.personEyeY) * (this.reducedMotion ? 1 : 1 - Math.exp(-Math.min(Math.max(elapsed, 0), WALK_RULES.maxDelta) * WALK_RULES.eyeResponse));
    if (Math.abs(this.personEyeY - nextEye) < .001) this.personEyeY = nextEye;
    const distance = Math.hypot(this.person.position[0] - before.position[0], this.person.position[2] - before.position[2]);
    this.personStride = distance > 1e-6 ? (this.personStride || 0) + distance * 5 : 0;
    this._updatePersonCamera();
    return true;
  }

  setPresentationPose({ floor, position, lookAt, walkDistance = 0 } = {}) {
    const point = value => Array.isArray(value) && value.length === 3 && value.every(Number.isFinite);
    if (!this.controlledPresentation || !this.personCamera || ![1, 2, 3, 4, 5, 6, 7, 8].includes(floor) || !point(position) || !point(lookAt)) return false;
    if (this.activeFloor !== floor) this.setFloor(floor);
    this._stopPerson();
    const eyeY = position[1] + WALK_RULES.eyeHeight;
    const dx = lookAt[0] - position[0], dz = lookAt[2] - position[2];
    this.person = createPersonState({ position, yaw: Math.atan2(dx, -dz), pitch: Math.atan2(lookAt[1] - eyeY, Math.hypot(dx, dz)) });
    const stride = Number.isFinite(walkDistance) ? Math.max(0, walkDistance) : 0;
    this.personEyeY = eyeY + Math.sin(stride * Math.PI * 2 / .72) * .012;
    this.personStride = stride * 5;
    this.autoOpenDoors = false;
    if (this.view !== 'person') {
      this.view = 'person'; this.isolated = false; this.explosion = this.amount = 0;
      this._visibility(); this.onViewChange('person');
    }
    this._updatePersonCamera(); this._invalidate();
    return true;
  }

  _setHover(id) {
    const next = id && this.objects?.has(id) ? id : null;
    this.canvas.style.cursor = this.dragPlacement ? 'grabbing' : this.placementMode ? 'grab' : next ? 'pointer' : '';
    if (next === this.hovered) return;
    this.hovered = next;
    if (!next) {
      if (this.hoverOutline) this.hoverOutline.visible = false;
      if (this.hoverHint) this.hoverHint.hidden = true;
      this._invalidate(); return;
    }
    const root = this.objects.get(next);
    root.updateWorldMatrix(true, true);
    const body = this.parts.find((part) => part.root === root)?.group || root;
    const bounds = new THREE.Box3().setFromObject(body);
    if (bounds.isEmpty()) return;
    if (!this.hoverOutline) {
      this.hoverOutline = new THREE.Box3Helper(new THREE.Box3(), 0x6fbdad);
      this.hoverOutline.material.transparent = true; this.hoverOutline.material.opacity = .8;
      this.hoverOutline.material.depthWrite = false; this.hoverOutline.renderOrder = 3;
      this.scene.add(this.hoverOutline);
      this.geometries.add(this.hoverOutline.geometry); this.materials.add(this.hoverOutline.material);
    }
    this.hoverOutline.box.copy(bounds).expandByScalar(.06); this.hoverOutline.visible = true;
    if (!this.hoverHint) {
      this.hoverHint = document.createElement('span'); this.hoverHint.className = 'equipment-hover-hint';
      this.hoverHint.setAttribute('aria-hidden', 'true'); this.canvas.parentElement.append(this.hoverHint);
    }
    const linkedRoom = (this.equipment || []).find((item) => item.id === next)?.roomLink;
    this.hoverHint.textContent = this.placementMode ? '설비 본체를 끌어 이동' : linkedRoom ? linkedRoom === 'packaging' ? '클릭하여 스틱·소포장 열기' : linkedRoom === 'outdoor' ? '클릭하여 실외기실 열기' : '클릭하여 건조실 내부 열기' : '클릭하여 설비 선택';
    this.hoverHint.hidden = false;
    this._invalidate();
  }

  _clearHover() {
    if (!this.hovered && !this.hoverOutline?.visible && !this.hoverHint) return;
    this._setHover(null);
  }

  _hoverFromPointer(event, force = false) {
    const now = event.timeStamp || 0;
    if (!force && now > 0 && now - this.lastHoverPick < 48) return;
    this.lastHoverPick = now;
    this._setHover(this._hit(event)?.userData.equipment || null);
  }

  _controls() {
    if (this.controlsBound) return;
    this.controlsBound = true;
    const canvas = this.canvas;
    canvas.style.touchAction = 'none';
    this._listen(canvas, 'contextmenu', (event) => event.preventDefault());
    // A dropped GPU context (long background tab, sleep, driver reset) left a
    // black or half-drawn model after returning. Pause while it is lost and
    // redraw everything once the browser restores it.
    this._listen(canvas, 'webglcontextlost', (event) => {
      event.preventDefault(); this.contextLost = true;
      if (this.frame !== null) { cancelAnimationFrame(this.frame); this.frame = null; }
      this._recoverContext();
    });
    this._listen(canvas, 'webglcontextrestored', () => {
      this.contextLost = false; clearTimeout(this.contextRestoreTimer);
      this.resize(); this.dirty = true; this._invalidate();
    });
    if (this.controlledPresentation) return;
    this._bindNavigationControls();
  }

  _bindNavigationControls() {
    if (this.navigationControlsBound) return;
    this.navigationControlsBound = true;
    const canvas = this.canvas, pointers = new Map();
    let gesture = null, travel = 0, multiTouch = false, lastTap = null, lastTouchZoomAt = 0;
    this._cancelNavigationGesture = () => {
      const captured = [...pointers.keys()]; pointers.clear();
      gesture = null; travel = 0; multiTouch = false; lastTap = null; lastTouchZoomAt = 0;
      for (const id of captured) if (canvas.hasPointerCapture?.(id)) canvas.releasePointerCapture(id);
      this._cancelPendingPick(); this._clearHover();
    };
    this._listen(canvas, 'pointerdown', (event) => {
      if (this.controlledPresentation || event.button > 2) return;
      canvas.focus?.({ preventScroll: true });
      this._cancelPendingPick();
      if (event.button === 1) event.preventDefault?.();
      canvas.setPointerCapture(event.pointerId);
      if (!pointers.size) multiTouch = false;
      pointers.set(event.pointerId, { x: event.clientX, y: event.clientY });
      if (pointers.size > 1) { multiTouch = true; lastTap = null; }
      gesture = { x: event.clientX, y: event.clientY, button: event.button, shift: event.shiftKey };
      travel = 0;
      if (this.view === 'person') { this._clearHover(); return; }
      if (pointers.size === 1 && event.button === 0 && !event.shiftKey) this._hoverFromPointer(event, true);
      else this._clearHover();
      if (pointers.size > 1 && this.dragPlacement) this._endPlacement();
      if (this.placementMode && pointers.size === 1 && event.button === 0 && !event.shiftKey) {
        const id = this._hit(event)?.userData.equipment;
        const item = this.equipment.find((entry) => entry.id === id);
        if (item) {
          this.onSelect(id);
          this.explosion = this.amount = 0; this._moveParts();
          const point = this._placementPoint(event, item.position[1]);
          if (point) {
            this.dragPlacement = { id, pointerId: event.pointerId, height: item.position[1], offset: new THREE.Vector3(...item.position).sub(point) };
            this.onTransformChange({ id, position: [...item.position], rotation: item.rotation || 0, phase: 'start' });
            canvas.style.cursor = 'grabbing';
          }
        }
      }
    });
    this._listen(canvas, 'pointermove', (event) => {
      if (this.controlledPresentation) return;
      if (!pointers.has(event.pointerId) || !gesture) {
        if (this.view !== 'person' && !pointers.size && event.pointerType !== 'touch') this._hoverFromPointer(event);
        return;
      }
      const previous = pointers.get(event.pointerId), dx = event.clientX - previous.x, dy = event.clientY - previous.y;
      travel += Math.abs(dx) + Math.abs(dy);
      if (travel >= 6) { this._clearHover(); lastTap = null; }
      if (this.view === 'person') {
        if (pointers.size === 1 && this.person) {
          this.person = lookPerson(this.person, dx, dy); this._updatePersonCamera();
        }
      } else if (this.dragPlacement && pointers.size === 1) {
        const point = this._placementPoint(event, this.dragPlacement.height);
        if (point) {
          point.add(this.dragPlacement.offset);
          this.setTransform(this.dragPlacement.id, { position: point.toArray() });
          const item = this.equipment.find((entry) => entry.id === this.dragPlacement.id);
          this.onTransformChange({ id: item.id, position: [...item.position], rotation: item.rotation || 0, phase: 'move' });
        }
      } else if (pointers.size === 2) {
        const other = [...pointers.entries()].find(([id]) => id !== event.pointerId)[1];
        const before = Math.hypot(previous.x - other.x, previous.y - other.y);
        const after = Math.hypot(event.clientX - other.x, event.clientY - other.y);
        if (before && after) this.zoomBy(after / before, { clientX: (previous.x + other.x) / 2, clientY: (previous.y + other.y) / 2 });
        this._panBy(dx / 2, dy / 2);
      } else if (gesture.button === 2 || gesture.button === 1 || gesture.shift || this.view === 'top') {
        this._panBy(dx, dy);
      } else if (this.view === 'aisle') {
        this.navigationEdited = true;
        // Turn at the current eye position instead of orbiting out of the aisle.
        const eye = this.goalTarget.clone().add(this._orbitOffset(this.goalOrbit));
        this.goalOrbit.azimuth -= dx * .0045;
        this.goalOrbit.elevation = clamp(this.goalOrbit.elevation + dy * .0035, -1.4, 1.4);
        this.goalTarget.copy(eye).sub(this._orbitOffset(this.goalOrbit));
      } else {
        this.navigationEdited = true;
        this.goalOrbit.azimuth -= dx * .006;
        this.goalOrbit.elevation = clamp(this.goalOrbit.elevation + dy * .0045, -1.5, 1.5);
        if (this.view !== 'perspective') { this.view = 'perspective'; this.onViewChange(this.view); }
      }
      pointers.set(event.pointerId, { x: event.clientX, y: event.clientY }); this._invalidate();
    });
    const release = (event, cancelled = false) => {
      if (!pointers.has(event.pointerId)) return;
      const placing = !!this.dragPlacement;
      if (placing) this._endPlacement();
      if (!this.controlledPresentation && !placing && !cancelled && !multiTouch && travel < 6 && pointers.size === 1 && event.button === 0) {
        const now = event.timeStamp || Date.now();
        if (event.pointerType === 'touch' && lastTap && now - lastTap.time < 320 && lastTap.floor === this.activeFloor && Math.hypot(event.clientX - lastTap.x, event.clientY - lastTap.y) < 24) {
          this._cancelPendingPick(); this.zoomToPoint(event); lastTap = null; lastTouchZoomAt = now;
        } else {
          lastTap = event.pointerType === 'touch' ? { time: now, x: event.clientX, y: event.clientY, floor: this.activeFloor } : null;
          this._schedulePick(event);
        }
      }
      pointers.delete(event.pointerId);
      if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId);
      if (!pointers.size) gesture = null;
      if (cancelled || event.pointerType === 'touch' || travel >= 6) this._clearHover();
    };
    this._listen(canvas, 'pointerup', (e) => release(e));
    this._listen(canvas, 'pointercancel', (e) => release(e, true));
    this._listen(canvas, 'pointerleave', () => this._clearHover());
    this._listen(canvas, 'lostpointercapture', (e) => { if (this.dragPlacement?.pointerId === e.pointerId) this._endPlacement(); pointers.delete(e.pointerId); if (!pointers.size) gesture = null; this._clearHover(); });
    this._listen(canvas, 'dblclick', (event) => {
      if (this.controlledPresentation) return;
      event.preventDefault(); this._cancelPendingPick();
      if (lastTouchZoomAt && (event.timeStamp || Date.now()) - lastTouchZoomAt < 400) return;
      this.zoomToPoint(event);
    });
    this._listen(canvas, 'wheel', (event) => {
      if (this.controlledPresentation) return;
      event.preventDefault(); this._cancelPendingPick();
      if (this.view === 'person') return;
      const pixels = event.deltaY * (event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? this.height : 1);
      this.zoomBy(Math.exp(-clamp(pixels, -600, 600) * (event.ctrlKey ? .006 : .0015)), event);
    }, { passive: false });
    const actions = { ArrowUp: 'forward', ArrowDown: 'backward', ArrowLeft: 'left', ArrowRight: 'right' };
    this._listen(canvas, 'keydown', (event) => {
      if (this.controlledPresentation || this.presentationOnly || !this.personCamera || this.placementMode || event.altKey || event.ctrlKey || event.metaKey ||
          canvas.ownerDocument?.querySelector('dialog[open]')) return;
      if (event.key === 'Escape' && this.view === 'person') { event.preventDefault(); this.setView('perspective'); return; }
      if ((event.code==='KeyF'||event.key?.toLowerCase()==='f')&&this.view==='person') {event.preventDefault();if(!event.repeat)this.interactDoor();return;}
      const action = actions[event.key];
      if (action) { event.preventDefault(); this.setPersonInput('fast', !!event.shiftKey); this.setPersonInput(action, true); }
      else if (event.key === 'Shift' && this.personInputs?.size) this.setPersonInput('fast', true);
    });
    this._listen(canvas, 'keyup', (event) => {
      if (this.controlledPresentation || this.presentationOnly) return;
      if (actions[event.key]) this.setPersonInput(actions[event.key], false);
      if (event.key === 'Shift') this.setPersonInput('fast', false);
    });
    this._listen(canvas, 'blur', () => this._stopPerson());
    const doc = canvas.ownerDocument;
    const win = doc?.defaultView || (typeof window !== 'undefined' ? window : null);
    if (win?.addEventListener) this._listen(win, 'blur', () => this._stopPerson());
    if (doc?.addEventListener) this._listen(doc, 'visibilitychange', () => { if (doc.hidden) this._stopPerson(); });
  }

  setPresentationInspection(enabled) {
    if (!this.presentationOnly || this.disposed) return false;
    this.autoOpenDoors = false;
    const inspecting = !!enabled;
    if (this.presentationInspection === inspecting) return true;
    this._cancelNavigationGesture?.();
    this._cancelPendingPick(); this._stopPerson(); this._clearHover();
    this.presentationInspection = inspecting;
    this.controlledPresentation = !inspecting;
    if (inspecting) {
      this._bindNavigationControls();
      this.select(null); this.isolated = false; this.explosion = this.amount = 0;
      this.view = 'perspective'; this.navigationEdited = false;
      this.setFloor(7); this.resetView();
      this.target.copy(this.goalTarget); Object.assign(this.orbit, this.goalOrbit);
      this._updateCamera();
    }
    this._visibility(); this._invalidate();
    return true;
  }

  _cancelPendingPick() {
    if (this._pickTimer != null) { clearTimeout(this._pickTimer); this._pickTimer = null; }
  }

  _schedulePick(event) {
    this._cancelPendingPick();
    const floor = this.activeFloor, pointer = { clientX: event.clientX, clientY: event.clientY };
    const hit = this._hit(pointer), item = (this.equipment || []).find((entry) => entry.id === hit?.userData.equipment);
    const delay = item?.roomLink || item?.type === 'heater' || item?.detailKey ? 550 : 330;
    // Let a second click become a zoom before a campus link changes rooms.
    this._pickTimer = setTimeout(() => {
      this._pickTimer = null;
      if (!this.disposed && this.active !== false && this.activeFloor === floor) this._pick(pointer, hit);
    }, delay);
  }

  _orbitOffset({ azimuth: a, elevation: e, distance: d }) {
    return new THREE.Vector3(Math.sin(a) * Math.cos(e) * d, Math.sin(e) * d, Math.cos(a) * Math.cos(e) * d);
  }

  _goalCamera() {
    if (this.view === 'person') { this._updatePersonCamera(); return this.personCamera.clone(); }
    const camera = this._currentCamera().clone();
    const target = this.goalTarget;
    if (this.view === 'top') camera.position.set(target.x, target.y + 105, target.z);
    else {
      const { azimuth: a, elevation: e, distance: d } = this.goalOrbit;
      camera.position.set(target.x + Math.sin(a) * Math.cos(e) * d, target.y + Math.sin(e) * d, target.z + Math.cos(a) * Math.cos(e) * d);
    }
    camera.lookAt(target); camera.updateMatrixWorld();
    return camera;
  }

  _navigationPoint(event, camera = this._currentCamera()) {
    const rect = this.canvas.getBoundingClientRect();
    if (!(rect.width > 0 && rect.height > 0) || !Number.isFinite(event?.clientX) || !Number.isFinite(event?.clientY)) return null;
    const pointer = new THREE.Vector2((event.clientX - rect.left) / rect.width * 2 - 1, -(event.clientY - rect.top) / rect.height * 2 + 1);
    this.raycaster.setFromCamera(pointer, camera);
    this.raycaster.near = camera.near; this.raycaster.far = camera.far;
    const surfaces = [], disks = new Set(this.locationDisks?.values() || []);
    this.scene.updateMatrixWorld(true);
    this.scene.traverseVisible((object) => {
      if (!object.isMesh || object.userData.person || object === this.selectionRing || disks.has(object)) return;
      const materials = Array.isArray(object.material) ? object.material : [object.material];
      if (materials.every((m) => m?.visible === false || (m?.transparent && m.opacity < .15))) return;
      surfaces.push(object);
    });
    const hit = this.raycaster.intersectObjects(surfaces, false)[0];
    if (hit) return hit.point.clone();
    // Empty space still has a usable depth, without a near-horizon ground jump.
    const plane = new THREE.Plane().setFromNormalAndCoplanarPoint(camera.getWorldDirection(new THREE.Vector3()), this.goalTarget);
    return this.raycaster.ray.intersectPlane(plane, new THREE.Vector3());
  }

  _notifyNavigation() {
    if (this.activeFloor === 'outdoor') this.onNavigationChange?.(this.getOutdoorProgress());
    else if (this.activeFloor === 'campus') this.onNavigationChange?.(this.getCampusProgress());
    else if (this.activeFloor === 'packaging') this.onNavigationChange?.(this.getPackagingProgress());
  }

  _ensureCameraRange() {
    if (!this.camera) return;
    const far = Math.max(3000, Math.max(this.orbit?.distance || 0, this.goalOrbit?.distance || 0) * 4 + 200);
    const nearest = Math.min(this.orbit?.distance || this.goalOrbit?.distance || 50, this.goalOrbit?.distance || this.orbit?.distance || 50);
    const near = clamp(nearest * .001, .02, .5);
    if (this.camera.near !== near || this.camera.far !== far) {
      this.camera.near = near; this.camera.far = far; this.camera.updateProjectionMatrix();
    }
  }

  zoomToPoint(event, factor = 2.5) {
    if (this.view === 'person' || this.placementMode || !Number.isFinite(factor) || factor <= 1) return;
    const point = this._navigationPoint(event);
    if (!point || !point.toArray().every(Number.isFinite)) return;
    this._clearHover(); this._cancelPendingPick();
    this.goalTarget.copy(point);
    this.zoomBy(factor);
    this._notifyNavigation();
  }

  _hit(event) {
    this.scene.updateMatrixWorld(true);
    const rect = this.canvas.getBoundingClientRect();
    const pointer = new THREE.Vector2((event.clientX - rect.left) / rect.width * 2 - 1, -(event.clientY - rect.top) / rect.height * 2 + 1);
    const camera = this._currentCamera();
    this.raycaster.setFromCamera(pointer, camera);
    this.raycaster.near = camera.near; this.raycaster.far = camera.far;
    const station = this.compressorSurveyPick?.(this.raycaster);
    if (station) return station;
    const visible = this.pickables.filter((object) => {
      let item = object;
      while (item) { if (!item.visible) return false; item = item.parent; }
      return true;
    });
    const hits = this.raycaster.intersectObjects(visible, false);
    return hits[0]?.object;
  }

  _pick(event, hit = this._hit(event)) {
    if (hit?.userData.compressorRecord) this.onCompressorSurvey?.(hit.userData.compressorRecord);
    else if (Number.isInteger(hit?.userData.surveyIndex)) this.onSurveyPhoto(hit.userData.surveyIndex);
    else this.onSelect(hit?.userData.equipment || null);
  }

  _placementPoint(event, height) {
    const rect = this.canvas.getBoundingClientRect();
    this.raycaster.setFromCamera(new THREE.Vector2((event.clientX - rect.left) / rect.width * 2 - 1, -(event.clientY - rect.top) / rect.height * 2 + 1), this._currentCamera());
    return this.raycaster.ray.intersectPlane(new THREE.Plane(Y, -height), new THREE.Vector3());
  }

  _endPlacement() {
    if (!this.dragPlacement) return;
    const item = this.equipment.find((entry) => entry.id === this.dragPlacement.id);
    this.dragPlacement = null;
    this.canvas.style.cursor = this.placementMode ? 'grab' : '';
    if (item) this.onTransformChange({ id: item.id, position: [...item.position], rotation: item.rotation || 0, phase: 'end' });
  }

  setPlacementMode(value) {
    this._stopPerson();
    if (value && this.view === 'person') this.setView('top');
    this._endPlacement();
    this._clearHover();
    this.placementMode = !!value;
    if (this.placementMode && this.activeFloor === 'packaging' && this.getPackagingLevel() === 'all') {
      const selected = this.selected, item = this.equipment.find((entry) => entry.id === selected);
      this.setPackagingLevel(item?.floorLevel || 3);
      if (selected) this.select(selected);
    }
    this.canvas.dataset.editing = String(this.placementMode);
    this.canvas.style.cursor = this.placementMode ? 'grab' : '';
    if (this.placementMode) { this.explosion = this.amount = 0; this._moveParts(); }
    this._placementGuide();
    this._invalidate();
  }

  getLayout() {
    return this.equipment.map((item) => ({ id: item.id, position: [...item.position], rotation: item.rotation || 0 }));
  }

  _placementFootprints() {
    this.scene.updateMatrixWorld(true);
    for (const item of this.equipment) {
      const root = this.objects.get(item.id);
      const body = this.parts.find((part) => part.root === root)?.group || root;
      const inverse = root.matrixWorld.clone().invert();
      const box = new THREE.Box3();
      body.traverse((mesh) => {
        if (!mesh.isMesh) return;
        mesh.geometry.computeBoundingBox();
        if (mesh.isInstancedMesh) mesh.computeBoundingBox();
        const bounds = mesh.isInstancedMesh ? mesh.boundingBox : mesh.geometry.boundingBox;
        box.union(bounds.clone().applyMatrix4(inverse.clone().multiply(mesh.matrixWorld)));
      });
      const footprint = box.isEmpty() ? { minX: -.5, maxX: .5, minZ: -.5, maxZ: .5 } : { minX: box.min.x, maxX: box.max.x, minZ: box.min.z, maxZ: box.max.z };
      // Frame/body bounds exclude service stubs that connect beyond the casing.
      if (item.type === 'outdoor-rack') Object.assign(footprint, { minX: -1.825, maxX: 1.825, minZ: -1.2, maxZ: 1.2 });
      if (item.type === 'chamber' && item.floor !== 6) Object.assign(footprint, { minX: -3.1, maxX: 3.1, minZ: -3.1, maxZ: 3.1 });
      if (item.type === 'blower' && item.floor !== 6) Object.assign(footprint, { minX: -2.5, maxX: 2.5, minZ: -2.3, maxZ: 2.3 });
      if (item.type === 'cyclone' && item.floor !== 6) Object.assign(footprint, { minX: -2.2, maxX: 2.2, minZ: -2.2, maxZ: 2.2 });
      this.placementFootprints.set(item.id, footprint);
    }
  }

  _constrainTransform(item, transform) {
    return constrainPlacement(item, transform, { footprint: this.placementFootprints.get(item.id), room: OUTDOOR_ROOM, baseline: this.placementDefaults.get(item.id) });
  }

  getPlacementInfo(id) {
    const item = this.equipment.find((entry) => entry.id === id);
    if (!item) return null;
    const baseline = this.placementDefaults.get(id);
    const result = this.placementResults.get(id) || this._constrainTransform(item, item);
    const difference = Math.atan2(Math.sin((item.rotation || 0) - baseline.rotation), Math.cos((item.rotation || 0) - baseline.rotation));
    return {
      position: item.floor === 'outdoor' ? toRoomPosition(item.position, OUTDOOR_ROOM) : [...item.position],
      rotationDegrees: difference * 180 / Math.PI,
      step: PLACEMENT_RULES.step, angleDegrees: PLACEMENT_RULES.angleDegrees, regionLabel: item.floor === 'packaging' ? `스틱·소포장 ${item.floorLevel ?? 3}층 바닥 안` : result.regionLabel,
      gridOrigin: [0, 0], bounds: result.bounds ? { ...result.bounds } : null,
      valid: result.valid, limited: result.limited, snapped: result.snapped,
      message: !result.valid ? '이 방향은 설비가 영역 안에 들어가지 않습니다.' : result.limited ? '벽과 바닥의 경계 안으로 맞췄습니다.' : result.snapped ? `1칸(${PLACEMENT_RULES.step}) 격자와 ${PLACEMENT_RULES.angleDegrees}° 회전에 맞췄습니다.` : '',
    };
  }

  setPlacementCoordinates(id, { x, z, rotationDegrees } = {}) {
    const item = this.equipment.find((entry) => entry.id === id);
    if (!item || ![x, z, rotationDegrees].every(Number.isFinite)) return false;
    const position = item.floor === 'outdoor' ? fromRoomPosition([x, item.position[1], z], OUTDOOR_ROOM) : [x, item.position[1], z];
    return this.setTransform(id, { position, rotation: this.placementDefaults.get(id).rotation + rotationDegrees * Math.PI / 180 });
  }

  _placementGuide() {
    if (this.placementGuide) {
      this.placementGuide.traverse((mesh) => { if (mesh.geometry) { mesh.geometry.dispose(); this.geometries.delete(mesh.geometry); } });
      this.scene.remove(this.placementGuide); this.placementGuide = null;
    }
    if (!this.placementMode) return;
    const item = this.equipment.find((entry) => entry.id === this.selected) || this.equipment.find((entry) => entry.floor === (this.activeFloor === 'all' ? 7 : this.activeFloor) && (entry.floor !== 'packaging' || (entry.floorLevel ?? 3) === this.getPackagingLevel()));
    if (!item) return;
    const result = this._constrainTransform(item, item);
    const { minX, maxX, minZ, maxZ } = result.frame;
    const outdoor = item.floor === 'outdoor';
    const anchor = outdoor ? OUTDOOR_ROOM.anchor : [0, 0, 0];
    const guide = this._group(this.scene, [anchor[0], item.position[1] + .085, anchor[2]]);
    guide.rotation.y = outdoor ? OUTDOOR_ROOM.rotation : 0;
    if (!this.placementGridMaterial) {
      this.placementGridMaterial = new THREE.LineBasicMaterial({ color: 0x5593a0, transparent: true, opacity: .14, depthWrite: false });
      this.placementMajorGridMaterial = new THREE.LineBasicMaterial({ color: 0x427f8c, transparent: true, opacity: .38, depthWrite: false });
      this.placementBorderMaterial = new THREE.LineBasicMaterial({ color: 0x296f80, transparent: true, opacity: .85, depthWrite: false });
      this.materials.add(this.placementGridMaterial); this.materials.add(this.placementMajorGridMaterial); this.materials.add(this.placementBorderMaterial);
    }
    // The drawn cells match the shared snapping grid in every area, including
    // the campus. Darker lines mark each fourth cell without changing its size.
    const points = [], majorPoints = [], gridStep = PLACEMENT_RULES.step;
    for (let index = Math.ceil(minX / gridStep); index <= Math.floor(maxX / gridStep); index++) {
      const x = index * gridStep;
      (index % 4 === 0 ? majorPoints : points).push(x, 0, minZ, x, 0, maxZ);
    }
    for (let index = Math.ceil(minZ / gridStep); index <= Math.floor(maxZ / gridStep); index++) {
      const z = index * gridStep;
      (index % 4 === 0 ? majorPoints : points).push(minX, 0, z, maxX, 0, z);
    }
    for (const [vertices, material] of [[points, this.placementGridMaterial], [majorPoints, this.placementMajorGridMaterial]]) {
      const geometry = new THREE.BufferGeometry(); geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
      guide.add(new THREE.LineSegments(geometry, material)); this.geometries.add(geometry);
    }
    const border = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(minX, .01, minZ), new THREE.Vector3(maxX, .01, minZ), new THREE.Vector3(maxX, .01, maxZ), new THREE.Vector3(minX, .01, maxZ)]);
    guide.add(new THREE.LineLoop(border, this.placementBorderMaterial)); this.geometries.add(border);
    this.placementGuide = guide;
  }

  setTransform(id, transform = {}) {
    const item = this.equipment.find((entry) => entry.id === id);
    if (!item) return false;
    const position = transform.position || item.position;
    const rotation = transform.rotation ?? item.rotation ?? 0;
    if (!Array.isArray(position) || position.length !== 3 || !position.every(Number.isFinite) || !Number.isFinite(rotation)) return false;
    const constrained = this._constrainTransform(item, { position, rotation });
    this.placementResults.set(id, constrained);
    if (!constrained.valid) return false;
    this.personObstacleCache = null;
    item.position = [...constrained.position];
    item.rotation = constrained.rotation;
    const root = this.objects.get(id);
    root.position.set(item.position[0], item.position[1] + this._packagingDisplayOffset(item), item.position[2]); root.rotation.y = item.rotation;
    if (item.subsurfaceFootprint) this.campus?.deck.userData.updateSubsurfaceCutout?.();
    const label = this.labels.find((entry) => entry.id === id);
    if (label) { label.anchor.x = item.position[0]; label.anchor.z = item.position[2]; }
    const disk = this.locationDisks.get(id);
    if (disk) { disk.position.x = item.position[0]; disk.position.z = item.position[2]; }
    if (id === this.selected) this.selectionRing.position.set(item.position[0], item.position[1] + this._packagingDisplayOffset(item) + .07, item.position[2]);
    this._invalidate(); return true;
  }

  setLayout(layout) {
    if (!Array.isArray(layout)) return false;
    const prepared = [], ids = new Set();
    for (const transform of layout) {
      if (!transform || ids.has(transform.id) || !this.objects.has(transform.id) || !Array.isArray(transform.position) || transform.position.length !== 3 || !transform.position.every(Number.isFinite) || !Number.isFinite(transform.rotation)) return false;
      const item = this.equipment.find((entry) => entry.id === transform.id);
      const constrained = this._constrainTransform(item, transform);
      if (!constrained.valid) return false;
      prepared.push({ id: item.id, ...constrained }); ids.add(item.id);
    }
    for (const transform of prepared) this.setTransform(transform.id, transform);
    return true;
  }

  _currentCamera() { return this.view === 'person' ? this.personCamera : this.view === 'top' ? this.topCamera : this.camera; }

  _panBy(dx, dy) {
    if (![dx, dy].every(Number.isFinite)) return;
    this.navigationEdited = true;
    const distance = this.view === 'top' ? (this.topCamera.top - this.topCamera.bottom) / this.topCamera.zoom : this.goalOrbit.distance;
    const scale = distance * (this.view === 'perspective' ? 2 * Math.tan((this.camera?.fov || 42) * Math.PI / 360) : 1) / Math.max(1, this.height);
    const az = this.view === 'top' ? 0 : this.goalOrbit.azimuth;
    if (this.view === 'perspective') {
      const e = this.goalOrbit.elevation;
      this.goalTarget.addScaledVector(new THREE.Vector3(Math.cos(az), 0, -Math.sin(az)), -dx * scale);
      this.goalTarget.addScaledVector(new THREE.Vector3(-Math.sin(az) * Math.sin(e), Math.cos(e), -Math.cos(az) * Math.sin(e)), dy * scale);
    } else {
      this.goalTarget.x -= (dx * Math.cos(az) + dy * Math.sin(az)) * scale;
      this.goalTarget.z += (dx * Math.sin(az) - dy * Math.cos(az)) * scale;
    }
    // Camera travel is independent of the equipment placement fences.
    for (const axis of ['x', 'y', 'z']) this.goalTarget[axis] = clamp(this.goalTarget[axis], -100000, 100000);
    this.campusTopFit = false; this.packagingTopFit = false; this.dryerTopFit = false;
    this._notifyNavigation();
  }

  getOutdoorProgress() {
    if (!this._areaEnabled('outdoor')) return 0;
    const along = toRoomPosition(this.goalTarget.toArray(), OUTDOOR_ROOM)[0];
    return clamp((along - 14) / (OUTDOOR_ROOM.length - 14) * 100, 0, 100);
  }

  getCampusProgress() {
    if (!this._areaEnabled('campus')) return 0;
    const road = CAMPUS_ROOM.layout.entrance;
    const eyeZ = this.goalTarget.z + (this.view === 'aisle' ? 13.8 : 0);
    return clamp((road.fromZ - eyeZ) / (road.fromZ - road.toZ) * 100, 0, 100);
  }

  _packagingRoom() {
    if (this.getPackagingLevel() === 'all' && typeof PACKAGING_OVERVIEW !== 'undefined') return PACKAGING_OVERVIEW;
    return typeof PACKAGING_ROOMS === 'undefined' ? PACKAGING_ROOM : PACKAGING_ROOMS[this.getPackagingLevel()] || PACKAGING_ROOM;
  }

  getPackagingLevel() { return this.packagingLevel || 3; }

  _packagingDisplayOffset(item) {
    if (item.floor !== 'packaging' || this.getPackagingLevel() !== 'all') return 0;
    const elevations = typeof PACKAGING_FLOOR_ELEVATIONS === 'undefined' ? { 1: 0, 2: 6, 3: 12.15 } : PACKAGING_FLOOR_ELEVATIONS;
    return elevations[item.floorLevel ?? 3] || 0;
  }

  _applyPackagingDisplayOffsets() {
    for (const [level, environment] of this.packagingEnvironments || []) {
      const offset = this._packagingDisplayOffset({ floor: 'packaging', floorLevel: level });
      for (const key of ['deck', 'structure', 'ducts', 'cargo']) if (environment[key]) environment[key].position.y = offset;
    }
    for (const item of this.equipment) {
      if (item.floor !== 'packaging') continue;
      const offset = this._packagingDisplayOffset(item), object = this.objects.get(item.id);
      if (object) object.position.y = item.position[1] + offset;
      const label = this.labels?.find((entry) => entry.id === item.id);
      if (label) label.anchor.y = (label.baseY ?? item.position[1] + (item.labelHeight || item.height + .2)) + offset;
      const disk = this.locationDisks?.get(item.id); if (disk) disk.position.y = item.position[1] + offset + .04;
      if (item.id === this.selected && this.selectionRing) this.selectionRing.position.y = item.position[1] + offset + .07;
    }
  }

  setPackagingLevel(value) {
    if (!this._areaEnabled('packaging')) return;
    const level = value === 'all' ? 'all' : Number(value);
    if (typeof PACKAGING_ROOMS === 'undefined' || (level !== 'all' && !PACKAGING_ROOMS[level]) || level === this.getPackagingLevel()) return;
    this._stopPerson();
    const personView = this.view === 'person';
    this._clearHover();
    this.select(null);
    this.packagingLevel = level;
    this.personObstacleCache = null;
    if (this.packagingEnvironments?.has(level === 'all' ? 3 : level)) {
      this.packaging = this.packagingEnvironments.get(level === 'all' ? 3 : level);
      this.floorDecks.set('packaging', this.packaging.deck);
      this.floorStructures.set('packaging', this.packaging.structure);
    }
    this.packagingProgress = 0;
    this.canvas.dataset.packagingLevel = String(level);
    if (this.activeFloor === 'packaging') this._ensurePerson();
    if (this.sun && this.activeFloor === 'packaging') this.sun.target.position.set(...this._packagingRoom().center);
    this._visibility();
    if (this.activeFloor === 'packaging') this.setView(this.placementMode ? 'top' : personView ? 'person' : 'perspective');
    this.onNavigationChange?.(0);
    this._placementGuide();
    this.onPackagingLevelChange?.(level);
  }

  setPackagingCargoVisible(value) { this.packagingCargoVisible = !!value; this._visibility(); }

  getPackagingProgress() { return this.packagingProgress || 0; }

  _packagingPathPoint(progress) {
    const room = this._packagingRoom(), path = room.path;
    const lengths = path.slice(1).map((point, index) => Math.hypot(point[0] - path[index][0], point[1] - path[index][1], point[2] - path[index][2]));
    const total = lengths.reduce((sum, length) => sum + length, 0);
    let remaining = total * clamp(progress, 0, 100) / 100;
    for (let index = 0; index < lengths.length; index++) {
      if (remaining <= lengths[index] || index === lengths.length - 1) {
        const a = new THREE.Vector3(...path[index]), b = new THREE.Vector3(...path[index + 1]);
        const direction = b.clone().sub(a).normalize(), ratio = lengths[index] ? remaining / lengths[index] : 0;
        const point = a.lerp(b, ratio);
        if (index === lengths.length - 1 && room.pathEndLookAt) {
          const endDirection = new THREE.Vector3(...room.pathEndLookAt).sub(point).normalize();
          direction.lerp(endDirection, ratio ** 3).normalize();
        }
        return { point, direction };
      }
      remaining -= lengths[index];
    }
    return { point: new THREE.Vector3(...path[0]), direction: new THREE.Vector3(0, 0, -1) };
  }

  setPackagingProgress(value) {
    const progress = Number(value);
    if (this.activeFloor !== 'packaging' || this.getPackagingLevel() === 'all' || !Number.isFinite(progress)) return;
    if (this.view !== 'top' && this.view !== 'aisle') this.setView('aisle');
    this.packagingProgress = clamp(progress, 0, 100);
    const { point, direction } = this._packagingPathPoint(this.packagingProgress);
    if (this.view === 'top') {
      this.goalTarget.set(point.x, 0, point.z); this.packagingTopFit = false;
      this.topCamera.zoom = Math.max(this.topCamera.zoom, .85); this.topCamera.updateProjectionMatrix();
    } else {
      this.goalTarget.copy(point).addScaledVector(direction, 7);
      Object.assign(this.goalOrbit, { azimuth: Math.atan2(-direction.x, -direction.z), elevation: -Math.asin(clamp(direction.y, -1, 1)), distance: 7 });
    }
    this.onNavigationChange?.(this.packagingProgress); this._invalidate();
  }

  setCampusProgress(value) {
    const progress = Number(value);
    if (this.activeFloor !== 'campus' || !Number.isFinite(progress)) return;
    if (this.view !== 'top' && this.view !== 'aisle') this.setView('aisle');
    const road = CAMPUS_ROOM.layout.entrance;
    const eyeZ = road.fromZ - (road.fromZ - road.toZ) * clamp(progress, 0, 100) / 100;
    this.goalTarget.set(road.laneX, this.view === 'top' ? 0 : 1.65, eyeZ - (this.view === 'aisle' ? 13.8 : 0));
    if (this.view === 'top') {
      this.campusTopFit = false;
      this.topCamera.zoom = Math.max(this.topCamera.zoom, .85);
      this.topCamera.updateProjectionMatrix();
    } else Object.assign(this.goalOrbit, { azimuth: 0, elevation: .015, distance: 13.8 });
    this.onNavigationChange?.(clamp(progress, 0, 100));
    this._invalidate();
  }

  setOutdoorProgress(value) {
    const progress = Number(value);
    if (this.activeFloor !== 'outdoor' || !Number.isFinite(progress)) return;
    if (this.view !== 'top' && this.view !== 'aisle') this.setView('aisle');
    this.goalTarget.set(...fromRoomPosition([14 + (OUTDOOR_ROOM.length - 14) * clamp(progress, 0, 100) / 100, this.view === 'top' ? 0 : 1.85, OUTDOOR_ROOM.aisleCenterZ], OUTDOOR_ROOM));
    if (this.view === 'top') {
      this.topCamera.zoom = Math.max(this.topCamera.zoom, .85);
      this.topCamera.updateProjectionMatrix();
    }
    this.onNavigationChange?.(clamp(progress, 0, 100));
    this._invalidate();
  }

  focusPlacement(id) {
    const item = this.equipment.find((entry) => entry.id === id);
    if (!item) return;
    if (item.floor === 'packaging' && (item.floorLevel ?? 3) !== this.getPackagingLevel()) this.setPackagingLevel(item.floorLevel ?? 3);
    this.select(id);
    this.setView('top');
    this.goalTarget.set(item.position[0], item.position[1], item.position[2]);
    if (item.floor === 'campus' || item.floor === 'packaging') {
      const root = this.objects.get(id); root.updateWorldMatrix(true, true);
      const bounds = new THREE.Box3().setFromObject(root), size = bounds.getSize(new THREE.Vector3());
      const center = bounds.getCenter(new THREE.Vector3()); this.goalTarget.set(center.x, item.position[1], center.z);
      this.topCamera.zoom = Math.min((this.topCamera.right - this.topCamera.left) / (size.x + 12), (this.topCamera.top - this.topCamera.bottom) / (size.z + 12)) * .85;
      this.campusTopFit = false; this.packagingTopFit = false; this.dryerTopFit = false;
    } else this.topCamera.zoom = 1.15;
    this.topCamera.updateProjectionMatrix();
    this.navigationEdited = true;
    if (item.floor === 'outdoor') this.onNavigationChange?.(this.getOutdoorProgress());
    this._invalidate();
  }

  _updateCamera() {
    this._ensureCameraRange();
    const { azimuth: a, elevation: e, distance: d } = this.orbit;
    this.camera.position.set(this.target.x + Math.sin(a) * Math.cos(e) * d, this.target.y + Math.sin(e) * d, this.target.z + Math.cos(a) * Math.cos(e) * d);
    this.camera.lookAt(this.target);
    this.topCamera.position.set(this.target.x, this.target.y + 105, this.target.z);
    this.topCamera.lookAt(this.target.x, this.target.y, this.target.z);
    this.camera.updateMatrixWorld(); this.topCamera.updateMatrixWorld();
    this._updatePersonCamera();
    if (this.packaging?.ceiling) this.packaging.ceiling.visible = this.activeFloor === 'packaging' && this.getPackagingLevel() !== 'all' && this.structureEnabled && !this.isolated && (this.partitionsEnabled || ['aisle', 'person'].includes(this.view));
  }

  _invalidate() {
    this.dirty = true;
    if (this.active && !this.disposed && this.frame === null) this.frame = requestAnimationFrame((time) => this._tick(time));
  }

  _tick(time) {
    this.frame = null;
    if (!this.active || this.disposed) return;
    const elapsed = this.lastTick === null ? 1 / 60 : Math.min(.35, (time - this.lastTick) / 1000);
    const blend = this.reducedMotion ? 1 : 1 - Math.exp(-elapsed * 12);
    this.lastTick = time;
    const walkingEye = this.view === 'aisle' ? this.target.clone().add(this._orbitOffset(this.orbit)) : null;
    const goalEye = walkingEye ? this.goalTarget.clone().add(this._orbitOffset(this.goalOrbit)) : null;
    let moving = this._advancePerson(elapsed);
    for (const property of ['azimuth', 'elevation', 'distance']) {
      const difference = this.goalOrbit[property] - this.orbit[property];
      if (Math.abs(difference) > .0005) { this.orbit[property] += difference * blend; moving = true; }
      else this.orbit[property] = this.goalOrbit[property];
    }
    if (walkingEye) {
      if (walkingEye.distanceTo(goalEye) > .001) { walkingEye.lerp(goalEye, blend); moving = true; }
      else walkingEye.copy(goalEye);
      this.target.copy(walkingEye).sub(this._orbitOffset(this.orbit));
    } else if (this.target.distanceTo(this.goalTarget) > .001) { this.target.lerp(this.goalTarget, blend); moving = true; }
    else this.target.copy(this.goalTarget);
    if (Math.abs(this.amount - this.explosion) > .001) { this.amount += (this.explosion - this.amount) * blend; moving = true; }
    else this.amount = this.explosion;
    this._moveParts();
    if (this._updateProximityDoors(elapsed)) moving = true;
    this._updateCamera();
    if (this.dirty || moving) this._draw();
    this.dirty = false;
    if (moving) this._invalidate();
    else this.lastTick = null;
  }

  _moveParts() {
    for (const part of this.parts) {
      const amount = part.root.userData.equipment === this.selected ? this.amount : 0;
      part.group.position.copy(part.home).addScaledVector(part.offset, amount);
      if (part.group.userData.revealOnExplode) part.group.visible = amount > .08;
    }
  }

  _draw() {
    if (this.disposed || this.contextLost) return;
    this.renderer.render(this.scene, this._currentCamera());
    this._updateLabels();
    this._updatePersonMarker();
  }

  select(id) {
    const next = this.objects.has(id) ? id : null;
    const requested = this.equipment.find((entry) => entry.id === next);
    if (requested?.floor === 'packaging' && this.getPackagingLevel() !== 'all' && (requested.floorLevel ?? 3) !== this.getPackagingLevel()) this.setPackagingLevel(requested.floorLevel ?? 3);
    if (next !== this.selected) { this.amount = this.explosion = 0; this.isolated = false; this.campusInteriorEnabled = !!this.objects.get(next)?.userData.hasInspectableInterior; }
    this.selected = next;
    const item = this.equipment.find((entry) => entry.id === next);
    this.selectionRing.visible = !!item;
    if (item) {
      this.selectionRing.position.set(item.position[0], item.position[1] + this._packagingDisplayOffset(item) + .07, item.position[2]);
      const bounds = item.floor === 'campus' || item.floor === 'packaging' ? new THREE.Box3().setFromObject(this.objects.get(next)) : null;
      const size = bounds?.getSize(new THREE.Vector3());
      const radius = size ? Math.max(size.x, size.z) * .55 : item.type === 'chamber' ? 3.18 : item.type === 'cyclone' ? 2.1 : item.type === 'panel' ? 1.1 : 2.75;
      this.selectionRing.scale.set(radius, radius, radius);
    }
    this._visibility(); this._moveParts(); this._invalidate();
    this._placementGuide();
  }

  focus(id) {
    const item = this.equipment.find((entry) => entry.id === id); if (!item) return;
    if (item.floor === 'packaging' && this.getPackagingLevel() !== 'all' && (item.floorLevel ?? 3) !== this.getPackagingLevel()) this.setPackagingLevel(item.floorLevel ?? 3);
    const leavingAisle = this.view === 'aisle' || this.view === 'person';
    if (leavingAisle) { this._stopPerson(); this.view = 'perspective'; this._visibility(); this.onViewChange(this.view); }
    const object = this.objects.get(id);
    const focusName = object.userData.hasInspectableInterior && this.campusInteriorEnabled
      ? object.userData.interiorFocusObject || 'campus-tank-valve-room-units'
      : item.exteriorView?.focusObject;
    const focusObject = (focusName && object.getObjectByName(focusName)) || object;
    const bounds = new THREE.Box3().setFromObject(focusObject);
    if (id === 'dryer-roof-drive') {
      const interior = this.upperEnvironments?.get(8)?.machineRoomInterior;
      if (interior) bounds.expandByObject(interior);
    }
    const center = bounds.getCenter(new THREE.Vector3());
    this.goalTarget.set(center.x, center.y, center.z);
    const size = bounds.getSize(new THREE.Vector3());
    this.navigationEdited = true;
    this.campusTopFit = false; this.packagingTopFit = false; this.dryerTopFit = false;
    if (this.view === 'top') {
      const padding = Math.max(.5, Math.max(size.x, size.z) * .18);
      this.topCamera.zoom = clamp(Math.min((this.topCamera.right - this.topCamera.left) / (size.x + padding), (this.topCamera.top - this.topCamera.bottom) / (size.z + padding)), .005, 80);
      this.topCamera.updateProjectionMatrix();
    } else {
      if (leavingAisle) {
        this.goalOrbit.elevation = .5;
        if (item.floor === 'packaging') this.goalOrbit.azimuth = center.x > 0 ? -Math.PI / 2 : Math.PI / 2;
      }
      if (id === 'dryer-roof-drive') { this.goalOrbit.azimuth = Math.PI - .55; this.goalOrbit.elevation = .58; }
      if (id === 'f1-prep-platform') { this.goalOrbit.azimuth = .65; this.goalOrbit.elevation = .5; }
      if (this.objects.get(id)?.userData.hasInspectableInterior && this.campusInteriorEnabled) {
        this.goalOrbit.azimuth = item.interiorView?.azimuth ?? -.65;
        this.goalOrbit.elevation = item.interiorView?.elevation ?? .72;
      } else if (item.exteriorView) {
        this.goalOrbit.azimuth = item.exteriorView.azimuth;
        this.goalOrbit.elevation = item.exteriorView.elevation;
      }
      const vertical = (this.camera.fov || 42) * Math.PI / 360;
      const halfAngle = Math.min(vertical, Math.atan(Math.tan(vertical) * this.camera.aspect));
      const closeFit = focusObject.name === item.exteriorView?.focusObject ? item.exteriorView?.distanceScale ?? 1 : 1;
      // Leave room for the side workstation in narrow portrait viewports.
      const distanceScale = 1 + (closeFit - 1) * Math.min(1, this.camera.aspect);
      this.goalOrbit.distance = Math.max(.8, size.length() * .5 / Math.sin(halfAngle) * 1.15 * distanceScale);
      this._ensureCameraRange();
    }
    this._notifyNavigation();
    this._invalidate();
  }

  showPreparationLowerView() {
    if (this.activeFloor !== 1) this.setFloor(1);
    this.setIsolation(false);
    this._stopPerson();
    this.setView('perspective');
    this.setExplosion(0);
    const object = this.objects.get('f1-mix-b');
    const point = object ? object.getWorldPosition(new THREE.Vector3()) : new THREE.Vector3(18.25,.3,11);
    this.goalTarget.set(point.x + .45, point.y + 1.05, point.z);
    Object.assign(this.goalOrbit, { azimuth: Math.PI / 2, elevation: .035, distance: 7.5 });
    this.navigationEdited = true;
    this._notifyNavigation(); this._invalidate();
  }

  setView(view) {
    if (!['perspective', 'top', 'aisle', 'person'].includes(view)) return;
    if (this.presentationInspection && !['perspective', 'top'].includes(view)) return;
    if (view === 'person' && this.personEnabled === false) return;
    this._stopPerson();
    if (view === 'person') {
      if (this.placementMode || !this.personCamera) return;
      if (this.activeFloor === 'packaging' && this.getPackagingLevel() === 'all') this.setPackagingLevel(1);
      this._clearHover(); this._cancelPendingPick(); this._ensurePerson();
      this.view = 'person'; this.isolated = false; this.explosion = this.amount = 0;
      if (this.canvas.dataset) this.canvas.dataset.view = view;
      this._visibility(); this._updatePersonCamera(); this.onViewChange(view); this._invalidate(); return;
    }
    const leavingPerson = this.view === 'person';
    if (this.canvas.dataset) this.canvas.dataset.view = view;
    if (leavingPerson && this.person && ['perspective', 'top'].includes(view)) {
      const feet = this._personWorldPosition();
      const yaw = this.person.yaw - (this.activeFloor === 'outdoor' ? OUTDOOR_ROOM.rotation : 0);
      this.view = view; this.navigationEdited = true;
      this.goalTarget.copy(feet).addScaledVector(Y, view === 'top' ? 0 : 1);
      Object.assign(this.goalOrbit, { azimuth: -yaw, elevation: .55, distance: 14 });
      this.topCamera.zoom = 1.7; this.topCamera.updateProjectionMatrix();
      this.campusTopFit = this.packagingTopFit = this.dryerTopFit = false;
      this._visibility(); this.onViewChange(view); this._invalidate(); return;
    }
    if (this.activeFloor === 'packaging' && this.getPackagingLevel() === 'all' && view === 'aisle') view = 'perspective';
    this._clearHover();
    this._cancelPendingPick();
    if (this.navigationEdited && ['perspective', 'top'].includes(this.view) && ['perspective', 'top'].includes(view)) {
      if (this.view === view) return;
      const frustum = this.topCamera.top - this.topCamera.bottom;
      const tangent = Math.tan((this.camera.fov || 42) * Math.PI / 360);
      if (view === 'top') {
        this.topCamera.zoom = clamp(frustum / (2 * this.goalOrbit.distance * tangent), .005, 80);
        this.topCamera.updateProjectionMatrix();
      } else this.goalOrbit.distance = clamp(frustum / this.topCamera.zoom / (2 * tangent), .35, 2000);
      this.view = view; this.campusTopFit = false; this.packagingTopFit = false; this.dryerTopFit = false;
      if (this.activeFloor === 2) this._visibility();
      this._ensureCameraRange(); this.onViewChange(view); this._invalidate(); return;
    }
    this.navigationEdited = false;
    this.view = view;
    this._visibility();
    if (this.activeFloor === 'packaging') {
      const room = this._packagingRoom();
      if (view === 'aisle') {
        this.packagingTopFit = false; this.setPackagingProgress(0);
      } else {
        this.goalTarget.set(room.center[0], view === 'top' ? 0 : room.center[1], room.center[2]);
        const frame = room.bounds || PLACEMENT_REGIONS.packaging;
        this.topCamera.zoom = this._roomTopZoom(frame); this.topCamera.updateProjectionMatrix();
        this.packagingTopFit = true;
        Object.assign(this.goalOrbit, { azimuth: .65, elevation: this.getPackagingLevel() === 'all' ? .62 : .88, distance: room.span * 1.45 * (this.fitFactor || 1) });
      }
      this.onViewChange(view); this._invalidate(); return;
    }
    if (this.activeFloor === 'campus') {
      if (view === 'aisle') {
        const road = CAMPUS_ROOM.layout.entrance;
        this.goalTarget.set(road.laneX, 1.65, road.fromZ - 13.8);
        this.campusTopFit = false;
        Object.assign(this.goalOrbit, { azimuth: 0, elevation: .015, distance: 13.8 });
        this.onNavigationChange?.(0);
        this.onViewChange(view); this._invalidate(); return;
      }
      const center = CAMPUS_ROOM.center;
      this.goalTarget.set(center[0], view === 'top' ? 0 : center[1], center[2]);
      this.campusTopFit = true;
      this.topCamera.zoom = this._campusTopZoom(); this.topCamera.updateProjectionMatrix();
      Object.assign(this.goalOrbit, { azimuth: view === 'aisle' ? 0 : -.65, elevation: view === 'aisle' ? .18 : .68, distance: Math.max(280, CAMPUS_ROOM.span * 1.4) * (this.fitFactor || 1) });
      this.onViewChange(view); this._invalidate(); return;
    }
    if (this.activeFloor === 'outdoor') {
      const center = OUTDOOR_ROOM.center || [-2, 2, 4];
      if (view === 'aisle') {
        // Look down the actual room axis from the entry, at walking height.
        this.goalTarget.set(...fromRoomPosition([19, 1.85, OUTDOOR_ROOM.aisleCenterZ], OUTDOOR_ROOM));
      } else this.goalTarget.set(center[0], view === 'top' ? 0 : center[1], center[2]);
      this.topCamera.zoom = .68 * 50 / Math.max(50, OUTDOOR_ROOM.span); this.topCamera.updateProjectionMatrix();
      Object.assign(this.goalOrbit, view === 'aisle'
        ? { azimuth: OUTDOOR_ROOM.rotation - Math.PI / 2, elevation: .015, distance: 13.8 }
        : { azimuth: .6, elevation: .72, distance: Math.max(52, OUTDOOR_ROOM.span * 1.05) * (this.fitFactor || 1) });
      this.onNavigationChange?.(this.getOutdoorProgress());
      this.onViewChange(view); this._invalidate(); return;
    }
    if ((this.activeFloor === 'all' || typeof this.activeFloor === 'number') && view !== 'aisle') { this._fitDryerView(view); return; }
    const whole = this.activeFloor === 'all';
    const base = whole ? (floorElevation(7) + 10.5) / 2 : floorElevation(this.activeFloor);
    this.goalTarget.set(0, base + (view === 'top' ? 0 : whole ? 1 : 2.2), 0);
    this.topCamera.zoom = 1; this.topCamera.updateProjectionMatrix();
    Object.assign(this.goalOrbit, whole
      ? { azimuth: view === 'aisle' ? 0 : .65, elevation: view === 'aisle' ? .12 : .2, distance: 96 * (this.fitFactor || 1) }
      : view === 'aisle' ? { azimuth: -.25, elevation: .18, distance: 35 * (this.fitFactor || 1) } : { azimuth: .76, elevation: .69, distance: 46 * (this.fitFactor || 1) });
    this.onViewChange(view); this._invalidate();
  }

  resetView() { this.navigationEdited = false; this.setView('perspective'); }
  _campusTopZoom() {
    const frame = PLACEMENT_REGIONS.campus;
    return this._roomTopZoom(frame);
  }
  _dryerBounds(level = this.activeFloor) {
    this.scene?.updateMatrixWorld(true);
    const box = new THREE.Box3(), levels = level === 'all' ? null : new Set(level === 7 ? [6, 7, 8] : level === 6 ? [6, 7] : [level]);
    for (const item of this.equipment || []) {
      if (typeof item.floor !== 'number' || (level !== 'all' && item.floor !== level && !(item.visibleFloors || []).includes(level))) continue;
      const root = this.objects.get(item.id); if (root) box.expandByObject(root);
    }
    for (const maps of [this.floorDecks, this.floorStructures]) for (const [floor, root] of maps || []) {
      if (typeof floor === 'number' && (!levels || levels.has(floor))) box.expandByObject(root);
    }
    if (this.upperEnvironments) for (const [floor, environment] of this.upperEnvironments) if (!levels || levels.has(floor)) {
      for (const key of ['ducts', 'stairs', 'cover', 'machineRoomCover', 'machineRoomInterior']) if (environment[key]) box.expandByObject(environment[key]);
    }
    if (this.buildingEnvironments) for (const [floor, environment] of this.buildingEnvironments) if (!levels || levels.has(floor)) {
      for (const key of ['facade', 'cover', 'architectureFixtures']) if (environment[key]) box.expandByObject(environment[key]);
    }
    if (box.isEmpty()) box.setFromCenterAndSize(new THREE.Vector3(0, level === 'all' ? 20 : floorElevation(level) + 3, 0), new THREE.Vector3(30, level === 'all' ? 42 : 8, 28));
    return box;
  }

  _fitDryerView(view) {
    const bounds = this._dryerBounds(), center = bounds.getCenter(new THREE.Vector3()), size = bounds.getSize(new THREE.Vector3());
    this.goalTarget.copy(center); this.dryerTopFit = true;
    this.topCamera.zoom = Math.min((this.topCamera.right - this.topCamera.left) / (size.x + 4), (this.topCamera.top - this.topCamera.bottom) / (size.z + 4)) * .9;
    this.topCamera.updateProjectionMatrix();
    const vertical = (this.camera.fov || 42) * Math.PI / 360;
    const azimuth = this.activeFloor === 8 ? Math.PI - .65 : .65, elevation = this.activeFloor === 'all' ? .26 : this.activeFloor === 8 ? .65 : .5;
    const outward = new THREE.Vector3(Math.sin(azimuth) * Math.cos(elevation), Math.sin(elevation), Math.cos(azimuth) * Math.cos(elevation));
    const right = new THREE.Vector3(Math.cos(azimuth), 0, -Math.sin(azimuth)), up = new THREE.Vector3().crossVectors(outward, right);
    let distance = 1;
    for (const x of [bounds.min.x, bounds.max.x]) for (const y of [bounds.min.y, bounds.max.y]) for (const z of [bounds.min.z, bounds.max.z]) {
      const point = new THREE.Vector3(x, y, z).sub(center), depth = point.dot(outward);
      distance = Math.max(distance, depth + Math.abs(point.dot(right)) / (Math.tan(vertical) * this.camera.aspect), depth + Math.abs(point.dot(up)) / Math.tan(vertical));
    }
    Object.assign(this.goalOrbit, { azimuth, elevation, distance: distance * 1.1 });
    this._ensureCameraRange();
    this.onViewChange(view); this._invalidate();
  }

  _roomTopZoom(frame) {
    return Math.min((this.topCamera.right - this.topCamera.left) / (frame.maxX - frame.minX + 10),
      (this.topCamera.top - this.topCamera.bottom) / (frame.maxZ - frame.minZ + 10)) * .9;
  }
  setFloor(value) {
    if (value === 'roof') value = 8;
    const presentationOverview = this.presentationInspection && value === 'all';
    if ((this.presentationOnly || this.controlledPresentation) && !presentationOverview && ![1, 2, 3, 4, 5, 6, 7, 8].includes(Number(value))) return;
    const next = value === 'all' || value === 'outdoor' || value === 'campus' || value === 'packaging' ? value : Number(value);
    if (!this._areaEnabled(typeof next === 'string' && next !== 'all' ? next : 'dryer')) return;
    if (next !== 'all' && !this.floorDecks.has(next)) return;
    this._stopPerson();
    const personView = this.view === 'person';
    this._cancelPendingPick();
    this._clearHover();
    if (this.activeFloor !== next) this.select(null);
    this.activeFloor = next; this.canvas.dataset.floor = String(next);
    this.personObstacleCache = null;
    this._ensurePerson();
    this.navigationEdited = false;
    this.canvas.dataset.packagingLevel = String(this.getPackagingLevel());
    if (this.sun) {
      const campus = next === 'campus';
      this.sun.position.set(...(campus ? [-95, 180, 125] : [-28, 85, 35]));
      this.sun.target.position.set(...(campus ? CAMPUS_ROOM.center : next === 'packaging' ? this._packagingRoom().center : [0, 24, 0]));
      Object.assign(this.sun.shadow.camera, campus
        ? { left: -230, right: 230, top: 230, bottom: -230, near: 1, far: 600 }
        : { left: -46, right: 46, top: 48, bottom: -48, near: 1, far: 180 });
      this.sun.shadow.camera.updateProjectionMatrix();
    }
    this.resize();
    this._visibility(); this.setView(this.placementMode ? 'top' : personView ? 'person' : 'perspective');
    this._placementGuide();
  }
  setLabels(value) { this.labelsEnabled = !!value; this._invalidate(); }
  setStructure(value) { this.structureEnabled = !!value; this._visibility(); }
  // Columns are part of the structure layer, with their own switch.
  setColumns(value) {
    this.columnsEnabled = !!value; this.personCollisionMeshCache = null; this.personObstacleCache = null;
    this._visibility();
  }
  _columnNodes() {
    if (!this.columnNodeCache) {
      this.columnNodeCache = [];
      const roots = [...(this.buildingEnvironments?.values() || []), ...(this.upperEnvironments?.values() || []), ...(this.packagingEnvironments?.values() || [])];
      for (const environment of roots) for (const root of [environment?.structure, environment?.facade, environment?.ceiling]) root?.traverse?.(node => { if (node.userData.buildingColumn) this.columnNodeCache.push(node); });
    }
    return this.columnNodeCache;
  }
  setPartitions(value) { this.partitionsEnabled = !!value; this._visibility(); }
  setCampusInterior(value) {
    this.campusInteriorEnabled = !!value && !!this.objects.get(this.selected)?.userData.hasInspectableInterior;
    this._visibility();
    return this.campusInteriorEnabled;
  }
  setDucts(value) { this.ductsEnabled = !!value; this._visibility(); }
  setIsolation(value) { this._clearHover(); this.isolated = !!value && !!this.selected; this._visibility(); }
  setExplosion(value) { this._clearHover(); this.explosion = this.selected ? clamp(Number(value) || 0, 0, 1) : 0; this._invalidate(); }

  _visibility() {
    this._applyPackagingDisplayOffsets();
    this._updateLighting?.();
    const onFloor = (floor) => this.activeFloor === 'all' ? floor !== 'outdoor' && floor !== 'campus' && floor !== 'packaging' : floor === this.activeFloor;
    const routeLevels = [...new Set([...this._dryerRouteContextLevels(), ...(this._overlookContextLevels?.() || [])])];
    const inContext = floor => onFloor(floor) || routeLevels.includes(floor);
    for (const item of this.equipment) {
      const visible = (inContext(item.floor) || (item.visibleFloors || []).includes(this.activeFloor)) && (item.floor !== 'packaging' || this.getPackagingLevel() === 'all' || (item.floorLevel ?? 3) === this.getPackagingLevel()) && (!this.isolated || item.id === this.selected);
      const object = this.objects.get(item.id); if (object) {
        object.visible = visible;
        // 렉·평치의 적재물은 설비에 속하지만 「적재물 표시」를 따른다.
        if (object.userData.packagingCargo) object.userData.packagingCargo.visible = !!this.packagingCargoVisible;
        if (object.userData.hasInspectableInterior) object.traverse((node) => {
          if (node.userData.campusInteriorCover) node.visible = !(this.selected === item.id && this.campusInteriorEnabled);
        });
      }
      const disk = this.locationDisks.get(item.id); if (disk) disk.visible = visible && this.view !== 'person';
    }
    const contextNames = new Set(this.equipment.flatMap(item => item.contextOccluders || []));
    const selectedEquipment = this.equipment.find(item => item.id === this.selected);
    const selectedItem = this.campusInteriorEnabled || selectedEquipment?.exteriorContextCutaway ? selectedEquipment : null;
    const hiddenContext = new Set(selectedItem?.contextOccluders || []);
    for (const name of contextNames) {
      const node = this.scene.getObjectByName(name);
      if (node) node.visible = !hiddenContext.has(name);
    }
    if (this.activeFloor === 'campus' && (selectedItem?.inspectableInterior || selectedItem?.exteriorContextCutaway) && selectedItem.attachedTo) {
      const selectedRoot = this.objects.get(selectedItem.id);
      const focus = selectedRoot?.getObjectByName(selectedRoot.userData.interiorFocusObject || 'campus-tank-valve-room-units') || selectedRoot;
      if (focus) {
        this.scene.updateMatrixWorld(true);
        const interiorBox = new THREE.Box3().setFromObject(focus);
        for (const other of this.equipment) {
          if (other.floor !== 'campus' || other.id === selectedItem.id || other.id === selectedItem.attachedTo) continue;
          const root = this.objects.get(other.id);
          // Old user layouts can overlap a newly added room. Reveal the room
          // without moving those buildings or rewriting their saved layout.
          if (root?.visible && interiorBox.intersectsBox(new THREE.Box3().setFromObject(root))) root.visible = false;
        }
      }
    }
    for (const [floor, deck] of this.floorDecks) deck.visible = inContext(floor) && !this.isolated;
    for (const [floor, structure] of this.floorStructures) structure.visible = inContext(floor) && this.structureEnabled && !this.isolated;
    for (const node of this._columnNodes?.() || []) node.visible = this.columnsEnabled !== false;
    if (this.buildingEnvironments) for (const [level, environment] of this.buildingEnvironments) {
      const context = inContext(level) && !this.isolated;
      environment.facade.visible = context && this.structureEnabled && (this.partitionsEnabled || ['aisle', 'person'].includes(this.view));
      if (environment.ceiling) environment.ceiling.visible = context && this.structureEnabled && (this.partitionsEnabled || ['aisle', 'person'].includes(this.view));
      environment.cover.visible = context && this.structureEnabled && this.activeFloor !== 'all';
      const compressorRoof = environment.cover.getObjectByName('dryer-building-3-compressor-room-roof');
      for (const caption of environment.mapCaptions || []) caption.visible = this.view !== 'person' && this.view !== 'aisle';
      if (compressorRoof) compressorRoof.visible = this.partitionsEnabled || ['aisle', 'person'].includes(this.view);
      // A shared stair can remain visible from its other landing without
      // revealing the rooms, doors or furnishings on the adjoining floor.
      const hiddenFixtures = this._hiddenArchitecturalFixtures ||= new WeakMap();
      let sharedStairsVisible = false;
      for (const child of environment.architectureFixtures.children) {
        const shared = child.userData.stepsRepresentative && child.userData.visibleFloors?.includes(this.activeFloor) && !this.isolated;
        if (context || shared) {
          if (hiddenFixtures.has(child)) { child.visible = hiddenFixtures.get(child); hiddenFixtures.delete(child); }
          if (shared && child.visible) sharedStairsVisible = true;
        } else {
          if (!hiddenFixtures.has(child)) hiddenFixtures.set(child, child.visible);
          child.visible = false;
        }
      }
      environment.architectureFixtures.visible = (context || sharedStairsVisible) && this.structureEnabled;
      environment.ducts.visible = context && this.ductsEnabled;
    }
    if (this.upperEnvironments) {
      for (const [level, environment] of this.upperEnvironments) {
        const context = onFloor(level) || (this.activeFloor === 7 && [6, 8].includes(level)) || (this.activeFloor === 6 && level === 7);
        environment.deck.visible = context && !this.isolated;
        environment.structure.visible = context && this.structureEnabled && !this.isolated;
        environment.ducts.visible = context && this.ductsEnabled && !this.isolated;
        if (environment.stairs) environment.stairs.visible = (context || (level === 8 && this.activeFloor === 6)) && this.structureEnabled && !this.isolated;
        if (environment.cover) environment.cover.visible = level === 8 && this.activeFloor === 8 && this.structureEnabled && !this.isolated;
        if (environment.facade) environment.facade.visible = context && (this.partitionsEnabled || ['aisle', 'person'].includes(this.view)) && this.structureEnabled && !this.isolated;
        if (environment.ceiling) environment.ceiling.visible = context && (this.partitionsEnabled || ['aisle', 'person'].includes(this.view)) && this.structureEnabled && !this.isolated;
        if (environment.machineRoomCover) environment.machineRoomCover.visible = context && this.structureEnabled && !this.isolated && this.selected !== 'dryer-roof-drive';
        if (environment.machineRoomInterior) environment.machineRoomInterior.visible = context && (!this.isolated || this.selected === 'dryer-roof-drive');
      }
    } else if (this.ducts) this.ducts.visible = onFloor(7) && this.ductsEnabled && !this.isolated;
    if (this.outdoor) this.outdoor.ducts.visible = onFloor('outdoor') && this.ductsEnabled && !this.isolated;
    if (this.campus) this.campus.ducts.visible = onFloor('campus') && this.ductsEnabled && !this.isolated;
    const packagingEnvironments = this.packagingEnvironments || new Map([[this.getPackagingLevel(), this.packaging]]);
    for (const [level, environment] of packagingEnvironments) {
      if (!environment) continue;
      const visible = onFloor('packaging') && (this.getPackagingLevel() === 'all' || level === this.getPackagingLevel()) && !this.isolated;
      environment.deck.visible = visible;
      environment.structure.visible = visible && this.structureEnabled;
      environment.ducts.visible = visible && this.ductsEnabled;
      if (environment.ceiling) environment.ceiling.visible = visible && this.getPackagingLevel() !== 'all' && this.structureEnabled && (this.partitionsEnabled || ['aisle', 'person'].includes(this.view));
      if (environment.cargo) environment.cargo.visible = visible && !!this.packagingCargoVisible;
    }
    this.survey.visible = onFloor('outdoor') && this.surveyEnabled && !this.isolated;
    this._updatePersonCamera();
    this._invalidate();
  }

  zoomBy(factor, pointer = null) {
    if (this.view === 'person') return;
    if (!Number.isFinite(factor) || factor <= 0 || factor === 1) return;
    this.navigationEdited = true;
    this._clearHover();
    const point = pointer ? this._navigationPoint(pointer, this._goalCamera()) : null;
    let ratio;
    if (this.view === 'top') {
      const previous = this.topCamera.zoom;
      this.topCamera.zoom = clamp(previous * factor, .005, 80);
      ratio = previous / this.topCamera.zoom;
      this.topCamera.updateProjectionMatrix();
    } else {
      const previous = this.goalOrbit.distance;
      const span = this.activeFloor === 'campus' ? CAMPUS_ROOM.span : this.activeFloor === 'outdoor' ? OUTDOOR_ROOM.span : 100;
      this.goalOrbit.distance = clamp(previous / factor, .35, Math.max(2000, span * (this.fitFactor || 1) * 8));
      ratio = this.goalOrbit.distance / previous;
      this._ensureCameraRange();
    }
    if (point) {
      const y = this.goalTarget.y;
      this.goalTarget.lerp(point, 1 - ratio);
      if (this.view === 'top') { this.goalTarget.y = y; this.target.copy(this.goalTarget); }
    }
    this.campusTopFit = false; this.packagingTopFit = false; this.dryerTopFit = false;
    this._notifyNavigation();
    this._invalidate();
  }

  setActive(value) {
    const resumed = !this.active && !!value;
    this.active = !!value;
    if (!this.active) { this._stopPerson(); this.proximityDoors?.reset(); this._clearHover(); this._cancelPendingPick(); }
    this.lastTick = null;
    if (!this.active && this.frame !== null) { cancelAnimationFrame(this.frame); this.frame = null; }
    if (this.active) {
      // Coming back from another menu, tab or sleep: re-read the real canvas
      // size and recover a GPU context the browser dropped meanwhile.
      if (resumed) { this.resize(); this._recoverContext(); }
      this.dirty = true; this._invalidate();
    }
  }

  _recoverContext() {
    const gl = this.renderer?.getContext?.();
    if (!gl?.isContextLost?.()) return;
    clearTimeout(this.contextRestoreTimer);
    // Give the browser a moment to restore by itself, then ask for it.
    this.contextRestoreTimer = setTimeout(() => {
      if (!this.disposed && this.renderer.getContext().isContextLost()) { try { this.renderer.forceContextRestore(); } catch {} }
    }, 1500);
  }

  resize() {
    if (this.disposed) return;
    const rect = this.canvas.parentElement.getBoundingClientRect();
    // The workspace hides this page (display:none) while another menu is open.
    // Keep the last real size instead of squashing cameras and fit distances
    // to 1×1, which left the model distorted after returning.
    if ((rect.width < 2 || rect.height < 2) && this.width > 1 && this.height > 1) { this.pendingResize = true; return; }
    this.pendingResize = false;
    this.width = Math.max(1, rect.width); this.height = Math.max(1, rect.height);
    this.renderer.setSize(this.width, this.height, false);
    const aspect = this.width / this.height;
    this.camera.aspect = aspect; this.camera.updateProjectionMatrix();
    if (this.personCamera) { this.personCamera.aspect = aspect; this._syncPersonFieldOfView(); }
    const halfHeight = Math.max(15.5, 16 / aspect);
    Object.assign(this.topCamera, { left: -halfHeight * aspect, right: halfHeight * aspect, top: halfHeight, bottom: -halfHeight });
    this.topCamera.updateProjectionMatrix();
    if (this.activeFloor === 'campus' && this.view === 'top' && this.campusTopFit) {
      this.topCamera.zoom = this._campusTopZoom(); this.topCamera.updateProjectionMatrix();
    }
    if (this.activeFloor === 'packaging' && this.view === 'top' && this.packagingTopFit) {
      this.topCamera.zoom = this._roomTopZoom(this._packagingRoom().bounds || PLACEMENT_REGIONS.packaging); this.topCamera.updateProjectionMatrix();
    }
    if (this.view === 'top' && this.dryerTopFit) {
      const size = this._dryerBounds().getSize(new THREE.Vector3());
      this.topCamera.zoom = Math.min((this.topCamera.right - this.topCamera.left) / (size.x + 4), (this.topCamera.top - this.topCamera.bottom) / (size.z + 4)) * .9; this.topCamera.updateProjectionMatrix();
    }
    const nextFit = Math.max(1, (this.activeFloor === 'outdoor' || this.activeFloor === 'campus' ? 1.25 : .95) / aspect);
    // A walking viewpoint stays inside the aisle when the viewport changes.
    if (!(['outdoor', 'campus', 'packaging'].includes(this.activeFloor) && this.view === 'aisle')) {
      if (this.fitFactor) { this.goalOrbit.distance *= nextFit / this.fitFactor; this.orbit.distance *= nextFit / this.fitFactor; }
      else { this.goalOrbit.distance *= nextFit; this.orbit.distance *= nextFit; }
    }
    this.fitFactor = nextFit;
    this._invalidate();
  }

  snapshot() {
    this._draw();
    const output = document.createElement('canvas'); output.width = this.canvas.width; output.height = this.canvas.height;
    const ctx = output.getContext('2d'); ctx.drawImage(this.canvas, 0, 0);
    ctx.scale(output.width / this.width, output.height / this.height);
    for (const label of this.labels) {
      if (this.labelLayer.style.display === 'none' || label.element.hidden || !label.layout) continue;
      const { x, y, w, h, anchorX, anchorY } = label.layout;
      if (!label.layout.docked) {
        ctx.strokeStyle = '#66866b'; ctx.lineWidth = .8; ctx.beginPath(); ctx.moveTo(anchorX, anchorY); ctx.lineTo(clamp(anchorX, x + 8, x + w - 8), y + h / 2); ctx.stroke();
      }
      ctx.fillStyle = label.id === this.selected ? '#42653d' : '#fffffff2'; ctx.strokeStyle = '#c7d7be';
      ctx.beginPath(); ctx.roundRect(x, y, w, h, 5); ctx.fill(); ctx.stroke();
      ctx.fillStyle = label.id === this.selected ? '#fff' : '#42603d'; ctx.font = `${label.layout.docked ? '700 14px' : '600 11px'} "Malgun Gothic", sans-serif`; ctx.textBaseline = 'middle';
      const name = label.element.querySelector('.label-name').textContent;
      if (label.layout.docked) {
        const lines = []; let line = '';
        for (const character of name) {
          if (line && ctx.measureText(line + character).width > w - 26) { lines.push(line); line = character; }
          else line += character;
        }
        if (line) lines.push(line);
        const top = y + Math.max(14, (h - lines.length * 21) / 2 + 10);
        lines.forEach((text, index) => ctx.fillText(text, x + 13, top + index * 21, w - 26));
      } else ctx.fillText(name, x + 7, y + h / 2, w - 14);
    }
    const viewport = this.canvas.parentElement.getBoundingClientRect();
    for (const label of [...this.floorLabels, ...(this.packagingFloorLabels || [])]) {
      if (label.element.hidden) continue;
      const bounds = label.element.getBoundingClientRect(), x = bounds.left - viewport.left, y = bounds.top - viewport.top;
      ctx.fillStyle = '#f9fcf2f5'; ctx.strokeStyle = '#c6d3bb'; ctx.beginPath(); ctx.roundRect(x, y, bounds.width, bounds.height, 5); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#365e40'; ctx.font = '600 12px "Malgun Gothic", sans-serif'; ctx.textBaseline = 'middle'; ctx.fillText(label.element.textContent, x + 10, y + bounds.height / 2);
    }
    ctx.fillStyle = '#315645'; ctx.font = '12px "Malgun Gothic", sans-serif'; ctx.textBaseline = 'top';
    ctx.fillText(this.activeFloor === 'packaging' ? this._packagingRoom().name : this.activeFloor === 'campus' ? `${CAMPUS_ROOM.name} · 유산공장 사진·도면 기반 재현` : this.activeFloor === 'outdoor' ? '실외기실 · 사진·영상 기반 개략 재현' : this.activeFloor === 'all' ? '건조기 · 1·1.5·3~7층' : `건조기 · ${FLOORS.find(floor => floor.id === this.activeFloor)?.displayLevel ?? this.activeFloor}층`, 16, 16);
    return output.toDataURL('image/png');
  }

  dispose() {
    clearTimeout(this.contextRestoreTimer);
    if (this.disposed) return;
    this.disposed = true;
    this._stopPerson(); this.personMarker?.remove();
    this.proximityDoors?.dispose();
    this._cancelPendingPick();
    this._clearHover(); this.hoverHint?.remove();
    if (this.frame !== null) cancelAnimationFrame(this.frame);
    this.observer.disconnect(); this.listeners.forEach((remove) => remove());
    this.labelLayer.remove();
    this.geometries.forEach((geometry) => geometry.dispose());
    this.materials.forEach((material) => material.dispose());
    this.textures.forEach((texture) => texture.dispose());
    this.renderer.dispose();
  }
}
