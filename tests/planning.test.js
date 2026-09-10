import test from 'node:test';
import assert from 'node:assert/strict';
import { getWeekPlan, dateKey } from '../src/data.js';
import { resolveWeekPlans, applyWeeklySplit, estimateWorkoutMinutes, updatePlanExercises } from '../src/planning.js';

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
