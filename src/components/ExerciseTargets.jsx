import TouchSelect from './TouchSelect';
import { getExerciseTarget, normalizeExerciseTargets } from '../workoutTargets';
import './ExerciseTargets.css';

export function targetErrors(plan, exercises) {
  return exercises.filter(exercise => plan.exerciseTargets?.[exercise.id]
    && !normalizeExerciseTargets(plan.exerciseTargets, [exercise.id])[exercise.id]);
}

export function TargetSummary({ plan, exercise, showRest = false }) {
  const target = getExerciseTarget(plan, exercise);
  return <span className="exercise-target-summary">{target.sets} {target.sets === 1 ? 'set' : 'sets'} × {target.reps} {target.unit}{showRest && target.restSeconds > 0 && <small>Rest {target.restSeconds}s</small>}</span>;
}

export default function ExerciseTargets({ plan, exercises, onChange, disabled = false }) {
  if (!exercises.length) return null;
  const invalid = new Set(targetErrors(plan, exercises).map(exercise => exercise.id));
  const update = (exercise, field, value) => onChange({
    ...(plan.exerciseTargets || {}),
    [exercise.id]: { ...getExerciseTarget({ ...plan, sets: Number(plan.sets) }, exercise), ...plan.exerciseTargets?.[exercise.id], [field]: value },
  });
  return <details className="exercise-target-editor">
    <summary>Set targets for each exercise <span>Sets, reps, time & rest</span></summary>
    <p>Use seconds for holds and minutes for cardio. These targets take priority over the day’s default sets and reps.</p>
    <div className="exercise-target-fields">{exercises.map(exercise => {
      const target = { ...getExerciseTarget({ ...plan, sets: Number(plan.sets) }, exercise), ...plan.exerciseTargets?.[exercise.id] };
      return <fieldset key={exercise.id} disabled={disabled} className={invalid.has(exercise.id) ? 'has-error' : ''}>
        <legend>{exercise.name}</legend>
        <div className="exercise-target-inputs">
          <label>Sets<TouchSelect aria-label={`${exercise.name} sets`} value={target.sets} onChange={event => update(exercise, 'sets', Number(event.target.value))}>{Array.from({ length: 20 }, (_, index) => index + 1).map(sets => <option value={sets} key={sets}>{sets}</option>)}</TouchSelect></label>
          <label>Target<input aria-label={`${exercise.name} target`} value={target.reps} maxLength={16} placeholder="8–12" onChange={event => update(exercise, 'reps', event.target.value)} aria-invalid={invalid.has(exercise.id)}/></label>
          <label>Unit<TouchSelect aria-label={`${exercise.name} unit`} value={target.unit} onChange={event => update(exercise, 'unit', event.target.value)}><option value="reps">Reps</option><option value="sec">Seconds</option><option value="min">Minutes</option></TouchSelect></label>
          <label>Rest (seconds)<input aria-label={`${exercise.name} rest seconds`} type="number" min="0" max="600" step="1" value={target.restSeconds} onChange={event => update(exercise, 'restSeconds', event.target.value === '' ? '' : Number(event.target.value))}/></label>
        </div>
        {invalid.has(exercise.id) && <p className="exercise-target-error" role="status">Enter a positive target or increasing range, and 0–600 seconds of rest.</p>}
      </fieldset>;
    })}</div>
  </details>;
}
