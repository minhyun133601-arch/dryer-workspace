import test from 'node:test';
import assert from 'node:assert/strict';
import { BURNER_PART_SPECIFICATIONS, BURNER_SERVICE_EQUIPMENT, BURNER_SPECIFICATIONS, BURNER_SUPPLIER_CONTACT, BURNER_UNCONFIRMED_SPECIFICATIONS, SERVICE_STORAGE_KEY, localDateString, getReplacementStatus, createBurnerServiceStore } from '../apps/site/burner-service-data.js';
import { DRAWING_PARTS } from '../apps/site/furnace-drawing-data.js';

const clock = () => new Date(2026, 10, 17, 10, 30);
const makeStorage = (initial = null) => {
  let value = initial;
  return { getItem: key => key === SERVICE_STORAGE_KEY ? value : null, setItem(key, next) { assert.equal(key, SERVICE_STORAGE_KEY); value = next; }, raw: () => value };
};

test('burner specifications identify the drawing basis without presenting missing operational data as facts', () => {
  const specifications = Object.fromEntries(BURNER_SPECIFICATIONS.map(record => [record.label, record.value]));
  assert.equal(specifications['모델'], 'KHMA-H760');
  assert.equal(specifications['도면 표기 용량'], '2,400,000 kcal/h');
  assert.equal(specifications['챔버 내부 치수 (도면)'], '1154 × 1504 mm');
  assert.equal(specifications['플랜지 외곽 (도면)'], '1350 × 1700 mm');
  assert.match(specifications['도면 작성일'], /2019\.04\.22.*제조일·설치일은 미확인/);
  assert.ok(BURNER_UNCONFIRMED_SPECIFICATIONS.some(value => value.includes('연료 가스 종류')));
  assert.ok(BURNER_UNCONFIRMED_SPECIFICATIONS.some(value => value.includes('베어링')));
  assert.ok(BURNER_UNCONFIRMED_SPECIFICATIONS.some(value => value.includes('설정값')));
  assert.ok(BURNER_SPECIFICATIONS.every(Object.isFrozen));
});

test('supplier contact matches the provided official contact and stays separate from component makers', () => {
  assert.equal(BURNER_SUPPLIER_CONTACT.name, '엔비피코리아 (NBPKOREA)');
  assert.equal(BURNER_SUPPLIER_CONTACT.phone, '031-434-6566~7');
  assert.deepEqual(BURNER_SUPPLIER_CONTACT.phoneNumbers, ['031-434-6566', '031-434-6567']);
  assert.equal(BURNER_SUPPLIER_CONTACT.email, 'nbpkorea@nbpkorea.co.kr');
  assert.equal(BURNER_SUPPLIER_CONTACT.sourceUrl, 'https://www.nbpkorea.co.kr/support');
  assert.ok(Object.isFrozen(BURNER_SUPPLIER_CONTACT.phoneNumbers));
  const store = createBurnerServiceStore({ storage: makeStorage(), now: clock });
  assert.ok(store.getRecords().every(record => record.vendorName === BURNER_SUPPLIER_CONTACT.name && record.vendorPhone === BURNER_SUPPLIER_CONTACT.phone));
  assert.equal(BURNER_PART_SPECIFICATIONS.find(part => part.id === '8').maker, 'ELEKTROGAS');
});

test('part specifications prefer confirmed installed models while preserving conflicting drawing models', () => {
  const parts = Object.fromEntries(BURNER_PART_SPECIFICATIONS.map(part => [part.id, part]));
  assert.equal(BURNER_PART_SPECIFICATIONS.length, DRAWING_PARTS.length);
  assert.equal(new Set(BURNER_PART_SPECIFICATIONS.map(part => part.id)).size, DRAWING_PARTS.length);
  assert.equal(parts['6'].maker, 'DUNGS');
  assert.equal(parts['6'].model, '모델 미확인');
  assert.equal(parts['6'].drawingModel, 'SAPS-50V');
  assert.equal(parts['10'].maker, 'Honeywell');
  assert.equal(parts['10'].model, 'Modutrol IV M7284A1004');
  assert.equal(parts['10'].drawingMaker, 'ECONEX');
  assert.equal(parts['10'].drawingModel, 'AR3C2002-SE2A2');
  assert.match(parts['10'].note, /120 V.*50\/60 Hz.*15 VA.*90°.*30~60초/);
  assert.equal(parts['13'].maker, 'DUNGS');
  assert.equal(parts['13'].model, 'GW 150 A6');
  assert.equal(parts['13'].drawingModel, 'SAPS-150V');
  for (const id of ['8', '9']) {
    assert.equal(parts[id].model, 'VMR6-2 Rp2');
    assert.equal(parts[id].drawingModel, 'VMR6');
    assert.equal(parts[id].sourceLabel, '현장 명판 확인');
  }
  for (const id of ['6', '10', '13']) assert.equal(parts[id].fieldStatus, 'differs');
  assert.ok(BURNER_PART_SPECIFICATIONS.every(Object.isFrozen));
});

test('unconfirmed component identities, approximate dimensions and historic spare motors retain their limits', () => {
  const parts = Object.fromEntries(BURNER_PART_SPECIFICATIONS.map(part => [part.id, part]));
  assert.equal(parts['1'].maker, '제조사 미확인 (도면 K.S 표기)');
  assert.equal(parts['1'].drawingMaker, '제조사 미확인 (도면 K.S 표기)');
  assert.equal(parts['J'].model, '현재 설치 규격 미확인');
  assert.match(parts['J'].note, /2024\.12\.30.*예비 모터.*2\.2 kW.*4\.7 A.*2극/);
  assert.match(parts['J'].note, /현재 설치 모터의 확정 사양이 아니/);
  assert.equal(parts['I'].sourceLabel, '도면 외형 판독');
  assert.match(parts['I'].note, /사진상 외형 일치만으로 치수·세부 규격이 확정되지는/);
  assert.equal(parts['X'].sourceLabel, '현장 사진 참고 · 규격 미확인');
  assert.match(parts['X'].note, /실측 치수는 없/);
  assert.equal(parts['17'].sourceLabel, '도면 기준');
  assert.match(parts['17'].note, /명판은 확인하지 못/);
});

test('each drawing component has a two-year schedule and motor bearings have an independent one-year schedule', () => {
  assert.equal(BURNER_SERVICE_EQUIPMENT.length, DRAWING_PARTS.length + 1);
  assert.equal(new Set(BURNER_SERVICE_EQUIPMENT.map(record => record.id)).size, BURNER_SERVICE_EQUIPMENT.length);
  assert.deepEqual(BURNER_SERVICE_EQUIPMENT[0], { id: 'motor-bearing', name: '버너 모터 베어링', cycleYears: 1, partIds: ['J'] });
  for (const part of DRAWING_PARTS) {
    assert.deepEqual(BURNER_SERVICE_EQUIPMENT.find(record => record.id === `part-${part.id}`), { id: `part-${part.id}`, name: part.name, cycleYears: 2, partIds: [part.id] });
  }
  assert.ok(Object.isFrozen(BURNER_SERVICE_EQUIPMENT[0].partIds));
});

test('replacement states respect date-only calendar boundaries, 30-day warnings, overdue days and missing dates', () => {
  const record = { cycleYears: 1, lastReplacementDate: '2025-12-17' };
  assert.deepEqual(getReplacementStatus(record, '2026-11-16'), { state: 'scheduled', dueDate: '2026-12-17', daysRemaining: 31 });
  assert.deepEqual(getReplacementStatus(record, '2026-11-17'), { state: 'upcoming', dueDate: '2026-12-17', daysRemaining: 30 });
  assert.deepEqual(getReplacementStatus(record, '2026-12-17'), { state: 'due', dueDate: '2026-12-17', daysRemaining: 0 });
  assert.deepEqual(getReplacementStatus(record, '2026-12-18'), { state: 'overdue', dueDate: '2026-12-17', daysRemaining: -1 });
  assert.equal(getReplacementStatus(record, '2026-11-17', 7).state, 'scheduled');
  for (const lastReplacementDate of ['', '2025-02-29', '2025-13-01', '2025-01-00', '2026-11-18', 'invalid', null]) {
    assert.deepEqual(getReplacementStatus({ ...record, lastReplacementDate }, '2026-11-17'), { state: 'unregistered', dueDate: null, daysRemaining: null });
  }
  assert.equal(getReplacementStatus(record, 'invalid').state, 'unregistered');
});

test('annual replacement clamps leap days and local dates do not convert through UTC', () => {
  assert.deepEqual(getReplacementStatus({ cycleYears: 1, lastReplacementDate: '2024-02-29' }, '2025-02-28'), { state: 'due', dueDate: '2025-02-28', daysRemaining: 0 });
  assert.equal(getReplacementStatus({ cycleYears: 2, lastReplacementDate: '2024-02-29' }, '2026-02-28').dueDate, '2026-02-28');
  assert.equal(getReplacementStatus({ cycleYears: 4, lastReplacementDate: '2024-02-29' }, '2026-11-17').dueDate, '2028-02-29');
  assert.equal(localDateString(new Date(2026, 10, 17, 0, 1)), '2026-11-17');
  assert.equal(localDateString(new Date('invalid')), '');
});

test('names, supplier contacts, dates and warning settings survive reload while schedule identity is protected', () => {
  const storage = makeStorage(), store = createBurnerServiceStore({ storage, now: clock });
  assert.ok(store.getRecords().every(record => record.vendorName === '엔비피코리아 (NBPKOREA)' && record.vendorPhone === '031-434-6566~7' && record.lastReplacementDate === ''));
  assert.deepEqual(store.updateRecord('motor-bearing', { name: ' 베어링 A ', vendorName: ' 정비 업체 ', vendorPhone: ' 010-1234-5678 ', lastReplacementDate: '2025-12-17', cycleYears: 20, partIds: ['X'], id: 'other' }), { saved: true });
  assert.deepEqual(store.setLeadDays(14), { saved: true });
  const reloaded = createBurnerServiceStore({ storage, now: clock });
  const record = reloaded.getRecords()[0];
  assert.deepEqual(record, { id: 'motor-bearing', name: '베어링 A', cycleYears: 1, partIds: ['J'], vendorName: '정비 업체', vendorPhone: '010-1234-5678', lastReplacementDate: '2025-12-17' });
  assert.equal(reloaded.getLeadDays(), 14);
  const edited = reloaded.getRecords(); edited[0].name = 'changed'; edited[0].partIds.push('X');
  assert.equal(reloaded.getRecords()[0].name, '베어링 A');
  assert.deepEqual(reloaded.getRecords()[0].partIds, ['J']);
  assert.equal(JSON.parse(storage.raw()).version, 1);
  assert.equal(JSON.parse(storage.raw()).contactDefaultsRevision, 1);
});

test('old empty supplier defaults are migrated while custom and partial contacts stay intact', () => {
  const storage = makeStorage(JSON.stringify({ version: 1, leadDays: 14, records: [
    { id: 'motor-bearing', vendorName: '', vendorPhone: '', lastReplacementDate: '2025-12-17' },
    { id: 'part-I', vendorName: '팬 정비업체', vendorPhone: '051-123-4567', lastReplacementDate: '2024-12-17' },
    { id: 'part-J', vendorName: '모터 업체', vendorPhone: '' },
    { id: 'part-1', vendorName: '', vendorPhone: '010-1111-2222' },
  ] }));
  const store = createBurnerServiceStore({ storage, now: clock });
  const byId = Object.fromEntries(store.getRecords().map(record => [record.id, record]));
  assert.equal(byId['motor-bearing'].vendorName, '엔비피코리아 (NBPKOREA)');
  assert.equal(byId['motor-bearing'].vendorPhone, '031-434-6566~7');
  assert.equal(byId['motor-bearing'].lastReplacementDate, '2025-12-17');
  assert.equal(byId['part-I'].vendorName, '팬 정비업체');
  assert.equal(byId['part-I'].vendorPhone, '051-123-4567');
  assert.equal(byId['part-I'].lastReplacementDate, '2024-12-17');
  assert.equal(byId['part-J'].vendorName, '모터 업체');
  assert.equal(byId['part-J'].vendorPhone, '');
  assert.equal(byId['part-1'].vendorName, '');
  assert.equal(byId['part-1'].vendorPhone, '010-1111-2222');
  assert.equal(byId['part-2'].vendorPhone, '031-434-6566~7', 'a new unsaved component uses the supplied contact');
  assert.equal(byId['part-2'].lastReplacementDate, '');
  assert.equal(store.getLeadDays(), 14);
  store.setLeadDays(30);
  assert.equal(JSON.parse(storage.raw()).contactDefaultsRevision, 1);
});

test('deliberately cleared contacts remain empty after new payloads are saved and reopened', () => {
  const storage = makeStorage();
  const store = createBurnerServiceStore({ storage, now: clock });
  store.updateRecord('motor-bearing', { vendorName: '', vendorPhone: '' });
  store.updateRecord('part-I', { vendorName: '', vendorPhone: '010-1234-5678' });
  const reopened = createBurnerServiceStore({ storage, now: clock });
  const byId = Object.fromEntries(reopened.getRecords().map(record => [record.id, record]));
  assert.equal(byId['motor-bearing'].vendorName, '');
  assert.equal(byId['motor-bearing'].vendorPhone, '');
  assert.equal(byId['part-I'].vendorName, '');
  assert.equal(byId['part-I'].vendorPhone, '010-1234-5678');
  assert.equal(byId['part-J'].vendorName, '엔비피코리아 (NBPKOREA)');
  assert.equal(byId['part-J'].vendorPhone, '031-434-6566~7');
});

test('invalid edits leave records untouched and clearing a replacement date returns to unregistered', () => {
  const store = createBurnerServiceStore({ storage: makeStorage(), now: clock });
  const initial = store.getRecords();
  for (const patch of [{ name: '  ' }, { lastReplacementDate: '2026-11-18' }, { lastReplacementDate: '2026-02-29' }, { lastReplacementDate: null }]) assert.equal(store.updateRecord('motor-bearing', patch).saved, false);
  assert.equal(store.updateRecord('unknown', {}).saved, false);
  assert.deepEqual(store.getRecords(), initial);
  for (const leadDays of [-1, 366, '30', NaN, 1.5]) assert.equal(store.setLeadDays(leadDays).saved, false);
  assert.equal(store.getLeadDays(), 30);
  store.updateRecord('motor-bearing', { lastReplacementDate: '2025-12-17' });
  store.updateRecord('motor-bearing', { lastReplacementDate: '' });
  assert.equal(getReplacementStatus(store.getRecords()[0], '2026-11-17').state, 'unregistered');
});

test('corrupt and unavailable storage preserve usable blank forms and report persistence failures honestly', () => {
  for (const raw of ['{bad JSON', 'null', JSON.stringify({ version: 2, records: [] }), JSON.stringify({ version: 1, records: false })]) {
    const store = createBurnerServiceStore({ storage: makeStorage(raw), now: clock });
    assert.equal(store.getRecords().length, BURNER_SERVICE_EQUIPMENT.length);
    assert.ok(store.getRecords().every(record => !record.lastReplacementDate));
  }
  for (const storage of [null, { getItem() { throw new Error('blocked'); }, setItem() { throw new Error('blocked'); } }, { getItem: () => null, setItem() { throw new Error('quota exceeded'); } }]) {
    const store = createBurnerServiceStore({ storage, now: clock });
    const result = store.updateRecord('motor-bearing', { vendorName: '임시 업체', lastReplacementDate: '2025-12-17' });
    assert.equal(result.saved, false); assert.ok(result.error);
    assert.equal(store.getRecords()[0].vendorName, '임시 업체');
    store.refresh();
    assert.equal(store.getRecords()[0].vendorName, '임시 업체', 'refresh must retain unsaved in-memory input');
  }
});

test('persisted values are sanitized and externally saved edits refresh through subscriptions', () => {
  const storage = makeStorage(JSON.stringify({ version: 1, leadDays: -5, records: [null, 1, { id: 'unknown', name: 'fake' }, { id: 'motor-bearing', name: ' ', vendorName: 3, vendorPhone: ' 02-123-4567 ', lastReplacementDate: '2027-01-01', cycleYears: 999 }] }));
  const store = createBurnerServiceStore({ storage, now: clock });
  assert.equal(store.getRecords()[0].name, '버너 모터 베어링');
  assert.equal(store.getRecords()[0].cycleYears, 1);
  assert.equal(store.getRecords()[0].lastReplacementDate, '');
  assert.equal(store.getRecords()[0].vendorPhone, '02-123-4567');
  assert.equal(store.getLeadDays(), 30);
  let notifications = 0;
  const unsubscribe = store.subscribe(snapshot => { notifications++; snapshot.records[0].partIds.push('X'); });
  const other = createBurnerServiceStore({ storage, now: clock });
  other.updateRecord('motor-bearing', { vendorName: '다른 탭 업체' });
  store.refresh();
  assert.equal(store.getRecords()[0].vendorName, '다른 탭 업체');
  assert.deepEqual(store.getRecords()[0].partIds, ['J']);
  assert.equal(notifications, 1);
  unsubscribe(); store.refresh(); assert.equal(notifications, 1);
  store.dispose(); assert.equal(store.updateRecord('motor-bearing', { name: '종료' }).saved, false);
});
