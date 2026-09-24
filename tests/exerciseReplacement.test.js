import test from 'node:test';
import assert from 'node:assert/strict';
import { EXERCISES, getWeekPlan } from '../src/data.js';
import { getExerciseTarget } from '../src/workoutTargets.js';
import { estimateWorkoutMinutes, resolveWeekPlans } from '../src/planning.js';
import { getRecompositionWeekPlan } from '../src/recompositionPlan.js';
import { normalizeWorkspace, validateSession } from '../src/database.js';
import { swapExerciseInPlan, applyExerciseReplacement, replaceSessionExercise } from '../src/exerciseReplacement.js';

const exercise = id => EXERCISES.find(item => item.id === id);
const target = (sets = 4, reps = '8–12', unit = 'reps', restSeconds = 90) => ({ sets, reps, unit, restSeconds });
const plan = (exerciseIds = ['bicep-curl', 'plank'], extras = {}) => ({
  day: 'Mon', title: 'My chosen routine', focus: 'Biceps · Core', duration: 30,
  sets: 3, reps: '10', rest: false, custom: true, customTitle: true,
  muscleGroups: [...new Set(exerciseIds.map(id => exercise(id).group))], exerciseIds, ...extras,
});
const week = () => getWeekPlan('beginner', 'gym').map((item, index) => index === 0 ? plan() : item);
const state = (extras = {}) => ({
  profile: { name: 'Sam', goal: 3, fitnessGoal: 'general-fitness' }, level: 'beginner', trainingPlace: 'gym',
  history: [{ id: 'actual-workout', date: '2026-09-06', title: 'Real training', duration: 25, calories: 100, exercises: 2, level: 'beginner' }],
  weights: [{ id: 'actual-weight', date: '2026-09-06', value: 71 }],
  session: { id: 'unfinished', plan: { ...plan(), level: 'beginner', trainingPlace: 'gym' }, exerciseIndex: 0, completed: { plank: [0] }, elapsed: 143 },
  weeklyPlans: { 'gym:beginner': week(), 'home:beginner': getWeekPlan('beginner', 'home') }, customPlans: {}, ...extras,
});
const options = (extras = {}) => ({ sourceId: 'bicep-curl', replacementId: 'hammer-curl', date: '2026-09-07', trainingPlace: 'gym', level: 'beginner', ...extras });

test('one slot changes in place while compatible targets and deliberate titles survive', () => {
  const original = plan(['bicep-curl', 'plank'], {
    exerciseTargets: { 'bicep-curl': target(), plank: target(2, '20–30', 'sec', 45) },
    exerciseVideoLinks: { 'bicep-curl': { english: 'source-only' }, plank: { english: 'a-specific-plank-query' } },
  });
  const before = structuredClone(original);
  const swapped = swapExerciseInPlan(original, 'bicep-curl', 'hammer-curl');
  assert.deepEqual(swapped.exerciseIds, ['hammer-curl', 'plank']);
  assert.deepEqual(swapped.exerciseTargets['hammer-curl'], target());
  assert.deepEqual(swapped.exerciseTargets.plank, original.exerciseTargets.plank);
  assert.equal(swapped.exerciseTargets['bicep-curl'], undefined);
  assert.equal(swapped.exerciseVideoLinks['bicep-curl'], undefined);
  assert.deepEqual(swapped.exerciseVideoLinks['hammer-curl'], exercise('hammer-curl').videoLinks);
  assert.equal(swapped.exerciseVideoLinks.plank.english, 'a-specific-plank-query');
  assert.equal(swapped.title, original.title);
  assert.deepEqual(swapped.muscleGroups, ['Biceps', 'Core']);
  assert.equal(swapped.duration, estimateWorkoutMinutes(swapped.exerciseIds.map(exercise), swapped.sets, swapped.rest, swapped.exerciseTargets));
  swapped.exerciseTargets.plank.sets = 19;
  swapped.exerciseVideoLinks.plank.english = 'changed';
  assert.deepEqual(original, before, 'returned mutable details do not alias the original plan');
});

test('different units use exercise-appropriate defaults instead of copying hold counts to repetitions', () => {
  const seconds = plan(['plank'], { exerciseTargets: { plank: target(2, '30', 'sec', 15) } });
  assert.deepEqual(getExerciseTarget(swapExerciseInPlan(seconds, 'plank', 'crunch'), exercise('crunch')), target(3, '8–12', 'reps', 60));
  const reps = plan(['crunch'], { exerciseTargets: { crunch: target(4, '8–12', 'reps', 90) } });
  assert.deepEqual(getExerciseTarget(swapExerciseInPlan(reps, 'crunch', 'plank'), exercise('plank')), target(3, '20–30', 'sec', 45));
  const cardio = swapExerciseInPlan(reps, 'crunch', 'treadmill-walk');
  assert.deepEqual(getExerciseTarget(cardio, exercise('treadmill-walk')), target(1, '10', 'min', 0));
  assert.deepEqual(getExerciseTarget(swapExerciseInPlan(cardio, 'treadmill-walk', 'crunch'), exercise('crunch')), target(3, '8–12', 'reps', 60));
});

test('same-unit cardio and timed alternatives keep effective source targets', () => {
  const cardio = plan(['treadmill-walk'], { exerciseTargets: { 'treadmill-walk': target(1, '15–20', 'min', 0) } });
  assert.deepEqual(getExerciseTarget(swapExerciseInPlan(cardio, 'treadmill-walk', 'stationary-bike'), exercise('stationary-bike')), target(1, '15–20', 'min', 0));
  const timed = plan(['plank'], { exerciseTargets: { plank: target(2, '45', 'sec', 30) } });
  const sidePlank = EXERCISES.find(item => item.movement === 'sideplank');
  assert.deepEqual(getExerciseTarget(swapExerciseInPlan(timed, 'plank', sidePlank.id), sidePlank), target(2, '45', 'sec', 30));
  const legacy = plan(['bicep-curl'], { sets: 2, reps: '12–15' });
  assert.deepEqual(getExerciseTarget(swapExerciseInPlan(legacy, 'bicep-curl', 'hammer-curl'), exercise('hammer-curl')), target(2, '12–15', 'reps', 60));
});

test('new exercise groups and generated names are refreshed, while program metadata survives', () => {
  const generated = plan(['bicep-curl'], { title: 'Biceps', customTitle: false });
  const changed = swapExerciseInPlan(generated, 'bicep-curl', 'crunch');
  assert.equal(changed.title, 'Core'); assert.equal(changed.focus, 'Core'); assert.deepEqual(changed.muscleGroups, ['Core']);
  const friday = getRecompositionWeekPlan()[4];
  const revised = swapExerciseInPlan(friday, 'cable-row', 'single-arm-dumbbell-row');
  assert.equal(revised.title, friday.title); assert.equal(revised.programId, friday.programId);
  assert.equal(revised.targetNote, friday.targetNote);
  assert.deepEqual(revised.exerciseVideoLinks['incline-bench-press'], friday.exerciseVideoLinks['incline-bench-press']);
  assert.notDeepEqual(revised.exerciseVideoLinks['incline-bench-press'], exercise('incline-bench-press').videoLinks, 'Friday keeps its own query instead of the catalog Monday query');
  assert.deepEqual(revised.exerciseVideoLinks['single-arm-dumbbell-row'], exercise('single-arm-dumbbell-row').videoLinks);
});

test('an alternative without catalog videos never inherits removed source queries', () => {
  const original = plan(['plank'], { exerciseVideoLinks: { plank: { hindi: 'plank-hindi', english: 'plank-english' } } });
  const replacement = EXERCISES.find(item => !item.videoLinks && item.id !== 'plank');
  const swapped = swapExerciseInPlan(original, 'plank', replacement.id);
  assert.deepEqual(swapped.exerciseVideoLinks, {});
});

test('unknowns, duplicates, absent sources and complete rest days cannot be swapped', () => {
  assert.throws(() => swapExerciseInPlan(plan(), 'bicep-curl', 'unknown'), /library/);
  assert.throws(() => swapExerciseInPlan(plan(), 'bicep-curl', 'bicep-curl'), /different/);
  assert.throws(() => swapExerciseInPlan(plan(), 'bicep-curl', 'plank'), /already/);
  assert.throws(() => swapExerciseInPlan(plan(), 'crunch', 'hammer-curl'), /no longer/);
  assert.throws(() => swapExerciseInPlan({ ...plan(), exerciseIds: ['bicep-curl', 'unknown'] }, 'bicep-curl', 'hammer-curl'), /unavailable/);
  assert.throws(() => swapExerciseInPlan(plan(['bicep-curl', 'bicep-curl']), 'bicep-curl', 'hammer-curl'), /duplicate/);
  assert.throws(() => swapExerciseInPlan(getRecompositionWeekPlan()[6], 'plank', 'crunch'), /complete rest day/);
});

test('home eligibility is enforced for direct plans, dated replacements and active sessions', () => {
  const home = { ...plan(['plank']), trainingPlace: 'home', level: 'beginner' };
  assert.throws(() => swapExerciseInPlan(home, 'plank', 'bicep-curl'), /training location/);
  const original = state();
  assert.throws(() => applyExerciseReplacement(original, options({ trainingPlace: 'home', sourceId: 'bodyweight-squat' })), /training location/);
  assert.throws(() => replaceSessionExercise({ ...original.session, plan: home, completed: {} }, 'plank', 'bicep-curl'), /training location/);
  assert.deepEqual(swapExerciseInPlan(home, 'plank', 'crunch').exerciseIds, ['crunch']);
});

test('date-only default touches one override and leaves recurring plans, sessions and activity intact', () => {
  const original = state({ customPlans: {
    'gym:beginner:2026-09-07': plan(['bicep-curl', 'crunch'], { title: 'Only this Monday' }),
    'gym:beginner:2026-09-14': plan(),
  } });
  const before = structuredClone(original);
  const changed = applyExerciseReplacement(original, options());
  assert.deepEqual(changed.customPlans['gym:beginner:2026-09-07'].exerciseIds, ['hammer-curl', 'crunch']);
  assert.equal(changed.customPlans['gym:beginner:2026-09-07'].title, 'Only this Monday');
  assert.equal(changed.customPlans['gym:beginner:2026-09-14'], original.customPlans['gym:beginner:2026-09-14']);
  for (const field of ['weeklyPlans', 'profile', 'session', 'history', 'weights']) assert.equal(changed[field], original[field]);
  assert.deepEqual(original, before);
});

test('recurring replacement changes just one weekday and relevant future overrides without copying date edits into the week', () => {
  const original = state({ customPlans: {
    'gym:beginner:2026-08-31': plan(),
    'gym:beginner:2026-09-07': plan(['bicep-curl', 'crunch'], { title: 'One-off choice', exerciseTargets: { crunch: target(6, '15', 'reps', 45) } }),
    'gym:beginner:2026-09-08': plan(),
    'gym:beginner:2026-09-14': plan(['plank', 'bicep-curl', 'push-up'], { title: 'Next Monday' }),
    'gym:beginner:2026-09-21': plan(['crunch', 'push-up']),
    'gym:medium:2026-09-14': plan(),
    'home:beginner:2026-09-14': plan(['plank']),
  } });
  const before = structuredClone(original);
  const changed = applyExerciseReplacement(original, options({ scope: 'weekly' }));
  assert.deepEqual(changed.weeklyPlans['gym:beginner'][0].exerciseIds, ['hammer-curl', 'plank']);
  assert.deepEqual(changed.customPlans['gym:beginner:2026-09-07'].exerciseIds, ['hammer-curl', 'crunch']);
  assert.equal(changed.customPlans['gym:beginner:2026-09-07'].title, 'One-off choice');
  assert.deepEqual(changed.customPlans['gym:beginner:2026-09-07'].exerciseTargets.crunch, target(6, '15', 'reps', 45));
  assert.deepEqual(changed.customPlans['gym:beginner:2026-09-14'].exerciseIds, ['plank', 'hammer-curl', 'push-up']);
  const untouched = ['gym:beginner:2026-08-31', 'gym:beginner:2026-09-08', 'gym:beginner:2026-09-21', 'gym:medium:2026-09-14', 'home:beginner:2026-09-14'];
  for (const key of untouched) assert.equal(changed.customPlans[key], original.customPlans[key]);
  assert.deepEqual(changed.weeklyPlans['gym:beginner'].slice(1), original.weeklyPlans['gym:beginner'].slice(1));
  assert.equal(changed.weeklyPlans['home:beginner'], original.weeklyPlans['home:beginner']);
  for (const field of ['profile', 'session', 'history', 'weights']) assert.equal(changed[field], original[field]);
  assert.deepEqual(original, before);
});

test('recurring changes persist and resolve in future weeks without fabricated activity', () => {
  const original = state({ weeklyPlans: {} });
  const changed = applyExerciseReplacement(original, options({ scope: 'weekly', basePlans: week() }));
  const reloaded = normalizeWorkspace(JSON.parse(JSON.stringify(changed)));
  const dates = Array.from({ length: 7 }, (_, i) => new Date(2026, 9, 5 + i, 12));
  const future = resolveWeekPlans({ ...reloaded, dates });
  assert.deepEqual(future[0].exerciseIds, ['hammer-curl', 'plank']);
  assert.deepEqual(reloaded.history, original.history); assert.deepEqual(reloaded.weights, original.weights);
  assert.deepEqual(reloaded.session, validateSession(original.session));
});

test('a saved recurring template takes precedence over stale supplied base plans', () => {
  const original = state();
  const stale = week(); stale[0] = plan(['bicep-curl', 'crunch']);
  const changed = applyExerciseReplacement(original, options({ scope: 'weekly', basePlans: stale }));
  assert.deepEqual(changed.weeklyPlans['gym:beginner'][0].exerciseIds, ['hammer-curl', 'plank']);
});

test('a date-only exercise cannot silently become part of the recurring plan', () => {
  const original = state({ customPlans: { 'gym:beginner:2026-09-07': plan(['crunch', 'plank']) } });
  assert.throws(() => applyExerciseReplacement(original, options({ sourceId: 'crunch', scope: 'weekly' })), /only in your date-specific workout/);
  assert.deepEqual(applyExerciseReplacement(original, options({ sourceId: 'crunch' })).customPlans['gym:beginner:2026-09-07'].exerciseIds, ['hammer-curl', 'plank']);
});

test('a future duplicate blocks the recurring operation atomically with the conflicting date', () => {
  const original = state({ customPlans: { 'gym:beginner:2026-09-14': plan(['bicep-curl', 'hammer-curl']) } });
  const before = structuredClone(original);
  assert.throws(() => applyExerciseReplacement(original, options({ scope: 'weekly' })), /2026-09-14.*already includes/);
  assert.deepEqual(original, before);
  assert.deepEqual(applyExerciseReplacement(original, options()).customPlans['gym:beginner:2026-09-07'].exerciseIds, ['hammer-curl', 'plank']);
});

test('ISO calendar dates and Date objects select the same weekday and invalid dates are rejected', () => {
  const original = state();
  const iso = applyExerciseReplacement(original, options());
  const local = applyExerciseReplacement(original, options({ date: new Date(2026, 8, 7, 23, 30) }));
  assert.deepEqual(local, iso);
  for (const date of ['2026-02-30', 'not-a-date', new Date('invalid')]) assert.throws(() => applyExerciseReplacement(original, options({ date })), /valid workout date/);
  assert.throws(() => applyExerciseReplacement(original, options({ scope: 'all' })), /this date only/);
  assert.throws(() => applyExerciseReplacement(original, options({ level: 'unknown' })), /experience level/);
});

test('active replacement keeps elapsed time, selected index and other completed sets', () => {
  const original = { id: 'real-session', plan: { ...plan(['bicep-curl', 'plank', 'push-up']), level: 'medium', trainingPlace: 'gym' }, exerciseIndex: 1, completed: { 'bicep-curl': [], plank: [0, 1], 'push-up': [0], 'hammer-curl': [0] }, elapsed: 407 };
  const before = structuredClone(original);
  const changed = replaceSessionExercise(original, 'bicep-curl', 'hammer-curl');
  assert.deepEqual(changed.plan.exerciseIds, ['hammer-curl', 'plank', 'push-up']);
  assert.equal(changed.exerciseIndex, 1); assert.equal(changed.elapsed, 407); assert.equal(changed.id, original.id);
  assert.equal(changed.plan.level, 'medium'); assert.equal(changed.plan.trainingPlace, 'gym');
  assert.deepEqual(changed.completed, { plank: [0, 1], 'push-up': [0], 'hammer-curl': [] });
  assert.deepEqual(validateSession(changed), changed);
  changed.completed.plank.push(2);
  assert.deepEqual(original, before);
});

test('completed source sets must be unchecked before an active swap', () => {
  const original = state().session;
  const before = structuredClone(original);
  assert.throws(() => replaceSessionExercise(original, 'plank', 'crunch'), /Uncheck the completed sets/);
  assert.deepEqual(original, before);
  assert.deepEqual(replaceSessionExercise({ ...original, completed: { plank: [] } }, 'plank', 'crunch').plan.exerciseIds, ['bicep-curl', 'crunch']);
});

test('empty Sunday and unrelated per-exercise targets survive a saved weekly swap and reload', () => {
  const original = state({ weeklyPlans: { 'gym:beginner': getRecompositionWeekPlan() } });
  const changed = applyExerciseReplacement(original, options({ sourceId: 'chest-press-machine', replacementId: 'push-up', scope: 'weekly' }));
  const reloaded = normalizeWorkspace(changed);
  assert.deepEqual(reloaded.weeklyPlans['gym:beginner'][6].exerciseIds, []);
  assert.equal(reloaded.weeklyPlans['gym:beginner'][6].rest, true);
  assert.equal(reloaded.weeklyPlans['gym:beginner'][6].duration, 0);
  assert.deepEqual(reloaded.weeklyPlans['gym:beginner'][0].exerciseTargets['incline-bench-press'], original.weeklyPlans['gym:beginner'][0].exerciseTargets['incline-bench-press']);
  assert.deepEqual(reloaded.history, original.history);
});
