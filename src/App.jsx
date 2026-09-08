import { lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { Activity, AlertCircle, ArrowRight, ArrowUpRight, Award, Bell, CalendarDays, Check, CheckCheck, ChevronDown, ChevronLeft, ChevronRight, CircleHelp, Clock3, Dumbbell, Flame, Footprints, HardDrive, Heart, Home, LayoutDashboard, Leaf, Menu, Pause, Play, Plus, Search, SlidersHorizontal, Settings, Sparkles, Target, Timer, TrendingUp, Trophy, X, Zap } from 'lucide-react';
import { LEVELS, TRAINING_PLACES, EXERCISES, getExercisesForPlace, dateKey, getWeekDates } from './data';
import Progress, { ActivityChart } from './components/Progress';
import { calculateStreak, exportSessions } from './storage';
import { useFitnessDatabase } from './database';
import Onboarding from './components/Onboarding';
import WorkoutBuilder from './components/WorkoutBuilder';
import WeeklyPlanEditor from './components/WeeklyPlanEditor';
import { MAX_PLAN_EXERCISES, applyWeeklySplit, resolveWeekPlans, updatePlanExercises, updateTrainingGoal } from './planning';
import { FITNESS_GOALS, getSuggestedWeekPlan } from './goals';
import { matchesExercise, muscleLabel } from './exerciseSearch';
import GoalSetup from './components/GoalSetup';

const ExerciseDemo = lazy(() => import('./components/ExerciseDemo'));
const NAV = [
  {id:'dashboard',label:'Overview',icon:LayoutDashboard},
  {id:'plan',label:'My workout plan',icon:CalendarDays},
  {id:'library',label:'Exercise library',icon:Dumbbell},
  {id:'progress',label:'My progress',icon:TrendingUp},
  {id:'achievements',label:'Achievements',icon:Trophy},
];
const todayIndex = () => (new Date().getDay()+6)%7;
const longDate = new Intl.DateTimeFormat('en-US',{weekday:'short',month:'short',day:'numeric'});
const getExercise = id => EXERCISES.find(exercise=>exercise.id===id);
const formatTime = seconds => `${String(Math.floor(seconds/60)).padStart(2,'0')}:${String(seconds%60).padStart(2,'0')}`;

function App() {
  const database = useFitnessDatabase();
  if (database.loading) return <div className="database-screen"><span className="brand-mark"><Zap size={26} fill="currentColor"/></span><h1>Opening your training space…</h1><p>Checking for your saved profile and progress.</p><span className="database-loader"/></div>;
  if (database.error) return <div className="database-screen" role="alert"><AlertCircle size={34}/><h1>Your saved space couldn’t open.</h1><p>{database.error}</p><button className="button button-green" onClick={database.retry}>Try again</button><small>Allow this site to save browser data, then try again.</small></div>;
  const { data, setData } = database;
  if (!data.profile || !data.level || !data.trainingPlace) return <Onboarding saving={database.saving} error={database.saveError} onComplete={({profile,level,trainingPlace,initialWeight})=>{
    setData(previous=>({...previous,profile,level,trainingPlace,weights:initialWeight===null?previous.weights:[{id:crypto.randomUUID(),date:dateKey(),value:initialWeight},...previous.weights.filter(entry=>entry.date!==dateKey())]}));
  }}/>;
  return <Workspace {...database}/>;
}

function useDatabaseField(data,setData,key) {
  const setValue=useCallback(value=>setData(previous=>({...previous,[key]:typeof value==='function'?value(previous[key]):value})),[key,setData]);
  return [data[key],setValue];
}

function Workspace({data,setData,returning,lastVisit,saving,saveError,saveConflict,retry}) {
  const [view, setView] = useState('dashboard');
  const [level,setLevel] = useDatabaseField(data,setData,'level');
  const [profile,setProfile] = useDatabaseField(data,setData,'profile');
  const [history,setHistory] = useDatabaseField(data,setData,'history');
  const [weights,setWeights] = useDatabaseField(data,setData,'weights');
  const [session,setSession] = useDatabaseField(data,setData,'session');
  const [trainingPlace,setTrainingPlace] = useDatabaseField(data,setData,'trainingPlace');
  const [customPlans,setCustomPlans] = useDatabaseField(data,setData,'customPlans');
  const weeklyPlans = data.weeklyPlans || {};
  const weeklyScope = `${trainingPlace}:${level}`;
  const [modal,setModal] = useState(null);
  const [sidebarOpen,setSidebarOpen] = useState(false);
  const [notifications,setNotifications] = useState(false);
  const [toast,setToast] = useState('');
  const [selectedDay,setSelectedDay] = useState(todayIndex);
  const [weekOffset,setWeekOffset] = useState(0);
  const [query,setQuery] = useState('');
  const [filter,setFilter] = useState('All exercises');
  const dates = getWeekDates(weekOffset);
  const planKey = date => `${trainingPlace}:${level}:${dateKey(date)}`;
  const activeGoal = FITNESS_GOALS.find(goal => goal.id === profile.fitnessGoal);
  const suggestedPlans = getSuggestedWeekPlan({ fitnessGoal: profile.fitnessGoal, level, trainingPlace, weeklyGoal: profile.goal });
  const basePlans = weeklyPlans[weeklyScope] || suggestedPlans;
  const plans = resolveWeekPlans({level,trainingPlace,fitnessGoal:profile.fitnessGoal,weeklyGoal:profile.goal,weeklyPlans,customPlans,dates});
  const todayPlans = resolveWeekPlans({level,trainingPlace,fitnessGoal:profile.fitnessGoal,weeklyGoal:profile.goal,weeklyPlans,customPlans});
  const todayPlan = todayPlans[todayIndex()];
  const availableExercises = getExercisesForPlace(trainingPlace);
  const currentPlan = plans[selectedDay];
  const weekStart = dateKey(getWeekDates()[0]);
  const weekEnd = dateKey(getWeekDates()[6]);
  const hasCustomPlan = Boolean(weeklyPlans[weeklyScope]) || Object.keys(customPlans).some(key => key.startsWith(`${weeklyScope}:`) && key.slice(weeklyScope.length + 1) >= weekStart);
  const weekHistory = history.filter(item=>item.date>=weekStart && item.date<=weekEnd);
  const stats = {workouts:history.length,minutes:history.reduce((sum,h)=>sum+h.duration,0),calories:history.reduce((sum,h)=>sum+h.calories,0),streak:calculateStreak(history)};
  const notify = message => {setToast(message);};
  useEffect(()=>{if(toast){const timer=setTimeout(()=>setToast(''),4000);return()=>clearTimeout(timer);}},[toast]);
  const navigate = id => {if(id==='plan'){setWeekOffset(0);}setView(id);setSidebarOpen(false);setNotifications(false);window.scrollTo({top:0,behavior:'smooth'});};
  const startWorkout = (plan=todayPlan) => {
    if (!session) setSession({id:crypto.randomUUID(),plan:{...plan,level,trainingPlace},exerciseIndex:0,completed:{},elapsed:0});
    setModal({type:'workout'});
  };
  const finishWorkout = () => {
    const completed = {id:session.id,date:dateKey(new Date()),title:session.plan.title,duration:Math.max(1,Math.round(session.elapsed/60)),calories:Math.max(5,Math.round(session.elapsed/60*6)),exercises:session.plan.exerciseIds.length,level:session.plan.level,trainingPlace:session.plan.trainingPlace};
    setData(previous=>({...previous,history:[completed,...previous.history.filter(item=>item.id!==completed.id)],session:null}));
    setModal({type:'complete',workout:completed});
  };
  const activeLevel = LEVELS.find(item=>item.id===level);
  const saveCustomPlan = (date,plan) => {
    setCustomPlans(previous=>({...previous,[planKey(date)]:plan}));
    setModal(null);
    notify('Your exercise choices are saved for this day.');
  };
  const saveWeeklyPlan = plans => {
    setData(previous=>applyWeeklySplit(previous,{trainingPlace,level,plans}));
    setWeekOffset(0);
    setModal(null);
    notify('Your weekly split is saved and will repeat every week.');
  };
  const saveTrainingGoal = ({ fitnessGoal, weeklyGoal, applySuggestion }) => {
    setData(previous => updateTrainingGoal(previous, { fitnessGoal, weeklyGoal, applySuggestion, trainingPlace, level }));
    setWeekOffset(0);
    setModal(null);
    notify(applySuggestion ? 'Your goal and suggested plan are ready. Edit any day to make it yours.' : 'Your goal is saved. Your custom plan is kept.');
  };
  const resetWeeklyPlan = () => {
    setData(previous=>{
      const updated=applyWeeklySplit(previous,{trainingPlace,level,plans:[]});
      const nextWeekly={...updated.weeklyPlans};
      delete nextWeekly[weeklyScope];
      return {...updated,weeklyPlans:nextWeekly};
    });
    setWeekOffset(0);setModal(null);
    notify('Your suggested program is restored.');
  };
  const addToToday = exercise => {
    if(todayPlan.exerciseIds.includes(exercise.id)){notify('This exercise is already in today’s plan.');return;}
    if(todayPlan.exerciseIds.length>=MAX_PLAN_EXERCISES){notify(`Your plan has ${MAX_PLAN_EXERCISES} exercises. Customize it to swap one.`);return;}
    const chosen=[...todayPlan.exerciseIds.map(getExercise).filter(Boolean),exercise];
    const updated=updatePlanExercises(todayPlan,chosen,EXERCISES);
    setCustomPlans(previous=>({...previous,[planKey(new Date())]:updated}));
    notify(`${exercise.name} added to today’s ${trainingPlace==='home'?'home':'gym'} plan.`);
  };
  const levelControl = <div className="level-switch" aria-label="Experience level">{LEVELS.map((item,index)=><button key={item.id} aria-pressed={level===item.id} onClick={()=>{setLevel(item.id);notify(`${item.label} plan is ready. Let's get moving!`);}} className={level===item.id?'selected':''}><span className={`level-bars bars-${index+1}`}><i/><i/><i/></span>{item.label}</button>)}</div>;

  return <div className="app-shell">
    {sidebarOpen && <button className="sidebar-backdrop" aria-label="Close navigation" onClick={()=>setSidebarOpen(false)}/>}
    <aside className={`sidebar ${sidebarOpen?'is-open':''}`}>
      <button className="brand" onClick={()=>navigate('dashboard')} aria-label="FitTrack home"><span className="brand-mark"><Zap size={23} fill="currentColor" strokeWidth={1.5}/></span>fittrack<span className="brand-dot">.</span></button>
      <div className="workspace-label">YOUR PERSONAL BEST STARTS HERE</div>
      <div className="nav-label">WORKSPACE</div>
      <nav aria-label="Main navigation">{NAV.map(({id,label,icon:Icon})=><button key={id} className={`nav-item ${view===id?'active':''}`} onClick={()=>navigate(id)} aria-current={view===id?'page':undefined}><Icon size={19}/><span>{label}</span>{id==='plan'?<span className="nav-count">7</span>:view===id?<span className="active-dot"/>:null}</button>)}</nav>
      <div className="sidebar-bottom">
        <div className="milestone-card"><div className="milestone-visual"><span className="orbit orbit-one"/><span className="orbit orbit-two"/><Trophy size={29} strokeWidth={1.5}/><span className="tiny-star star-one">✦</span><span className="tiny-star star-two">✧</span></div><h3>Small steps. Big changes.</h3><p>Show up for yourself.<br/>Your future self will thank you.</p><button onClick={()=>navigate('achievements')}>Explore your milestones <ArrowUpRight size={15}/></button></div>
        <button className="nav-item" onClick={()=>setModal({type:'settings'})}><Settings size={19}/><span>Settings</span></button>
        <button className="nav-item" onClick={()=>setModal({type:'help'})}><CircleHelp size={19}/><span>Help & getting started</span></button>
        <button className="sidebar-profile" onClick={()=>setModal({type:'settings'})}><Avatar name={profile.name}/><span><strong>{profile.name}</strong><small>Your personal workspace</small></span><ChevronDown size={15}/></button>
      </div>
    </aside>

    <div className="main-shell">
      <header className="topbar"><div className="breadcrumb"><button className="icon-button mobile-menu" aria-label="Open navigation" onClick={()=>setSidebarOpen(true)}><Menu size={21}/></button><span>My workspace</span><ChevronRight size={13}/><strong>{NAV.find(item=>item.id===view)?.label}</strong></div><div className="topbar-actions"><span className="header-date"><CalendarDays size={16}/>{longDate.format(new Date())}</span><span className="header-divider"/><div className="notification-wrap"><button className={`icon-button bell-button ${notifications?'pressed':''}`} aria-label="Notifications" aria-expanded={notifications} onClick={()=>setNotifications(!notifications)}><Bell size={19}/><span className="notification-dot"/></button>{notifications&&<div className="notification-popover"><h3>Your daily nudge <Sparkles size={16}/></h3><p>{session?'Your workout is waiting. Pick up where you left off.':"A little movement goes a long way. Your daily plan is ready when you are."}</p><button className="text-button" onClick={()=>{setNotifications(false);startWorkout();}}>{session?'Resume workout':'View today’s workout'} <ArrowRight size={14}/></button></div>}</div><button className="avatar-button" onClick={()=>setModal({type:'settings'})} aria-label="Edit your profile"><Avatar name={profile.name}/></button></div></header>
      <main id="main-content">
        <div className="training-context-bar"><div className="place-switch" role="group" aria-label="Training location">{TRAINING_PLACES.map(place=>{const Icon=place.id==='home'?Home:Dumbbell;return <button key={place.id} aria-pressed={trainingPlace===place.id} className={trainingPlace===place.id?'selected':''} onClick={()=>{if(trainingPlace!==place.id){setTrainingPlace(place.id);setFilter('All exercises');setQuery('');notify(`${place.label} plans and exercises are ready.`);}}}><Icon size={15}/>{place.label}</button>;})}</div><div className={`local-save-status ${saveError?'save-failed':''}`} role="status"><HardDrive size={13}/>{saveError?'Changes haven’t saved':saving?'Saving changes…':'Saved on this device'}</div></div>
        {saveError&&<div className="save-error-banner" role="alert"><AlertCircle size={19}/><div><strong>We couldn’t save your latest changes.</strong><p>{saveError}</p></div><button className="button button-secondary" onClick={saveConflict?()=>setModal({type:'reload'}):retry}>{saveConflict?'Load latest data':'Retry save'}</button></div>}
        {view==='dashboard'&&returning&&lastVisit&&<div className="returning-note"><CheckCheck size={14}/><span>Your progress is right where you left it.</span><span>Last visit: {new Date(lastVisit).toLocaleDateString('en-US',{month:'short',day:'numeric'})}</span></div>}
        {(view==='dashboard'||view==='plan')&&<TrainingFocus goal={activeGoal} weeklyGoal={profile.goal} isCustom={hasCustomPlan} onEdit={()=>setModal({type:'goals'})}/>}
        {view==='dashboard'&&<>
          <div className="page-heading"><div><div className="eyebrow">A LITTLE BETTER, EVERY DAY</div><h1>{returning?'Welcome back,':'Let’s make it count,'} {profile.name.split(' ')[0]}. <span className="wave">✺</span></h1><p>You bring the effort. We’ll help you find your rhythm.</p></div><div className="level-picker"><span>Your fitness level</span>{levelControl}</div></div>
          <section className="hero-grid">
            <div className="hero-card"><img className="hero-image" src={trainingPlace==='gym'?'https://images.unsplash.com/photo-1534438327276-14e5300c3a48?auto=format&fit=crop&w=1500&q=85':'/images/home-training.jpg'} alt={trainingPlace==='gym'?'Sunlit gym with weights and training equipment':'Bodyweight training in a bright room at home'}/><div className="hero-shade"/><div className="hero-content"><span className="hero-tag"><span/> {trainingPlace==='home'?'YOUR SPACE. YOUR PACE.':'BUILT AROUND YOU'}</span><h2>Stronger than<br/>yesterday<span>.</span></h2><p>{trainingPlace==='home'?<>No gym needed. Just a little room to move.<br/>Your home, your next personal best.</>:<>Your next chapter starts with one workout.<br/>Let’s take that first rep together.</>}</p><button className="button button-orange" onClick={()=>startWorkout()}><Play size={15} fill="currentColor"/>{session?'Resume workout':todayPlan.rest?'Start recovery session':'Start today’s workout'}<ArrowRight size={17}/></button><div className="hero-details"><span><Clock3 size={13}/>{todayPlan.duration} min</span><span className="detail-dot"/><span>{todayPlan.exerciseIds.length} exercises</span><span className="detail-dot"/><span>{activeLevel.label} friendly</span></div></div><div className="hero-floating"><span className="floating-icon"><Activity size={20}/></span><span><small>TODAY’S FOCUS</small><strong>{todayPlan.focus}</strong></span><span className="floating-spark">↗</span></div></div>
            <div className="goal-card"><div className="card-topline"><h3>Your weekly goal</h3><span className="soft-icon"><Target size={18}/></span></div><p>Consistency is your superpower.</p><div className="goal-ring"><svg viewBox="0 0 180 180" aria-label={`${weekHistory.length} of ${profile.goal} weekly workouts completed`} role="img"><circle className="ring-track" cx="90" cy="90" r="70"/><circle className="ring-progress" cx="90" cy="90" r="70" style={{strokeDasharray:`${Math.min(weekHistory.length/profile.goal,1)*440} 440`}}/></svg><div className="ring-label"><span><strong>{weekHistory.length}</strong><span> / {profile.goal}</span></span><small>workouts completed</small></div><div className="ring-star"><Sparkles size={15}/></div></div><div className="goal-footer"><span className="goal-status-dot"/>{weekHistory.length>=profile.goal?'Goal crushed. Look at you go!':`${profile.goal-weekHistory.length} more. You’ve got this!`}<span>💪</span></div></div>
          </section>
          {history.length===0&&<div className="first-workout-note"><Footprints size={20}/><div><strong>A fresh start. All yours.</strong><p>Your progress begins with the workouts you complete. Your first session is ready whenever you are.</p></div></div>}<Stats stats={stats}/>
          <div className="dashboard-lower"><section className="card today-card"><div className="section-card-heading"><div><h2>On the plan today <span className="subtle-tag">{todayPlan.day}</span></h2><p>{todayPlan.title} <span>·</span> A stronger you, one rep at a time.</p></div><button className="text-button" onClick={()=>{setSelectedDay(todayIndex());navigate('plan');}}>View plan <ArrowUpRight size={15}/></button></div><div className="exercise-preview-list">{todayPlan.exerciseIds.slice(0,3).map((id,index)=><ExerciseRow key={id} exercise={getExercise(id)} index={index} plan={todayPlan} onDemo={exercise=>setModal({type:'demo',exercise})}/>)}</div><div className="today-card-footer"><span><span className="green-dot"/>{todayPlan.exerciseIds.length} exercises, one step closer</span><button className="text-button" onClick={()=>startWorkout()}>Let’s do this <ArrowRight size={15}/></button></div></section><ActivityChart history={history} compact/></div>
          <section className="week-section"><div className="section-heading"><div><h2>A week of showing up</h2><p>Make room for movement. And a little recovery.</p></div><button className="text-button" onClick={()=>navigate('plan')}>See full schedule <ArrowRight size={15}/></button></div><WeekStrip plans={todayPlans} dates={getWeekDates()} history={history} selected={todayIndex()} onSelect={index=>{setSelectedDay(index);navigate('plan');}}/></section>
          <div className="dashboard-footnote"><Leaf size={14}/> Progress isn’t always a straight line. Keep showing up.</div>
        </>}

        {view==='plan'&&<>
          <div className="page-heading"><div><div className="eyebrow">YOUR ROADMAP TO STRONGER</div><h1>A plan that meets you here.</h1><p>Your week, your muscle groups. Build a routine that fits the way you train.</p></div><div className="level-picker"><span>Your fitness level</span>{levelControl}</div></div>
          <div className="plan-banner"><div className="plan-banner-icon"><CalendarDays size={26}/></div><div><h2>{weeklyPlans[weeklyScope]?'Your custom weekly split':activeGoal?'Your suggested weekly plan':`${activeLevel.label} ${trainingPlace==='home'?'home':'gym'} program`}</h2><p>{weeklyPlans[weeklyScope]?`${basePlans.filter(plan=>!plan.rest).length} training days · Repeats every week · ${activeLevel.label}`:activeGoal?`${activeGoal.label} · ${profile.goal} days a week · ${activeLevel.label}`:trainingPlace==='home'?'Legs on Monday? Chest + core on Tuesday? Make it yours.':'Biceps + shoulders on Monday? Chest + triceps on Tuesday? Make it yours.'}</p></div><button className="button button-green weekly-edit-button" onClick={()=>setModal({type:'weekly'})}><SlidersHorizontal size={15}/>Edit weekly split</button></div>
          <div className="weekly-plan-status"><span><CalendarDays size={13}/>{weeklyPlans[weeklyScope]?'Your saved routine repeats across all weeks.':'Choose muscle groups, exercises, and recovery days for your whole week.'}</span>{weeklyPlans[weeklyScope]&&<button className="text-button" onClick={()=>setModal({type:'reset-weekly'})}>Use suggested program <ArrowRight size={13}/></button>}</div>
          <div className="section-heading plan-week-heading"><h2>{weekOffset===0?'This week':weekOffset===-1?'Last week':weekOffset===1?'Next week':'Your schedule'} <span className="week-range">{dates[0].toLocaleDateString('en-US',{month:'short',day:'numeric'})} – {dates[6].toLocaleDateString('en-US',{month:'short',day:'numeric'})}</span></h2><div className="week-navigation"><button className="icon-button" aria-label="Previous week" onClick={()=>setWeekOffset(weekOffset-1)}><ChevronLeft size={17}/></button><button className="text-button" onClick={()=>{setWeekOffset(0);setSelectedDay(todayIndex());}}>Today</button><button className="icon-button" aria-label="Next week" onClick={()=>setWeekOffset(weekOffset+1)}><ChevronRight size={17}/></button></div></div>
          <WeekStrip plans={plans} dates={dates} history={history} selected={selectedDay} onSelect={setSelectedDay}/>
          <div className="plan-detail card"><div className="section-card-heading"><div><span className="eyebrow">{dates[selectedDay].toLocaleDateString('en-US',{weekday:'long',month:'long',day:'numeric'})}</span><h2>{currentPlan.title}</h2><p>{currentPlan.focus} <span>·</span> {currentPlan.duration} minutes <span>·</span> {currentPlan.exerciseIds.length} exercises</p></div><div className="plan-action-buttons"><button className="button button-secondary" onClick={()=>setModal({type:'customize',date:dates[selectedDay],plan:currentPlan})}><SlidersHorizontal size={15}/>Edit this date</button><button className="button button-green" onClick={()=>startWorkout(currentPlan)}><Play size={15} fill="currentColor"/>{session?'Resume workout':currentPlan.rest?'Start recovery':'Start workout'}</button></div></div>{currentPlan.rest&&<div className="recovery-note"><Leaf size={18}/><p>Give yourself room to recover. Keep today’s movement gentle and comfortable.</p></div>}<div className="exercise-preview-list">{currentPlan.exerciseIds.map((id,index)=><ExerciseRow key={id} exercise={getExercise(id)} index={index} plan={currentPlan} onDemo={exercise=>setModal({type:'demo',exercise})}/>)}</div><div className="plan-note"><Heart size={16}/><span>{trainingPlace==='home'?'Give yourself room to move. Focus on control and a comfortable range.':'Start with a comfortable weight. Focus on your form, then build from there.'}</span></div></div>
        </>}

        {view==='library'&&<>
          <div className="page-heading"><div><div className="eyebrow">MOVE WITH CONFIDENCE</div><h1>Good form. Great foundations.</h1><p>Explore your exercises with step-by-step cues and interactive 3D demos.</p></div><span className="library-count"><Dumbbell size={17}/>{availableExercises.length} {trainingPlace==='home'?'home':'gym'} exercises</span></div>
          <div className="library-toolbar"><div className="search-field"><Search size={18}/><input aria-label="Search exercises" placeholder="Find an exercise or muscle group…" value={query} onChange={event=>setQuery(event.target.value)}/>{query&&<button aria-label="Clear search" onClick={()=>setQuery('')}><X size={15}/></button>}</div><div className="library-filters">{['All exercises',...new Set(availableExercises.map(e=>e.group))].map(group=><button key={group} className={filter===group?'active':''} onClick={()=>setFilter(group)} aria-pressed={filter===group}>{muscleLabel(group)}</button>)}</div></div>
          <div className="exercise-library">{availableExercises.filter(e=>(filter==='All exercises'||e.group===filter)&&matchesExercise(e,query)).map(exercise=><button className="exercise-tile" key={exercise.id} onClick={()=>setModal({type:'demo',exercise})}><div className="exercise-tile-image"><img src={exercise.image} alt={exercise.name} loading="lazy"/><span className="demo-badge"><span/> 3D DEMO</span><span className="tile-play"><Play size={23} fill="currentColor"/></span></div><div className="exercise-tile-body"><span className="eyebrow">{muscleLabel(exercise.group)}</span><h3>{exercise.name}<ArrowUpRight size={18}/></h3><p>{exercise.equipment}<span>·</span>{exercise.duration} min</p></div></button>)}</div>
          {!availableExercises.some(e=>(filter==='All exercises'||e.group===filter)&&matchesExercise(e,query))&&<div className="empty-state"><Search size={30}/><h2>No exercises found</h2><p>Try another name, or explore all muscle groups.</p><button className="button button-green" onClick={()=>{setQuery('');setFilter('All exercises');}}>Clear filters</button></div>}
        </>}

        {view==='progress'&&<Progress history={history} weights={weights} onAddWeight={entry=>{setWeights(old=>[entry,...old.filter(w=>w.date!==entry.date)]);notify('Weight logged. Your progress is saved.');}} onExport={()=>{exportSessions(history);notify('Your workout history is ready to download.');}}/>}
        {view==='achievements'&&<Achievements stats={stats}/>}
      </main>
    </div>
    {toast&&<div className="toast" role="status"><span><Check size={16}/></span>{toast}<button aria-label="Dismiss notification" onClick={()=>setToast('')}><X size={15}/></button></div>}
    {modal&&<Modal title={modal.type==='demo'?modal.exercise.name:modal.type==='workout'?'Your workout':modal.type==='settings'?'Make this space yours.':modal.type==='help'?'A little help getting started.':modal.type==='customize'?'Make this workout yours.':modal.type==='weekly'?'Build your weekly split.':modal.type==='goals'?'What are you training for?':modal.type==='reset-weekly'?'Restore your suggested program?':modal.type==='reload'?'Load your latest saved progress?':'You showed up. You got stronger.'} onClose={()=>setModal(null)} wide={modal.type==='workout'} weekly={modal.type==='weekly'} goal={modal.type==='goals'}>
      {modal.type==='demo'&&<><div className="demo-modal-meta"><span className="pill">{muscleLabel(modal.exercise.group)}</span><span>{modal.exercise.equipment}</span><span><Clock3 size={14}/>{modal.exercise.duration} min</span></div><Suspense fallback={<div className="demo-loading"><Activity className="loading-pulse" size={28}/>Setting up your movement preview…</div>}><ExerciseDemo movement={modal.exercise.movement} name={modal.exercise.name} equipment={modal.exercise.equipment}/></Suspense><h3 className="form-heading">Make every rep count</h3><ol className="instruction-list">{modal.exercise.instructions.map((text,i)=><li key={i}><span>{i+1}</span>{text}</li>)}</ol><div className="demo-footer"><span><Sparkles size={15}/> Make room for this in your next session.</span><button className="button button-green" disabled={todayPlan.exerciseIds.includes(modal.exercise.id)} onClick={()=>addToToday(modal.exercise)}>{todayPlan.exerciseIds.includes(modal.exercise.id)?<><Check size={15}/>In today’s plan</>:<><Plus size={15}/>Add to today</>}</button></div></>}
      {modal.type==='reload'&&<div className="help-content"><p>Another tab has newer progress. Reloading will open those saved records and discard any changes in this tab that haven’t saved.</p><div className="builder-footer"><button className="button button-secondary" onClick={()=>setModal(null)}>Keep this tab open</button><button className="button button-green" onClick={()=>window.location.reload()}>Load latest data</button></div></div>}
      {modal.type==='goals'&&<GoalSetup profile={profile} trainingPlace={trainingPlace} level={level} hasCustomPlan={hasCustomPlan} onSave={saveTrainingGoal} onCancel={()=>setModal(null)}/>}
      {modal.type==='weekly'&&<WeeklyPlanEditor plans={basePlans} exercises={availableExercises} trainingPlace={trainingPlace} level={level} onSave={saveWeeklyPlan} onCancel={()=>setModal(null)}/> }
      {modal.type==='reset-weekly'&&<div className="help-content"><p>This will replace your {activeLevel.label.toLowerCase()} {trainingPlace==='home'?'home':'gym'} split and individual day edits from this week onward with {activeGoal?`a ${activeGoal.label.toLowerCase()} suggestion for your ${profile.goal}-day weekly target`:'the suggested program'}.</p><div className="builder-footer"><button className="button button-secondary" onClick={()=>setModal(null)}>Keep my split</button><button className="button button-green" onClick={resetWeeklyPlan}>Restore program</button></div></div>}
      {modal.type==='customize'&&<WorkoutBuilder plan={modal.plan} exercises={availableExercises} trainingPlace={trainingPlace} onSave={plan=>saveCustomPlan(modal.date,plan)} onCancel={()=>setModal(null)}/> }
      {modal.type==='workout'&&session&&<WorkoutSession session={session} setSession={setSession} onComplete={finishWorkout} onDiscard={()=>{setSession(null);setModal(null);notify('Workout discarded. Your past progress is still saved.');}}/>}
      {modal.type==='complete'&&<div className="completion"><div className="completion-emblem"><Trophy size={46}/><span>✦</span><span>✦</span></div><p>One more promise to yourself, kept.<br/>Your {modal.workout.title.toLowerCase()} session is in the books.</p><div className="completion-stats"><div><strong>{modal.workout.exercises}</strong><span>exercises</span></div><div><strong>{modal.workout.duration}<small> min</small></strong><span>time well spent</span></div><div><strong>{modal.workout.calories}</strong><span>est. kcal</span></div></div><button className="button button-green" onClick={()=>{setModal(null);navigate('progress');}}>See your progress <ArrowRight size={17}/></button><small>Saved to your workout history.</small></div>}
      {modal.type==='settings'&&<SettingsForm profile={profile} onGoals={()=>setModal({type:'goals'})} onSave={value=>{setProfile(previous=>({...previous,...value}));setModal(null);notify('Your preferences are saved.');}} onClear={()=>{setData(previous=>({...previous,history:[],weights:[],session:null,customPlans:{},weeklyPlans:{}}));setModal(null);notify('A fresh start. Your own journey begins now.');}}/>}
      {modal.type==='help'&&<div className="help-content"><p>Your own pace. Your next personal best. Here’s how to make FitTrack work for you.</p>{[['01','Find your starting point','Choose a fitness goal, At home or At the gym, and your experience level. We suggest a week based on your goal and available training days. Change your goal anytime from Goals & suggested plan in Settings. In My workout plan, select Edit weekly split to assign muscles such as Biceps and Shoulders to each weekday. Your split repeats every week. Use Edit this date for one-time changes.'],['02','Get familiar with your movements','Open an exercise to watch its 3D preview. Pause, slow it down, and rotate the view to explore the movement.'],['03','Show up and check it off','Start a workout, track each set, and take breaks with the rest timer. Your session can be closed and resumed.'],['04','Watch the little things add up','Completed sessions, weekly activity, weight entries, and achievements update as you go. Export your history anytime.']].map(([number,title,body])=><div className="help-step" key={number}><span>{number}</span><div><h3>{title}</h3><p>{body}</p></div></div>)}<div className="help-storage"><Heart size={19}/><p>Your profile, workouts, and weight entries are saved in this browser’s local database. Return on the same browser and site address to continue. Your progress starts with your own entries; clearing browser data removes it.</p></div></div>}
    </Modal>}
  </div>;
}


function TrainingFocus({goal,weeklyGoal,isCustom,onEdit}) {
  return <section className={`training-focus-card ${goal?'':'needs-goal'}`} aria-label="Your fitness goal">
    <span className="training-focus-icon"><Target size={21}/></span>
    <div><span className="training-focus-eyebrow">{goal?'TRAIN WITH A PURPOSE':'YOUR NEXT STEP'}</span><h2>{goal?goal.label:'What would you like to achieve?'}</h2><p>{goal?goal.approach:'Choose your fitness goal for a suggested plan built around you.'}</p>{goal&&<small>{weeklyGoal} workout{weeklyGoal===1?'':'s'} per week · {isCustom?'Your custom plan is selected':'Your suggested plan is ready to customize'}</small>}</div>
    <button className="button button-secondary" onClick={onEdit}>{goal?'Change goal':'Choose my goal'}<ArrowRight size={15}/></button>
  </section>;
}

function Avatar({name}) {return <span className="avatar">{name.trim().split(/\s+/).slice(0,2).map(part=>part[0]).join('')}</span>;}

function Stats({stats}) {
  const items=[{label:'Total workouts',value:stats.workouts,unit:'sessions',icon:Dumbbell,color:'green',note:'Every session is a win'}, {label:'Time invested',value:(stats.minutes/60).toFixed(1),unit:'hours',icon:Clock3,color:'blue',note:'Time spent getting stronger'}, {label:'Calories burned',value:stats.calories.toLocaleString(),unit:'kcal',icon:Flame,color:'orange',note:'Estimated from your activity'}, {label:'Current streak',value:stats.streak,unit:stats.streak===1?'day':'days',icon:Zap,color:'purple',note:'Keep your momentum going'}];
  return <section className="stats-grid" aria-label="Your fitness stats">{items.map(({label,value,unit,icon:Icon,color,note})=><div className="stat-card" key={label}><div className="stat-top"><span>{label}</span><span className={`stat-icon ${color}`}><Icon size={17}/></span></div><div className="stat-middle"><div className="stat-value">{value}<span>{unit}</span></div></div><div className="stat-note"><span className="stat-note-dot"/>{note}</div></div>)}</section>;
}

function ExerciseRow({exercise,index,plan,onDemo}) {
  if(!exercise)return null;
  return <div className="exercise-row"><span className="exercise-number">{String(index+1).padStart(2,'0')}</span><button className="exercise-thumbnail" onClick={()=>onDemo(exercise)} aria-label={`Preview ${exercise.name}`}><img src={exercise.image} alt="" loading="lazy"/><span><Play size={12} fill="currentColor"/></span></button><div className="exercise-row-name"><button onClick={()=>onDemo(exercise)}>{exercise.name}</button><span>{muscleLabel(exercise.group)}<i/> {plan.sets} sets × {plan.reps} {exercise.movement==='plank'?'sec':'reps'}</span></div><button className="demo-link" onClick={()=>onDemo(exercise)}><span className="demo-link-icon"><Play size={11} fill="currentColor"/></span>View demo<ChevronRight size={14}/></button></div>;
}

function WeekStrip({plans,dates,history,selected,onSelect}) {return <div className="week-strip">{plans.map((plan,index)=>{const done=history.some(item=>item.date===dateKey(dates[index]));const isToday=dateKey(dates[index])===dateKey(new Date());const Icon=plan.rest?Leaf:Dumbbell;return <button key={plan.day} title={`${plan.day}: ${plan.title}`} className={`day-card ${selected===index?'selected':''} ${plan.rest?'rest':''}`} onClick={()=>onSelect(index)} aria-pressed={selected===index}><div className="day-card-top"><span>{plan.day.toUpperCase()} <strong>{dates[index].getDate()}</strong></span>{isToday?<span className="today-label">TODAY</span>:done?<CheckCheck size={14}/>:null}</div><Icon size={20}/><strong className="day-title">{plan.title}</strong><span className="day-duration">{plan.rest?'Recover & recharge':`${plan.duration} min · ${plan.exerciseIds.length} exercises`}</span></button>;})}</div>;}

function Modal({title,onClose,wide,weekly,goal,children}) {
  const container=useRef(null);
  useEffect(()=>{const previouslyFocused=document.activeElement;const previousOverflow=document.body.style.overflow;document.body.style.overflow='hidden';container.current?.focus();const onKey=event=>{if(event.key==='Escape')onClose();if(event.key==='Tab'){const nodes=[...container.current.querySelectorAll('button:not([disabled]),input,select,a[href],[tabindex="0"]')];if(!nodes.length)return;const first=nodes[0],last=nodes.at(-1);if(event.shiftKey&&(document.activeElement===first||document.activeElement===container.current)){event.preventDefault();last.focus();}else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus();}}};document.addEventListener('keydown',onKey);return()=>{document.body.style.overflow=previousOverflow;document.removeEventListener('keydown',onKey);previouslyFocused?.focus();};},[]);
  return <div className="modal-backdrop" onMouseDown={event=>{if(event.target===event.currentTarget)onClose();}}><section className={`modal ${wide?'modal-wide':''} ${weekly?'modal-weekly':''} ${goal?'modal-goals':''}`} role="dialog" aria-modal="true" aria-labelledby="modal-title" ref={container} tabIndex={-1}><div className="modal-header"><div><span className="eyebrow">YOUR FITTRACK SPACE</span><h2 id="modal-title">{title}</h2></div><button className="icon-button" onClick={onClose} aria-label="Close dialog"><X size={21}/></button></div><div className="modal-body">{children}</div></section></div>;
}

function WorkoutSession({session,setSession,onComplete,onDiscard}) {
  const [paused,setPaused]=useState(false);
  const [rest,setRest]=useState(0);
  const [confirmDiscard,setConfirmDiscard]=useState(false);
  const {plan,exerciseIndex,completed,elapsed}=session;
  const exercise=getExercise(plan.exerciseIds[exerciseIndex]);
  const totalSets=plan.sets*plan.exerciseIds.length;
  const finishedSets=Object.values(completed).reduce((sum,sets)=>sum+sets.length,0);
  useEffect(()=>{if(paused)return;const timer=setInterval(()=>{setSession(previous=>previous?{...previous,elapsed:previous.elapsed+1}:previous);setRest(previous=>Math.max(0,previous-1));},1000);return()=>clearInterval(timer);},[paused,setSession]);
  const toggleSet=index=>{setSession(previous=>{const current=previous.completed[exercise.id]||[];return{...previous,completed:{...previous.completed,[exercise.id]:current.includes(index)?current.filter(i=>i!==index):[...current,index]}};});};
  return <div className="workout-session"><div className="session-topline"><div><h3>{plan.title}</h3><span>{plan.trainingPlace==='home'?'At home':'At the gym'} <i>·</i> {LEVELS.find(l=>l.id===plan.level)?.label} <i>·</i> {plan.exerciseIds.length} exercises</span></div><div className="session-clock"><Timer size={17}/><strong>{formatTime(elapsed)}</strong><button className="icon-button" aria-label={paused?'Resume timer':'Pause timer'} onClick={()=>setPaused(!paused)}>{paused?<Play size={16}/>:<Pause size={16}/>}</button></div></div><div className="session-progress"><span style={{width:`${finishedSets/totalSets*100}%`}}/></div><div className="session-progress-label"><span>{finishedSets} of {totalSets} sets complete</span><strong>{Math.round(finishedSets/totalSets*100)}%</strong></div><div className="session-layout"><div><div className="session-exercise-heading"><span className="eyebrow">EXERCISE {exerciseIndex+1} OF {plan.exerciseIds.length}</span><h3>{exercise.name}</h3></div><Suspense fallback={<div className="demo-loading">Loading your 3D preview…</div>}><ExerciseDemo movement={exercise.movement} name={exercise.name} equipment={exercise.equipment}/></Suspense><p className="session-form-tip"><Sparkles size={15}/>{exercise.instructions[0]}</p></div><div className="session-tracking"><div className="set-heading"><h3>Your sets</h3><span>{plan.reps} {exercise.movement==='plank'?'sec':'reps'} each</span></div><div className="sets-list">{Array.from({length:plan.sets},(_,index)=>{const done=(completed[exercise.id]||[]).includes(index);return <button key={index} className={`set-button ${done?'done':''}`} onClick={()=>toggleSet(index)} aria-pressed={done}><span className="set-checkbox">{done&&<Check size={15}/>}</span><strong>Set {index+1}</strong><span>{done?'Completed':`${plan.reps} ${exercise.movement==='plank'?'sec':'reps'}`}</span></button>;})}</div><div className="rest-timer"><div><Clock3 size={17}/><span>{rest>0?'Take a breath':'Make room for a rest'}</span></div>{rest>0?<><strong>{formatTime(rest)}</strong><button onClick={()=>setRest(0)}>Skip rest <ChevronRight size={13}/></button></>:<button onClick={()=>setRest(60)}>Start 60-second rest <Play size={13}/></button>}</div><div className="session-navigation"><button className="button button-secondary" disabled={exerciseIndex===0} onClick={()=>setSession(previous=>({...previous,exerciseIndex:previous.exerciseIndex-1}))}><ChevronLeft size={15}/>Back</button>{exerciseIndex<plan.exerciseIds.length-1?<button className="button button-green" onClick={()=>{setRest(0);setSession(previous=>({...previous,exerciseIndex:previous.exerciseIndex+1}));}}>Next exercise<ArrowRight size={15}/></button>:<button className="button button-green" disabled={finishedSets<totalSets} onClick={onComplete}>Finish workout<Check size={16}/></button>}</div></div></div><div className="session-exercise-tabs">{plan.exerciseIds.map((id,index)=><button key={id} className={index===exerciseIndex?'active':''} onClick={()=>{setRest(0);setSession(previous=>({...previous,exerciseIndex:index}));}}>{(completed[id]||[]).length===plan.sets?<Check size={14}/>:<span>{index+1}</span>}{getExercise(id).name}</button>)}</div><p className="session-save-note">Your sets are saved as you go. Close this window and resume whenever you’re ready.</p><div className="session-discard">{confirmDiscard?<><span>Discard this unfinished session?</span><button className="text-button danger-text" onClick={onDiscard}>Discard session</button><button className="text-button" onClick={()=>setConfirmDiscard(false)}>Keep training</button></>:<button className="text-button" onClick={()=>setConfirmDiscard(true)}>Discard this session</button>}</div></div>;
}

function SettingsForm({profile,onSave,onClear,onGoals}) {
  const [name,setName]=useState(profile.name);
  const [goal,setGoal]=useState(profile.goal);
  const [confirm,setConfirm]=useState(false);
  return <form className="settings-form" onSubmit={event=>{event.preventDefault();if(name.trim())onSave({name:name.trim(),goal:Number(goal)});}}><p>A few small details to make your training feel like you.</p><div className="settings-training-goal"><span><Target size={18}/>{FITNESS_GOALS.find(goal=>goal.id===profile.fitnessGoal)?.label || 'Choose your fitness goal'}</span><button className="text-button" type="button" onClick={onGoals}>Goals & suggested plan <ArrowRight size={14}/></button></div><label>Your name<input required maxLength={40} value={name} onChange={event=>setName(event.target.value)} placeholder="Your name"/></label><label>Weekly workout goal<select value={goal} onChange={event=>setGoal(event.target.value)}>{[1,2,3,4,5,6,7].map(n=><option key={n} value={n}>{n} workout{n===1?'':'s'} per week</option>)}</select><span className="field-hint">Suggestions follow this target. Custom splits stay as saved.</span></label><button className="button button-green" type="submit">Save preferences <Check size={16}/></button><div className="settings-data"><h3>A fresh start</h3><p>Your activity is stored privately in this browser. Clearing it removes your workouts, weight entries, weekly splits, custom day plans, and unfinished session. Your profile and training preferences are kept.</p>{confirm?<div className="reset-confirm"><p>Clear all workout history, weight entries, weekly splits, custom day plans, and your active session? This cannot be undone.</p><button className="button danger-button" type="button" onClick={onClear}>Yes, clear my data</button><button className="text-button" type="button" onClick={()=>setConfirm(false)}>Keep my data</button></div>:<button className="text-button danger-text" type="button" onClick={()=>setConfirm(true)}>Clear activity and start fresh <ArrowRight size={14}/></button>}</div></form>;
}

function Achievements({stats}) {
  const badges=[{name:'The first step',description:'Complete your first workout.',icon:Footprints,value:stats.workouts,target:1,color:'green'}, {name:'Finding your rhythm',description:'Show up for 10 workouts.',icon:Activity,value:stats.workouts,target:10,color:'orange'}, {name:'The twenty club',description:'Complete 20 workouts.',icon:Dumbbell,value:stats.workouts,target:20,color:'blue'}, {name:'A little every day',description:'Build a 7-day workout streak.',icon:Flame,value:stats.streak,target:7,color:'orange'}, {name:'Time well spent',description:'Invest 20 hours in movement.',icon:Clock3,value:stats.minutes,target:1200,color:'purple'}, {name:'Half a century',description:'Make it to 50 workouts.',icon:Trophy,value:stats.workouts,target:50,color:'green'}];
  return <><div className="page-heading"><div><div className="eyebrow">CELEBRATE THE SMALL WINS</div><h1>{stats.workouts?'Look how far you’ve come.':'Your first milestone is waiting.'}</h1><p>Every little milestone is a reminder of what you’re capable of.</p></div><span className="achievement-count"><Award size={19}/>{badges.filter(b=>b.value>=b.target).length} of {badges.length} unlocked</span></div><div className="achievement-banner"><Sparkles size={31}/><div><h2>The real reward? A stronger you.</h2><p>Keep moving. Your next milestone is closer than you think.</p></div></div><div className="achievement-grid">{badges.map(({name,description,icon:Icon,value,target,color})=>{const unlocked=value>=target;return <article key={name} className={`achievement-card ${unlocked?'unlocked':''}`}><span className={`achievement-icon ${color}`}><Icon size={38} strokeWidth={1.5}/></span><span className={`achievement-status ${unlocked?'is-unlocked':''}`}>{unlocked?<><Check size={12}/>UNLOCKED</>:'IN PROGRESS'}</span><h3>{name}</h3><p>{description}</p><div className="achievement-progress"><span style={{width:`${Math.min(value/target,1)*100}%`}}/></div><small>{Math.min(value,target).toLocaleString()} / {target.toLocaleString()} {target===1200?'minutes':name==='A little every day'?'days':'workouts'}</small></article>;})}</div></>;
}

export default App;
