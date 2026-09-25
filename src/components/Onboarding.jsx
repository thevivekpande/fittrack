import TouchSelect from './TouchSelect';
import { useEffect, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, Check, Dumbbell, Home, Leaf, LoaderCircle, LockKeyhole, Target, TrendingUp } from 'lucide-react';
import { LEVELS, TRAINING_PLACES } from '../data';
import { FITNESS_GOALS, getSuggestedWeekPlan, normalizeRestDays } from '../goals';
import GoalPicker, { GoalApproach, SuggestedWeekPreview } from './GoalPicker';
import './Onboarding.css';
import GenderPicker from './GenderPicker';
import { GENDERS, normalizeGender } from '../profile';
import RestDayPicker from './RestDayPicker';
import FitTrackLogo from './FitTrackLogo';

const LEVEL_NOTES = {
  beginner: 'A fresh start',
  medium: 'Finding your rhythm',
  experienced: 'Ready for more',
};

const SETUP_STEPS = [
  { label: 'About you', title: 'A little about you.', description: 'Let’s make this feel like your space.', fields: ['name', 'gender'] },
  { label: 'Training', title: 'Your space. Your pace.', description: 'Choose where you’ll train and your starting level.', fields: ['trainingPlace', 'level'] },
  { label: 'Your goal', title: 'Choose your direction.', description: 'Pick a focus and a weekly rhythm that fits your life.', fields: ['fitnessGoal', 'goal', 'restDays'] },
  { label: 'Review', title: 'Your plan starts here.', description: 'Check your choices. You can change them anytime.', fields: ['initialWeight'] },
];
const ALL_FIELDS = SETUP_STEPS.flatMap(step => step.fields);
const DAY_NAMES = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export function validateOnboardingFields(values, fields = ALL_FIELDS, invalidWeightInput = false) {
  const { name, gender, trainingPlace, level, fitnessGoal, goal, restDays, initialWeight } = values;
  const selected = new Set(fields);
  const nextErrors = {};
  if (selected.has('name')) {
    const cleanName = name.trim();
    if (!cleanName) nextErrors.name = 'Enter the name you’d like us to use.';
    else if (cleanName.length > 60) nextErrors.name = 'Keep your name to 60 characters or fewer.';
  }
  if (selected.has('gender') && !normalizeGender(gender)) nextErrors.gender = 'Choose a gender or Prefer not to say.';
  if (selected.has('trainingPlace') && !TRAINING_PLACES.some(place => place.id === trainingPlace)) nextErrors.trainingPlace = 'Choose where you’d like to train.';
  if (selected.has('level') && !LEVELS.some(item => item.id === level)) nextErrors.level = 'Choose the level that feels right for you.';
  if (selected.has('fitnessGoal') && !FITNESS_GOALS.some(item => item.id === fitnessGoal)) nextErrors.fitnessGoal = 'Choose your main fitness goal to continue.';
  const numericGoal = Number(goal);
  const validGoal = Boolean(goal) && Number.isInteger(numericGoal) && numericGoal >= 1 && numericGoal <= 7;
  if (selected.has('goal') && !validGoal) nextErrors.goal = 'Choose a goal from 1 to 7 workouts a week.';
  if (selected.has('restDays') && validGoal && normalizeRestDays(restDays, numericGoal) === null) nextErrors.restDays = `Choose exactly ${7 - numericGoal} rest day${numericGoal === 6 ? '' : 's'} to match your weekly goal.`;
  if (selected.has('initialWeight')) {
    const weight = initialWeight.trim() === '' ? null : Number(initialWeight);
    if (invalidWeightInput || (weight !== null && (!Number.isFinite(weight) || weight < 20 || weight > 400 || Math.abs(weight * 10 - Math.round(weight * 10)) > 0.000001))) nextErrors.initialWeight = 'Enter 20–400 kg, with up to one decimal place.';
  }
  return nextErrors;
}

export default function Onboarding({ onComplete, saving = false, error = null, mobile = false }) {
  const [name, setName] = useState('');
  const [gender, setGender] = useState('');
  const [trainingPlace, setTrainingPlace] = useState('');
  const [level, setLevel] = useState('');
  const [goal, setGoal] = useState('');
  const [restDays, setRestDays] = useState([]);
  const [fitnessGoal, setFitnessGoal] = useState('');
  const [initialWeight, setInitialWeight] = useState('');
  const [errors, setErrors] = useState({});
  const [submitError, setSubmitError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [step, setStep] = useState(0);
  const submissionRef = useRef(false);
  const formRef = useRef(null);
  const stepHeadingRef = useRef(null);
  const focusFrameRef = useRef(null);
  const busy = saving || submitting;
  const activeStep = SETUP_STEPS[step];
  const values = { name, gender, trainingPlace, level, fitnessGoal, goal, restDays, initialWeight };

  useEffect(() => () => cancelAnimationFrame(focusFrameRef.current), []);

  function focusField(field) {
    cancelAnimationFrame(focusFrameRef.current);
    focusFrameRef.current = requestAnimationFrame(() => {
      const input = formRef.current?.querySelector(`[name="${field}"]`);
      input?.focus({ preventScroll: true });
      (input?.closest('fieldset') || input?.closest('.onboarding-field') || input)?.scrollIntoView({ block: 'nearest', behavior: 'instant' });
    });
  }

  function goToStep(nextStep) {
    if (busy) return;
    setStep(nextStep);
    cancelAnimationFrame(focusFrameRef.current);
    focusFrameRef.current = requestAnimationFrame(() => {
      stepHeadingRef.current?.focus({ preventScroll: true });
      window.scrollTo({ top: 0, behavior: 'instant' });
    });
  }

  function updateField(field, value, setter) {
    setter(value);
    setErrors((current) => {
      if (!current[field]) return current;
      const next = { ...current };
      delete next[field];
      return next;
    });
    setSubmitError('');
  }

  function updateWeeklyGoal(value) {
    updateField('goal', value, setGoal);
    if (Number(value) === 7) setRestDays([]);
    setErrors(current => ({ ...current, restDays: undefined }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    if (busy || submissionRef.current) return;
    const isFinalStep = !mobile || step === SETUP_STEPS.length - 1;
    const fields = isFinalStep ? ALL_FIELDS : activeStep.fields;
    const invalidWeightInput = formRef.current?.elements.namedItem('initialWeight')?.validity.badInput;
    const nextErrors = validateOnboardingFields(values, fields, invalidWeightInput);
    setErrors(current => ({ ...Object.fromEntries(Object.entries(current).filter(([field]) => !fields.includes(field))), ...nextErrors }));
    if (Object.keys(nextErrors).length) {
      const firstError = Object.keys(nextErrors)[0];
      if (mobile) setStep(SETUP_STEPS.findIndex(item => item.fields.includes(firstError)));
      focusField(firstError);
      return;
    }
    if (!isFinalStep) { goToStep(step + 1); return; }
    const cleanName = name.trim();
    const numericGoal = Number(goal);
    const weight = initialWeight.trim() === '' ? null : Number(initialWeight);
    submissionRef.current = true;
    setSubmitting(true);
    setSubmitError('');
    try {
      await onComplete({
        profile: { name: cleanName, gender, goal: numericGoal, restDays: normalizeRestDays(restDays, numericGoal), fitnessGoal, createdAt: new Date().toISOString() },
        level,
        trainingPlace,
        initialWeight: weight,
      });
    } catch (failure) {
      setSubmitError(failure?.message || 'We couldn’t save your profile. Please try again.');
    } finally {
      submissionRef.current = false;
      setSubmitting(false);
    }
  }

  const saveError = submitError || (typeof error === 'string' ? error : error?.message);
  const readyForPreview = Boolean(normalizeGender(gender)) && FITNESS_GOALS.some((item) => item.id === fitnessGoal) && LEVELS.some((item) => item.id === level) && TRAINING_PLACES.some((item) => item.id === trainingPlace) && Number.isInteger(Number(goal)) && Number(goal) >= 1 && Number(goal) <= 7 && normalizeRestDays(restDays, Number(goal)) !== null;
  const preview = readyForPreview ? getSuggestedWeekPlan({ fitnessGoal, gender, level, trainingPlace, weeklyGoal: Number(goal), restDays }) : null;

  return (
    <main className={`onboarding-page${mobile ? ' onboarding-page--guided' : ''}`}>
      <div className="onboarding-shell">
        {!mobile && <section className="onboarding-story" aria-labelledby="onboarding-welcome">
          <FitTrackLogo className="onboarding-brand" inverse/>
          <div className="onboarding-story-copy">
            <span className="onboarding-eyebrow">A LITTLE BETTER, EVERY DAY</span>
            <h1 id="onboarding-welcome">Your journey<br />starts with<br /><span>you.</span></h1>
            <p>A little movement. A little consistency.<br /> A stronger version of yourself.</p>
          </div>
          <div className="onboarding-promises">
            <div><span className="onboarding-promise-icon"><Home size={19} strokeWidth={1.6} /></span><span><strong>Your space.</strong><small>At home or at the gym, make it yours.</small></span></div>
            <div><span className="onboarding-promise-icon"><Leaf size={19} strokeWidth={1.6} /></span><span><strong>Your pace.</strong><small>Daily plans that meet your experience.</small></span></div>
            <div><span className="onboarding-promise-icon"><TrendingUp size={19} strokeWidth={1.6} /></span><span><strong>Your progress.</strong><small>Every workout is a step forward.</small></span></div>
          </div>
          <div className="onboarding-story-footer"><span /> YOUR PERSONAL BEST STARTS HERE</div>
          <div className="onboarding-story-rings" aria-hidden="true"><i /><i /><i /></div>
        </section>}

        <section className="onboarding-setup" aria-labelledby="onboarding-form-heading">
          {mobile && <div className="onboarding-guided-header">
            <div className="onboarding-guided-topline"><FitTrackLogo className="onboarding-brand"/><span className="onboarding-no-signin"><Check size={13}/>No sign-in needed</span></div>
            <div className="onboarding-step-caption"><span>MAKE IT YOURS</span><span aria-live="polite">Step {step + 1} of {SETUP_STEPS.length}</span></div>
            <ol className="onboarding-steps" aria-label="Setup progress">{SETUP_STEPS.map((item, index) => <li key={item.label} className={index <= step ? 'is-reached' : ''} aria-current={index === step ? 'step' : undefined}><span className="onboarding-step-line"/><span>{item.label}</span></li>)}</ol>
          </div>}
          <header className="onboarding-form-heading">
            {!mobile && <div className="onboarding-form-topline"><span className="onboarding-eyebrow">LET’S MAKE THIS YOURS</span><span className="onboarding-no-signin"><Check size={12} /> No sign-in needed</span></div>}
            {mobile ? <h1 id="onboarding-form-heading" ref={stepHeadingRef} tabIndex={-1}>{activeStep.title}</h1> : <h2 id="onboarding-form-heading">A little about you.</h2>}
            <p>{mobile ? activeStep.description : 'Tell us where you’re starting. We’ll help you find your rhythm.'}</p>
          </header>

          <form ref={formRef} className="onboarding-form" onSubmit={handleSubmit} noValidate aria-busy={busy}>
            {(!mobile || step === 0) && <><div className="onboarding-field">
              <label htmlFor="onboarding-name">What should we call you?</label>
              <input id="onboarding-name" name="name" type="text" autoComplete="off" placeholder="Your name" value={name} maxLength={60} required disabled={busy} onChange={(event) => updateField('name', event.target.value, setName)} aria-invalid={Boolean(errors.name)} aria-describedby={errors.name ? 'onboarding-name-error' : undefined} />
              {errors.name && <p className="onboarding-field-error" id="onboarding-name-error">{errors.name}</p>}
            </div>

            <GenderPicker value={gender} onChange={(value) => updateField('gender', value, setGender)} disabled={busy} error={errors.gender} /></>}

            {(!mobile || step === 1) && <><fieldset className="onboarding-choice-field" disabled={busy}>
              <legend>Where will you train?</legend>
              <div className="onboarding-place-options">
                {TRAINING_PLACES.map((place) => {
                  const Icon = place.id === 'home' ? Home : Dumbbell;
                  return <label className="onboarding-option onboarding-place-option" key={place.id}>
                    <input type="radio" name="trainingPlace" value={place.id} checked={trainingPlace === place.id} required onChange={() => updateField('trainingPlace', place.id, setTrainingPlace)} aria-invalid={Boolean(errors.trainingPlace)} aria-describedby={errors.trainingPlace ? 'onboarding-place-error' : undefined} />
                    <span className="onboarding-option-content"><Icon size={22} strokeWidth={1.6} /><span className="onboarding-option-check" aria-hidden="true"><Check size={11} /></span><strong>{place.label}</strong><small>{place.description}</small></span>
                  </label>;
                })}
              </div>
              {errors.trainingPlace && <p className="onboarding-field-error" id="onboarding-place-error">{errors.trainingPlace}</p>}
            </fieldset>

            <fieldset className="onboarding-choice-field" disabled={busy}>
              <legend>What’s your experience level?</legend>
              <div className="onboarding-level-options">
                {LEVELS.map((item, index) => <label className="onboarding-option onboarding-level-option" key={item.id}>
                  <input type="radio" name="level" value={item.id} checked={level === item.id} required onChange={() => updateField('level', item.id, setLevel)} aria-invalid={Boolean(errors.level)} aria-describedby={errors.level ? 'onboarding-level-error' : undefined} />
                  <span className="onboarding-option-content"><span className={`onboarding-level-bars onboarding-level-bars-${index + 1}`} aria-hidden="true"><i /><i /><i /></span><span className="onboarding-option-check" aria-hidden="true"><Check size={11} /></span><strong>{item.label}</strong><small>{LEVEL_NOTES[item.id] || item.description}</small></span>
                </label>)}
              </div>
              {errors.level && <p className="onboarding-field-error" id="onboarding-level-error">{errors.level}</p>}
            </fieldset></>}

            {(!mobile || step === 2) && <GoalPicker value={fitnessGoal} onChange={(value) => updateField('fitnessGoal', value, setFitnessGoal)} disabled={busy} error={errors.fitnessGoal} />}

            {mobile && step === 3 && <section className="onboarding-review" aria-label="Your choices">
              {[
                { label: 'About you', value: name.trim(), detail: GENDERS.find(item => item.id === gender)?.label, step: 0 },
                { label: 'Training', value: TRAINING_PLACES.find(item => item.id === trainingPlace)?.label, detail: LEVELS.find(item => item.id === level)?.label, step: 1 },
                { label: 'Your goal', value: FITNESS_GOALS.find(item => item.id === fitnessGoal)?.label, detail: `${goal} workout${Number(goal) === 1 ? '' : 's'} per week`, step: 2 },
              ].map(item => <div className="onboarding-review-row" key={item.label}><div><span>{item.label}</span><strong>{item.value}</strong><small>{item.detail}</small>{item.step === 2 && <small>{restDays.length ? `Rest: ${restDays.map(day => DAY_NAMES[day]).join(', ')}` : 'No fixed rest days'}</small>}</div><button type="button" onClick={() => goToStep(item.step)} disabled={busy} aria-label={`Edit ${item.label.toLowerCase()}`}>Edit</button></div>)}
            </section>}

            {(!mobile || step >= 2) && <div className="onboarding-fields-row">
              {(!mobile || step === 2) && <div className="onboarding-field">
                <label htmlFor="onboarding-goal">Your weekly workout goal</label>
                <div className="onboarding-input-icon"><Target size={16} /><TouchSelect id="onboarding-goal" name="goal" value={goal} required disabled={busy} onChange={(event) => updateWeeklyGoal(event.target.value)} aria-invalid={Boolean(errors.goal)} aria-describedby={errors.goal ? 'onboarding-goal-error' : 'onboarding-goal-hint'}><option value="" disabled>Choose your goal</option>{Array.from({ length: 7 }, (_, index) => index + 1).map((days) => <option key={days} value={days}>{days} workout{days === 1 ? '' : 's'} per week</option>)}</TouchSelect></div>
                {errors.goal ? <p className="onboarding-field-error" id="onboarding-goal-error">{errors.goal}</p> : <p className="onboarding-field-hint" id="onboarding-goal-hint">Make room for a little recovery, too.</p>}
              </div>}
              {(!mobile || step === 3) && <div className="onboarding-field">
                <label htmlFor="onboarding-weight">Starting weight <span>Optional</span></label>
                <div className="onboarding-input-unit"><input id="onboarding-weight" name="initialWeight" type="number" inputMode="decimal" placeholder="Add your weight" min="20" max="400" step="0.1" value={initialWeight} disabled={busy} onChange={(event) => updateField('initialWeight', event.target.value, setInitialWeight)} aria-invalid={Boolean(errors.initialWeight)} aria-describedby={errors.initialWeight ? 'onboarding-weight-error' : 'onboarding-weight-hint'} /><span aria-hidden="true">kg</span></div>
                {errors.initialWeight ? <p className="onboarding-field-error" id="onboarding-weight-error">{errors.initialWeight}</p> : <p className="onboarding-field-hint" id="onboarding-weight-hint">A starting point for your weight chart.</p>}
              </div>}
            </div>}

            {(!mobile || step === 2) && goal && <RestDayPicker weeklyGoal={Number(goal)} value={restDays} onChange={value => updateField('restDays', value, setRestDays)} disabled={busy} error={errors.restDays} note="These days stay free of scheduled workouts. Choose them to see your weekly preview."/>}
            {!mobile && fitnessGoal && <GoalApproach goalId={fitnessGoal} />}
            {(!mobile || step === 3) && preview && <SuggestedWeekPreview plans={preview} compact />}
            {mobile && step === 3 && fitnessGoal && <details className="onboarding-review-approach"><summary>How your goal shapes this plan</summary><GoalApproach goalId={fitnessGoal}/></details>}
            {saveError && <p className="onboarding-save-error" role="alert">{saveError}</p>}
            {mobile ? <div className="onboarding-step-actions">
              {step > 0 && <button className="onboarding-back" type="button" onClick={() => goToStep(step - 1)} disabled={busy}><ArrowLeft size={17}/>Back</button>}
              <button className="onboarding-submit" type="submit" disabled={busy}>{busy ? <><LoaderCircle className="onboarding-spinner" size={17}/>Creating your workspace…</> : <><span>{step === SETUP_STEPS.length - 1 ? 'Build my plan' : 'Continue'}</span><ArrowRight size={18}/></>}</button>
            </div> : <>
            <button className="onboarding-submit" type="submit" disabled={busy}>
              {busy ? <><LoaderCircle className="onboarding-spinner" size={17} /> Creating your workspace…</> : <><span>Build my plan</span><ArrowRight size={18} /></>}
            </button>
            <p className="onboarding-can-change">Your starting point, not a limit. You can change these later.</p></>}
          </form>
          <footer className="onboarding-privacy"><LockKeyhole size={13} /><span>Saved privately in this browser. Ready when you return.</span></footer>
        </section>
      </div>
    </main>
  );
}
