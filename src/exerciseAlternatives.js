import { EXERCISES } from './data.js';
import { getExerciseMuscles, MUSCLE_REGIONS } from './muscleData.js';

export const EQUIPMENT_OPTIONS = Object.freeze([
  Object.freeze({ id: 'all', label: 'All equipment' }),
  Object.freeze({ id: 'no-machines', label: 'No machines' }),
  Object.freeze({ id: 'bodyweight', label: 'Bodyweight' }),
  Object.freeze({ id: 'dumbbells', label: 'Dumbbells' }),
]);
export const equipmentOptions = EQUIPMENT_OPTIONS;

const catalog = new Map(EXERCISES.map((exercise, index) => [exercise.id, { exercise, index }]));
const filters = new Set(EQUIPMENT_OPTIONS.map(option => option.id));
const bodyweightEquipment = new Set(['Bodyweight', 'Exercise mat', 'Stable household support']);
const isMachine = exercise => /machine|cable|treadmill|stationary bike/i.test(exercise.equipment);
const isDumbbell = exercise => /\bdumbbells?\b/i.test(exercise.equipment);

const families = Object.freeze({
  pushup: 'chestPress', benchpress: 'chestPress', chestpressmachine: 'chestPress',
  chestfly: 'chestFly', pecdeck: 'chestFly',
  press: 'shoulderPress', frontraise: 'frontRaise', lateralraise: 'sideRaise',
  curl: 'armCurl',
  tricepspushdown: 'tricepsExtension', tricepsextension: 'tricepsExtension', cabletricepsextension: 'tricepsExtension',
  row: 'row', cablerow: 'row', latpulldown: 'pulldown',
  facepull: 'rearShoulder', reardeltfly: 'rearShoulder',
  squat: 'squatLunge', lunge: 'squatLunge', legpress: 'squatLunge',
  legextension: 'kneeExtension', legcurl: 'kneeCurl',
  deadlift: 'hipHinge', bridge: 'hipExtension', calfraise: 'calfRaise',
  plank: 'frontHold', sideplank: 'sideHold',
  crunch: 'trunkCurl', reversecrunch: 'trunkCurl', cablecrunch: 'trunkCurl',
  bicyclecrunch: 'rotatingCurl', heeltap: 'sideBend',
  deadbug: 'coreStability', birddog: 'coreStability',
  legraise: 'legRaise', mountainclimber: 'kneeDrive', superman: 'backExtension',
  jumpingjack: 'cardio', walking: 'cardio', cycling: 'cardio',
});

const familyLabels = Object.freeze({
  chestPress: 'chest press', chestFly: 'chest fly', shoulderPress: 'overhead press',
  frontRaise: 'front shoulder raise', sideRaise: 'side shoulder raise',
  armCurl: 'elbow curl', tricepsExtension: 'triceps extension',
  row: 'row', pulldown: 'vertical pull', rearShoulder: 'rear shoulder movement',
  squatLunge: 'compound leg movement', kneeExtension: 'knee extension', kneeCurl: 'knee curl',
  hipHinge: 'hip hinge', hipExtension: 'hip extension', calfRaise: 'calf raise',
  frontHold: 'plank hold', sideHold: 'side plank hold', trunkCurl: 'abdominal curl',
  rotatingCurl: 'rotating abdominal curl', sideBend: 'side bend', coreStability: 'core stability exercise',
  legRaise: 'leg raise', kneeDrive: 'alternating knee drive', backExtension: 'back extension',
});

// These are related options, not mechanically identical replacements. The
// muscle map must also share a primary region, which rejects incidental overlap
// through stabilizers (e.g. a row does not replace a biceps isolation exercise).
const relatedFamilies = [
  ['chestPress', 'chestFly'], ['chestPress', 'tricepsExtension'],
  ['shoulderPress', 'frontRaise'], ['shoulderPress', 'sideRaise'],
  ['row', 'pulldown'], ['row', 'rearShoulder'],
  ['squatLunge', 'kneeExtension'], ['kneeCurl', 'hipHinge'], ['hipHinge', 'hipExtension'],
  ['coreStability', 'backExtension'],
];
const related = new Set(relatedFamilies.flatMap(([left, right]) => [`${left}:${right}`, `${right}:${left}`]));

function matchesEquipment(exercise, filter) {
  if (filter === 'bodyweight') return bodyweightEquipment.has(exercise.equipment);
  if (filter === 'dumbbells') return isDumbbell(exercise);
  if (filter === 'no-machines') return !isMachine(exercise);
  return filter === 'all';
}

function equipmentPreference(source, candidate) {
  if (!isMachine(source) || source.equipment === candidate.equipment) return 0;
  if (isDumbbell(candidate)) return 115;
  if (/\bbarbell\b/i.test(candidate.equipment)) return 110;
  if (bodyweightEquipment.has(candidate.equipment)) return 105;
  return isMachine(candidate) ? 40 : 0;
}

function rankMatch(source, candidate) {
  // Conditioning and gentle recovery do not become strength substitutions just
  // because, for example, walking and squats both involve the glutes.
  if (source.group === 'Cardio' || candidate.group === 'Cardio') {
    if (source.group !== 'Cardio' || candidate.group !== 'Cardio') return null;
    const continuous = new Set(['walking', 'cycling']);
    const comparableFormat = continuous.has(source.movement) && continuous.has(candidate.movement);
    return {
      score: (comparableFormat ? 180 : 90) + equipmentPreference(source, candidate),
      matchLabel: 'Cardio alternative',
      reason: `A different cardio movement using ${candidate.equipment.toLowerCase()}.`,
    };
  }

  const sourceMuscles = getExerciseMuscles(source);
  const candidateMuscles = getExerciseMuscles(candidate);
  const shared = sourceMuscles.primary.filter(region => candidateMuscles.primary.includes(region));
  if (!shared.length) return null;
  const focus = shared.map(region => MUSCLE_REGIONS[region].toLowerCase()).join(' and ');

  if (source.group === 'Mobility' || candidate.group === 'Mobility') {
    if (source.group !== 'Mobility' || candidate.group !== 'Mobility') return null;
    return { score: 100, matchLabel: 'Gentle movement alternative', reason: `Another gentle movement for ${focus}.` };
  }

  const sourceFamily = families[source.movement];
  const candidateFamily = families[candidate.movement];
  if (!sourceFamily || !candidateFamily) return null;
  const sameMovement = source.movement === candidate.movement;
  const sameFamily = sourceFamily === candidateFamily;
  const bothCore = source.group === 'Core' && candidate.group === 'Core';
  if (!sameFamily && !bothCore && !related.has(`${sourceFamily}:${candidateFamily}`)) return null;

  const union = new Set([...sourceMuscles.primary, ...candidateMuscles.primary]).size;
  const overlapScore = 40 * shared.length / union + 15 * shared.length / sourceMuscles.primary.length;
  const secondaryScore = sourceMuscles.secondary.filter(region => candidateMuscles.secondary.includes(region)).length * 2;
  const score = (sameMovement ? 150 : sameFamily ? 140 : 70) + overlapScore + secondaryScore
    + equipmentPreference(source, candidate) + (source.group === candidate.group ? 5 : 0);
  const equipment = candidate.equipment.toLowerCase();

  // In particular, a crunch never receives a "same movement" label for a plank:
  // their shared abdominal focus is explained separately from the changed action.
  if (sameMovement) return { score, matchLabel: 'Movement variation', reason: `Similar movement for ${focus}. Uses ${equipment}.` };
  if (sameFamily) return { score, matchLabel: 'Similar movement', reason: `A related ${familyLabels[candidateFamily]} for ${focus}. Uses ${equipment}.` };
  return { score, matchLabel: 'Related muscle focus', reason: `Different movement for ${focus}: ${familyLabels[candidateFamily]}. Uses ${equipment}.` };
}

/** Return every suitable catalog alternative in stable best-match order. */
export function getExerciseAlternatives(options = {}) {
  if (!options || typeof options !== 'object' || Array.isArray(options)) return [];
  const { exercise, trainingPlace, exerciseIds = [], equipmentFilter = 'all' } = options;
  if (!exercise || typeof exercise !== 'object' || typeof exercise.id !== 'string'
    || !['home', 'gym'].includes(trainingPlace) || !filters.has(equipmentFilter)) return [];
  // Canonical catalog metadata wins over caller-supplied movement/group fields.
  const source = catalog.get(exercise.id)?.exercise;
  if (!source) return [];
  const excluded = new Set(Array.isArray(exerciseIds) ? exerciseIds.filter(id => typeof id === 'string') : []);
  excluded.add(source.id);

  return EXERCISES.flatMap((candidate, index) => {
    if (excluded.has(candidate.id) || !candidate.places.includes(trainingPlace) || !matchesEquipment(candidate, equipmentFilter)) return [];
    const match = rankMatch(source, candidate);
    return match ? [{ exercise: candidate, index, ...match }] : [];
  }).sort((left, right) => right.score - left.score || left.index - right.index)
    .map(({ exercise: candidate, reason, matchLabel }) => ({ exercise: candidate, reason, matchLabel }));
}
