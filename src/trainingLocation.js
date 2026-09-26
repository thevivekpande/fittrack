import { EXERCISES, LEVELS } from './data.js';
import { getExerciseAlternatives } from './exerciseAlternatives.js';
import { exerciseUnit } from './exerciseSearch.js';
import { getExerciseMuscles } from './muscleData.js';
import { getExerciseTarget } from './workoutTargets.js';
import { estimateTargetSeconds } from './recompositionPlan.js';

const catalog = new Map(EXERCISES.map(exercise => [exercise.id, exercise]));
const places = new Set(['home', 'gym']);
const gymEquivalents = Object.freeze({
  'backpack-row': 'dumbbell-row',
  'single-arm-backpack-row': 'single-arm-dumbbell-row',
  'bottle-bent-over-row': 'dumbbell-row',
  'bottle-biceps-curl': 'bicep-curl',
  'bottle-hammer-curl': 'hammer-curl',
  'bottle-shoulder-press': 'shoulder-press',
  'bottle-lateral-raise': 'lateral-raise',
  'bottle-rear-delt-fly': 'rear-delt-fly',
  'bottle-overhead-triceps-extension': 'overhead-triceps-extension',
  'backpack-romanian-deadlift': 'romanian-deadlift',
  'bodyweight-squat': 'goblet-squat',
  'sumo-squat': 'dumbbell-sumo-squat',
  'chair-squat': 'goblet-squat',
  'reverse-lunge': 'dumbbell-reverse-lunge',
  'forward-lunge': 'walking-lunge',
  'split-squat': 'dumbbell-split-squat',
  'glute-bridge': 'dumbbell-hip-thrust',
  'standing-calf-raise': 'dumbbell-calf-raise',
  'bodyweight-good-morning': 'romanian-deadlift',
  'push-up': 'bench-press',
  'wide-push-up': 'bench-press',
  'incline-push-up': 'incline-bench-press',
  'knee-push-up': 'chest-press-machine',
  'wall-push-up': 'chest-press-machine',
  'narrow-push-up': 'triceps-pushdown',
});

// The first location switch pins the routine, not its equipment. Always project
// from that source so returning to the gym restores the exact saved exercises.
export function changeTrainingLocation(state, { trainingPlace, level = state.level }) {
  if (!places.has(trainingPlace) || !LEVELS.some(item => item.id === level)) return state;
  const source = places.has(state.trainingPlace) ? state.trainingPlace : trainingPlace;
  return {
    ...state, trainingPlace, level,
    planSources: {
      ...state.planSources,
      ...(LEVELS.some(item => item.id === state.level) && { [state.level]: state.planSources?.[state.level] || source }),
      [level]: state.planSources?.[level] || source,
    },
  };
}

function targetForAlternative(plan, source, replacement) {
  const target = getExerciseTarget(plan, source);
  const unit = exerciseUnit(replacement);
  if (unit === target.unit) return { ...target };
  return getExerciseTarget({ sets: target.sets, reps: unit === 'sec' ? '20–30' : '8–12', restSeconds: target.restSeconds }, replacement);
}

function candidatesFor(source, trainingPlace) {
  const primary = getExerciseMuscles(source).primary;
  const sameFocus = candidate => candidate.group === source.group && (source.group === 'Cardio'
    || getExerciseMuscles(candidate).primary.some(muscle => primary.includes(muscle)));
  const ranked = getExerciseAlternatives({ exercise: source, trainingPlace })
    .map(item => item.exercise).filter(sameFocus);
  const used = new Set(ranked.map(item => item.id));
  return [...ranked, ...EXERCISES.filter(candidate => candidate.places.includes(trainingPlace) && sameFocus(candidate) && !used.has(candidate.id))];
}

function gymCandidatesFor(source, plan) {
  // A shared `places` flag describes where a movement is possible, not which
  // equipment best fits a location. Household resistance has gym equivalents;
  // deliberate bodyweight choices in custom plans remain the user's choice.
  const householdResistance = /backpack|water bottles/i.test(source.equipment);
  if (plan.rest || plan.intensity === 'light' || (plan.custom && !householdResistance)) return [];
  const preferred = catalog.get(gymEquivalents[source.id]);
  if (!preferred) return [];
  const alternatives = getExerciseAlternatives({ exercise: source, trainingPlace: 'gym' })
    .map(item => item.exercise)
    .filter(candidate => candidate.group === source.group && !candidate.places.includes('home')
      && exerciseUnit(candidate) === exerciseUnit(source));
  // Preferred variants keep the movement specific (e.g. a single-arm row or a
  // hammer curl); ranked alternatives avoid duplicate rows when already used.
  return [preferred, ...alternatives.filter(candidate => candidate.id !== preferred.id)];
}

export function adaptPlanForLocation(plan, trainingPlace, sourcePlace = trainingPlace) {
  const copy = structuredClone(plan);
  if (!places.has(trainingPlace)) return copy;
  const candidatesById = new Map(plan.exerciseIds.map(id => {
    const source = catalog.get(id);
    if (!source) throw new Error('An exercise is unavailable. Edit this workout before switching training location.');
    if (!source.places.includes(trainingPlace)) return [id, candidatesFor(source, trainingPlace)];
    const gymCandidates = sourcePlace === 'home' && trainingPlace === 'gym' ? gymCandidatesFor(source, plan) : [];
    return [id, gymCandidates.length ? gymCandidates : [source]];
  }));
  if (plan.exerciseIds.every(id => candidatesById.get(id)[0]?.id === id)) return copy;
  const reserved = new Set(plan.exerciseIds.filter(id => candidatesById.get(id)[0]?.id === id));
  const used = new Set();
  const exerciseIds = [];
  const exerciseTargets = {};
  const exerciseVideoLinks = {};
  let combined = false;
  let capped = false;

  for (const id of plan.exerciseIds) {
    const source = catalog.get(id);
    const candidates = candidatesById.get(id);
    const replacement = candidates.find(candidate => !used.has(candidate.id) && (!reserved.has(candidate.id) || candidate.id === id)) || candidates[0];
    if (!replacement) throw new Error(`No ${trainingPlace} alternative is available for ${source.name}.`);
    const target = targetForAlternative(plan, source, replacement);
    if (used.has(replacement.id)) {
      // Several machine variations can share one home movement. Combine their
      // sets instead of producing duplicate rows or silently dropping the work.
      const combinedSets = exerciseTargets[replacement.id].sets + target.sets;
      capped ||= combinedSets > 20;
      exerciseTargets[replacement.id].sets = Math.min(20, combinedSets);
      combined = true;
      continue;
    }
    used.add(replacement.id);
    exerciseIds.push(replacement.id);
    exerciseTargets[replacement.id] = target;
    const links = replacement.id === id ? plan.exerciseVideoLinks?.[id] : replacement.videoLinks;
    if (links) exerciseVideoLinks[replacement.id] = { ...links };
  }
  return {
    ...copy, exerciseIds, exerciseTargets, exerciseVideoLinks,
    duration: Math.max(1, Math.ceil(Object.values(exerciseTargets).reduce((sum, target) => sum + estimateTargetSeconds(target), 0) / 60)),
    locationAdapted: true,
    locationNote: capped ? 'Similar movements share an alternative. Combined targets are limited to 20 sets per exercise; review your workout before starting.'
      : combined ? 'Similar movements share an alternative. Review the combined sets before starting.' : '',
  };
}
