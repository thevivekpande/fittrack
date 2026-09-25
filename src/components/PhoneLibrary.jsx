import TouchSelect from './TouchSelect';
import { useEffect, useState } from 'react';
import { Check, ChevronRight, Dumbbell, Plus, Search, X } from 'lucide-react';
import { matchesExercise, muscleLabel } from '../exerciseSearch';

export default function PhoneLibrary({ exercises, trainingPlace, query, onQuery, filter, onFilter, todayIds, onDemo, onAdd }) {
  const [limit,setLimit]=useState(12);
  useEffect(()=>setLimit(12),[query,filter,trainingPlace]);
  const results=exercises.filter(exercise=>(filter==='All exercises'||exercise.group===filter)&&matchesExercise(exercise,query));
  return <div className="phone-library">
    <header className="phone-page-heading"><div><p>{trainingPlace==='gym'?'Gym':'Home'} movements</p><h1>Exercise library</h1></div></header>
    <div className="phone-library-tools"><div className="phone-search"><Search size={20}/><input type="search" aria-label="Search exercises" placeholder="Search exercises or muscles" value={query} onChange={event=>onQuery(event.target.value)}/>{query&&<button aria-label="Clear search" onClick={()=>onQuery('')}><X size={18}/></button>}</div><div className="phone-library-filter"><label>Muscle group<TouchSelect aria-label="Filter by muscle group" value={filter} onChange={event=>onFilter(event.target.value)}>{['All exercises',...new Set(exercises.map(exercise=>exercise.group))].map(group=><option value={group} key={group}>{muscleLabel(group)}</option>)}</TouchSelect></label><span role="status">{results.length} {results.length===1?'exercise':'exercises'}</span></div></div>
    <div className="phone-library-results">{results.slice(0,limit).map(exercise=>{
      const added=todayIds.includes(exercise.id);
      return <article className="phone-library-row" key={exercise.id}><button className="phone-library-open" aria-label={`View demo for ${exercise.name}`} onClick={()=>onDemo(exercise)}><span className="phone-muscle-icon"><Dumbbell size={21}/></span><span><small>{muscleLabel(exercise.group)}</small><strong>{exercise.name}</strong><span>{exercise.equipment}</span><em>View demo <ChevronRight size={13}/></em></span></button><button className="phone-library-add" disabled={added} aria-label={added?`${exercise.name} is in today’s plan`:`Add ${exercise.name} to today`} onClick={()=>onAdd(exercise)}>{added?<Check size={18}/>:<Plus size={18}/>}<span>{added?'Added':'Add'}</span></button></article>;
    })}</div>
    {!results.length&&<div className="phone-library-empty"><Search size={28}/><h2>No matching exercises</h2><p>Try another name or muscle group.</p><button className="phone-primary" onClick={()=>{onQuery('');onFilter('All exercises');}}>Clear filters</button></div>}
    {results.length>limit&&<button className="phone-load-more" onClick={()=>setLimit(value=>value+12)}>Show more exercises <span>{results.length-limit} more</span></button>}
    {!!results.length&&<p className="phone-plan-note">Use Add to include an exercise in today’s plan.</p>}
  </div>;
}
