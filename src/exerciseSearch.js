export const muscleLabel = group => group === 'Core' ? 'Abs & core' : group;

export function matchesExercise(exercise, query) {
  const aliases = exercise.group === 'Core' ? 'abs abdominal abdominals stomach core' : '';
  return `${exercise.name} ${exercise.group} ${exercise.equipment} ${aliases}`.toLowerCase().includes(query.trim().toLowerCase());
}

export const exerciseUnit = exercise => ['walking', 'cycling'].includes(exercise?.movement) ? 'min'
  : ['plank', 'sideplank'].includes(exercise?.movement) ? 'sec' : 'reps';
