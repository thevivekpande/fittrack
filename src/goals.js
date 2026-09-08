import { EXERCISES, getWeekPlan } from './data.js';

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

function makePlan({ day, title, ids, place, sets, reps, intensity, fitnessGoal }) {
  const exerciseIds = [...new Set(ids)].filter((id) => EXERCISE_MAP.get(id)?.places.includes(place));
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
  };
}

export function getSuggestedWeekPlan({ fitnessGoal, level, trainingPlace, weeklyGoal } = {}) {
  // An unconfirmed goal must not replace an existing user's suggested routine.
  if (!GOAL_IDS.has(fitnessGoal)) return getWeekPlan(level, trainingPlace);
  const selectedLevel = LEVEL_SETTINGS[level] ? level : 'beginner';
  const place = trainingPlace === 'home' ? 'home' : 'gym';
  const settings = LEVEL_SETTINGS[selectedLevel];
  const requestedDays = Number(weeklyGoal);
  const dayCount = Number.isInteger(requestedDays) && requestedDays >= 1 && requestedDays <= 7 ? requestedDays : settings.maxStrengthDays;
  const activeDays = ACTIVE_DAYS[dayCount];
  const strengthDays = new Set([
    ...settings.preferredDays.filter((day) => activeDays.includes(day)),
    ...activeDays.filter((day) => !settings.preferredDays.includes(day)),
  ].slice(0, Math.min(dayCount, settings.maxStrengthDays)));
  const regular = strengthTemplates(fitnessGoal, place, selectedLevel);
  const light = lightTemplates(fitnessGoal);
  let strengthIndex = 0;
  let lightIndex = 0;
  return DAYS.map((day, index) => {
    if (!activeDays.includes(index)) return makePlan({ day, title: 'Rest & recovery', ids: RECOVERY_IDS, place, sets: 1, reps: '6', intensity: 'recovery', fitnessGoal });
    if (!strengthDays.has(index)) {
      const [title, ids] = light[lightIndex++ % light.length];
      return makePlan({ day, title, ids, place, sets: selectedLevel === 'beginner' ? 1 : 2, reps: '6–10', intensity: 'light', fitnessGoal });
    }
    const [title, ids] = regular[strengthIndex++];
    const reps = fitnessGoal === 'fat-loss' ? '10–15' : fitnessGoal === 'build-muscle' ? '8–12' : selectedLevel === 'beginner' ? '8–10' : '10–12';
    return makePlan({ day, title, ids, place, sets: settings.sets, reps, intensity: 'strength', fitnessGoal });
  });
}
