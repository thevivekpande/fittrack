import { lazy, Suspense, useEffect, useId, useMemo, useRef, useState } from 'react';
import { ArrowLeftRight, ArrowRight, CalendarDays, Check, ChevronDown, Dumbbell, LoaderCircle, Play, Repeat2, Search, X } from 'lucide-react';
import { EQUIPMENT_OPTIONS, getExerciseAlternatives } from '../exerciseAlternatives';
import { REPLACEMENT_TARGET_NOTE, swapExerciseInPlan } from '../exerciseReplacement';
import { matchesExercise } from '../exerciseSearch';
import { TargetSummary } from './ExerciseTargets';
import ExerciseVideoLinks from './ExerciseVideoLinks';
import './ExerciseAlternatives.css';

const ExerciseDemo = lazy(() => import('./ExerciseDemo'));
const WEEKDAYS = { Mon: 'Monday', Tue: 'Tuesday', Wed: 'Wednesday', Thu: 'Thursday', Fri: 'Friday', Sat: 'Saturday', Sun: 'Sunday' };

function getLocalDate(value) {
  if (!value) return null;
  const parts = typeof value === 'string' && /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  const result = parts ? new Date(Number(parts[1]), Number(parts[2]) - 1, Number(parts[3]), 12) : new Date(value);
  return Number.isFinite(result.getTime()) ? result : null;
}

export default function ExerciseAlternatives({ exercise, plan, trainingPlace, gender, date, allowWeekly = false, sessionOnly = false, onSave, onCancel }) {
  const id = useId();
  const [equipmentFilter, setEquipmentFilter] = useState('all');
  const [query, setQuery] = useState('');
  const [selectedId, setSelectedId] = useState('');
  const [scope, setScope] = useState(sessionOnly ? 'session' : 'date');
  const [showIllustration, setShowIllustration] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const savingRef = useRef(false);
  const sourceHeadingRef = useRef(null);
  const localDate = getLocalDate(date);
  const dayLabel = localDate?.toLocaleDateString('en-US', { weekday: 'long' }) || WEEKDAYS[plan.day] || 'this weekday';
  const dateLabel = localDate?.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' }) || 'this date';
  const effectiveScope = sessionOnly ? 'session' : allowWeekly && scope === 'weekly' ? 'weekly' : 'date';
  const dateIdentity = localDate ? `${localDate.getFullYear()}-${localDate.getMonth()}-${localDate.getDate()}` : '';

  useEffect(() => {
    setSelectedId(''); setEquipmentFilter('all'); setQuery('');
    setScope(sessionOnly ? 'session' : 'date'); setShowIllustration(false); setSaveError('');
    const frame = requestAnimationFrame(() => {
      sourceHeadingRef.current?.focus({ preventScroll: true });
      sourceHeadingRef.current?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    });
    return () => cancelAnimationFrame(frame);
  }, [exercise.id, dateIdentity, sessionOnly]);

  const allChoices = useMemo(() => getExerciseAlternatives({ exercise, trainingPlace, exerciseIds: plan.exerciseIds, equipmentFilter: 'all' }), [exercise, trainingPlace, plan.exerciseIds]);
  const choices = useMemo(() => getExerciseAlternatives({ exercise, trainingPlace, exerciseIds: plan.exerciseIds, equipmentFilter }), [exercise, trainingPlace, plan.exerciseIds, equipmentFilter]);
  const matchingChoices = choices.filter(choice => matchesExercise(choice.exercise, query));
  const selected = allChoices.find(choice => choice.exercise.id === selectedId);
  const replacement = useMemo(() => {
    if (!selected) return { plan: null, error: '' };
    try { return { plan: swapExerciseInPlan(plan, exercise.id, selected.exercise.id), error: '' }; }
    catch (error) { return { plan: null, error: error?.message || 'This exercise cannot replace the current choice. Please choose another.' }; }
  }, [plan, exercise.id, selected]);
  const hasFilters = equipmentFilter !== 'all' || Boolean(query.trim());
  const selectedOutsideFilter = selected && !matchingChoices.some(choice => choice.exercise.id === selectedId);

  function chooseExercise(candidateId) {
    setSelectedId(candidateId); setShowIllustration(false); setSaveError('');
  }

  function clearFilters() {
    setEquipmentFilter('all'); setQuery('');
  }

  async function handleSave(event) {
    event.preventDefault();
    if (savingRef.current || !selected || !replacement.plan) return;
    savingRef.current = true; setSaving(true); setSaveError('');
    try { await onSave({ replacementId: selected.exercise.id, scope: effectiveScope }); }
    catch (error) { setSaveError(error?.message || 'The exercise couldn’t be replaced. Please try again.'); }
    finally { savingRef.current = false; setSaving(false); }
  }

  return <form className="exercise-alternatives" onSubmit={handleSave} noValidate aria-busy={saving}>
    <p className="alternatives-intro">Choose a movement that fits your available equipment. Review its targets and illustration before you switch.</p>
    <div className="alternatives-original">
      <span className="alternatives-original-icon"><ArrowLeftRight size={21}/></span>
      <div><span className="alternatives-eyebrow">REPLACING</span><h3 ref={sourceHeadingRef} tabIndex={-1}>{exercise.name}</h3><p>{exercise.equipment}</p><TargetSummary plan={plan} exercise={exercise} showRest/></div>
    </div>

    <fieldset className="alternatives-equipment" disabled={saving}>
      <legend>Equipment available</legend>
      <div>{EQUIPMENT_OPTIONS.map(option => <button key={option.id} type="button" aria-pressed={equipmentFilter === option.id} onClick={() => { setEquipmentFilter(option.id); setSaveError(''); }}>{equipmentFilter === option.id && <Check size={13}/>}<span>{option.label}</span></button>)}</div>
    </fieldset>
    <div className="alternatives-search"><Search size={17}/><input type="search" value={query} onChange={event => setQuery(event.target.value)} placeholder="Search alternatives…" aria-label="Search alternative exercises" disabled={saving}/>{query && <button type="button" onClick={() => setQuery('')} aria-label="Clear alternative search" disabled={saving}><X size={16}/></button>}</div>

    <fieldset className="alternatives-choice-fieldset" disabled={saving}>
      <legend>Choose an alternative <span>{matchingChoices.length} available</span></legend>
      <div className="alternatives-choices">
        {matchingChoices.map(({ exercise: candidate, reason, matchLabel }) => <label className={`alternatives-choice${selectedId === candidate.id ? ' is-selected' : ''}`} key={candidate.id}>
          <input type="radio" name={`${id}-exercise`} value={candidate.id} checked={selectedId === candidate.id} onChange={() => chooseExercise(candidate.id)} aria-describedby={`${id}-${candidate.id}-reason`}/>
          <span className="alternatives-choice-content"><strong>{candidate.name}</strong><span className="alternatives-choice-equipment"><Dumbbell size={12}/>{candidate.equipment}</span><span className="alternatives-choice-reason" id={`${id}-${candidate.id}-reason`}>{reason}</span>{matchLabel && <span className="alternatives-match">{matchLabel}</span>}</span>
          <Check className="alternatives-choice-check" size={17} aria-hidden="true"/>
        </label>)}
        {!matchingChoices.length && <div className="alternatives-empty"><Dumbbell size={26}/><strong>{hasFilters ? 'No alternatives match these filters.' : 'No available alternatives for this exercise.'}</strong><p>{hasFilters ? 'Try another name or include more equipment.' : 'Exercises already in this workout are excluded from the choices.'}</p>{hasFilters && <button type="button" onClick={clearFilters}>Clear filters <X size={13}/></button>}</div>}
      </div>
    </fieldset>

    {selected && <section className="alternatives-selected" aria-labelledby={`${id}-selected-heading`}>
      <div className="alternatives-selected-heading"><span className="alternatives-selected-check"><Check size={17}/></span><div><span className="alternatives-eyebrow">YOUR REPLACEMENT</span><h4 id={`${id}-selected-heading`}>{selected.exercise.name}</h4><p>{selected.exercise.equipment}</p></div><button type="button" onClick={() => chooseExercise('')} aria-label="Clear selected alternative" disabled={saving}><X size={17}/></button></div>
      {selectedOutsideFilter && <p className="alternatives-filter-note">Your selection is kept while you browse other alternatives.</p>}
      {replacement.plan && <><div className="alternatives-target"><span>Target after replacing</span><TargetSummary plan={replacement.plan} exercise={selected.exercise} showRest/></div><p className="alternatives-target-note">{REPLACEMENT_TARGET_NOTE}</p></>}
      {replacement.error && <p className="alternatives-error" role="alert">{replacement.error}</p>}
      <button className="alternatives-preview-toggle" type="button" onClick={() => setShowIllustration(value => !value)} aria-expanded={showIllustration} aria-controls={`${id}-illustration`} disabled={saving}><Play size={14}/>{showIllustration ? 'Hide illustration & instructions' : 'View illustration & instructions'}<ChevronDown size={15} className={showIllustration ? 'is-open' : ''}/></button>
      {showIllustration && <div className="alternatives-preview" id={`${id}-illustration`}>
        <Suspense fallback={<div className="alternatives-preview-loading"><LoaderCircle size={23}/>Preparing your movement preview…</div>}><ExerciseDemo exerciseId={selected.exercise.id} group={selected.exercise.group} gender={gender} movement={selected.exercise.movement} name={selected.exercise.name} equipment={selected.exercise.equipment}/></Suspense>
        <ol className="alternatives-instructions">{selected.exercise.instructions?.map((instruction, index) => <li key={`${selected.exercise.id}-${index}`}><span>{index + 1}</span>{instruction}</li>)}</ol>
        <ExerciseVideoLinks exercise={selected.exercise} links={replacement.plan?.exerciseVideoLinks?.[selected.exercise.id]}/>
      </div>}
    </section>}

    {!sessionOnly && allowWeekly && <fieldset className="alternatives-scope" disabled={saving}>
      <legend>When should this change apply?</legend>
      <div>{[{ value: 'date', title: 'This date only', detail: dateLabel, Icon: CalendarDays }, { value: 'weekly', title: `Every ${dayLabel}`, detail: 'Your recurring weekly routine', Icon: Repeat2 }].map(({ value, title, detail, Icon }) => <label key={value}><input type="radio" name={`${id}-scope`} value={value} checked={effectiveScope === value} onChange={() => { setScope(value); setSaveError(''); }}/><Icon size={17}/><span><strong>{title}</strong><small>{detail}</small></span></label>)}</div>
    </fieldset>}
    <p className="alternatives-scope-note">{effectiveScope === 'session' ? 'Applies to this unfinished workout. Your other plans and workout history stay saved.' : effectiveScope === 'weekly' ? 'Replace this exercise on this weekday each week. Other exercise choices and workout history stay saved.' : `Changes ${dateLabel} only. Your recurring weekly routine stays as it is.`}</p>
    {saveError && <p className="alternatives-error" role="alert">{saveError}</p>}
    <div className="alternatives-footer"><button className="alternatives-cancel" type="button" onClick={onCancel} disabled={saving}>Cancel</button><button className="alternatives-save" type="submit" disabled={saving || !selected || !replacement.plan}>{saving ? <><LoaderCircle size={16} className="alternatives-spinner"/>Saving…</> : <>{effectiveScope === 'weekly' ? 'Replace in weekly plan' : effectiveScope === 'session' ? 'Replace in this workout' : 'Replace exercise'}<ArrowRight size={16}/></>}</button></div>
  </form>;
}
