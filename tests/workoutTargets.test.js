import test from 'node:test';
import assert from 'node:assert/strict';
import { EXERCISES } from '../src/data.js';
import { exerciseUnit } from '../src/exerciseSearch.js';
import { cloneExerciseTargets, getExerciseTarget, getTotalSets, normalizeExerciseTargets } from '../src/workoutTargets.js';

const curl = EXERCISES.find(exercise => exercise.id === 'bicep-curl');
const plank = EXERCISES.find(exercise => exercise.id === 'plank');
const validTarget = { sets: 4, reps: '8–12', unit: 'reps', restSeconds: 90 };

test('legacy plans retain their sets, reps, and movement units with a complete rest target', () => {
  const plan = { sets: 2, reps: '8–10' };
  assert.deepEqual(getExerciseTarget(plan, curl), { sets: 2, reps: '8–10', unit: 'reps', restSeconds: 60 });
  assert.deepEqual(getExerciseTarget(plan, plank), { sets: 2, reps: '8–10', unit: 'sec', restSeconds: 60 });
  assert.deepEqual(getExerciseTarget({ sets: 0, reps: 'many', restSeconds: -2 }, curl), { sets: 3, reps: '10', unit: 'reps', restSeconds: 60 });
});

test('walking and cycling default to one continuous ten-minute set', () => {
  for (const id of ['treadmill-walk', 'stationary-bike']) {
    const exercise = EXERCISES.find(item => item.id === id);
    assert.ok(exercise);
    assert.equal(exerciseUnit(exercise), 'min');
    assert.deepEqual(getExerciseTarget({ sets: 4, reps: '12–15' }, exercise), { sets: 1, reps: '10', unit: 'min', restSeconds: 0 });
  }
});

test('valid per-exercise targets override only their own exercise and returned objects are independent', () => {
  const plan = { sets: 2, reps: '10', exerciseIds: [curl.id, plank.id], exerciseTargets: {
    [curl.id]: validTarget,
    [plank.id]: { sets: 3, reps: '30-45', unit: 'sec', restSeconds: 30 },
  } };
  assert.deepEqual(getExerciseTarget(plan, curl), validTarget);
  assert.deepEqual(getExerciseTarget(plan, plank), { sets: 3, reps: '30–45', unit: 'sec', restSeconds: 30 });
  assert.equal(getTotalSets(plan), 7);
  getExerciseTarget(plan, curl).sets = 20;
  assert.equal(plan.exerciseTargets[curl.id].sets, 4);
  assert.equal(getTotalSets({ ...plan, exerciseIds: [curl.id, curl.id, 'unknown'] }), 4);
  assert.equal(getTotalSets({ exerciseIds: [] }), 0);
});

test('target normalization drops malformed, unselected, and unknown entries without altering valid siblings', () => {
  const corrupt = [null, [], { ...validTarget, sets: 0 }, { ...validTarget, sets: 21 }, { ...validTarget, sets: 2.5 },
    { ...validTarget, reps: 12 }, { ...validTarget, reps: 'AMRAP' }, { ...validTarget, reps: '12–8' },
    { ...validTarget, reps: '0' }, { ...validTarget, reps: '601' }, { ...validTarget, unit: 'kg' },
    { ...validTarget, restSeconds: -1 }, { ...validTarget, restSeconds: 601 }, { ...validTarget, restSeconds: 30.5 }];
  for (const invalid of corrupt) {
    const result = normalizeExerciseTargets({ [curl.id]: validTarget, [plank.id]: invalid, unknown: validTarget }, [curl.id, plank.id, 'unknown']);
    assert.deepEqual(result, { [curl.id]: validTarget });
  }
  assert.deepEqual(normalizeExerciseTargets({ [curl.id]: validTarget }, [plank.id]), {});
  assert.deepEqual(normalizeExerciseTargets(null, [curl.id]), {});
  const cloned = cloneExerciseTargets({ [curl.id]: validTarget }, [curl.id]);
  cloned[curl.id].sets = 1;
  assert.equal(validTarget.sets, 4);
  const boundary = { sets: 20, reps: '1—600', unit: 'sec', restSeconds: 600 };
  assert.deepEqual(normalizeExerciseTargets({ [plank.id]: boundary }, [plank.id])[plank.id], { ...boundary, reps: '1–600' });
});
