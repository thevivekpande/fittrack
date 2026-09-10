import test from 'node:test';
import assert from 'node:assert/strict';
import { EXERCISES, LEVELS, MUSCLE_GROUPS, getWeekPlan } from '../src/data.js';
import { FITNESS_GOALS, getSuggestedWeekPlan } from '../src/goals.js';
import { GENDERS } from '../src/profile.js';

const exerciseMap = new Map(EXERCISES.map((exercise) => [exercise.id, exercise]));
const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const settings = { beginner: { sets: 2, cap: 3 }, medium: { sets: 3, cap: 4 }, experienced: { sets: 4, cap: 5 } };
const goalIds = ['fat-loss', 'build-muscle', 'body-recomposition', 'general-fitness', 'core-strength'];

test('the goal catalog supplies stable IDs and plain-language choices without promised outcomes', () => {
  assert.deepEqual(FITNESS_GOALS.map((goal) => goal.id), goalIds);
  for (const goal of FITNESS_GOALS) {
    assert.ok(goal.label.length > 0);
    assert.ok(goal.description.length > 0);
    assert.ok(goal.approach.length > 0);
    assert.doesNotMatch(goal.approach, /guaranteed|calorie deficit|spot reduction works|lose \d+/i);
  }
  assert.match(FITNESS_GOALS.find((goal) => goal.id === 'core-strength').approach, /does not selectively remove belly fat/);
});

for (const fitnessGoal of goalIds) {
  test(`${fitnessGoal} supports all levels, locations, and weekly goals with complete usable plans`, () => {
    for (const { id: level } of LEVELS) {
      for (const trainingPlace of ['home', 'gym']) {
        for (let weeklyGoal = 1; weeklyGoal <= 7; weeklyGoal += 1) {
          const context = `${fitnessGoal}/${level}/${trainingPlace}/${weeklyGoal}`;
          const week = getSuggestedWeekPlan({ fitnessGoal, level, trainingPlace, weeklyGoal });
          assert.deepEqual(week.map((plan) => plan.day), days, context);
          assert.equal(week.filter((plan) => !plan.rest).length, weeklyGoal, context);
          assert.equal(week.filter((plan) => plan.rest).length, 7 - weeklyGoal, context);
          const strength = week.filter((plan) => plan.intensity === 'strength');
          const light = week.filter((plan) => plan.intensity === 'light');
          assert.equal(strength.length, Math.min(weeklyGoal, settings[level].cap), context);
          assert.equal(light.length, Math.max(0, weeklyGoal - settings[level].cap), context);
          for (const plan of week) {
            assert.ok(plan.title && plan.focus, context);
            assert.ok(plan.exerciseIds.length >= 2 && plan.exerciseIds.length <= 12, context);
            assert.equal(new Set(plan.exerciseIds).size, plan.exerciseIds.length, context);
            assert.ok(Number.isInteger(plan.duration) && plan.duration >= 1, context);
            assert.match(plan.reps, /^\d+(?:–\d+)?$/, context);
            assert.ok(plan.muscleGroups.length > 0 && plan.muscleGroups.every((group) => MUSCLE_GROUPS.includes(group)), context);
            assert.equal(plan.custom, false, context);
            assert.equal(plan.customTitle, false, context);
            assert.equal(plan.fitnessGoal, fitnessGoal, context);
            for (const id of plan.exerciseIds) {
              assert.ok(exerciseMap.has(id), `${context}: unknown exercise ${id}`);
              assert.ok(exerciseMap.get(id).places.includes(trainingPlace), `${context}: wrong equipment ${id}`);
            }
            if (plan.rest) {
              assert.equal(plan.intensity, 'recovery', context);
              assert.deepEqual(plan.exerciseIds, ['standing-reach', 'easy-squat'], context);
              assert.equal(plan.sets, 1, context);
            } else if (plan.intensity === 'strength') {
              assert.equal(plan.sets, settings[level].sets, context);
            } else {
              assert.ok(plan.sets >= 1 && plan.sets <= 2, context);
              assert.ok(plan.exerciseIds.every((id) => ['Core', 'Cardio', 'Mobility'].includes(exerciseMap.get(id).group)), context);
              assert.ok(plan.exerciseIds.every((id) => exerciseMap.get(id).places.includes('home')), context);
            }
            assert.equal('history' in plan || 'completed' in plan || 'date' in plan || 'id' in plan, false, context);
          }
          const active = week.flatMap((plan, index) => plan.rest ? [] : [index]);
          const gaps = active.map((index, position) => (active[(position + 1) % active.length] - index + 7) % 7 || 7);
          assert.ok(Math.max(...gaps) <= Math.ceil(7 / weeklyGoal), `${context}: sessions should be spread throughout the week`);
          if (weeklyGoal === 7) assert.ok(light.length >= 2, context);
        }
      }
    }
  });
}

test('missing or unknown goals preserve legacy plans exactly and never manufacture user activity', () => {
  for (const { id: level } of LEVELS) {
    for (const trainingPlace of ['home', 'gym']) {
      assert.deepEqual(getSuggestedWeekPlan({ level, trainingPlace, weeklyGoal: 1 }), getWeekPlan(level, trainingPlace));
      assert.deepEqual(getSuggestedWeekPlan({ fitnessGoal: 'unconfirmed', level, trainingPlace, weeklyGoal: 7 }), getWeekPlan(level, trainingPlace));
    }
  }
  assert.deepEqual(getSuggestedWeekPlan(), getWeekPlan());
  const input = { fitnessGoal: 'fat-loss', level: 'beginner', trainingPlace: 'home', weeklyGoal: 3 };
  const savedInput = structuredClone(input);
  const first = getSuggestedWeekPlan(input);
  const original = structuredClone(first);
  first[0].exerciseIds.push('made-up');
  first[0].muscleGroups.push('made-up');
  first[0].title = 'Changed outside the engine';
  assert.deepEqual(getSuggestedWeekPlan(input), original);
  assert.deepEqual(input, savedInput);
});

test('all five goals materially differ in exercise choices even for a single weekly session', () => {
  for (const { id: level } of LEVELS) {
    for (const trainingPlace of ['home', 'gym']) {
      for (const weeklyGoal of [1, 3, 7]) {
        const programs = FITNESS_GOALS.map(({ id: fitnessGoal }) => getSuggestedWeekPlan({ fitnessGoal, level, trainingPlace, weeklyGoal }));
        const signatures = programs.map((week) => JSON.stringify(week.filter((plan) => !plan.rest).map((plan) => [...plan.exerciseIds].sort())));
        assert.equal(new Set(signatures).size, FITNESS_GOALS.length, `${level}/${trainingPlace}/${weeklyGoal}`);
      }
    }
  }
});

test('fat-loss suggestions include strength, cardio, and core rather than an abs-only routine', () => {
  for (const { id: level } of LEVELS) {
    for (const trainingPlace of ['home', 'gym']) {
      for (let weeklyGoal = 1; weeklyGoal <= 7; weeklyGoal += 1) {
        const week = getSuggestedWeekPlan({ fitnessGoal: 'fat-loss', level, trainingPlace, weeklyGoal });
        const groups = new Set(week.filter((plan) => !plan.rest).flatMap((plan) => plan.muscleGroups));
        assert.ok(groups.has('Cardio') && groups.has('Core') && groups.has('Legs') && groups.has('Chest'));
        for (const plan of week.filter((day) => day.intensity === 'strength')) {
          const coreCount = plan.exerciseIds.filter((id) => exerciseMap.get(id).group === 'Core').length;
          assert.ok(coreCount < plan.exerciseIds.length / 2);
        }
      }
    }
  }
});

test('core-strength suggestions use varied abdominal movements and retain supporting strength and cardio', () => {
  const required = ['crunch', 'reverse-crunch', 'dead-bug', 'bicycle-crunch', 'heel-tap', 'mountain-climber'];
  for (const trainingPlace of ['home', 'gym']) {
    const coreWeek = getSuggestedWeekPlan({ fitnessGoal: 'core-strength', level: 'experienced', trainingPlace, weeklyGoal: 7 });
    const selected = new Set(coreWeek.flatMap((plan) => plan.exerciseIds));
    required.forEach((id) => assert.ok(selected.has(id), `${trainingPlace}: missing ${id}`));
    assert.equal(selected.has('cable-crunch'), trainingPlace === 'gym');
    const groups = new Set(coreWeek.flatMap((plan) => plan.muscleGroups));
    assert.ok(groups.has('Core') && groups.has('Cardio') && groups.has('Legs') && groups.has('Chest'));
    const strengthWeek = getSuggestedWeekPlan({ fitnessGoal: 'build-muscle', level: 'experienced', trainingPlace, weeklyGoal: 7 });
    const coreCount = (week) => week.filter((plan) => !plan.rest).flatMap((plan) => plan.exerciseIds).filter((id) => exerciseMap.get(id).group === 'Core').length;
    assert.ok(coreCount(coreWeek) > coreCount(strengthWeek));
  }
});

test('invalid optional settings fall back to a bounded beginner gym suggestion', () => {
  const week = getSuggestedWeekPlan({ fitnessGoal: 'general-fitness', level: 'unknown', trainingPlace: 'outside', weeklyGoal: 90 });
  assert.equal(week.filter((plan) => !plan.rest).length, 3);
  assert.ok(week.filter((plan) => !plan.rest).every((plan) => plan.sets === 2));
  assert.deepEqual(getSuggestedWeekPlan({ fitnessGoal: 'general-fitness', level: 'beginner', trainingPlace: 'gym', weeklyGoal: '3' }), week);
});

test('gender variations preserve experience, training days, equipment, and muscle balance for every goal', () => {
  const selectedGenders = GENDERS.map(({ id }) => id).filter((id) => id !== 'prefer-not-to-say');
  const groupCounts = (plan) => plan.exerciseIds.reduce((counts, id) => {
    const group = exerciseMap.get(id).group;
    counts[group] = (counts[group] || 0) + 1;
    return counts;
  }, {});
  for (const fitnessGoal of goalIds) {
    for (const { id: level } of LEVELS) {
      for (const trainingPlace of ['home', 'gym']) {
        for (let weeklyGoal = 1; weeklyGoal <= 7; weeklyGoal += 1) {
          const input = { fitnessGoal, level, trainingPlace, weeklyGoal };
          const baseline = getSuggestedWeekPlan(input);
          const variants = selectedGenders.map((gender) => getSuggestedWeekPlan({ ...input, gender }));
          const signatures = variants.map((week) => JSON.stringify(week.map(({ exerciseIds }) => exerciseIds)));
          assert.equal(new Set(signatures).size, selectedGenders.length, `${fitnessGoal}/${level}/${trainingPlace}/${weeklyGoal}: distinct deterministic variations`);
          for (const [genderIndex, week] of variants.entries()) {
            const gender = selectedGenders[genderIndex];
            assert.deepEqual(getSuggestedWeekPlan({ ...input, gender }), week);
            assert.equal(week.filter((plan) => !plan.rest).length, weeklyGoal);
            for (const [dayIndex, plan] of week.entries()) {
              const base = baseline[dayIndex];
              assert.equal(plan.gender, gender);
              for (const key of ['day', 'sets', 'reps', 'rest', 'intensity', 'fitnessGoal', 'title']) assert.equal(plan[key], base[key]);
              assert.equal(plan.exerciseIds.length, base.exerciseIds.length);
              assert.equal(new Set(plan.exerciseIds).size, plan.exerciseIds.length);
              assert.deepEqual(groupCounts(plan), groupCounts(base));
              assert.ok(plan.exerciseIds.every((id) => exerciseMap.get(id)?.places.includes(trainingPlace)));
              assert.equal('weight' in plan || 'calorieTarget' in plan || 'history' in plan || 'completed' in plan, false);
              if (plan.rest) assert.deepEqual(plan.exerciseIds, base.exerciseIds);
              if (level === 'beginner') {
                assert.ok(!plan.exerciseIds.includes('barbell-back-squat') && !plan.exerciseIds.includes('barbell-bench-press'));
                assert.ok(!plan.exerciseIds.includes('single-leg-glute-bridge') && !plan.exerciseIds.includes('lying-leg-raise'));
              }
            }
          }
        }
      }
    }
  }
});

test('unknown, missing, and declined gender selections preserve the baseline exactly', () => {
  for (const gender of [undefined, null, '', 'unknown', 'new-gender-id', 'prefer-not-to-say']) {
    for (const fitnessGoal of goalIds) {
      for (const trainingPlace of ['home', 'gym']) {
        const input = { fitnessGoal, level: 'medium', trainingPlace, weeklyGoal: 4 };
        assert.deepEqual(getSuggestedWeekPlan({ ...input, gender }), getSuggestedWeekPlan(input));
        assert.ok(getSuggestedWeekPlan({ ...input, gender }).every((plan) => !('gender' in plan)));
      }
    }
  }
  for (const gender of [...GENDERS.map(({ id }) => id), 'new-gender-id']) {
    for (const { id: level } of LEVELS) {
      for (const trainingPlace of ['home', 'gym']) {
        assert.deepEqual(getSuggestedWeekPlan({ gender, level, trainingPlace }), getWeekPlan(level, trainingPlace));
        assert.deepEqual(getSuggestedWeekPlan({ fitnessGoal: 'new-goal-id', gender, level, trainingPlace }), getWeekPlan(level, trainingPlace));
      }
    }
  }
});
