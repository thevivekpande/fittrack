import test from 'node:test';
import assert from 'node:assert/strict';
import { createEmptyWorkspace, isCalendarDate, migrateLegacyWorkspace, normalizeWorkspace, recordVisit, resolveWorkspaceWrite, validateSession } from '../src/database.js';
import { EXERCISES, MUSCLE_GROUPS, getWeekPlan } from '../src/data.js';
import { getRecompositionWeekPlan } from '../src/recompositionPlan.js';

const sessionRecord = (id = 'real-workout') => ({ id, date: '2026-09-09', title: 'My first workout', duration: 31, calories: 186, exercises: 4, level: 'beginner' });
const activeSession = () => ({ id: 'active-workout', plan: { ...getWeekPlan('beginner', 'gym')[0], level: 'beginner', trainingPlace: 'gym' }, exerciseIndex: 0, completed: {}, elapsed: 125 });
const weeklyPlan = (place = 'gym', level = 'beginner') => getWeekPlan(level, place).map((plan) => ({
  ...plan,
  muscleGroups: [...new Set(plan.exerciseIds.map((id) => EXERCISES.find((exercise) => exercise.id === id).group))],
  custom: true,
}));

test('a new database has no generated activity or assumed identity, level, or place', () => {
  const data = createEmptyWorkspace();
  assert.equal(data.profile, null);
  assert.equal(data.level, null);
  assert.equal(data.trainingPlace, null);
  assert.deepEqual(data.history, []);
  assert.deepEqual(data.weights, []);
  assert.equal(data.session, null);
  assert.deepEqual(data.customPlans, {});
  assert.deepEqual(data.weeklyPlans, {});
  assert.notEqual(createEmptyWorkspace().history, data.history);
});

test('migration retains actual activity while removing legacy samples and unconfirmed preferences', () => {
  const legacy = new Map([
    ['fittrack:profile', JSON.stringify({ name: 'Alex Morgan', goal: 4 })],
    ['fittrack:level', JSON.stringify('experienced')],
    ['fittrack:history', JSON.stringify([sessionRecord('demo-session-2026-09-09'), sessionRecord(), { bad: true }])],
    ['fittrack:weights', JSON.stringify([{ id: 'weight-1', date: '2026-09-08', value: 73.5 }])],
    ['fittrack:active-session', JSON.stringify(activeSession())],
  ]);
  const data = migrateLegacyWorkspace({ getItem: (key) => legacy.get(key) ?? null });
  assert.deepEqual(data.history, [sessionRecord()]);
  assert.equal(data.weights[0].value, 73.5);
  assert.equal(data.session.id, 'active-workout');
  assert.equal(data.session.elapsed, 125);
  assert.equal(data.profile, null);
  assert.equal(data.level, null);
  assert.equal(data.trainingPlace, null);
  assert.equal(data.legacyMigrated, true);
  assert.equal(legacy.size, 5, 'legacy keys remain untouched during migration');
});

test('corrupt legacy JSON cannot seed personal data and storage access errors propagate', () => {
  const data = migrateLegacyWorkspace({ getItem: () => '{broken json' });
  assert.deepEqual(data.history, []);
  assert.equal(data.profile, null);
  assert.throws(() => migrateLegacyWorkspace({ getItem: () => { throw new Error('Storage denied'); } }), /Storage denied/);
});

test('normalization retains confirmed profile details and real records without reseeding after reset', () => {
  const original = {
    ...createEmptyWorkspace(),
    profile: { name: '  Sam Lee  ', goal: 3, createdAt: '2026-09-08T11:00:00.000Z', height: 175 },
    level: 'medium', trainingPlace: 'home', history: [sessionRecord()],
  };
  const loaded = normalizeWorkspace(original);
  assert.equal(loaded.profile.name, 'Sam Lee');
  assert.equal(loaded.profile.height, 175);
  assert.equal(loaded.level, 'medium');
  assert.equal(loaded.trainingPlace, 'home');
  assert.deepEqual(loaded.history, original.history);
  const reset = normalizeWorkspace({ ...loaded, history: [], weights: [], session: null });
  assert.deepEqual(reset.history, []);
  assert.equal(reset.legacyMigrated, true);
  assert.deepEqual(normalizeWorkspace(reset), reset);
});

test('record validation drops impossible dates, unknown levels, invalid weights, and duplicates', () => {
  assert.equal(isCalendarDate('2024-02-29'), true);
  assert.equal(isCalendarDate('2026-02-29'), false);
  assert.equal(isCalendarDate('2026-13-01'), false);
  const data = normalizeWorkspace({
    profile: { name: 'Name', goal: 0 }, level: 'expert', trainingPlace: 'outside',
    history: [sessionRecord(), sessionRecord(), { ...sessionRecord('invalid-date'), date: '2026-02-30' }, { ...sessionRecord('unknown-level'), level: 'expert' }],
    weights: [{ date: '2026-09-01', value: 72 }, { date: '2026-09-01', value: 71 }, { date: '2026-09-02', value: 900 }, { date: 'bad', value: 72 }],
  });
  assert.equal(data.profile, null);
  assert.equal(data.level, null);
  assert.equal(data.trainingPlace, null);
  assert.equal(data.history.length, 1);
  assert.deepEqual(data.weights, [{ id: 'weight-2026-09-01', date: '2026-09-01', value: 72 }]);
});

test('active session survives catalog changes with a valid index and bounded completed sets', () => {
  const value = activeSession();
  const selectedId = value.plan.exerciseIds[0];
  value.plan.exerciseIds = ['removed-exercise', ...value.plan.exerciseIds];
  value.exerciseIndex = 1;
  value.completed = { [selectedId]: [0, 0, -1, 999, 1.5], 'removed-exercise': [0] };
  const loaded = validateSession(value);
  assert.equal(loaded.plan.exerciseIds.includes('removed-exercise'), false);
  assert.equal(loaded.exerciseIndex, 0);
  assert.equal(loaded.plan.exerciseIds[loaded.exerciseIndex], selectedId);
  assert.deepEqual(loaded.completed[selectedId], [0]);
  assert.equal('removed-exercise' in loaded.completed, false);
  assert.equal(validateSession({ ...value, exerciseIndex: 999 }), null);
  assert.equal(validateSession({ ...value, plan: { ...value.plan, level: 'unknown' } }), null);
  assert.equal(validateSession({ ...value, exerciseIndex: 0, plan: { ...value.plan, exerciseIds: ['removed-exercise'] } }), null);
});

test('custom plan validation preserves dated plans and rejects invalid keys or empty catalogs', () => {
  const plan = getWeekPlan('beginner', 'gym')[0];
  const key = 'gym:beginner:2026-09-09';
  const data = normalizeWorkspace({ customPlans: {
    [key]: { ...plan, title: 'My chosen movements', exerciseIds: ['removed-exercise', ...plan.exerciseIds] },
    'gym:beginner:2026-02-30': plan,
    'gym:expert:2026-09-09': plan,
    'gym:beginner:2026-09-10': { ...plan, exerciseIds: ['removed-exercise'] },
    '__proto__': plan,
  } });
  assert.deepEqual(Object.keys(data.customPlans), [key]);
  assert.deepEqual(data.customPlans[key].exerciseIds, plan.exerciseIds);
  assert.equal(data.customPlans[key].title, 'My chosen movements');
});

test('visit stamping is idempotent for one page load and retains only recent timestamps', () => {
  const firstVisit = '2026-09-08T10:00:00.000Z';
  const secondVisit = '2026-09-09T10:00:00.000Z';
  const first = recordVisit(createEmptyWorkspace(), firstVisit);
  const second = recordVisit(first, secondVisit);
  assert.deepEqual(recordVisit(second, secondVisit), second);
  assert.deepEqual(second.visits, [firstVisit, secondVisit]);
  assert.equal(second.lastVisitAt, secondVisit);
  const visits = Array.from({ length: 40 }, (_, index) => new Date(Date.UTC(2026, 0, index + 1)).toISOString());
  const recent = normalizeWorkspace({ visits });
  assert.deepEqual(recent.visits, visits.slice(-30));
});

test('atomic write resolution protects remote progress from a stale tab and repeated retries', () => {
  const baseline = createEmptyWorkspace();
  const remote = { ...baseline, history: [sessionRecord('new-workout-in-another-tab')] };
  const local = { ...baseline, level: 'beginner' };
  const result = resolveWorkspaceWrite(remote, baseline, local);
  assert.equal(result.conflict, true);
  assert.equal(result.data, null);
  assert.equal(resolveWorkspaceWrite(remote, baseline, local).conflict, true, 'retrying the stale snapshot cannot overwrite remote progress');
});

test('a tab opening merges visits into the latest remote progress and keeps the newest timestamp', () => {
  const baseline = recordVisit(createEmptyWorkspace(), '2026-09-08T10:00:00.000Z');
  const remote = recordVisit({ ...baseline, history: [sessionRecord()] }, '2026-09-09T12:00:00.000Z');
  const localVisit = recordVisit(baseline, '2026-09-09T11:00:00.000Z');
  const result = resolveWorkspaceWrite(remote, baseline, localVisit);
  assert.equal(result.conflict, false);
  assert.equal(result.adoptedRemote, true);
  assert.deepEqual(result.data.history, remote.history);
  assert.equal(result.data.lastVisitAt, remote.lastVisitAt);
  assert.deepEqual(result.data.visits, ['2026-09-08T10:00:00.000Z', '2026-09-09T11:00:00.000Z', '2026-09-09T12:00:00.000Z']);
});

test('visit-only changes in another tab do not block local activity and committed baselines advance', () => {
  const baseline = recordVisit(createEmptyWorkspace(), '2026-09-08T10:00:00.000Z');
  const remoteVisit = recordVisit(baseline, '2026-09-09T11:00:00.000Z');
  const firstLocal = { ...baseline, history: [sessionRecord()] };
  const first = resolveWorkspaceWrite(remoteVisit, baseline, firstLocal);
  assert.equal(first.conflict, false);
  assert.deepEqual(first.data.history, firstLocal.history);
  assert.equal(first.data.lastVisitAt, remoteVisit.lastVisitAt);
  const secondLocal = { ...firstLocal, weights: [{ id: 'weight-1', date: '2026-09-09', value: 73.5 }] };
  const second = resolveWorkspaceWrite(first.data, first.data, secondLocal);
  assert.equal(second.conflict, false);
  assert.deepEqual(second.data.weights, secondLocal.weights);
  assert.deepEqual(second.data.history, firstLocal.history);
});

test('the first migration commits actual legacy activity and cannot overwrite a newly created remote record', () => {
  const emptyBaseline = createEmptyWorkspace();
  const migrated = recordVisit({ ...emptyBaseline, history: [sessionRecord('migrated-workout')] }, '2026-09-09T10:00:00.000Z');
  const first = resolveWorkspaceWrite(undefined, emptyBaseline, migrated);
  assert.equal(first.conflict, false);
  assert.deepEqual(first.data.history, migrated.history);
  const remote = { ...emptyBaseline, profile: { name: 'New profile', goal: 3 }, level: 'medium', trainingPlace: 'home' };
  assert.equal(resolveWorkspaceWrite(remote, emptyBaseline, migrated).conflict, true);
});

test('equivalent content with reordered object keys or identical remote changes is not a conflict', () => {
  const baseline = { ...createEmptyWorkspace(), profile: { name: 'Sam', goal: 3 }, level: 'beginner', trainingPlace: 'home' };
  const remote = { ...baseline, profile: { goal: 3, name: 'Sam' } };
  const local = { ...baseline, history: [sessionRecord()] };
  assert.equal(resolveWorkspaceWrite(remote, baseline, local).conflict, false);
  assert.equal(resolveWorkspaceWrite(local, baseline, local).conflict, false);
});

test('weekly plans persist across normalization, visit recording, and ordered write resolution', () => {
  const weeklyPlans = { 'gym:beginner': weeklyPlan(), 'home:medium': weeklyPlan('home', 'medium') };
  const stored = normalizeWorkspace({ ...createEmptyWorkspace(), weeklyPlans });
  assert.deepEqual(stored.weeklyPlans, weeklyPlans);
  assert.deepEqual(normalizeWorkspace(structuredClone(stored)), stored);
  const visited = recordVisit(stored, '2026-09-09T10:00:00.000Z');
  assert.deepEqual(visited.weeklyPlans, weeklyPlans);
  const updated = { ...visited, history: [sessionRecord()] };
  const committed = resolveWorkspaceWrite(stored, stored, updated);
  assert.equal(committed.conflict, false);
  assert.deepEqual(committed.data.weeklyPlans, weeklyPlans);
  assert.deepEqual(normalizeWorkspace(committed.data).weeklyPlans, weeklyPlans);
});

test('weekly plan migration is additive and corrupt weeks leave existing user data untouched', () => {
  const previous = normalizeWorkspace({
    profile: { name: 'Sam', goal: 3, createdAt: '2026-09-08T10:00:00.000Z' },
    level: 'beginner', trainingPlace: 'gym', history: [sessionRecord()],
    weights: [{ id: 'weight-1', date: '2026-09-09', value: 72.5 }],
    session: activeSession(), customPlans: { 'gym:beginner:2026-09-09': getWeekPlan('beginner', 'gym')[0] },
    visits: ['2026-09-08T10:00:00.000Z'], lastVisitAt: '2026-09-08T10:00:00.000Z',
  });
  const { weeklyPlans, ...oldRecord } = previous;
  assert.deepEqual(weeklyPlans, {});
  assert.deepEqual(normalizeWorkspace(oldRecord), previous);
  const broken = normalizeWorkspace({ ...oldRecord, weeklyPlans: { 'gym:beginner': [{ day: 'Mon' }], 'home:medium': null } });
  assert.deepEqual(broken, previous);
});

test('weekly validation rejects partial, duplicate, invalid-day, invalid-set, and unknown-key schedules', () => {
  const week = weeklyPlan();
  const duplicate = structuredClone(week);
  duplicate[6].day = 'Mon';
  const invalidDay = structuredClone(week);
  invalidDay[2].day = 'Wednesday';
  const invalidSets = structuredClone(week);
  delete invalidSets[0].sets;
  for (const candidate of [week.slice(0, 6), [...week, week[0]], duplicate, invalidDay, invalidSets, null]) {
    assert.deepEqual(normalizeWorkspace({ weeklyPlans: { 'gym:beginner': candidate } }).weeklyPlans, {});
  }
  assert.deepEqual(normalizeWorkspace({ weeklyPlans: { 'gym:expert': week, 'outdoors:beginner': week, 'gym:beginner:2026-09-09': week } }).weeklyPlans, {});
  const reordered = normalizeWorkspace({ weeklyPlans: { 'gym:beginner': [...week].reverse() } });
  assert.deepEqual(reordered.weeklyPlans['gym:beginner'], week, 'complete schedules are canonically ordered Monday through Sunday');
});

test('weekly validation enforces place availability without silently replacing exercises', () => {
  const validHome = weeklyPlan('home');
  const unavailableHome = structuredClone(validHome);
  const gymOnly = EXERCISES.find((exercise) => exercise.places.includes('gym') && !exercise.places.includes('home'));
  unavailableHome[0].exerciseIds.push(gymOnly.id);
  const unknownExercise = structuredClone(validHome);
  unknownExercise[1].exerciseIds.push('removed-exercise');
  const emptyTraining = structuredClone(validHome);
  emptyTraining[6].exerciseIds = [];
  emptyTraining[6].rest = false;
  for (const invalid of [unavailableHome, unknownExercise, emptyTraining]) {
    const loaded = normalizeWorkspace({ weeklyPlans: { 'home:beginner': invalid, 'gym:medium': weeklyPlan('gym', 'medium') } });
    assert.equal('home:beginner' in loaded.weeklyPlans, false);
    assert.equal(loaded.weeklyPlans['gym:medium'].length, 7);
  }
  const valid = normalizeWorkspace({ weeklyPlans: { 'home:beginner': validHome } });
  assert.deepEqual(valid.weeklyPlans['home:beginner'], validHome);
});

test('weekly muscle groups are validated and inferred only when absent', () => {
  const week = weeklyPlan();
  const missingGroups = week.map(({ muscleGroups, custom, ...plan }) => plan);
  const inferred = normalizeWorkspace({ weeklyPlans: { 'gym:beginner': missingGroups } }).weeklyPlans['gym:beginner'];
  assert.deepEqual(inferred, week);
  assert.ok(inferred.every((plan) => plan.muscleGroups.every((group) => MUSCLE_GROUPS.includes(group))));
  for (const invalidGroups of [['Unknown muscle'], ['Chest', 42], [], null, 'Chest']) {
    const invalid = structuredClone(week);
    invalid[0].muscleGroups = invalidGroups;
    assert.deepEqual(normalizeWorkspace({ weeklyPlans: { 'gym:beginner': invalid } }).weeklyPlans, {});
  }
});

test('weekly changes participate in multi-tab conflict protection and metadata-only merging', () => {
  const baseline = createEmptyWorkspace();
  const remote = { ...baseline, weeklyPlans: { 'gym:beginner': weeklyPlan() } };
  const local = { ...baseline, history: [sessionRecord()] };
  assert.equal(resolveWorkspaceWrite(remote, baseline, local).conflict, true);
  const justVisiting = recordVisit(baseline, '2026-09-09T10:00:00.000Z');
  const mergedVisit = resolveWorkspaceWrite(remote, baseline, justVisiting);
  assert.equal(mergedVisit.conflict, false);
  assert.deepEqual(mergedVisit.data.weeklyPlans, remote.weeklyPlans);
  const reset = normalizeWorkspace({ ...remote, history: [], weights: [], session: null, customPlans: {}, weeklyPlans: {} });
  assert.deepEqual(reset.weeklyPlans, {});
  assert.deepEqual(normalizeWorkspace(reset).weeklyPlans, {}, 'a saved activity reset must not restore weekly plans');
});

test('fitness goal migration leaves existing users unselected and retains their profile and activity',()=>{
  const existing={...createEmptyWorkspace(),profile:{name:'Sam',goal:4},history:[sessionRecord()],weeklyPlans:{},weights:[{id:'weight',date:'2026-09-08',value:70}]};
  const migrated=normalizeWorkspace(existing);
  assert.equal(migrated.profile.fitnessGoal,null);
  assert.equal(migrated.profile.name,'Sam');assert.equal(migrated.profile.goal,4);
  assert.equal(migrated.history.length,1);assert.equal(migrated.weights.length,1);
  const selected=normalizeWorkspace({...existing,profile:{...existing.profile,fitnessGoal:'build-muscle'}});
  assert.equal(selected.profile.fitnessGoal,'build-muscle');
  const invalid=normalizeWorkspace({...existing,profile:{...existing.profile,fitnessGoal:'invented-goal'}});
  assert.equal(invalid.profile.fitnessGoal,null);assert.equal(invalid.history.length,1);
});

test('gender is never guessed for existing profiles and supported selections persist without affecting history',()=>{
  const initial={...createEmptyWorkspace(),profile:{name:'Pat',goal:3,fitnessGoal:'build-muscle'},history:[sessionRecord()]};
  assert.equal(normalizeWorkspace(initial).profile.gender,null);
  for(const gender of ['woman','man','nonbinary','prefer-not-to-say']){
    const result=normalizeWorkspace({...initial,profile:{...initial.profile,gender}});
    assert.equal(result.profile.gender,gender);assert.equal(result.history.length,1);
  }
  const unknown=normalizeWorkspace({...initial,profile:{...initial.profile,gender:'unrecognized'}});
  assert.equal(unknown.profile.gender,null);assert.equal(unknown.profile.name,'Pat');assert.equal(unknown.history.length,1);
});

test('per-exercise sets and mixed units survive reload and bound unfinished completion independently', () => {
  const session = activeSession();
  session.plan.exerciseIds = ['bicep-curl', 'plank', 'treadmill-walk'];
  session.plan.exerciseTargets = {
    'bicep-curl': { sets: 4, reps: '8–12', unit: 'reps', restSeconds: 90 },
    plank: { sets: 2, reps: '30–45', unit: 'sec', restSeconds: 30 },
    'treadmill-walk': { sets: 1, reps: '10–15', unit: 'min', restSeconds: 0 },
    'removed-exercise': { sets: 3, reps: '10', unit: 'reps', restSeconds: 60 },
  };
  session.completed = { 'bicep-curl': [0, 1, 2, 3, 4, -1, 1], plank: [0, 1, 2, 3], 'treadmill-walk': [0, 1, 2] };
  const loaded = normalizeWorkspace({ session, history: [sessionRecord()] });
  assert.deepEqual(loaded.session.completed, { 'bicep-curl': [0, 1, 2, 3], plank: [0, 1], 'treadmill-walk': [0] });
  assert.deepEqual(Object.keys(loaded.session.plan.exerciseTargets), ['bicep-curl', 'plank', 'treadmill-walk']);
  assert.equal(loaded.session.plan.exerciseTargets['treadmill-walk'].unit, 'min');
  assert.deepEqual(normalizeWorkspace(structuredClone(loaded)), loaded);
  assert.deepEqual(loaded.history, [sessionRecord()]);
  assert.equal(loaded.session.elapsed, session.elapsed);
});

test('a deliberate full rest Sunday persists without fabricating a workout or an active session', () => {
  const week = weeklyPlan();
  week[6] = { ...week[6], title: 'Full rest', exerciseIds: [], muscleGroups: ['Mobility'], sets: 1, reps: '6', rest: true, duration: 0, exerciseTargets: {}, programId: 'six-day-recomposition' };
  const data = normalizeWorkspace({ weeklyPlans: { 'gym:beginner': week }, customPlans: { 'gym:beginner:2026-09-13': week[6] } });
  assert.deepEqual(data.weeklyPlans['gym:beginner'][6], week[6]);
  assert.deepEqual(data.customPlans['gym:beginner:2026-09-13'].exerciseIds, []);
  assert.deepEqual(data.history, []);
  assert.equal(data.session, null);
  assert.deepEqual(normalizeWorkspace(structuredClone(data)), data);
  assert.equal(validateSession({ ...activeSession(), plan: { ...week[6], level: 'beginner', trainingPlace: 'gym' } }), null);
  const invalid = structuredClone(week);
  invalid[6].rest = false;
  assert.deepEqual(normalizeWorkspace({ weeklyPlans: { 'gym:beginner': invalid } }).weeklyPlans, {});
});

test('invalid target entries fall back without dropping the plan and target-only edits trigger conflicts', () => {
  const week = weeklyPlan();
  const id = week[0].exerciseIds[0];
  week[0].exerciseTargets = { [id]: { sets: 3, reps: '12', unit: 'reps', restSeconds: 75 } };
  const baseline = normalizeWorkspace({ weeklyPlans: { 'gym:beginner': week } });
  const remote = structuredClone(baseline);
  remote.weeklyPlans['gym:beginner'][0].exerciseTargets[id].sets = 4;
  const local = structuredClone(baseline);
  local.weeklyPlans['gym:beginner'][0].exerciseTargets[id].reps = '15';
  assert.equal(resolveWorkspaceWrite(remote, baseline, local).conflict, true);
  const corrupt = structuredClone(baseline);
  corrupt.weeklyPlans['gym:beginner'][0].exerciseTargets[id].sets = 99;
  const normalized = normalizeWorkspace(corrupt);
  assert.equal(normalized.weeklyPlans['gym:beginner'].length, 7);
  assert.deepEqual(normalized.weeklyPlans['gym:beginner'][0].exerciseTargets, {});
});

test('the full six-day source plan reloads with exact day-specific links and targets at every level', () => {
  for (const level of ['beginner', 'medium', 'experienced']) {
    const week = getRecompositionWeekPlan(level);
    const state = normalizeWorkspace({ weeklyPlans: { [`gym:${level}`]: week } });
    const reloaded = normalizeWorkspace(structuredClone(state));
    const savedWeek = reloaded.weeklyPlans[`gym:${level}`];
    assert.equal(savedWeek.length, 7);
    for (let index = 0; index < 7; index += 1) {
      assert.deepEqual(savedWeek[index].exerciseTargets, week[index].exerciseTargets);
      assert.deepEqual(savedWeek[index].exerciseVideoLinks, week[index].exerciseVideoLinks);
      assert.equal(savedWeek[index].programId, 'six-day-recomposition');
    }
    assert.notEqual(savedWeek[0].exerciseVideoLinks['incline-bench-press'].english, savedWeek[4].exerciseVideoLinks['incline-bench-press'].english);
    assert.deepEqual(savedWeek[6].exerciseIds, []);
    assert.deepEqual(reloaded.history, []);
    assert.equal(reloaded.session, null);
  }
});

test('explicit rest weekdays persist as independent sorted profile data without changing actual records', () => {
  const input = { profile: { name: 'Sam', goal: 3, fitnessGoal: 'build-muscle', restDays: [6, 2, 4, 0] }, history: [sessionRecord()], session: activeSession() };
  const loaded = normalizeWorkspace(input);
  assert.deepEqual(loaded.profile.restDays, [0, 2, 4, 6]);
  assert.deepEqual(normalizeWorkspace(structuredClone(loaded)), loaded);
  assert.deepEqual(loaded.history, input.history);
  assert.equal(loaded.session.id, input.session.id);
  loaded.profile.restDays.push(1);
  assert.deepEqual(input.profile.restDays, [6, 2, 4, 0]);
});

test('invalid rest preferences are removed without rejecting a legacy profile or overwriting saved weeks', () => {
  const profile = { name: 'Sam', goal: 3, fitnessGoal: 'build-muscle' };
  const weeklyPlans = { 'gym:beginner': weeklyPlan() };
  for (const restDays of [undefined, null, [6], [0, 0, 2, 4], [-1, 1, 3, 6], [0, 2, 4, 7], ['0', 2, 4, 6]]) {
    const loaded = normalizeWorkspace({ profile: { ...profile, restDays }, weeklyPlans, history: [sessionRecord()] });
    assert.equal(Object.hasOwn(loaded.profile, 'restDays'), false);
    assert.equal(loaded.profile.name, profile.name);
    assert.deepEqual(loaded.weeklyPlans, weeklyPlans);
    assert.equal(loaded.history.length, 1);
  }
  assert.deepEqual(normalizeWorkspace({ profile: { ...profile, goal: 7, restDays: [] } }).profile.restDays, []);
});

test('rest-day edits participate in conflict protection rather than overwriting another tab’s schedule', () => {
  const baseline = normalizeWorkspace({ profile: { name: 'Sam', goal: 6, fitnessGoal: 'body-recomposition', restDays: [6] } });
  const remote = { ...baseline, profile: { ...baseline.profile, restDays: [2] } };
  const local = { ...baseline, profile: { ...baseline.profile, restDays: [4] } };
  assert.equal(resolveWorkspaceWrite(remote, baseline, local).conflict, true);
  assert.deepEqual(resolveWorkspaceWrite(remote, baseline, recordVisit(baseline, '2026-09-23T10:00:00Z')).data.profile.restDays, [2]);
});
