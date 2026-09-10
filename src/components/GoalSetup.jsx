import { useId, useRef, useState } from 'react';
import { ArrowRight, Check, LoaderCircle, Target } from 'lucide-react';
import { FITNESS_GOALS, getSuggestedWeekPlan } from '../goals';
import GoalPicker, { GoalApproach, SuggestedWeekPreview } from './GoalPicker';
import './GoalSetup.css';
import GenderPicker from './GenderPicker';
import { normalizeGender } from '../profile';

export default function GoalSetup({ profile, trainingPlace, level, hasCustomPlan, onSave, onCancel }) {
  const id = useId();
  const [gender, setGender] = useState(profile?.gender || '');
  const [fitnessGoal, setFitnessGoal] = useState(profile?.fitnessGoal || '');
  const [weeklyGoal, setWeeklyGoal] = useState(String(profile?.goal ?? ''));
  const [planChoice, setPlanChoice] = useState('keep');
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const savingRef = useRef(false);
  const formRef = useRef(null);
  const goalValid = FITNESS_GOALS.some((goal) => goal.id === fitnessGoal);
  const weeklyValid = Number.isInteger(Number(weeklyGoal)) && Number(weeklyGoal) >= 1 && Number(weeklyGoal) <= 7;
  const preview = goalValid && weeklyValid && normalizeGender(gender) ? getSuggestedWeekPlan({ fitnessGoal, gender, trainingPlace, level, weeklyGoal: Number(weeklyGoal) }) : null;
  const applySuggestion = !hasCustomPlan || planChoice === 'suggested';
  const placeLabel = trainingPlace === 'home' ? 'home' : 'gym';
  const levelLabel = level === 'medium' ? 'medium' : level === 'experienced' ? 'experienced' : 'beginner';

  async function handleSave(event) {
    event.preventDefault();
    if (savingRef.current) return;
    const nextErrors = {};
    if (!normalizeGender(gender)) nextErrors.gender = 'Choose a gender or Prefer not to say.';
    if (!goalValid) nextErrors.fitnessGoal = 'Choose your main fitness goal to continue.';
    if (!weeklyValid) nextErrors.weeklyGoal = 'Choose between 1 and 7 workouts a week.';
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
      await onSave({ fitnessGoal, gender, weeklyGoal: Number(weeklyGoal), applySuggestion });
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
    <div className="goal-setup-weekly"><div><label htmlFor={`${id}-weekly`}>Weekly workout target</label><p>Build a rhythm you can return to.</p></div><select id={`${id}-weekly`} name="weeklyGoal" value={weeklyGoal} disabled={saving} required aria-invalid={Boolean(errors.weeklyGoal)} aria-describedby={errors.weeklyGoal ? `${id}-weekly-error` : undefined} onChange={(event) => { setWeeklyGoal(event.target.value); setErrors((current) => ({ ...current, weeklyGoal: undefined })); setSaveError(''); }}><option value="" disabled>Choose your target</option>{[1, 2, 3, 4, 5, 6, 7].map((number) => <option key={number} value={number}>{number} workout{number === 1 ? '' : 's'} per week</option>)}</select></div>
    {errors.weeklyGoal && <p id={`${id}-weekly-error`} className="goal-setup-field-error">{errors.weeklyGoal}</p>}
    <GoalApproach goalId={fitnessGoal} />
    {hasCustomPlan && <fieldset className="goal-plan-choice" disabled={saving}><legend>How would you like to use your goal?</legend><p>You have a custom plan or individual day edits for your {placeLabel} {levelLabel} routine.</p><div>{[{ value: 'keep', title: 'Keep my custom split', description: 'Save my goal and weekly target while keeping my plan.' }, { value: 'suggested', title: 'Use suggested plan', description: 'Replace this routine with the suggested week below.' }].map((option) => <label key={option.value}><input type="radio" name={`${id}-planChoice`} value={option.value} checked={planChoice === option.value} onChange={() => setPlanChoice(option.value)} /><span><strong>{option.title}</strong><small>{option.description}</small></span><Check size={13} aria-hidden="true" /></label>)}</div>{applySuggestion && <p className="goal-replacement-note">Saving replaces your {placeLabel} {levelLabel} custom plan and individual day edits from this week onward. Your workout history and active workout are kept.</p>}</fieldset>}
    {preview && <SuggestedWeekPreview plans={preview} />}
    {hasCustomPlan && !applySuggestion && preview && <p className="goal-setup-keep-note">This is a suggested preview. Your custom split and individual day edits will be kept.</p>}
    {saveError && <p className="goal-setup-save-error" role="alert">{saveError}</p>}
    <div className="goal-setup-footer"><span>{applySuggestion ? 'A fresh direction for your next workout.' : 'Your goal. Your own routine.'}</span><div><button type="button" className="goal-setup-cancel" onClick={onCancel} disabled={saving}>Cancel</button><button type="submit" className="goal-setup-save" disabled={saving}>{saving ? <><LoaderCircle size={16} className="goal-setup-spinner" />Saving…</> : <>{applySuggestion ? 'Save goal & plan' : 'Save fitness goal'}<ArrowRight size={15} /></>}</button></div></div>
  </form>;
}
