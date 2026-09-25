import { lazy, Suspense, useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { ArrowLeftRight, ArrowRight, Check, CheckCheck, ChevronDown, ChevronLeft, ChevronRight, Clock3, ListChecks, Pause, Play, RotateCcw, Sparkles, Timer } from 'lucide-react';
import { EXERCISES, LEVELS } from '../data';
import { getExerciseTarget, getTotalSets } from '../workoutTargets';
import { replaceSessionExercise } from '../exerciseReplacement';
import ExerciseAlternatives from './ExerciseAlternatives';
import ExerciseVideoLinks from './ExerciseVideoLinks';
import './WorkoutSession.css';

const ExerciseDemo = lazy(() => import('./ExerciseDemo'));
const getExercise = id => EXERCISES.find(exercise => exercise.id === id);
const formatTime = seconds => `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;

export default function WorkoutSession({ session, setSession, onComplete, onDiscard, gender, mobile = false, footerTarget = null }) {
  const [paused, setPaused] = useState(false);
  const [rest, setRest] = useState(0);
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const [alternativeExercise, setAlternativeExercise] = useState(null);
  const [showGuidance, setShowGuidance] = useState(false);
  const [showExerciseList, setShowExerciseList] = useState(false);
  const [lastLogged, setLastLogged] = useState(null);
  const alternativeButtonRef = useRef(null);
  const exerciseHeadingRef = useRef(null);
  const id = useId();
  const { plan, exerciseIndex, completed, elapsed } = session;
  // Older saved sessions predate training locations and used the gym catalog.
  const sessionTrainingPlace = plan.trainingPlace || 'gym';
  const exercise = getExercise(plan.exerciseIds[exerciseIndex]);
  const target = getExerciseTarget(plan, exercise);
  const totalSets = getTotalSets(plan);
  const setIndices = Array.from({ length: target.sets }, (_, index) => index);
  const currentCompleted = setIndices.filter(index => (completed[exercise.id] || []).includes(index));
  const nextSet = setIndices.find(index => !currentCompleted.includes(index));
  const currentComplete = nextSet === undefined;
  const countCompleted = exerciseId => Array.from({ length: getExerciseTarget(plan, getExercise(exerciseId)).sets }, (_, index) => index).filter(index => (completed[exerciseId] || []).includes(index)).length;
  const finishedSets = plan.exerciseIds.reduce((sum, exerciseId) => sum + countCompleted(exerciseId), 0);
  const finishedExercises = plan.exerciseIds.filter(exerciseId => countCompleted(exerciseId) === getExerciseTarget(plan, getExercise(exerciseId)).sets).length;
  const workoutComplete = totalSets > 0 && finishedSets === totalSets;
  const hasNext = exerciseIndex < plan.exerciseIds.length - 1;
  const remainingExercise = plan.exerciseIds.findIndex(exerciseId => countCompleted(exerciseId) < getExerciseTarget(plan, getExercise(exerciseId)).sets);
  const canUndo = lastLogged?.exerciseId === exercise.id && currentCompleted.includes(lastLogged.index);

  useEffect(() => {
    if (paused || alternativeExercise) return undefined;
    const timer = setInterval(() => {
      setSession(previous => previous ? { ...previous, elapsed: previous.elapsed + 1 } : previous);
      setRest(previous => Math.max(0, previous - 1));
    }, 1000);
    return () => clearInterval(timer);
  }, [paused, setSession, alternativeExercise]);

  function toggleSet(index) {
    const wasDone = currentCompleted.includes(index);
    setSession(previous => {
      if (!previous) return previous;
      const current = previous.completed[exercise.id] || [];
      return { ...previous, completed: { ...previous.completed, [exercise.id]: current.includes(index) ? current.filter(value => value !== index) : [...current, index] } };
    });
    setLastLogged(wasDone ? null : { exerciseId: exercise.id, index });
  }

  function logSet(index) {
    if (index === undefined) return;
    setSession(previous => {
      if (!previous) return previous;
      const current = previous.completed[exercise.id] || [];
      if (current.includes(index)) return previous;
      return { ...previous, completed: { ...previous.completed, [exercise.id]: [...current, index] } };
    });
    setLastLogged({ exerciseId: exercise.id, index });
  }

  function selectExercise(index) {
    if (index < 0 || index >= plan.exerciseIds.length) return;
    setRest(0); setShowGuidance(false); setShowExerciseList(false); setLastLogged(null);
    setSession(previous => previous ? { ...previous, exerciseIndex: index } : previous);
    requestAnimationFrame(() => {
      exerciseHeadingRef.current?.focus({ preventScroll: true });
      exerciseHeadingRef.current?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
    });
  }

  function closeAlternatives() {
    setAlternativeExercise(null);
    requestAnimationFrame(() => alternativeButtonRef.current?.focus());
  }

  function saveAlternative({ replacementId }) {
    // Validate before submitting an updater so the picker can show errors.
    replaceSessionExercise({ ...session, plan: { ...plan, trainingPlace: sessionTrainingPlace } }, alternativeExercise, replacementId);
    setSession(previous => replaceSessionExercise({ ...previous, plan: { ...previous.plan, trainingPlace: previous.plan.trainingPlace || 'gym' } }, alternativeExercise, replacementId));
    setRest(0); setLastLogged(null); closeAlternatives();
  }

  if (alternativeExercise) return <div className="session-alternative-picker">
    <p className="alternative-session-note"><Pause size={14}/>Your workout timer is paused while you choose an alternative.</p>
    <ExerciseAlternatives key={alternativeExercise} footerTarget={footerTarget} exercise={getExercise(alternativeExercise)} plan={plan} trainingPlace={sessionTrainingPlace} gender={gender} sessionOnly onSave={saveAlternative} onCancel={closeAlternatives}/>
  </div>;

  const alternativeButton = <button type="button" ref={alternativeButtonRef} className={mobile ? 'run-alternative' : 'exercise-alternative-button'} aria-label={`Alternatives for ${exercise.name}`} disabled={Boolean(completed[exercise.id]?.length)} onClick={() => setAlternativeExercise(exercise.id)}><ArrowLeftRight size={15}/>Alternatives</button>;
  const guidanceContent = <div id={`${id}-guide`}><Suspense fallback={<div className="demo-loading">Loading your 3D preview…</div>}><ExerciseDemo exerciseId={exercise.id} group={exercise.group} gender={gender} movement={exercise.movement} name={exercise.name} equipment={exercise.equipment}/></Suspense><ol className="instruction-list session-instructions">{exercise.instructions.map((text, index) => <li key={index}><span>{index + 1}</span>{text}</li>)}</ol><ExerciseVideoLinks exercise={exercise} links={plan.exerciseVideoLinks?.[exercise.id]}/></div>;
  const discard = <div className={mobile ? 'run-discard' : 'session-discard'}>{confirmDiscard ? <><span>Discard this unfinished session?</span><button type="button" className="text-button danger-text" onClick={onDiscard}>Discard session</button><button type="button" className="text-button" onClick={() => setConfirmDiscard(false)}>Keep training</button></> : <button type="button" className="text-button" onClick={() => setConfirmDiscard(true)}>Discard this session</button>}</div>;

  if (mobile) {
    const mainAction = workoutComplete ? { label: 'Finish workout', onClick: onComplete, Icon: CheckCheck }
      : !currentComplete ? { label: `Log set ${nextSet + 1}`, onClick: () => logSet(nextSet), Icon: Check }
        : hasNext ? { label: 'Next exercise', onClick: () => selectExercise(exerciseIndex + 1), Icon: ArrowRight }
          : { label: 'Review remaining sets', onClick: () => selectExercise(remainingExercise), Icon: ListChecks };
    const footer = <div className={`run-footer ${footerTarget ? 'run-footer--portal' : 'run-footer--inline'}`} aria-label="Workout actions">
      <button type="button" className="run-main-action" onClick={mainAction.onClick}><mainAction.Icon size={20}/>{mainAction.label}</button>
      <div className="run-step-navigation"><button type="button" onClick={() => selectExercise(exerciseIndex - 1)} disabled={exerciseIndex === 0}><ChevronLeft size={17}/>Back</button>{!hasNext && !workoutComplete ? <button type="button" disabled>Finish workout <Check size={16}/></button> : hasNext && !currentComplete ? <button type="button" onClick={() => selectExercise(exerciseIndex + 1)}>Next exercise <ChevronRight size={17}/></button> : <span>{workoutComplete ? 'All sets logged' : `${finishedSets} / ${totalSets} sets logged`}</span>}</div>
    </div>;
    return <div className="workout-session workout-run--mobile">
      <div className="run-topbar"><div><span className="run-session-label">{sessionTrainingPlace === 'home' ? 'HOME' : 'GYM'} WORKOUT · IN PROGRESS</span><p>{plan.title}</p></div><div className="run-clock"><Timer size={15}/><strong>{formatTime(elapsed)}</strong><button type="button" aria-label={paused ? 'Resume timer' : 'Pause timer'} aria-pressed={paused} onClick={() => setPaused(value => !value)}>{paused ? <Play size={18}/> : <Pause size={18}/>}</button></div></div>
      <div className="run-progress-line"><span>{finishedSets} of {totalSets} sets logged</span><span>{paused ? 'Timer paused' : 'Saved as you go'}</span></div>
      <div className="run-progress" role="progressbar" aria-label="Workout set progress" aria-valuemin={0} aria-valuemax={totalSets} aria-valuenow={finishedSets}><span style={{ width: `${finishedSets / Math.max(1, totalSets) * 100}%` }}/></div>

      <header className="run-exercise-heading"><span>EXERCISE {exerciseIndex + 1} OF {plan.exerciseIds.length}</span><h3 tabIndex={-1} ref={exerciseHeadingRef}>{exercise.name}</h3><div><p>{exercise.equipment}</p>{alternativeButton}</div></header>
      <section className={`run-set-card${currentComplete ? ' is-complete' : ''}`} aria-label="Current exercise tracking">
        <div className="run-target-heading"><span>{currentComplete ? 'EXERCISE COMPLETE' : `SET ${nextSet + 1} OF ${target.sets}`}</span><span>{currentCompleted.length}/{target.sets} logged</span></div>
        <div className="run-target-value">{currentComplete ? <CheckCheck size={33}/> : null}<strong>{target.reps}</strong><span>{target.unit === 'min' ? 'minutes' : target.unit === 'sec' ? 'seconds' : 'reps'}</span></div>
        <p className="run-target-caption">{currentComplete ? 'Every set is logged. Ready for the next step.' : 'Complete your set, then tap Log set below.'}</p>
        <div className="run-set-chips" aria-label={`${exercise.name} sets`}>{setIndices.map(index => {
          const done = currentCompleted.includes(index);
          return <button type="button" key={index} className={done ? 'is-done' : index === nextSet ? 'is-next' : ''} aria-pressed={done} aria-label={`${done ? 'Undo' : 'Mark'} set ${index + 1}${done ? '' : ' complete'}`} onClick={() => toggleSet(index)}>{done ? <Check size={15}/> : <span className="run-chip-dot"/>}Set {index + 1}</button>;
        })}</div>
        <div className="run-log-status" aria-live="polite">{canUndo ? <><span><Check size={14}/>Set {lastLogged.index + 1} logged</span><button type="button" onClick={() => toggleSet(lastLogged.index)}><RotateCcw size={13}/>Undo</button></> : <span>Tap any set to update its checkmark.</span>}</div>
      </section>

      {target.restSeconds > 0 && <div className={`run-rest${rest > 0 ? ' is-running' : ''}`}>
        <div><span><Clock3 size={15}/>{rest > 0 ? paused ? 'Rest paused' : 'Rest timer' : 'Rest between sets'}</span><strong>{rest > 0 ? formatTime(rest) : `${target.restSeconds}s suggested`}</strong></div>
        {rest > 0 ? <button type="button" onClick={() => setRest(0)}>Skip rest <ChevronRight size={15}/></button> : <button type="button" onClick={() => { setRest(target.restSeconds); if (paused) setPaused(false); }}><Play size={14}/>{paused ? 'Resume & start rest' : 'Start rest'}</button>}
      </div>}

      <div className="run-details"><button type="button" className="run-disclosure" aria-expanded={showExerciseList} aria-controls={`${id}-exercises`} onClick={() => setShowExerciseList(value => !value)}><ListChecks size={19}/><span>Workout exercises<small>{finishedExercises} of {plan.exerciseIds.length} complete</small></span><ChevronDown size={19}/></button>{showExerciseList && <div className="run-exercise-list" id={`${id}-exercises`}>{plan.exerciseIds.map((exerciseId, index) => <button type="button" key={exerciseId} aria-current={index === exerciseIndex ? 'step' : undefined} onClick={() => selectExercise(index)}><span>{countCompleted(exerciseId) === getExerciseTarget(plan, getExercise(exerciseId)).sets ? <Check size={15}/> : index + 1}</span><strong>{getExercise(exerciseId).name}</strong><small>{countCompleted(exerciseId)}/{getExerciseTarget(plan, getExercise(exerciseId)).sets}</small></button>)}</div>}</div>
      <div className="run-details"><button type="button" className="run-disclosure" aria-expanded={showGuidance} aria-controls={`${id}-guide`} onClick={() => setShowGuidance(value => !value)}><Play size={18}/><span>Form & 3D demo<small>Technique, muscles & videos</small></span><ChevronDown size={19}/></button>{showGuidance && <div className="run-guidance-content">{guidanceContent}</div>}</div>
      {Boolean(completed[exercise.id]?.length) && <p className="run-swap-note">To replace this exercise, undo its completed sets first. Your other exercises keep their progress.</p>}
      <p className="run-save-note">Close anytime. Your workout will be here when you return.</p>{discard}
      {footerTarget ? createPortal(footer, footerTarget) : footer}
    </div>;
  }

  return <div className="workout-session">
    <div className="session-topline"><div><h3>{plan.title}</h3><span>{sessionTrainingPlace === 'home' ? 'At home' : 'At the gym'} <i>·</i> {LEVELS.find(level => level.id === plan.level)?.label} <i>·</i> {plan.exerciseIds.length} exercises</span></div><div className="session-clock"><Timer size={17}/><strong>{formatTime(elapsed)}</strong><button type="button" className="icon-button" aria-label={paused ? 'Resume timer' : 'Pause timer'} onClick={() => setPaused(value => !value)}>{paused ? <Play size={16}/> : <Pause size={16}/>}</button></div></div>
    <div className="session-progress"><span style={{ width: `${finishedSets / Math.max(1, totalSets) * 100}%` }}/></div><div className="session-progress-label"><span>{finishedSets} of {totalSets} sets complete</span><strong>{Math.round(finishedSets / Math.max(1, totalSets) * 100)}%</strong></div>
    <div className="session-exercise-heading"><span className="eyebrow">EXERCISE {exerciseIndex + 1} OF {plan.exerciseIds.length}</span><h3 tabIndex={-1} ref={exerciseHeadingRef}>{exercise.name}</h3><div className="session-exercise-meta"><span>{exercise.equipment}</span>{alternativeButton}</div>{Boolean(completed[exercise.id]?.length) && <p className="session-alternative-hint">To replace this exercise, uncheck its completed sets first. Your other exercises keep their progress.</p>}</div>
    <p className="session-form-tip"><Sparkles size={15}/>{exercise.instructions[0]}</p>
    <div className="session-layout"><div className="session-guidance">{guidanceContent}</div><div className="session-tracking">
      <div className="set-heading"><h3>Your sets</h3><span>{target.reps} {target.unit} each</span></div>
      <div className="sets-list">{setIndices.map(index => { const done = currentCompleted.includes(index); return <button type="button" key={index} className={`set-button ${done ? 'done' : ''}`} onClick={() => toggleSet(index)} aria-pressed={done}><span className="set-checkbox">{done && <Check size={15}/>}</span><strong>Set {index + 1}</strong><span>{done ? 'Completed' : `${target.reps} ${target.unit}`}</span></button>; })}</div>
      {target.restSeconds > 0 && <div className="rest-timer"><div><Clock3 size={17}/><span>{rest > 0 ? 'Take a breath' : 'Make room for a rest'}</span></div>{rest > 0 ? <><strong>{formatTime(rest)}</strong><button type="button" onClick={() => setRest(0)}>Skip rest <ChevronRight size={13}/></button></> : <button type="button" onClick={() => setRest(target.restSeconds)}>Start {target.restSeconds}-second rest <Play size={13}/></button>}</div>}
      <div className="session-navigation"><button type="button" className="button button-secondary" disabled={exerciseIndex === 0} onClick={() => selectExercise(exerciseIndex - 1)}><ChevronLeft size={15}/>Back</button>{hasNext ? <button type="button" className="button button-green" onClick={() => selectExercise(exerciseIndex + 1)}>Next exercise<ArrowRight size={15}/></button> : <button type="button" className="button button-green" disabled={!workoutComplete} onClick={onComplete}>Finish workout<Check size={16}/></button>}</div>
    </div></div>
    <div className="session-exercise-tabs" aria-label="Workout exercises">{plan.exerciseIds.map((exerciseId, index) => <button type="button" key={exerciseId} className={index === exerciseIndex ? 'active' : ''} aria-current={index === exerciseIndex ? 'step' : undefined} onClick={() => selectExercise(index)}>{countCompleted(exerciseId) === getExerciseTarget(plan, getExercise(exerciseId)).sets ? <Check size={14}/> : <span>{index + 1}</span>}{getExercise(exerciseId).name}</button>)}</div>
    <p className="session-save-note">Your sets are saved as you go. Close this window and resume whenever you’re ready.</p>{discard}
  </div>;
}
