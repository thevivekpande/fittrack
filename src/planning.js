import { dateKey, getWeekDates } from './data.js';
import { applyRestDaySchedule, getDefaultRestDays, getSuggestedWeekPlan, normalizeRestDays } from './goals.js';
import { cloneExerciseTargets, getExerciseTarget, normalizeExerciseTargets } from './workoutTargets.js';
import { estimateTargetSeconds } from './recompositionPlan.js';
import { adaptPlanForLocation } from './trainingLocation.js';

export const MAX_PLAN_EXERCISES = 12;

export function estimateWorkoutMinutes(exercises, sets = 3, rest = false, exerciseTargets) {
  if (!exercises.length && rest) return 0;
  const targets = normalizeExerciseTargets(exerciseTargets, exercises.map(exercise => exercise.id));
  const hasTargets = Object.keys(targets).length > 0;
  const seconds = exercises.reduce((total, exercise) => {
    if (targets[exercise.id]) return total + estimateTargetSeconds(targets[exercise.id]);
    const target = getExerciseTarget({ sets, exerciseTargets: targets }, exercise);
    if (target.unit === 'min') {
      const bounds = target.reps.split('–').map(Number);
      const amount = (bounds[0] + (bounds[1] ?? bounds[0])) / 2;
      return total + amount * target.sets * 60 + Math.max(0, target.sets - 1) * target.restSeconds;
    }
    const duration = Number.isFinite(exercise.duration) ? Math.max(0, exercise.duration) : 0;
    const multiplier = rest ? 60 : Math.max(0, Number(sets) || 0) * 20;
    return total + duration * multiplier;
  }, 0);
  return Math.max(1, hasTargets ? Math.ceil(seconds / 60) : Math.round(seconds / 60));
}

function clonePlanDetails(plan) {
  const exerciseIds = [...plan.exerciseIds];
  const result = { ...plan, exerciseIds, ...(plan.muscleGroups && { muscleGroups: [...plan.muscleGroups] }) };
  if (plan.exerciseTargets !== undefined) result.exerciseTargets = cloneExerciseTargets(plan.exerciseTargets, exerciseIds);
  if (plan.exerciseVideoLinks !== undefined) {
    result.exerciseVideoLinks = Object.fromEntries(exerciseIds.flatMap(id => {
      const links = plan.exerciseVideoLinks?.[id];
      return links && typeof links === 'object' && !Array.isArray(links) ? [[id, { ...links }]] : [];
    }));
  }
  return result;
}

export function hasCustomPlanTitle(plan, exercises) {
  if (typeof plan.customTitle === 'boolean') return plan.customTitle && !plan.rest;
  const groups = plan.muscleGroups?.length ? plan.muscleGroups : [...new Set(plan.exerciseIds.map(id => exercises.find(exercise => exercise.id === id)?.group).filter(Boolean))];
  return Boolean(plan.custom && !plan.rest && plan.title && plan.title !== groups.join(' & '));
}

export function updatePlanExercises(plan, chosen, exercises = chosen, previousPlan = plan) {
  const exerciseIds = chosen.map(exercise => exercise.id);
  const unchanged = exerciseIds.length === plan.exerciseIds.length && exerciseIds.every((id, index) => id === plan.exerciseIds[index]);
  const targetsUnchanged = chosen.every(exercise => JSON.stringify(getExerciseTarget(plan, exercise)) === JSON.stringify(getExerciseTarget(previousPlan, exercise)));
  const muscleGroups = [...new Set(chosen.map(exercise => exercise.group))];
  const customTitle = hasCustomPlanTitle(plan, exercises);
  const rest = plan.rest && chosen.every(exercise => exercise.group === 'Mobility');
  if (rest && !muscleGroups.length) muscleGroups.push('Mobility');
  const exerciseTargets = plan.exerciseTargets === undefined ? undefined : cloneExerciseTargets(plan.exerciseTargets, exerciseIds);
  return clonePlanDetails({
    ...plan,
    muscleGroups: unchanged && plan.muscleGroups ? [...plan.muscleGroups] : muscleGroups,
    title: unchanged || customTitle ? plan.title : muscleGroups.join(' & '),
    focus: unchanged ? plan.focus : muscleGroups.join(' · '),
    exerciseIds,
    duration: unchanged && targetsUnchanged ? plan.duration : estimateWorkoutMinutes(chosen, plan.sets, rest, exerciseTargets),
    rest,
    custom: true,
    customTitle,
    ...(exerciseTargets !== undefined && { exerciseTargets }),
  });
}

export function resolveBaseWeekPlans({ level, trainingPlace, fitnessGoal, weeklyGoal, gender, restDays, weeklyPlans = {}, planSources = {} }) {
  const source = planSources[level] || trainingPlace;
  const template = weeklyPlans[`${source}:${level}`] || getSuggestedWeekPlan({ fitnessGoal, level, trainingPlace: source, weeklyGoal, gender, restDays });
  return template.map(plan => adaptPlanForLocation(plan, trainingPlace, source));
}

export function resolveWeekPlans(options) {
  const { level, trainingPlace, planSources = {}, datePlanSources = {}, customPlans = {}, dates = getWeekDates() } = options;
  const source = planSources[level] || trainingPlace;
  const template = resolveBaseWeekPlans({ ...options, trainingPlace: source });
  return template.map((plan, index) => {
    const date = dateKey(dates[index]);
    const dateSource = datePlanSources[`${level}:${date}`] || source;
    const override = customPlans[`${dateSource}:${level}:${date}`];
    const resolved = { ...plan, ...override };
    return adaptPlanForLocation(clonePlanDetails(resolved), trainingPlace, override ? dateSource : source);
  });
}

export function saveDatePlan(state, { date, plan, trainingPlace, level }) {
  const key = date instanceof Date ? dateKey(date) : date;
  return {
    ...state,
    planSources: { ...state.planSources, [level]: state.planSources?.[level] || state.trainingPlace || trainingPlace },
    datePlanSources: { ...state.datePlanSources, [`${level}:${key}`]: trainingPlace },
    customPlans: { ...state.customPlans, [`${trainingPlace}:${level}:${key}`]: clonePlanDetails(plan) },
  };
}

// Before a recurring edit in another location, carry the displayed routine and
// its date edits across. Old destination routines must not replace what the
// user just edited. Merely toggling location never calls this helper.
export function materializePlanLocation(state, { trainingPlace, level }) {
  const source = state.planSources?.[level] || trainingPlace;
  const hasOtherDateSource = Object.entries(state.datePlanSources || {}).some(([key, place]) => key.startsWith(`${level}:`) && place !== trainingPlace);
  if (source === trainingPlace && !hasOtherDateSource) return state;
  const options = { ...state, level, trainingPlace, fitnessGoal: state.profile?.fitnessGoal, weeklyGoal: state.profile?.goal, gender: state.profile?.gender, restDays: state.profile?.restDays };
  const week = resolveBaseWeekPlans(options);
  const sourcePrefix = `${source}:${level}:`;
  const targetPrefix = `${trainingPlace}:${level}:`;
  const dates = new Set(Object.keys(state.customPlans || {}).filter(key => key.startsWith(sourcePrefix)).map(key => key.slice(sourcePrefix.length)));
  Object.keys(state.datePlanSources || {}).filter(key => key.startsWith(`${level}:`)).forEach(key => dates.add(key.slice(level.length + 1)));
  const customPlans = Object.fromEntries(Object.entries(state.customPlans || {}).filter(([key]) => !key.startsWith(targetPrefix)));
  const datePlanSources = { ...state.datePlanSources };
  for (const date of dates) {
    const dateSource = datePlanSources[`${level}:${date}`] || source;
    const override = state.customPlans?.[`${dateSource}:${level}:${date}`];
    if (!override) continue;
    const weekday = (new Date(`${date}T12:00:00`).getDay() + 6) % 7;
    customPlans[`${targetPrefix}${date}`] = adaptPlanForLocation({ ...week[weekday], ...override }, trainingPlace, dateSource);
    datePlanSources[`${level}:${date}`] = trainingPlace;
  }
  return { ...state, customPlans, datePlanSources, planSources: { ...state.planSources, [level]: trainingPlace }, weeklyPlans: { ...state.weeklyPlans, [`${trainingPlace}:${level}`]: week.map(clonePlanDetails) } };
}

export function matchesWeeklySchedule(plans, weeklyGoal, restDays) {
  const selected = normalizeRestDays(restDays, weeklyGoal);
  return selected !== null && plans?.length === 7 && plans.every((plan, index) =>
    selected.includes(index) ? plan.rest && plan.exerciseIds.length === 0 : !plan.rest && plan.exerciseIds.length > 0,
  );
}

// Preserve saved workout order and targets while fitting the chosen calendar.
// Additional days use the new goal's suggestions; fewer days keep the first
// workouts in the sequence, exactly as shown in the Goals preview.
export function rescheduleWeekPlans(plans, { weeklyGoal, restDays, suggestedPlans }) {
  const selected = normalizeRestDays(restDays, weeklyGoal);
  if (selected === null) throw new Error('Choose rest days that match your weekly workout target.');
  const workouts = plans.filter(plan => !plan.rest && plan.exerciseIds.length);
  const suggestions = suggestedPlans.filter(plan => !plan.rest && plan.exerciseIds.length);
  const next = Array.from({ length: 7 }, (_, index) => {
    if (index < weeklyGoal) {
      const plan = workouts[index] || suggestions[index % suggestions.length];
      if (!plan) throw new Error('A workout is missing. Choose a suggested plan and try again.');
      return clonePlanDetails(plan);
    }
    return { day: '', title: 'Complete rest', focus: 'A day off from training', duration: 0,
      exerciseIds: [], exerciseTargets: {}, sets: 1, reps: '6', muscleGroups: ['Mobility'],
      rest: true, custom: false, customTitle: false, intensity: 'recovery' };
  });
  return applyRestDaySchedule(next, selected);
}

export function updateTrainingGoal(state, { fitnessGoal, weeklyGoal, gender, restDays, applySuggestion = false, applySchedule = false, keepSchedule = false, trainingPlace, level, fromDate = getWeekDates()[0] }) {
  const { restDays: previousRestDays, ...profile } = state.profile || {};
  const selectedRestDays = normalizeRestDays(restDays === undefined ? previousRestDays : restDays, weeklyGoal);
  let updated = { ...state, profile: { ...profile, fitnessGoal, goal: weeklyGoal, ...(gender !== undefined && { gender }),
    ...(selectedRestDays !== null && { restDays: selectedRestDays }),
  } };
  if (applySuggestion) {
    updated = applyWeeklySplit(updated, { trainingPlace, level, plans: [], fromDate });
    const nextWeekly = { ...updated.weeklyPlans };
    delete nextWeekly[`${trainingPlace}:${level}`];
    updated.weeklyPlans = nextWeekly;
  } else if (applySchedule) {
    // Keep the original equipment source so adjusting days while at home does
    // not overwrite the user's gym exercise choices with home alternatives.
    const source = state.planSources?.[level] || trainingPlace;
    const original = resolveBaseWeekPlans({ ...state, level, trainingPlace: source,
      fitnessGoal: state.profile?.fitnessGoal, weeklyGoal: state.profile?.goal,
      gender: state.profile?.gender, restDays: state.profile?.restDays });
    const chosenRestDays = selectedRestDays ?? getDefaultRestDays(weeklyGoal, level);
    const suggestedPlans = getSuggestedWeekPlan({ fitnessGoal, weeklyGoal, gender: updated.profile.gender,
      restDays: chosenRestDays, level, trainingPlace: source });
    const plans = rescheduleWeekPlans(original, { weeklyGoal, restDays: chosenRestDays, suggestedPlans });
    updated = applyWeeklySplit(updated, { trainingPlace: source, level, plans, fromDate });
    updated.profile = { ...updated.profile, restDays: chosenRestDays };
  } else if (keepSchedule) {
    const source = state.planSources?.[level] || trainingPlace;
    const scope = `${source}:${level}`;
    if (!state.weeklyPlans?.[scope]) {
      // Date-only customizations still use a generated base. Freeze that base
      // before changing profile preferences, or an explicit Keep would rebuild it.
      const plans = resolveBaseWeekPlans({ ...state, level, trainingPlace: source,
        fitnessGoal: state.profile?.fitnessGoal, weeklyGoal: state.profile?.goal,
        gender: state.profile?.gender, restDays: state.profile?.restDays });
      updated.weeklyPlans = { ...state.weeklyPlans, [scope]: plans };
      updated.planSources = { ...state.planSources, [level]: source };
    }
  }
  return updated;
}

export function applyWeeklySplit(state, { trainingPlace, level, plans, fromDate = getWeekDates()[0] }) {
  const scope = `${trainingPlace}:${level}`;
  const prefix = `${scope}:`;
  const start = dateKey(fromDate);
  return {
    ...state,
    planSources: { ...state.planSources, [level]: trainingPlace },
    datePlanSources: Object.fromEntries(Object.entries(state.datePlanSources || {}).filter(([key]) =>
      !key.startsWith(`${level}:`) || key.slice(level.length + 1) < start,
    )),
    weeklyPlans: {
      ...state.weeklyPlans,
      [scope]: plans.map(clonePlanDetails),
    },
    customPlans: Object.fromEntries(Object.entries(state.customPlans || {}).filter(([key]) =>
      !key.startsWith(prefix) || key.slice(prefix.length) < start,
    )),
  };
}
