const metricKeys = ['steps', 'activeCalories', 'sleepMinutes', 'weightKg'];
export const HEALTH_PERMISSIONS = ['steps', 'activeCalories', 'sleep', 'weight'];
export const HEALTH_FILE_FORMAT = 'fittrack-health-v1';
const limits = { steps: [0, 200000], activeCalories: [0, 30000], sleepMinutes: [0, 1440], weightKg: [20, 400] };
const isObject = value => value !== null && typeof value === 'object' && !Array.isArray(value);
export function validHealthDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T12:00:00Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}
const timestamp = value => typeof value === 'string' && Number.isFinite(Date.parse(value)) ? new Date(value).toISOString() : null;
function normalizeDay(value) {
  if (!isObject(value) || !validHealthDate(value.date)) return null;
  return Object.fromEntries([['date', value.date], ...metricKeys.map(key => {
    const number = value[key];
    const valid = typeof number === 'number' && Number.isFinite(number) && number >= limits[key][0] && number <= limits[key][1] && (key !== 'steps' || Number.isInteger(number));
    return [key, valid ? number : null];
  })]);
}
export function createEmptyHealth() {
  return { autoSync: false, permissions: [], days: [], lastSyncedAt: null, fromDate: null, toDate: null, source: null };
}
export function normalizeHealth(value) {
  if (!isObject(value)) return createEmptyHealth();
  const days = new Map();
  for (const raw of Array.isArray(value.days) ? value.days : []) {
    const day = normalizeDay(raw);
    if (day) days.set(day.date, day);
  }
  return {
    autoSync: value.autoSync === true,
    permissions: HEALTH_PERMISSIONS.filter(key => Array.isArray(value.permissions) && value.permissions.includes(key)),
    days: [...days.values()].sort((a, b) => a.date.localeCompare(b.date)).slice(-366),
    lastSyncedAt: timestamp(value.lastSyncedAt),
    fromDate: validHealthDate(value.fromDate) ? value.fromDate : null,
    toDate: validHealthDate(value.toDate) ? value.toDate : null,
    source: ['health-connect', 'import'].includes(value.source) ? value.source : null,
  };
}
export function validateHealthSnapshot(value) {
  if (!isObject(value) || !timestamp(value.syncedAt) || !validHealthDate(value.fromDate) || !validHealthDate(value.toDate) || value.fromDate > value.toDate
    || !Array.isArray(value.permissions) || value.permissions.some(key => !HEALTH_PERMISSIONS.includes(key))
    || !Array.isArray(value.days) || value.days.length > 366) throw new Error('This is not a supported FitTrack health snapshot. Export a new file from the Android companion.');
  const seen = new Set();
  for (const day of value.days) {
    if (!isObject(day) || !validHealthDate(day.date) || day.date < value.fromDate || day.date > value.toDate || seen.has(day.date)) throw new Error('The health file has invalid or repeated dates. Export it again from FitTrack.');
    seen.add(day.date);
    const normalized = normalizeDay(day);
    for (const key of metricKeys) if (day[key] !== null && day[key] !== undefined && normalized[key] === null) throw new Error(`The health file contains an invalid ${key} value.`);
  }
  return { syncedAt: timestamp(value.syncedAt), fromDate: value.fromDate, toDate: value.toDate, permissions: [...new Set(value.permissions)], days: value.days.map(normalizeDay) };
}
export function mergeHealthSnapshot(previous, raw, source = 'health-connect') {
  const snapshot = validateHealthSnapshot(raw);
  const state = normalizeHealth(previous);
  // Replace the read window instead of adding totals. A repeated sync cannot
  // double-count steps, and deleted provider records disappear on the next read.
  const days = state.days.filter(day => day.date < snapshot.fromDate || day.date > snapshot.toDate);
  return normalizeHealth({ ...state, days: [...days, ...snapshot.days], permissions: snapshot.permissions,
    lastSyncedAt: snapshot.syncedAt, fromDate: snapshot.fromDate, toDate: snapshot.toDate, source });
}
export function serializeHealth(health) {
  const state = normalizeHealth(health);
  if (!state.lastSyncedAt || !state.days.length) throw new Error('Sync some health data before exporting.');
  // A transfer can include older readings from before a permission was revoked.
  // Its scope describes those records; it never grants access on the recipient.
  const permissionFor = { steps: 'steps', activeCalories: 'activeCalories', sleepMinutes: 'sleep', weightKg: 'weight' };
  const included = new Set(state.permissions);
  state.days.forEach(day => metricKeys.forEach(key => { if (day[key] !== null) included.add(permissionFor[key]); }));
  return JSON.stringify({ format: HEALTH_FILE_FORMAT, snapshot: { syncedAt: state.lastSyncedAt,
    fromDate: state.days[0].date, toDate: state.days.at(-1).date, permissions: HEALTH_PERMISSIONS.filter(key => included.has(key)), days: state.days } }, null, 2);
}
export function parseHealthImport(text) {
  if (typeof text !== 'string' || new TextEncoder().encode(text).byteLength > 1048576) throw new Error('Choose a FitTrack health file smaller than 1 MB.');
  let file;
  try { file = JSON.parse(text); } catch { throw new Error('This file is not valid JSON. Choose a health file exported from FitTrack.'); }
  if (file?.format !== HEALTH_FILE_FORMAT) throw new Error('Choose a FitTrack health export. Raw Samsung Health exports use a different format.');
  return validateHealthSnapshot(file.snapshot);
}
