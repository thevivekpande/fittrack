import { useRef, useState } from 'react';
import { ArrowRight, Check, Dumbbell, Home, Leaf, LoaderCircle, LockKeyhole, Target, TrendingUp, Zap } from 'lucide-react';
import { LEVELS, TRAINING_PLACES } from '../data';
import { FITNESS_GOALS, getSuggestedWeekPlan } from '../goals';
import GoalPicker, { GoalApproach, SuggestedWeekPreview } from './GoalPicker';
import './Onboarding.css';
import GenderPicker from './GenderPicker';
import { normalizeGender } from '../profile';

const LEVEL_NOTES = {
  beginner: 'A fresh start',
  medium: 'Finding your rhythm',
  experienced: 'Ready for more',
};

export default function Onboarding({ onComplete, saving = false, error = null }) {
  const [name, setName] = useState('');
  const [gender, setGender] = useState('');
  const [trainingPlace, setTrainingPlace] = useState('');
  const [level, setLevel] = useState('');
  const [goal, setGoal] = useState('');
  const [fitnessGoal, setFitnessGoal] = useState('');
  const [initialWeight, setInitialWeight] = useState('');
  const [errors, setErrors] = useState({});
  const [submitError, setSubmitError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const submissionRef = useRef(false);
  const formRef = useRef(null);
  const busy = saving || submitting;

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

  async function handleSubmit(event) {
    event.preventDefault();
    if (busy || submissionRef.current) return;
    const nextErrors = {};
    const cleanName = name.trim();
    if (!cleanName) nextErrors.name = 'Enter the name you’d like us to use.';
    else if (cleanName.length > 60) nextErrors.name = 'Keep your name to 60 characters or fewer.';
    if (!normalizeGender(gender)) nextErrors.gender = 'Choose a gender or Prefer not to say.';
    if (!TRAINING_PLACES.some((place) => place.id === trainingPlace)) nextErrors.trainingPlace = 'Choose where you’d like to train.';
    if (!LEVELS.some((item) => item.id === level)) nextErrors.level = 'Choose the level that feels right for you.';
    if (!FITNESS_GOALS.some((item) => item.id === fitnessGoal)) nextErrors.fitnessGoal = 'Choose your main fitness goal to continue.';
    const numericGoal = Number(goal);
    if (!goal || !Number.isInteger(numericGoal) || numericGoal < 1 || numericGoal > 7) nextErrors.goal = 'Choose a goal from 1 to 7 workouts a week.';
    const weight = initialWeight.trim() === '' ? null : Number(initialWeight);
    const invalidWeightInput = formRef.current?.elements.namedItem('initialWeight')?.validity.badInput;
    if (invalidWeightInput || (weight !== null && (!Number.isFinite(weight) || weight < 20 || weight > 400 || Math.abs(weight * 10 - Math.round(weight * 10)) > 0.000001))) {
      nextErrors.initialWeight = 'Enter 20–400 kg, with up to one decimal place.';
    }
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) {
      const firstError = Object.keys(nextErrors)[0];
      requestAnimationFrame(() => formRef.current?.querySelector(`[name="${firstError}"]`)?.focus());
      return;
    }
    submissionRef.current = true;
    setSubmitting(true);
    setSubmitError('');
    try {
      await onComplete({
        profile: { name: cleanName, gender, goal: numericGoal, fitnessGoal, createdAt: new Date().toISOString() },
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
  const readyForPreview = Boolean(normalizeGender(gender)) && FITNESS_GOALS.some((item) => item.id === fitnessGoal) && LEVELS.some((item) => item.id === level) && TRAINING_PLACES.some((item) => item.id === trainingPlace) && Number.isInteger(Number(goal)) && Number(goal) >= 1 && Number(goal) <= 7;
  const preview = readyForPreview ? getSuggestedWeekPlan({ fitnessGoal, gender, level, trainingPlace, weeklyGoal: Number(goal) }) : null;

  return (
    <main className="onboarding-page">
      <div className="onboarding-shell">
        <section className="onboarding-story" aria-labelledby="onboarding-welcome">
          <div className="onboarding-brand" aria-label="FitTrack">
            <span className="onboarding-brand-mark"><Zap size={25} fill="currentColor" strokeWidth={1.5} /></span>
            fittrack<span className="onboarding-brand-dot">.</span>
          </div>
          <div className="onboarding-story-copy">
            <span className="onboarding-eyebrow">A LITTLE BETTER, EVERY DAY</span>
            <h1 id="onboarding-welcome">Your journey<br />starts with<br /><span>you.</span></h1>
            <p>A little movement. A little consistency.<br />A stronger version of yourself.</p>
          </div>
          <div className="onboarding-promises">
            <div><span className="onboarding-promise-icon"><Home size={19} strokeWidth={1.6} /></span><span><strong>Your space.</strong><small>At home or at the gym, make it yours.</small></span></div>
            <div><span className="onboarding-promise-icon"><Leaf size={19} strokeWidth={1.6} /></span><span><strong>Your pace.</strong><small>Daily plans that meet your experience.</small></span></div>
            <div><span className="onboarding-promise-icon"><TrendingUp size={19} strokeWidth={1.6} /></span><span><strong>Your progress.</strong><small>Every workout is a step forward.</small></span></div>
          </div>
          <div className="onboarding-story-footer"><span /> YOUR PERSONAL BEST STARTS HERE</div>
          <div className="onboarding-story-rings" aria-hidden="true"><i /><i /><i /></div>
        </section>

        <section className="onboarding-setup" aria-labelledby="onboarding-form-heading">
          <header className="onboarding-form-heading">
            <div className="onboarding-form-topline"><span className="onboarding-eyebrow">LET’S MAKE THIS YOURS</span><span className="onboarding-no-signin"><Check size={12} /> No sign-in needed</span></div>
            <h2 id="onboarding-form-heading">A little about you.</h2>
            <p>Tell us where you’re starting. We’ll help you find your rhythm.</p>
          </header>

          <form ref={formRef} className="onboarding-form" onSubmit={handleSubmit} noValidate aria-busy={busy}>
            <div className="onboarding-field">
              <label htmlFor="onboarding-name">What should we call you?</label>
              <input id="onboarding-name" name="name" type="text" autoComplete="off" placeholder="Your name" value={name} maxLength={60} required disabled={busy} onChange={(event) => updateField('name', event.target.value, setName)} aria-invalid={Boolean(errors.name)} aria-describedby={errors.name ? 'onboarding-name-error' : undefined} />
              {errors.name && <p className="onboarding-field-error" id="onboarding-name-error">{errors.name}</p>}
            </div>

            <GenderPicker value={gender} onChange={(value) => updateField('gender', value, setGender)} disabled={busy} error={errors.gender} />

            <fieldset className="onboarding-choice-field" disabled={busy}>
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
            </fieldset>

            <GoalPicker value={fitnessGoal} onChange={(value) => updateField('fitnessGoal', value, setFitnessGoal)} disabled={busy} error={errors.fitnessGoal} />

            <div className="onboarding-fields-row">
              <div className="onboarding-field">
                <label htmlFor="onboarding-goal">Your weekly workout goal</label>
                <div className="onboarding-input-icon"><Target size={16} /><select id="onboarding-goal" name="goal" value={goal} required disabled={busy} onChange={(event) => updateField('goal', event.target.value, setGoal)} aria-invalid={Boolean(errors.goal)} aria-describedby={errors.goal ? 'onboarding-goal-error' : 'onboarding-goal-hint'}><option value="" disabled>Choose your goal</option>{Array.from({ length: 7 }, (_, index) => index + 1).map((days) => <option key={days} value={days}>{days} workout{days === 1 ? '' : 's'} per week</option>)}</select></div>
                {errors.goal ? <p className="onboarding-field-error" id="onboarding-goal-error">{errors.goal}</p> : <p className="onboarding-field-hint" id="onboarding-goal-hint">Make room for a little recovery, too.</p>}
              </div>
              <div className="onboarding-field">
                <label htmlFor="onboarding-weight">Starting weight <span>Optional</span></label>
                <div className="onboarding-input-unit"><input id="onboarding-weight" name="initialWeight" type="number" inputMode="decimal" placeholder="Add your weight" min="20" max="400" step="0.1" value={initialWeight} disabled={busy} onChange={(event) => updateField('initialWeight', event.target.value, setInitialWeight)} aria-invalid={Boolean(errors.initialWeight)} aria-describedby={errors.initialWeight ? 'onboarding-weight-error' : 'onboarding-weight-hint'} /><span aria-hidden="true">kg</span></div>
                {errors.initialWeight ? <p className="onboarding-field-error" id="onboarding-weight-error">{errors.initialWeight}</p> : <p className="onboarding-field-hint" id="onboarding-weight-hint">A starting point for your weight chart.</p>}
              </div>
            </div>

            {fitnessGoal && <GoalApproach goalId={fitnessGoal} />}
            {preview && <SuggestedWeekPreview plans={preview} compact />}
            {saveError && <p className="onboarding-save-error" role="alert">{saveError}</p>}
            <button className="onboarding-submit" type="submit" disabled={busy}>
              {busy ? <><LoaderCircle className="onboarding-spinner" size={17} /> Creating your workspace…</> : <><span>Build my plan</span><ArrowRight size={18} /></>}
            </button>
            <p className="onboarding-can-change">Your starting point, not a limit. You can change these later.</p>
          </form>
          <footer className="onboarding-privacy"><LockKeyhole size={13} /><span>Saved privately in this browser. Ready when you return.</span></footer>
        </section>
      </div>
    </main>
  );
}
