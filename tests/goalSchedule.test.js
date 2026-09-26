import test from 'node:test';
import assert from 'node:assert/strict';
import { EXERCISES } from '../src/data.js';
import { getDefaultRestDays, getSuggestedWeekPlan } from '../src/goals.js';
import { getRecompositionWeekPlan } from '../src/recompositionPlan.js';
import { changeTrainingLocation } from '../src/trainingLocation.js';
import { matchesWeeklySchedule, rescheduleWeekPlans, resolveBaseWeekPlans, resolveWeekPlans, updateTrainingGoal } from '../src/planning.js';

const dates = Array.from({ length: 7 }, (_, index) => new Date(2026, 8, 7 + index, 12));
const nextDates = dates.map(date => new Date(date.getFullYear(), date.getMonth(), date.getDate() + 7, 12));
const dayNames = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const catalog = new Map(EXERCISES.map(exercise => [exercise.id, exercise]));

function freeze(value) {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value);
    Object.values(value).forEach(freeze);
  }
  return value;
}

function customWeek() {
  const plans = getRecompositionWeekPlan('beginner');
  plans[0] = { ...plans[0], title: 'My chest session', custom: true, customTitle: true };
  plans[0].exerciseTargets[plans[0].exerciseIds[0]].sets = 4;
  return plans;
}

function workspace(overrides = {}) {
  const week = customWeek();
  return {
    profile: { name: 'Alex', goal: 6, fitnessGoal: 'body-recomposition', gender: 'prefer-not-to-say', restDays: [6] },
    trainingPlace: 'gym', level: 'beginner',
    weeklyPlans: { 'gym:beginner': week }, customPlans: {},
    planSources: { beginner: 'gym' }, datePlanSources: {},
    history: [{ id: 'logged', date: '2026-09-06', title: 'Completed workout', duration: 28 }],
    weights: [{ id: 'weight', date: '2026-09-06', value: 70 }],
    session: { id: 'unfinished', plan: { ...week[0], trainingPlace: 'gym', level: 'beginner' }, elapsed: 90, exerciseIndex: 1 },
    ...overrides,
  };
}

function options(state, weekDates = dates) {
  return { ...state, fitnessGoal: state.profile.fitnessGoal, weeklyGoal: state.profile.goal,
    gender: state.profile.gender, restDays: state.profile.restDays, dates: weekDates };
}

function updateOptions(overrides = {}) {
  return { fitnessGoal: 'body-recomposition', gender: 'prefer-not-to-say', weeklyGoal: 4,
    restDays: [2, 4, 6], applySchedule: true, trainingPlace: 'gym', level: 'beginner', fromDate: dates[0], ...overrides };
}

function assertSchedule(plans, count, restDays) {
  assert.equal(plans.length, 7);
  assert.deepEqual(plans.map(plan => plan.day), dayNames);
  assert.equal(plans.filter(plan => !plan.rest).length, count);
  assert.deepEqual(plans.flatMap((plan, index) => plan.rest ? [index] : []), restDays);
  for (const plan of plans) {
    if (plan.rest) {
      assert.deepEqual(plan.exerciseIds, []);
      assert.equal(plan.duration, 0);
    } else {
      assert.ok(plan.exerciseIds.length > 0);
      assert.ok(plan.exerciseIds.every(id => catalog.has(id)));
    }
  }
}

test('schedule matching checks actual empty rest days and actual workouts rather than only the target count', () => {
  const plans = getSuggestedWeekPlan({ fitnessGoal: 'general-fitness', level: 'beginner', trainingPlace: 'gym', weeklyGoal: 3, restDays: [1, 3, 5, 6] });
  assert.equal(matchesWeeklySchedule(plans, 3, [6, 5, 3, 1]), true);
  assert.equal(matchesWeeklySchedule(plans, 3, [0, 2, 4, 6]), false);
  assert.equal(matchesWeeklySchedule(plans, 3, [1, 1, 5, 6]), false);
  assert.equal(matchesWeeklySchedule(plans.slice(1), 3, [1, 3, 5, 6]), false);
  assert.equal(matchesWeeklySchedule(plans.map((plan, index) => index === 1 ? { ...plan, exerciseIds: ['standing-reach'] } : plan), 3, [1, 3, 5, 6]), false);
  assert.equal(matchesWeeklySchedule(plans.map((plan, index) => index === 0 ? { ...plan, exerciseIds: [] } : plan), 3, [1, 3, 5, 6]), false);
});

test('six to four days while viewing home preserves canonical gym exercises, targets, order, and round trips', () => {
  const original = freeze(workspace({ trainingPlace: 'home' }));
  const snapshot = structuredClone(original);
  const updated = updateTrainingGoal(original, updateOptions({ trainingPlace: 'home' }));
  assert.equal(updated.profile.goal, 4);
  assert.equal(updated.trainingPlace, 'home');
  assert.equal(updated.planSources.beginner, 'gym');
  const saved = updated.weeklyPlans['gym:beginner'];
  assertSchedule(saved, 4, [2, 4, 6]);
  const savedWorkouts = saved.filter(plan => !plan.rest);
  original.weeklyPlans['gym:beginner'].slice(0, 4).forEach((plan, index) => {
    assert.deepEqual(savedWorkouts[index], { ...plan, day: savedWorkouts[index].day });
    assert.notEqual(savedWorkouts[index].exerciseTargets, plan.exerciseTargets);
    assert.notEqual(savedWorkouts[index].exerciseVideoLinks, plan.exerciseVideoLinks);
  });
  assertSchedule(resolveWeekPlans(options(updated)), 4, [2, 4, 6]);
  for (const plan of resolveWeekPlans(options(updated))) {
    assert.ok(plan.exerciseIds.every(id => catalog.get(id).places.includes('home')));
  }
  const atGym = changeTrainingLocation(updated, { trainingPlace: 'gym' });
  assert.deepEqual(resolveWeekPlans(options(atGym)), saved);
  assert.deepEqual(resolveWeekPlans(options(atGym, nextDates)), saved);
  assert.deepEqual(original, snapshot);
});

test('increasing training days retains saved workouts and fills extra days from the new goal suggestions', () => {
  const originalPlans = getSuggestedWeekPlan({ fitnessGoal: 'build-muscle', level: 'medium', trainingPlace: 'gym', weeklyGoal: 2, restDays: [0, 2, 3, 5, 6] });
  originalPlans[1] = { ...originalPlans[1], title: 'My first saved workout', custom: true, customTitle: true };
  originalPlans[4] = { ...originalPlans[4], title: 'My second saved workout', custom: true, customTitle: true };
  const original = freeze(workspace({ level: 'medium', weeklyPlans: { 'gym:medium': originalPlans }, planSources: { medium: 'gym' },
    profile: { name: 'Alex', goal: 2, fitnessGoal: 'build-muscle', gender: 'prefer-not-to-say', restDays: [0, 2, 3, 5, 6] } }));
  const restDays = [1, 5];
  const updated = updateTrainingGoal(original, updateOptions({ fitnessGoal: 'core-strength', weeklyGoal: 5, restDays, level: 'medium' }));
  const resolved = resolveWeekPlans(options(updated));
  assertSchedule(resolved, 5, restDays);
  const workouts = resolved.filter(plan => !plan.rest);
  assert.deepEqual(workouts.slice(0, 2).map(plan => plan.title), ['My first saved workout', 'My second saved workout']);
  const suggestions = getSuggestedWeekPlan({ fitnessGoal: 'core-strength', gender: original.profile.gender, level: 'medium', trainingPlace: 'gym', weeklyGoal: 5, restDays }).filter(plan => !plan.rest);
  for (let index = 2; index < 5; index += 1) assert.deepEqual(workouts[index], suggestions[index]);
  assert.deepEqual(resolveWeekPlans(options(updated, nextDates)), resolved);
});

test('adjusting while viewing gym also preserves a home canonical routine and its exact home return', () => {
  const homeWeek = getSuggestedWeekPlan({ fitnessGoal: 'build-muscle', level: 'beginner', trainingPlace: 'home', weeklyGoal: 3, restDays: [1, 3, 5, 6] });
  homeWeek[0] = { ...homeWeek[0], title: 'My home session', custom: true, customTitle: true };
  const original = freeze(workspace({ weeklyPlans: { 'home:beginner': homeWeek }, planSources: { beginner: 'home' },
    profile: { name: 'Alex', goal: 3, fitnessGoal: 'build-muscle', gender: 'prefer-not-to-say', restDays: [1, 3, 5, 6] } }));
  const restDays = [0, 2, 4, 5, 6];
  const updated = updateTrainingGoal(original, updateOptions({ weeklyGoal: 2, restDays }));
  assert.equal(updated.planSources.beginner, 'home');
  assert.equal(updated.weeklyPlans['gym:beginner'], undefined);
  assertSchedule(resolveWeekPlans(options(updated)), 2, restDays);
  const atHome = changeTrainingLocation(updated, { trainingPlace: 'home' });
  const resolved = resolveWeekPlans(options(atHome));
  assertSchedule(resolved, 2, restDays);
  assert.deepEqual(resolved, updated.weeklyPlans['home:beginner']);
  assert.deepEqual(resolved.filter(plan => !plan.rest).map(plan => plan.exerciseIds), homeWeek.filter(plan => !plan.rest).slice(0, 2).map(plan => plan.exerciseIds));
});

test('schedule adjustment clears extra current and future dated sessions across locations but preserves past and other levels', () => {
  const extra = { ...customWeek()[0], title: 'Extra dated workout' };
  const original = freeze(workspace({ trainingPlace: 'home', weeklyPlans: {},
    customPlans: {
      'gym:beginner:2026-09-06': { ...extra, title: 'Past gym edit' },
      'home:beginner:2026-09-05': { ...extra, title: 'Past home edit' },
      'gym:beginner:2026-09-09': extra,
      'home:beginner:2026-09-16': extra,
      'gym:medium:2026-09-09': { ...extra, title: 'Other level' },
    },
    datePlanSources: { 'beginner:2026-09-05': 'home', 'beginner:2026-09-09': 'gym', 'beginner:2026-09-16': 'home', 'medium:2026-09-09': 'gym' },
    planSources: { beginner: 'gym', medium: 'gym' },
  }));
  assert.equal(resolveWeekPlans(options(original))[2].title, extra.title);
  const updated = updateTrainingGoal(original, updateOptions({ trainingPlace: 'home' }));
  for (const weekDates of [dates, nextDates]) assertSchedule(resolveWeekPlans(options(updated, weekDates)), 4, [2, 4, 6]);
  assert.equal(updated.customPlans['gym:beginner:2026-09-09'], undefined);
  assert.equal(updated.datePlanSources['beginner:2026-09-09'], undefined);
  assert.equal(updated.datePlanSources['beginner:2026-09-16'], undefined);
  for (const key of ['gym:beginner:2026-09-06', 'home:beginner:2026-09-05', 'gym:medium:2026-09-09']) {
    assert.equal(updated.customPlans[key], original.customPlans[key]);
  }
  for (const key of ['beginner:2026-09-05', 'medium:2026-09-09']) assert.equal(updated.datePlanSources[key], original.datePlanSources[key]);
  for (const key of ['history', 'weights', 'session']) assert.equal(updated[key], original[key]);
  assert.equal(updated.planSources.medium, 'gym');
});

test('saved routines for another level and inactive location remain intact after adjusting the canonical schedule', () => {
  const original = freeze(workspace({ weeklyPlans: { 'gym:beginner': customWeek(), 'home:beginner': customWeek(), 'gym:experienced': customWeek() }, planSources: { beginner: 'gym', experienced: 'gym' } }));
  const updated = updateTrainingGoal(original, updateOptions());
  assert.equal(updated.weeklyPlans['home:beginner'], original.weeklyPlans['home:beginner']);
  assert.equal(updated.weeklyPlans['gym:experienced'], original.weeklyPlans['gym:experienced']);
  assert.equal(updated.planSources.experienced, 'gym');
  for (const key of ['history', 'weights', 'session']) assert.equal(updated[key], original[key]);
});

test('explicit keep saves preferences without changing a saved week, dated edits, or progress', () => {
  const original = freeze(workspace({ customPlans: { 'gym:beginner:2026-09-09': { ...customWeek()[2], title: 'My dated change' } }, datePlanSources: { 'beginner:2026-09-09': 'gym' } }));
  const before = resolveWeekPlans(options(original));
  const updated = updateTrainingGoal(original, updateOptions({ applySchedule: false, applySuggestion: false, keepSchedule: true }));
  assert.equal(updated.profile.goal, 4);
  assert.deepEqual(updated.profile.restDays, [2, 4, 6]);
  assert.deepEqual(resolveWeekPlans(options(updated)), before);
  for (const key of ['weeklyPlans', 'customPlans', 'planSources', 'datePlanSources', 'history', 'weights', 'session']) assert.equal(updated[key], original[key]);
});

test('explicit keep also preserves a dynamic base week when the only customization is a dated exercise edit', () => {
  const original = freeze(workspace({ weeklyPlans: {}, customPlans: { 'gym:beginner:2026-09-09': { ...customWeek()[2], title: 'My dated workout' } }, datePlanSources: { 'beginner:2026-09-09': 'gym' } }));
  const before = resolveWeekPlans(options(original));
  const futureBefore = resolveWeekPlans(options(original, nextDates));
  const updated = updateTrainingGoal(original, updateOptions({ applySchedule: false, applySuggestion: false, keepSchedule: true }));
  assert.equal(updated.profile.goal, 4);
  assert.deepEqual(resolveWeekPlans(options(updated)), before);
  assert.deepEqual(resolveWeekPlans(options(updated, nextDates)), futureBefore);
  assert.equal(updated.customPlans, original.customPlans);
  assert.equal(updated.datePlanSources, original.datePlanSources);
  assert.equal(updated.session, original.session);
});

test('every valid one-to-seven-day rest pattern produces exact empty rest days and retains workout order without mutation', () => {
  const original = freeze(customWeek());
  const snapshot = structuredClone(original);
  for (let mask = 0; mask < 127; mask += 1) {
    const restDays = dayNames.flatMap((_, index) => mask & (1 << index) ? [index] : []);
    const weeklyGoal = 7 - restDays.length;
    const suggestions = freeze(getSuggestedWeekPlan({ fitnessGoal: 'general-fitness', level: 'beginner', trainingPlace: 'gym', weeklyGoal, restDays }));
    const adjusted = rescheduleWeekPlans(original, { weeklyGoal, restDays, suggestedPlans: suggestions });
    assertSchedule(adjusted, weeklyGoal, restDays);
    assert.equal(matchesWeeklySchedule(adjusted, weeklyGoal, restDays), true);
    const workouts = adjusted.filter(plan => !plan.rest);
    original.filter(plan => !plan.rest).slice(0, weeklyGoal).forEach((plan, index) => {
      assert.equal(workouts[index].title, plan.title);
      assert.deepEqual(workouts[index].exerciseIds, plan.exerciseIds);
      assert.deepEqual(workouts[index].exerciseTargets, plan.exerciseTargets);
    });
  }
  assert.deepEqual(original, snapshot);
  assert.throws(() => rescheduleWeekPlans(original, { weeklyGoal: 4, restDays: [6], suggestedPlans: original }), /rest days/i);
});

test('omitted stale rest preferences receive a valid default when applying a new count', () => {
  const original = freeze(workspace());
  const updated = updateTrainingGoal(original, updateOptions({ weeklyGoal: 2, restDays: undefined }));
  const expectedRest = getDefaultRestDays(2, 'beginner');
  assert.deepEqual(updated.profile.restDays, expectedRest);
  assertSchedule(resolveBaseWeekPlans(options(updated)), 2, expectedRest);
});
