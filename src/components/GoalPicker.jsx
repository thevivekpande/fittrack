import { useId } from 'react';
import { Activity, ArrowUpRight, Check, Dumbbell, Flame, Leaf, Repeat2, Target } from 'lucide-react';
import { FITNESS_GOALS } from '../goals';
import './GoalPicker.css';

const GOAL_ICONS = {
  'fat-loss': Flame,
  'build-muscle': Dumbbell,
  'body-recomposition': Repeat2,
  'general-fitness': Activity,
  'core-strength': Target,
};

export default function GoalPicker({ value = '', onChange, disabled = false, error = null }) {
  const id = useId();
  return <fieldset className="goal-picker" disabled={disabled}>
    <legend>What’s your main fitness goal?</legend>
    <p className="goal-picker-intro" id={`${id}-hint`}>Choose what matters most to you right now.</p>
    <div className="goal-picker-options">
      {FITNESS_GOALS.map((goal) => {
        const Icon = GOAL_ICONS[goal.id] || Target;
        return <label className="goal-picker-option" key={goal.id} htmlFor={`${id}-${goal.id}`}>
          <input id={`${id}-${goal.id}`} type="radio" name="fitnessGoal" value={goal.id} checked={value === goal.id} required onChange={() => onChange(goal.id)} aria-invalid={Boolean(error)} aria-describedby={`${id}-hint${error ? ` ${id}-error` : ''}`} />
          <span className="goal-picker-card"><span className="goal-picker-icon"><Icon size={19} strokeWidth={1.7} /></span><span className="goal-picker-copy"><strong>{goal.label}</strong><small>{goal.description}</small></span><span className="goal-picker-check" aria-hidden="true"><Check size={10} /></span></span>
        </label>;
      })}
    </div>
    {error && <p className="goal-picker-error" id={`${id}-error`}>{error}</p>}
  </fieldset>;
}

export function GoalApproach({ goalId }) {
  const goal = FITNESS_GOALS.find((item) => item.id === goalId);
  if (!goal) return null;
  return <div className="goal-approach" aria-live="polite">
    <span className="goal-approach-label"><Leaf size={14} />Your approach</span>
    <p>{goal.approach}</p>
    {goalId === 'fat-loss' && <div className="goal-fat-loss-note"><p>Ab exercises strengthen your core. Reducing belly fat involves overall fat loss, not just training your abs.</p><a href="https://www.mayoclinic.org/healthy-lifestyle/womens-health/in-depth/belly-fat/art-20045809" target="_blank" rel="noreferrer">Learn why <ArrowUpRight size={12} /><span className="goal-sr-only"> (opens in a new tab)</span></a></div>}
  </div>;
}

export function SuggestedWeekPreview({ plans, compact = false }) {
  if (!plans?.length) return null;
  const trainingDays = plans.filter((plan) => !plan.rest).length;
  return <section className={`goal-week-preview${compact ? ' goal-week-preview--compact' : ''}`} aria-label="Suggested weekly plan preview">
    <div className="goal-week-heading"><h3>{compact ? 'Your week, at a glance' : 'Your suggested week'}</h3><span>{trainingDays} workout{trainingDays === 1 ? '' : 's'} · {plans.length - trainingDays} recovery day{plans.length - trainingDays === 1 ? '' : 's'}</span></div>
    <div className="goal-week-days">{plans.map((plan) => <div className={`goal-week-day${plan.rest ? ' is-recovery' : ''}`} key={plan.day} title={`${plan.day}: ${plan.title} · ${plan.duration} minutes`} aria-label={compact ? `${plan.day}: ${plan.title}, ${plan.duration} minutes` : undefined}>
      <span className="goal-week-day-label">{plan.day}</span>
      {plan.rest ? <Leaf size={compact ? 15 : 17} strokeWidth={1.6} /> : <Dumbbell size={compact ? 15 : 17} strokeWidth={1.6} />}
      {!compact && <><strong>{plan.title}</strong><small>{plan.rest ? 'Recovery' : plan.intensity === 'light' ? 'Light session' : `${plan.duration} min`}</small></>}
    </div>)}</div>
    <p className="goal-week-edit-note">You can edit every day after saving.</p>
  </section>;
}
