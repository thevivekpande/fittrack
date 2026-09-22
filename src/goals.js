import { EXERCISES, getWeekPlan } from './data.js';
import { normalizeGender } from './profile.js';
import { getRecompositionWeekPlan } from './recompositionPlan.js';

export const FITNESS_GOALS = Object.freeze([
  {
    id: 'fat-loss',
    label: 'Lose body fat',
    description: 'Combine strength, cardio, and steady movement.',
    approach: 'Mixes full-body resistance work, cardio, and core practice. Start with the days you can sustain and build a steady movement routine over time.',
  },
  {
    id: 'build-muscle',
    label: 'Build muscle',
    description: 'Make progressive strength training your focus.',
    approach: 'Prioritizes upper- and lower-body resistance exercises, with lighter movement between demanding sessions. Practice controlled technique and gradually increase the challenge when the current work feels comfortable.',
  },
  {
    id: 'body-recomposition',
    label: 'Build muscle & lose fat',
    description: 'Balance resistance training with conditioning.',
    approach: 'Pairs strength work with cardio and core exercises. Track your strength and activity over time, make room for recovery, and build a routine that fits the number of days you can sustain.',
  },
  {
    id: 'general-fitness',
    label: 'Improve overall fitness',
    description: 'Build strength, stamina, and a movement habit.',
    approach: 'Varies strength, cardio, core, and mobility work. Shorter weeks prioritize balanced sessions; extra days use lighter movement. Your session count is a starting structure, and total activity and recovery still matter.',
  },
  {
    id: 'core-strength',
    label: 'Strengthen core & abs',
    description: 'Develop abdominal strength and trunk control.',
    approach: 'Emphasizes controlled abdominal exercises and core stability alongside other strength and movement. This focus develops your midsection’s strength; it does not selectively remove belly fat.',
  },
].map(Object.freeze));

const GOAL_IDS = new Set(FITNESS_GOALS.map((goal) => goal.id));
const EXERCISE_MAP = new Map(EXERCISES.map((exercise) => [exercise.id, exercise]));
const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const LEVEL_SETTINGS = {
  beginner: { sets: 2, maxStrengthDays: 3, preferredDays: [0, 2, 4] },
  medium: { sets: 3, maxStrengthDays: 4, preferredDays: [0, 1, 3, 4] },
  experienced: { sets: 4, maxStrengthDays: 5, preferredDays: [0, 1, 2, 4, 5] },
};
const ACTIVE_DAYS = {
  1: [0],
  2: [0, 3],
  3: [0, 2, 4],
  4: [0, 2, 4, 6],
  5: [0, 1, 2, 4, 5],
  6: [0, 1, 2, 3, 4, 5],
  7: [0, 1, 2, 3, 4, 5, 6],
};
const RECOVERY_IDS = ['standing-reach', 'easy-squat'];

export function normalizeRestDays(restDays, weeklyGoal) {
  const goal = Number(weeklyGoal);
  if (!Number.isInteger(goal) || goal < 1 || goal > 7 || !Array.isArray(restDays)
    || restDays.length !== 7 - goal || new Set(restDays).size !== restDays.length
    || restDays.some(day => !Number.isInteger(day) || day < 0 || day > 6)) return null;
  return [...restDays].sort((a, b) => a - b);
}

export function getDefaultRestDays(weeklyGoal, level = 'beginner') {
  const requested = Number(weeklyGoal);
  const goal = Number.isInteger(requested) && requested >= 1 && requested <= 7
    ? requested : (LEVEL_SETTINGS[level] || LEVEL_SETTINGS.beginner).maxStrengthDays;
  return DAYS.flatMap((_, index) => ACTIVE_DAYS[goal].includes(index) ? [] : [index]);
}

function completeRestPlan(day, template = {}) {
  return {
    ...structuredClone(template), day, title: 'Complete rest', focus: 'A day off from training',
    duration: 0, exerciseIds: [], sets: 1, reps: '6', muscleGroups: ['Mobility'],
    rest: true, custom: false, customTitle: false, intensity: 'recovery', exerciseTargets: {},
    ...(template.exerciseVideoLinks !== undefined && { exerciseVideoLinks: {} }),
  };
}

// Keep the workout sequence (including source-specific targets and links),
// changing only its calendar placement. Custom saved weeks bypass this helper.
export function applyRestDaySchedule(plans, restDays) {
  if (!Array.isArray(plans)) return [];
  const week = structuredClone(plans);
  const workouts = week.filter(plan => !plan.rest);
  const selected = normalizeRestDays(restDays, workouts.length);
  if (selected === null || week.length !== 7) return week;
  const restTemplate = week.find(plan => plan.rest);
  let workoutIndex = 0;
  return DAYS.map((day, index) => selected.includes(index)
    ? completeRestPlan(day, restTemplate)
    : { ...workouts[workoutIndex++], day });
}

// These are ordinary alternatives within the same muscle group and skill tier.
// The rotation is a presentation preference, not a physiological recommendation:
// every gender keeps the same goal, training days, sets, reps, and intensity.
const COMPARABLE_VARIANTS = [
  ['bodyweight-squat', 'sumo-squat'],
  ['reverse-lunge', 'forward-lunge', 'split-squat'],
  ['incline-push-up', 'knee-push-up'],
  ['dead-bug', 'bird-dog'],
  ['goblet-squat', 'dumbbell-sumo-squat'],
  ['bench-press', 'incline-bench-press'],
  ['lat-pulldown', 'neutral-grip-lat-pulldown'],
  ['cable-row', 'wide-grip-cable-row'],
  ['shoulder-press', 'seated-shoulder-press'],
  ['hammer-curl', 'seated-hammer-curl'],
  ['triceps-pushdown', 'rope-triceps-pushdown'],
  ['walking-lunge', 'dumbbell-reverse-lunge', 'dumbbell-split-squat'],
];
const GENDER_ROTATIONS = {
  woman: [1, 0, 1],
  man: [0, 1, 1],
  nonbinary: [1, 1, 0],
};

function rotateComparableVariants(ids, gender, level, place, dayIndex) {
  const rotation = GENDER_ROTATIONS[gender];
  if (!rotation) return ids;
  const pools = level === 'beginner' ? COMPARABLE_VARIANTS : [...COMPARABLE_VARIANTS, ['push-up', 'wide-push-up']];
  const originalIds = new Set(ids);
  const used = new Set();
  return ids.map((id, slot) => {
    const pool = pools.find((alternatives) => alternatives.includes(id));
    if (!pool) { used.add(id); return id; }
    const shift = rotation[(dayIndex + slot) % rotation.length] + Math.floor(dayIndex / rotation.length);
    const start = (pool.indexOf(id) + shift) % pool.length;
    const ordered = [...pool.slice(start), ...pool.slice(0, start)];
    const candidate = ordered.find((option) => (
      EXERCISE_MAP.get(option)?.places.includes(place)
      && !used.has(option)
      && (option === id || !originalIds.has(option))
    )) || id;
    used.add(candidate);
    return candidate;
  });
}

function strengthTemplates(goal, place, level) {
  const push = level === 'beginner' ? 'incline-push-up' : 'push-up';
  const gym = place === 'gym';
  const templates = {
    'fat-loss': [
      ['Full body & cardio', gym ? ['jumping-jack', 'goblet-squat', push, 'dumbbell-row', 'mountain-climber', 'dead-bug'] : ['jumping-jack', 'bodyweight-squat', push, 'glute-bridge', 'mountain-climber', 'dead-bug']],
      ['Lower body & movement', gym ? ['leg-press', 'reverse-lunge', 'cable-row', 'jumping-jack', 'bicycle-crunch'] : ['reverse-lunge', 'sumo-squat', push, 'jumping-jack', 'bicycle-crunch']],
      ['Strength & stamina', gym ? ['bench-press', 'bodyweight-squat', 'dumbbell-row', 'jumping-jack', 'reverse-crunch'] : ['split-squat', push, 'glute-bridge', 'jumping-jack', 'reverse-crunch']],
      ['Move with strength', gym ? ['goblet-squat', 'shoulder-press', 'lat-pulldown', 'mountain-climber', 'heel-tap'] : ['forward-lunge', 'bodyweight-squat', 'wide-push-up', 'mountain-climber', 'heel-tap']],
      ['Balanced conditioning', gym ? ['romanian-deadlift', push, 'walking-lunge', 'jumping-jack', 'plank'] : ['sumo-squat', 'narrow-push-up', 'glute-bridge', 'jumping-jack', 'plank']],
    ],
    'build-muscle': [
      ['Full-body strength', gym ? ['goblet-squat', 'bench-press', 'lat-pulldown', 'romanian-deadlift', 'plank'] : ['bodyweight-squat', push, 'split-squat', 'glute-bridge', 'plank']],
      ['Upper-body foundations', gym ? ['incline-bench-press', 'cable-row', 'shoulder-press', 'bicep-curl', 'triceps-pushdown'] : [push, 'reverse-lunge', 'glute-bridge', 'dead-bug']],
      ['Lower-body strength', gym ? ['leg-press', 'romanian-deadlift', 'dumbbell-calf-raise', 'glute-bridge', 'dead-bug'] : ['sumo-squat', 'split-squat', 'forward-lunge', 'glute-bridge', 'reverse-crunch']],
      ['Upper body & control', gym ? ['lat-pulldown', 'single-arm-dumbbell-row', 'lateral-raise', 'hammer-curl', 'plank'] : ['wide-push-up', 'narrow-push-up', 'incline-push-up', 'dead-bug']],
      ['Push & leg strength', gym ? ['bench-press', 'dumbbell-split-squat', 'seated-shoulder-press', 'triceps-pushdown', 'reverse-crunch'] : ['split-squat', 'push-up', 'reverse-lunge', 'glute-bridge', 'plank']],
    ],
    'body-recomposition': [
      ['Strength + movement', gym ? ['leg-press', 'bench-press', 'cable-row', 'jumping-jack', 'plank'] : ['sumo-squat', push, 'reverse-lunge', 'jumping-jack', 'plank']],
      ['Legs & conditioning', gym ? ['romanian-deadlift', 'goblet-squat', 'dumbbell-reverse-lunge', 'dead-bug', 'jumping-jack'] : ['split-squat', 'glute-bridge', 'forward-lunge', 'dead-bug', 'jumping-jack']],
      ['Upper body & core', gym ? ['lat-pulldown', 'incline-bench-press', 'lateral-raise', 'triceps-pushdown', 'mountain-climber'] : [push, 'narrow-push-up', 'bodyweight-squat', 'mountain-climber', 'heel-tap']],
      ['Full-body balance', gym ? ['goblet-squat', 'dumbbell-row', 'push-up', 'bicycle-crunch', 'jumping-jack'] : ['reverse-lunge', 'wide-push-up', 'glute-bridge', 'bicycle-crunch', 'jumping-jack']],
      ['Strength & steady movement', gym ? ['leg-press', 'bench-press', 'seated-leg-curl', 'cable-crunch', 'jumping-jack'] : ['sumo-squat', 'push-up', 'split-squat', 'reverse-crunch', 'jumping-jack']],
    ],
    'general-fitness': [
      ['Everyday strength & movement', gym ? ['bodyweight-squat', 'bench-press', 'lat-pulldown', 'jumping-jack', 'plank'] : ['bodyweight-squat', push, 'glute-bridge', 'jumping-jack', 'plank']],
      ['Balance & body control', gym ? ['goblet-squat', 'glute-bridge', 'cable-row', 'dead-bug', 'standing-reach'] : ['split-squat', 'incline-push-up', 'glute-bridge', 'dead-bug', 'standing-reach']],
      ['Move with confidence', gym ? ['incline-push-up', 'lat-pulldown', 'reverse-lunge', 'jumping-jack', 'heel-tap'] : ['reverse-lunge', push, 'sumo-squat', 'jumping-jack', 'heel-tap']],
      ['Stronger foundations', gym ? ['leg-press', 'seated-shoulder-press', 'dumbbell-row', 'plank', 'standing-reach'] : ['bodyweight-squat', 'wide-push-up', 'glute-bridge', 'plank', 'standing-reach']],
      ['Feel-good movement', gym ? ['goblet-squat', 'bench-press', 'jumping-jack', 'dead-bug', 'easy-squat'] : ['forward-lunge', 'push-up', 'jumping-jack', 'dead-bug', 'easy-squat']],
    ],
    'core-strength': [
      ['Core control & full-body basics', ['dead-bug', 'crunch', 'plank', gym ? 'goblet-squat' : 'bodyweight-squat', 'incline-push-up']],
      ['Abs & body control', gym ? ['heel-tap', 'reverse-crunch', 'cable-crunch', 'lat-pulldown', 'glute-bridge'] : ['heel-tap', 'reverse-crunch', 'dead-bug', 'incline-push-up', 'glute-bridge']],
      ['Core & conditioning', ['bicycle-crunch', 'dead-bug', 'mountain-climber', 'bodyweight-squat', 'jumping-jack']],
      ['Trunk strength & control', gym ? ['plank', 'cable-crunch', 'reverse-crunch', 'bench-press', 'goblet-squat'] : ['plank', 'crunch', 'reverse-crunch', push, 'sumo-squat']],
      ['Core endurance & movement', ['heel-tap', gym ? 'crunch' : 'dead-bug', 'bicycle-crunch', gym ? 'cable-row' : push, 'jumping-jack']],
    ],
  };
  return templates[goal];
}

function lightTemplates(goal) {
  const templates = {
    'fat-loss': [
      ['Easy cardio & core', ['jumping-jack', 'dead-bug', 'standing-reach']],
      ['Light movement circuit', ['jumping-jack', 'heel-tap', 'easy-squat']],
    ],
    'build-muscle': [
      ['Light movement between strength days', ['jumping-jack', 'dead-bug', 'standing-reach']],
      ['Easy core & mobility', ['heel-tap', 'standing-reach', 'easy-squat']],
    ],
    'body-recomposition': [
      ['Easy conditioning & core', ['jumping-jack', 'heel-tap', 'standing-reach']],
      ['Light movement & control', ['dead-bug', 'jumping-jack', 'easy-squat']],
    ],
    'general-fitness': [
      ['Easy movement day', ['jumping-jack', 'dead-bug', 'easy-squat']],
      ['Gentle core & coordination', ['heel-tap', 'standing-reach', 'jumping-jack']],
    ],
    'core-strength': [
      ['Gentle core control', ['dead-bug', 'heel-tap', 'standing-reach']],
      ['Easy cardio & stability', ['jumping-jack', 'dead-bug', 'standing-reach']],
    ],
  };
  return templates[goal];
}

function makePlan({ day, title, ids, place, sets, reps, intensity, fitnessGoal, gender, level, dayIndex }) {
  const variations = intensity === 'recovery' ? ids : rotateComparableVariants(ids, gender, level, place, dayIndex);
  const exerciseIds = [...new Set(variations)].filter((id) => EXERCISE_MAP.get(id)?.places.includes(place));
  const selected = exerciseIds.map((id) => EXERCISE_MAP.get(id));
  const muscleGroups = [...new Set(selected.map((exercise) => exercise.group))];
  const rest = intensity === 'recovery';
  const minutes = selected.reduce((sum, exercise) => sum + exercise.duration, 0);
  return {
    day,
    title,
    focus: rest ? 'Gentle movement & mobility' : `${muscleGroups.join(' · ')}${intensity === 'light' ? ' · Easy pace' : ''}`,
    duration: Math.max(1, Math.round(rest ? minutes : minutes * sets / 3)),
    exerciseIds,
    sets,
    reps,
    muscleGroups,
    rest,
    custom: false,
    customTitle: false,
    intensity,
    fitnessGoal,
    ...(gender ? { gender } : {}),
  };
}

export function getSuggestedWeekPlan({ fitnessGoal, level, trainingPlace, weeklyGoal, gender, restDays } = {}) {
  // An unconfirmed goal must not replace an existing user's suggested routine.
  if (!GOAL_IDS.has(fitnessGoal)) {
    const legacy = getWeekPlan(level, trainingPlace);
    const selected = normalizeRestDays(restDays, weeklyGoal);
    if (selected === null) return legacy;
    // An explicit schedule can change the count while retaining the legacy
    // workout sequence and leaving the user's fitness goal unconfirmed.
    const workouts = legacy.filter(plan => !plan.rest);
    const count = 7 - selected.length;
    const template = DAYS.map((day, index) => index < count
      ? { ...structuredClone(workouts[index % workouts.length]), day }
      : completeRestPlan(day));
    return applyRestDaySchedule(template, selected);
  }
  const selectedLevel = LEVEL_SETTINGS[level] ? level : 'beginner';
  const normalizedGender = normalizeGender(gender);
  const selectedGender = GENDER_ROTATIONS[normalizedGender] ? normalizedGender : null;
  const place = trainingPlace === 'home' ? 'home' : 'gym';
  const settings = LEVEL_SETTINGS[selectedLevel];
  const requestedDays = Number(weeklyGoal);
  const dayCount = Number.isInteger(requestedDays) && requestedDays >= 1 && requestedDays <= 7 ? requestedDays : settings.maxStrengthDays;
  const selectedRestDays = normalizeRestDays(restDays, dayCount);
  // This explicit six-day gym choice follows the supplied sheet exactly;
  // comparable-variant rotations must not rewrite its exercise order.
  if (fitnessGoal === 'body-recomposition' && place === 'gym' && dayCount === 6) {
    const sheet = getRecompositionWeekPlan(selectedLevel);
    return selectedRestDays === null ? sheet : applyRestDaySchedule(sheet, selectedRestDays);
  }
  const activeDays = ACTIVE_DAYS[dayCount];
  const strengthDays = new Set([
    ...settings.preferredDays.filter((day) => activeDays.includes(day)),
    ...activeDays.filter((day) => !settings.preferredDays.includes(day)),
  ].slice(0, Math.min(dayCount, settings.maxStrengthDays)));
  const regular = strengthTemplates(fitnessGoal, place, selectedLevel);
  const light = lightTemplates(fitnessGoal);
  let strengthIndex = 0;
  let lightIndex = 0;
  const week = DAYS.map((day, index) => {
    const variationContext = { gender: selectedGender, level: selectedLevel, dayIndex: index };
    if (!activeDays.includes(index)) return makePlan({ day, title: 'Rest & recovery', ids: RECOVERY_IDS, place, sets: 1, reps: '6', intensity: 'recovery', fitnessGoal, ...variationContext });
    if (!strengthDays.has(index)) {
      const [title, ids] = light[lightIndex++ % light.length];
      return makePlan({ day, title, ids, place, sets: selectedLevel === 'beginner' ? 1 : 2, reps: '6–10', intensity: 'light', fitnessGoal, ...variationContext });
    }
    const [title, ids] = regular[strengthIndex++];
    const reps = fitnessGoal === 'fat-loss' ? '10–15' : fitnessGoal === 'build-muscle' ? '8–12' : selectedLevel === 'beginner' ? '8–10' : '10–12';
    return makePlan({ day, title, ids, place, sets: settings.sets, reps, intensity: 'strength', fitnessGoal, ...variationContext });
  });
  return selectedRestDays === null ? week : applyRestDaySchedule(week, selectedRestDays);
}
