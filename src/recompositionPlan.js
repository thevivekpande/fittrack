export const RECOMPOSITION_PROGRAM_ID = 'six-day-recomposition';
export const RECOMPOSITION_SOURCE_LABEL = '6-Day YouTube Gym Playlist';
export const RECOMPOSITION_TARGET_NOTE = 'The PDF lists exercises and video searches, but no sets, reps, holds, or rest periods. These editable starting targets were added by FitTrack; no weights are prescribed.';
export const RECOMPOSITION_VIDEO_NOTE = 'These exact links from the PDF open YouTube search results, rather than a specific verified video.';

const video = (hindi, english) => Object.freeze({
  hindi: `https://www.youtube.com/results?search_query=${hindi}`,
  english: `https://www.youtube.com/results?search_query=${english}`,
});

// URI pairs were extracted in row order from the supplied four-page PDF.
// Repeated exercise rows remain separate so Friday's incline-press searches
// are preserved even though the catalog reuses Monday's exercise ID.
export const RECOMPOSITION_SOURCE_ROWS = Object.freeze([
  ['Mon', 'chest-press-machine', 'chest+press+machine+proper+form+hindi', 'Jeff+Nippard+chest+press+technique'],
  ['Mon', 'incline-bench-press', 'incline+dumbbell+press+hindi+proper+form', 'Jeff+Nippard+incline+dumbbell+press'],
  ['Mon', 'pec-deck', 'pec+deck+exercise+hindi', 'Renaissance+Periodization+pec+deck'],
  ['Mon', 'triceps-pushdown', 'triceps+pushdown+hindi', 'Jeff+Nippard+triceps+pushdown'],
  ['Mon', 'overhead-triceps-extension', 'overhead+triceps+extension+hindi', 'Renaissance+Periodization+overhead+triceps+extension'],
  ['Tue', 'lat-pulldown', 'lat+pulldown+hindi+proper+form', 'Jeff+Nippard+lat+pulldown+technique'],
  ['Tue', 'cable-row', 'seated+cable+row+hindi', 'Renaissance+Periodization+seated+cable+row'],
  ['Tue', 'single-arm-dumbbell-row', 'one+arm+dumbbell+row+hindi', 'Jeff+Nippard+dumbbell+row'],
  ['Tue', 'bicep-curl', 'dumbbell+bicep+curl+hindi', 'Jeff+Nippard+bicep+curl'],
  ['Tue', 'hammer-curl', 'hammer+curl+hindi', 'Renaissance+Periodization+hammer+curl'],
  ['Wed', 'leg-press', 'leg+press+proper+form+hindi', 'Jeff+Nippard+leg+press+technique'],
  ['Wed', 'seated-leg-curl', 'leg+curl+hindi', 'Renaissance+Periodization+leg+curl'],
  ['Wed', 'leg-extension', 'leg+extension+hindi', 'Renaissance+Periodization+leg+extension'],
  ['Wed', 'standing-calf-raise', 'standing+calf+raise+hindi', 'Jeff+Nippard+calf+raise'],
  ['Wed', 'plank', 'plank+exercise+hindi', 'plank+exercise+technique'],
  ['Wed', 'dead-bug', 'dead+bug+exercise+hindi', 'dead+bug+exercise+technique'],
  ['Thu', 'shoulder-press', 'shoulder+press+hindi+proper+form', 'Jeff+Nippard+shoulder+press'],
  ['Thu', 'lateral-raise', 'lateral+raises+hindi', 'Renaissance+Periodization+lateral+raise'],
  ['Thu', 'rear-delt-fly', 'rear+delt+fly+hindi', 'Jeff+Nippard+rear+delt+fly'],
  ['Thu', 'narrow-push-up', 'close+grip+pushups+hindi', 'close+grip+pushup+technique'],
  ['Thu', 'cable-triceps-extension', 'cable+triceps+extension+hindi', 'Renaissance+Periodization+cable+triceps+extension'],
  ['Fri', 'incline-bench-press', 'incline+chest+press+hindi', 'Jeff+Nippard+incline+chest+press'],
  ['Fri', 'bench-press', 'flat+dumbbell+press+hindi', 'Jeff+Nippard+dumbbell+bench+press'],
  ['Fri', 'lat-pulldown', 'lat+pulldown+hindi+proper+form', 'Jeff+Nippard+lat+pulldown+technique'],
  ['Fri', 'cable-row', 'seated+cable+row+hindi', 'Renaissance+Periodization+seated+cable+row'],
  ['Fri', 'cable-face-pull', 'face+pulls+hindi', 'Jeff+Nippard+face+pulls'],
  ['Sat', 'goblet-squat', 'goblet+squat+hindi', 'Jeff+Nippard+goblet+squat'],
  ['Sat', 'romanian-deadlift', 'romanian+deadlift+hindi+proper+form', 'Jeff+Nippard+romanian+deadlift'],
  ['Sat', 'walking-lunge', 'walking+lunges+hindi', 'Renaissance+Periodization+walking+lunges'],
  ['Sat', 'standing-calf-raise', 'standing+calf+raise+hindi', 'Jeff+Nippard+calf+raise'],
  ['Sat', 'plank', 'plank+exercise+hindi', 'plank+exercise+technique'],
  ['Sat', 'treadmill-walk', 'beginner+cardio+workout+hindi', 'beginner+cardio+science+based'],
].map(([day, exerciseId, hindi, english]) => Object.freeze({ day, exerciseId, videoLinks: video(hindi, english) })));

export const RECOMPOSITION_SOURCE_DAYS = Object.freeze([
  ['Mon', 'Chest & triceps', ['Chest', 'Triceps']],
  ['Tue', 'Back & biceps', ['Back', 'Biceps']],
  ['Wed', 'Legs & core', ['Legs', 'Core']],
  ['Thu', 'Shoulders & triceps', ['Shoulders', 'Triceps']],
  ['Fri', 'Chest & back', ['Chest', 'Back']],
  ['Sat', 'Legs, core & cardio', ['Legs', 'Core', 'Cardio']],
  ['Sun', 'Complete rest', ['Mobility']],
].map(([day, title, muscleGroups]) => Object.freeze({
  day,
  title,
  muscleGroups: Object.freeze(muscleGroups),
  exerciseIds: Object.freeze(RECOMPOSITION_SOURCE_ROWS.filter((row) => row.day === day).map((row) => row.exerciseId)),
})));

const defaultVideoLinks = {};
for (const row of RECOMPOSITION_SOURCE_ROWS) defaultVideoLinks[row.exerciseId] ||= row.videoLinks;
defaultVideoLinks['stationary-bike'] = defaultVideoLinks['treadmill-walk'];
export const RECOMPOSITION_VIDEO_LINKS = Object.freeze(defaultVideoLinks);

const COMPOUNDS = new Set(['chest-press-machine', 'incline-bench-press', 'lat-pulldown', 'cable-row', 'single-arm-dumbbell-row', 'leg-press', 'shoulder-press', 'narrow-push-up', 'bench-press', 'goblet-squat', 'romanian-deadlift', 'walking-lunge', 'dead-bug']);

function targetFor(id, sets) {
  if (id === 'treadmill-walk' || id === 'stationary-bike') return { sets: 1, reps: '10–15', unit: 'min', restSeconds: 0 };
  if (id === 'plank') return { sets, reps: '20–30', unit: 'sec', restSeconds: 45 };
  return { sets, reps: COMPOUNDS.has(id) ? '8–12' : '10–15', unit: 'reps', restSeconds: COMPOUNDS.has(id) ? 90 : 60 };
}

// Targets are validated by the caller. Include one minute to set up each
// exercise, and round only after combining all exercises in the workout.
export function estimateTargetSeconds(target) {
  const bounds = target.reps.split(/[–—-]/).map(Number);
  const midpoint = bounds.reduce((sum, value) => sum + value, 0) / bounds.length;
  const effort = midpoint * (target.unit === 'min' ? 60 : target.unit === 'sec' ? 1 : 3);
  return effort * target.sets + target.restSeconds * Math.max(0, target.sets - 1) + 60;
}

export function estimateTargetMinutes(targets) {
  const seconds = Object.values(targets).reduce((total, target) => total + estimateTargetSeconds(target), 0);
  return seconds > 0 ? Math.max(1, Math.ceil(seconds / 60)) : 0;
}

export function getRecompositionWeekPlan(level = 'beginner') {
  const sets = level === 'medium' || level === 'experienced' ? 3 : 2;
  return RECOMPOSITION_SOURCE_DAYS.map((source) => {
    const rest = source.exerciseIds.length === 0;
    const exerciseTargets = Object.fromEntries(source.exerciseIds.map((id) => [id, targetFor(id, sets)]));
    const exerciseVideoLinks = Object.fromEntries(RECOMPOSITION_SOURCE_ROWS.filter((row) => row.day === source.day).map((row) => [row.exerciseId, { ...row.videoLinks }]));
    return {
      day: source.day,
      title: source.title,
      focus: rest ? 'A day off from training' : source.muscleGroups.join(' · '),
      duration: rest ? 0 : estimateTargetMinutes(exerciseTargets),
      exerciseIds: [...source.exerciseIds],
      sets: rest ? 1 : sets,
      reps: rest ? '6' : '8–12',
      muscleGroups: [...source.muscleGroups],
      rest,
      custom: false,
      customTitle: false,
      intensity: rest ? 'recovery' : 'strength',
      fitnessGoal: 'body-recomposition',
      programId: RECOMPOSITION_PROGRAM_ID,
      sourceLabel: RECOMPOSITION_SOURCE_LABEL,
      targetOrigin: 'app-starting-targets',
      targetNote: RECOMPOSITION_TARGET_NOTE,
      videoNote: RECOMPOSITION_VIDEO_NOTE,
      exerciseTargets,
      exerciseVideoLinks,
    };
  });
}
