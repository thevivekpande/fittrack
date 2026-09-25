import test from 'node:test';
import assert from 'node:assert/strict';
import { EXERCISES, dateKey, getWeekPlan } from '../src/data.js';
import { createEmptyWorkspace, normalizeWorkspace } from '../src/database.js';
import { getExerciseMuscles } from '../src/muscleData.js';
import { exerciseUnit } from '../src/exerciseSearch.js';
import { getRecompositionWeekPlan } from '../src/recompositionPlan.js';
import { adaptPlanForLocation, changeTrainingLocation } from '../src/trainingLocation.js';
import { applyWeeklySplit, estimateWorkoutMinutes, resolveBaseWeekPlans, resolveWeekPlans, saveDatePlan } from '../src/planning.js';
import { applyExerciseReplacement } from '../src/exerciseReplacement.js';

const catalog = new Map(EXERCISES.map(exercise => [exercise.id, exercise]));
const dates = Array.from({ length: 7 }, (_, index) => new Date(2026, 8, 7 + index, 12));
const nextDates = dates.map(date => new Date(date.getFullYear(), date.getMonth(), date.getDate() + 7, 12));
const levels = ['beginner', 'medium', 'experienced'];
const clone = value => JSON.parse(JSON.stringify(value));

function freeze(value) {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value);
    Object.values(value).forEach(freeze);
  }
  return value;
}

function customWeek(level = 'beginner') {
  const week = getWeekPlan(level, 'gym').map(plan => ({ ...plan, custom: true, muscleGroups: [...new Set(plan.exerciseIds.map(id => catalog.get(id).group))] }));
  week[0] = {
    ...week[0], title: 'My chest & back Monday', focus: 'Chest · Back',
    exerciseIds: ['bench-press', 'lat-pulldown', 'cable-row'],
    muscleGroups: ['Chest', 'Back'], sets: 4, reps: '8–12', duration: 43,
    rest: false, custom: true, customTitle: true,
    exerciseTargets: {
      'bench-press': { sets: 4, reps: '8–12', unit: 'reps', restSeconds: 90 },
      'lat-pulldown': { sets: 3, reps: '10', unit: 'reps', restSeconds: 60 },
      'cable-row': { sets: 2, reps: '12–15', unit: 'reps', restSeconds: 45 },
    },
    exerciseVideoLinks: { 'bench-press': { english: 'https://www.youtube.com/results?search_query=dumbbell+bench+press' } },
  };
  week[2] = { ...week[2], title: 'My Wednesday off', focus: 'Recovery', muscleGroups: ['Mobility'], rest: true, duration: 0, exerciseIds: [], exerciseTargets: {}, custom: true };
  return week;
}

function workspace(overrides = {}) {
  const weeklyPlans = { 'gym:beginner': customWeek() };
  return {
    ...createEmptyWorkspace(),
    level: 'beginner', trainingPlace: 'gym',
    profile: { name: 'Alex', goal: 3, fitnessGoal: 'build-muscle', gender: 'prefer-not-to-say' },
    weeklyPlans, planSources: {}, datePlanSources: {},
    history: [{ id: 'logged', date: '2026-09-06', title: 'Completed workout', duration: 28, calories: 100, exercises: 3, level: 'beginner' }],
    weights: [{ id: 'weight', date: '2026-09-06', value: 70 }],
    session: { id: 'unfinished', plan: { ...weeklyPlans['gym:beginner'][0], level: 'beginner', trainingPlace: 'gym' }, exerciseIndex: 1, completed: { 'bench-press': [0, 1], 'lat-pulldown': [], 'cable-row': [] }, elapsed: 120 },
    ...overrides,
  };
}

function options(state, weekDates = dates) {
  return { ...state, fitnessGoal: state.profile.fitnessGoal, weeklyGoal: state.profile.goal, gender: state.profile.gender, restDays: state.profile.restDays, dates: weekDates };
}

function assertSameSchedule(source, adapted, place) {
  assert.equal(adapted.length, source.length);
  source.forEach((plan, dayIndex) => {
    const result = adapted[dayIndex];
    for (const key of ['day', 'title', 'focus', 'rest']) assert.equal(result[key], plan[key], `${dayIndex}: ${key}`);
    assert.deepEqual(result.muscleGroups, plan.muscleGroups, `${dayIndex}: muscle split`);
    assert.equal(result.exerciseIds.length, plan.exerciseIds.length, `${dayIndex}: complete exercise count`);
    assert.equal(new Set(result.exerciseIds).size, result.exerciseIds.length, `${dayIndex}: no duplicate alternatives`);
    result.exerciseIds.forEach((id, exerciseIndex) => {
      const before = catalog.get(plan.exerciseIds[exerciseIndex]);
      const after = catalog.get(id);
      assert.ok(after, `Known exercise ${id}`);
      assert.ok(after.places.includes(place), `${id} is usable at ${place}`);
      assert.equal(after.group, before.group, `${before.id} → ${id}: same exercise group`);
      if (!['Cardio', 'Mobility'].includes(before.group)) {
        assert.ok(getExerciseMuscles(before).primary.some(muscle => getExerciseMuscles(after).primary.includes(muscle)), `${before.id} → ${id}: shared primary muscle`);
      }
    });
  });
}

test('changing location keeps a chosen chest/back Monday and exact gym plan on roundtrip', () => {
  const original = freeze(workspace({ weeklyPlans: { 'gym:beginner': customWeek(), 'home:beginner': getWeekPlan('beginner', 'home') } }));
  const expected = clone(original);
  const atHome = changeTrainingLocation(original, { trainingPlace: 'home' });
  assert.equal(atHome.trainingPlace, 'home');
  assert.equal(atHome.planSources.beginner, 'gym');
  const homeWeek = resolveWeekPlans(options(atHome));
  assertSameSchedule(original.weeklyPlans['gym:beginner'], homeWeek, 'home');
  assert.deepEqual(original, expected, 'the saved routine and original workspace are not mutated');
  for (const key of ['weeklyPlans', 'customPlans', 'history', 'weights', 'session']) assert.equal(atHome[key], original[key], `${key} kept intact`);

  const backAtGym = changeTrainingLocation(atHome, { trainingPlace: 'gym' });
  assert.equal(backAtGym.planSources.beginner, 'gym');
  assert.deepEqual(resolveWeekPlans(options(backAtGym)), original.weeklyPlans['gym:beginner']);
});

test('source metadata survives saved-workspace reload and keeps the same recurring plan', () => {
  const atHome = changeTrainingLocation(workspace(), { trainingPlace: 'home' });
  const reloaded = normalizeWorkspace(clone(atHome));
  assert.equal(reloaded.trainingPlace, 'home');
  assert.deepEqual(reloaded.planSources, atHome.planSources);
  assert.deepEqual(resolveWeekPlans(options(reloaded)), resolveWeekPlans(options(atHome)));
  assert.deepEqual(resolveWeekPlans(options(reloaded, nextDates)), resolveWeekPlans(options(atHome)));
  assert.deepEqual(resolveWeekPlans(options(changeTrainingLocation(reloaded, { trainingPlace: 'gym' }))), atHome.weeklyPlans['gym:beginner']);
  assert.deepEqual(reloaded.session, atHome.session, 'unfinished gym workout remains its original snapshot');
});

test('weekly source choices remain independent across all three experience levels', () => {
  const weeklyPlans = Object.fromEntries(levels.map(level => [`gym:${level}`, customWeek(level)]));
  const state = workspace({ weeklyPlans, planSources: Object.fromEntries(levels.map(level => [level, 'gym'])) });
  for (const level of levels) {
    const atHome = changeTrainingLocation({ ...state, level }, { trainingPlace: 'home', level });
    assertSameSchedule(weeklyPlans[`gym:${level}`], resolveWeekPlans(options(atHome)), 'home');
    assert.deepEqual(resolveWeekPlans(options(atHome, nextDates)), resolveWeekPlans(options(atHome)));
    assert.deepEqual(resolveWeekPlans(options(changeTrainingLocation(atHome, { trainingPlace: 'gym' }))), weeklyPlans[`gym:${level}`]);
    assert.deepEqual(atHome.planSources, state.planSources);
  }
});

test('one-date overrides follow the routine across locations without changing future weeks or the base split', () => {
  const monday = { ...customWeek()[0], title: 'One-time lighter Monday', sets: 2, exerciseIds: ['incline-bench-press', 'cable-row'], exerciseTargets: {}, exerciseVideoLinks: {} };
  const state = workspace({ customPlans: { 'gym:beginner:2026-09-07': monday } });
  const atHome = changeTrainingLocation(state, { trainingPlace: 'home' });
  assert.equal(resolveWeekPlans(options(atHome))[0].title, monday.title);
  assert.equal(resolveBaseWeekPlans(options(atHome))[0].title, state.weeklyPlans['gym:beginner'][0].title);
  assert.equal(resolveWeekPlans(options(atHome, nextDates))[0].title, state.weeklyPlans['gym:beginner'][0].title);
  assert.deepEqual(resolveWeekPlans(options(changeTrainingLocation(atHome, { trainingPlace: 'gym' })))[0], monday);
  assert.deepEqual(resolveWeekPlans(options(atHome))[2].exerciseIds, []);
  assert.equal(resolveWeekPlans(options(atHome))[2].duration, 0);
});

test('saving a date while at home pins only that date and preserves the gym weekly source after reload', () => {
  const atHome = changeTrainingLocation(workspace(), { trainingPlace: 'home' });
  const monday = { ...resolveWeekPlans(options(atHome))[0], title: 'Home session just this Monday', exerciseIds: ['push-up', 'superman'], muscleGroups: ['Chest', 'Back'], exerciseTargets: {}, exerciseVideoLinks: {}, custom: true, customTitle: true };
  const saved = saveDatePlan(atHome, { date: dates[0], plan: monday, trainingPlace: 'home', level: 'beginner' });
  assert.equal(saved.planSources.beginner, 'gym');
  assert.equal(saved.datePlanSources[`beginner:${dateKey(dates[0])}`], 'home');
  assert.deepEqual(saved.weeklyPlans, atHome.weeklyPlans);
  assert.deepEqual(resolveWeekPlans(options(saved))[0], monday);
  assert.equal(resolveWeekPlans(options(saved, nextDates))[0].title, atHome.weeklyPlans['gym:beginner'][0].title);
  const reloaded = normalizeWorkspace(clone(saved));
  assert.deepEqual(reloaded.datePlanSources, saved.datePlanSources);
  const atGym = changeTrainingLocation(reloaded, { trainingPlace: 'gym' });
  assert.deepEqual(resolveWeekPlans(options(atGym))[0], monday, 'home-compatible choices remain valid at the gym');
  assert.deepEqual(resolveBaseWeekPlans(options(atGym)), atHome.weeklyPlans['gym:beginner']);
});

test('saving a replacement weekly routine changes its source and removes only current/future date-source overrides for that level', () => {
  const atHome = changeTrainingLocation(workspace(), { trainingPlace: 'home' });
  const state = { ...atHome, datePlanSources: { 'beginner:2026-09-06': 'gym', 'beginner:2026-09-07': 'home', 'beginner:2026-10-02': 'gym', 'medium:2026-09-07': 'gym' } };
  const homeWeek = resolveBaseWeekPlans(options(state));
  homeWeek[0].title = 'My new home-first Monday';
  const saved = applyWeeklySplit(state, { trainingPlace: 'home', level: 'beginner', plans: homeWeek, fromDate: dates[0] });
  assert.equal(saved.planSources.beginner, 'home');
  assert.deepEqual(saved.datePlanSources, { 'beginner:2026-09-06': 'gym', 'medium:2026-09-07': 'gym' });
  assert.equal(resolveWeekPlans(options(changeTrainingLocation(saved, { trainingPlace: 'gym' })))[0].title, homeWeek[0].title);
  assert.equal(state.datePlanSources['beginner:2026-09-07'], 'home', 'the incoming source metadata was not mutated');
});

test('same-location adaptation returns an independent exact copy, including per-exercise targets and tutorials', () => {
  const plan = freeze(customWeek()[0]);
  const adapted = adaptPlanForLocation(plan, 'gym');
  assert.deepEqual(adapted, plan);
  assert.notEqual(adapted, plan);
  assert.notEqual(adapted.exerciseIds, plan.exerciseIds);
  assert.notEqual(adapted.muscleGroups, plan.muscleGroups);
  assert.notEqual(adapted.exerciseTargets['bench-press'], plan.exerciseTargets['bench-press']);
  assert.notEqual(adapted.exerciseVideoLinks['bench-press'], plan.exerciseVideoLinks['bench-press']);
});

test('substitutions keep compatible targets, recalculate duration, and remove machine-specific tutorials', () => {
  const plan = freeze(customWeek()[0]);
  const home = adaptPlanForLocation(plan, 'home');
  assertSameSchedule([plan], [home], 'home');
  assert.deepEqual(Object.keys(home.exerciseTargets).sort(), [...home.exerciseIds].sort());
  home.exerciseIds.forEach((id, index) => {
    assert.deepEqual(home.exerciseTargets[id], plan.exerciseTargets[plan.exerciseIds[index]]);
    assert.equal(home.exerciseTargets[id].unit, exerciseUnit(catalog.get(id)));
    assert.notEqual(home.exerciseTargets[id], plan.exerciseTargets[plan.exerciseIds[index]]);
  });
  assert.equal(home.duration, estimateWorkoutMinutes(home.exerciseIds.map(id => catalog.get(id)), home.sets, home.rest, home.exerciseTargets));
  for (const [id, links] of Object.entries(home.exerciseVideoLinks || {})) {
    assert.ok(home.exerciseIds.includes(id));
    assert.notDeepEqual(links, plan.exerciseVideoLinks['bench-press'], 'the old dumbbell tutorial must not describe a different home movement');
  }
});

test('the imported six-day program maps every exercise to home while preserving the full split and rest day', () => {
  for (const level of levels) {
    const original = freeze(getRecompositionWeekPlan(level));
    const home = original.map(plan => adaptPlanForLocation(plan, 'home'));
    assertSameSchedule(original, home, 'home');
    assert.equal(home.filter(plan => !plan.rest).length, 6);
    assert.equal(home[6].rest, true);
    assert.equal(home[6].duration, 0);
    home.forEach(plan => {
      assert.deepEqual(Object.keys(plan.exerciseTargets).sort(), [...plan.exerciseIds].sort());
      for (const id of plan.exerciseIds) assert.equal(plan.exerciseTargets[id].unit, exerciseUnit(catalog.get(id)), `${level}: ${id} unit`);
      for (const id of Object.keys(plan.exerciseVideoLinks || {})) assert.ok(plan.exerciseIds.includes(id), `${id} tutorial matches the adapted plan`);
    });
  }
});

test('an unusually repetitive custom workout explains merged home alternatives without losing its sets', () => {
  const ids = ['bicep-curl', 'hammer-curl', 'alternating-bicep-curl', 'cable-bicep-curl'];
  const source = freeze({
    day: 'Mon', title: 'My four curl variations', focus: 'Biceps', muscleGroups: ['Biceps'],
    rest: false, custom: true, customTitle: true, sets: 3, reps: '10', duration: 30,
    exerciseIds: ids,
    exerciseTargets: Object.fromEntries(ids.map(id => [id, { sets: 3, reps: '10', unit: 'reps', restSeconds: 60 }])),
  });
  const home = adaptPlanForLocation(source, 'home');
  assert.deepEqual(home.muscleGroups, source.muscleGroups);
  assert.equal(home.title, source.title);
  assert.equal(home.focus, source.focus);
  assert.equal(home.rest, false);
  assert.equal(new Set(home.exerciseIds).size, home.exerciseIds.length);
  assert.ok(home.exerciseIds.length < ids.length, 'matching home variations are shared rather than duplicated');
  assert.equal(Object.values(home.exerciseTargets).reduce((sum, target) => sum + target.sets, 0), 12);
  for (const id of home.exerciseIds) {
    assert.equal(catalog.get(id).group, 'Biceps');
    assert.ok(catalog.get(id).places.includes('home'));
    assert.ok(home.exerciseTargets[id].sets <= 20);
  }
  assert.match(home.locationNote, /combined|share|merged/i);
  assert.deepEqual(source.exerciseIds, ids);
});

function sourceWithDateEdits() {
  const monday = customWeek()[0];
  const datedMonday = { ...monday, title: 'One-off Monday with core', focus: 'Chest · Back · Core', muscleGroups: ['Chest', 'Back', 'Core'], exerciseIds: ['bench-press', 'lat-pulldown', 'plank'], exerciseTargets: {}, exerciseVideoLinks: {} };
  const futureTuesday = { ...monday, day: 'Tue', title: 'Extra biceps next Tuesday', focus: 'Biceps', muscleGroups: ['Biceps'], exerciseIds: ['bicep-curl'], exerciseTargets: { 'bicep-curl': { sets: 5, reps: '12', unit: 'reps', restSeconds: 45 } }, exerciseVideoLinks: {} };
  const homeWednesday = { ...monday, day: 'Wed', title: 'One home core session', focus: 'Core', muscleGroups: ['Core'], exerciseIds: ['plank'], exerciseTargets: {}, exerciseVideoLinks: {} };
  const state = workspace({
    weeklyPlans: { 'gym:beginner': customWeek(), 'home:beginner': getWeekPlan('beginner', 'home') },
    customPlans: {
      'gym:beginner:2026-08-31': clone(datedMonday),
      'gym:beginner:2026-09-07': clone(datedMonday),
      'gym:beginner:2026-09-14': { ...clone(datedMonday), title: 'Next Monday with core', exerciseIds: ['bench-press', 'lat-pulldown', 'crunch'] },
      'gym:beginner:2026-09-15': futureTuesday,
      'home:beginner:2026-09-14': { ...homeWednesday, day: 'Mon', title: 'Old unrelated home override' },
      'home:beginner:2026-09-16': homeWednesday,
    },
    datePlanSources: { 'beginner:2026-09-16': 'home' },
  });
  return changeTrainingLocation(state, { trainingPlace: 'home' });
}

function chestSwap(day) {
  const sourceId = day.exerciseIds.find(id => catalog.get(id).group === 'Chest');
  const replacementId = EXERCISES.find(exercise => exercise.group === 'Chest' && exercise.places.includes('home') && !day.exerciseIds.includes(exercise.id)).id;
  return { sourceId, replacementId, date: dates[0], trainingPlace: 'home', level: 'beginner' };
}

test('a date-only alternative uses the adapted canonical workout despite older saved home routines', () => {
  const original = freeze(sourceWithDateEdits());
  const current = resolveWeekPlans(options(original));
  const next = resolveWeekPlans(options(original, nextDates));
  const swap = chestSwap(current[0]);
  const saved = applyExerciseReplacement(original, { ...swap, scope: 'date' });
  const after = resolveWeekPlans(options(saved));
  assert.equal(saved.planSources.beginner, 'gym');
  assert.equal(saved.datePlanSources['beginner:2026-09-07'], 'home');
  assert.equal(saved.datePlanSources['beginner:2026-09-16'], 'home');
  assert.equal(saved.weeklyPlans, original.weeklyPlans);
  assert.deepEqual(after[0].exerciseIds, current[0].exerciseIds.map(id => id === swap.sourceId ? swap.replacementId : id));
  assert.equal(after[0].title, 'One-off Monday with core');
  assert.equal(after[0].focus, current[0].focus);
  assert.deepEqual(after[0].muscleGroups, current[0].muscleGroups);
  assert.deepEqual(after.slice(1), current.slice(1));
  assert.deepEqual(resolveWeekPlans(options(saved, nextDates)), next, 'a one-date alternative leaves every future occurrence untouched');
  assert.equal(saved.customPlans['gym:beginner:2026-09-07'], original.customPlans['gym:beginner:2026-09-07']);
  for (const key of ['history', 'weights', 'session']) assert.equal(saved[key], original[key]);
  const reloaded = normalizeWorkspace(clone(saved));
  assert.deepEqual(resolveWeekPlans(options(reloaded)), after);
  const atGym = changeTrainingLocation(reloaded, { trainingPlace: 'gym' });
  assert.deepEqual(resolveWeekPlans(options(atGym))[0], after[0]);
  assert.deepEqual(resolveBaseWeekPlans(options(atGym)), original.weeklyPlans['gym:beginner']);
});

test('a recurring alternative materializes the displayed split and date edits instead of reviving an old home plan', () => {
  const original = freeze(sourceWithDateEdits());
  const base = resolveBaseWeekPlans(options(original));
  const current = resolveWeekPlans(options(original));
  const next = resolveWeekPlans(options(original, nextDates));
  const swap = chestSwap(base[0]);
  const saved = applyExerciseReplacement(original, { ...swap, scope: 'weekly' });
  const afterBase = resolveBaseWeekPlans(options(saved));
  const after = resolveWeekPlans(options(saved));
  const afterNext = resolveWeekPlans(options(saved, nextDates));
  assert.equal(saved.planSources.beginner, 'home');
  assert.deepEqual(afterBase[0].exerciseIds, base[0].exerciseIds.map(id => id === swap.sourceId ? swap.replacementId : id));
  assert.equal(afterBase[0].title, base[0].title);
  assert.equal(afterBase[0].focus, base[0].focus);
  assert.deepEqual(afterBase.slice(1), base.slice(1), 'all other displayed weekdays survive materialization exactly');
  for (const [before, changed] of [[current, after], [next, afterNext]]) {
    assert.deepEqual(changed[0].exerciseIds, before[0].exerciseIds.map(id => id === swap.sourceId ? swap.replacementId : id));
    assert.equal(changed[0].title, before[0].title, 'date-specific titles remain date-specific');
    assert.equal(changed[0].focus, before[0].focus);
    assert.deepEqual(changed[0].muscleGroups, before[0].muscleGroups);
    assert.deepEqual(changed.slice(1), before.slice(1), 'future date edits on other weekdays are preserved');
  }
  assert.equal(afterNext[1].title, 'Extra biceps next Tuesday');
  assert.equal(afterNext[2].title, 'One home core session');
  for (const date of ['2026-09-07', '2026-09-14', '2026-09-15', '2026-09-16']) assert.equal(saved.datePlanSources[`beginner:${date}`], 'home');
  const pastBefore = adaptPlanForLocation(original.customPlans['gym:beginner:2026-08-31'], 'home');
  assert.deepEqual(saved.customPlans['home:beginner:2026-08-31'], pastBefore, 'earlier dates retain their original exercises');
  assert.equal(saved.weeklyPlans['gym:beginner'], original.weeklyPlans['gym:beginner']);
  for (const key of ['history', 'weights', 'session']) assert.equal(saved[key], original[key]);
  const reloaded = normalizeWorkspace(clone(saved));
  assert.deepEqual(resolveWeekPlans(options(reloaded, nextDates)), afterNext);
  const atGym = changeTrainingLocation(reloaded, { trainingPlace: 'gym' });
  assert.deepEqual(resolveBaseWeekPlans(options(atGym)), afterBase, 'an explicit weekly edit becomes the routine in both locations');
  assert.deepEqual(resolveWeekPlans(options(atGym, nextDates)), afterNext);
});

test('a beginner location switch does not pin unrelated legacy levels to the gym', () => {
  const experiencedHome = getWeekPlan('experienced', 'home').map(plan => ({ ...plan, custom: true, muscleGroups: [...new Set(plan.exerciseIds.map(id => catalog.get(id).group))] }));
  experiencedHome[0] = { ...experiencedHome[0], title: 'My saved experienced home Monday', customTitle: true };
  const original = freeze(workspace({ weeklyPlans: { 'gym:beginner': customWeek(), 'home:experienced': experiencedHome } }));
  const atHome = changeTrainingLocation(original, { trainingPlace: 'home' });
  assert.equal(atHome.planSources.beginner, 'gym');
  assert.equal(atHome.planSources.medium, undefined);
  assert.equal(atHome.planSources.experienced, undefined);
  const experienced = changeTrainingLocation(atHome, { trainingPlace: 'home', level: 'experienced' });
  assert.equal(experienced.planSources.experienced, 'home');
  assert.deepEqual(resolveWeekPlans(options(experienced)), experiencedHome);
  assert.deepEqual(resolveWeekPlans(options(normalizeWorkspace(clone(experienced)))), experiencedHome);
  assert.equal(experienced.weeklyPlans, original.weeklyPlans);
  assert.equal(experienced.session, original.session);
});

test('a recurring gym edit also updates a linked future home override when the weekly source is already gym', () => {
  const gymWeek = customWeek();
  gymWeek[0] = {
    ...gymWeek[0], title: 'My core Monday', focus: 'Core', muscleGroups: ['Core'], exerciseIds: ['plank'],
    exerciseTargets: { plank: { sets: 3, reps: '30', unit: 'sec', restSeconds: 45 } }, exerciseVideoLinks: {},
  };
  const futureHome = { ...gymWeek[0], title: 'Next Monday at home', focus: 'Core · Chest', muscleGroups: ['Core', 'Chest'], exerciseIds: ['plank', 'push-up'] };
  const original = freeze(workspace({
    weeklyPlans: { 'gym:beginner': gymWeek }, planSources: { beginner: 'gym' },
    datePlanSources: { 'beginner:2026-09-14': 'home' },
    customPlans: {
      'home:beginner:2026-09-14': futureHome,
      'gym:beginner:2026-09-14': { ...gymWeek[0], title: 'Older gym-only edit', exerciseIds: ['dead-bug'], exerciseTargets: {} },
    },
  }));
  const before = resolveWeekPlans(options(original, nextDates));
  assert.deepEqual(before[0].exerciseIds, ['plank', 'push-up']);
  const saved = applyExerciseReplacement(original, { sourceId: 'plank', replacementId: 'crunch', date: dates[0], trainingPlace: 'gym', level: 'beginner', scope: 'weekly' });
  assert.equal(saved.planSources.beginner, 'gym');
  assert.equal(saved.datePlanSources['beginner:2026-09-14'], 'gym');
  assert.deepEqual(resolveBaseWeekPlans(options(saved))[0].exerciseIds, ['crunch']);
  const next = resolveWeekPlans(options(saved, nextDates));
  assert.deepEqual(next[0].exerciseIds, ['crunch', 'push-up']);
  assert.equal(next[0].title, futureHome.title);
  assert.equal(next[0].focus, futureHome.focus);
  assert.deepEqual(next[0].muscleGroups, futureHome.muscleGroups);
  assert.deepEqual(next.slice(1), before.slice(1));
  const reloaded = normalizeWorkspace(clone(saved));
  assert.deepEqual(resolveWeekPlans(options(reloaded, nextDates)), next);
  assert.deepEqual(resolveWeekPlans(options(changeTrainingLocation(reloaded, { trainingPlace: 'home' }), nextDates))[0], next[0]);
  assert.deepEqual(original.customPlans['home:beginner:2026-09-14'].exerciseIds, ['plank', 'push-up']);
  for (const key of ['history', 'weights', 'session']) assert.equal(saved[key], original[key]);
});
