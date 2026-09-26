import TouchSelect from './TouchSelect';
import { useId, useRef, useState } from 'react';
import { ArrowRight, Check, LoaderCircle, Target } from 'lucide-react';
import { FITNESS_GOALS, getSuggestedWeekPlan, normalizeRestDays } from '../goals';
import GoalPicker, { GoalApproach, SuggestedWeekPreview } from './GoalPicker';
import './GoalSetup.css';
import GenderPicker from './GenderPicker';
import { normalizeGender } from '../profile';
import RestDayPicker from './RestDayPicker';
import { matchesWeeklySchedule, rescheduleWeekPlans } from '../planning';
import { adaptPlanForLocation } from '../trainingLocation';

function initialRestDays(profile, trainingPlace, level) {
  // Stored preferences remain the user's choices, including when they need
  // adjustment after a change to the weekly target.
  if (Array.isArray(profile?.restDays)) return [...profile.restDays];
  const scheduled = getSuggestedWeekPlan({ fitnessGoal: profile?.fitnessGoal, gender: profile?.gender, trainingPlace, level, weeklyGoal: profile?.goal });
  const existing = scheduled.flatMap((plan, index) => plan.rest ? [index] : []);
  return normalizeRestDays(existing, profile?.goal) || [];
}

export default function GoalSetup({ profile, trainingPlace, level, hasCustomPlan, sourcePlace = trainingPlace, sourcePlans = [], currentPlans = sourcePlans, onSave, onCancel }) {
  const id = useId();
  const [gender, setGender] = useState(profile?.gender || '');
  const [fitnessGoal, setFitnessGoal] = useState(profile?.fitnessGoal || '');
  const [weeklyGoal, setWeeklyGoal] = useState(String(profile?.goal ?? ''));
  const [restDays, setRestDays] = useState(() => initialRestDays(profile, trainingPlace, level));
  const initialRestDaysRef = useRef(restDays);
  const [planChoice, setPlanChoice] = useState(null);
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const savingRef = useRef(false);
  const formRef = useRef(null);
  const goalValid = FITNESS_GOALS.some((goal) => goal.id === fitnessGoal);
  const weeklyValid = Number.isInteger(Number(weeklyGoal)) && Number(weeklyGoal) >= 1 && Number(weeklyGoal) <= 7;
  const restDaysValid = weeklyValid && normalizeRestDays(restDays, Number(weeklyGoal)) !== null;
  const canPreview = goalValid && weeklyValid && restDaysValid && normalizeGender(gender);
  const scheduleMatches = matchesWeeklySchedule(currentPlans, Number(weeklyGoal), restDays);
  const scheduleChanged = Number(weeklyGoal) !== Number(profile?.goal)
    || [...restDays].sort().join(',') !== [...initialRestDaysRef.current].sort().join(',');
  const selectedChoice = !hasCustomPlan ? 'suggested' : planChoice || (scheduleMatches && !scheduleChanged ? 'keep' : 'schedule');
  const applySuggestion = selectedChoice === 'suggested';
  const applySchedule = selectedChoice === 'schedule';
  const preview = !canPreview ? null : applySuggestion
    ? getSuggestedWeekPlan({ fitnessGoal, gender, trainingPlace, level, weeklyGoal: Number(weeklyGoal), restDays })
    : applySchedule
      ? rescheduleWeekPlans(sourcePlans, { weeklyGoal: Number(weeklyGoal), restDays,
        suggestedPlans: getSuggestedWeekPlan({ fitnessGoal, gender, trainingPlace: sourcePlace, level, weeklyGoal: Number(weeklyGoal), restDays }),
      }).map(plan => adaptPlanForLocation(plan, trainingPlace, sourcePlace))
      : currentPlans;
  const keptWorkoutCount = currentPlans.filter(plan => !plan.rest).length;
  const placeLabel = trainingPlace === 'home' ? 'home' : 'gym';
  const levelLabel = level === 'medium' ? 'medium' : level === 'experienced' ? 'experienced' : 'beginner';

  function updateWeeklyGoal(value) {
    setWeeklyGoal(value);
    if (Number(value) === 7) setRestDays([]);
    setErrors(current => ({ ...current, weeklyGoal: undefined, restDays: undefined }));
    setSaveError('');
  }

  async function handleSave(event) {
    event.preventDefault();
    if (savingRef.current) return;
    const nextErrors = {};
    if (!normalizeGender(gender)) nextErrors.gender = 'Choose a gender or Prefer not to say.';
    if (!goalValid) nextErrors.fitnessGoal = 'Choose your main fitness goal to continue.';
    if (!weeklyValid) nextErrors.weeklyGoal = 'Choose between 1 and 7 workouts a week.';
    else if (!restDaysValid) nextErrors.restDays = `Choose exactly ${7 - Number(weeklyGoal)} rest day${Number(weeklyGoal) === 6 ? '' : 's'} to match your weekly target.`;
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) {
      const field = Object.keys(nextErrors)[0];
      requestAnimationFrame(() => formRef.current?.querySelector(`[name="${field}"]`)?.focus());
      return;
    }
    savingRef.current = true;
    setSaving(true);
    setSaveError('');
    try {
      await onSave({ fitnessGoal, gender, weeklyGoal: Number(weeklyGoal), restDays: normalizeRestDays(restDays, Number(weeklyGoal)), applySuggestion, applySchedule, keepSchedule: selectedChoice === 'keep' });
    } catch (error) {
      setSaveError(error?.message || 'Your goal couldn’t be saved. Please try again.');
    } finally {
      savingRef.current = false;
      setSaving(false);
    }
  }

  return <form className="goal-setup" ref={formRef} onSubmit={handleSave} noValidate aria-busy={saving}>
    <div className="goal-setup-intro"><span><Target size={20} /></span><p>Your goal gives your week a direction. Choose your focus and the amount of movement that fits your life.</p></div>
    <GenderPicker value={gender} onChange={value=>{setGender(value);setErrors(current=>({...current,gender:undefined}));setSaveError('');}} disabled={saving} error={errors.gender}/>
    <GoalPicker value={fitnessGoal} onChange={(value) => { setFitnessGoal(value); setErrors((current) => ({ ...current, fitnessGoal: undefined })); setSaveError(''); }} disabled={saving} error={errors.fitnessGoal} />
    <div className="goal-setup-weekly"><div><label htmlFor={`${id}-weekly`}>Weekly workout target</label><p>Build a rhythm you can return to.</p></div><TouchSelect id={`${id}-weekly`} name="weeklyGoal" value={weeklyGoal} disabled={saving} required aria-invalid={Boolean(errors.weeklyGoal)} aria-describedby={errors.weeklyGoal ? `${id}-weekly-error` : undefined} onChange={(event) => updateWeeklyGoal(event.target.value)}><option value="" disabled>Choose your target</option>{[1, 2, 3, 4, 5, 6, 7].map((number) => <option key={number} value={number}>{number} workout{number === 1 ? '' : 's'} per week</option>)}</TouchSelect></div>
    {errors.weeklyGoal && <p id={`${id}-weekly-error`} className="goal-setup-field-error">{errors.weeklyGoal}</p>}
    {weeklyValid && <RestDayPicker weeklyGoal={Number(weeklyGoal)} value={restDays} onChange={value => { setRestDays(value); setErrors(current => ({ ...current, restDays: undefined })); setSaveError(''); }} disabled={saving} error={errors.restDays} note={selectedChoice === 'keep' ? 'Keeping the current schedule saves these preferences only. Choose Adjust my current plan to apply these days.' : 'Your chosen rest days will have no scheduled exercises.'}/>}
    <GoalApproach goalId={fitnessGoal} />
    {hasCustomPlan && <fieldset className="goal-plan-choice" disabled={saving}><legend>How should your plan change?</legend><p>You have saved workouts or individual day edits for your {placeLabel} {levelLabel} routine.</p><div>{[
      { value: 'schedule', title: 'Adjust my current plan', description: 'Keep my workout order and exercise targets. Fit them to the selected training days.' },
      { value: 'suggested', title: 'Use suggested plan', description: 'Build a fresh week for my goal and selected days.' },
      { value: 'keep', title: 'Keep current schedule', description: `Save goal preferences only. Keep this week’s ${keptWorkoutCount} workouts and all date edits.` },
    ].map((option) => <label key={option.value}><input type="radio" name={`${id}-planChoice`} value={option.value} checked={selectedChoice === option.value} onChange={() => setPlanChoice(option.value)} /><span><strong>{option.title}</strong><small>{option.description}</small></span><Check size={13} aria-hidden="true" /></label>)}</div>{(applySuggestion || applySchedule) && <p className="goal-replacement-note">{applySchedule ? 'Fewer days keep the first workouts in your saved sequence; extra days use suggestions. Review the week below. ' : ''}Saving replaces individual day edits from this week onward. Your workout history and active workout are kept.</p>}</fieldset>}
    {preview && <SuggestedWeekPreview plans={preview} title={applySchedule ? 'Your adjusted week' : applySuggestion ? 'Your suggested week' : 'Your current week'} note={selectedChoice === 'keep' ? 'Your saved weekly plan and individual date edits will stay unchanged.' : undefined}/>}
    {hasCustomPlan && selectedChoice === 'keep' && !scheduleMatches && preview && <p className="goal-setup-keep-note">Your plan stays at {keptWorkoutCount} workouts this week. The {weeklyGoal}-workout target and chosen rest days will only apply when you adjust or replace your plan.</p>}
    {saveError && <p className="goal-setup-save-error" role="alert">{saveError}</p>}
    <div className="goal-setup-footer"><span>{applySuggestion || applySchedule ? 'The preview is the week you’ll save.' : 'Your current schedule stays saved.'}</span><div><button type="button" className="goal-setup-cancel" onClick={onCancel} disabled={saving}>Cancel</button><button type="submit" className="goal-setup-save" disabled={saving}>{saving ? <><LoaderCircle size={16} className="goal-setup-spinner" />Saving…</> : <>{applySuggestion || applySchedule ? 'Save goal & plan' : 'Save goal only'}<ArrowRight size={15} /></>}</button></div></div>
  </form>;
}
