import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { COMPRESSOR_RECORDS } from '../apps/site/dryer-compressor-records.js';
import { COMPRESSOR_MANUALS } from '../apps/site/dryer-compressor-manuals.js';
import { COMPRESSOR_MEDIA, COMPRESSOR_PLAN_IMAGE, COMPRESSOR_WALK_FRAMES } from '../apps/site/dryer-compressor-media.js';
import { SITE_ASSETS } from '../apps/site/asset-catalog.js';
import * as THREE from '../apps/shared/vendor/three.module.js';
import { compressorPlanGeometry } from '../apps/site/dryer-compressor-view.js';

test('plan footprints follow the installed cabinet dimensions, offset and orientation without overhead ductwork', () => {
  const station=new THREE.Group();station.name='comp-unit-1-kaeser-csd125sfc';
  station.position.set(15,7.3,-11);station.rotation.y=Math.PI/2;
  const base=new THREE.Mesh(new THREE.BoxGeometry(2.11,.14,1.29));
  base.name=station.name+'-base';base.position.x=.35;
  const hood=new THREE.Mesh(new THREE.BoxGeometry(3,1.5,3));
  hood.name=station.name+'-exhaust-duct';hood.position.set(1,2,1);
  station.add(base,hood);
  const {outlines,extent}=compressorPlanGeometry(station);
  const size=extent.getSize(new THREE.Vector2()),center=extent.getCenter(new THREE.Vector2());
  assert.equal(outlines.length,1);
  assert.ok(Math.abs(size.x-1.29)<1e-6 && Math.abs(size.y-2.11)<1e-6);
  assert.ok(Math.abs(center.x-15)<1e-6 && Math.abs(center.y+11.35)<1e-6);
  base.geometry.dispose();hood.geometry.dispose();base.material.dispose();hood.material.dispose();
});

test('all photographed stations link to the correct registered November survey images and sources', async () => {
  assert.equal(COMPRESSOR_RECORDS.length,14);
  assert.equal(new Set(COMPRESSOR_RECORDS.map(r=>r.id)).size,14);
  assert.deepEqual(COMPRESSOR_MEDIA.map(p=>p.number),Array.from({length:100},(_,i)=>i+1));
  const catalog=new Set(SITE_ASSETS.map(a=>a.path));
  assert.ok(catalog.has(COMPRESSOR_PLAN_IMAGE));
  assert.deepEqual(COMPRESSOR_WALK_FRAMES.map(f=>f.date),['11/12','11/12','11/12','11/24','11/24','11/24']);
  for(const frame of COMPRESSOR_WALK_FRAMES){
    assert.ok(catalog.has(frame.path));
    const bytes=await readFile(new URL('../apps/site/'+frame.path,import.meta.url));
    assert.equal(bytes.readUInt16BE(),0xffd8);
  }
  const used=new Set();
  for (const photo of COMPRESSOR_MEDIA) {
    assert.match(photo.original,/^20261124_\d{6}\.jpg$/);
    assert.ok(catalog.has(photo.path));
    const bytes=await readFile(new URL('../apps/site/'+photo.path,import.meta.url));
    assert.equal(bytes.readUInt16BE(),0xffd8);
  }
  for (const item of COMPRESSOR_RECORDS) {
    assert.ok(item.photoNumbers.length);
    assert.ok(item.fields.length);
    for(const n of item.photoNumbers) used.add(n);
    for(const f of item.fields) {
      assert.ok(f.label && f.value && f.source);
      if(f.photo!=null) assert.ok(item.photoNumbers.includes(f.photo),item.title+' / '+f.label);
    }
  }
  assert.deepEqual([...used].sort((a,b)=>a-b),Array.from({length:91},(_,i)=>i+10));
  for (const [id,manuals] of Object.entries(COMPRESSOR_MANUALS)) {
    assert.ok(COMPRESSOR_RECORDS.some(item=>item.id===id));
    for(const {url,note} of manuals){assert.equal(new URL(url).protocol,'https:');assert.ok(note);}
  }
});
