import { useState } from 'react';
import { Check, Dumbbell, Home, Target } from 'lucide-react';
import { LEVELS, TRAINING_PLACES } from '../data';

export default function TrainingPreferences({ trainingPlace, level, onSave, onGoals, onCancel }) {
  const [place,setPlace]=useState(trainingPlace);
  const [experience,setExperience]=useState(level);
  const changed = place !== trainingPlace || experience !== level;
  return <form className="phone-training-form" onSubmit={event=>{event.preventDefault();onSave({trainingPlace:place,level:experience});}}>
    <p>Choose the space and level for your plan.</p>
    <fieldset><legend>Where are you training?</legend>{TRAINING_PLACES.map(item=>{const Icon=item.id==='home'?Home:Dumbbell;return <label key={item.id}><input type="radio" name="preferredPlace" value={item.id} checked={place===item.id} onChange={()=>setPlace(item.id)}/><Icon size={21}/><span><strong>{item.label}</strong><small>{item.description}</small></span></label>;})}</fieldset>
    <fieldset><legend>Your experience</legend>{LEVELS.map(item=><label key={item.id}><input type="radio" name="preferredLevel" value={item.id} checked={experience===item.id} onChange={()=>setExperience(item.id)}/><span><strong>{item.label}</strong></span></label>)}</fieldset>
    <button type="button" className="phone-training-goal" onClick={()=>onGoals({trainingPlace:place,level:experience})}><Target size={18}/>{changed?'Apply & edit goals':'Goals & rest days'}</button>
    <div className="phone-training-actions"><button type="button" onClick={onCancel}>Cancel</button><button className="phone-primary" type="submit">Apply preferences <Check size={18}/></button></div>
  </form>;
}
