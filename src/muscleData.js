import { EXERCISES } from './data.js';

// Qualitative movement anatomy for the illustrated exercise, not measured
// activation, a complete muscle inventory, or a prediction of training results.
// Supporting regions include relevant stabilizers. Mobility entries identify
// areas moving gently; callers should label those as movement focus.
// References checked September 2026:
// https://www.nasm.org/workout-exercise-guidance
// https://www.acefitness.org/resources/everyone/exercise-library/14/bird-dog/
// https://www.nasm.org/resource-center/exercise-library/face-pull
// https://www.nasm.org/resource-center/exercise-library/seated-leg-curl
// https://contentcdn.eacefitness.com/certifiednews/images/article/pdfs/ACEShoulderStudy.pdf
// https://pmc.ncbi.nlm.nih.gov/articles/PMC10054060/
// https://nfpt.com/leg-raise-not-ab-movement/ (joint actions only)

export const MUSCLE_REGIONS = Object.freeze({
  chest: 'Chest',
  frontDelts: 'Front shoulders',
  sideDelts: 'Side shoulders',
  rearDelts: 'Rear shoulders',
  biceps: 'Biceps',
  triceps: 'Triceps',
  forearms: 'Forearms',
  lats: 'Lats',
  upperBack: 'Upper back',
  lowerBack: 'Lower back',
  abs: 'Abdominals',
  obliques: 'Obliques',
  glutes: 'Glutes',
  quads: 'Quadriceps',
  hamstrings: 'Hamstrings',
  calves: 'Calves',
  hipFlexors: 'Hip flexors',
  adductors: 'Inner thighs',
});

const muscles = (primary, secondary = []) => Object.freeze({
  primary: Object.freeze(primary),
  secondary: Object.freeze(secondary),
});

// Each catalog ID is intentional: a shared animation does not mean that every
// variation has the same focus. Broad catalog groups are never used as targets.
export const EXERCISE_MUSCLES = Object.freeze({
  'bodyweight-squat': muscles(['quads', 'glutes'], ['adductors', 'abs']),
  'push-up': muscles(['chest'], ['triceps', 'frontDelts', 'abs']),
  'bicep-curl': muscles(['biceps'], ['forearms']),
  'shoulder-press': muscles(['frontDelts', 'sideDelts'], ['triceps']),
  'reverse-lunge': muscles(['quads', 'glutes'], ['hamstrings', 'abs']),
  plank: muscles(['abs'], ['obliques', 'glutes', 'frontDelts']),
  'dumbbell-row': muscles(['lats', 'upperBack'], ['biceps', 'rearDelts', 'lowerBack']),
  'jumping-jack': muscles(['calves', 'glutes'], ['quads', 'sideDelts', 'adductors']),
  'goblet-squat': muscles(['quads', 'glutes'], ['adductors', 'abs', 'upperBack']),
  'incline-push-up': muscles(['chest'], ['triceps', 'frontDelts', 'abs']),
  // Elbow flexors work across all grips; these broad regions do not claim a
  // measured ranking between grip variants or omit the biceps on reverse curls.
  'hammer-curl': muscles(['biceps', 'forearms']),
  'walking-lunge': muscles(['quads', 'glutes'], ['hamstrings', 'abs']),
  'standing-reach': muscles(['frontDelts', 'sideDelts'], ['upperBack']),
  'easy-squat': muscles(['quads', 'glutes']),
  'bench-press': muscles(['chest'], ['triceps', 'frontDelts']),
  'lat-pulldown': muscles(['lats'], ['biceps', 'upperBack']),
  'cable-row': muscles(['lats', 'upperBack'], ['biceps', 'rearDelts']),
  'leg-press': muscles(['quads', 'glutes'], ['adductors']),
  'lateral-raise': muscles(['sideDelts'], ['upperBack']),
  'triceps-pushdown': muscles(['triceps']),
  'romanian-deadlift': muscles(['hamstrings', 'glutes'], ['lowerBack', 'abs', 'forearms']),
  'glute-bridge': muscles(['glutes'], ['hamstrings', 'abs']),
  'split-squat': muscles(['quads', 'glutes'], ['adductors', 'abs']),
  'dumbbell-split-squat': muscles(['quads', 'glutes'], ['adductors', 'abs']),
  'dumbbell-reverse-lunge': muscles(['quads', 'glutes'], ['hamstrings', 'abs']),
  'sumo-squat': muscles(['quads', 'glutes'], ['adductors', 'abs']),
  'dumbbell-sumo-squat': muscles(['quads', 'glutes'], ['adductors', 'abs']),
  'wide-push-up': muscles(['chest'], ['frontDelts', 'triceps', 'abs']),
  'narrow-push-up': muscles(['triceps', 'chest'], ['frontDelts', 'abs']),
  'forward-lunge': muscles(['quads', 'glutes'], ['hamstrings', 'abs']),
  'chest-fly': muscles(['chest'], ['frontDelts']),
  'incline-bench-press': muscles(['chest'], ['frontDelts', 'triceps']),
  'front-raise': muscles(['frontDelts'], ['upperBack']),
  'overhead-triceps-extension': muscles(['triceps']),
  'leg-extension': muscles(['quads']),
  'seated-leg-curl': muscles(['hamstrings'], ['calves']),
  'dumbbell-calf-raise': muscles(['calves']),
  'alternating-bicep-curl': muscles(['biceps'], ['forearms']),
  'reverse-curl': muscles(['forearms', 'biceps']),
  'cable-bicep-curl': muscles(['biceps'], ['forearms']),
  'single-arm-dumbbell-row': muscles(['lats', 'upperBack'], ['biceps', 'rearDelts', 'obliques']),
  'seated-shoulder-press': muscles(['frontDelts', 'sideDelts'], ['triceps']),
  crunch: muscles(['abs'], ['obliques']),
  'reverse-crunch': muscles(['abs'], ['hipFlexors']),
  'dead-bug': muscles(['abs'], ['obliques', 'hipFlexors']),
  'bicycle-crunch': muscles(['abs', 'obliques'], ['hipFlexors']),
  'heel-tap': muscles(['obliques'], ['abs']),
  'mountain-climber': muscles(['abs', 'hipFlexors'], ['frontDelts', 'triceps']),
  'cable-crunch': muscles(['abs'], ['obliques']),
  'knee-push-up': muscles(['chest'], ['triceps', 'frontDelts', 'abs']),
  'wall-push-up': muscles(['chest'], ['triceps', 'frontDelts']),
  'chair-squat': muscles(['quads', 'glutes'], ['abs']),
  'standing-calf-raise': muscles(['calves']),
  'single-leg-glute-bridge': muscles(['glutes'], ['hamstrings', 'obliques']),
  'bird-dog': muscles(['abs', 'lowerBack'], ['glutes', 'obliques']),
  'side-plank': muscles(['obliques'], ['abs', 'glutes', 'sideDelts']),
  'lying-leg-raise': muscles(['hipFlexors'], ['abs', 'obliques']),
  superman: muscles(['lowerBack'], ['glutes', 'hamstrings', 'upperBack']),
  'incline-plank': muscles(['abs'], ['obliques', 'frontDelts']),
  'barbell-bench-press': muscles(['chest'], ['triceps', 'frontDelts']),
  'barbell-back-squat': muscles(['quads', 'glutes'], ['adductors', 'lowerBack', 'abs']),
  'dumbbell-hip-thrust': muscles(['glutes'], ['hamstrings', 'abs']),
  'neutral-grip-lat-pulldown': muscles(['lats'], ['biceps', 'upperBack']),
  'wide-grip-cable-row': muscles(['upperBack', 'rearDelts'], ['lats', 'biceps']),
  'seated-hammer-curl': muscles(['biceps', 'forearms']),
  'rope-triceps-pushdown': muscles(['triceps']),
  'cable-face-pull': muscles(['rearDelts', 'upperBack'], ['biceps']),
  'chest-press-machine': muscles(['chest'], ['triceps', 'frontDelts']),
  'pec-deck': muscles(['chest'], ['frontDelts']),
  'rear-delt-fly': muscles(['rearDelts'], ['upperBack', 'lowerBack']),
  'cable-triceps-extension': muscles(['triceps']),
  'treadmill-walk': muscles(['glutes', 'calves'], ['quads', 'hamstrings', 'hipFlexors']),
  'stationary-bike': muscles(['quads', 'glutes'], ['hamstrings', 'calves']),
});

const normalizeName = value => typeof value === 'string'
  ? value.toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()
  : '';
const names = new Map(EXERCISES.flatMap(exercise => [
  [normalizeName(exercise.name), exercise.id],
  [normalizeName(exercise.id), exercise.id],
]));
for (const [name, id] of Object.entries({
  'close grip push up': 'narrow-push-up',
  'close grip pushups': 'narrow-push-up',
  'leg curl': 'seated-leg-curl',
  'reverse dumbbell curl': 'reverse-curl',
  'overhead press': 'shoulder-press',
  'dumbbell overhead press': 'shoulder-press',
  'standing reach': 'standing-reach',
  'rear delt fly': 'rear-delt-fly',
  'face pull': 'cable-face-pull',
})) names.set(name, id);

const movementDefaults = Object.freeze({
  squat: 'bodyweight-squat', pushup: 'push-up', curl: 'bicep-curl',
  press: 'shoulder-press', lunge: 'reverse-lunge', plank: 'plank',
  row: 'dumbbell-row', jumpingjack: 'jumping-jack', benchpress: 'bench-press',
  latpulldown: 'lat-pulldown', cablerow: 'cable-row', legpress: 'leg-press',
  lateralraise: 'lateral-raise', tricepspushdown: 'triceps-pushdown',
  deadlift: 'romanian-deadlift', bridge: 'glute-bridge', chestfly: 'chest-fly',
  frontraise: 'front-raise', tricepsextension: 'overhead-triceps-extension',
  legextension: 'leg-extension', legcurl: 'seated-leg-curl', calfraise: 'standing-calf-raise',
  crunch: 'crunch', reversecrunch: 'reverse-crunch', deadbug: 'dead-bug',
  bicyclecrunch: 'bicycle-crunch', heeltap: 'heel-tap', mountainclimber: 'mountain-climber',
  cablecrunch: 'cable-crunch', birddog: 'bird-dog', sideplank: 'side-plank',
  legraise: 'lying-leg-raise', superman: 'superman', facepull: 'cable-face-pull',
  chestpressmachine: 'chest-press-machine', pecdeck: 'pec-deck',
  reardeltfly: 'rear-delt-fly', cabletricepsextension: 'cable-triceps-extension',
  walking: 'treadmill-walk', cycling: 'stationary-bike',
});

export function getExerciseMuscles(exercise = {}) {
  if (!exercise || typeof exercise !== 'object' || Array.isArray(exercise)) return { primary: [], secondary: [] };
  const { id, movement, name, group, equipment } = exercise;
  let resolvedId = typeof id === 'string' && Object.hasOwn(EXERCISE_MUSCLES, id) ? id : names.get(normalizeName(name));
  if (!resolvedId) {
    const pattern = normalizeName(movement).replaceAll(' ', '');
    if (normalizeName(group) === 'mobility') {
      resolvedId = pattern === 'press' ? 'standing-reach' : pattern === 'squat' ? 'easy-squat' : undefined;
    } else if (pattern === 'curl' && /leg curl/i.test(String(equipment || ''))) {
      resolvedId = 'seated-leg-curl';
    } else if (Object.hasOwn(movementDefaults, pattern)) {
      resolvedId = movementDefaults[pattern];
    }
  }
  const result = resolvedId && EXERCISE_MUSCLES[resolvedId];
  return result ? { primary: [...result.primary], secondary: [...result.secondary] } : { primary: [], secondary: [] };
}
