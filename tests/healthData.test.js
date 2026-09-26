import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createEmptyHealth, normalizeHealth, validHealthDate, validateHealthSnapshot,
  mergeHealthSnapshot, serializeHealth, parseHealthImport, HEALTH_FILE_FORMAT,
} from '../src/healthData.js';
import { createEmptyWorkspace, normalizeWorkspace, recordVisit, resolveWorkspaceWrite } from '../src/database.js';

const syncedAt = '2026-09-25T10:30:00.000Z';
const emptyDay = date => ({ date, steps: null, activeCalories: null, sleepMinutes: null, weightKg: null });
const day = (date, values = {}) => ({ ...emptyDay(date), ...values });
const snapshot = (changes = {}) => ({
  syncedAt, fromDate: '2026-09-24', toDate: '2026-09-25',
  permissions: ['steps', 'activeCalories', 'sleep', 'weight'],
  days: [day('2026-09-24', { steps: 4321, activeCalories: 178.5, sleepMinutes: 420, weightKg: 72.4 }), day('2026-09-25', { steps: 0 })],
  ...changes,
});
const file = data => JSON.stringify({ format: HEALTH_FILE_FORMAT, snapshot: data });

test('new health state contains no assumed connection, permission, or measurements', () => {
  const empty = createEmptyHealth();
  assert.deepEqual(empty, { autoSync: false, permissions: [], days: [], lastSyncedAt: null, fromDate: null, toDate: null, source: null });
  empty.days.push(day('2026-09-25'));
  assert.deepEqual(createEmptyHealth().days, []);
  for (const invalid of [undefined, null, [], 'health', 1]) assert.deepEqual(normalizeHealth(invalid), createEmptyHealth());
});

test('health dates validate real calendar dates without accepting timestamps or rollover dates', () => {
  for (const value of ['2024-02-29', '2026-09-25']) assert.equal(validHealthDate(value), true);
  for (const value of ['2026-02-29', '2026-04-31', '2026-00-01', '2026-13-01', '2026-09-00', '2026-9-25', syncedAt, '', null, 20260925]) assert.equal(validHealthDate(value), false, String(value));
});

test('snapshot preserves measured zero separately from unavailable values', () => {
  const result = validateHealthSnapshot(snapshot({ days: [{ date: '2026-09-25', steps: 0, activeCalories: 0, sleepMinutes: 0 }] }));
  assert.deepEqual(result.days, [day('2026-09-25', { steps: 0, activeCalories: 0, sleepMinutes: 0 })]);
  assert.equal(result.days[0].weightKg, null);
});

test('snapshot accepts valid metric boundaries and fractional non-step measurements', () => {
  const result = validateHealthSnapshot(snapshot({ days: [
    day('2026-09-24', { steps: 200000, activeCalories: 30000, sleepMinutes: 1440, weightKg: 400 }),
    day('2026-09-25', { steps: 0, activeCalories: 0.5, sleepMinutes: 0.25, weightKg: 20 }),
  ] }));
  assert.equal(result.days[0].steps, 200000);
  assert.equal(result.days[1].sleepMinutes, 0.25);
});

test('snapshot rejects out-of-range metrics, numeric strings, booleans, and non-finite values', () => {
  const invalid = { steps: [-1, 200001, 1.5], activeCalories: [-1, 30001], sleepMinutes: [-1, 1441], weightKg: [0, 19.99, 400.01] };
  for (const [metric, values] of Object.entries(invalid)) {
    for (const value of [...values, '10', true, {}, [], NaN, Infinity, -Infinity]) {
      assert.throws(() => validateHealthSnapshot(snapshot({ days: [day('2026-09-25', { [metric]: value })] })), new RegExp(metric), `${metric}: ${String(value)}`);
    }
  }
});

test('snapshot rejects invalid windows, duplicate or out-of-window dates, and unknown permissions', () => {
  for (const changes of [
    { syncedAt: 'not a timestamp' }, { fromDate: '2026-02-29' }, { toDate: '2026-09-23' },
    { permissions: 'steps' }, { permissions: ['steps', 'location'] }, { days: {} },
    { days: [null] }, { days: [day('2026-04-31')] }, { days: [day('2026-09-23')] },
    { days: [day('2026-09-26')] }, { days: [day('2026-09-25'), day('2026-09-25')] },
    { days: Array(367).fill(day('2026-09-25')) },
  ]) assert.throws(() => validateHealthSnapshot(snapshot(changes)));
  const result = validateHealthSnapshot(snapshot({ permissions: ['steps', 'steps'] }));
  assert.deepEqual(result.permissions, ['steps']);
});

test('stored health normalization safely cleans malformed fields and sorts/deduplicates dates', () => {
  const original = {
    autoSync: 'true', permissions: ['sleep', 'steps', 'steps', 'not-supported'], source: 'unknown',
    lastSyncedAt: 'invalid', fromDate: 'invalid', toDate: '2026-02-29',
    days: [day('2026-09-25', { steps: 100 }), day('2026-09-24', { weightKg: 70 }),
      { date: '2026-09-25', steps: '100', activeCalories: -10, sleepMinutes: true, weightKg: Infinity }, day('2026-02-29')],
  };
  const before = structuredClone(original);
  assert.deepEqual(normalizeHealth(original), {
    autoSync: false, permissions: ['steps', 'sleep'], source: null, lastSyncedAt: null, fromDate: null, toDate: null,
    days: [day('2026-09-24', { weightKg: 70 }), emptyDay('2026-09-25')],
  });
  assert.deepEqual(original, before);
  for (const permissions of ['steps', true, { includes: true }, null]) assert.deepEqual(normalizeHealth({ permissions }).permissions, []);
});

test('stored health retains only the latest 366 days in chronological order', () => {
  const days = Array.from({ length: 370 }, (_, index) => day(new Date(Date.UTC(2025, 0, 1 + index)).toISOString().slice(0, 10), { steps: index }));
  assert.deepEqual(normalizeHealth({ days: [...days].reverse() }).days, days.slice(-366));
});

test('sync replaces the requested window without double counting or mutating prior data', () => {
  const initial = normalizeHealth({ autoSync: true, days: [day('2026-09-23', { steps: 99 }), day('2026-09-24', { steps: 9999 }), day('2026-09-26', { steps: 88 })] });
  const before = structuredClone(initial);
  const imported = snapshot();
  const after = mergeHealthSnapshot(initial, imported);
  assert.equal(after.autoSync, true);
  assert.deepEqual(after.days, [before.days[0], ...imported.days, before.days[2]]);
  assert.equal(after.source, 'health-connect');
  assert.equal(after.lastSyncedAt, syncedAt);
  assert.deepEqual(mergeHealthSnapshot(after, imported), after);
  assert.deepEqual(initial, before);
  after.days[1].steps = 1;
  assert.equal(imported.days[0].steps, 4321);
});

test('deleted provider days and revoked metrics disappear from the refreshed window', () => {
  const previous = mergeHealthSnapshot(createEmptyHealth(), snapshot());
  const revoked = mergeHealthSnapshot(previous, snapshot({ permissions: ['steps'], days: [{ date: '2026-09-25', steps: 25 }] }));
  assert.deepEqual(revoked.permissions, ['steps']);
  assert.deepEqual(revoked.days, [day('2026-09-25', { steps: 25 })]);
  const deleted = mergeHealthSnapshot(revoked, snapshot({ permissions: [], days: [] }));
  assert.deepEqual(deleted.days, []);
  assert.deepEqual(deleted.permissions, []);
  assert.equal(deleted.lastSyncedAt, syncedAt);
});

test('only a FitTrack health snapshot can be imported, preserving zeros and excluding sync settings', () => {
  const health = mergeHealthSnapshot({ ...createEmptyHealth(), autoSync: true }, snapshot());
  const text = serializeHealth(health);
  assert.equal(JSON.parse(text).format, 'fittrack-health-v1');
  assert.equal(JSON.parse(text).snapshot.autoSync, undefined);
  assert.deepEqual(parseHealthImport(text), validateHealthSnapshot(snapshot()));
  const imported = mergeHealthSnapshot(createEmptyHealth(), parseHealthImport(text), 'import');
  assert.equal(imported.source, 'import');
  assert.equal(imported.autoSync, false);
  assert.equal(imported.days[1].steps, 0);
  assert.throws(() => serializeHealth(createEmptyHealth()), /Sync/);
  for (const content of ['not JSON', '{}', 'null', '[]', JSON.stringify(snapshot()), JSON.stringify({ format: 'fittrack-health-v2', snapshot: snapshot() }), JSON.stringify({ samsungHealth: snapshot() })]) assert.throws(() => parseHealthImport(content));
  assert.throws(() => parseHealthImport(file(snapshot({ days: [day('2026-09-25', { steps: -1 })] }))), /steps/);
});

test('exports describe retained historical readings after partial permission revocation without changing live access', () => {
  const original = mergeHealthSnapshot(createEmptyHealth(), snapshot());
  const revoked = mergeHealthSnapshot(original, snapshot({
    fromDate: '2026-09-25', permissions: ['steps'], days: [day('2026-09-25', { steps: 10 })],
  }));
  assert.deepEqual(revoked.permissions, ['steps']);
  const exported = parseHealthImport(serializeHealth(revoked));
  assert.deepEqual(exported.permissions, ['steps', 'activeCalories', 'sleep', 'weight']);
  assert.equal(exported.days[0].weightKg, 72.4);
  assert.equal(exported.days[0].sleepMinutes, 420);
  assert.equal(exported.days[1].weightKg, null);
  assert.deepEqual(revoked.permissions, ['steps'], 'export metadata does not restore revoked native permissions');
  const imported = mergeHealthSnapshot(createEmptyHealth(), exported, 'import');
  assert.equal(imported.autoSync, false, 'a transfer never enables native access or automatic sync');
});

test('health imports enforce the 1 MB limit for ASCII and multi-byte files', () => {
  assert.throws(() => parseHealthImport(' '.repeat(1048577)), /1 MB/);
  assert.throws(() => parseHealthImport({}), /1 MB/);
  const oversized = JSON.stringify({ format: HEALTH_FILE_FORMAT, snapshot: snapshot(), note: '界'.repeat(350000) });
  assert.ok(oversized.length < 1048576, 'fixture distinguishes bytes from JavaScript string length');
  assert.ok(new TextEncoder().encode(oversized).byteLength > 1048576);
  assert.throws(() => parseHealthImport(oversized), /1 MB/);
});

test('workspace reload and visit metadata preserve health without fabricating workouts or weights', () => {
  const blank = createEmptyWorkspace();
  assert.deepEqual(blank.health, createEmptyHealth());
  const health = mergeHealthSnapshot({ ...createEmptyHealth(), autoSync: true }, snapshot());
  const persisted = normalizeWorkspace(JSON.parse(JSON.stringify({ ...blank, health })));
  assert.deepEqual(persisted.health, health);
  assert.deepEqual(persisted.history, []);
  assert.deepEqual(persisted.weights, []);
  assert.deepEqual(recordVisit(persisted, '2026-09-26T10:00:00Z').health, health);
  assert.deepEqual(normalizeWorkspace({ ...blank, health: null }).health, createEmptyHealth());
});

test('health changes participate in cross-tab conflicts and visit-only writes retain synced data', () => {
  const baseline = createEmptyWorkspace();
  const remote = { ...baseline, health: mergeHealthSnapshot(createEmptyHealth(), snapshot()) };
  const local = { ...baseline, health: mergeHealthSnapshot(createEmptyHealth(), snapshot({ days: [day('2026-09-25', { steps: 75 })] })) };
  assert.equal(resolveWorkspaceWrite(remote, baseline, local).conflict, true);
  const visit = recordVisit(baseline, '2026-09-26T10:00:00Z');
  const merged = resolveWorkspaceWrite(remote, baseline, visit);
  assert.equal(merged.conflict, false);
  assert.deepEqual(merged.data.health, remote.health);
  assert.ok(merged.data.visits.includes('2026-09-26T10:00:00.000Z'));
});
