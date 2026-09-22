import { lazy, Suspense, useState } from 'react';
import { ArrowLeft, ArrowRight, CalendarDays, Check, Clock3, Dumbbell, Leaf, Play } from 'lucide-react';
import { EXERCISES, LEVELS } from '../data';
import { getRecompositionWeekPlan } from '../recompositionPlan';
import { estimateWorkoutMinutes } from '../planning';
import { applyRestDaySchedule, normalizeRestDays } from '../goals';
import { getExerciseTarget } from '../workoutTargets';
import ExerciseTargets, { targetErrors, TargetSummary } from './ExerciseTargets';
import ExerciseVideoLinks from './ExerciseVideoLinks';
import './RecompositionPlan.css';

const ExerciseDemo = lazy(() => import('./ExerciseDemo'));
const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const findExercise = id => EXERCISES.find(exercise => exercise.id === id);

export function RecompositionBanner({ active, onOpen }) {
  return <section className="recomposition-banner" aria-label="Six-day recomposition program">
    <span className="recomposition-banner-icon"><CalendarDays size={24}/></span>
    <div><span className="eyebrow">FROM YOUR WORKOUT SHEET</span><h3>{active ? 'Your 6-day recomposition split' : 'Six days. A balanced split.'}</h3><p>Strength, core & cardio. Choose your rest day, explore illustrations, and edit your targets.</p></div>
    <button className="button button-secondary" onClick={onOpen}>Review sheet plan <ArrowRight size={15}/></button>
  </section>;
}

export default function RecompositionPlan({ level, gender, restDays, hasCustomPlan, onApply, onCancel }) {
  const [plans, setPlans] = useState(() => applyRestDaySchedule(getRecompositionWeekPlan(level), normalizeRestDays(restDays, 6) || [6]));
  const [dayIndex, setDayIndex] = useState(0);
  const [demoId, setDemoId] = useState(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const plan = plans[dayIndex];
  const exercises = plan.exerciseIds.map(findExercise).filter(Boolean);
  const demo = findExercise(demoId);
  const invalid = plans.some(day => targetErrors(day, day.exerciseIds.map(findExercise).filter(Boolean)).length);
  const updateDay = updater => setPlans(previous => previous.map((day, index) => index === dayIndex ? updater(day) : day));

  function updateTargets(exerciseTargets) {
    updateDay(day => ({ ...day, exerciseTargets, duration: estimateWorkoutMinutes(exercises, day.sets, day.rest, exerciseTargets) }));
  }

  function changeCardio(id) {
    updateDay(day => {
      const oldId = day.exerciseIds.find(value => ['treadmill-walk', 'stationary-bike'].includes(value));
      const exerciseIds = day.exerciseIds.map(value => value === oldId ? id : value);
      const exerciseTargets = { ...day.exerciseTargets };
      const exerciseVideoLinks = { ...day.exerciseVideoLinks };
      const target = getExerciseTarget(day, findExercise(oldId));
      const links = exerciseVideoLinks[oldId];
      delete exerciseTargets[oldId]; delete exerciseVideoLinks[oldId];
      exerciseTargets[id] = target;
      if (links) exerciseVideoLinks[id] = links;
      return { ...day, exerciseIds, exerciseTargets, exerciseVideoLinks, duration: estimateWorkoutMinutes(exerciseIds.map(findExercise), day.sets, false, exerciseTargets) };
    });
  }

  async function apply() {
    if (invalid || saving) return;
    setSaving(true); setError('');
    try { await onApply(plans); }
    catch (problem) { setError(problem?.message || 'The plan could not be saved. Please try again.'); setSaving(false); }
  }

  return <div className="recomposition-plan">
    <div className="recomposition-intro"><span className="eyebrow">BUILD MUSCLE & LOSE FAT</span><h3>A week with intention.</h3><p>The exercise order follows your <strong>6-Day YouTube Gym Playlist</strong>. Each movement includes an interactive illustration and the sheet’s Hindi and English video searches. Choose your day off to arrange the six workouts around your schedule.</p><div className="recomposition-facts"><span><Dumbbell size={14}/>6 gym days</span><span><Leaf size={14}/>{DAYS[plans.findIndex(day => day.rest)]} off</span><span>{LEVELS.find(item => item.id === level)?.label} targets</span></div></div>
    <label className="recomposition-cardio">Weekly rest day<select aria-label="Weekly rest day" disabled={saving} value={plans.findIndex(day => day.rest)} onChange={event => { setPlans(previous => applyRestDaySchedule(previous, [Number(event.target.value)])); setDemoId(null); }}>{DAYS.map((day,index) => <option key={day} value={index}>{day}</option>)}</select></label>
    <div className="recomposition-target-note"><strong>Editable starting targets</strong><p>The sheet does not include sets, reps, hold times, or rest periods. The targets below are FitTrack suggestions. Start with manageable weights and reduce volume or add recovery days when needed.</p></div>
    <nav className="recomposition-days" aria-label="Days in the sheet plan">{plans.map((day, index) => <button type="button" key={day.day} aria-pressed={dayIndex === index} onClick={() => { setDayIndex(index); setDemoId(null); }}><span>{day.day}</span>{day.rest ? <Leaf size={16}/> : <span className="recomposition-day-number">{String(index + 1).padStart(2, '0')}</span>}</button>)}</nav>
    <div className="recomposition-day-heading"><div><span className="eyebrow">{DAYS[dayIndex]}</span><h3>{plan.title}</h3></div>{!plan.rest && <span><Clock3 size={14}/>~{plan.duration} min</span>}</div>
    {plan.rest ? <div className="recomposition-rest"><Leaf size={32}/><h4>Leave room to recover.</h4><p>No workout is scheduled on {DAYS[dayIndex]}. Rest does not create a completed session or add activity to your progress.</p></div>
      : demo ? <div className="recomposition-demo"><button type="button" className="text-button" onClick={() => setDemoId(null)}><ArrowLeft size={15}/>Back to {DAYS[dayIndex]}</button><h4>{demo.name}</h4><TargetSummary plan={plan} exercise={demo} showRest/><Suspense fallback={<div className="demo-loading">Preparing your movement illustration…</div>}><ExerciseDemo gender={gender} movement={demo.movement} name={demo.name} equipment={demo.equipment}/></Suspense><ol className="recomposition-cues">{demo.instructions.map(instruction => <li key={instruction}>{instruction}</li>)}</ol><ExerciseVideoLinks exercise={demo} links={plan.exerciseVideoLinks?.[demo.id]}/></div>
        : <>
          {plan.exerciseIds.some(id => ['treadmill-walk', 'stationary-bike'].includes(id)) && <label className="recomposition-cardio">Your cardio finish<select aria-label="Cardio choice" value={plan.exerciseIds.includes('stationary-bike') ? 'stationary-bike' : 'treadmill-walk'} onChange={event => changeCardio(event.target.value)}><option value="treadmill-walk">Treadmill walking</option><option value="stationary-bike">Stationary cycling</option></select></label>}
          <ol className="recomposition-exercises">{exercises.map((exercise, index) => <li key={exercise.id}><span className="recomposition-exercise-number">{String(index + 1).padStart(2, '0')}</span><div><strong>{exercise.name}</strong><TargetSummary plan={plan} exercise={exercise} showRest/></div><button type="button" onClick={() => setDemoId(exercise.id)} aria-label={`Illustration for ${exercise.name}`}><Play size={16}/><span>Illustration</span></button></li>)}</ol>
          <ExerciseTargets plan={plan} exercises={exercises} onChange={updateTargets} disabled={saving}/>
        </>}
    <div className="recomposition-apply-note"><Check size={16}/><p>Sets your goal to <strong>Build muscle & lose fat</strong> and your target to <strong>6 gym workouts</strong>. {hasCustomPlan ? 'Replaces your gym split and date edits from this week onward. ' : ''}Your workout history and unfinished session stay saved. You can customize every day afterward.</p></div>
    {invalid && <p className="recomposition-error" role="status">Check the exercise targets before saving.</p>}
    {error && <p className="recomposition-error" role="alert">{error}</p>}
    <div className="recomposition-footer"><button type="button" className="button button-secondary" onClick={onCancel} disabled={saving}>Cancel</button><button type="button" className="button button-green" onClick={apply} disabled={saving || invalid}>{saving ? 'Saving…' : 'Use this 6-day plan'}<ArrowRight size={16}/></button></div>
  </div>;
}
