import test from 'node:test';
import assert from 'node:assert/strict';
import { EXERCISES, getWeekPlan, dateKey } from '../src/data.js';
import { resolveWeekPlans, applyWeeklySplit, estimateWorkoutMinutes, updatePlanExercises } from '../src/planning.js';
import { getRecompositionWeekPlan } from '../src/recompositionPlan.js';

const dates = Array.from({length:7},(_,index)=>new Date(2026,8,7+index,12));
const nextDates = dates.map(date=>new Date(date.getFullYear(),date.getMonth(),date.getDate()+7,12));
const week = () => getWeekPlan('beginner','gym').map((plan,index)=>({
  ...plan,
  ...(index===0?{title:'Biceps & Shoulders',focus:'Biceps · Shoulders',exerciseIds:['bicep-curl','shoulder-press'],muscleGroups:['Biceps','Shoulders'],rest:false}:{muscleGroups:[plan.rest?'Mobility':'Legs']}),
}));

test('weekday muscle splits recur across weeks without recording any workouts',()=>{
  const weeklyPlans={'gym:beginner':week()};
  const current=resolveWeekPlans({level:'beginner',trainingPlace:'gym',weeklyPlans,dates});
  const next=resolveWeekPlans({level:'beginner',trainingPlace:'gym',weeklyPlans,dates:nextDates});
  assert.equal(current[0].title,'Biceps & Shoulders');
  assert.deepEqual(next,current);
  assert.equal('history' in weeklyPlans,false);
  const home=resolveWeekPlans({level:'beginner',trainingPlace:'home',weeklyPlans,dates});
  assert.deepEqual(home,getWeekPlan('beginner','home'));
  const medium=resolveWeekPlans({level:'medium',trainingPlace:'gym',weeklyPlans,dates});
  assert.deepEqual(medium,getWeekPlan('medium','gym'));
});

test('a single-date edit overrides only that occurrence of a weekly split',()=>{
  const weeklyPlans={'gym:beginner':week()};
  const customPlans={[`gym:beginner:${dateKey(dates[0])}`]:{...week()[0],title:'A one-time change',exerciseIds:['hammer-curl']}};
  const current=resolveWeekPlans({level:'beginner',trainingPlace:'gym',weeklyPlans,customPlans,dates});
  const next=resolveWeekPlans({level:'beginner',trainingPlace:'gym',weeklyPlans,customPlans,dates:nextDates});
  assert.equal(current[0].title,'A one-time change');
  assert.equal(next[0].title,'Biceps & Shoulders');
  current[0].exerciseIds.push('push-up');
  assert.deepEqual(customPlans[`gym:beginner:${dateKey(dates[0])}`].exerciseIds,['hammer-curl']);
});

test('saving a split replaces this and future weeks’ day edits only in its own scope',()=>{
  const state={history:[{id:'real-workout'}],session:{id:'unfinished'},weights:[{value:72}],weeklyPlans:{'home:beginner':getWeekPlan('beginner','home')},customPlans:{
    'gym:beginner:2026-09-06':{title:'Past'},
    'gym:beginner:2026-09-07':{title:'Current'},
    'gym:beginner:2026-10-02':{title:'Future'},
    'home:beginner:2026-09-07':{title:'Home'},
    'gym:medium:2026-09-07':{title:'Medium'},
  }};
  const saved=applyWeeklySplit(state,{trainingPlace:'gym',level:'beginner',plans:week(),fromDate:dates[0]});
  assert.deepEqual(Object.keys(saved.customPlans),['gym:beginner:2026-09-06','home:beginner:2026-09-07','gym:medium:2026-09-07']);
  assert.equal(saved.weeklyPlans['gym:beginner'][0].title,'Biceps & Shoulders');
  assert.equal(saved.history,state.history);
  assert.equal(saved.session,state.session);
  assert.equal(saved.weights,state.weights);
  assert.equal(saved.weeklyPlans['home:beginner'],state.weeklyPlans['home:beginner']);
  assert.equal(Object.keys(state.customPlans).length,5);
});

const exerciseChoices = [
  {id:'curl',group:'Biceps',duration:5},
  {id:'press',group:'Shoulders',duration:7},
  {id:'reach',group:'Mobility',duration:3},
];

test('training duration scales with sets while recovery duration remains the exercise total',()=>{
  const training=exerciseChoices.slice(0,2);
  assert.equal(estimateWorkoutMinutes(training,3),12);
  assert.equal(estimateWorkoutMinutes(training,6),24);
  assert.equal(estimateWorkoutMinutes(training,2),8);
  assert.equal(estimateWorkoutMinutes([exerciseChoices[0]],2),3);
  assert.equal(estimateWorkoutMinutes(training,6,true),12);
  assert.equal(estimateWorkoutMinutes([],3),1);
});

test('an unchanged date edit preserves the exact saved title, duration, and focus',()=>{
  const plan={title:'My arm day',focus:'My chosen focus',duration:37,sets:6,reps:'8–12',exerciseIds:['curl','press'],muscleGroups:['Biceps','Shoulders'],rest:false,custom:true,customTitle:true};
  const saved=updatePlanExercises(plan,exerciseChoices.slice(0,2),exerciseChoices);
  assert.equal(saved.title,plan.title);
  assert.equal(saved.duration,37);
  assert.equal(saved.focus,plan.focus);
  assert.deepEqual(saved.exerciseIds,plan.exerciseIds);
  assert.notEqual(saved.exerciseIds,plan.exerciseIds);
  assert.deepEqual(plan.exerciseIds,['curl','press']);
});

test('changed selections retain personal names and recalculate duration using the same set multiplier',()=>{
  const plan={title:'My arm day',focus:'Biceps',duration:10,sets:6,reps:'8–12',exerciseIds:['curl'],muscleGroups:['Biceps'],rest:false,custom:true};
  const saved=updatePlanExercises(plan,exerciseChoices.slice(0,2),exerciseChoices);
  assert.equal(saved.title,'My arm day');
  assert.equal(saved.customTitle,true);
  assert.equal(saved.duration,24);
  assert.equal(saved.focus,'Biceps · Shoulders');
  const explicitName={...plan,title:'Biceps',customTitle:true};
  assert.equal(updatePlanExercises(explicitName,[exerciseChoices[1]],exerciseChoices).title,'Biceps');
});

test('generated names follow changed exercises, and unchanged suggested names are not mistaken for personal ones',()=>{
  const generated={title:'Biceps',focus:'Biceps',duration:10,sets:6,reps:'8–12',exerciseIds:['curl'],muscleGroups:['Biceps'],rest:false,custom:true};
  const changed=updatePlanExercises(generated,[exerciseChoices[1]],exerciseChoices);
  assert.equal(changed.title,'Shoulders');
  assert.equal(changed.duration,14);
  assert.equal(changed.customTitle,false);
  const suggested={...generated,title:'Full body foundations',custom:false};
  const unchanged=updatePlanExercises(suggested,[exerciseChoices[0]],exerciseChoices);
  assert.equal(unchanged.title,suggested.title);
  assert.equal(unchanged.customTitle,false);
  assert.equal(updatePlanExercises(unchanged,[exerciseChoices[1]],exerciseChoices).title,'Shoulders');
});

test('goal suggestions resolve by goal and available days while custom routines take precedence',async()=>{
  const { getSuggestedWeekPlan }=await import('../src/goals.js');
  const options={fitnessGoal:'fat-loss',weeklyGoal:4,level:'beginner',trainingPlace:'home',dates};
  const suggested=resolveWeekPlans(options);
  assert.deepEqual(suggested,getSuggestedWeekPlan(options));
  assert.equal(suggested.filter(day=>!day.rest).length,4);
  const custom=getWeekPlan('beginner','home');
  custom[0]={...custom[0],title:'My chosen Monday',custom:true};
  const resolved=resolveWeekPlans({...options,weeklyPlans:{'home:beginner':custom}});
  assert.equal(resolved[0].title,'My chosen Monday');
  assert.deepEqual(resolved,custom);
});

test('changing fitness goals keeps custom plans and progress unless replacement is selected',async()=>{
  const { updateTrainingGoal }=await import('../src/planning.js');
  const custom=getWeekPlan('beginner','gym');
  const state={profile:{name:'Sam',goal:3,fitnessGoal:'fat-loss'},weeklyPlans:{'gym:beginner':custom,'home:beginner':custom},customPlans:{'gym:beginner:2099-01-05':custom[0]},history:[{id:'actual'}],weights:[{value:70}],session:{id:'unfinished'}};
  const kept=updateTrainingGoal(state,{fitnessGoal:'build-muscle',weeklyGoal:4,trainingPlace:'gym',level:'beginner'});
  assert.equal(kept.profile.fitnessGoal,'build-muscle');assert.equal(kept.profile.goal,4);
  assert.equal(kept.weeklyPlans,state.weeklyPlans);assert.equal(kept.customPlans,state.customPlans);
  assert.equal(kept.history,state.history);assert.equal(kept.session,state.session);
  const replaced=updateTrainingGoal(state,{fitnessGoal:'core-strength',weeklyGoal:2,trainingPlace:'gym',level:'beginner',applySuggestion:true});
  assert.equal(replaced.weeklyPlans['gym:beginner'],undefined);
  assert.equal(replaced.weeklyPlans['home:beginner'],custom);
  assert.deepEqual(replaced.customPlans,{});assert.equal(replaced.history,state.history);assert.equal(replaced.weights,state.weights);assert.equal(replaced.session,state.session);
  assert.equal(state.profile.fitnessGoal,'fat-loss');
});

test('gender selection is saved with goals without rewriting custom or unfinished workouts',async()=>{
  const {updateTrainingGoal}=await import('../src/planning.js');
  const custom=getWeekPlan('beginner','gym');
  const state={profile:{name:'Pat',goal:3,gender:null},weeklyPlans:{'gym:beginner':custom},customPlans:{},history:[{id:'logged'}],session:{id:'unfinished',plan:custom[0]}};
  const saved=updateTrainingGoal(state,{fitnessGoal:'build-muscle',gender:'woman',weeklyGoal:3,trainingPlace:'gym',level:'beginner'});
  assert.equal(saved.profile.gender,'woman');assert.equal(saved.weeklyPlans,state.weeklyPlans);assert.equal(saved.session,state.session);assert.equal(saved.history,state.history);
  const noGenderEdit=updateTrainingGoal(saved,{fitnessGoal:'general-fitness',weeklyGoal:4,trainingPlace:'gym',level:'beginner'});
  assert.equal(noGenderEdit.profile.gender,'woman');
});

test('per-exercise set counts, timed targets, and continuous cardio contribute to duration', () => {
  const curl = EXERCISES.find(exercise => exercise.id === 'bicep-curl');
  const plank = EXERCISES.find(exercise => exercise.id === 'plank');
  const targets = {
    [curl.id]: { sets: 6, reps: '8–12', unit: 'reps', restSeconds: 90 },
    [plank.id]: { sets: 3, reps: '30–60', unit: 'sec', restSeconds: 30 },
  };
  assert.equal(estimateWorkoutMinutes([curl, plank], 2, false, targets), 16, '13.75 min effort/rest + 2 min exercise transitions, rounded up once');
  assert.equal(estimateWorkoutMinutes([plank], 2, false, { [plank.id]: { sets: 1, reps: '10–15', unit: 'min', restSeconds: 0 } }), 14);
  assert.equal(estimateWorkoutMinutes([{ id: 'continuous-cardio', movement: 'walking', duration: 4 }], 4), 10);
  assert.equal(estimateWorkoutMinutes([], 1, true), 0);
});

test('editing exercise choices prunes only removed targets and video links while keeping remaining targets independent', () => {
  const chosen = ['bicep-curl', 'plank'].map(id => EXERCISES.find(exercise => exercise.id === id));
  const plan = { title: 'My mixed workout', focus: 'Arms and core', duration: 23, sets: 2, reps: '10', rest: false, custom: true, customTitle: true,
    exerciseIds: chosen.map(exercise => exercise.id), muscleGroups: ['Biceps', 'Core'], programId: 'six-day-recomposition',
    exerciseTargets: { 'bicep-curl': { sets: 4, reps: '8–12', unit: 'reps', restSeconds: 90 }, plank: { sets: 2, reps: '45', unit: 'sec', restSeconds: 30 } },
    exerciseVideoLinks: { 'bicep-curl': { english: 'https://www.youtube.com/results?search_query=curl', hindi: 'https://www.youtube.com/results?search_query=curl+hindi' }, plank: { english: 'https://www.youtube.com/results?search_query=plank' } },
  };
  const unchanged = updatePlanExercises(plan, chosen, EXERCISES);
  assert.equal(unchanged.duration, 23);
  assert.equal(unchanged.title, plan.title);
  assert.deepEqual(unchanged.exerciseTargets, plan.exerciseTargets);
  const saved = updatePlanExercises(plan, [chosen[1]], EXERCISES);
  assert.deepEqual(Object.keys(saved.exerciseTargets), ['plank']);
  assert.deepEqual(Object.keys(saved.exerciseVideoLinks), ['plank']);
  assert.equal(saved.programId, plan.programId);
  saved.exerciseTargets.plank.sets = 8;
  saved.exerciseVideoLinks.plank.english = 'edited';
  assert.equal(plan.exerciseTargets.plank.sets, 2);
  assert.notEqual(plan.exerciseVideoLinks.plank.english, 'edited');
});

test('weekly and dated target overrides are cloned and installing a split preserves actual history and unfinished work', () => {
  const plans = week();
  plans[0].exerciseTargets = { 'bicep-curl': { sets: 4, reps: '8–12', unit: 'reps', restSeconds: 90 } };
  plans[6] = { ...plans[6], title: 'Full rest', exerciseIds: [], rest: true, duration: 0, muscleGroups: ['Mobility'], exerciseTargets: {} };
  const dateKeyValue = `gym:beginner:${dateKey(dates[0])}`;
  const customPlans = { [dateKeyValue]: { ...plans[0], exerciseTargets: { 'bicep-curl': { sets: 2, reps: '15', unit: 'reps', restSeconds: 60 } } } };
  const resolved = resolveWeekPlans({ level: 'beginner', trainingPlace: 'gym', weeklyPlans: { 'gym:beginner': plans }, customPlans, dates });
  assert.equal(resolved[0].exerciseTargets['bicep-curl'].sets, 2);
  assert.equal(resolved[6].duration, 0);
  assert.deepEqual(resolved[6].exerciseIds, []);
  resolved[0].exerciseTargets['bicep-curl'].sets = 9;
  assert.equal(customPlans[dateKeyValue].exerciseTargets['bicep-curl'].sets, 2);
  const state = { history: [{ id: 'actual-workout' }], session: { id: 'unfinished-workout' }, customPlans, weeklyPlans: {} };
  const installed = applyWeeklySplit(state, { trainingPlace: 'gym', level: 'beginner', plans, fromDate: dates[0] });
  installed.weeklyPlans['gym:beginner'][0].exerciseTargets['bicep-curl'].sets = 7;
  assert.equal(plans[0].exerciseTargets['bicep-curl'].sets, 4);
  assert.equal(installed.history, state.history);
  assert.equal(installed.session, state.session);
});

test('target-only edits recalculate duration, while effective unchanged defaults preserve its exact value', () => {
  const curl = EXERCISES.find(exercise => exercise.id === 'bicep-curl');
  const original = { title: 'My curl session', focus: 'Biceps', duration: 17, sets: 3, reps: '10', rest: false, exerciseIds: [curl.id], muscleGroups: ['Biceps'], custom: true, customTitle: true };
  const materialized = { ...original, exerciseTargets: { [curl.id]: { sets: 3, reps: '10', unit: 'reps', restSeconds: 60 } } };
  assert.equal(updatePlanExercises(materialized, [curl], EXERCISES, original).duration, 17);
  const moreReps = { ...materialized, exerciseTargets: { [curl.id]: { ...materialized.exerciseTargets[curl.id], reps: '30' } } };
  const edited = updatePlanExercises(moreReps, [curl], EXERCISES, original);
  assert.equal(edited.duration, 8);
  assert.equal(edited.title, original.title);
  const moreRest = { ...moreReps, exerciseTargets: { [curl.id]: { ...moreReps.exerciseTargets[curl.id], restSeconds: 120 } } };
  assert.equal(updatePlanExercises(moreRest, [curl], EXERCISES, original).duration, 10);
  assert.equal(original.duration, 17);
});

test('opening and saving the complete preset uses identical duration estimates on all seven days', () => {
  for (const level of ['beginner', 'medium', 'experienced']) {
    for (const plan of getRecompositionWeekPlan(level)) {
      const selected = plan.exerciseIds.map(id => EXERCISES.find(exercise => exercise.id === id));
      assert.equal(estimateWorkoutMinutes(selected, plan.sets, plan.rest, plan.exerciseTargets), plan.duration, `${level} ${plan.day}`);
      assert.equal(updatePlanExercises(plan, selected, EXERCISES, plan).duration, plan.duration);
    }
  }
});

test('partial target duration combines fractional timed work and catalogue work before rounding', () => {
  const curl = EXERCISES.find(exercise => exercise.id === 'bicep-curl');
  const plank = EXERCISES.find(exercise => exercise.id === 'plank');
  const targets = { plank: { sets: 1, reps: '10', unit: 'sec', restSeconds: 0 } };
  assert.equal(estimateWorkoutMinutes([curl, plank], 2, false, targets), 5, '3⅓ catalogue minutes + 1⅙ targeted minutes = 4½, rounded up once');
});
