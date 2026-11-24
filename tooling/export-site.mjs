import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { fileURLToPath, pathToFileURL } from 'node:url';
import path from 'node:path';
import { EQUIPMENT, FLOORS, FLOOR_HEIGHT, floorElevation, floorHeight } from '../apps/site/building-data.js';
import { OUTDOOR_EQUIPMENT, OUTDOOR_ROOM } from '../apps/site/outdoor-data.js';
import { CAMPUS_EQUIPMENT, CAMPUS_ROOM } from '../apps/site/campus-data.js';
import { PACKAGING_EQUIPMENT, PACKAGING_ROOM, PACKAGING_ROOMS, PACKAGING_OVERVIEW, PACKAGING_FLOOR_ELEVATIONS } from '../apps/site/packaging-data.js';
import { isRetainedEvidenceImage } from '../apps/site/evidence-assets.js';
import { SITE_ASSETS } from '../apps/site/asset-catalog.js';
import { namespaceModule as namespace, replaceRequired, bundleBurnerMaintenance, bundleBurnerService, bundlePersonAvatar } from './site-export-utils.mjs';

const argumentsList = process.argv.slice(2);
let profile = 'full', outputArgument;
for (let index = 0; index < argumentsList.length; index++) {
  const value = argumentsList[index];
  if (value === '--profile') profile = argumentsList[++index];
  else if (value.startsWith('--') || outputArgument !== undefined) throw new Error('Usage: node tooling/export-site.mjs [--profile full|dryer|presentation] [output.html]');
  else outputArgument = value;
}
if (!['full', 'dryer', 'presentation'].includes(profile)) throw new Error(`Unknown site export profile: ${profile}`);

const root = new URL('../', import.meta.url);
const read = async (name) => (await readFile(new URL(name, root), 'utf8')).replace(/\r\n/g, '\n');
const assetsByPath = new Map(SITE_ASSETS.map(asset => [asset.path, asset]));
async function readShareImage(reference) {
  const asset = assetsByPath.get(reference);
  if (!asset) throw new Error(`Unregistered share image: ${reference}`);
  return readFile(new URL('apps/site/' + (asset.sharePath || asset.path).slice(2), root));
}

if (profile !== 'full') {
  const { exportDryerPresentation } = await import('./export-dryer-presentation.mjs');
  await exportDryerPresentation({ output: outputArgument, profile });
} else {
const [template, css, editorCss, furnaceCss, appSource, scene, models, outdoorModels, campusModels, furnaceModel, furnaceDrawingData, furnaceDrawingModel, furnaceDetailSource, layoutEditor, placementRules, three, license, packagingModels, packagingEquipmentV2, packagingEnvironmentV2, packagingLineModels, packagingRoutes, chillerDataSource, chillerModel, detailCamera, chillerDetail, chillerCss, liquidData, liquidModels, liquidAssetsSource, liquidDetail, liquidCss, upperModels, upperReferenceSource, upperReferenceCss] = await Promise.all([
  'apps/site/share/index.html', 'apps/site/share/styles.css', 'apps/site/layout-editor.css', 'apps/site/furnace-detail.css', 'apps/site/share/app.js',
  'apps/site/scene.js', 'apps/site/facility-models.js', 'apps/site/outdoor-models.js', 'apps/site/campus-models.js', 'apps/site/furnace-model.js', 'apps/site/furnace-drawing-data.js', 'apps/site/furnace-drawing-model.js', 'apps/site/furnace-detail.js', 'apps/site/layout-editor.js', 'apps/site/placement-rules.js',
  'apps/shared/vendor/three.export.min.js', 'apps/shared/vendor/THREE-LICENSE.txt', 'apps/site/packaging-models.js',
  'apps/site/packaging-equipment-v2.js', 'apps/site/packaging-environment-v2.js', 'apps/site/packaging-line-models.js',
  'apps/site/packaging-routes.js',
  'apps/site/chiller-data.js', 'apps/site/chiller-model.js', 'apps/site/detail-camera.js', 'apps/site/chiller-detail.js', 'apps/site/chiller-detail.css',
  'apps/site/liquid-data.js', 'apps/site/liquid-models.js', 'apps/site/liquid-assets.js', 'apps/site/liquid-detail.js', 'apps/site/liquid-detail.css',
  'apps/site/dryer-upper-models.js', 'apps/site/dryer-upper-reference.js', 'apps/site/dryer-upper-reference.css',
].map(read));
const buildingEnvelope = await read('apps/site/dryer-building-envelope.js');
const processModels = await read('apps/site/dryer-process-models.js');
const preparationModels = await read('apps/site/preparation-models.js');
const preparationEnvironment = await read('apps/site/preparation-environment.js');
const dryerRouteEnvironment = await read('apps/site/dryer-route-environment.js');
const dryerCompressorEnvironment = await read('apps/site/dryer-compressor-environment.js');
const dryerCompressorInterior = await read('apps/site/dryer-compressor-interior-details.js');
const liquidCardModels = await read('apps/site/liquid-card-models.js');
const packagingKit = await read('apps/site/packaging-kit.js');
const packagingStorageModels = await read('apps/site/packaging-storage-models.js');
const packagingMixingModels = await read('apps/site/packaging-mixing-models.js');
const packagingFloor3Environment = await read('apps/site/packaging-floor3-environment.js');
const campusRearModels = await read('apps/site/campus-rear-models.js');
const boilerModels = await read('apps/site/boiler-models.js');
const rearStairModels = await read('apps/site/rear-stair-models.js');
const wastewaterData = await read('apps/site/wastewater-data.js');
const wastewaterModels = await read('apps/site/wastewater-models.js');
const entranceRouteData = await read('apps/site/entrance-route-data.js');
const entranceProductionModels = await read('apps/site/entrance-production-models.js');
const personWalk = await read('apps/site/person-walk.js');
const proximityDoors = await read('apps/site/proximity-doors.js');

// The AST-minified offline copy leaves room for model additions without
// reducing reference-photo quality. Never bundle a stale vendor derivative.
const threeManifest = JSON.parse(await read('apps/shared/vendor/three.export.min.meta.json'));
for (const entry of [threeManifest.source, threeManifest.result]) {
  const bytes = await readFile(new URL(`apps/shared/vendor/${entry.file}`, root));
  if (createHash('sha256').update(bytes).digest('hex') !== entry.sha256) {
    throw new Error(`Three.js offline derivative hash mismatch: ${entry.file}. Regenerate and verify the minified copy.`);
  }
}

// Keep the actual company mark available in the one-file shared model.
const brandBytes = await readFile(new URL('apps/site/assets/brand/heechang-official-logo.svg', root));
const campusModelsWithBrand = campusModels.replaceAll('./assets/brand/heechang-official-logo.svg', `data:image/svg+xml;base64,${brandBytes.toString('base64')}`);

// Model data stays compact. The supplied furnace detail photos are embedded
// separately so its presentation also works in the offline shared file.
const fields = ['id', 'floor', 'name', 'type', 'tag', 'position', 'rotation', 'previousRotation', 'previousPlacements', 'placementRevision', 'parts', 'labelHeight', 'height', 'length', 'radius', 'variant', 'detailKey', 'visibleFloors', 'width', 'depth', 'belowFloor', 'stations', 'positionBasis', 'positionConfidence', 'preparation', 'dryerRoute', 'inspectableInterior', 'interiorView', 'physicalRoomId', 'samePhysicalRoomAs'];
const sharedEquipment = EQUIPMENT.map((item) => Object.fromEntries(fields.filter((field) => field in item).map((field) => [field, item[field]])));
const sharedFloors = FLOORS.map(({ reference, photos, source, sourceReference, summary, ...floor }) => floor);
const outdoorFields = [...fields, 'width', 'depth', 'count', 'fanCount', 'fanRows', 'fanColumns', 'historyCardNumber', 'previousPosition', 'previousPositions', 'previousPlacements'];
const sharedOutdoorEquipment = OUTDOOR_EQUIPMENT.map((item) => Object.fromEntries(outdoorFields.filter((field) => field in item).map((field) => [field, item[field]])));
const evidenceFields = new Set(['summary', 'details', 'photo', 'photos', 'videoPhotos', 'photoCaptions', 'reference', 'confidence', 'source', 'sourcePhotos', 'gps', 'origin']);
const sharedOutdoorRoom = Object.fromEntries(Object.entries(OUTDOOR_ROOM).filter(([key]) => !evidenceFields.has(key)));
const sharedCampusEquipment = CAMPUS_EQUIPMENT.map((item) => Object.fromEntries(Object.entries(item).filter(([key]) => !evidenceFields.has(key))));
const sharedCampusRoom = Object.fromEntries(Object.entries(CAMPUS_ROOM).filter(([key]) => !evidenceFields.has(key)));
const sharedPackagingEquipment = PACKAGING_EQUIPMENT.map((item) => Object.fromEntries(Object.entries(item).filter(([key]) => !evidenceFields.has(key))));
const sharedPackagingRoom = Object.fromEntries(Object.entries(PACKAGING_ROOM).filter(([key]) => !evidenceFields.has(key)));
const sharedPackagingRooms = Object.fromEntries(Object.entries(PACKAGING_ROOMS).map(([level, room]) => [level, Object.fromEntries(Object.entries(room).filter(([key]) => !evidenceFields.has(key)))]));
const sharedPackagingOverview = Object.fromEntries(Object.entries(PACKAGING_OVERVIEW).filter(([key]) => !evidenceFields.has(key)));
let furnaceDetail = furnaceDetailSource;
const furnacePhotos = SITE_ASSETS.filter(asset => asset.category === 'drawing-furnace').map(asset => asset.path);
for (const reference of furnacePhotos) {
  if (!furnaceDetail.includes(reference)) throw new Error(`Unreferenced furnace drawing: ${reference}`);
  const bytes = await readShareImage(reference);
  if (bytes[0] !== 0xff || bytes[1] !== 0xd8) throw new Error(`Invalid furnace JPEG: ${reference}`);
  furnaceDetail = furnaceDetail.replaceAll(reference, `data:image/jpeg;base64,${bytes.toString('base64')}`);
}
let chillerData = chillerDataSource;
const chillerAssetPattern = /\.\/assets\/(?:drawings|documents)\/chiller\/[a-z\d-]+\.jpg/g;
// Embed the registered chiller drawings and technical documents.
const { CHILLER_ASSETS } = await import('../apps/site/chiller-data.js');
const chillerAssetEntries = [];
for (const [key, reference] of Object.entries(CHILLER_ASSETS)) {
  if (!isRetainedEvidenceImage(reference)) continue;
  const bytes = await readShareImage(reference);
  if (bytes[0] !== 0xff || bytes[1] !== 0xd8) throw new Error('Invalid chiller JPEG: ' + reference);
  chillerAssetEntries.push([key, 'data:image/jpeg;base64,' + bytes.toString('base64')]);
}
const registryStart = chillerData.indexOf('export const CHILLER_ASSETS =');
const registryEnd = chillerData.indexOf('export const CHILLER_PARTS =');
if (registryStart < 0 || registryEnd < registryStart) throw new Error('Missing chiller asset registry.');
chillerData = chillerData.slice(0, registryStart) + 'export const CHILLER_ASSETS = ' + JSON.stringify(Object.fromEntries(chillerAssetEntries)) + ';\n' + chillerData.slice(registryEnd);
if (chillerAssetPattern.test(chillerData)) throw new Error('Unembedded chiller asset.');
let liquidAssets = liquidAssetsSource;
const { LIQUID_ASSETS } = await import('../apps/site/liquid-assets.js');
const liquidEntries = [];
for (const [number, reference] of Object.entries(LIQUID_ASSETS)) {
  const bytes = await readShareImage(reference);
  if (bytes[0] !== 0xff || bytes[1] !== 0xd8) throw new Error('Invalid liquid JPEG: ' + number);
  liquidEntries.push([number, 'data:image/jpeg;base64,' + bytes.toString('base64')]);
}
const liquidRegistryStart = liquidAssets.indexOf('export const LIQUID_ASSETS =');
const liquidRegistryEnd = liquidAssets.indexOf('export function liquidAsset(');
if (liquidRegistryStart < 0 || liquidRegistryEnd < 0) throw new Error('Missing liquid asset registry.');
liquidAssets = liquidAssets.slice(0, liquidRegistryStart) + 'export const LIQUID_ASSETS = ' + JSON.stringify(Object.fromEntries(liquidEntries)) + ';\n' + liquidAssets.slice(liquidRegistryEnd);
let upperReference = upperReferenceSource;
const upperReferencePhotos = [...new Set(upperReference.match(/\.\/photos\/dryer-roof-7f\/frame-\d+s\.jpg/g) || [])];
for (const reference of upperReferencePhotos) {
  const bytes = await readFile(new URL('references/dryer-roof-7f-20261110/offline-assets/' + path.basename(reference), root));
  if (bytes[0] !== 0xff || bytes[1] !== 0xd8) throw new Error('Invalid dryer upper JPEG: ' + reference);
  upperReference = upperReference.replaceAll(reference, 'data:image/jpeg;base64,' + bytes.toString('base64'));
}
const data = `const FLOORS = ${JSON.stringify(sharedFloors)};\nconst FLOOR_HEIGHT = ${FLOOR_HEIGHT};\nconst EQUIPMENT = ${JSON.stringify(sharedEquipment)};\nconst OUTDOOR_EQUIPMENT = ${JSON.stringify(sharedOutdoorEquipment)};\nconst OUTDOOR_ROOM = ${JSON.stringify(sharedOutdoorRoom)};\nconst CAMPUS_EQUIPMENT = ${JSON.stringify(sharedCampusEquipment)};\nconst CAMPUS_ROOM = ${JSON.stringify(sharedCampusRoom)};\nconst floorElevation = ${floorElevation.toString()};\nconst floorHeight = ${floorHeight.toString()};`;
const packagingData = `const PACKAGING_EQUIPMENT = ${JSON.stringify(sharedPackagingEquipment)};\nconst PACKAGING_ROOM = ${JSON.stringify(sharedPackagingRoom)};\nconst PACKAGING_ROOMS = ${JSON.stringify(sharedPackagingRooms)};\nconst PACKAGING_OVERVIEW = ${JSON.stringify(sharedPackagingOverview)};\nconst PACKAGING_FLOOR_ELEVATIONS = ${JSON.stringify(PACKAGING_FLOOR_ELEVATIONS)};`;
let app = replaceRequired(appSource, "import { EQUIPMENT, FLOORS } from '../building-data.js';", '');
app = replaceRequired(app, "import { BURNER_MAINTENANCE_DOCUMENTS } from '../burner-maintenance-data.js';", '');
app = replaceRequired(app, "import { OUTDOOR_EQUIPMENT, OUTDOOR_ROOM } from '../outdoor-data.js';", '');
app = replaceRequired(app, "import { CAMPUS_EQUIPMENT, CAMPUS_ROOM } from '../campus-data.js';", '');
app = replaceRequired(app, "import { PACKAGING_EQUIPMENT, PACKAGING_ROOM, PACKAGING_ROOMS, PACKAGING_OVERVIEW } from '../packaging-data.js';", '');
app = replaceRequired(app, "import { createLayoutEditor } from '../layout-editor.js';", '');
app = replaceRequired(app, "import { createFurnaceDetail } from '../furnace-detail.js';", '');
app = replaceRequired(app, "import { createChillerDetail } from '../chiller-detail.js';", '');
app = replaceRequired(app, "import { createLiquidDetail } from '../liquid-detail.js';", '');
app = replaceRequired(app, "import { createDryerUpperReference } from '../dryer-upper-reference.js';", '');
app = replaceRequired(app, "import { createCompressorSurvey } from '../dryer-compressor-view.js';", '');
app = replaceRequired(app, "  const { createFacilityScene } = await import('../scene.js');", '');
if (/^\s*(?:import|export)\s/m.test(app) || /\bimport\s*\(/.test(app)) throw new Error('Unexpected viewer import.');
const { COMPRESSOR_MEDIA, COMPRESSOR_PLAN_IMAGE, COMPRESSOR_WALK_FRAMES } = await import('../apps/site/dryer-compressor-media.js');
const compressorPhotos = await Promise.all(COMPRESSOR_MEDIA.map(async photo => ({
  ...photo, path: 'data:image/jpeg;base64,' + (await readShareImage(photo.path)).toString('base64'),
})));
const compressorPlan = 'data:image/png;base64,' + (await readShareImage(COMPRESSOR_PLAN_IMAGE)).toString('base64');
const walkFrames = await Promise.all(COMPRESSOR_WALK_FRAMES.map(async frame => ({
  ...frame, path: 'data:image/jpeg;base64,' + (await readShareImage(frame.path)).toString('base64'),
})));
const code = [
  namespace(three, 'THREE'),
  namespace(await read('apps/site/dryer-compressor-records.js'), 'compressorRecordsModule'),
  namespace(await read('apps/site/dryer-compressor-manuals.js'), 'compressorManualsModule'),
  namespace(await read('apps/site/dryer-compressor-elevations.js'), 'compressorElevationsModule', ["import * as THREE from '../shared/vendor/three.module.js';"]),
  'const { drawEquipmentElevation } = compressorElevationsModule;',
  'const { COMPRESSOR_RECORDS } = compressorRecordsModule, { COMPRESSOR_MANUALS } = compressorManualsModule;',
  'const COMPRESSOR_MEDIA = ' + JSON.stringify(compressorPhotos) + ', COMPRESSOR_PLAN_IMAGE = ' + JSON.stringify(compressorPlan) + ', COMPRESSOR_WALK_FRAMES = ' + JSON.stringify(walkFrames) + ';',
  namespace(await read('apps/site/dryer-compressor-view.js'), 'compressorViewModule', [
    "import * as THREE from '../shared/vendor/three.module.js';",
    "import { COMPRESSOR_RECORDS } from './dryer-compressor-records.js';",
    "import { COMPRESSOR_MANUALS } from './dryer-compressor-manuals.js';",
    "import { drawEquipmentElevation } from './dryer-compressor-elevations.js';",
    "import { COMPRESSOR_MEDIA, COMPRESSOR_PLAN_IMAGE, COMPRESSOR_WALK_FRAMES } from './dryer-compressor-media.js';",
  ]),
  'const { createCompressorSurvey } = compressorViewModule;',
  namespace(await read('apps/site/equipment-lighting.js'), 'lightModule', ["import * as THREE from '../shared/vendor/three.module.js';"]),
  'const { equipmentReflection } = lightModule;',
  data,
  packagingData,
  namespace(models, 'modelsModule'),
  'const { buildFacilityEquipment } = modelsModule;',
  namespace(furnaceModel, 'furnaceModelModule'),
  'const { buildFurnace } = furnaceModelModule;',
  namespace(furnaceDrawingData, 'furnaceDrawingDataModule'),
  'const { BASIS, DIMENSIONS, DRAWING_GROUPS, DRAWING_INFO, DRAWING_PARTS, DRAWING_SHEETS, FIELD_STATUS, GAS_PATH, PART_BY_ID, PILOT_PATH, TRAIN_GASKET_ALLOWANCE } = furnaceDrawingDataModule;',
  namespace(furnaceDrawingModel, 'furnaceDrawingModelModule', [
    "import * as THREE from '../shared/vendor/three.module.js';",
    "import { DIMENSIONS, DRAWING_PARTS, TRAIN_GASKET_ALLOWANCE } from './furnace-drawing-data.js';",
  ]),
  'const { createDrawingModel, DIMENSION_LINES, FLOW_TAG } = furnaceDrawingModelModule;',
  await bundleBurnerMaintenance(),
  await bundleBurnerService(),
  namespace(furnaceDetail, 'furnaceDetailModule', [
    "import * as THREE from '../shared/vendor/three.module.js';",
    "import { buildFurnace } from './furnace-model.js';",
    "import { createDrawingModel, DIMENSION_LINES, FLOW_TAG } from './furnace-drawing-model.js';",
    "import { BASIS, DRAWING_GROUPS, DRAWING_INFO, DRAWING_PARTS, DRAWING_SHEETS, FIELD_STATUS, GAS_PATH, PART_BY_ID, PILOT_PATH } from './furnace-drawing-data.js';",
    "import { createBurnerMaintenance } from './burner-maintenance.js';",
    "import { createBurnerService } from './burner-service.js';",
  ]),
  'const { createFurnaceDetail } = furnaceDetailModule;',
  namespace(chillerData, 'chillerDataModule'),
  'const { CHILLER_INFO, CHILLER_PARTS, CHILLER_BOM, CHILLER_SHEETS, chillerAsset } = chillerDataModule;',
  namespace(chillerModel, 'chillerModelModule', ["import * as THREE from '../shared/vendor/three.module.js';"]),
  'const { createChillerModel } = chillerModelModule;',
  namespace(detailCamera, 'detailCameraModule', ["import * as THREE from '../shared/vendor/three.module.js';"]),
  'const { createDetailCamera } = detailCameraModule;',
  namespace(chillerDetail, 'chillerDetailModule', [
    "import * as THREE from '../shared/vendor/three.module.js';",
    "import { createChillerModel } from './chiller-model.js';",
    "import { createDetailCamera } from './detail-camera.js';",
    "import { CHILLER_INFO, CHILLER_PARTS, CHILLER_BOM, CHILLER_SHEETS, chillerAsset } from './chiller-data.js';",
  ]),
  'const { createChillerDetail } = chillerDetailModule;',
  namespace(liquidData, 'liquidDataModule'),
  'const { LIQUID_ROOM, LIQUID_ROOMS, LIQUID_EQUIPMENT } = liquidDataModule;',
  namespace(liquidAssets, 'liquidAssetsModule'),
  'const { liquidAsset } = liquidAssetsModule;',
  namespace(liquidCardModels, 'liquidCardModelsModule', ["import * as THREE from '../shared/vendor/three.module.js';"]),
  'const { buildLiquidCardExterior } = liquidCardModelsModule;',
  namespace(liquidModels, 'liquidModelsModule', ["import * as THREE from '../shared/vendor/three.module.js';", "import { buildLiquidCardExterior } from './liquid-card-models.js';"]),
  'const { createLiquidModel } = liquidModelsModule;',
  namespace(liquidDetail, 'liquidDetailModule', [
    "import * as THREE from '../shared/vendor/three.module.js';",
    "import { createDetailCamera } from './detail-camera.js';",
    "import { createLiquidModel } from './liquid-models.js';",
    "import { LIQUID_ROOM, LIQUID_ROOMS, LIQUID_EQUIPMENT } from './liquid-data.js';",
    "import { liquidAsset } from './liquid-assets.js';",
    "import { createProximityDoorController } from './proximity-doors.js';",
  ]),
  'const { createLiquidDetail } = liquidDetailModule;',
  namespace(outdoorModels, 'outdoorModelsModule', [
    "import * as THREE from '../shared/vendor/three.module.js';",
    "import { OUTDOOR_ROOM } from './outdoor-data.js';",
    "import { createChillerModel } from './chiller-model.js';",
  ]),
  'const { buildOutdoorEnvironment, buildOutdoorEquipment } = outdoorModelsModule;',
  namespace(campusRearModels, 'campusRearModelsModule', ["import * as THREE from '../shared/vendor/three.module.js';"]),
  'const { buildCampusRearEquipment, addCampusRearDetails } = campusRearModelsModule;',
  namespace(boilerModels, 'boilerModelsModule', ["import * as THREE from '../shared/vendor/three.module.js';"]),
  'const { buildCampusBoilerRoom, buildPreparationBoilerRoom } = boilerModelsModule;',
  namespace(rearStairModels, 'rearStairModelsModule', ["import * as THREE from '../shared/vendor/three.module.js';"]),
  'const { buildRearStairDetails } = rearStairModelsModule;',
  namespace(wastewaterData, 'wastewaterDataModule'),
  namespace(`const { WASTEWATER_DRAWING, WASTEWATER_LAYOUT: L } = wastewaterDataModule;\n${wastewaterModels}`, 'wastewaterModelsModule', [
    "import * as THREE from '../shared/vendor/three.module.js';",
    "import { WASTEWATER_DRAWING, WASTEWATER_LAYOUT as L } from './wastewater-data.js';",
  ]),
  'const { buildCampusWastewater } = wastewaterModelsModule;',
  namespace(entranceRouteData, 'entranceRouteDataModule'),
  namespace(`const { ENTRANCE_PRODUCTION_SURVEY: SURVEY } = entranceRouteDataModule;\n${entranceProductionModels}`, 'entranceProductionModelsModule', [
    "import * as THREE from '../shared/vendor/three.module.js';",
    "import { ENTRANCE_PRODUCTION_SURVEY as SURVEY } from './entrance-route-data.js';",
  ]),
  'const { buildEntranceProduction } = entranceProductionModelsModule;',
  namespace(campusModelsWithBrand, 'campusModelsModule', [
    "import * as THREE from '../shared/vendor/three.module.js';",
    "import { CAMPUS_ROOM } from './campus-data.js';",
    "import { OUTDOOR_EQUIPMENT, OUTDOOR_ROOM } from './outdoor-data.js';",
    "import { buildOutdoorEnvironment, buildOutdoorEquipment } from './outdoor-models.js';",
    "import { buildCampusRearEquipment, addCampusRearDetails } from './campus-rear-models.js';",
    "import { buildCampusBoilerRoom } from './boiler-models.js';",
    "import { buildRearStairDetails } from './rear-stair-models.js';",
    "import { buildCampusWastewater } from './wastewater-models.js';",
    "import { buildEntranceProduction } from './entrance-production-models.js';",
  ]),
  'const { buildCampusEnvironment, buildCampusEquipment } = campusModelsModule;',
  namespace(packagingKit, 'packagingKitModule', ["import * as THREE from '../shared/vendor/three.module.js';"]),
  'const { PartKit, frustum, goods, packagingMaterials, seeded, stackCartons, textPlate } = packagingKitModule;',
  namespace(packagingStorageModels, 'packagingStorageModelsModule', ["import * as THREE from '../shared/vendor/three.module.js';", "import { PartKit, goods, packagingMaterials, seeded, stackCartons, textPlate } from './packaging-kit.js';"]),
  'const { buildPackagingStorage, tableSacks } = packagingStorageModelsModule;',
  namespace(packagingMixingModels, 'packagingMixingModelsModule', [
    "import * as THREE from '../shared/vendor/three.module.js';",
    "import { PartKit, frustum, packagingMaterials, textPlate } from './packaging-kit.js';",
  ]),
  'const { buildPackagingMixing, buildAgitatorHopper } = packagingMixingModelsModule;',
  namespace(packagingFloor3Environment, 'packagingFloor3EnvironmentModule', [
    "import * as THREE from '../shared/vendor/three.module.js';",
    "import { PartKit, packagingMaterials, stackCartons, seeded, textPlate } from './packaging-kit.js';",
  ]),
  'const { buildFloor3Decks, floor3Fixtures, floor3Lettering, freightLift, hopperVentDrops, slidingDoor, stickWallServices, vinylCurtain } = packagingFloor3EnvironmentModule;',
  namespace(packagingEquipmentV2, 'packagingEquipmentV2Module', [
    "import * as THREE from '../shared/vendor/three.module.js';",
    "import { buildPackagingMixing } from './packaging-mixing-models.js';",
    "import { buildPackagingStorage } from './packaging-storage-models.js';",
  ]),
  'const { buildPackagingEquipmentV2 } = packagingEquipmentV2Module;',
  namespace(packagingRoutes, 'packagingRoutesModule'),
  'const { PACKAGING_STAIR_PROFILES, packagingEntryStairPlan } = packagingRoutesModule;',
  namespace(packagingEnvironmentV2, 'packagingEnvironmentV2Module', [
    "import * as THREE from '../shared/vendor/three.module.js';",
    "import { PACKAGING_STAIR_PROFILES, packagingEntryStairPlan } from './packaging-routes.js';",
    "import { buildFloor3Decks, floor3Fixtures, floor3Lettering, freightLift, hopperVentDrops, slidingDoor, stickWallServices, vinylCurtain } from './packaging-floor3-environment.js';",
    "import { tableSacks } from './packaging-storage-models.js';",
  ]),
  'const { buildPackagingEnvironmentV2 } = packagingEnvironmentV2Module;',
  namespace(packagingLineModels, 'packagingLineModelsModule', [
    "import * as THREE from '../shared/vendor/three.module.js';",
    "import { buildAgitatorHopper } from './packaging-mixing-models.js';",
  ]),
  'const { buildPackagingLineEquipment } = packagingLineModelsModule;',
  namespace(packagingModels, 'packagingModelsModule', [
    "import * as THREE from '../shared/vendor/three.module.js';",
    "import { PACKAGING_ROOM } from './packaging-data.js';",
    "import { buildPackagingEquipmentV2 } from './packaging-equipment-v2.js';",
    "import { buildPackagingEnvironmentV2 } from './packaging-environment-v2.js';",
    "import { buildPackagingLineEquipment } from './packaging-line-models.js';",
  ]),
  'const { buildPackagingEnvironment, buildPackagingEquipment } = packagingModelsModule;',
  namespace(placementRules, 'placementRulesModule'),
  'const { PLACEMENT_RULES, PLACEMENT_REGIONS, constrainPlacement, toRoomPosition, fromRoomPosition, rotatedFootprint } = placementRulesModule;',
  namespace(personWalk, 'personWalkModule'),
  'const { WALK_RULES, createPersonState, advancePerson, lookPerson, isPersonPositionFree } = personWalkModule;',
  await bundlePersonAvatar(),
  namespace(proximityDoors, 'proximityDoorsModule', ["import * as THREE from '../shared/vendor/three.module.js';"]),
  'const { createProximityDoorController } = proximityDoorsModule;',
  namespace(upperModels, 'dryerUpperModelsModule', [
    "import * as THREE from '../shared/vendor/three.module.js';",
    "import { buildFurnace } from './furnace-model.js';",
  ]),
  'const { buildDryerUpperEnvironment, buildDryerUpperEquipment } = dryerUpperModelsModule;',
  namespace(upperReference, 'dryerUpperReferenceModule'),
  'const { createDryerUpperReference } = dryerUpperReferenceModule;',
  namespace(buildingEnvelope, 'dryerBuildingEnvelopeModule', ["import * as THREE from '../shared/vendor/three.module.js';"]),
  'const { buildDryerBuildingEnvironment, alignDryerCompressorEntrance } = dryerBuildingEnvelopeModule;',
  namespace(processModels, 'dryerProcessModelsModule', ["import * as THREE from '../shared/vendor/three.module.js';"]),
  'const { buildDryerProcessEquipment } = dryerProcessModelsModule;',
  namespace(preparationModels, 'preparationModelsModule', ["import * as THREE from '../shared/vendor/three.module.js';"]),
  'const { buildPreparationEquipment } = preparationModelsModule;',
  namespace(preparationEnvironment, 'preparationEnvironmentModule', ["import * as THREE from '../shared/vendor/three.module.js';"]),
  'const { buildPreparationEnvironment } = preparationEnvironmentModule;',
  namespace(dryerRouteEnvironment, 'dryerRouteEnvironmentModule', ["import * as THREE from '../shared/vendor/three.module.js';"]),
  'const { buildDryerRouteEnvironment } = dryerRouteEnvironmentModule;',
  namespace(dryerCompressorEnvironment, 'dryerCompressorEnvironmentModule', ["import * as THREE from '../shared/vendor/three.module.js';"]),
  'const { buildDryerCompressorEnvironment } = dryerCompressorEnvironmentModule;',
  namespace(dryerCompressorInterior, 'dryerCompressorInteriorModule', ["import * as THREE from '../shared/vendor/three.module.js';"]),
  'const { buildDryerCompressorInteriorDetails } = dryerCompressorInteriorModule;',
  namespace(scene, 'sceneModule', [
    "import { equipmentReflection } from './equipment-lighting.js';",
    "import * as THREE from '../shared/vendor/three.module.js';",
    "import { FLOORS, FLOOR_HEIGHT, floorElevation, floorHeight } from './facility-data.js';",
    "import { buildFacilityEquipment } from './facility-models.js';",
    "import { buildDryerProcessEquipment } from './dryer-process-models.js';",
    "import { buildPreparationEquipment } from './preparation-models.js';",
    "import { buildDryerRouteEnvironment } from './dryer-route-environment.js';",
    "import { buildDryerCompressorEnvironment } from './dryer-compressor-environment.js';",
    "import { buildDryerCompressorInteriorDetails } from './dryer-compressor-interior-details.js';",
    "import { buildPreparationBoilerRoom } from './boiler-models.js';",
    "import { buildPreparationEnvironment } from './preparation-environment.js';",
    "import { buildDryerUpperEnvironment, buildDryerUpperEquipment } from './dryer-upper-models.js';",
    "import { buildDryerBuildingEnvironment, alignDryerCompressorEntrance } from './dryer-building-envelope.js';",
    "import { OUTDOOR_ROOM } from './outdoor-data.js';",
    "import { CAMPUS_ROOM } from './campus-data.js';",
    "import { PACKAGING_ROOM, PACKAGING_ROOMS, PACKAGING_OVERVIEW, PACKAGING_FLOOR_ELEVATIONS } from './packaging-data.js';",
    "import { buildOutdoorEnvironment, buildOutdoorEquipment } from './outdoor-models.js';",
    "import { buildCampusEnvironment, buildCampusEquipment } from './campus-models.js';",
    "import { buildPackagingEnvironment, buildPackagingEquipment } from './packaging-models.js';",
    "import { PLACEMENT_RULES, PLACEMENT_REGIONS, constrainPlacement, toRoomPosition, fromRoomPosition, rotatedFootprint } from './placement-rules.js';",
    "import { WALK_RULES, createPersonState, advancePerson, lookPerson, isPersonPositionFree } from './person-walk.js';",
    "import { buildPersonAvatar } from './person-avatar.js';",
    "import { createProximityDoorController } from './proximity-doors.js';",
    "import { buildFurnace } from './furnace-model.js';",
  ]),
  'const { createFacilityScene } = sceneModule;',
  namespace(layoutEditor, 'layoutEditorModule'),
  'const { createLayoutEditor } = layoutEditorModule;',
  app,
].join('\n');
const check = spawnSync(process.execPath, ['--check', '--input-type=module'], { input: code, encoding: 'utf8', windowsHide: true });
if (check.status !== 0) throw new Error(check.stderr || 'Bundled JavaScript syntax check failed.');
if (/@import\b|url\(\s*['"]?(?:https?:|\/\/)/i.test(css + editorCss + furnaceCss + chillerCss + liquidCss + upperReferenceCss)) throw new Error('Viewer styles need to stay offline.');
let html = replaceRequired(template, '<link rel="stylesheet" href="./styles.css">', `<style>\n${css.replace(/<\/style/gi, '<\\/style')}\n</style>`);
html = replaceRequired(html, '<link rel="stylesheet" href="../layout-editor.css">', `<style>\n${editorCss.replace(/<\/style/gi, '<\\/style')}\n</style>`);
html = replaceRequired(html, '<link rel="stylesheet" href="../furnace-detail.css">', `<style>\n${furnaceCss.replace(/<\/style/gi, '<\\/style')}\n</style>`);
html = replaceRequired(html, '<link rel="stylesheet" href="../chiller-detail.css">', `<style>\n${chillerCss.replace(/<\/style/gi, '<\\/style')}\n</style>`);
html = replaceRequired(html, '<link rel="stylesheet" href="../liquid-detail.css">', `<style>\n${liquidCss.replace(/<\/style/gi, '<\\/style')}\n</style>`);
html = replaceRequired(html, '<link rel="stylesheet" href="../dryer-upper-reference.css">', `<style>\n${upperReferenceCss.replace(/<\/style/gi, '<\\/style')}\n</style>`);
html = replaceRequired(html, '<script type="module" src="./app.js"></script>', '');
html = replaceRequired(html, '<link rel="stylesheet" href="../dryer-compressor-view.css">', '<style>' + await read('apps/site/dryer-compressor-view.css') + '</style>');
html = replaceRequired(html, '</body>', `<!-- Three.js license:\n${license.replace(/--/g, '- -')}\n-->\n<script type="module">\n${code.replace(/<\/script/gi, '<\\/script')}\n</script>\n</body>`);
if (/\b(?:src|href)\s*=\s*["'](?:\.\.?\/|https?:|\/\/)/i.test(html)) throw new Error('Shared HTML still depends on another file.');
const output = outputArgument ? pathToFileURL(path.resolve(outputArgument)) : new URL('exports/건조기-3D-지도.html', root);
const directory = new URL('./', output);
await mkdir(directory, { recursive: true });
await writeFile(output, html, 'utf8');
console.log(`Created ${fileURLToPath(output)} (${Buffer.byteLength(html).toLocaleString()} bytes).`);
console.log(`${sharedFloors.length} dryer floors, ${Object.keys(sharedPackagingRooms).length} packaging floors, ${sharedEquipment.length + sharedOutdoorEquipment.length + sharedCampusEquipment.length + sharedPackagingEquipment.length} models, ${furnacePhotos.length} burner drawings and retained Team 3 cards. Opens offline.`);
}
