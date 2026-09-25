import { useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { AlertCircle, ArrowRight, Check, CheckCheck, Clock3, Dumbbell, Leaf, LoaderCircle, Plus, Repeat2, Search, X } from 'lucide-react';
import { MUSCLE_GROUPS } from '../data';
import { MAX_PLAN_EXERCISES, estimateWorkoutMinutes, hasCustomPlanTitle } from '../planning';
import './WeeklyPlanEditor.css';
import { matchesExercise, muscleLabel } from '../exerciseSearch';
import { cloneExerciseTargets } from '../workoutTargets';
import ExerciseTargets, { targetErrors, TargetSummary } from './ExerciseTargets';

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

export default function WeeklyPlanEditor({ plans, exercises, trainingPlace, level, initialDay = 0, mobile = false, footerTarget = null, onSave, onCancel }) {
  const formId = useId();
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
      exerciseTargets: structuredClone(plan.exerciseTargets || {}),
      fullRest: plan.rest && !plan.exerciseIds?.length,
      sets: String(plan.sets ?? ''),
      reps: String(plan.reps ?? ''),
      name: plan.programId || hasCustomPlanTitle(plan, exercises) ? plan.title : '',
    };
  }));
  const [selectedDay, setSelectedDay] = useState(() => Number.isInteger(initialDay) && initialDay >= 0 && initialDay < 7 ? initialDay : 0);
  const [query, setQuery] = useState('');
  const [mobileTab, setMobileTab] = useState('exercises');
  const [addingExercises, setAddingExercises] = useState(false);
  const [mobileFilter, setMobileFilter] = useState('All');
  const [resultLimit, setResultLimit] = useState(6);
  const [mobileNotice, setMobileNotice] = useState('');
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const savingRef = useRef(false);
  const dayHeadingRef = useRef(null);
  const dayRailRef = useRef(null);
  const selectedDayButtonRef = useRef(null);
  const mobileSearchRef = useRef(null);
  const current = drafts[selectedDay];
  const currentExercises = current.exerciseIds.map((id) => exercises.find((exercise) => exercise.id === id)).filter(Boolean);

  useEffect(() => {
    const rail = dayRailRef.current;
    const button = selectedDayButtonRef.current;
    if (rail && button && rail.scrollWidth > rail.clientWidth) {
      const left = rail.scrollLeft + button.getBoundingClientRect().left - rail.getBoundingClientRect().left - (rail.clientWidth - button.clientWidth) / 2;
      rail.scrollTo({ left: Math.max(0, left), behavior: 'auto' });
    }
  }, [selectedDay]);

  function draftError(draft) {
    if (draft.rest) return !draft.fullRest && recoveryIds.length < 2 ? 'This plan needs two available mobility exercises for recovery.' : '';
    if (!draft.muscleGroups.length) return mobile ? 'Add at least one exercise for this day.' : 'Choose at least one muscle group for this day.';
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
    if (targetErrors(draft, draft.exerciseIds.map(id => exercises.find(exercise => exercise.id === id))).length) return 'Check the individual exercise targets below.';
    if (draft.name.trim().length > 70) return 'Keep the workout name to 70 characters or fewer.';
    return '';
  }

  function normalizeDay(draft) {
    const rest = Boolean(draft.rest);
    const ids = rest ? draft.fullRest ? [] : recoveryIds : draft.exerciseIds;
    const selected = ids.map((id) => exercises.find((exercise) => exercise.id === id)).filter(Boolean);
    const sets = rest ? 1 : Number(draft.sets);
    const muscleGroups = rest ? ['Mobility'] : [...draft.muscleGroups];
    const exerciseTargets = rest ? {} : cloneExerciseTargets(draft.exerciseTargets, ids);
    return {
      ...(draft.programId && { programId: draft.programId, sourceLabel: draft.sourceLabel, targetOrigin: draft.targetOrigin, targetNote: draft.targetNote, videoNote: draft.videoNote }),
      ...(draft.exerciseVideoLinks && { exerciseVideoLinks: Object.fromEntries(ids.filter(id => draft.exerciseVideoLinks[id]).map(id => [id, { ...draft.exerciseVideoLinks[id] }])) }),
      day: draft.day,
      title: rest ? draft.fullRest ? 'Rest day' : 'Rest & recovery' : draft.name.trim() || groupTitle(muscleGroups),
      focus: rest ? draft.fullRest ? 'Complete rest' : 'Gentle movement & mobility' : groupTitle(muscleGroups),
      duration: estimateWorkoutMinutes(selected, sets, rest, exerciseTargets),
      exerciseIds: [...ids],
      exerciseTargets,
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
  const availableChoices = query.trim() ? exercises : exercises.filter((exercise) => current.exerciseIds.includes(exercise.id) || exerciseGroups(exercise).some((group) => current.muscleGroups.includes(group)));
  const matchingExercises = availableChoices.filter((exercise) => matchesExercise(exercise, query));
  const levelLabel = level === 'medium' ? 'medium' : level === 'experienced' ? 'experienced' : 'beginner';
  const placeLabel = trainingPlace === 'home' ? 'home' : 'gym';

  function selectDay(index, focus = false) {
    setSelectedDay(index);
    setQuery('');
    setAddingExercises(false);
    setMobileFilter('All');
    setResultLimit(6);
    setMobileNotice('');
    const draft = drafts[index];
    const needsTargets = !draft.rest && (!Number.isInteger(Number(draft.sets)) || Number(draft.sets) < 1 || Number(draft.sets) > 6 || !validReps(draft.reps) || draft.name.trim().length > 70 || targetErrors(draft, draft.exerciseIds.map(id => exercises.find(exercise => exercise.id === id)).filter(Boolean)).length);
    setMobileTab(focus && needsTargets ? 'targets' : 'exercises');
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
      const keptIds = adding ? [...draft.exerciseIds] : draft.exerciseIds.filter((id) => {
        const trained = exerciseGroups(exercises.find((exercise) => exercise.id === id));
        return !trained.includes(group) || trained.some(item => groups.includes(item));
      });
      if (adding) {
        const candidates = exercises.filter((exercise) => exerciseGroups(exercise).includes(group));
        const alreadyChosen = candidates.filter((exercise) => keptIds.includes(exercise.id)).length;
        candidates.filter((exercise) => !keptIds.includes(exercise.id)).slice(0, Math.max(0, Math.min(2 - alreadyChosen, MAX_PLAN_EXERCISES - keptIds.length))).forEach((exercise) => keptIds.push(exercise.id));
      }
      return { ...draft, muscleGroups: groups, exerciseIds: keptIds };
    });
  }

  function toggleExercise(id, checked) {
    updateCurrent((draft) => {
      if (checked && (draft.exerciseIds.includes(id) || draft.exerciseIds.length >= MAX_PLAN_EXERCISES)) return draft;
      const addedGroups = checked ? exerciseGroups(exercises.find((exercise) => exercise.id === id)) : [];
      return {
        ...draft,
        muscleGroups: checked ? MUSCLE_GROUPS.filter((group) => draft.muscleGroups.includes(group) || addedGroups.includes(group)) : draft.muscleGroups,
        exerciseIds: checked ? [...draft.exerciseIds, id] : draft.exerciseIds.filter((value) => value !== id),
      };
    });
  }

  function toggleRecovery(checked) {
    setQuery('');
    setAddingExercises(false);
    setMobileTab('exercises');
    setMobileNotice('');
    updateCurrent((draft) => {
      if (checked) return { ...draft, previousWorkout: { ...draft }, rest: true, fullRest: true, muscleGroups: ['Mobility'], exerciseIds: [], sets: '1', reps: '6', name: '' };
      if (draft.previousWorkout) return { ...draft.previousWorkout, previousWorkout: undefined, rest: false };
      return { ...draft, rest: false, muscleGroups: [], exerciseIds: [], sets: String(trainingSeed?.sets ?? ''), reps: String(trainingSeed?.reps ?? ''), name: '' };
    });
  }

  function changeMobileExercise(id, checked) {
    const exercise = exercises.find(item => item.id === id);
    if (!exercise || (checked && current.exerciseIds.length >= MAX_PLAN_EXERCISES)) return;
    updateCurrent(draft => {
      const exerciseIds = checked ? [...new Set([...draft.exerciseIds, id])] : draft.exerciseIds.filter(value => value !== id);
      const trained = new Set(exerciseIds.flatMap(value => exerciseGroups(exercises.find(item => item.id === value))));
      return { ...draft, exerciseIds, muscleGroups: MUSCLE_GROUPS.filter(group => trained.has(group)) };
    });
    if (checked) setAddingExercises(true);
    setMobileNotice(`${exercise.name} ${checked ? 'added to' : 'removed from'} ${FULL_DAYS[selectedDay]}.`);
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

  if (mobile) {
    const showAdd = addingExercises || currentExercises.length === 0;
    const results = exercises.filter(exercise => !current.exerciseIds.includes(exercise.id)
      && (mobileFilter === 'All' || exerciseGroups(exercise).includes(mobileFilter))
      && matchesExercise(exercise, query)).sort((left, right) => {
      const preferred = exercise => exerciseGroups(exercise).some(group => current.muscleGroups.includes(group)) ? 1 : 0;
      return preferred(right) - preferred(left);
    });
    const footer = <div className={`weekly-mobile-footer${footerTarget ? '' : ' weekly-mobile-footer-inline'}`}>
      {invalidCount ? <button type="button" className="weekly-mobile-review" onClick={() => selectDay(firstInvalidDay, true)} disabled={saving}><AlertCircle size={14}/>{invalidCount} day{invalidCount === 1 ? '' : 's'} to finish · Review {FULL_DAYS[firstInvalidDay]}<ArrowRight size={14}/></button> : <p><Repeat2 size={13}/>Repeats every week · {trainingDays} workout{trainingDays === 1 ? '' : 's'}</p>}
      <div><button type="button" className="weekly-mobile-cancel" onClick={onCancel} disabled={saving}>Cancel</button><button type="submit" form={formId} className="weekly-mobile-save" disabled={saving || invalidCount > 0}>{saving ? <><LoaderCircle size={16} className="weekly-spinner"/>Saving…</> : <>Save week<Check size={16}/></>}</button></div>
    </div>;
    return <>
      <form id={formId} className="weekly-editor weekly-editor-mobile" onSubmit={handleSave} noValidate aria-busy={saving}>
        <div className="weekly-mobile-day">
          <label htmlFor={`${formId}-day`}><span>Edit a day</span><select id={`${formId}-day`} ref={dayHeadingRef} value={selectedDay} onChange={event => selectDay(Number(event.target.value))} disabled={saving}>{drafts.map((draft, index) => <option key={draft.day} value={index}>{FULL_DAYS[index]}{draft.rest ? ' · Rest' : ''}{dayErrors[index] ? ' · Needs attention' : ''}</option>)}</select></label>
          <label className="weekly-rest-toggle"><input type="checkbox" checked={current.rest} disabled={saving} onChange={event => toggleRecovery(event.target.checked)} aria-label={`Make ${FULL_DAYS[selectedDay]} a rest day`}/><span className="weekly-toggle-track" aria-hidden="true"/><span>Rest day</span></label>
        </div>
        {current.rest ? <div className="weekly-mobile-rest"><Leaf size={23}/><h3>{FULL_DAYS[selectedDay]} is for recovery.</h3><p>{current.fullRest ? 'No exercises scheduled.' : 'A short mobility session is included.'}</p><label className="weekly-mobility-choice"><input type="checkbox" checked={!current.fullRest} disabled={saving} onChange={event => updateCurrent(draft => ({ ...draft, fullRest: !event.target.checked }))}/>Include gentle mobility</label>{!current.fullRest && <ul>{recoveryIds.map(id => <li key={id}>{exercises.find(exercise => exercise.id === id)?.name}<span>1 set × 6 reps</span></li>)}</ul>}</div> : <>
          <div className="weekly-mobile-tabs" role="tablist" aria-label="Edit workout details" onKeyDown={event => {
            if (saving || !['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
            event.preventDefault();
            const next = event.key === 'Home' ? 'exercises' : event.key === 'End' ? 'targets' : mobileTab === 'exercises' ? 'targets' : 'exercises';
            setMobileTab(next);
            event.currentTarget.querySelectorAll('[role="tab"]')[next === 'exercises' ? 0 : 1]?.focus();
          }}><button type="button" id={`${formId}-exercises-tab`} role="tab" tabIndex={mobileTab === 'exercises' ? 0 : -1} aria-selected={mobileTab === 'exercises'} aria-controls={`${formId}-panel`} onClick={() => setMobileTab('exercises')} disabled={saving}>Exercises <span>{currentExercises.length}</span></button><button type="button" id={`${formId}-targets-tab`} role="tab" tabIndex={mobileTab === 'targets' ? 0 : -1} aria-selected={mobileTab === 'targets'} aria-controls={`${formId}-panel`} onClick={() => setMobileTab('targets')} disabled={saving}>Sets & targets</button></div>
          <section id={`${formId}-panel`} role="tabpanel" aria-labelledby={`${formId}-${mobileTab}-tab`}>
            {mobileTab === 'exercises' ? <>
              <div className="weekly-mobile-list-heading"><h3>{showAdd ? 'Add exercises' : `${FULL_DAYS[selectedDay]}’s workout`}</h3>{showAdd ? currentExercises.length > 0 && <button type="button" onClick={() => { setAddingExercises(false); setQuery(''); setMobileNotice(''); }} disabled={saving}>Done <Check size={14}/></button> : <button type="button" onClick={() => { setAddingExercises(true); setResultLimit(6); setMobileNotice(''); requestAnimationFrame(() => mobileSearchRef.current?.focus()); }} disabled={saving}><Plus size={16}/>Add</button>}</div>
              {showAdd ? <div className="weekly-mobile-add">
                <div className="weekly-exercise-search"><Search size={17}/><input ref={mobileSearchRef} type="search" value={query} onChange={event => { setQuery(event.target.value); setResultLimit(6); }} placeholder="Search exercise or muscle…" aria-label={`Find exercises for ${FULL_DAYS[selectedDay]}`} disabled={saving}/>{query && <button type="button" aria-label="Clear exercise search" onClick={() => { setQuery(''); setResultLimit(6); mobileSearchRef.current?.focus(); }}><X size={16}/></button>}</div>
                <div className="weekly-mobile-filter"><label htmlFor={`${formId}-muscle`}>Muscle</label><select id={`${formId}-muscle`} value={mobileFilter} onChange={event => { setMobileFilter(event.target.value); setResultLimit(6); }} disabled={saving}><option value="All">All muscles</option>{eligibleGroups.map(group => <option value={group} key={group}>{muscleLabel(group)}</option>)}</select><span>{currentExercises.length}/{MAX_PLAN_EXERCISES} selected</span></div>
                {currentExercises.length >= MAX_PLAN_EXERCISES && <p className="weekly-mobile-capacity">Your day is full. Choose Done and remove an exercise to add another.</p>}
                <ul className="weekly-mobile-results">{results.slice(0, resultLimit).map(exercise => <li key={exercise.id}><div><strong>{exercise.name}</strong><small>{exercise.equipment}</small></div><button type="button" aria-label={`Add ${exercise.name} to ${FULL_DAYS[selectedDay]}`} onClick={() => changeMobileExercise(exercise.id, true)} disabled={saving || currentExercises.length >= MAX_PLAN_EXERCISES}><Plus size={17}/></button></li>)}</ul>
                {!results.length && <p className="weekly-mobile-empty">No additional exercises match. Try another name or muscle.</p>}
                {results.length > resultLimit && <button type="button" className="weekly-mobile-more" onClick={() => setResultLimit(limit => limit + 6)} disabled={saving}>Show {Math.min(6, results.length - resultLimit)} more exercises</button>}
              </div> : <>
                <p className="weekly-mobile-workout-meta">{groupTitle(current.muscleGroups.map(muscleLabel))} <span>· About {preview.duration} min</span></p>
                <ol className="weekly-mobile-selected">{currentExercises.map((exercise, index) => <li key={exercise.id}><span className="weekly-mobile-order">{index + 1}</span><div><strong>{exercise.name}</strong><TargetSummary plan={{ ...current, sets: Number(current.sets) }} exercise={exercise}/></div><button type="button" aria-label={`Remove ${exercise.name} from ${FULL_DAYS[selectedDay]}`} onClick={() => changeMobileExercise(exercise.id, false)} disabled={saving}><X size={17}/></button></li>)}</ol>
              </>}
              <p className="weekly-mobile-notice" role="status">{mobileNotice}</p>
            </> : <div className="weekly-mobile-targets">
              <div className="weekly-mobile-list-heading"><h3>{FULL_DAYS[selectedDay]}’s targets</h3></div>
              <div className="weekly-workout-fields"><div><label htmlFor={`${formId}-sets`}>Default sets</label><select id={`${formId}-sets`} value={current.sets} disabled={saving} onChange={event => updateCurrent(draft => ({ ...draft, sets: event.target.value }))}><option value="" disabled>Choose sets</option>{[1, 2, 3, 4, 5, 6].map(sets => <option key={sets} value={sets}>{sets} set{sets === 1 ? '' : 's'}</option>)}</select></div><div><label htmlFor={`${formId}-reps`}>Default reps</label><input id={`${formId}-reps`} value={current.reps} placeholder="8–12" maxLength={7} disabled={saving} onChange={event => updateCurrent(draft => ({ ...draft, reps: event.target.value }))} aria-invalid={!validReps(current.reps)}/></div><div className="weekly-name-field"><label htmlFor={`${formId}-name`}>Workout name <span>Optional</span></label><input id={`${formId}-name`} value={current.name} maxLength={70} placeholder={groupTitle(current.muscleGroups) || 'Name your workout'} disabled={saving} onChange={event => updateCurrent(draft => ({ ...draft, name: event.target.value }))}/></div></div>
              <div ref={node => { const details = node?.querySelector('details'); if (details) details.open = true; }}><ExerciseTargets key={selectedDay} plan={current} exercises={currentExercises} disabled={saving} onChange={exerciseTargets => updateCurrent(draft => ({ ...draft, exerciseTargets }))}/></div>
              {!currentExercises.length && <p className="weekly-mobile-empty">Add an exercise to set its individual target.</p>}
            </div>}
          </section>
        </>}
        {dayErrors[selectedDay] && <p className="weekly-day-error" role="status"><AlertCircle size={14}/>{dayErrors[selectedDay]}</p>}
        {saveError && <p className="weekly-save-error" role="alert">{saveError}</p>}
        <p className="weekly-mobile-save-note">Saving updates this weekly routine and replaces date edits from this week onward.</p>
        {!footerTarget && footer}
      </form>
      {footerTarget && createPortal(footer, footerTarget)}
    </>;
  }

  return <form id={formId} className="weekly-editor" onSubmit={handleSave} noValidate aria-busy={saving}>
    <div className="weekly-editor-intro"><span className="weekly-editor-repeat"><Repeat2 size={19} /></span><div><strong>Build your own weekly routine.</strong><p>Pick a day, choose exercises, and set your targets for your {placeLabel} {levelLabel} plan.</p></div><span className="weekly-editor-count"><Dumbbell size={13} />{trainingDays} training · {7 - trainingDays} rest</span></div>
    <p className="weekly-repeat-notice"><Repeat2 size={15} /><span>Your routine repeats every week until you change it. Choose a rest day whenever you need a break.</span></p>
    <div className="weekly-editor-layout">
      <nav className="weekly-day-rail" aria-label="Choose a day to edit your recurring routine" ref={dayRailRef}>
        {drafts.map((draft, index) => <button key={draft.day} type="button" ref={selectedDay === index ? selectedDayButtonRef : null} className={`weekly-day-button${selectedDay === index ? ' is-selected' : ''}${dayErrors[index] ? ' has-error' : ''}`} aria-label={`${FULL_DAYS[index]}: ${draft.rest ? draft.fullRest ? 'Complete rest' : 'Rest and mobility' : `${groupTitle(draft.muscleGroups) || 'Choose your focus'}, ${draft.exerciseIds.length} exercises`}${dayErrors[index] ? ', needs attention' : ''}`} title={FULL_DAYS[index]} aria-pressed={selectedDay === index} onClick={() => selectDay(index)} disabled={saving}>
          <span className="weekly-day-name"><span className="weekly-day-full">{FULL_DAYS[index]}</span><span className="weekly-day-short" aria-hidden="true">{draft.day}</span>{dayErrors[index] ? <AlertCircle size={12} aria-label="Needs attention" /> : draft.rest ? <Leaf size={12} /> : <span className="weekly-day-dot" />}</span>
          <span className="weekly-day-focus">{draft.rest ? draft.fullRest ? 'Complete rest' : 'Rest & mobility' : groupTitle(draft.muscleGroups) || 'Choose your focus'}</span>
          {!draft.rest && <span className="weekly-day-detail">{draft.exerciseIds.length} exercise{draft.exerciseIds.length === 1 ? '' : 's'}</span>}
        </button>)}
      </nav>

      <section className="weekly-day-form" aria-labelledby="weekly-day-heading">
        <div className="weekly-day-heading"><div><span className="weekly-editor-eyebrow">EVERY {FULL_DAYS[selectedDay].toUpperCase()}</span><h3 id="weekly-day-heading" tabIndex={-1} ref={dayHeadingRef}>{current.rest ? 'Your day to recover.' : 'Choose your exercises.'}</h3></div><label className="weekly-rest-toggle"><input type="checkbox" checked={current.rest} disabled={saving} onChange={(event) => toggleRecovery(event.target.checked)} aria-label={`Make ${FULL_DAYS[selectedDay]} a rest day`} /><span className="weekly-toggle-track" aria-hidden="true" /><span>Rest day</span></label></div>

        {current.rest ? <div className="weekly-recovery-content"><div className="weekly-recovery-symbol"><span /><Leaf size={33} strokeWidth={1.4} /></div><h4>A little pause is part of the plan.</h4><p>{current.fullRest ? `No workout is scheduled on ${FULL_DAYS[selectedDay]}. Take the day off and return refreshed.` : `Keep ${FULL_DAYS[selectedDay]} gentle with a short mobility session.`}</p><label className="weekly-mobility-choice"><input type="checkbox" checked={!current.fullRest} disabled={saving} onChange={event=>updateCurrent(draft=>({...draft,fullRest:!event.target.checked}))}/>Include optional mobility exercises</label>{!current.fullRest&&<><div className="weekly-recovery-exercises">{recoveryIds.map((id) => { const exercise = exercises.find((item) => item.id === id); return <div key={id}><Check size={13} /><span>{exercise?.name}</span><small>1 set · 6 reps</small></div>; })}</div><span className="weekly-recovery-duration"><Clock3 size={13} />About {preview.duration} minutes of easy movement</span></>}</div> : <>
          <fieldset className="weekly-muscle-fieldset" disabled={saving}><legend>Muscle groups</legend><div className="weekly-muscle-options">{eligibleGroups.map((group) => <label className="weekly-muscle-option" key={group}><input type="checkbox" checked={current.muscleGroups.includes(group)} onChange={() => toggleGroup(group)} /><span>{current.muscleGroups.includes(group) && <Check size={11} />}{muscleLabel(group)}</span></label>)}</div>{current.muscleGroups.filter((group) => !eligibleGroups.includes(group)).map((group) => <button key={group} className="weekly-unsupported-group" type="button" onClick={() => toggleGroup(group)}>Remove unavailable {group} <X size={12} /></button>)}</fieldset>

          <div className="weekly-exercises-heading"><h4>Choose your exercises <span>{currentExercises.length}/{MAX_PLAN_EXERCISES}</span></h4><span><Clock3 size={12} />About {preview.duration} min</span></div>
          <p className="weekly-suggestion-note" id="weekly-exercise-help">Choose muscle groups for suggestions, or search any {placeLabel} exercise below. Check the exercises you want and uncheck any you don’t. Up to {MAX_PLAN_EXERCISES} per day.</p>
          <div className="weekly-exercise-search"><Search size={15} /><input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder={`Search all ${placeLabel} exercises…`} aria-label={`Search all ${placeLabel} exercises for ${FULL_DAYS[selectedDay]}`} aria-describedby="weekly-exercise-help" disabled={saving} />{query && <button type="button" onClick={() => setQuery('')} aria-label="Clear exercise search"><X size={13} /></button>}</div>
          <div className="weekly-exercise-options" aria-label={`${FULL_DAYS[selectedDay]} exercise choices`}>
            {matchingExercises.map((exercise) => <label className={`weekly-exercise-option${current.exerciseIds.includes(exercise.id) ? ' is-checked' : ''}`} key={exercise.id}><input type="checkbox" checked={current.exerciseIds.includes(exercise.id)} disabled={saving || (!current.exerciseIds.includes(exercise.id) && current.exerciseIds.length >= MAX_PLAN_EXERCISES)} onChange={(event) => toggleExercise(exercise.id, event.target.checked)} /><span><strong>{exercise.name}</strong><small>{exerciseGroups(exercise).map(muscleLabel).join(', ')} <i>·</i> {exercise.equipment}</small></span><span className="weekly-exercise-duration">{exercise.duration} min</span></label>)}
            {!matchingExercises.length && <div className="weekly-exercise-empty"><Dumbbell size={20} /><p>{query ? 'No matches. Try another exercise name or muscle group.' : 'Choose a muscle group above or search for your first exercise.'}</p>{query && <button type="button" onClick={() => setQuery('')}>Clear search</button>}</div>}
          </div>
          <p className="weekly-selection-note" role="status">{currentExercises.length} exercise{currentExercises.length === 1 ? '' : 's'} selected for every {FULL_DAYS[selectedDay]}.{currentExercises.length >= MAX_PLAN_EXERCISES ? ' Uncheck one to make room for another.' : query ? ' Selecting an exercise also adds its muscle group.' : ' Your choices stay saved in this draft as you switch days.'}</p>

          <div className="weekly-workout-fields"><div><label htmlFor="weekly-sets">Default sets per exercise</label><select id="weekly-sets" value={current.sets} disabled={saving} onChange={(event) => updateCurrent((draft) => ({ ...draft, sets: event.target.value }))}><option value="" disabled>Choose sets</option>{[1, 2, 3, 4, 5, 6].map((sets) => <option key={sets} value={sets}>{sets} set{sets === 1 ? '' : 's'}</option>)}</select></div><div><label htmlFor="weekly-reps">Default reps per set</label><input id="weekly-reps" type="text" inputMode="text" value={current.reps} placeholder="e.g. 8–12" maxLength={7} disabled={saving} onChange={(event) => updateCurrent((draft) => ({ ...draft, reps: event.target.value }))} aria-invalid={!validReps(current.reps)} /></div><div className="weekly-name-field"><label htmlFor="weekly-name">Workout name <span>Optional</span></label><input id="weekly-name" type="text" value={current.name} maxLength={70} placeholder={groupTitle(current.muscleGroups) || 'Name your workout'} disabled={saving} onChange={(event) => updateCurrent((draft) => ({ ...draft, name: event.target.value }))} /></div></div>
          <ExerciseTargets plan={current} exercises={currentExercises} disabled={saving} onChange={exerciseTargets=>updateCurrent(draft=>({...draft,exerciseTargets}))}/>
        </>}
        {dayErrors[selectedDay] && <p className="weekly-day-error" role="status"><AlertCircle size={14} />{dayErrors[selectedDay]}</p>}
      </section>
    </div>

    <p className="weekly-timed-note">For plank holds, default reps represent seconds. Expand individual targets to set different reps, hold times, cardio minutes, and rest periods.</p>
    {saveError && <p className="weekly-save-error" role="alert">{saveError}</p>}
    <div className="weekly-editor-footer"><div><p><Repeat2 size={13} /><span>Saves all seven days and repeats every week until you change it. Replaces individual day edits from this week onward.</span></p>{invalidCount > 0 ? <button className="weekly-review-error" type="button" onClick={() => selectDay(firstInvalidDay, true)} disabled={saving}>{invalidCount} day{invalidCount === 1 ? '' : 's'} need{invalidCount === 1 ? 's' : ''} attention · Review {FULL_DAYS[firstInvalidDay]} <ArrowRight size={12} /></button> : <span className="weekly-ready"><CheckCheck size={12} />All seven days are ready, including rest days.</span>}</div><div className="weekly-editor-actions"><button className="weekly-cancel" type="button" onClick={onCancel} disabled={saving}>Cancel</button><button className="weekly-save" type="submit" disabled={saving || invalidCount > 0}>{saving ? <><LoaderCircle size={15} className="weekly-spinner" />Saving…</> : <>Save weekly plan <ArrowRight size={15} /></>}</button></div></div>
  </form>;
}
