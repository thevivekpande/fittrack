import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { EXERCISES, getExercisesForPlace } from '../src/data.js';
import { FITNESS_GOALS, getSuggestedWeekPlan } from '../src/goals.js';
import {
  getRecompositionWeekPlan,
  RECOMPOSITION_SOURCE_ROWS,
  RECOMPOSITION_SOURCE_DAYS,
  RECOMPOSITION_SOURCE_LABEL,
  RECOMPOSITION_TARGET_NOTE,
  RECOMPOSITION_VIDEO_NOTE,
} from '../src/recompositionPlan.js';

const sheetOrder = [
  ['chest-press-machine', 'incline-bench-press', 'pec-deck', 'triceps-pushdown', 'overhead-triceps-extension'],
  ['lat-pulldown', 'cable-row', 'single-arm-dumbbell-row', 'bicep-curl', 'hammer-curl'],
  ['leg-press', 'seated-leg-curl', 'leg-extension', 'standing-calf-raise', 'plank', 'dead-bug'],
  ['shoulder-press', 'lateral-raise', 'rear-delt-fly', 'narrow-push-up', 'cable-triceps-extension'],
  ['incline-bench-press', 'bench-press', 'lat-pulldown', 'cable-row', 'cable-face-pull'],
  ['goblet-squat', 'romanian-deadlift', 'walking-lunge', 'standing-calf-raise', 'plank', 'treadmill-walk'],
  [],
];

test('the supplied six-day sheet retains its exercise order and a complete Sunday rest', () => {
  for (const level of ['beginner', 'medium', 'experienced']) {
    const week = getRecompositionWeekPlan(level);
    assert.deepEqual(week.map(({ day }) => day), ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']);
    assert.deepEqual(week.map(({ exerciseIds }) => exerciseIds), sheetOrder);
    assert.equal(week.filter(({ rest }) => !rest).length, 6);
    assert.deepEqual(week[6].exerciseIds, []);
    assert.deepEqual(week[6].exerciseTargets, {});
    assert.equal(week[6].duration, 0);
    assert.equal(week[6].rest, true);
    for (const plan of week) {
      assert.equal(plan.programId, 'six-day-recomposition');
      assert.equal(plan.sourceLabel, '6-Day YouTube Gym Playlist');
      assert.equal(plan.fitnessGoal, 'body-recomposition');
      assert.equal('history' in plan || 'completed' in plan || 'id' in plan || 'date' in plan || 'gender' in plan, false);
    }
  }
});

test('source links match all 64 PDF URI annotations exactly, including different incline queries', () => {
  assert.equal(RECOMPOSITION_SOURCE_ROWS.length, 32);
  const links = RECOMPOSITION_SOURCE_ROWS.flatMap(({ videoLinks }) => [videoLinks.hindi, videoLinks.english]);
  // Golden digest taken directly from /URI annotations in the supplied PDF,
  // independent of this module. Tests do not require the user's Downloads file.
  assert.equal(createHash('sha256').update(links.join('\n')).digest('hex'), '65eed2fe63ccc8098e9f97107e63138a5b1e273f6441502c8783cd12d63d28e2');
  for (const link of links) {
    const url = new URL(link);
    assert.equal(url.origin, 'https://www.youtube.com');
    assert.equal(url.pathname, '/results');
    assert.ok(url.searchParams.get('search_query'));
  }
  const week = getRecompositionWeekPlan();
  assert.match(week[0].exerciseVideoLinks['incline-bench-press'].hindi, /incline\+dumbbell\+press/);
  assert.match(week[4].exerciseVideoLinks['incline-bench-press'].hindi, /incline\+chest\+press/);
  assert.notDeepEqual(week[0].exerciseVideoLinks['incline-bench-press'], week[4].exerciseVideoLinks['incline-bench-press']);
  assert.match(RECOMPOSITION_VIDEO_NOTE, /search results/);
});

test('editable app targets distinguish repetitions, holds, and cardio without prescribing weights', () => {
  assert.match(RECOMPOSITION_TARGET_NOTE, /no sets, reps, holds, or rest periods/);
  assert.match(RECOMPOSITION_TARGET_NOTE, /editable starting targets/i);
  for (const level of ['beginner', 'medium', 'experienced']) {
    const sets = level === 'beginner' ? 2 : 3;
    const week = getRecompositionWeekPlan(level);
    for (const plan of week) {
      assert.equal(plan.targetOrigin, 'app-starting-targets');
      assert.equal(plan.targetNote, RECOMPOSITION_TARGET_NOTE);
      assert.deepEqual(Object.keys(plan.exerciseTargets), plan.exerciseIds);
      for (const [id, target] of Object.entries(plan.exerciseTargets)) {
        assert.match(target.reps, /^\d+–\d+$/);
        assert.ok(['reps', 'sec', 'min'].includes(target.unit));
        assert.ok(target.restSeconds >= 0 && target.restSeconds <= 600);
        assert.equal(target.sets, id === 'treadmill-walk' ? 1 : sets);
        assert.equal('weight' in target || 'load' in target || 'kg' in target, false);
      }
    }
    assert.deepEqual(week[0].exerciseTargets['chest-press-machine'], { sets, reps: '8–12', unit: 'reps', restSeconds: 90 });
    assert.deepEqual(week[0].exerciseTargets['pec-deck'], { sets, reps: '10–15', unit: 'reps', restSeconds: 60 });
    assert.deepEqual(week[2].exerciseTargets.plank, { sets, reps: '20–30', unit: 'sec', restSeconds: 45 });
    assert.deepEqual(week[5].exerciseTargets['treadmill-walk'], { sets: 1, reps: '10–15', unit: 'min', restSeconds: 0 });
  }
  assert.deepEqual(getRecompositionWeekPlan('unknown'), getRecompositionWeekPlan('beginner'));
});

test('only the six-day gym recomposition selection uses the sheet, without gender substitutions', () => {
  for (const { id: fitnessGoal } of FITNESS_GOALS) {
    for (const trainingPlace of ['home', 'gym']) {
      for (let weeklyGoal = 1; weeklyGoal <= 7; weeklyGoal++) {
        for (const level of ['beginner', 'medium', 'experienced']) {
          const options = { fitnessGoal, trainingPlace, weeklyGoal, level };
          const isSource = fitnessGoal === 'body-recomposition' && trainingPlace === 'gym' && weeklyGoal === 6;
          for (const gender of ['woman', 'man', 'nonbinary', 'prefer-not-to-say', 'unknown', undefined]) {
            const week = getSuggestedWeekPlan({ ...options, gender });
            assert.equal(week.every(({ programId }) => programId === 'six-day-recomposition'), isSource);
            if (isSource) assert.deepEqual(week, getRecompositionWeekPlan(level));
          }
        }
      }
    }
  }
});

test('the catalog reuses source exercises and keeps all new equipment out of home plans', () => {
  const catalog = new Map(EXERCISES.map((exercise) => [exercise.id, exercise]));
  for (const row of RECOMPOSITION_SOURCE_ROWS) {
    assert.ok(catalog.has(row.exerciseId), row.exerciseId);
    assert.ok(catalog.get(row.exerciseId).places.includes('gym'));
    assert.ok(catalog.get(row.exerciseId).videoLinks.hindi);
  }
  const added = ['chest-press-machine', 'pec-deck', 'rear-delt-fly', 'cable-triceps-extension', 'treadmill-walk', 'stationary-bike'];
  for (const id of added) assert.deepEqual(catalog.get(id).places, ['gym']);
  assert.ok(getExercisesForPlace('home').every((exercise) => !added.includes(exercise.id)));
  assert.equal(catalog.get('treadmill-walk').movement, 'walking');
  assert.equal(catalog.get('stationary-bike').movement, 'cycling');
  assert.deepEqual(catalog.get('stationary-bike').videoLinks, catalog.get('treadmill-walk').videoLinks);
  assert.equal(EXERCISES.filter(({ id }) => id === 'incline-bench-press').length, 1);
});

test('source definitions are immutable and all returned plan maps are independent', () => {
  assert.equal(RECOMPOSITION_SOURCE_LABEL, '6-Day YouTube Gym Playlist');
  assert.ok(Object.isFrozen(RECOMPOSITION_SOURCE_ROWS) && Object.isFrozen(RECOMPOSITION_SOURCE_DAYS));
  assert.ok(RECOMPOSITION_SOURCE_ROWS.every((row) => Object.isFrozen(row) && Object.isFrozen(row.videoLinks)));
  assert.ok(RECOMPOSITION_SOURCE_DAYS.every((day) => Object.isFrozen(day) && Object.isFrozen(day.exerciseIds) && Object.isFrozen(day.muscleGroups)));
  const original = getRecompositionWeekPlan();
  const edited = getRecompositionWeekPlan();
  edited[0].exerciseIds.pop();
  edited[0].muscleGroups.push('Changed');
  edited[0].exerciseTargets['chest-press-machine'].sets = 10;
  edited[0].exerciseVideoLinks['incline-bench-press'].hindi = 'Changed';
  assert.deepEqual(getRecompositionWeekPlan(), original);
  assert.notEqual(edited[2].exerciseTargets.plank, edited[5].exerciseTargets.plank);
});
