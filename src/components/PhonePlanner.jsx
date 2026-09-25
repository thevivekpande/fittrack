import { ArrowLeftRight, ArrowRight, CalendarDays, Check, ChevronDown, ChevronLeft, ChevronRight, Clock3, Dumbbell, Leaf, Play, Repeat2, SlidersHorizontal, Target } from 'lucide-react';
import { EXERCISES, dateKey } from '../data';
import { TargetSummary } from './ExerciseTargets';

export default function PhonePlanner({ dates, plans, selectedDay, weekOffset, onSelectDay, onWeekChange, onToday, plan, session, history, goal, onStart, onDemo, onAlternative, onEditWeek, onEditDate, onGoals, onSheet, onReset, custom }) {
  const selectedDate = dates[selectedDay];
  const isToday = dateKey(selectedDate) === dateKey();
  const complete = history.some(item => item.date === dateKey(selectedDate));
  const emptyRest = !plan.exerciseIds.length;
  const weekLabel = weekOffset === 0 ? 'This week' : weekOffset === 1 ? 'Next week' : weekOffset === -1 ? 'Last week' : 'Your week';
  return <div className="phone-planner">
    <header className="phone-page-heading"><div><p>{selectedDate.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}</p><h1>{isToday ? 'Today’s workout' : 'Your workout plan'}</h1></div><button className="phone-icon-button" aria-label="Edit weekly plan" onClick={onEditWeek}><SlidersHorizontal size={21}/></button></header>
    <section className="phone-week" aria-label="Weekly schedule">
      <div className="phone-week-heading"><div><strong>{weekLabel}</strong><span>{dates[0].toLocaleDateString('en-US', {month:'short',day:'numeric'})} – {dates[6].toLocaleDateString('en-US', {month:'short',day:'numeric'})}</span></div><div><button aria-label="Previous week" onClick={()=>onWeekChange(-1)}><ChevronLeft size={19}/></button><button className="phone-today" onClick={onToday}>Today</button><button aria-label="Next week" onClick={()=>onWeekChange(1)}><ChevronRight size={19}/></button></div></div>
      <div className="phone-week-days">{dates.map((date,index)=>{
        const done = history.some(item=>item.date===dateKey(date));
        const today = dateKey(date) === dateKey();
        return <button key={dateKey(date)} onClick={()=>onSelectDay(index)} aria-pressed={selectedDay===index} aria-current={today?'date':undefined} aria-label={`${date.toLocaleDateString('en-US',{weekday:'long',month:'short',day:'numeric'})}: ${plans[index].rest?'Rest':plans[index].title}${done?', completed':''}`}>
          <span>{date.toLocaleDateString('en-US',{weekday:'short'}).slice(0,3)}</span><strong>{date.getDate()}</strong><span className="phone-day-status">{done?<Check size={11}/>:plans[index].rest?<Leaf size={11}/>:<i/>}</span>
        </button>;
      })}</div>
    </section>
    <section className={`phone-workout-card${emptyRest?' is-rest':''}`} aria-label="Selected day workout">
      <div className="phone-workout-kicker"><span>{emptyRest?<Leaf size={15}/>:<Dumbbell size={15}/>} {emptyRest?'RECOVERY DAY':plan.rest?'GENTLE MOVEMENT':'YOUR SESSION'}</span>{complete&&<span className="phone-completed"><Check size={13}/>Completed</span>}</div>
      <h2>{plan.title}</h2><p>{emptyRest?'A day to recharge. Your next session will be here when you’re ready.':plan.focus}</p>
      {!emptyRest&&<div className="phone-workout-facts"><span><Clock3 size={15}/>{plan.duration} min</span><span><Dumbbell size={15}/>{plan.exerciseIds.length} exercises</span><span><Repeat2 size={15}/>Weekly routine</span></div>}
    </section>
    {!emptyRest&&<section className="phone-exercises" aria-label="Daily exercises"><div className="phone-section-heading"><h2>Your exercises</h2><span>Tap an exercise for its demo</span></div><ol>{plan.exerciseIds.map((id,index)=>{
      const exercise=EXERCISES.find(item=>item.id===id);
      if(!exercise)return null;
      return <li key={id} className="phone-exercise-row"><button className="phone-exercise-open" aria-label={`View demo for ${exercise.name}`} onClick={()=>onDemo(exercise)}><span className="phone-exercise-number">{String(index+1).padStart(2,'0')}</span><span><strong>{exercise.name}</strong><TargetSummary plan={plan} exercise={exercise}/><small>{exercise.equipment}</small></span></button><button className="phone-exercise-swap" aria-label={`Alternatives for ${exercise.name}`} onClick={()=>onAlternative(exercise)}><ArrowLeftRight size={18}/><span>Swap</span></button></li>;
    })}</ol></section>}
    <details className="phone-plan-options"><summary><span><CalendarDays size={18}/>Manage your plan</span><ChevronDown size={18}/></summary><div>
      <button onClick={onEditWeek}><Repeat2 size={18}/><span><strong>Edit weekly routine</strong><small>Your changes repeat every week</small></span><ChevronRight size={18}/></button>
      <button onClick={onEditDate}><CalendarDays size={18}/><span><strong>Edit this date only</strong><small>Just {selectedDate.toLocaleDateString('en-US',{month:'short',day:'numeric'})}</small></span><ChevronRight size={18}/></button>
      <button onClick={onGoals}><Target size={18}/><span><strong>Goals & rest days</strong><small>{goal?.label || 'Choose your goal'}</small></span><ChevronRight size={18}/></button>
      <button onClick={onSheet}><Dumbbell size={18}/><span><strong>6-day sheet plan</strong><small>Review your recomposition routine</small></span><ChevronRight size={18}/></button>
      {custom&&<button onClick={onReset}><Repeat2 size={18}/><span><strong>Use suggested program</strong><small>Review before replacing your routine</small></span><ChevronRight size={18}/></button>}
    </div></details>
    <p className="phone-plan-note">Your plan stays saved on this device.</p>
    <div className="phone-workout-dock"><div><strong>{session?'Workout in progress':emptyRest?'Rest day':`${plan.exerciseIds.length} exercises`}</strong><span>{session?session.plan.title:emptyRest?'No workout scheduled':`About ${plan.duration} minutes`}</span></div><button className="phone-primary" onClick={session||!emptyRest?onStart:onEditWeek}>{session?<><Play size={17} fill="currentColor"/>Resume workout</>:emptyRest?<>View routine<ArrowRight size={17}/></>:<><Play size={17} fill="currentColor"/>{plan.rest?'Start recovery':'Start workout'}</>}</button></div>
  </div>;
}
