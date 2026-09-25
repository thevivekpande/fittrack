import { lazy, Suspense, useCallback, useEffect, useRef, useState } from 'react';
import { Activity, AlertCircle, ArrowLeftRight, ArrowRight, ArrowUpRight, Award, Bell, CalendarDays, Check, CheckCheck, ChevronDown, ChevronLeft, ChevronRight, CircleHelp, Clock3, Dumbbell, Flame, Footprints, HardDrive, Heart, Home, LayoutDashboard, Leaf, Menu, Pause, Play, Plus, Search, SlidersHorizontal, Settings, Sparkles, Target, TrendingUp, Trophy, UserRound, X, Zap } from 'lucide-react';
import { LEVELS, TRAINING_PLACES, EXERCISES, getExercisesForPlace, dateKey, getWeekDates } from './data';
import Progress, { ActivityChart } from './components/Progress';
import { calculateStreak, exportSessions } from './storage';
import { useFitnessDatabase } from './database';
import Onboarding from './components/Onboarding';
import WorkoutBuilder from './components/WorkoutBuilder';
import WeeklyPlanEditor from './components/WeeklyPlanEditor';
import { MAX_PLAN_EXERCISES, applyWeeklySplit, resolveBaseWeekPlans, resolveWeekPlans, saveDatePlan, updatePlanExercises, updateTrainingGoal } from './planning';
import { FITNESS_GOALS } from './goals';
import { changeTrainingLocation } from './trainingLocation';
import { matchesExercise, muscleLabel } from './exerciseSearch';
import { TargetSummary } from './components/ExerciseTargets';
import ExerciseVideoLinks from './components/ExerciseVideoLinks';
import RecompositionPlan, { RecompositionBanner } from './components/RecompositionPlan';
import GoalSetup from './components/GoalSetup';
import GenderPicker from './components/GenderPicker';
import { normalizeGender } from './profile';
import MobileAccess from './components/MobileAccess';
import PhonePlanner from './components/PhonePlanner';
import WorkoutSession from './components/WorkoutSession';
import PhoneLibrary from './components/PhoneLibrary';
import TrainingPreferences from './components/TrainingPreferences';
import TrainingLocationSwitch from './components/TrainingLocationSwitch';
import FitTrackLogo from './components/FitTrackLogo';
import MoreMenu from './components/MoreMenu';
import ExerciseAlternatives from './components/ExerciseAlternatives';
import { applyExerciseReplacement } from './exerciseReplacement';

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

const MOBILE_QUERY = '(max-width: 900px)';
function useMobileLayout() {
  const [mobile, setMobile] = useState(() => window.matchMedia(MOBILE_QUERY).matches);
  useEffect(() => {
    const query = window.matchMedia(MOBILE_QUERY);
    const update = () => setMobile(query.matches);
    query.addEventListener('change', update);
    return () => query.removeEventListener('change', update);
  }, []);
  return mobile;
}

let scrollLocks = 0;
let restorePageScroll;
function lockPageScroll() {
  if (scrollLocks++ === 0) {
    const { scrollX, scrollY } = window;
    const body = document.body;
    const previous = Object.fromEntries(['overflow', 'position', 'top', 'left', 'width'].map(key => [key, body.style[key]]));
    Object.assign(body.style, { overflow: 'hidden', position: 'fixed', top: `-${scrollY}px`, left: `-${scrollX}px`, width: '100%' });
    restorePageScroll = () => { Object.assign(body.style, previous); window.scrollTo({ left: scrollX, top: scrollY, behavior: 'instant' }); };
  }
  return () => { if (--scrollLocks === 0) restorePageScroll?.(); };
}

function useDialogFocus(container, enabled, onClose) {
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  useEffect(() => {
    if (!enabled) return;
    const previous = document.activeElement;
    const unlock = lockPageScroll();
    container.current?.focus({ preventScroll: true });
    const onKey = event => {
      // The native selection sheet owns focus and Escape while it is open.
      if (event.target.closest?.('dialog[open]')) return;
      if (event.key === 'Escape') { event.preventDefault(); closeRef.current(); }
      if (event.key !== 'Tab' || !container.current) return;
      const nodes = [...container.current.querySelectorAll('button:not(:disabled), input:not(:disabled), select:not(:disabled), textarea:not(:disabled), a[href], [tabindex="0"]')].filter(node => node.getClientRects().length && !node.closest('[inert]'));
      if (!nodes.length) { event.preventDefault(); container.current.focus(); return; }
      const first = nodes[0], last = nodes.at(-1), active = document.activeElement;
      if (!container.current.contains(active) || (event.shiftKey && (active === first || active === container.current))) {
        event.preventDefault(); (event.shiftKey ? last : first).focus();
      } else if (!event.shiftKey && active === last) { event.preventDefault(); first.focus(); }
    };
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('keydown', onKey); unlock();
      requestAnimationFrame(() => {
        if (scrollLocks) return;
        const reachable = previous?.isConnected && !previous.closest('[inert]') && previous.getClientRects().length;
        const fallback = window.matchMedia(MOBILE_QUERY).matches
          ? document.querySelector('.mobile-bottom-nav button[aria-expanded], .mobile-menu')
          : document.querySelector('.sidebar .nav-item[aria-current="page"]');
        (reachable ? previous : fallback)?.focus({ preventScroll: true });
      });
    };
  }, [container, enabled]);
}

function App() {
  return <><Application/><MobileAccess/></>;
}

function Application() {
  const mobile = useMobileLayout();
  const database = useFitnessDatabase();
  if (database.loading) return <div className="database-screen"><FitTrackLogo markOnly/><h1>Opening your training space…</h1><p>Checking for your saved profile and progress.</p><span className="database-loader"/></div>;
  if (database.error) return <div className="database-screen" role="alert"><AlertCircle size={34}/><h1>Your saved space couldn’t open.</h1><p>{database.error}</p><button className="button button-green" onClick={database.retry}>Try again</button><small>Allow this site to save browser data, then try again.</small></div>;
  const { data, setData } = database;
  if (!data.profile || !data.level || !data.trainingPlace) return <Onboarding mobile={mobile} saving={database.saving} error={database.saveError} onComplete={({profile,level,trainingPlace,initialWeight})=>{
    setData(previous=>({...previous,profile,level,trainingPlace,weights:initialWeight===null?previous.weights:[{id:crypto.randomUUID(),date:dateKey(),value:initialWeight},...previous.weights.filter(entry=>entry.date!==dateKey())]}));
  }}/>;
  return <Workspace {...database}/>;
}

function useDatabaseField(data,setData,key) {
  const setValue=useCallback(value=>setData(previous=>({...previous,[key]:typeof value==='function'?value(previous[key]):value})),[key,setData]);
  return [data[key],setValue];
}

function Workspace({data,setData,returning,lastVisit,saving,saveError,saveConflict,retry}) {
  const [view, setView] = useState('plan');
  const level = data.level;
  const [profile,setProfile] = useDatabaseField(data,setData,'profile');
  const [history,setHistory] = useDatabaseField(data,setData,'history');
  const [weights,setWeights] = useDatabaseField(data,setData,'weights');
  const [session,setSession] = useDatabaseField(data,setData,'session');
  const trainingPlace = data.trainingPlace;
  const customPlans = data.customPlans;
  const weeklyPlans = data.weeklyPlans || {};
  const weeklyScope = `${trainingPlace}:${level}`;
  const sourceScope = `${data.planSources?.[level] || trainingPlace}:${level}`;
  const [modal,setModal] = useState(null);
  const [footerTarget,setFooterTarget] = useState(null);
  const [sidebarOpen,setSidebarOpen] = useState(false);
  const mobile = useMobileLayout();
  const sidebarRef = useRef(null);
  const moreOpen = mobile && sidebarOpen && !modal;
  useDialogFocus(sidebarRef, moreOpen, () => setSidebarOpen(false));
  useEffect(() => { if (!mobile) setSidebarOpen(false); }, [mobile]);
  const [notifications,setNotifications] = useState(false);
  const [toast,setToast] = useState('');
  const [navigationRequest,setNavigationRequest] = useState(0);
  useEffect(() => {
    if (!navigationRequest) return;
    const frame = requestAnimationFrame(() => window.scrollTo({ top: 0, behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' }));
    return () => cancelAnimationFrame(frame);
  }, [navigationRequest]);
  const [selectedDay,setSelectedDay] = useState(todayIndex);
  const [weekOffset,setWeekOffset] = useState(0);
  const [currentDate,setCurrentDate] = useState(() => dateKey());
  useEffect(() => { window.scrollTo({top:0,behavior:'instant'}); }, []);
  useEffect(() => {
    const selectCurrentDay = () => {
      const nextDate = dateKey();
      if (nextDate === currentDate) return;
      setCurrentDate(nextDate);
      setSelectedDay(todayIndex());
      setWeekOffset(0);
      setView('plan');
      window.scrollTo({top:0,behavior:'instant'});
    };
    const interval = window.setInterval(selectCurrentDay, 60000);
    window.addEventListener('focus', selectCurrentDay);
    window.addEventListener('pageshow', selectCurrentDay);
    document.addEventListener('visibilitychange', selectCurrentDay);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener('focus', selectCurrentDay);
      window.removeEventListener('pageshow', selectCurrentDay);
      document.removeEventListener('visibilitychange', selectCurrentDay);
    };
  }, [currentDate]);
  const [query,setQuery] = useState('');
  const [filter,setFilter] = useState('All exercises');
  const dates = getWeekDates(weekOffset);
  const activeGoal = FITNESS_GOALS.find(goal => goal.id === profile.fitnessGoal);
  const planOptions = { level, trainingPlace, fitnessGoal: profile.fitnessGoal, gender: profile.gender, weeklyGoal: profile.goal, restDays: profile.restDays, weeklyPlans, customPlans, planSources: data.planSources, datePlanSources: data.datePlanSources };
  const basePlans = resolveBaseWeekPlans(planOptions);
  const plans = resolveWeekPlans({ ...planOptions, dates });
  const todayPlans = resolveWeekPlans(planOptions);
  const todayPlan = todayPlans[todayIndex()];
  const availableExercises = getExercisesForPlace(trainingPlace);
  const currentPlan = plans[selectedDay];
  const weekStart = dateKey(getWeekDates()[0]);
  const weekEnd = dateKey(getWeekDates()[6]);
  const hasCustomPlan = Boolean(weeklyPlans[sourceScope]) || Object.keys(customPlans).some(key => key.startsWith(`${sourceScope}:`) && key.slice(sourceScope.length + 1) >= weekStart) || Object.keys(data.datePlanSources || {}).some(key => key.startsWith(`${level}:`) && key.slice(level.length + 1) >= weekStart);
  const weekHistory = history.filter(item=>item.date>=weekStart && item.date<=weekEnd);
  const stats = {workouts:history.length,minutes:history.reduce((sum,h)=>sum+h.duration,0),calories:history.reduce((sum,h)=>sum+h.calories,0),streak:calculateStreak(history)};
  const notify = message => {setToast(message);};
  useEffect(()=>{if(toast){const timer=setTimeout(()=>setToast(''),4000);return()=>clearTimeout(timer);}},[toast]);
  const navigate = (id,day=todayIndex()) => {if(id==='plan'){setWeekOffset(0);setSelectedDay(day);}setView(id);setSidebarOpen(false);setNotifications(false);setNavigationRequest(value=>value+1);};
  const changeTrainingPlace = nextPlace => {
    if (nextPlace === trainingPlace) return;
    setData(previous => changeTrainingLocation(previous, { trainingPlace: nextPlace }));
    setFilter('All exercises');
    setQuery('');
    const sessionNote = session ? ` Your ${session.plan.trainingPlace === 'home' ? 'home' : 'gym'} workout is still saved.` : '';
    notify(`${nextPlace === 'home' ? 'Home' : 'Gym'} exercises, same muscle plan.${sessionNote}`);
  };
  const startWorkout = (plan=todayPlan) => {
    if (!session && !plan.exerciseIds.length) { notify('This is a complete rest day. Your next workout is on the weekly plan.'); return; }
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
    setData(previous => saveDatePlan(previous, { date, plan, trainingPlace, level }));
    setModal(null);
    notify('Your exercise choices are saved for this day.');
  };
  const openAlternatives = (exercise,plan,date) => setModal({type:'alternative',exercise,plan,date});
  const saveAlternative = ({replacementId,scope}) => {
    setData(previous=>applyExerciseReplacement(previous,{
      sourceId:modal.exercise.id,replacementId,date:modal.date,trainingPlace,level,scope,basePlans,
    }));
    setModal(null);
    notify(scope==='weekly' ? 'Alternative saved for this weekday in your repeating plan.' : 'Alternative saved for this date. Your weekly routine stays as it was.');
  };
  const saveWeeklyPlan = plans => {
    const restDays = plans.flatMap((plan,index) => plan.rest ? [index] : []);
    setData(previous=>{
      const updated = applyWeeklySplit(previous,{trainingPlace,level,plans});
      return restDays.length < 7 ? {...updated,profile:{...updated.profile,goal:7-restDays.length,restDays}} : updated;
    });
    setWeekOffset(0);
    setModal(null);
    notify('Your weekly split is saved and will repeat every week.');
  };
  const useRecompositionPlan = plans => {
    setData(previous => ({
      ...applyWeeklySplit(previous, { trainingPlace: 'gym', level, plans }),
      trainingPlace: 'gym',
      profile: { ...previous.profile, fitnessGoal: 'body-recomposition', goal: 6, restDays: plans.flatMap((plan,index) => plan.rest ? [index] : []) },
    }));
    setFilter('All exercises'); setQuery(''); setWeekOffset(0); setSelectedDay(todayIndex());
    setModal(null); navigate('plan');
    notify('Your six-day recomposition plan is saved and will repeat every week.');
  };
  const saveTrainingGoal = ({ fitnessGoal, gender, weeklyGoal, restDays, applySuggestion }) => {
    setData(previous => updateTrainingGoal(previous, { fitnessGoal, gender, weeklyGoal, restDays, applySuggestion, trainingPlace, level }));
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
    setData(previous => saveDatePlan(previous, { date: new Date(), plan: updated, trainingPlace, level }));
    notify(`${exercise.name} added to today’s ${trainingPlace==='home'?'home':'gym'} plan.`);
  };
  const levelControl = <div className="level-switch" aria-label="Experience level">{LEVELS.map((item,index)=><button key={item.id} aria-pressed={level===item.id} onClick={()=>{setData(previous => changeTrainingLocation(previous, { trainingPlace, level: item.id }));notify(`${item.label} plan is ready. Let's get moving!`);}} className={level===item.id?'selected':''}><span className={`level-bars bars-${index+1}`}><i/><i/><i/></span>{item.label}</button>)}</div>;

  return <div className={`app-shell${mobile?' phone-workspace':''}`}>
    {moreOpen && <MoreMenu ref={sidebarRef} items={NAV} view={view} name={profile.name} onNavigate={navigate} onClose={()=>setSidebarOpen(false)} onSettings={()=>{setSidebarOpen(false);setModal({type:'settings'});}} onHelp={()=>{setSidebarOpen(false);setModal({type:'help'});}}/>}
    {!mobile && <aside id="workspace-navigation" className="sidebar" aria-label="Workspace navigation" inert={Boolean(modal)}>
      <button className="brand" onClick={()=>navigate('dashboard')} aria-label="FitTrack home"><FitTrackLogo/></button>
      <div className="workspace-label">YOUR PERSONAL BEST STARTS HERE</div>
      <div className="nav-label">WORKSPACE</div>
      <nav aria-label="Main navigation">{NAV.map(({id,label,icon:Icon})=><button key={id} className={`nav-item ${view===id?'active':''}`} onClick={()=>navigate(id)} aria-current={view===id?'page':undefined}><Icon size={19}/><span>{label}</span>{id==='plan'?<span className="nav-count">7</span>:view===id?<span className="active-dot"/>:null}</button>)}</nav>
      <div className="sidebar-bottom">
        <div className="milestone-card"><div className="milestone-visual"><span className="orbit orbit-one"/><span className="orbit orbit-two"/><Trophy size={29} strokeWidth={1.5}/><span className="tiny-star star-one">✦</span><span className="tiny-star star-two">✧</span></div><h3>Small steps. Big changes.</h3><p>Show up for yourself.<br/>Your future self will thank you.</p><button onClick={()=>navigate('achievements')}>Explore your milestones <ArrowUpRight size={15}/></button></div>
        <button className="nav-item" onClick={()=>{setSidebarOpen(false);setModal({type:'settings'});}}><Settings size={19}/><span>Settings</span></button>
        <button className="nav-item" onClick={()=>{setSidebarOpen(false);setModal({type:'help'});}}><CircleHelp size={19}/><span>Help & getting started</span></button>
        <button className="sidebar-profile" onClick={()=>{setSidebarOpen(false);setModal({type:'settings'});}}><Avatar name={profile.name}/><span><strong>{profile.name}</strong><small>Your personal workspace</small></span><ChevronDown size={15}/></button>
      </div>
    </aside>}

    <div className="main-shell" inert={Boolean(modal)||moreOpen}>
      {mobile?<header className="phone-topbar"><button className="phone-brand" aria-label="FitTrack home" onClick={()=>navigate('plan')}><FitTrackLogo/></button><div className="phone-topbar-actions"><button className="phone-context-button" aria-label="Change training preferences" onClick={()=>setModal({type:'training'})}>{trainingPlace==='gym'?<Dumbbell size={16}/>:<Home size={16}/>}<span>{trainingPlace==='gym'?'Gym':'Home'}</span><ChevronDown size={14}/></button><button className="phone-profile-button" aria-label="Edit your profile" onClick={()=>setModal({type:'settings'})}><Avatar name={profile.name}/></button></div><span className="phone-save-status" role="status">{saveError?'Changes haven’t saved':saving?'Saving changes…':'Saved on this device'}</span></header>:<header className="topbar"><div className="breadcrumb"><button className="icon-button mobile-menu" aria-label="Open navigation" aria-controls="workspace-navigation" aria-expanded={sidebarOpen} onClick={()=>setSidebarOpen(true)}><Menu size={21}/></button><span>My workspace</span><ChevronRight size={13}/><strong>{NAV.find(item=>item.id===view)?.label}</strong></div><div className="topbar-actions"><span className="header-date"><CalendarDays size={16}/>{longDate.format(new Date())}</span><span className="header-divider"/><div className="notification-wrap"><button className={`icon-button bell-button ${notifications?'pressed':''}`} aria-label="Notifications" aria-expanded={notifications} onClick={()=>setNotifications(!notifications)}><Bell size={19}/><span className="notification-dot"/></button>{notifications&&<div className="notification-popover"><h3>Your daily nudge <Sparkles size={16}/></h3><p>{session?'Your workout is waiting. Pick up where you left off.':"A little movement goes a long way. Your daily plan is ready when you are."}</p><button className="text-button" onClick={()=>{setNotifications(false);startWorkout();}}>{session?'Resume workout':'View today’s workout'} <ArrowRight size={14}/></button></div>}</div><button className="avatar-button" onClick={()=>setModal({type:'settings'})} aria-label="Edit your profile"><Avatar name={profile.name}/></button></div></header>}
      <main id="main-content">
        {!mobile&&<div className="training-context-bar"><div className="place-switch" role="group" aria-label="Training location">{TRAINING_PLACES.map(place=>{const Icon=place.id==='home'?Home:Dumbbell;return <button key={place.id} aria-pressed={trainingPlace===place.id} className={trainingPlace===place.id?'selected':''} onClick={()=>changeTrainingPlace(place.id)}><Icon size={15}/>{place.label}</button>;})}</div><div className={`local-save-status ${saveError?'save-failed':''}`} role="status"><HardDrive size={13}/>{saveError?'Changes haven’t saved':saving?'Saving changes…':'Saved on this device'}</div></div>}
        {saveError&&<div className="save-error-banner" role="alert"><AlertCircle size={19}/><div><strong>We couldn’t save your latest changes.</strong><p>{saveError}</p></div><button className="button button-secondary" onClick={saveConflict?()=>setModal({type:'reload'}):retry}>{saveConflict?'Load latest data':'Retry save'}</button></div>}
        {view==='dashboard'&&returning&&lastVisit&&<div className="returning-note"><CheckCheck size={14}/><span>Your progress is right where you left it.</span><span>Last visit: {new Date(lastVisit).toLocaleDateString('en-US',{month:'short',day:'numeric'})}</span></div>}
        {(view==='dashboard'||view==='plan')&&!profile.gender&&<div className="profile-completion"><UserRound size={21}/><div><strong>Personalize your workout demos</strong><p>Add your gender or choose Prefer not to say. Your saved workouts stay as they are.</p></div><button className="button button-secondary" onClick={()=>setModal({type:'goals'})}>Complete profile <ArrowRight size={14}/></button></div>}
        {view==='dashboard'&&<TrainingFocus goal={activeGoal} weeklyGoal={profile.goal} isCustom={hasCustomPlan} onEdit={()=>setModal({type:'goals'})}/>}
        {view==='dashboard'&&<>
          <div className="page-heading"><div><div className="eyebrow">A LITTLE BETTER, EVERY DAY</div><h1>{returning?'Welcome back,':'Let’s make it count,'} {profile.name.split(' ')[0]}. <span className="wave">✺</span></h1><p>You bring the effort. We’ll help you find your rhythm.</p></div><div className="level-picker"><span>Your fitness level</span>{levelControl}</div></div>
          {mobile&&<TrainingLocationSwitch value={trainingPlace} onChange={changeTrainingPlace}/>}
          <section className="hero-grid">
            <div className="hero-card"><img className="hero-image" src={trainingPlace==='gym'?'https://images.unsplash.com/photo-1534438327276-14e5300c3a48?auto=format&fit=crop&w=1500&q=85':'/images/home-training.jpg'} alt={trainingPlace==='gym'?'Sunlit gym with weights and training equipment':'Bodyweight training in a bright room at home'}/><div className="hero-shade"/><div className="hero-content"><span className="hero-tag"><span/> {trainingPlace==='home'?'YOUR SPACE. YOUR PACE.':'BUILT AROUND YOU'}</span><h2>Stronger than<br/>yesterday<span>.</span></h2><p>{trainingPlace==='home'?<>No gym needed. Just a little room to move.<br/>Your home, your next personal best.</>:<>Your next chapter starts with one workout.<br/>Let’s take that first rep together.</>}</p><button className="button button-orange" disabled={!session&&!todayPlan.exerciseIds.length} onClick={()=>startWorkout()}><Play size={15} fill="currentColor"/>{session?`Resume ${session.plan.trainingPlace==='home'?'home':'gym'} workout`:!todayPlan.exerciseIds.length?'Rest day':todayPlan.rest?'Start recovery session':'Start today’s workout'}<ArrowRight size={17}/></button><div className="hero-details"><span><Clock3 size={13}/>{todayPlan.duration} min</span><span className="detail-dot"/><span>{todayPlan.exerciseIds.length} exercises</span><span className="detail-dot"/><span>{activeLevel.label} friendly</span></div></div><div className="hero-floating"><span className="floating-icon"><Activity size={20}/></span><span><small>TODAY’S FOCUS</small><strong>{todayPlan.focus}</strong></span><span className="floating-spark">↗</span></div></div>
            <div className="goal-card"><div className="card-topline"><h3>Your weekly goal</h3><span className="soft-icon"><Target size={18}/></span></div><p>Consistency is your superpower.</p><div className="goal-ring"><svg viewBox="0 0 180 180" aria-label={`${weekHistory.length} of ${profile.goal} weekly workouts completed`} role="img"><circle className="ring-track" cx="90" cy="90" r="70"/><circle className="ring-progress" cx="90" cy="90" r="70" style={{strokeDasharray:`${Math.min(weekHistory.length/profile.goal,1)*440} 440`}}/></svg><div className="ring-label"><span><strong>{weekHistory.length}</strong><span> / {profile.goal}</span></span><small>workouts completed</small></div><div className="ring-star"><Sparkles size={15}/></div></div><div className="goal-footer"><span className="goal-status-dot"/>{weekHistory.length>=profile.goal?'Goal crushed. Look at you go!':`${profile.goal-weekHistory.length} more. You’ve got this!`}<span>💪</span></div></div>
          </section>
          {history.length===0&&<div className="first-workout-note"><Footprints size={20}/><div><strong>A fresh start. All yours.</strong><p>Your progress begins with the workouts you complete. Your first session is ready whenever you are.</p></div></div>}<Stats stats={stats}/>
          <div className="dashboard-lower"><section className="card today-card"><div className="section-card-heading"><div><h2>On the plan today <span className="subtle-tag">{todayPlan.day}</span></h2><p>{todayPlan.title} <span>·</span> A stronger you, one rep at a time.</p></div><button className="text-button" onClick={()=>{setSelectedDay(todayIndex());navigate('plan');}}>View plan <ArrowUpRight size={15}/></button></div><div className="exercise-preview-list">{todayPlan.exerciseIds.slice(0,3).map((id,index)=><ExerciseRow key={id} exercise={getExercise(id)} index={index} plan={todayPlan} onAlternative={exercise=>openAlternatives(exercise,todayPlan,new Date())} onDemo={exercise=>setModal({type:'demo',exercise,videoLinks:todayPlan.exerciseVideoLinks?.[exercise.id]})}/>)}</div><div className="today-card-footer"><span><span className="green-dot"/>{todayPlan.exerciseIds.length} exercises, one step closer</span><button className="text-button" disabled={!session&&!todayPlan.exerciseIds.length} onClick={()=>startWorkout()}>{!session&&!todayPlan.exerciseIds.length?'Rest & recover':'Let’s do this'} <ArrowRight size={15}/></button></div></section><ActivityChart history={history} compact/></div>
          <section className="week-section"><div className="section-heading"><div><h2>A week of showing up</h2><p>Make room for movement. And a little recovery.</p></div><button className="text-button" onClick={()=>navigate('plan')}>See full schedule <ArrowRight size={15}/></button></div><WeekStrip plans={todayPlans} dates={getWeekDates()} history={history} selected={todayIndex()} onSelect={index=>navigate('plan',index)}/></section>
          <div className="dashboard-footnote"><Leaf size={14}/> Progress isn’t always a straight line. Keep showing up.</div>
        </>}

        {view==='plan'&&(mobile?<PhonePlanner trainingPlace={trainingPlace} onTrainingPlaceChange={changeTrainingPlace} dates={dates} plans={plans} selectedDay={selectedDay} weekOffset={weekOffset} onSelectDay={setSelectedDay} onWeekChange={direction=>setWeekOffset(value=>value+direction)} onToday={()=>{setWeekOffset(0);setSelectedDay(todayIndex());}} plan={currentPlan} session={session} history={history} goal={activeGoal} custom={Boolean(weeklyPlans[sourceScope])} onStart={()=>startWorkout(currentPlan)} onDemo={exercise=>setModal({type:'demo',exercise,videoLinks:currentPlan.exerciseVideoLinks?.[exercise.id]})} onAlternative={exercise=>openAlternatives(exercise,currentPlan,dates[selectedDay])} onEditWeek={()=>setModal({type:'weekly'})} onEditDate={()=>setModal({type:'customize',date:dates[selectedDay],plan:currentPlan})} onGoals={()=>setModal({type:'goals'})} onSheet={()=>setModal({type:'recomposition'})} onReset={()=>setModal({type:'reset-weekly'})}/>:<>
          <div className="page-heading"><div><div className="eyebrow">YOUR ROADMAP TO STRONGER</div><h1>{weekOffset===0&&selectedDay===todayIndex()?'Today’s workout':'Your workout plan'}</h1><p>Your exercises are ready. Start when you are.</p></div><div className="level-picker"><span>Your fitness level</span>{levelControl}</div></div>
          <div className="section-heading plan-week-heading"><h2>{weekOffset===0?'This week':weekOffset===-1?'Last week':weekOffset===1?'Next week':'Your schedule'} <span className="week-range">{dates[0].toLocaleDateString('en-US',{month:'short',day:'numeric'})} – {dates[6].toLocaleDateString('en-US',{month:'short',day:'numeric'})}</span></h2><div className="week-navigation"><button className="icon-button" aria-label="Previous week" onClick={()=>setWeekOffset(weekOffset-1)}><ChevronLeft size={17}/></button><button className="text-button" onClick={()=>{setWeekOffset(0);setSelectedDay(todayIndex());}}>Today</button><button className="icon-button" aria-label="Next week" onClick={()=>setWeekOffset(weekOffset+1)}><ChevronRight size={17}/></button></div></div>
          <div className="plan-calendar"><WeekStrip plans={plans} dates={dates} history={history} selected={selectedDay} onSelect={setSelectedDay}/></div>
          <section className="plan-detail card" aria-label="Selected day workout"><div className="section-card-heading"><div><span className="eyebrow">{dates[selectedDay].toLocaleDateString('en-US',{weekday:'long',month:'long',day:'numeric'})}</span><h2>{currentPlan.title}</h2><p>{currentPlan.focus} <span>·</span> {currentPlan.duration} minutes <span>·</span> {currentPlan.exerciseIds.length} exercises</p></div><div className="plan-action-buttons"><button className="button button-secondary" onClick={()=>setModal({type:'weekly'})}><SlidersHorizontal size={15}/>Edit weekly plan</button><button className="button button-green" disabled={!session&&!currentPlan.exerciseIds.length} onClick={()=>startWorkout(currentPlan)}><Play size={15} fill="currentColor"/>{session?'Resume workout':!currentPlan.exerciseIds.length?'Rest day':currentPlan.rest?'Start recovery':'Start workout'}</button></div></div>{currentPlan.rest&&<div className="recovery-note"><Leaf size={18}/><p>{currentPlan.exerciseIds.length?'Give yourself room to recover. Keep today’s movement gentle and comfortable.':'Complete rest day. No workout is scheduled and no activity will be logged.'}</p></div>}{currentPlan.locationAdapted&&!!currentPlan.exerciseIds.length&&<p className="location-plan-note">{currentPlan.locationNote || `${trainingPlace==='home'?'Home':'Gym'} alternatives · Same muscle focus`}</p>}<div className="exercise-preview-list">{currentPlan.exerciseIds.map((id,index)=><ExerciseRow key={id} exercise={getExercise(id)} index={index} plan={currentPlan} onAlternative={exercise=>openAlternatives(exercise,currentPlan,dates[selectedDay])} onDemo={exercise=>setModal({type:'demo',exercise,videoLinks:currentPlan.exerciseVideoLinks?.[exercise.id]})}/>)}</div><div className="plan-note"><Heart size={16}/><span>{trainingPlace==='home'?'Give yourself room to move. Focus on control and a comfortable range.':'Start with a comfortable weight. Focus on your form, then build from there.'}</span></div><div className="plan-date-edit"><span>Need a one-time change?</span><button className="text-button" onClick={()=>setModal({type:'customize',date:dates[selectedDay],plan:currentPlan})}>Edit this date only <ArrowRight size={14}/></button></div></section>
          <div className="plan-banner"><div className="plan-banner-icon"><CalendarDays size={26}/></div><div><h2>{weeklyPlans[sourceScope]?'Your saved weekly routine':activeGoal?'Your suggested weekly plan':`${activeLevel.label} ${trainingPlace==='home'?'home':'gym'} program`}</h2><p>{weeklyPlans[sourceScope]?`${basePlans.filter(plan=>!plan.rest).length} training days · Repeats every week · ${activeLevel.label}`:activeGoal?`${activeGoal.label} · ${profile.goal} days a week · ${activeLevel.label}`:trainingPlace==='home'?'Legs on Monday? Chest + core on Tuesday? Make it yours.':'Biceps + shoulders on Monday? Chest + triceps on Tuesday? Make it yours.'}</p></div><button className="button button-green weekly-edit-button" onClick={()=>setModal({type:'weekly'})}><SlidersHorizontal size={15}/>{weeklyPlans[sourceScope]?'Choose exercises & rest days':'Create my own plan'}</button></div>
          <div className="weekly-plan-status"><span><CalendarDays size={13}/>{weeklyPlans[sourceScope]?'Your exercises and rest days repeat every week until you change them.':'Choose your own exercises for each weekday, then save once for every upcoming week.'}</span>{weeklyPlans[sourceScope]&&<button className="text-button" onClick={()=>setModal({type:'reset-weekly'})}>Use suggested program <ArrowRight size={13}/></button>}</div>
          <RecompositionBanner active={currentPlan.programId==='six-day-recomposition'} onOpen={()=>setModal({type:'recomposition'})}/>
          <TrainingFocus goal={activeGoal} weeklyGoal={profile.goal} isCustom={hasCustomPlan} onEdit={()=>setModal({type:'goals'})}/>
        </>)}

        {view==='library'&&(mobile?<PhoneLibrary exercises={availableExercises} trainingPlace={trainingPlace} query={query} onQuery={setQuery} filter={filter} onFilter={setFilter} todayIds={todayPlan.exerciseIds} onDemo={exercise=>setModal({type:'demo',exercise})} onAdd={addToToday}/>:<>
          <div className="page-heading"><div><div className="eyebrow">MOVE WITH CONFIDENCE</div><h1>Good form. Great foundations.</h1><p>Explore your exercises with step-by-step cues and interactive 3D demos.</p></div><span className="library-count"><Dumbbell size={17}/>{availableExercises.length} {trainingPlace==='home'?'home':'gym'} exercises</span></div>
          <div className="library-toolbar"><div className="search-field"><Search size={18}/><input aria-label="Search exercises" placeholder="Find an exercise or muscle group…" value={query} onChange={event=>setQuery(event.target.value)}/>{query&&<button aria-label="Clear search" onClick={()=>setQuery('')}><X size={15}/></button>}</div><div className="library-filters">{['All exercises',...new Set(availableExercises.map(e=>e.group))].map(group=><button key={group} className={filter===group?'active':''} onClick={()=>setFilter(group)} aria-pressed={filter===group}>{muscleLabel(group)}</button>)}</div></div>
          <div className="exercise-library">{availableExercises.filter(e=>(filter==='All exercises'||e.group===filter)&&matchesExercise(e,query)).map(exercise=><button className="exercise-tile" key={exercise.id} onClick={()=>setModal({type:'demo',exercise})}><div className="exercise-tile-image"><img src={exercise.image} alt={exercise.name} loading="lazy"/><span className="demo-badge"><span/> 3D DEMO</span><span className="tile-play"><Play size={23} fill="currentColor"/></span></div><div className="exercise-tile-body"><span className="eyebrow">{muscleLabel(exercise.group)}</span><h3>{exercise.name}<ArrowUpRight size={18}/></h3><p>{exercise.equipment}<span>·</span>{exercise.duration} min</p></div></button>)}</div>
          {!availableExercises.some(e=>(filter==='All exercises'||e.group===filter)&&matchesExercise(e,query))&&<div className="empty-state"><Search size={30}/><h2>No exercises found</h2><p>Try another name, or explore all muscle groups.</p><button className="button button-green" onClick={()=>{setQuery('');setFilter('All exercises');}}>Clear filters</button></div>}
        </>)}

        {view==='progress'&&<Progress history={history} weights={weights} onAddWeight={entry=>{setWeights(old=>[entry,...old.filter(w=>w.date!==entry.date)]);notify('Weight logged. Your progress is saved.');}} onExport={()=>{exportSessions(history);notify('Your workout history is ready to download.');}}/>}
        {view==='achievements'&&<Achievements stats={stats}/>}
      </main>
    </div>
    <nav className="mobile-bottom-nav" aria-label="Quick navigation" inert={Boolean(modal)||moreOpen}>
      {[{id:'plan',label:'Plan',icon:CalendarDays},{id:'library',label:'Exercises',icon:Dumbbell},{id:'progress',label:'Progress',icon:TrendingUp}].map(({id,label,icon:Icon})=><button key={id} aria-current={view===id?'page':undefined} onClick={()=>navigate(id)}><Icon size={21}/><span>{label}</span></button>)}
      <button className={view==='achievements'||view==='dashboard'?'is-current':''} aria-label="More navigation options" aria-haspopup="dialog" aria-controls="workspace-navigation" aria-expanded={moreOpen} onClick={()=>setSidebarOpen(true)}><Menu size={21}/><span>More</span></button>
    </nav>
    {toast&&!moreOpen&&<div className="toast" role="status"><span><Check size={16}/></span>{toast}<button aria-label="Dismiss notification" onClick={()=>setToast('')}><X size={15}/></button></div>}
    {modal&&<Modal footerRef={setFooterTarget} title={modal.type==='demo'?modal.exercise.name:modal.type==='workout'?'Your workout':modal.type==='settings'?'Make this space yours.':modal.type==='training'?'Training preferences':modal.type==='help'?'A little help getting started.':modal.type==='alternative'?'Find an alternative.':modal.type==='customize'?'Make this workout yours.':modal.type==='weekly'?'Build your weekly split.':modal.type==='goals'?'What are you training for?':modal.type==='recomposition'?'Your 6-day recomposition planner':modal.type==='reset-weekly'?'Restore your suggested program?':modal.type==='reload'?'Load your latest saved progress?':'You showed up. You got stronger.'} onClose={()=>setModal(null)} wide={modal.type==='workout'} weekly={modal.type==='weekly'} goal={modal.type==='goals'||modal.type==='recomposition'||modal.type==='alternative'}>
      {modal.type==='demo'&&<><div className="demo-modal-meta"><span className="pill">{muscleLabel(modal.exercise.group)}</span><span>{modal.exercise.equipment}</span><span><Clock3 size={14}/>{modal.exercise.duration} min</span></div><Suspense fallback={<div className="demo-loading"><Activity className="loading-pulse" size={28}/>Setting up your movement preview…</div>}><ExerciseDemo exerciseId={modal.exercise.id} group={modal.exercise.group} gender={profile.gender} movement={modal.exercise.movement} name={modal.exercise.name} equipment={modal.exercise.equipment}/></Suspense><h3 className="form-heading">Make every rep count</h3><ol className="instruction-list">{modal.exercise.instructions.map((text,i)=><li key={i}><span>{i+1}</span>{text}</li>)}</ol><ExerciseVideoLinks exercise={modal.exercise} links={modal.videoLinks}/><div className="demo-footer"><span><Sparkles size={15}/> Make room for this in your next session.</span><button className="button button-green" disabled={todayPlan.exerciseIds.includes(modal.exercise.id)} onClick={()=>addToToday(modal.exercise)}>{todayPlan.exerciseIds.includes(modal.exercise.id)?<><Check size={15}/>In today’s plan</>:<><Plus size={15}/>Add to today</>}</button></div></>}
      {modal.type==='reload'&&<div className="help-content"><p>Another tab has newer progress. Reloading will open those saved records and discard any changes in this tab that haven’t saved.</p><div className="builder-footer"><button className="button button-secondary" onClick={()=>setModal(null)}>Keep this tab open</button><button className="button button-green" onClick={()=>window.location.reload()}>Load latest data</button></div></div>}
      {modal.type==='recomposition'&&<RecompositionPlan restDays={profile.restDays} level={level} gender={profile.gender} hasCustomPlan={Boolean(weeklyPlans[`gym:${level}`])||Object.keys(customPlans).some(key=>key.startsWith(`gym:${level}:`)&&key.slice(`gym:${level}:`.length)>=weekStart)} onApply={useRecompositionPlan} onCancel={()=>setModal(null)}/>}
      {modal.type==='goals'&&<GoalSetup profile={profile} trainingPlace={trainingPlace} level={level} hasCustomPlan={hasCustomPlan} onSave={saveTrainingGoal} onCancel={()=>setModal(null)}/>}
      {modal.type==='weekly'&&<WeeklyPlanEditor mobile={mobile} footerTarget={footerTarget} initialDay={selectedDay} plans={basePlans} exercises={availableExercises} trainingPlace={trainingPlace} level={level} onSave={saveWeeklyPlan} onCancel={()=>setModal(null)}/> }
      {modal.type==='reset-weekly'&&<div className="help-content"><p>This will replace your {activeLevel.label.toLowerCase()} {trainingPlace==='home'?'home':'gym'} split and individual day edits from this week onward with {activeGoal?`a ${activeGoal.label.toLowerCase()} suggestion for your ${profile.goal}-day weekly target`:'the suggested program'}.</p><div className="builder-footer"><button className="button button-secondary" onClick={()=>setModal(null)}>Keep my split</button><button className="button button-green" onClick={resetWeeklyPlan}>Restore program</button></div></div>}
      {modal.type==='alternative'&&<>{session&&<p className="alternative-session-note">Your active workout keeps its saved exercises. To swap during that workout, use its Alternatives button.</p>}<ExerciseAlternatives footerTarget={footerTarget} exercise={modal.exercise} plan={modal.plan} trainingPlace={trainingPlace} gender={profile.gender} date={modal.date} allowWeekly={basePlans[(modal.date.getDay()+6)%7]?.exerciseIds.includes(modal.exercise.id)} onSave={saveAlternative} onCancel={()=>setModal(null)}/></>}
      {modal.type==='customize'&&<WorkoutBuilder plan={modal.plan} exercises={availableExercises} trainingPlace={trainingPlace} onSave={plan=>saveCustomPlan(modal.date,plan)} onCancel={()=>setModal(null)}/> }
      {modal.type==='workout'&&session&&<WorkoutSession footerTarget={footerTarget} mobile={mobile} gender={profile.gender} session={session} setSession={setSession} onComplete={finishWorkout} onDiscard={()=>{setSession(null);setModal(null);notify('Workout discarded. Your past progress is still saved.');}}/>}
      {modal.type==='complete'&&<div className="completion"><div className="completion-emblem"><Trophy size={46}/><span>✦</span><span>✦</span></div><p>One more promise to yourself, kept.<br/>Your {modal.workout.title.toLowerCase()} session is in the books.</p><div className="completion-stats"><div><strong>{modal.workout.exercises}</strong><span>exercises</span></div><div><strong>{modal.workout.duration}<small> min</small></strong><span>time well spent</span></div><div><strong>{modal.workout.calories}</strong><span>est. kcal</span></div></div><button className="button button-green" onClick={()=>{setModal(null);navigate('progress');}}>See your progress <ArrowRight size={17}/></button><small>Saved to your workout history.</small></div>}
      {modal.type==='training'&&<TrainingPreferences trainingPlace={trainingPlace} level={level} onCancel={()=>setModal(null)} onGoals={preferences=>{setData(previous=>changeTrainingLocation(previous,preferences));setFilter('All exercises');setQuery('');setModal({type:'goals'});}} onSave={preferences=>{setData(previous=>changeTrainingLocation(previous,preferences));setFilter('All exercises');setQuery('');setModal(null);notify('Your training preferences are saved.');}}/>}
      {modal.type==='settings'&&<SettingsForm profile={profile} onGoals={()=>setModal({type:'goals'})} onSave={value=>{setProfile(previous=>({...previous,...value}));setModal(null);notify('Your preferences are saved.');}} onClear={()=>{setData(previous=>({...previous,history:[],weights:[],session:null,customPlans:{},weeklyPlans:{}}));setModal(null);notify('A fresh start. Your own journey begins now.');}}/>}
      {modal.type==='help'&&<div className="help-content"><p>Your own pace. Your next personal best. Here’s how to make FitTrack work for you.</p>{[['01','Find your starting point','Choose a fitness goal, At home or At the gym, and your experience level. We suggest a week based on your goal and available training days. Change your goal anytime from Goals & suggested plan in Settings. In My workout plan, select Edit weekly plan to choose exercises and assign muscles such as Biceps and Shoulders to each weekday. Your split repeats every week. Choose your rest weekdays in Goals & suggested plan. Use Edit this date only for one-time changes.'],['02','Get familiar with your movements','Open an exercise to watch its 3D preview. Pause, slow it down, and rotate the view to explore the movement.'],['03','Show up and check it off','Start a workout, track each set, and take breaks with the rest timer. Your session can be closed and resumed.'],['04','Watch the little things add up','Completed sessions, weekly activity, weight entries, and achievements update as you go. Export your history anytime.']].map(([number,title,body])=><div className="help-step" key={number}><span>{number}</span><div><h3>{title}</h3><p>{body}</p></div></div>)}<div className="help-storage"><Heart size={19}/><p>Your profile, workouts, and weight entries are saved in this browser’s local database. Return on the same browser and site address to continue. Your progress starts with your own entries; clearing browser data removes it.</p></div></div>}
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

function ExerciseRow({exercise,index,plan,onDemo,onAlternative}) {
  if(!exercise)return null;
  return <div className="exercise-row">
    <span className="exercise-number">{String(index+1).padStart(2,'0')}</span>
    <button className="exercise-thumbnail" onClick={()=>onDemo(exercise)} aria-label={`Preview ${exercise.name}`}><img src={exercise.image} alt="" loading="lazy"/><span><Play size={12} fill="currentColor"/></span></button>
    <div className="exercise-row-name"><button onClick={()=>onDemo(exercise)}>{exercise.name}</button><span>{muscleLabel(exercise.group)}<i/> <TargetSummary plan={plan} exercise={exercise}/></span><small className="exercise-row-equipment">{exercise.equipment}</small></div>
    <div className="exercise-row-actions"><button className="demo-link" aria-label={`View demo for ${exercise.name}`} onClick={()=>onDemo(exercise)}><span className="demo-link-icon"><Play size={11} fill="currentColor"/></span>View demo</button>{onAlternative&&<button className="exercise-alternative-button" onClick={()=>onAlternative(exercise)} aria-label={`Alternatives for ${exercise.name}`}><ArrowLeftRight size={14}/><span>Alternatives</span></button>}</div>
  </div>;
}

function WeekStrip({plans,dates,history,selected,onSelect}) {return <div className="week-strip">{plans.map((plan,index)=>{const done=history.some(item=>item.date===dateKey(dates[index]));const isToday=dateKey(dates[index])===dateKey(new Date());const Icon=plan.rest?Leaf:Dumbbell;return <button key={plan.day} title={`${plan.day}: ${plan.title}`} className={`day-card ${selected===index?'selected':''} ${plan.rest?'rest':''}`} onClick={()=>onSelect(index)} aria-pressed={selected===index}><div className="day-card-top"><span>{plan.day.toUpperCase()} <strong>{dates[index].getDate()}</strong></span>{isToday?<span className="today-label">TODAY</span>:done?<CheckCheck size={14}/>:null}</div><Icon size={20}/><strong className="day-title">{plan.title}</strong><span className="day-duration">{plan.rest?'Recover & recharge':`${plan.duration} min · ${plan.exerciseIds.length} exercises`}</span></button>;})}</div>;}

function Modal({title,onClose,wide,weekly,goal,children,footerRef}) {
  const container=useRef(null);
  useDialogFocus(container, true, onClose);
  useEffect(() => {
    container.current?.focus({ preventScroll: true });
    const body = container.current?.querySelector('.modal-body');
    if (body) body.scrollTop = 0;
  }, [title]);
  useEffect(() => {
    const viewport = window.visualViewport;
    if (!viewport) return;
    // Keep the dialog's actions above the on-screen keyboard.
    const update = () => {
      if (viewport.scale !== 1) return;
      const backdrop = container.current?.parentElement;
      backdrop?.style.setProperty('--dialog-viewport-height', `${viewport.height}px`);
      backdrop?.style.setProperty('--dialog-viewport-top', `${viewport.offsetTop}px`);
    };
    update();
    viewport.addEventListener('resize', update);
    viewport.addEventListener('scroll', update);
    return () => {
      viewport.removeEventListener('resize', update);
      viewport.removeEventListener('scroll', update);
    };
  }, []);
  return <div className="modal-backdrop" onMouseDown={event=>{if(event.target===event.currentTarget)onClose();}}><section className={`modal ${wide?'modal-wide':''} ${weekly?'modal-weekly':''} ${goal?'modal-goals':''}`} role="dialog" aria-modal="true" aria-labelledby="modal-title" ref={container} tabIndex={-1}><div className="modal-header"><div><span className="eyebrow">YOUR FITTRACK SPACE</span><h2 id="modal-title">{title}</h2></div><button className="icon-button" onClick={onClose} aria-label="Close dialog"><X size={21}/></button></div><div className="modal-body">{children}</div><div className="modal-action-slot" ref={footerRef}/></section></div>;
}

function SettingsForm({profile,onSave,onClear,onGoals}) {
  const [name,setName]=useState(profile.name);
  const [gender,setGender]=useState(profile.gender || '');
  const [genderError,setGenderError]=useState('');
  const [confirm,setConfirm]=useState(false);
  return <form className="settings-form" onSubmit={event=>{event.preventDefault();if(!normalizeGender(gender)){setGenderError('Choose a gender or Prefer not to say.');return;}if(name.trim())onSave({name:name.trim(),gender});}}><p>A few small details to make your training feel like you.</p><div className="settings-training-goal"><span><Target size={18}/>{FITNESS_GOALS.find(goal=>goal.id===profile.fitnessGoal)?.label || 'Choose your fitness goal'}</span><button className="text-button" type="button" onClick={onGoals}>Goals & suggested plan <ArrowRight size={14}/></button></div><label>Your name<input required maxLength={40} value={name} onChange={event=>setName(event.target.value)} placeholder="Your name"/></label><GenderPicker value={gender} onChange={value=>{setGender(value);setGenderError('');}} error={genderError}/><div className="settings-schedule"><span>{profile.goal} workouts per week</span><button className="text-button" type="button" onClick={onGoals}>Choose training & rest days <ArrowRight size={14}/></button></div><button className="button button-green" type="submit">Save preferences <Check size={16}/></button><div className="settings-data"><h3>A fresh start</h3><p>Your activity is stored privately in this browser. Clearing it removes your workouts, weight entries, weekly splits, custom day plans, and unfinished session. Your profile and training preferences are kept.</p>{confirm?<div className="reset-confirm"><p>Clear all workout history, weight entries, weekly splits, custom day plans, and your active session? This cannot be undone.</p><button className="button danger-button" type="button" onClick={onClear}>Yes, clear my data</button><button className="text-button" type="button" onClick={()=>setConfirm(false)}>Keep my data</button></div>:<button className="text-button danger-text" type="button" onClick={()=>setConfirm(true)}>Clear activity and start fresh <ArrowRight size={14}/></button>}</div></form>;
}

function Achievements({stats}) {
  const badges=[{name:'The first step',description:'Complete your first workout.',icon:Footprints,value:stats.workouts,target:1,color:'green'}, {name:'Finding your rhythm',description:'Show up for 10 workouts.',icon:Activity,value:stats.workouts,target:10,color:'orange'}, {name:'The twenty club',description:'Complete 20 workouts.',icon:Dumbbell,value:stats.workouts,target:20,color:'blue'}, {name:'A little every day',description:'Build a 7-day workout streak.',icon:Flame,value:stats.streak,target:7,color:'orange'}, {name:'Time well spent',description:'Invest 20 hours in movement.',icon:Clock3,value:stats.minutes,target:1200,color:'purple'}, {name:'Half a century',description:'Make it to 50 workouts.',icon:Trophy,value:stats.workouts,target:50,color:'green'}];
  return <><div className="page-heading"><div><div className="eyebrow">CELEBRATE THE SMALL WINS</div><h1>{stats.workouts?'Look how far you’ve come.':'Your first milestone is waiting.'}</h1><p>Every little milestone is a reminder of what you’re capable of.</p></div><span className="achievement-count"><Award size={19}/>{badges.filter(b=>b.value>=b.target).length} of {badges.length} unlocked</span></div><div className="achievement-banner"><Sparkles size={31}/><div><h2>The real reward? A stronger you.</h2><p>Keep moving. Your next milestone is closer than you think.</p></div></div><div className="achievement-grid">{badges.map(({name,description,icon:Icon,value,target,color})=>{const unlocked=value>=target;return <article key={name} className={`achievement-card ${unlocked?'unlocked':''}`}><span className={`achievement-icon ${color}`}><Icon size={38} strokeWidth={1.5}/></span><span className={`achievement-status ${unlocked?'is-unlocked':''}`}>{unlocked?<><Check size={12}/>UNLOCKED</>:'IN PROGRESS'}</span><h3>{name}</h3><p>{description}</p><div className="achievement-progress"><span style={{width:`${Math.min(value/target,1)*100}%`}}/></div><small>{Math.min(value,target).toLocaleString()} / {target.toLocaleString()} {target===1200?'minutes':name==='A little every day'?'days':'workouts'}</small></article>;})}</div></>;
}

export default App;
