import { useState } from 'react';
import { Check, Dumbbell, Search, SlidersHorizontal, X } from 'lucide-react';
import { MAX_PLAN_EXERCISES, updatePlanExercises } from '../planning';
import './WorkoutBuilder.css';
import { matchesExercise, muscleLabel } from '../exerciseSearch';

export default function WorkoutBuilder({ plan, exercises, trainingPlace, onSave, onCancel }) {
  const [selected, setSelected] = useState([...plan.exerciseIds]);
  const [query, setQuery] = useState('');
  const [group, setGroup] = useState('All');
  const [notice, setNotice] = useState('');
  const filtered = exercises.filter(exercise =>
    (group === 'All' || group === exercise.group) &&
    matchesExercise(exercise, query),
  );

  function toggle(id) {
    if (selected.includes(id)) setSelected(previous => previous.filter(value => value !== id));
    else if (selected.length < MAX_PLAN_EXERCISES) setSelected(previous => [...previous, id]);
    else { setNotice(`Choose up to ${MAX_PLAN_EXERCISES} exercises. Remove one to add another.`); return; }
    setNotice('');
  }

  function save(event) {
    event.preventDefault();
    if (!selected.length || selected.length > MAX_PLAN_EXERCISES) return;
    const chosen = selected.map(id => exercises.find(exercise => exercise.id === id)).filter(Boolean);
    onSave(updatePlanExercises(plan, chosen, exercises));
  }

  return <form className="workout-builder" onSubmit={save}>
    <div className="builder-intro"><span><SlidersHorizontal size={20}/></span><div><h3>Your day. Your exercises.</h3><p>Choose from {exercises.length} {trainingPlace === 'home' ? 'home-friendly' : 'gym'} exercises. These choices apply to this date only. Edit your weekly split to change every week.</p></div></div>
    <div className="builder-selected" aria-label="Selected exercises">
      <div className="builder-selected-heading"><strong>{selected.length} of {MAX_PLAN_EXERCISES} exercises selected</strong><span>Click to remove</span></div>
      <div className="builder-chips">{selected.map((id,index) => <button type="button" key={id} onClick={()=>toggle(id)} aria-label={`Remove ${exercises.find(exercise=>exercise.id===id)?.name}`}><span>{index+1}</span>{exercises.find(exercise=>exercise.id===id)?.name}<X size={12}/></button>)}</div>
      {!selected.length && <p className="builder-empty-selection">Pick your first exercise below.</p>}
    </div>
    <div className="search-field"><Search size={17}/><input aria-label="Find exercises for your workout" placeholder="Search by exercise, muscle, or equipment…" value={query} onChange={event=>setQuery(event.target.value)}/>{query&&<button type="button" aria-label="Clear exercise search" onClick={()=>setQuery('')}><X size={14}/></button>}</div>
    <div className="builder-filters">{['All',...new Set(exercises.map(exercise=>exercise.group))].map(value=><button type="button" key={value} aria-pressed={group===value} className={group===value?'active':''} onClick={()=>setGroup(value)}>{muscleLabel(value)}</button>)}</div>
    <div className="builder-exercises">{filtered.map(exercise=><label className={`builder-exercise ${selected.includes(exercise.id)?'selected':''}`} key={exercise.id}><input type="checkbox" checked={selected.includes(exercise.id)} onChange={()=>toggle(exercise.id)}/><span className="builder-check">{selected.includes(exercise.id)&&<Check size={13}/>}</span><span className="builder-exercise-text"><strong>{exercise.name}</strong><small>{muscleLabel(exercise.group)} <i>·</i> {exercise.equipment}</small></span><span className="builder-duration">{exercise.duration} min</span></label>)}</div>
    {!filtered.length&&<div className="builder-no-results"><Dumbbell size={22}/><p>No exercises match. Try another name or muscle group.</p></div>}
    {(notice || selected.length > MAX_PLAN_EXERCISES)&&<p className="builder-notice" role="status">{notice || `Choose up to ${MAX_PLAN_EXERCISES} exercises. Remove a selected exercise to continue.`}</p>}
    <div className="builder-footer"><button className="button button-secondary" type="button" onClick={onCancel}>Cancel</button><button className="button button-green" type="submit" disabled={!selected.length || selected.length > MAX_PLAN_EXERCISES}>Save {selected.length} exercise{selected.length===1?'':'s'} <Check size={16}/></button></div>
  </form>;
}
