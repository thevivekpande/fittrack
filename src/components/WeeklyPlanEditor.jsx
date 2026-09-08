import { useRef, useState } from 'react';
import { AlertCircle, ArrowRight, Check, CheckCheck, Clock3, Dumbbell, Leaf, LoaderCircle, Repeat2, Search, X } from 'lucide-react';
import { MUSCLE_GROUPS } from '../data';
import { MAX_PLAN_EXERCISES, estimateWorkoutMinutes, hasCustomPlanTitle } from '../planning';
import './WeeklyPlanEditor.css';
import { matchesExercise, muscleLabel } from '../exerciseSearch';

const FULL_DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const SHORT_DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const exerciseGroups = (exercise) => exercise?.muscleGroups || (exercise?.group ? [exercise.group] : []);
const groupTitle = (groups) => groups.join(' & ');

function inferGroups(plan, exercises) {
  if (plan.rest) return ['Mobility'];
  if (Array.isArray(plan.muscleGroups) && plan.muscleGroups.length) return [...plan.muscleGroups];
  const groups = new Set((plan.exerciseIds || []).flatMap((id) => exerciseGroups(exercises.find((exercise) => exercise.id === id))));
  return MUSCLE_GROUPS.filter((group) => groups.has(group));
}

function validReps(value) {
  if (!/^\d{1,2}(?:\s*[-–—]\s*\d{1,2})?$/.test(String(value).trim())) return false;
  const numbers = String(value).trim().split(/\s*[-–—]\s*/).map(Number);
  return numbers.every((number) => number >= 1 && number <= 30) && (numbers.length === 1 || numbers[1] >= numbers[0]);
}

export default function WeeklyPlanEditor({ plans, exercises, trainingPlace, level, onSave, onCancel }) {
  const eligibleGroups = MUSCLE_GROUPS.filter((group) => exercises.some((exercise) => exerciseGroups(exercise).includes(group)));
  const mobility = exercises.filter((exercise) => exerciseGroups(exercise).includes('Mobility'));
  const recoveryIds = ['standing-reach', 'easy-squat'].filter((id) => mobility.some((exercise) => exercise.id === id));
  mobility.forEach((exercise) => { if (recoveryIds.length < 2 && !recoveryIds.includes(exercise.id)) recoveryIds.push(exercise.id); });
  const trainingSeed = plans.find((plan) => !plan.rest);
  const [drafts, setDrafts] = useState(() => SHORT_DAYS.map((day, index) => {
    const plan = plans[index] || { day, exerciseIds: [], sets: '', reps: '', rest: false };
    const groups = inferGroups(plan, exercises);
    return {
      ...plan,
      day,
      muscleGroups: groups,
      exerciseIds: [...(plan.exerciseIds || [])],
      sets: String(plan.sets ?? ''),
      reps: String(plan.reps ?? ''),
      name: hasCustomPlanTitle(plan, exercises) ? plan.title : '',
    };
  }));
  const [selectedDay, setSelectedDay] = useState(0);
  const [query, setQuery] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const savingRef = useRef(false);
  const dayHeadingRef = useRef(null);
  const current = drafts[selectedDay];
  const currentExercises = current.exerciseIds.map((id) => exercises.find((exercise) => exercise.id === id)).filter(Boolean);

  function draftError(draft) {
    if (draft.rest) return recoveryIds.length < 2 ? 'This plan needs two available mobility exercises for recovery.' : '';
    if (!draft.muscleGroups.length) return 'Choose at least one muscle group for this day.';
    const unsupported = draft.muscleGroups.filter((group) => !eligibleGroups.includes(group));
    if (unsupported.length) return `${unsupported.join(' and ')} exercises aren’t available for this training location. Remove that focus to continue.`;
    if (!draft.exerciseIds.length) return 'Choose at least one exercise for this day.';
    if (draft.exerciseIds.length > MAX_PLAN_EXERCISES) return `Choose up to ${MAX_PLAN_EXERCISES} exercises for this day. Remove ${draft.exerciseIds.length - MAX_PLAN_EXERCISES} to continue.`;
    if (draft.exerciseIds.some((id) => !exercises.some((exercise) => exercise.id === id))) return 'An exercise is unavailable here. Update this day’s exercise choices.';
    const uncovered = draft.muscleGroups.filter((group) => !draft.exerciseIds.some((id) => exerciseGroups(exercises.find((exercise) => exercise.id === id)).includes(group)));
    if (uncovered.length) return `Choose at least one exercise for ${uncovered.join(' and ')}.`;
    const sets = Number(draft.sets);
    if (!Number.isInteger(sets) || sets < 1 || sets > 6) return 'Choose between 1 and 6 sets per exercise.';
    if (!validReps(draft.reps)) return 'Enter 1–30 reps, or a range such as 8–12.';
    if (draft.name.trim().length > 70) return 'Keep the workout name to 70 characters or fewer.';
    return '';
  }

  function normalizeDay(draft) {
    const rest = Boolean(draft.rest);
    const ids = rest ? recoveryIds : draft.exerciseIds;
    const selected = ids.map((id) => exercises.find((exercise) => exercise.id === id)).filter(Boolean);
    const sets = rest ? 1 : Number(draft.sets);
    const muscleGroups = rest ? ['Mobility'] : [...draft.muscleGroups];
    return {
      day: draft.day,
      title: rest ? 'Rest & recovery' : draft.name.trim() || groupTitle(muscleGroups),
      focus: rest ? 'Gentle movement & mobility' : groupTitle(muscleGroups),
      duration: estimateWorkoutMinutes(selected, sets, rest),
      exerciseIds: [...ids],
      sets,
      reps: rest ? '6' : String(draft.reps).trim().replace(/\s*[-–—]\s*/g, '–'),
      rest,
      custom: true,
      customTitle: !rest && Boolean(draft.name.trim()),
      muscleGroups,
    };
  }

  const dayErrors = drafts.map(draftError);
  const invalidCount = dayErrors.filter(Boolean).length;
  const firstInvalidDay = dayErrors.findIndex(Boolean);
  const trainingDays = drafts.filter((day) => !day.rest).length;
  const preview = normalizeDay(current);
  const availableChoices = exercises.filter((exercise) => exerciseGroups(exercise).some((group) => current.muscleGroups.includes(group)));
  const matchingExercises = availableChoices.filter((exercise) => matchesExercise(exercise, query));
  const levelLabel = level === 'medium' ? 'medium' : level === 'experienced' ? 'experienced' : 'beginner';
  const placeLabel = trainingPlace === 'home' ? 'home' : 'gym';

  function selectDay(index, focus = false) {
    setSelectedDay(index);
    setQuery('');
    if (focus) requestAnimationFrame(() => dayHeadingRef.current?.focus());
  }

  function updateCurrent(updater) {
    setDrafts((previous) => previous.map((draft, index) => index === selectedDay ? updater(draft) : draft));
    setSaveError('');
  }

  function toggleGroup(group) {
    updateCurrent((draft) => {
      const adding = !draft.muscleGroups.includes(group);
      const groups = adding ? MUSCLE_GROUPS.filter((item) => draft.muscleGroups.includes(item) || item === group) : draft.muscleGroups.filter((item) => item !== group);
      const keptIds = draft.exerciseIds.filter((id) => exerciseGroups(exercises.find((exercise) => exercise.id === id)).some((item) => groups.includes(item)));
      if (adding) {
        const candidates = exercises.filter((exercise) => exerciseGroups(exercise).includes(group));
        const alreadyChosen = candidates.filter((exercise) => keptIds.includes(exercise.id)).length;
        candidates.filter((exercise) => !keptIds.includes(exercise.id)).slice(0, Math.max(0, 2 - alreadyChosen)).forEach((exercise) => keptIds.push(exercise.id));
      }
      return { ...draft, muscleGroups: groups, exerciseIds: keptIds };
    });
  }

  function toggleExercise(id, checked) {
    updateCurrent((draft) => {
      if (checked && (draft.exerciseIds.includes(id) || draft.exerciseIds.length >= MAX_PLAN_EXERCISES)) return draft;
      return { ...draft, exerciseIds: checked ? [...draft.exerciseIds, id] : draft.exerciseIds.filter((value) => value !== id) };
    });
  }

  function toggleRecovery(checked) {
    setQuery('');
    updateCurrent((draft) => {
      if (checked) return { ...draft, previousWorkout: { ...draft }, rest: true, muscleGroups: ['Mobility'], exerciseIds: [...recoveryIds], sets: '1', reps: '6', name: '' };
      if (draft.previousWorkout) return { ...draft.previousWorkout, previousWorkout: undefined, rest: false };
      return { ...draft, rest: false, muscleGroups: [], exerciseIds: [], sets: String(trainingSeed?.sets ?? ''), reps: String(trainingSeed?.reps ?? ''), name: '' };
    });
  }

  async function handleSave(event) {
    event.preventDefault();
    if (savingRef.current) return;
    if (invalidCount) { selectDay(firstInvalidDay, true); return; }
    savingRef.current = true;
    setSaving(true);
    setSaveError('');
    try {
      await onSave(drafts.map(normalizeDay));
    } catch (error) {
      setSaveError(error?.message || 'Your weekly split couldn’t be saved. Please try again.');
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  }

  return <form className="weekly-editor" onSubmit={handleSave} noValidate aria-busy={saving}>
    <div className="weekly-editor-intro"><span className="weekly-editor-repeat"><Repeat2 size={19} /></span><div><strong>A week that works for you.</strong><p>Repeats every week for your {placeLabel} {levelLabel} plan.</p></div><span className="weekly-editor-count"><Dumbbell size={13} />{trainingDays} training day{trainingDays === 1 ? '' : 's'}</span></div>
    <div className="weekly-editor-layout">
      <nav className="weekly-day-rail" aria-label="Days of your weekly split">
        {drafts.map((draft, index) => <button key={draft.day} type="button" className={`weekly-day-button${selectedDay === index ? ' is-selected' : ''}${dayErrors[index] ? ' has-error' : ''}`} aria-pressed={selectedDay === index} onClick={() => selectDay(index)} disabled={saving}>
          <span className="weekly-day-name">{FULL_DAYS[index]}{dayErrors[index] ? <AlertCircle size={12} aria-label="Needs attention" /> : draft.rest ? <Leaf size={12} /> : <span className="weekly-day-dot" />}</span>
          <span className="weekly-day-focus">{draft.rest ? 'Rest & recovery' : groupTitle(draft.muscleGroups) || 'Choose your focus'}</span>
        </button>)}
      </nav>

      <section className="weekly-day-form" aria-labelledby="weekly-day-heading">
        <div className="weekly-day-heading"><div><span className="weekly-editor-eyebrow">YOUR {FULL_DAYS[selectedDay].toUpperCase()} ROUTINE</span><h3 id="weekly-day-heading" tabIndex={-1} ref={dayHeadingRef}>{current.rest ? 'Room to recover.' : 'Choose your focus.'}</h3></div><label className="weekly-rest-toggle"><input type="checkbox" checked={current.rest} disabled={saving} onChange={(event) => toggleRecovery(event.target.checked)} /><span className="weekly-toggle-track" aria-hidden="true" /><span>Rest & recovery</span></label></div>

        {current.rest ? <div className="weekly-recovery-content"><div className="weekly-recovery-symbol"><span /><Leaf size={33} strokeWidth={1.4} /></div><h4>A little pause is part of the plan.</h4><p>Keep {FULL_DAYS[selectedDay]} gentle with a short mobility session. Your next workout will be waiting.</p><div className="weekly-recovery-exercises">{recoveryIds.map((id) => { const exercise = exercises.find((item) => item.id === id); return <div key={id}><Check size={13} /><span>{exercise?.name}</span><small>1 set · 6 reps</small></div>; })}</div><span className="weekly-recovery-duration"><Clock3 size={13} />About {preview.duration} minutes of easy movement</span></div> : <>
          <fieldset className="weekly-muscle-fieldset" disabled={saving}><legend>Muscle groups</legend><div className="weekly-muscle-options">{eligibleGroups.map((group) => <label className="weekly-muscle-option" key={group}><input type="checkbox" checked={current.muscleGroups.includes(group)} onChange={() => toggleGroup(group)} /><span>{current.muscleGroups.includes(group) && <Check size={11} />}{muscleLabel(group)}</span></label>)}</div>{current.muscleGroups.filter((group) => !eligibleGroups.includes(group)).map((group) => <button key={group} className="weekly-unsupported-group" type="button" onClick={() => toggleGroup(group)}>Remove unavailable {group} <X size={12} /></button>)}</fieldset>

          <div className="weekly-exercises-heading"><h4>Choose your exercises <span>{currentExercises.length}/{MAX_PLAN_EXERCISES}</span></h4><span><Clock3 size={12} />About {preview.duration} min</span></div>
          <p className="weekly-suggestion-note">We suggest up to two exercises per muscle group. Choose up to {MAX_PLAN_EXERCISES} per day; remove a selected exercise to make room.</p>
          <div className="weekly-exercise-search"><Search size={15} /><input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search these exercises…" aria-label={`Search ${FULL_DAYS[selectedDay]} exercises`} disabled={saving || !current.muscleGroups.length} />{query && <button type="button" onClick={() => setQuery('')} aria-label="Clear exercise search"><X size={13} /></button>}</div>
          <div className="weekly-exercise-options" aria-label={`${FULL_DAYS[selectedDay]} exercise choices`}>
            {matchingExercises.map((exercise) => <label className={`weekly-exercise-option${current.exerciseIds.includes(exercise.id) ? ' is-checked' : ''}`} key={exercise.id}><input type="checkbox" checked={current.exerciseIds.includes(exercise.id)} disabled={saving || (!current.exerciseIds.includes(exercise.id) && current.exerciseIds.length >= MAX_PLAN_EXERCISES)} onChange={(event) => toggleExercise(exercise.id, event.target.checked)} /><span><strong>{exercise.name}</strong><small>{exerciseGroups(exercise).map(muscleLabel).join(', ')} <i>·</i> {exercise.equipment}</small></span><span className="weekly-exercise-duration">{exercise.duration} min</span></label>)}
            {!matchingExercises.length && <div className="weekly-exercise-empty"><Dumbbell size={20} /><p>{current.muscleGroups.length ? 'No matches. Try another exercise name.' : 'Choose a muscle group to see your exercises.'}</p>{query && <button type="button" onClick={() => setQuery('')}>Clear search</button>}</div>}
          </div>

          <div className="weekly-workout-fields"><div><label htmlFor="weekly-sets">Sets per exercise</label><select id="weekly-sets" value={current.sets} disabled={saving} onChange={(event) => updateCurrent((draft) => ({ ...draft, sets: event.target.value }))}><option value="" disabled>Choose sets</option>{[1, 2, 3, 4, 5, 6].map((sets) => <option key={sets} value={sets}>{sets} set{sets === 1 ? '' : 's'}</option>)}</select></div><div><label htmlFor="weekly-reps">Reps per set</label><input id="weekly-reps" type="text" inputMode="text" value={current.reps} placeholder="e.g. 8–12" maxLength={7} disabled={saving} onChange={(event) => updateCurrent((draft) => ({ ...draft, reps: event.target.value }))} aria-invalid={!validReps(current.reps)} /></div><div className="weekly-name-field"><label htmlFor="weekly-name">Workout name <span>Optional</span></label><input id="weekly-name" type="text" value={current.name} maxLength={70} placeholder={groupTitle(current.muscleGroups) || 'Name your workout'} disabled={saving} onChange={(event) => updateCurrent((draft) => ({ ...draft, name: event.target.value }))} /></div></div>
        </>}
        {dayErrors[selectedDay] && <p className="weekly-day-error" role="status"><AlertCircle size={14} />{dayErrors[selectedDay]}</p>}
      </section>
    </div>

    {saveError && <p className="weekly-save-error" role="alert">{saveError}</p>}
    <div className="weekly-editor-footer"><div><p><Repeat2 size={13} /><span>Repeats every week. Saving replaces individual day edits from this week onward.</span></p>{invalidCount > 0 ? <button className="weekly-review-error" type="button" onClick={() => selectDay(firstInvalidDay, true)} disabled={saving}>{invalidCount} day{invalidCount === 1 ? '' : 's'} need{invalidCount === 1 ? 's' : ''} attention · Review {FULL_DAYS[firstInvalidDay]} <ArrowRight size={12} /></button> : <span className="weekly-ready"><CheckCheck size={12} />All seven days are ready.</span>}</div><div className="weekly-editor-actions"><button className="weekly-cancel" type="button" onClick={onCancel} disabled={saving}>Cancel</button><button className="weekly-save" type="submit" disabled={saving || invalidCount > 0}>{saving ? <><LoaderCircle size={15} className="weekly-spinner" />Saving…</> : <>Save weekly split <ArrowRight size={15} /></>}</button></div></div>
  </form>;
}
