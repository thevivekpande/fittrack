export const muscleLabel = group => group === 'Core' ? 'Abs & core' : group;

export function matchesExercise(exercise, query) {
  const aliases = exercise.group === 'Core' ? 'abs abdominal abdominals stomach core' : '';
  return `${exercise.name} ${exercise.group} ${exercise.equipment} ${aliases}`.toLowerCase().includes(query.trim().toLowerCase());
}
