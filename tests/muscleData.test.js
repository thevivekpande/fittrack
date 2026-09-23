import test from 'node:test';
import assert from 'node:assert/strict';
import { EXERCISES } from '../src/data.js';
import { MUSCLE_REGIONS, EXERCISE_MUSCLES, getExerciseMuscles } from '../src/muscleData.js';

const lookup = id => getExerciseMuscles({ id });

test('every home and gym exercise has an explicit, valid, sparse muscle map', () => {
  assert.deepEqual(Object.keys(EXERCISE_MUSCLES).sort(), EXERCISES.map(exercise => exercise.id).sort());
  assert.equal(Object.keys(MUSCLE_REGIONS).length, 18);
  for (const exercise of EXERCISES) {
    const targets = getExerciseMuscles(exercise);
    assert.deepEqual(targets, lookup(exercise.id), exercise.id);
    assert.ok(targets.primary.length > 0 && targets.primary.length <= 3, exercise.id);
    assert.ok(targets.secondary.length <= 4, exercise.id);
    const all = [...targets.primary, ...targets.secondary];
    assert.equal(new Set(all).size, all.length, `${exercise.id}: overlap or duplicate`);
    for (const region of all) assert.equal(typeof MUSCLE_REGIONS[region], 'string', `${exercise.id}: ${region}`);
  }
});

test('isolation exercises identify their specific regions instead of blanket legs or arms', () => {
  assert.deepEqual(lookup('leg-extension'), { primary: ['quads'], secondary: [] });
  assert.deepEqual(lookup('seated-leg-curl'), { primary: ['hamstrings'], secondary: ['calves'] });
  assert.deepEqual(lookup('standing-calf-raise'), { primary: ['calves'], secondary: [] });
  for (const id of ['triceps-pushdown', 'rope-triceps-pushdown', 'overhead-triceps-extension', 'cable-triceps-extension']) {
    assert.deepEqual(lookup(id), { primary: ['triceps'], secondary: [] });
  }
  assert.deepEqual(lookup('chest-fly').primary, ['chest']);
  assert.equal(lookup('chest-fly').secondary.includes('triceps'), false);
});

test('shoulder heads, grip variants, and close-grip pushes retain distinct targets', () => {
  assert.deepEqual(lookup('front-raise').primary, ['frontDelts']);
  assert.deepEqual(lookup('lateral-raise').primary, ['sideDelts']);
  assert.deepEqual(lookup('rear-delt-fly').primary, ['rearDelts']);
  assert.deepEqual(lookup('cable-face-pull').primary, ['rearDelts', 'upperBack']);
  assert.equal(lookup('bicep-curl').primary.includes('forearms'), false);
  assert.equal(lookup('hammer-curl').primary.includes('forearms'), true);
  assert.equal(lookup('reverse-curl').primary.includes('biceps'), true);
  assert.equal(lookup('narrow-push-up').primary.includes('triceps'), true);
  assert.equal(lookup('push-up').primary.includes('triceps'), false);
  assert.deepEqual(lookup('wide-grip-cable-row').primary, ['upperBack', 'rearDelts']);
  assert.equal(lookup('cable-row').primary.includes('lats'), true);
});

test('core movement maps distinguish spinal flexion, hip flexion, and side support', () => {
  assert.deepEqual(lookup('crunch').primary, ['abs']);
  assert.deepEqual(lookup('reverse-crunch').primary, ['abs']);
  assert.deepEqual(lookup('lying-leg-raise').primary, ['hipFlexors']);
  assert.ok(lookup('lying-leg-raise').secondary.includes('abs'));
  assert.deepEqual(lookup('bicycle-crunch').primary, ['abs', 'obliques']);
  assert.deepEqual(lookup('side-plank').primary, ['obliques']);
  assert.deepEqual(lookup('heel-tap').primary, ['obliques']);
  assert.ok(lookup('bird-dog').primary.includes('lowerBack'));
  assert.deepEqual(lookup('superman').primary, ['lowerBack']);
  assert.deepEqual(lookup('glute-bridge').primary, ['glutes']);
  assert.ok(lookup('single-leg-glute-bridge').secondary.includes('obliques'));
});

test('mobility and cardio describe their actual moving areas without importing loaded-press targets', () => {
  assert.deepEqual(lookup('standing-reach'), { primary: ['frontDelts', 'sideDelts'], secondary: ['upperBack'] });
  assert.deepEqual(lookup('easy-squat'), { primary: ['quads', 'glutes'], secondary: [] });
  assert.deepEqual(getExerciseMuscles({ movement: 'press', group: 'Mobility' }), lookup('standing-reach'));
  assert.deepEqual(getExerciseMuscles({ movement: 'squat', group: 'Mobility' }), lookup('easy-squat'));
  assert.equal(lookup('standing-reach').secondary.includes('triceps'), false);
  assert.deepEqual(lookup('stationary-bike').primary, ['quads', 'glutes']);
  assert.ok(lookup('treadmill-walk').primary.includes('calves'));
});

test('catalog IDs take precedence and direct demos resolve names, aliases, and recognized movements', () => {
  assert.deepEqual(getExerciseMuscles({ id: 'seated-leg-curl', movement: 'curl', name: 'Dumbbell bicep curl', group: 'Biceps' }), lookup('seated-leg-curl'));
  for (const exercise of EXERCISES) {
    assert.deepEqual(getExerciseMuscles({ name: exercise.name.toUpperCase() }), lookup(exercise.id), exercise.name);
    assert.deepEqual(getExerciseMuscles({ name: exercise.id.replaceAll('-', ' ') }), lookup(exercise.id), exercise.id);
    assert.ok(getExerciseMuscles({ movement: exercise.movement }).primary.length, exercise.movement);
  }
  assert.deepEqual(getExerciseMuscles({ name: 'Close-grip push-up', movement: 'pushup' }), lookup('narrow-push-up'));
  assert.deepEqual(getExerciseMuscles({ movement: 'curl', equipment: 'Leg curl machine' }), lookup('seated-leg-curl'));
  assert.deepEqual(getExerciseMuscles({ movement: 'rear-delt-fly' }), lookup('rear-delt-fly'));
});

test('unknown or malformed exercise descriptions do not invent a muscle target', () => {
  for (const value of [undefined, null, 5, 'squat', [], {}, { id: 'unknown' }, { id: 'constructor' }, { movement: 'toString' }, { name: 'not a squat' }, { group: 'Legs' }, { group: 'Chest', movement: 'unknown' }, { group: 'Mobility', movement: 'unknown' }]) {
    assert.deepEqual(getExerciseMuscles(value), { primary: [], secondary: [] });
  }
});

test('source mappings are deeply immutable and result arrays are independent between callers', () => {
  assert.ok(Object.isFrozen(MUSCLE_REGIONS));
  assert.ok(Object.isFrozen(EXERCISE_MUSCLES));
  assert.throws(() => { MUSCLE_REGIONS.abs = 'Changed'; }, TypeError);
  for (const record of Object.values(EXERCISE_MUSCLES)) {
    assert.ok(Object.isFrozen(record));
    assert.ok(Object.isFrozen(record.primary));
    assert.ok(Object.isFrozen(record.secondary));
  }
  const original = lookup('push-up');
  const changed = lookup('push-up');
  assert.notEqual(original.primary, changed.primary);
  assert.notEqual(original.secondary, changed.secondary);
  changed.primary.push('calves');
  changed.secondary.length = 0;
  assert.deepEqual(lookup('push-up'), original);
  const unknown = getExerciseMuscles();
  unknown.primary.push('chest');
  assert.deepEqual(getExerciseMuscles(), { primary: [], secondary: [] });
});
