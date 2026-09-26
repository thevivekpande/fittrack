import { EXERCISES, LEVELS, dateKey } from './data.js';
import { exerciseUnit } from './exerciseSearch.js';
import { getExerciseTarget, normalizeExerciseTargets } from './workoutTargets.js';
import { materializePlanLocation, resolveBaseWeekPlans, saveDatePlan, updatePlanExercises } from './planning.js';
import { adaptPlanForLocation } from './trainingLocation.js';

export const REPLACEMENT_TARGET_NOTE = 'Matching units keep your target. A different unit uses an editable starting target.';

const catalog = new Map(EXERCISES.map(exercise => [exercise.id, exercise]));
const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const places = new Set(['home', 'gym']);
const levels = new Set(LEVELS.map(level => level.id));
const isObject = value => value !== null && typeof value === 'object' && !Array.isArray(value);

function validatePlanExercises(plan, trainingPlace = plan?.trainingPlace) {
  if (!isObject(plan) || !Array.isArray(plan.exerciseIds)) throw new Error('This workout is unavailable. Reopen the plan and try again.');
  if (new Set(plan.exerciseIds).size !== plan.exerciseIds.length) throw new Error('This workout contains duplicate exercises. Edit the plan before replacing an exercise.');
  if (plan.exerciseIds.some(id => !catalog.has(id))) throw new Error('This workout contains an unavailable exercise. Edit the plan before making this replacement.');
  if (trainingPlace !== undefined && trainingPlace !== null) {
    if (!places.has(trainingPlace)) throw new Error('Choose At home or At the gym before replacing an exercise.');
    if (plan.exerciseIds.some(id => !catalog.get(id).places.includes(trainingPlace))) throw new Error('This exercise is not available for your training location.');
  }
}

function replacementTarget(plan, source, replacement) {
  const target = getExerciseTarget(plan, source);
  const unit = exerciseUnit(replacement);
  if (target.unit === unit) return { ...target };
  return getExerciseTarget({
    sets: plan.sets,
    reps: unit === 'sec' ? '20–30' : '8–12',
    restSeconds: unit === 'sec' ? 45 : 60,
  }, replacement);
}

/** Replace one slot while keeping the rest of the workout's choices intact. */
export function swapExerciseInPlan(plan, sourceId, replacementId) {
  validatePlanExercises(plan);
  if (!catalog.has(sourceId) || !catalog.has(replacementId)) throw new Error('Choose an exercise from the exercise library.');
  if (!plan.exerciseIds.length) throw new Error('This is a complete rest day. Add a workout before replacing an exercise.');
  if (!plan.exerciseIds.includes(sourceId)) throw new Error('That exercise is no longer in this workout. Reopen the plan and try again.');
  if (sourceId === replacementId) throw new Error('Choose a different exercise to replace this one.');
  if (plan.exerciseIds.includes(replacementId)) throw new Error('That exercise is already in this workout. Choose another alternative.');

  const source = catalog.get(sourceId);
  const replacement = catalog.get(replacementId);
  const exerciseIds = plan.exerciseIds.map(id => id === sourceId ? replacementId : id);
  validatePlanExercises({ ...plan, exerciseIds });
  const exerciseTargets = {
    ...normalizeExerciseTargets(plan.exerciseTargets, exerciseIds),
    [replacementId]: replacementTarget(plan, source, replacement),
  };
  const exerciseVideoLinks = Object.fromEntries(exerciseIds.flatMap(id => {
    // Never transfer the source exercise's video searches to its replacement.
    const links = id === replacementId ? replacement.videoLinks : plan.exerciseVideoLinks?.[id];
    return isObject(links) ? [[id, { ...links }]] : [];
  }));
  const updated = updatePlanExercises({ ...plan, exerciseTargets, exerciseVideoLinks }, exerciseIds.map(id => catalog.get(id)), EXERCISES);
  // Source-program names identify the routine; its updated focus/groups still
  // describe the actual exercise choices. Explicit personal names are already
  // preserved by updatePlanExercises.
  if (plan.programId && plan.title) updated.title = plan.title;
  return updated;
}

function calendarDate(value) {
  const key = value instanceof Date && Number.isFinite(value.getTime()) ? dateKey(value) : value;
  if (typeof key !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(key)) throw new Error('Choose a valid workout date.');
  const parsed = new Date(`${key}T12:00:00`);
  if (!Number.isFinite(parsed.getTime()) || dateKey(parsed) !== key) throw new Error('Choose a valid workout date.');
  return { key, index: (parsed.getDay() + 6) % 7 };
}

function getBaseWeek(state, scopeKey, basePlans, trainingPlace, level) {
  const source = state.planSources?.[level] || trainingPlace;
  const week = source !== trainingPlace
    ? resolveBaseWeekPlans({ ...state, level, trainingPlace, fitnessGoal: state.profile?.fitnessGoal, weeklyGoal: state.profile?.goal, gender: state.profile?.gender, restDays: state.profile?.restDays })
    : state.weeklyPlans?.[scopeKey] || basePlans;
  if (!Array.isArray(week) || week.length !== 7 || new Set(week.map(plan => plan?.day)).size !== 7
    || week.some(plan => !days.includes(plan?.day))) throw new Error('Your weekly plan has changed. Reopen it before replacing an exercise.');
  const ordered = days.map(day => week.find(plan => plan.day === day));
  for (const plan of ordered) {
    validatePlanExercises(plan, trainingPlace);
    if (!plan.exerciseIds.length && !plan.rest) throw new Error('A training day is empty. Edit the weekly plan before replacing an exercise.');
  }
  return ordered;
}

function swapForPlace(plan, sourceId, replacementId, trainingPlace) {
  validatePlanExercises(plan, trainingPlace);
  if (!catalog.get(replacementId)?.places.includes(trainingPlace)) throw new Error('Choose an alternative available for your training location.');
  return swapExerciseInPlan(plan, sourceId, replacementId);
}

/** Date changes touch one override. Recurring changes touch one weekday only. */
export function applyExerciseReplacement(state, { sourceId, replacementId, date, trainingPlace, level, scope = 'date', basePlans }) {
  if (!isObject(state)) throw new Error('Your saved workspace is unavailable. Reload and try again.');
  if (!places.has(trainingPlace) || !levels.has(level)) throw new Error('Choose your training location and experience level first.');
  if (scope !== 'date' && scope !== 'weekly') throw new Error('Choose this date only or a recurring weekly replacement.');
  const selected = calendarDate(date);
  if (scope === 'weekly') state = materializePlanLocation(state, { trainingPlace, level, basePlans });
  const scopeKey = `${trainingPlace}:${level}`;
  const prefix = `${scopeKey}:`;
  const key = `${prefix}${selected.key}`;
  const week = getBaseWeek(state, scopeKey, basePlans, trainingPlace, level);
  const baseDay = week[selected.index];
  const overrides = state.customPlans || {};

  if (scope === 'date') {
    const dateSource = state.datePlanSources?.[`${level}:${selected.key}`] || state.planSources?.[level] || trainingPlace;
    const override = overrides[`${dateSource}:${level}:${selected.key}`];
    const current = adaptPlanForLocation({ ...baseDay, ...override }, trainingPlace, override ? dateSource : trainingPlace);
    return saveDatePlan(state, { date: selected.key, plan: swapForPlace(current, sourceId, replacementId, trainingPlace), trainingPlace, level });
  }

  if (!baseDay.exerciseIds.includes(sourceId)) throw new Error('This exercise is only in your date-specific workout. Choose this date only, or edit the recurring weekly plan first.');
  const changedDay = swapForPlace(baseDay, sourceId, replacementId, trainingPlace);
  const customPlans = { ...overrides };
  for (const [overrideKey, override] of Object.entries(overrides)) {
    if (!overrideKey.startsWith(prefix)) continue;
    const overrideDate = overrideKey.slice(prefix.length);
    if (overrideDate < selected.key) continue;
    let occurrence;
    try { occurrence = calendarDate(overrideDate); } catch { continue; }
    if (occurrence.index !== selected.index) continue;
    const current = { ...baseDay, ...override };
    if (!current.exerciseIds?.includes(sourceId)) {
      if (overrideKey === key) throw new Error('That exercise is no longer in this date’s workout. Reopen the plan and try again.');
      continue;
    }
    if (current.exerciseIds.includes(replacementId)) throw new Error(`The workout on ${overrideDate} already includes that alternative. Choose this date only, another exercise, or edit that date first.`);
    customPlans[overrideKey] = swapForPlace(current, sourceId, replacementId, trainingPlace);
  }
  return {
    ...state,
    weeklyPlans: { ...state.weeklyPlans, [scopeKey]: week.map((plan, index) => index === selected.index ? changedDay : plan) },
    customPlans,
  };
}

/** An in-progress swap is isolated from saved plans and completed activity. */
export function replaceSessionExercise(session, sourceId, replacementId) {
  if (!isObject(session) || !isObject(session.plan) || !isObject(session.completed)) throw new Error('This workout session is unavailable. Reopen it and try again.');
  if (!Number.isInteger(session.exerciseIndex) || session.exerciseIndex < 0 || session.exerciseIndex >= session.plan.exerciseIds?.length) throw new Error('Reopen the active workout before replacing an exercise.');
  if (Array.isArray(session.completed[sourceId]) && session.completed[sourceId].length) throw new Error('Uncheck the completed sets for this exercise before replacing it.');
  const plan = swapExerciseInPlan(session.plan, sourceId, replacementId);
  const completed = Object.fromEntries(Object.entries(session.completed).filter(([id]) => id !== sourceId && id !== replacementId).map(([id, sets]) => [id, Array.isArray(sets) ? [...sets] : sets]));
  completed[replacementId] = [];
  return { ...session, plan, completed };
}
