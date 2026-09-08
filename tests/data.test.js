import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import * as data from '../src/data.js';

const { LEVELS, TRAINING_PLACES, MUSCLE_GROUPS, EXERCISES, getExercisesForPlace, getWeekPlan, dateKey, getWeekDates } = data;
// Both renderers use these pure exports. Import their unmodified source before
// the JSX so their movement geometry can also be checked in Node.
const preview = await readFile(new URL('../src/components/ExerciseDemo.jsx', import.meta.url), 'utf8');
const pureSource = preview.slice(preview.indexOf('export const SUPPORTED_MOVEMENTS'), preview.indexOf('function FallbackPreview'));
const { SUPPORTED_MOVEMENTS, getExercisePose, getEquipmentProps, getWeightAttachments } = await import(`data:text/javascript;base64,${Buffer.from(pureSource).toString('base64')}`);

test('catalog separates home and gym equipment and contains no invented activity', () => {
  assert.deepEqual(TRAINING_PLACES.map(({ id }) => id), ['home', 'gym']);
  assert.deepEqual(LEVELS.map(({ label }) => label), ['Beginner', 'Medium', 'Experienced']);
  assert.equal(EXERCISES.length, 49);
  assert.equal(getExercisesForPlace('gym').length, 49);
  assert.equal(getExercisesForPlace('home').length, 20);
  assert.ok(getExercisesForPlace('gym').length > getExercisesForPlace('home').length);
  assert.equal(new Set(EXERCISES.map(({ id }) => id)).size, EXERCISES.length);
  for (const exercise of getExercisesForPlace('home')) {
    assert.ok(['Bodyweight', 'Exercise mat', 'Stable household support'].includes(exercise.equipment), exercise.id);
  }
  for (const id of ['bench-press', 'lat-pulldown', 'cable-row', 'leg-press', 'lateral-raise', 'triceps-pushdown', 'romanian-deadlift']) {
    assert.deepEqual(EXERCISES.find((exercise) => exercise.id === id)?.places, ['gym'], id);
  }
  assert.equal('createInitialHistory' in data, false);
});

test('muscle groups distinguish biceps and triceps and support balanced custom splits', () => {
  assert.deepEqual(MUSCLE_GROUPS, ['Biceps', 'Triceps', 'Chest', 'Shoulders', 'Back', 'Legs', 'Core', 'Cardio', 'Mobility']);
  assert.ok(EXERCISES.every((exercise) => MUSCLE_GROUPS.includes(exercise.group)));
  for (const group of MUSCLE_GROUPS.slice(0, 6)) {
    assert.ok(getExercisesForPlace('gym').filter((exercise) => exercise.group === group).length >= 3, `${group} needs useful exercise choices`);
  }
  assert.equal(EXERCISES.find(({ id }) => id === 'bicep-curl').group, 'Biceps');
  assert.equal(EXERCISES.find(({ id }) => id === 'triceps-pushdown').group, 'Triceps');
});

test('abs catalog contains seven new playable Core exercises in the correct places', () => {
  const homeCoreIds = ['crunch', 'reverse-crunch', 'dead-bug', 'bicycle-crunch', 'heel-tap', 'mountain-climber'];
  const core = EXERCISES.filter(({ group }) => group === 'Core');
  assert.equal(core.length, 8);
  for (const id of [...homeCoreIds, 'cable-crunch']) {
    const exercise = core.find((item) => item.id === id);
    assert.ok(exercise, id);
    assert.ok(exercise.aliases.includes('abs') && exercise.aliases.includes('abdominals') && exercise.aliases.includes('core'));
    assert.deepEqual(exercise.places, id === 'cable-crunch' ? ['gym'] : ['home', 'gym']);
    if (id !== 'cable-crunch') assert.ok(['Bodyweight', 'Exercise mat'].includes(exercise.equipment));
  }
  assert.ok(core.find(({ id }) => id === 'plank').aliases.includes('abs'));
});

test('all six programs have valid, playable weeks within the selected place', () => {
  const programs = new Set();
  for (const { id: place } of TRAINING_PLACES) {
    const availableIds = new Set(getExercisesForPlace(place).map(({ id }) => id));
    for (const { id: level } of LEVELS) {
      const plan = getWeekPlan(level, place);
      programs.add(JSON.stringify(plan));
      assert.deepEqual(plan.map(({ day }) => day), ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']);
      for (const day of plan) {
        assert.ok(day.title && day.focus && day.duration > 0 && day.sets >= 1);
        assert.match(String(day.reps), /^\d+(?:[–-]\d+)?$/);
        assert.ok(day.exerciseIds.length > 0, `${place}/${level}/${day.day} needs a playable session`);
        assert.ok(day.exerciseIds.every((id) => availableIds.has(id)), `${place}/${level}/${day.day} has unavailable equipment`);
        if (day.rest) {
          assert.ok(day.exerciseIds.length <= 2);
          assert.ok(day.exerciseIds.every((id) => EXERCISES.find((exercise) => exercise.id === id).group === 'Mobility'));
        }
      }
      assert.equal(plan.filter((day) => !day.rest).length, { beginner: 3, medium: 5, experienced: 6 }[level]);
    }
  }
  assert.equal(programs.size, 6);
});

test('every catalog demo is supported and produces finite joint positions', () => {
  const supported = new Set(SUPPORTED_MOVEMENTS);
  for (const exercise of EXERCISES) {
    assert.ok(supported.has(exercise.movement), exercise.id);
    assert.ok(exercise.name && exercise.group && exercise.equipment && exercise.duration > 0 && exercise.calories > 0);
    assert.equal(exercise.instructions.length, 3);
    assert.ok(exercise.instructions.every((instruction) => instruction.length > 20));
    assert.equal(new URL(exercise.image).protocol, 'https:');
    for (const time of [0, 0.7, 1 / 0.7, 2.1]) {
      const pose = getExercisePose(exercise.movement, time, exercise.equipment, exercise.name);
      for (const coordinates of Object.values(pose)) {
        assert.equal(coordinates.length, 3);
        assert.ok(coordinates.every((value) => Number.isFinite(value) && Math.abs(value) < 5), exercise.id);
      }
    }
  }
});

test('new demos perform their actual patterns instead of reusing a squat', () => {
  const poses = (movement) => [getExercisePose(movement, 0, 'Dumbbells'), getExercisePose(movement, 1 / 0.7, 'Dumbbells')];
  let [start, end] = poses('benchpress');
  assert.ok(Math.abs(start.shoulder[1] - start.hip[1]) < 0.1);
  assert.ok(end.leftHand[1] > start.leftHand[1]);
  [start, end] = poses('latpulldown');
  assert.ok(end.leftHand[1] < start.leftHand[1]);
  [start, end] = poses('cablerow');
  assert.ok(end.leftHand[2] < start.leftHand[2]);
  [start, end] = poses('legpress');
  assert.ok(end.leftAnkle[1] > start.leftAnkle[1] && end.leftAnkle[2] > start.leftAnkle[2]);
  [start, end] = poses('lateralraise');
  assert.ok(Math.abs(end.leftHand[0]) > Math.abs(start.leftHand[0]));
  [start, end] = poses('tricepspushdown');
  assert.deepEqual(start.leftElbow, end.leftElbow);
  assert.ok(end.leftHand[1] < start.leftHand[1]);
  [start, end] = poses('deadlift');
  assert.ok(end.hip[2] < start.hip[2] && end.shoulder[1] < start.shoulder[1]);
  [start, end] = poses('bridge');
  assert.ok(end.hip[1] > start.hip[1]);
  assert.deepEqual(end.shoulder, start.shoulder);
});

test('machine and bench props remain connected to the animated body', () => {
  for (const movement of ['benchpress', 'latpulldown', 'cablerow', 'legpress', 'tricepspushdown']) {
    const pose = getExercisePose(movement, 0.8, 'Cable machine');
    const props = getEquipmentProps(movement, pose);
    assert.ok(props.lines.length > 0, `${movement} has visible equipment`);
    assert.ok(props.lines.every(({ from, to, radius }) => from.every(Number.isFinite) && to.every(Number.isFinite) && radius > 0));
    if (movement !== 'tricepspushdown') assert.ok(props.panels.length > 0);
    if (['latpulldown', 'cablerow', 'tricepspushdown'].includes(movement)) {
      const center = pose.leftHand.map((value, index) => (value + pose.rightHand[index]) / 2);
      assert.ok(props.lines.some(({ to, radius }) => radius < 0.02 && JSON.stringify(to) === JSON.stringify(center)));
    }
  }
});

test('new isolation movements demonstrate different joint actions', () => {
  const poses = (movement) => [getExercisePose(movement, 0, 'Dumbbells'), getExercisePose(movement, 1 / 0.7, 'Dumbbells')];
  let [start, end] = poses('chestfly');
  assert.deepEqual(start.shoulder, end.shoulder);
  assert.ok(Math.abs(end.leftHand[0]) > Math.abs(start.leftHand[0]) && end.leftHand[1] < start.leftHand[1]);
  [start, end] = poses('frontraise');
  assert.equal(start.leftHand[0], end.leftHand[0]);
  assert.ok(end.leftHand[2] > start.leftHand[2] && end.leftHand[1] > start.leftHand[1]);
  [start, end] = poses('tricepsextension');
  assert.deepEqual(start.leftElbow, end.leftElbow);
  assert.ok(end.leftHand[1] > start.leftHand[1] && end.leftHand[1] > end.head[1]);
  [start, end] = poses('legextension');
  assert.deepEqual(start.leftKnee, end.leftKnee);
  assert.ok(end.leftAnkle[1] > start.leftAnkle[1] && end.leftAnkle[2] > start.leftAnkle[2]);
  [start, end] = poses('legcurl');
  assert.deepEqual(start.leftKnee, end.leftKnee);
  assert.ok(end.leftAnkle[1] < start.leftAnkle[1] && end.leftAnkle[2] < start.leftAnkle[2]);
  [start, end] = poses('calfraise');
  assert.ok(end.leftAnkle[1] > start.leftAnkle[1]);
  assert.ok(Math.abs((end.hip[1] - start.hip[1]) - (end.leftAnkle[1] - start.leftAnkle[1])) < 0.001);
});

test('crunches and reverse crunches move the intended body segment', () => {
  let start = getExercisePose('crunch', 0, 'Exercise mat');
  let end = getExercisePose('crunch', 1 / 0.7, 'Exercise mat');
  assert.ok(end.shoulder[1] > start.shoulder[1] && end.head[1] > start.head[1]);
  assert.deepEqual(end.hip, start.hip);
  assert.deepEqual(end.leftAnkle, start.leftAnkle);
  start = getExercisePose('reversecrunch', 0, 'Exercise mat');
  end = getExercisePose('reversecrunch', 1 / 0.7, 'Exercise mat');
  assert.ok(end.hip[1] > start.hip[1] && end.leftKnee[2] > start.leftKnee[2]);
  assert.deepEqual(end.shoulder, start.shoulder);
  assert.deepEqual(end.head, start.head);
  assert.deepEqual(end.leftHand, start.leftHand);
});

test('dead bug extends opposite limbs with the torso supported', () => {
  const start = getExercisePose('deadbug', 0, 'Exercise mat');
  const leftLeg = getExercisePose('deadbug', 1 / 0.7, 'Exercise mat');
  const rightLeg = getExercisePose('deadbug', 3 / 0.7, 'Exercise mat');
  assert.ok(leftLeg.leftAnkle[2] < leftLeg.rightAnkle[2]);
  assert.ok(leftLeg.rightHand[2] > leftLeg.leftHand[2]);
  assert.ok(rightLeg.rightAnkle[2] < rightLeg.leftAnkle[2]);
  assert.ok(rightLeg.leftHand[2] > rightLeg.rightHand[2]);
  for (const pose of [leftLeg, rightLeg]) {
    assert.deepEqual(pose.hip, start.hip);
    assert.deepEqual(pose.shoulder, start.shoulder);
    assert.deepEqual(pose.head, start.head);
    assert.ok(pose.leftAnkle[1] > 0.12 && pose.rightAnkle[1] > 0.12);
  }
});

test('bicycle crunch rotates toward the opposite knee and heel taps bend sideways', () => {
  const leftKnee = getExercisePose('bicyclecrunch', 0.5 / 0.7, 'Exercise mat');
  const rightKnee = getExercisePose('bicyclecrunch', 1.5 / 0.7, 'Exercise mat');
  assert.ok(leftKnee.leftKnee[2] > leftKnee.rightKnee[2]);
  assert.ok(leftKnee.rightShoulder[2] < leftKnee.leftShoulder[2]);
  assert.ok(rightKnee.rightKnee[2] > rightKnee.leftKnee[2]);
  assert.ok(rightKnee.leftShoulder[2] < rightKnee.rightShoulder[2]);
  const rightReach = getExercisePose('heeltap', 0.5 / 0.7, 'Exercise mat');
  const leftReach = getExercisePose('heeltap', 1.5 / 0.7, 'Exercise mat');
  assert.ok(rightReach.rightHand[2] < rightReach.leftHand[2] && rightReach.shoulder[0] > 0);
  assert.ok(leftReach.leftHand[2] < leftReach.rightHand[2] && leftReach.shoulder[0] < 0);
  assert.deepEqual(rightReach.leftAnkle, leftReach.leftAnkle);
  assert.deepEqual(rightReach.rightAnkle, leftReach.rightAnkle);
  assert.deepEqual(rightReach.hip, leftReach.hip);
});

test('mountain climbers alternate knees under a stable high plank', () => {
  const start = getExercisePose('mountainclimber', 0, 'Bodyweight');
  const leftKnee = getExercisePose('mountainclimber', 0.5 / 0.7, 'Bodyweight');
  const rightKnee = getExercisePose('mountainclimber', 1.5 / 0.7, 'Bodyweight');
  assert.ok(leftKnee.leftKnee[2] > leftKnee.rightKnee[2]);
  assert.ok(rightKnee.rightKnee[2] > rightKnee.leftKnee[2]);
  for (const pose of [leftKnee, rightKnee]) {
    assert.deepEqual(pose.leftHand, start.leftHand);
    assert.deepEqual(pose.rightHand, start.rightHand);
    assert.deepEqual(pose.shoulder, start.shoulder);
    assert.deepEqual(pose.hip, start.hip);
    assert.ok(pose.shoulder[1] > pose.leftHand[1] + 0.5);
  }
});

test('kneeling cable crunch flexes the torso while the rope follows both hands', () => {
  const start = getExercisePose('cablecrunch', 0, 'Cable machine');
  const end = getExercisePose('cablecrunch', 1 / 0.7, 'Cable machine');
  assert.ok(end.shoulder[1] < start.shoulder[1] && end.shoulder[2] > start.shoulder[2]);
  assert.deepEqual(end.hip, start.hip);
  assert.deepEqual(end.leftKnee, start.leftKnee);
  assert.ok(end.leftKnee[1] < 0.2);
  assert.ok(Math.abs((end.head[1] - end.leftHand[1]) - (start.head[1] - start.leftHand[1])) < 0.001);
  for (const pose of [start, end]) {
    const props = getEquipmentProps('cablecrunch', pose, 'Cable machine');
    assert.ok(props.lines.some(({ radius }) => radius < 0.02));
    for (const [from, to] of [['leftShoulder', 'leftElbow'], ['leftElbow', 'leftHand']]) {
      assert.ok(Math.abs(Math.hypot(...pose[from].map((value, index) => value - pose[to][index])) - 0.46) < 0.001);
    }
    for (const hand of ['leftHand', 'rightHand']) {
      assert.ok(props.lines.some(({ radius, to }) => radius === 0.025 && JSON.stringify(to) === JSON.stringify(pose[hand])));
    }
    assert.equal(getWeightAttachments('cablecrunch', pose, 'Cable machine').length, 0);
  }
});

test('exercise variants show their equipment, support, and individual arm movement', () => {
  const leftCurl = getExercisePose('curl', 1 / 0.7, 'Dumbbells', 'Alternating dumbbell curl');
  const rightCurl = getExercisePose('curl', 3 / 0.7, 'Dumbbells', 'Alternating dumbbell curl');
  assert.ok(leftCurl.leftHand[1] > leftCurl.rightHand[1]);
  assert.ok(rightCurl.rightHand[1] > rightCurl.leftHand[1]);
  const oneArm = getExercisePose('row', 1, 'Dumbbell', 'Single-arm dumbbell row');
  const rowWeights = getWeightAttachments('row', oneArm, 'Dumbbell', 'Single-arm dumbbell row');
  assert.equal(rowWeights.length, 1);
  assert.deepEqual(rowWeights[0].position, oneArm.rightHand);
  assert.deepEqual(oneArm.leftHand, getExercisePose('row', 0, 'Dumbbell', 'Single-arm dumbbell row').leftHand);
  const extension = getExercisePose('tricepsextension', 1, 'Dumbbell');
  assert.equal(getWeightAttachments('tricepsextension', extension, 'Dumbbell').length, 1);
  const seated = getExercisePose('press', 1, 'Dumbbells + bench');
  const standing = getExercisePose('press', 1, 'Dumbbells');
  assert.ok(seated.hip[1] < standing.hip[1]);
  assert.ok(getEquipmentProps('press', seated, 'Dumbbells + bench').panels.length >= 2);
  const incline = getExercisePose('benchpress', 1, 'Dumbbells + incline bench');
  assert.ok(incline.shoulder[1] > incline.hip[1] + 0.3);
  assert.ok(getEquipmentProps('benchpress', incline, 'Dumbbells + incline bench').panels.some(({ points }) => points[0][1] !== points[2][1]));
  const cableCurl = getExercisePose('curl', 1, 'Cable machine');
  assert.equal(getWeightAttachments('curl', cableCurl, 'Cable machine').length, 0);
  assert.ok(getEquipmentProps('curl', cableCurl, 'Cable machine').lines.some(({ radius }) => radius < 0.02));
  for (const movement of ['legextension', 'legcurl']) {
    const props = getEquipmentProps(movement, getExercisePose(movement, 1, 'Machine'));
    assert.ok(props.panels.length >= 2 && props.lines.some(({ radius }) => radius >= 0.1));
  }
});

test('sumo, hand-width, and household incline variants have distinct poses', () => {
  const squat = getExercisePose('squat', 0.8, 'Bodyweight');
  const sumo = getExercisePose('squat', 0.8, 'Bodyweight', 'Bodyweight sumo squat');
  assert.ok(Math.abs(sumo.leftAnkle[0]) > Math.abs(squat.leftAnkle[0]));
  const wide = getExercisePose('pushup', 0.8, 'Bodyweight', 'Wide push-up');
  const narrow = getExercisePose('pushup', 0.8, 'Bodyweight', 'Narrow push-up');
  assert.ok(Math.abs(wide.leftHand[0]) > Math.abs(narrow.leftHand[0]));
  const incline = getExercisePose('pushup', 0.8, 'Stable household support', 'Incline push-up');
  assert.ok(incline.leftHand[1] > wide.leftHand[1]);
});

test('plan callers cannot mutate future plans or another training place', () => {
  for (const { id: place } of TRAINING_PLACES) {
    const original = getWeekPlan('medium', place);
    const altered = getWeekPlan('medium', place);
    altered[0].title = 'Changed';
    altered[0].exerciseIds.push('unknown');
    altered.pop();
    assert.deepEqual(getWeekPlan('medium', place), original);
    assert.deepEqual(getWeekPlan('unknown', place), original);
  }
  const home = getWeekPlan('beginner', 'home');
  home[1].exerciseIds.length = 0;
  assert.ok(getWeekPlan('experienced', 'gym')[6].exerciseIds.length > 0);
  assert.deepEqual(getWeekPlan('beginner'), getWeekPlan('beginner', 'gym'));
});

test('local dates and Monday-based week offsets are correct', () => {
  assert.equal(dateKey(new Date(2026, 0, 2, 0, 1)), '2026-01-02');
  assert.equal(dateKey(new Date(2026, 11, 31, 23, 59)), '2026-12-31');
  const week = getWeekDates();
  assert.equal(week.length, 7);
  assert.equal(week[0].getDay(), 1);
  assert.equal(week[6].getDay(), 0);
  assert.ok(week.some((day) => dateKey(day) === dateKey(new Date())));
  for (const offset of [-3, -1, 0, 1, 3]) {
    const shifted = getWeekDates(offset);
    for (let index = 0; index < 7; index++) {
      const expected = new Date(week[0]);
      expected.setDate(expected.getDate() + offset * 7 + index);
      assert.equal(dateKey(shifted[index]), dateKey(expected));
      assert.notEqual(shifted[index], week[index]);
    }
  }
});
