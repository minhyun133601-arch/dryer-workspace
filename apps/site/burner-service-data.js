import { DIMENSIONS, DRAWING_GROUPS, DRAWING_INFO, DRAWING_PARTS } from './furnace-drawing-data.js';

// Equipment identity and geometry are transcribed from the 2019-04-22 drawings.
// Drawing dates are not manufacturing/installation dates; drawing dimensions
// are not a field survey of the whole installed burner assembly.
export const BURNER_SPECIFICATIONS = Object.freeze([
  { label: '제조사', value: '엔비피코리아 (NBPKOREA)' },
  { label: '모델', value: DRAWING_INFO.model },
  { label: '시스템 형식', value: DRAWING_INFO.project },
  { label: '도면 표기 용량', value: DRAWING_INFO.capacity },
  { label: '사용처', value: DRAWING_INFO.customer },
  { label: '도면 작성일', value: `${DRAWING_INFO.date} · 제조일·설치일은 미확인` },
  { label: '챔버 내부 치수 (도면)', value: `${DIMENSIONS.innerWidth} × ${DIMENSIONS.innerDepth} mm` },
  { label: '챔버 높이 (도면)', value: `${DIMENSIONS.height} mm` },
  { label: '챔버 판 두께 (도면)', value: `${DIMENSIONS.wall} mm` },
  { label: '플랜지 외곽 (도면)', value: `${DIMENSIONS.flangeWidth} × ${DIMENSIONS.flangeDepth} mm` },
  { label: '전체 폭 (도면 표기)', value: `${DIMENSIONS.overallWidth} mm` },
  { label: '가스 트레인 길이 (도면)', value: `${DIMENSIONS.trainLength} mm` },
  { label: '주 가스 배관', value: '50A · 도면 기준' },
  { label: '파일럿 가스 배관', value: '15A · 도면 기준' },
  { label: '버너 인입관', value: '40A × 2개 · 도면 기준' },
  { label: '연소팬·모터 구성', value: '연소팬 2대 · 모터 2대' },
].map(record => Object.freeze(record)));

// User-supplied phone number, matched to the manufacturer's official support
// page. This is the system supplier contact, not each component's manufacturer.
export const BURNER_SUPPLIER_CONTACT = Object.freeze({
  name: '엔비피코리아 (NBPKOREA)',
  phone: '031-434-6566~7',
  phoneNumbers: Object.freeze(['031-434-6566', '031-434-6567']),
  hours: '평일 09:00–18:00',
  email: 'nbpkorea@nbpkorea.co.kr',
  address: '경기도 안산시 단원구 엠티브이8로 22',
  website: 'https://www.nbpkorea.co.kr',
  sourceUrl: 'https://www.nbpkorea.co.kr/support',
});

const componentMaker = maker => maker === 'K.S' ? '제조사 미확인 (도면 K.S 표기)' : ['미기재', '도면 미기재'].includes(maker) ? '제조사 미확인' : maker;
const partOverrides = {
  '6': {
    model: '모델 미확인', maker: 'DUNGS', sourceLabel: '현장 확인 · 모델 미확인',
    note: '현장에는 DUNGS 압력 스위치가 설치되어 있으나 모델은 판독하지 못했습니다. 도면의 NBPKOREA SAPS-50V를 현재 설치 모델로 사용하지 마세요.',
  },
  '8': {
    model: 'VMR6-2 Rp2', maker: 'ELEKTROGAS', sourceLabel: '현장 명판 확인',
    note: '현장 명판: 230 VAC, 50/60 Hz, 30 W(기동 120 W), Pmax 200 mbar. Pmax는 부품 최대 허용압력이며 실제 운전압력·설정값은 아닙니다.',
  },
  '9': {
    model: 'VMR6-2 Rp2', maker: 'ELEKTROGAS', sourceLabel: '현장 명판 확인',
    note: '현장 명판에서 ELEKTROGAS VMR6-2 Rp2를 확인했습니다. 도면에는 VMR6로 표기되어 있습니다.',
  },
  '10': {
    model: 'Modutrol IV M7284A1004', maker: 'Honeywell', sourceLabel: '현장 명판 확인',
    note: '현장 명판: 120 V, 50/60 Hz, 15 VA, 행정 90°, 동작 30~60초. 도면의 ECONEX AR3C2002-SE2A2와 다르므로 현장 모델을 우선 확인하세요.',
  },
  '13': {
    model: 'GW 150 A6', maker: 'DUNGS', sourceLabel: '현장 명판 확인',
    note: '현장 명판: Pmax 500 mbar. 도면의 NBPKOREA SAPS-150V와 다릅니다. Pmax는 부품 최대 허용압력이며 실제 운전압력·설정값은 아닙니다.',
  },
  'J': {
    model: '현재 설치 규격 미확인', maker: '제조사 미확인', sourceLabel: '정비 기록 참고 · 현장 명판 미확인',
    note: '2024.12.30 소손 보고서의 예비 모터 교체 기록은 2.2 kW · 4.7 A · 2극입니다. 현재 설치 모터의 확정 사양이 아니므로 현장 명판을 확인하세요.',
  },
};

export const BURNER_PART_SPECIFICATIONS = Object.freeze(DRAWING_PARTS.map(part => {
  const basisNote = part.basis === 'shape' ? '도면 외형을 해석한 구성입니다. 사진상 외형 일치만으로 치수·세부 규격이 확정되지는 않습니다.' : part.basis === 'photo' ? '도면 범위 밖의 현장 사진 참고 구성으로 실측 치수는 없습니다.' : '';
  return Object.freeze({
    id: part.id,
    name: part.name,
    drawingModel: part.size,
    drawingMaker: componentMaker(part.maker),
    model: part.size,
    maker: componentMaker(part.maker),
    sourceLabel: part.basis === 'photo' ? '현장 사진 참고 · 규격 미확인' : part.basis === 'shape' ? '도면 외형 판독' : '도면 기준',
    fieldStatus: part.field?.status || 'unconfirmed',
    note: [part.field?.text, basisNote].filter(Boolean).join(' '),
    group: DRAWING_GROUPS.find(group => group.id === part.group)?.name || part.group,
    ...partOverrides[part.id],
  });
}));

export const BURNER_UNCONFIRMED_SPECIFICATIONS = Object.freeze([
  '연료 가스 종류(LNG·LPG 등)와 정격 가스 소비량',
  '실제 운전압력 및 압력 스위치 설정값',
  '연소팬 풍량·정압과 정확한 모델',
  '현재 설치 모터의 제조사·모델·정격 전압·출력',
  '모터 베어링 제조사·품번·치수',
  '버너 제조번호·제조일·설치일',
  'UV 스캐너·점화 플러그의 정확한 모델',
  '설치 설비 전체 실측 치수·중량',
]);

export const SERVICE_STORAGE_KEY = 'dryer-burner-service-v1';
const DEFAULT_LEAD_DAYS = 30;
const DAY_MS = 86400000;
const CONTACT_DEFAULTS_REVISION = 1;
// User-supplied contact, confirmed on https://www.nbpkorea.co.kr/support.
const DEFAULT_BURNER_SUPPLIER = Object.freeze({ vendorName: BURNER_SUPPLIER_CONTACT.name, vendorPhone: BURNER_SUPPLIER_CONTACT.phone });

// These are the replacement intervals specified for this installation.
// Replacement dates stay blank until the operator enters them.
export const BURNER_SERVICE_EQUIPMENT = Object.freeze([
  { id: 'motor-bearing', name: '버너 모터 베어링', cycleYears: 1, partIds: ['J'] },
  ...DRAWING_PARTS.map(part => ({ id: `part-${part.id}`, name: part.name, cycleYears: 2, partIds: [part.id] })),
].map(record => Object.freeze({ ...record, partIds: Object.freeze(record.partIds) })));

function parseDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const [year, month, day] = value.split('-').map(Number);
  if (year < 1 || month < 1 || month > 12 || day < 1) return null;
  const date = new Date(0);
  date.setUTCHours(0, 0, 0, 0);
  date.setUTCFullYear(year, month - 1, day);
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) return null;
  return { year, month, day, milliseconds: date.getTime() };
}

export function localDateString(value = new Date()) {
  if (typeof value === 'string') return parseDate(value) ? value : '';
  if (!(value instanceof Date) || Number.isNaN(value.getTime())) return '';
  return `${String(value.getFullYear()).padStart(4, '0')}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(value.getDate()).padStart(2, '0')}`;
}

function cleanText(value, maximum) {
  return typeof value === 'string' ? value.trim().slice(0, maximum) : '';
}

function normalizeLeadDays(value) {
  return Number.isInteger(value) && value >= 0 && value <= 365 ? value : DEFAULT_LEAD_DAYS;
}

function blankRecords() {
  return BURNER_SERVICE_EQUIPMENT.map(record => ({
    ...record, partIds: [...record.partIds], ...DEFAULT_BURNER_SUPPLIER, lastReplacementDate: '',
  }));
}

function copyRecords(records) {
  return records.map(record => ({ ...record, partIds: [...record.partIds] }));
}

export function getReplacementStatus(record, today = localDateString(), leadDays = DEFAULT_LEAD_DAYS) {
  const current = parseDate(localDateString(today));
  const replaced = parseDate(record?.lastReplacementDate);
  const cycleYears = record?.cycleYears;
  const unregistered = { state: 'unregistered', dueDate: null, daysRemaining: null };
  if (!current || !replaced || replaced.milliseconds > current.milliseconds || !Number.isInteger(cycleYears) || cycleYears < 1) return unregistered;
  const dueYear = replaced.year + cycleYears;
  if (dueYear > 9999) return unregistered;
  const isLeapYear = dueYear % 4 === 0 && (dueYear % 100 !== 0 || dueYear % 400 === 0);
  const dueDay = replaced.month === 2 && replaced.day === 29 && !isLeapYear ? 28 : replaced.day;
  const dueDate = `${String(dueYear).padStart(4, '0')}-${String(replaced.month).padStart(2, '0')}-${String(dueDay).padStart(2, '0')}`;
  const daysRemaining = Math.round((parseDate(dueDate).milliseconds - current.milliseconds) / DAY_MS);
  const state = daysRemaining < 0 ? 'overdue' : daysRemaining === 0 ? 'due' : daysRemaining <= normalizeLeadDays(leadDays) ? 'upcoming' : 'scheduled';
  return { state, dueDate, daysRemaining };
}

export function createBurnerServiceStore({ storage, now = () => new Date() } = {}) {
  let selectedStorage = storage;
  if (storage === undefined) {
    try { selectedStorage = globalThis.localStorage; } catch { selectedStorage = null; }
  }
  let records = blankRecords();
  let leadDays = DEFAULT_LEAD_DAYS;
  let previousRaw;
  let disposed = false;
  const listeners = new Set();
  const today = () => localDateString(typeof now === 'function' ? now() : now);

  function emit() {
    if (disposed) return;
    for (const listener of listeners) listener({ records: copyRecords(records), leadDays });
  }

  function read() {
    if (!selectedStorage || typeof selectedStorage.getItem !== 'function') return;
    let raw;
    try { raw = selectedStorage.getItem(SERVICE_STORAGE_KEY); } catch { return; }
    if (raw === previousRaw) return;
    previousRaw = raw;
    if (raw === null) { records = blankRecords(); leadDays = DEFAULT_LEAD_DAYS; return; }
    let payload;
    try { payload = JSON.parse(raw); } catch { return; }
    if (!payload || payload.version !== 1 || !Array.isArray(payload.records)) return;
    const saved = new Map(payload.records.filter(record => record && typeof record === 'object' && typeof record.id === 'string').map(record => [record.id, record]));
    const currentDate = today();
    const migrateEmptyContacts = !(payload.contactDefaultsRevision >= CONTACT_DEFAULTS_REVISION);
    records = blankRecords().map(record => {
      const value = saved.get(record.id);
      if (!value) return record;
      const date = parseDate(value.lastReplacementDate);
      const vendorName = cleanText(value.vendorName, 200);
      const vendorPhone = cleanText(value.vendorPhone, 100);
      const contact = migrateEmptyContacts && !vendorName && !vendorPhone ? DEFAULT_BURNER_SUPPLIER : { vendorName, vendorPhone };
      return {
        ...record,
        name: cleanText(value.name, 100) || record.name,
        ...contact,
        lastReplacementDate: date && value.lastReplacementDate <= currentDate ? value.lastReplacementDate : '',
      };
    });
    leadDays = normalizeLeadDays(payload.leadDays);
  }

  function persist() {
    emit();
    if (!selectedStorage || typeof selectedStorage.setItem !== 'function') return { saved: false, error: '브라우저 저장소를 사용할 수 없습니다. 입력값은 현재 화면에만 유지됩니다.' };
    const raw = JSON.stringify({ version: 1, contactDefaultsRevision: CONTACT_DEFAULTS_REVISION, leadDays, records });
    try {
      selectedStorage.setItem(SERVICE_STORAGE_KEY, raw);
      previousRaw = raw;
      return { saved: true };
    } catch {
      return { saved: false, error: '브라우저에 저장하지 못했습니다. 입력값은 현재 화면에만 유지됩니다.' };
    }
  }

  read();
  return {
    getRecords: () => copyRecords(records),
    getLeadDays: () => leadDays,
    updateRecord(id, patch) {
      if (disposed) return { saved: false, error: '정비 화면이 종료되었습니다.' };
      const index = records.findIndex(record => record.id === id);
      if (index < 0 || !patch || typeof patch !== 'object' || Array.isArray(patch)) return { saved: false, error: '설비 정보를 확인해 주세요.' };
      const next = { ...records[index] };
      if (Object.hasOwn(patch, 'name')) {
        next.name = cleanText(patch.name, 100);
        if (!next.name) return { saved: false, error: '설비 명칭을 입력해 주세요.' };
      }
      for (const field of ['vendorName', 'vendorPhone']) {
        if (Object.hasOwn(patch, field)) next[field] = cleanText(patch[field], field === 'vendorName' ? 200 : 100);
      }
      if (Object.hasOwn(patch, 'lastReplacementDate')) {
        const value = patch.lastReplacementDate;
        if (value !== '' && (!parseDate(value) || value > today())) return { saved: false, error: '최근 교체일은 오늘까지의 유효한 날짜를 입력해 주세요.' };
        next.lastReplacementDate = value;
      }
      records[index] = next;
      return persist();
    },
    setLeadDays(value) {
      if (disposed) return { saved: false, error: '정비 화면이 종료되었습니다.' };
      if (!Number.isInteger(value) || value < 0 || value > 365) return { saved: false, error: '알람 기준은 0~365일 사이의 정수로 입력해 주세요.' };
      leadDays = value;
      return persist();
    },
    subscribe(listener) {
      if (!disposed && typeof listener === 'function') listeners.add(listener);
      return () => listeners.delete(listener);
    },
    refresh() { if (!disposed) { read(); emit(); } },
    dispose() { disposed = true; listeners.clear(); },
  };
}
