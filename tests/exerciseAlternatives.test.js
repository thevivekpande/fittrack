import test from 'node:test';
import assert from 'node:assert/strict';
import { EXERCISES } from '../src/data.js';
import { EQUIPMENT_OPTIONS, equipmentOptions, getExerciseAlternatives } from '../src/exerciseAlternatives.js';
import { getExerciseMuscles } from '../src/muscleData.js';

const alternatives = (id, options = {}) => getExerciseAlternatives({ exercise: { id }, trainingPlace: 'gym', ...options });
const ids = values => values.map(value => value.exercise.id);
const noMachine = exercise => !/machine|cable|treadmill|stationary bike/i.test(exercise.equipment);
const bodyweight = exercise => ['Bodyweight', 'Exercise mat', 'Stable household support'].includes(exercise.equipment);
const homeEquipment = exercise => bodyweight(exercise) || ['Filled water bottles', 'Light backpack'].includes(exercise.equipment);
const dumbbells = exercise => /\bdumbbells?\b/i.test(exercise.equipment);

test('equipment filter choices are stable and immutable', () => {
  assert.equal(equipmentOptions, EQUIPMENT_OPTIONS);
  assert.deepEqual(EQUIPMENT_OPTIONS.map(option => option.id), ['all', 'no-machines', 'bodyweight', 'dumbbells']);
  assert.ok(Object.isFrozen(EQUIPMENT_OPTIONS));
  assert.ok(EQUIPMENT_OPTIONS.every(Object.isFrozen));
});

test('all catalog sources honor place, equipment, source and plan exclusions without duplicates', () => {
  for (const exercise of EXERCISES) {
    for (const trainingPlace of ['home', 'gym']) {
      for (const equipmentFilter of EQUIPMENT_OPTIONS.map(option => option.id)) {
        const exerciseIds = Object.freeze(['push-up', 'goblet-squat', 'crunch']);
        const result = getExerciseAlternatives({ exercise, trainingPlace, exerciseIds, equipmentFilter });
        assert.equal(new Set(ids(result)).size, result.length, exercise.id);
        for (const item of result) {
          assert.ok(item.exercise.places.includes(trainingPlace), `${exercise.id}: wrong place`);
          assert.notEqual(item.exercise.id, exercise.id);
          assert.equal(exerciseIds.includes(item.exercise.id), false);
          assert.ok(item.reason && item.matchLabel);
          if (equipmentFilter === 'no-machines') assert.ok(noMachine(item.exercise));
          if (equipmentFilter === 'bodyweight') assert.ok(bodyweight(item.exercise));
          if (equipmentFilter === 'dumbbells') assert.ok(dumbbells(item.exercise));
          if (trainingPlace === 'home') assert.ok(homeEquipment(item.exercise), `${exercise.id}: home alternative requires gym equipment`);
          if (exercise.group !== 'Cardio') {
            const target = getExerciseMuscles(exercise).primary;
            assert.ok(getExerciseMuscles(item.exercise).primary.some(region => target.includes(region)), `${exercise.id}: no primary focus overlap`);
          }
        }
      }
    }
  }
});

test('machine alternatives prioritize useful different equipment while retaining direct variations', () => {
  assert.equal(alternatives('chest-press-machine')[0].exercise.id, 'bench-press');
  assert.equal(alternatives('pec-deck')[0].exercise.id, 'chest-fly');
  assert.equal(alternatives('cable-row')[0].exercise.id, 'dumbbell-row');
  assert.equal(alternatives('leg-press')[0].exercise.id, 'goblet-squat');
  assert.equal(alternatives('cable-face-pull')[0].exercise.id, 'rear-delt-fly');
  const pulldownIds = ids(alternatives('lat-pulldown'));
  assert.ok(pulldownIds.indexOf('dumbbell-row') < pulldownIds.indexOf('neutral-grip-lat-pulldown'));
  assert.ok(pulldownIds.includes('neutral-grip-lat-pulldown'));
  const row = alternatives('lat-pulldown').find(item => item.exercise.id === 'dumbbell-row');
  assert.equal(row.matchLabel, 'Related muscle focus');
  assert.match(row.reason, /Different movement/);
});

test('specific muscle focus and movement gates reject misleading leg, arm, and shoulder substitutes', () => {
  assert.deepEqual(ids(alternatives('standing-calf-raise')), ['dumbbell-calf-raise']);
  assert.deepEqual(ids(alternatives('seated-leg-curl')), ['romanian-deadlift', 'bodyweight-good-morning', 'backpack-romanian-deadlift']);
  const homeLegCurls = alternatives('seated-leg-curl', { trainingPlace: 'home' });
  assert.deepEqual(ids(homeLegCurls), ['bodyweight-good-morning', 'backpack-romanian-deadlift']);
  assert.ok(homeLegCurls.every(item => item.matchLabel === 'Related muscle focus' && /Different movement.*hamstrings.*hip hinge/.test(item.reason)));
  for (const id of ['leg-extension', 'leg-press', 'bodyweight-squat']) {
    assert.equal(ids(alternatives(id)).includes('standing-calf-raise'), false);
    assert.equal(ids(alternatives(id)).includes('seated-leg-curl'), false);
  }
  for (const id of ['front-raise', 'lateral-raise', 'shoulder-press']) {
    assert.equal(ids(alternatives(id)).includes('triceps-pushdown'), false);
  }
  assert.equal(ids(alternatives('front-raise')).includes('lateral-raise'), false);
  assert.equal(ids(alternatives('bicep-curl')).includes('lat-pulldown'), false);
  assert.equal(ids(alternatives('bicep-curl')).includes('triceps-pushdown'), false);
  assert.ok(ids(alternatives('triceps-pushdown')).includes('overhead-triceps-extension'));
  assert.ok(ids(alternatives('triceps-pushdown')).includes('narrow-push-up'));
});

test('plank variants rank first and abdominal curls are clearly described as different movements', () => {
  const result = alternatives('plank');
  assert.equal(result[0].exercise.id, 'incline-plank');
  assert.equal(result[0].matchLabel, 'Movement variation');
  const crunch = result.find(item => item.exercise.id === 'crunch');
  assert.equal(crunch.matchLabel, 'Related muscle focus');
  assert.match(crunch.reason, /Different movement.*abdominal curl/);
  assert.equal(ids(result).includes('lying-leg-raise'), false);
  assert.equal(ids(result).includes('glute-bridge'), false);
});

test('cardio stays cardio and mobility never becomes a loaded strength substitution', () => {
  assert.deepEqual(ids(alternatives('treadmill-walk')), ['indoor-walk', 'stationary-bike', 'jumping-jack']);
  assert.deepEqual(ids(alternatives('treadmill-walk', { equipmentFilter: 'no-machines' })), ['indoor-walk', 'jumping-jack']);
  assert.deepEqual(ids(alternatives('stationary-bike', { trainingPlace: 'home' })), ['indoor-walk', 'jumping-jack']);
  assert.deepEqual(ids(alternatives('jumping-jack', { trainingPlace: 'home' })), ['indoor-walk']);
  for (const source of EXERCISES.filter(exercise => ['Cardio', 'Mobility'].includes(exercise.group))) {
    assert.ok(alternatives(source.id).every(item => item.exercise.group === source.group));
  }
  assert.deepEqual(alternatives('standing-reach'), []);
  assert.deepEqual(alternatives('easy-squat'), []);
  assert.equal(ids(alternatives('shoulder-press')).includes('standing-reach'), false);
  assert.equal(ids(alternatives('bodyweight-squat')).includes('easy-squat'), false);
});

test('filtering returns every match in consistent order including mat, support, and bench requirements', () => {
  const all = alternatives('chest-press-machine');
  assert.ok(all.length > 3);
  const predicates = { 'no-machines': noMachine, bodyweight, dumbbells };
  for (const [equipmentFilter, predicate] of Object.entries(predicates)) {
    assert.deepEqual(ids(alternatives('chest-press-machine', { equipmentFilter })), ids(all.filter(item => predicate(item.exercise))));
  }
  const bodyweightIds = ids(alternatives('chest-press-machine', { equipmentFilter: 'bodyweight' }));
  assert.ok(bodyweightIds.includes('knee-push-up'));
  assert.ok(bodyweightIds.includes('incline-push-up'));
  const bench = alternatives('chest-press-machine', { equipmentFilter: 'dumbbells' }).find(item => item.exercise.id === 'bench-press');
  assert.match(bench.exercise.equipment, /bench/);
  assert.match(bench.reason, /bench/);
});

test('empty catalogs after exclusions, unsupported settings, and unknown sources are honest empty results', () => {
  assert.deepEqual(alternatives('chest-press-machine', { exerciseIds: EXERCISES.map(exercise => exercise.id) }), []);
  assert.deepEqual(alternatives('seated-leg-curl', { trainingPlace: 'home', exerciseIds: ['bodyweight-good-morning', 'backpack-romanian-deadlift'] }), []);
  assert.deepEqual(alternatives('bicep-curl', { equipmentFilter: 'bodyweight' }), []);
  assert.deepEqual(alternatives('jumping-jack', { trainingPlace: 'home', exerciseIds: ['indoor-walk'] }), []);
  assert.deepEqual(alternatives('plank', { equipmentFilter: 'dumbbells' }), []);
  for (const options of [undefined, null, [], 4, {}, { exercise: { id: 'unknown', group: 'Legs', movement: 'squat' }, trainingPlace: 'gym' }, { exercise: { name: 'Squat' }, trainingPlace: 'gym' }, { exercise: { id: 'constructor' }, trainingPlace: 'gym' }]) {
    assert.deepEqual(getExerciseAlternatives(options), []);
  }
  assert.deepEqual(alternatives('push-up', { trainingPlace: 'unknown' }), []);
  assert.deepEqual(alternatives('push-up', { equipmentFilter: 'unknown' }), []);
});

test('ranking is deterministic, canonical source metadata wins, and callers are not mutated', () => {
  const source = Object.freeze({ id: 'plank', movement: 'calfraise', group: 'Legs' });
  const excluded = Object.freeze(['crunch', 'crunch']);
  const request = Object.freeze({ exercise: source, exerciseIds: excluded, trainingPlace: 'gym' });
  const first = getExerciseAlternatives(request);
  const second = alternatives('plank', { exerciseIds: excluded });
  assert.deepEqual(first, second);
  first[0].reason = 'Changed by caller';
  first.pop();
  assert.deepEqual(getExerciseAlternatives(request), second);
  assert.deepEqual(excluded, ['crunch', 'crunch']);
});
