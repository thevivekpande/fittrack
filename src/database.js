import { useEffect, useSyncExternalStore } from 'react';
import { EXERCISES, LEVELS, MUSCLE_GROUPS } from './data.js';
import { FITNESS_GOALS } from './goals.js';

const DATABASE_NAME = 'fittrack';
const STORE_NAME = 'workspace';
const RECORD_KEY = 'current';
const CONFLICT_MESSAGE = 'Another tab updated your progress. Reload this tab to see the latest saved data before making more changes.';
const levels = new Set(LEVELS.map(({ id }) => id));
const exercises = new Map(EXERCISES.map((exercise) => [exercise.id, exercise]));
const muscleGroups = new Set(MUSCLE_GROUPS);
const weekDays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const isObject = (value) => value !== null && typeof value === 'object' && !Array.isArray(value);
const isText = (value, maximum = 160) => typeof value === 'string' && value.trim().length > 0 && value.length <= maximum;
const isFiniteNumber = (value) => typeof value === 'number' && Number.isFinite(value);
const unique = (values) => [...new Set(values)];

export function isCalendarDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T12:00:00Z`);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

function timestamp(value) {
  return typeof value === 'string' && Number.isFinite(Date.parse(value)) ? new Date(value).toISOString() : null;
}

export function createEmptyWorkspace() {
  return {
    schemaVersion: 1,
    legacyMigrated: true,
    profile: null,
    level: null,
    trainingPlace: null,
    history: [],
    weights: [],
    session: null,
    customPlans: {},
    weeklyPlans: {},
    visits: [],
    lastVisitAt: null,
  };
}

function validateProfile(value) {
  if (!isObject(value) || !isText(value.name, 80) || !Number.isInteger(value.goal) || value.goal < 1 || value.goal > 7) return null;
  const fitnessGoal = FITNESS_GOALS.some(goal => goal.id === value.fitnessGoal) ? value.fitnessGoal : null;
  return { ...value, name: value.name.trim(), goal: value.goal, fitnessGoal };
}

function validateHistory(values) {
  if (!Array.isArray(values)) return [];
  const seen = new Set();
  return values.filter((entry) => {
    if (!isObject(entry) || !isText(entry.id) || entry.id.startsWith('demo-session-') || seen.has(entry.id) || !isCalendarDate(entry.date) || !isText(entry.title, 200)
      || !isFiniteNumber(entry.duration) || entry.duration < 0 || !isFiniteNumber(entry.calories) || entry.calories < 0
      || !Number.isInteger(entry.exercises) || entry.exercises < 0 || !levels.has(entry.level)) return false;
    seen.add(entry.id);
    return true;
  }).map((entry) => ({ ...entry, title: entry.title.trim() }));
}

function validateWeights(values) {
  if (!Array.isArray(values)) return [];
  const seen = new Set();
  return values.filter((entry) => {
    if (!isObject(entry) || !isCalendarDate(entry.date) || seen.has(entry.date) || !isFiniteNumber(entry.value) || entry.value < 20 || entry.value > 400) return false;
    seen.add(entry.date);
    return true;
  }).map((entry) => ({ id: isText(entry.id) ? entry.id : `weight-${entry.date}`, date: entry.date, value: entry.value }));
}

function validatePlan(value, place = null) {
  if (!isObject(value) || !Array.isArray(value.exerciseIds) || !isText(value.title, 200)
    || !Number.isInteger(value.sets) || value.sets < 1 || value.sets > 20) return null;
  const exerciseIds = unique(value.exerciseIds.filter((id) => {
    const exercise = exercises.get(id);
    return exercise && (!place || !Array.isArray(exercise.places) || exercise.places.includes(place));
  }));
  if (!exerciseIds.length) return null;
  return {
    ...value,
    title: value.title.trim(),
    exerciseIds,
    sets: value.sets,
    reps: isText(String(value.reps ?? ''), 40) ? String(value.reps) : '10',
    duration: isFiniteNumber(value.duration) && value.duration >= 0 ? value.duration : exerciseIds.reduce((sum, id) => sum + exercises.get(id).duration, 0),
    focus: typeof value.focus === 'string' ? value.focus : 'Your custom workout',
    rest: value.rest === true,
  };
}

export function validateSession(value) {
  if (!isObject(value) || !isText(value.id) || !isObject(value.plan) || !levels.has(value.plan.level)
    || !Array.isArray(value.plan.exerciseIds) || !Number.isInteger(value.exerciseIndex) || value.exerciseIndex < 0 || value.exerciseIndex >= value.plan.exerciseIds.length
    || !isFiniteNumber(value.elapsed) || value.elapsed < 0 || !isObject(value.completed)) return null;
  const plan = validatePlan(value.plan, ['home', 'gym'].includes(value.plan.trainingPlace) ? value.plan.trainingPlace : null);
  if (!plan) return null;
  const selectedId = value.plan.exerciseIds[value.exerciseIndex];
  const selectedIndex = plan.exerciseIds.indexOf(selectedId);
  const completed = {};
  for (const id of plan.exerciseIds) {
    completed[id] = unique((Array.isArray(value.completed[id]) ? value.completed[id] : []).filter((set) => Number.isInteger(set) && set >= 0 && set < plan.sets));
  }
  return { ...value, plan, exerciseIndex: selectedIndex < 0 ? Math.min(value.exerciseIndex, plan.exerciseIds.length - 1) : selectedIndex, completed };
}

function validateCustomPlans(values) {
  if (!isObject(values)) return {};
  const result = {};
  for (const [key, value] of Object.entries(values)) {
    const match = /^(home|gym):(beginner|medium|experienced):(\d{4}-\d{2}-\d{2})$/.exec(key);
    if (!match || !isCalendarDate(match[3])) continue;
    const plan = validatePlan(value, match[1]);
    if (plan) result[key] = plan;
  }
  return result;
}

function validateWeeklyPlans(values) {
  if (!isObject(values)) return {};
  const result = {};
  for (const [key, week] of Object.entries(values)) {
    const match = /^(home|gym):(beginner|medium|experienced)$/.exec(key);
    if (!match || !Array.isArray(week) || week.length !== 7
      || !week.every((plan) => isObject(plan) && weekDays.includes(plan.day))
      || new Set(week.map((plan) => plan.day)).size !== 7) continue;
    const normalizedWeek = weekDays.map((day) => {
      const value = week.find((plan) => plan?.day === day);
      // Weekly templates represent a complete user-selected schedule. Reject
      // an invalid selection instead of silently substituting its exercises.
      if (!value || !Array.isArray(value.exerciseIds) || !value.exerciseIds.length
        || unique(value.exerciseIds).length !== value.exerciseIds.length
        || value.exerciseIds.some((id) => !exercises.get(id)?.places?.includes(match[1]))) return null;
      const plan = validatePlan(value, match[1]);
      if (!plan) return null;
      const groups = value.muscleGroups === undefined
        ? unique(plan.exerciseIds.map((id) => exercises.get(id).group))
        : Array.isArray(value.muscleGroups) ? unique(value.muscleGroups) : null;
      if (!groups?.length || groups.some((group) => !muscleGroups.has(group))) return null;
      return { ...plan, day, muscleGroups: groups, custom: true };
    });
    if (normalizedWeek.every(Boolean)) result[key] = normalizedWeek;
  }
  return result;
}

export function normalizeWorkspace(value) {
  if (!isObject(value)) return createEmptyWorkspace();
  return {
    schemaVersion: 1,
    legacyMigrated: true,
    profile: validateProfile(value.profile),
    level: levels.has(value.level) ? value.level : null,
    trainingPlace: ['home', 'gym'].includes(value.trainingPlace) ? value.trainingPlace : null,
    history: validateHistory(value.history),
    weights: validateWeights(value.weights),
    session: validateSession(value.session),
    customPlans: validateCustomPlans(value.customPlans),
    weeklyPlans: validateWeeklyPlans(value.weeklyPlans),
    visits: unique((Array.isArray(value.visits) ? value.visits : []).map(timestamp).filter(Boolean)).slice(-30),
    lastVisitAt: timestamp(value.lastVisitAt),
  };
}

// Legacy profile and experience were seeded by the previous app. They must be
// confirmed through onboarding, while any actual recorded activity is retained.
export function migrateLegacyWorkspace(storage) {
  const read = (key) => {
    const saved = storage.getItem(`fittrack:${key}`);
    if (saved === null) return null;
    try { return JSON.parse(saved); } catch { return null; }
  };
  return normalizeWorkspace({ history: read('history'), weights: read('weights'), session: read('active-session') });
}

export function recordVisit(value, visitedAt) {
  const data = normalizeWorkspace(value);
  const now = timestamp(visitedAt);
  if (!now) return data;
  return { ...data, visits: unique([...data.visits, now]).slice(-30), lastVisitAt: now };
}

function meaningfulContent(value) {
  const { visits, lastVisitAt, ...content } = normalizeWorkspace(value);
  const canonical = (item) => {
    if (Array.isArray(item)) return item.map(canonical);
    if (isObject(item)) return Object.fromEntries(Object.keys(item).sort().map((key) => [key, canonical(item[key])]));
    return item;
  };
  return JSON.stringify(canonical(content));
}

function mergeVisitMetadata(remote, desired) {
  return {
    visits: unique([...remote.visits, ...desired.visits]).sort().slice(-30),
    lastVisitAt: [remote.lastVisitAt, desired.lastVisitAt].filter(Boolean).sort().at(-1) || null,
  };
}

// Called after reading the latest record inside the same readwrite transaction
// that will perform the put. Metadata from opening a tab cannot replace progress.
export function resolveWorkspaceWrite(stored, baseline, candidate) {
  const remote = normalizeWorkspace(stored);
  const desired = normalizeWorkspace(candidate);
  const remoteContent = meaningfulContent(remote);
  const baselineContent = meaningfulContent(baseline);
  const desiredContent = meaningfulContent(desired);
  const remoteChanged = remoteContent !== baselineContent;
  const localChanged = desiredContent !== baselineContent;
  if (remoteChanged && localChanged && remoteContent !== desiredContent) return { conflict: true, data: null, adoptedRemote: false };
  const adoptedRemote = !localChanged && remoteContent !== desiredContent;
  return { conflict: false, adoptedRemote, data: { ...(localChanged ? desired : remote), ...mergeVisitMetadata(remote, desired) } };
}

let state = { data: createEmptyWorkspace(), loading: true, error: null, saveError: null, saveConflict: false, saving: false, returning: false, lastVisit: null };
const listeners = new Set();
const subscribe = (listener) => { listeners.add(listener); return () => listeners.delete(listener); };
const getSnapshot = () => state;
const publish = (changes) => { state = { ...state, ...changes }; listeners.forEach((listener) => listener()); };
let connectionPromise = null;
let hydrationPromise = null;
let hydrated = false;
let pageVisitAt = null;
let writeQueue = Promise.resolve();
let pendingWrites = 0;
let revision = 0;
let failedRevision = 0;
let committedBaseline = createEmptyWorkspace();
let localChangeVersion = 0;
let committedChangeVersion = 0;

function openDatabase() {
  if (connectionPromise) return connectionPromise;
  connectionPromise = new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') { reject(new Error('This browser does not provide a local database.')); return; }
    let settled = false;
    const request = indexedDB.open(DATABASE_NAME, 1);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE_NAME)) request.result.createObjectStore(STORE_NAME);
    };
    request.onerror = () => { settled = true; reject(request.error || new Error('The browser database could not be opened.')); };
    request.onblocked = () => { settled = true; reject(new Error('Another FitTrack tab is blocking the database. Close it and retry.')); };
    request.onsuccess = () => {
      if (settled) { request.result.close(); return; }
      const database = request.result;
      database.onversionchange = () => { database.close(); connectionPromise = null; };
      database.onclose = () => { connectionPromise = null; };
      resolve(database);
    };
  }).catch((error) => { connectionPromise = null; throw error; });
  return connectionPromise;
}

async function readWorkspace() {
  const database = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, 'readonly');
    const request = transaction.objectStore(STORE_NAME).get(RECORD_KEY);
    transaction.oncomplete = () => resolve(request.result);
    transaction.onabort = () => reject(transaction.error || new Error('The saved workspace could not be read.'));
    transaction.onerror = () => {};
  });
}

async function writeWorkspace(data, baseline) {
  const database = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, 'readwrite');
    const store = transaction.objectStore(STORE_NAME);
    const request = store.get(RECORD_KEY);
    let result;
    let writeError = null;
    request.onsuccess = () => {
      try {
        result = resolveWorkspaceWrite(request.result, baseline, data);
        if (result.conflict) {
          writeError = new Error(CONFLICT_MESSAGE);
          writeError.name = 'WorkspaceConflictError';
          transaction.abort();
          return;
        }
        store.put(result.data, RECORD_KEY);
      } catch (error) {
        writeError = error;
        transaction.abort();
      }
    };
    transaction.oncomplete = () => resolve(result);
    transaction.onabort = () => reject(writeError || transaction.error || new Error('The browser could not save your changes.'));
    transaction.onerror = () => {};
  });
}

function queueSave(data) {
  if (state.saveConflict) return Promise.resolve();
  const savedSnapshot = structuredClone(data);
  const savedRevision = ++revision;
  const savedChangeVersion = localChangeVersion;
  pendingWrites += 1;
  publish({ saving: true });
  writeQueue = writeQueue.then(async () => {
    try {
      if (state.saveConflict) return;
      // Retried or visit-only snapshots may already have had all their local
      // changes committed by an earlier queue item. Keep those metadata-only,
      // even if that earlier item adopted newer content from another tab.
      const candidate = savedChangeVersion <= committedChangeVersion
        ? { ...committedBaseline, ...mergeVisitMetadata(committedBaseline, savedSnapshot) }
        : savedSnapshot;
      const result = await writeWorkspace(candidate, committedBaseline);
      committedBaseline = result.data;
      committedChangeVersion = Math.max(committedChangeVersion, savedChangeVersion);
      if (result.adoptedRemote) {
        if (localChangeVersion > savedChangeVersion) {
          // A local edit arrived while a visit-only transaction adopted newer
          // remote progress. Its queued snapshot still descends from stale data.
          const conflict = new Error(CONFLICT_MESSAGE);
          conflict.name = 'WorkspaceConflictError';
          throw conflict;
        }
        publish({ data: { ...result.data, ...mergeVisitMetadata(result.data, state.data) } });
      } else if (savedRevision === revision) {
        publish({ data: result.data });
      }
      if (savedRevision >= failedRevision) publish({ saveError: null });
    } catch (error) {
      failedRevision = savedRevision;
      const conflict = error.name === 'WorkspaceConflictError';
      publish({ saveError: conflict ? CONFLICT_MESSAGE : `Your changes have not been saved on this device. ${error.message || 'Please retry.'}`, saveConflict: conflict || state.saveConflict });
    } finally {
      pendingWrites -= 1;
      publish({ saving: pendingWrites > 0 });
    }
  });
  return writeQueue;
}

function hydrate() {
  if (hydrated) return Promise.resolve();
  if (hydrationPromise) return hydrationPromise;
  publish({ loading: true, error: null });
  hydrationPromise = (async () => {
    try {
      const saved = await readWorkspace();
      // A stored record, including a deliberately reset workspace, is always
      // authoritative. Old localStorage values are never imported over it.
      const loaded = saved === undefined ? migrateLegacyWorkspace(localStorage) : normalizeWorkspace(saved);
      // Migration is a real local change relative to an absent database record.
      // Using the migrated result as the baseline would mistake it for metadata
      // and discard genuine legacy workouts during the first write.
      committedBaseline = normalizeWorkspace(saved);
      if (meaningfulContent(loaded) !== meaningfulContent(committedBaseline)) localChangeVersion += 1;
      const previousVisit = loaded.lastVisitAt;
      pageVisitAt ||= new Date().toISOString();
      const data = recordVisit(loaded, pageVisitAt);
      hydrated = true;
      publish({ data, loading: false, error: null, returning: Boolean(previousVisit), lastVisit: previousVisit });
      // No write is queued until the initial read and migration have finished.
      // Legacy keys remain intact; the committed record marks migration done.
      await queueSave(data);
    } catch (error) {
      publish({ loading: false, error: `Your saved workspace could not be opened. ${error.message || 'Please retry.'}` });
    } finally {
      hydrationPromise = null;
    }
  })();
  return hydrationPromise;
}

function setData(update) {
  if (!hydrated) throw new Error('Wait for your saved workspace to finish loading before making changes.');
  const candidate = typeof update === 'function' ? update(state.data) : update;
  if (Object.is(candidate, state.data)) return;
  const data = normalizeWorkspace(candidate);
  if (meaningfulContent(data) !== meaningfulContent(state.data)) localChangeVersion += 1;
  publish({ data });
  queueSave(data);
}

function retry() {
  if (!hydrated) return hydrate();
  return queueSave(state.data);
}

export function useFitnessDatabase() {
  const snapshot = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
  // The module function changes after hot refresh; rerun hydration if a fresh
  // module store replaces the previous one without remounting the component.
  useEffect(() => { hydrate(); }, [hydrate]);
  return { ...snapshot, setData, retry };
}
