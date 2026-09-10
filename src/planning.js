import { dateKey, getWeekDates } from './data.js';
import { getSuggestedWeekPlan } from './goals.js';

export const MAX_PLAN_EXERCISES = 12;

export function estimateWorkoutMinutes(exercises, sets = 3, rest = false) {
  const minutes = exercises.reduce((total, exercise) => total + (Number.isFinite(exercise.duration) ? Math.max(0, exercise.duration) : 0), 0);
  const multiplier = rest ? 1 : Math.max(0, Number(sets) || 0) / 3;
  return Math.max(1, Math.round(minutes * multiplier));
}

export function hasCustomPlanTitle(plan, exercises) {
  if (typeof plan.customTitle === 'boolean') return plan.customTitle && !plan.rest;
  const groups = plan.muscleGroups?.length ? plan.muscleGroups : [...new Set(plan.exerciseIds.map(id => exercises.find(exercise => exercise.id === id)?.group).filter(Boolean))];
  return Boolean(plan.custom && !plan.rest && plan.title && plan.title !== groups.join(' & '));
}

export function updatePlanExercises(plan, chosen, exercises = chosen) {
  const exerciseIds = chosen.map(exercise => exercise.id);
  const unchanged = exerciseIds.length === plan.exerciseIds.length && exerciseIds.every((id, index) => id === plan.exerciseIds[index]);
  const muscleGroups = [...new Set(chosen.map(exercise => exercise.group))];
  const customTitle = hasCustomPlanTitle(plan, exercises);
  const rest = plan.rest && chosen.every(exercise => exercise.group === 'Mobility');
  return {
    ...plan,
    muscleGroups: unchanged && plan.muscleGroups ? [...plan.muscleGroups] : muscleGroups,
    title: unchanged || customTitle ? plan.title : muscleGroups.join(' & '),
    focus: unchanged ? plan.focus : muscleGroups.join(' · '),
    exerciseIds,
    duration: unchanged ? plan.duration : estimateWorkoutMinutes(chosen, plan.sets, rest),
    rest,
    custom: true,
    customTitle,
  };
}

export function resolveWeekPlans({ level, trainingPlace, fitnessGoal, weeklyGoal, gender, weeklyPlans = {}, customPlans = {}, dates = getWeekDates() }) {
  const scope = `${trainingPlace}:${level}`;
  const template = weeklyPlans[scope] || getSuggestedWeekPlan({ fitnessGoal, level, trainingPlace, weeklyGoal, gender });
  return template.map((plan, index) => {
    const resolved = { ...plan, ...customPlans[`${scope}:${dateKey(dates[index])}`] };
    return { ...resolved, exerciseIds: [...resolved.exerciseIds], ...(resolved.muscleGroups && { muscleGroups: [...resolved.muscleGroups] }) };
  });
}

export function updateTrainingGoal(state, { fitnessGoal, weeklyGoal, gender, applySuggestion = false, trainingPlace, level }) {
  let updated = { ...state, profile: { ...state.profile, fitnessGoal, goal: weeklyGoal, ...(gender !== undefined && { gender }) } };
  if (applySuggestion) {
    updated = applyWeeklySplit(updated, { trainingPlace, level, plans: [] });
    const nextWeekly = { ...updated.weeklyPlans };
    delete nextWeekly[`${trainingPlace}:${level}`];
    updated.weeklyPlans = nextWeekly;
  }
  return updated;
}

export function applyWeeklySplit(state, { trainingPlace, level, plans, fromDate = getWeekDates()[0] }) {
  const scope = `${trainingPlace}:${level}`;
  const prefix = `${scope}:`;
  const start = dateKey(fromDate);
  return {
    ...state,
    weeklyPlans: {
      ...state.weeklyPlans,
      [scope]: plans.map(plan => ({ ...plan, exerciseIds: [...plan.exerciseIds], muscleGroups: [...plan.muscleGroups] })),
    },
    customPlans: Object.fromEntries(Object.entries(state.customPlans || {}).filter(([key]) =>
      !key.startsWith(prefix) || key.slice(prefix.length) < start,
    )),
  };
}
