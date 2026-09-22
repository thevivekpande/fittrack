import { EXERCISES } from './data.js';
import { exerciseUnit } from './exerciseSearch.js';

const catalogIds = new Set(EXERCISES.map(({ id }) => id));
const units = new Set(['reps', 'sec', 'min']);
const isObject = value => value !== null && typeof value === 'object' && !Array.isArray(value);
const inRange = (value, minimum, maximum) => Number.isInteger(value) && value >= minimum && value <= maximum;

function normalizeReps(value) {
  if (typeof value !== 'string' || value.length > 20) return null;
  const match = /^(\d{1,3})(?:\s*[-–—]\s*(\d{1,3}))?$/.exec(value.trim());
  if (!match) return null;
  const low = Number(match[1]);
  const high = match[2] === undefined ? low : Number(match[2]);
  if (!inRange(low, 1, 600) || !inRange(high, low, 600)) return null;
  return match[2] === undefined ? String(low) : `${low}–${high}`;
}

function normalizeTarget(value) {
  if (!isObject(value) || !inRange(value.sets, 1, 20) || !units.has(value.unit)
    || !inRange(value.restSeconds, 0, 600)) return null;
  const reps = normalizeReps(value.reps);
  return reps ? { sets: value.sets, reps, unit: value.unit, restSeconds: value.restSeconds } : null;
}

export function normalizeExerciseTargets(targets, exerciseIds) {
  if (!isObject(targets) || !Array.isArray(exerciseIds)) return {};
  return Object.fromEntries([...new Set(exerciseIds)].flatMap(id => {
    if (!catalogIds.has(id) || !Object.hasOwn(targets, id)) return [];
    const target = normalizeTarget(targets[id]);
    return target ? [[id, target]] : [];
  }));
}

export function cloneExerciseTargets(targets, exerciseIds) {
  return normalizeExerciseTargets(targets, exerciseIds);
}

export function getExerciseTarget(plan, exercise) {
  const explicit = normalizeTarget(plan?.exerciseTargets?.[exercise?.id]);
  if (explicit) return explicit;
  const unit = exerciseUnit(exercise);
  // Continuous cardio should not inherit a strength workout's rep count.
  if (unit === 'min') return { sets: 1, reps: '10', unit, restSeconds: 0 };
  return {
    sets: inRange(plan?.sets, 1, 20) ? plan.sets : 3,
    reps: normalizeReps(String(plan?.reps ?? '')) || '10',
    unit,
    restSeconds: inRange(plan?.restSeconds, 0, 600) ? plan.restSeconds : 60,
  };
}

export function getTotalSets(plan, exercises = EXERCISES) {
  if (!Array.isArray(plan?.exerciseIds) || !Array.isArray(exercises)) return 0;
  const available = new Map(exercises.map(exercise => [exercise.id, exercise]));
  return [...new Set(plan.exerciseIds)].reduce((total, id) => {
    const exercise = available.get(id);
    return total + (exercise ? getExerciseTarget(plan, exercise).sets : 0);
  }, 0);
}
