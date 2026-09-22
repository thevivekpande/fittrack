import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import * as THREE from 'three';
import { EXERCISES } from '../src/data.js';

const source = await readFile(new URL('../src/components/ExerciseDemo.jsx', import.meta.url), 'utf8');
const pureSource = source.slice(source.indexOf('export const SUPPORTED_MOVEMENTS'), source.indexOf('function FallbackPreview'));
const { getExercisePose, getAvatarStyle, getEquipmentProps, getWeightAttachments, SUPPORTED_MOVEMENTS } = await import(`data:text/javascript;base64,${Buffer.from(pureSource).toString('base64')}`);
const modelSource = source.slice(source.indexOf('function createHumanFigure'), source.indexOf('export default function ExerciseDemo'));
const segments = [
  ['leftShoulder', 'leftElbow'], ['leftElbow', 'leftHand'], ['rightShoulder', 'rightElbow'], ['rightElbow', 'rightHand'],
  ['leftHip', 'leftKnee'], ['leftKnee', 'leftAnkle'], ['rightHip', 'rightKnee'], ['rightKnee', 'rightAnkle'],
];
const createHumanFigure = new Function('THREE', 'SEGMENTS', `${modelSource}; return createHumanFigure;`)(THREE, segments);

test('avatar preference uses requested presentation and a neutral fallback', () => {
  assert.equal(getAvatarStyle('woman').kind, 'woman');
  assert.equal(getAvatarStyle('man').kind, 'man');
  for (const value of [null, undefined, 'nonbinary', 'prefer-not-to-say', 'unknown']) assert.equal(getAvatarStyle(value).kind, 'neutral');
  assert.notEqual(getAvatarStyle('woman').hipWidth, getAvatarStyle('man').hipWidth);
  assert.notEqual(getAvatarStyle('woman').chestWidth, getAvatarStyle('man').chestWidth);
});

test('all human avatars remain finite throughout every exercise pose', () => {
  for (const gender of ['woman', 'man', null]) {
    const scene = new THREE.Scene();
    const human = createHumanFigure(scene, getAvatarStyle(gender));
    for (const exercise of EXERCISES) {
      for (const time of [0, 0.7, 1 / 0.7]) {
        human.update(getExercisePose(exercise.movement, time, exercise.equipment, exercise.name), exercise.movement);
        scene.updateMatrixWorld(true);
        scene.traverse((object) => assert.ok(object.matrixWorld.elements.every(Number.isFinite), `${gender}/${exercise.id}/${object.name}`));
      }
    }
  }
});

test('the human face follows standing, supine, prone, and side-support orientation', () => {
  const scene = new THREE.Scene();
  const human = createHumanFigure(scene, getAvatarStyle('woman'));
  const facing = (movement) => {
    human.update(getExercisePose(movement, 0, 'Exercise mat'), movement);
    return new THREE.Vector3(0, 0, 1).applyQuaternion(scene.getObjectByName('head').quaternion);
  };
  assert.ok(facing('squat').z > 0.9);
  assert.ok(facing('crunch').y > 0.9);
  assert.ok(facing('pushup').y < -0.9);
  assert.ok(facing('sideplank').x > 0.9);
});

test('supported palms lie flat while raised and weighted hands follow the forearm', () => {
  const scene = new THREE.Scene();
  const human = createHumanFigure(scene, getAvatarStyle('woman'));
  for (const movement of ['pushup', 'plank', 'mountainclimber', 'birddog', 'sideplank']) {
    human.update(getExercisePose(movement, 0, 'Exercise mat'), movement);
    const hand = scene.getObjectByName('leftHand');
    assert.ok(new THREE.Vector3(0, 0, 1).applyQuaternion(hand.quaternion).y > 0.99, movement);
    assert.ok(new THREE.Vector3(0, -1, 0).applyQuaternion(hand.quaternion).z > 0.99, movement);
  }
  human.update(getExercisePose('pushup', 0, 'Stable household support', 'Wall push-up'), 'pushup');
  const wallHand = scene.getObjectByName('leftHand');
  assert.ok(new THREE.Vector3(0, 0, 1).applyQuaternion(wallHand.quaternion).z > 0.99);
  assert.ok(new THREE.Vector3(0, -1, 0).applyQuaternion(wallHand.quaternion).y > 0.99);
  const curl = getExercisePose('curl', 1, 'Dumbbells');
  human.update(curl, 'curl');
  const forearm = new THREE.Vector3().fromArray(curl.leftElbow).sub(new THREE.Vector3().fromArray(curl.leftHand)).normalize();
  const handAxis = new THREE.Vector3(0, 1, 0).applyQuaternion(scene.getObjectByName('leftHand').quaternion);
  assert.ok(handAxis.distanceTo(forearm) < 0.001);
});

const pointDistance = (first, second) => Math.hypot(...first.map((value, index) => value - second[index]));
const closeTo = (value, expected) => assert.ok(Math.abs(value - expected) < 0.00001, `${value} should equal ${expected}`);

test('seated chest press and pec deck use distinct supported pressing and fly patterns', () => {
  const startPress = getExercisePose('chestpressmachine', 0, 'Chest press machine');
  const endPress = getExercisePose('chestpressmachine', 1 / 0.7, 'Chest press machine');
  assert.deepEqual(startPress.hip, endPress.hip);
  assert.deepEqual(startPress.leftAnkle, endPress.leftAnkle);
  assert.ok(endPress.leftHand[2] > startPress.leftHand[2] + 0.4);
  assert.ok(endPress.shoulder[1] > endPress.hip[1] + 0.8);
  for (const time of [0, 0.5, 1 / 0.7]) {
    const pose = getExercisePose('chestpressmachine', time, 'Chest press machine');
    closeTo(pointDistance(pose.leftShoulder, pose.leftElbow), 0.46);
    closeTo(pointDistance(pose.leftElbow, pose.leftHand), 0.45);
    closeTo(pointDistance([-0.45, 2.65, 0.10], pose.leftHand), 1.05);
    const equipment = getEquipmentProps('chestpressmachine', pose, 'Chest press machine');
    assert.ok(equipment.panels.length >= 2);
    assert.ok(equipment.lines.some(({ to }) => pointDistance(to, pose.leftHand) < 0.00001));
  }
  const open = getExercisePose('pecdeck', 0, 'Pec deck machine');
  const closed = getExercisePose('pecdeck', 1 / 0.7, 'Pec deck machine');
  assert.ok(Math.abs(closed.leftHand[0]) < Math.abs(open.leftHand[0]) * 0.3);
  assert.deepEqual(open.hip, closed.hip);
  for (const pose of [open, closed]) {
    closeTo(pointDistance(pose.leftShoulder, pose.leftElbow), Math.hypot(0.46, 0.01));
    closeTo(pose.leftHand[1] - pose.leftElbow[1], 0.43);
    const equipment = getEquipmentProps('pecdeck', pose, 'Pec deck machine');
    assert.ok(equipment.lines.some(({ radius }) => radius >= 0.1));
    assert.ok(equipment.lines.some(({ to }) => pointDistance(to, pose.leftHand) < 0.00001));
  }
});

test('rear delt fly hinges the torso and overhead cable extension preserves upper arm position', () => {
  const lowered = getExercisePose('reardeltfly', 0, 'Dumbbells');
  const opened = getExercisePose('reardeltfly', 1 / 0.7, 'Dumbbells');
  assert.ok(lowered.shoulder[1] < 1.7 && lowered.shoulder[2] > lowered.hip[2] + 0.5);
  assert.deepEqual(opened.shoulder, lowered.shoulder);
  assert.ok(Math.abs(opened.leftHand[0]) > Math.abs(lowered.leftHand[0]) + 0.8);
  assert.ok(opened.leftHand[1] > lowered.leftHand[1] + 0.8);
  assert.equal(getWeightAttachments('reardeltfly', opened, 'Dumbbells').length, 2);
  const bent = getExercisePose('cabletricepsextension', 0, 'Cable machine');
  const extended = getExercisePose('cabletricepsextension', 1 / 0.7, 'Cable machine');
  assert.deepEqual(bent.leftElbow, extended.leftElbow);
  assert.ok(extended.leftHand[1] > bent.leftHand[1] + 0.6);
  for (const pose of [bent, extended]) {
    const equipment = getEquipmentProps('cabletricepsextension', pose, 'Cable machine');
    const cable = equipment.lines.find(({ radius }) => radius < 0.02);
    assert.ok(cable, 'the overhead rope is connected to a cable');
    closeTo(cable.from[1], 0.25);
    assert.ok(cable.from[2] < -1, 'the cable starts at the low pulley behind the body');
    assert.ok(cable.to[1] > 2, 'the low pulley remains connected to the overhead rope');
    for (const hand of [pose.leftHand, pose.rightHand]) assert.ok(equipment.lines.some(({ to }) => pointDistance(to, hand) < 0.00001));
    assert.equal(getWeightAttachments('cabletricepsextension', pose, 'Cable machine').length, 0);
  }
});

test('treadmill walking alternates steps with a planted foot and a moving belt', () => {
  let leftSwings = false; let rightSwings = false;
  for (let step = 0; step <= 30; step += 1) {
    const pose = getExercisePose('walking', step / 20, 'Treadmill');
    assert.ok([pose.leftAnkle, pose.rightAnkle].some((ankle) => Math.abs(ankle[1] - 0.29) < 0.00001), 'walking retains at least one foot on the deck');
    for (const side of ['left', 'right']) {
      closeTo(pointDistance(pose[`${side}Hip`], pose[`${side}Knee`]), 0.62);
      closeTo(pointDistance(pose[`${side}Knee`], pose[`${side}Ankle`]), 0.60);
      assert.ok(pose[`${side}Ankle`][1] >= 0.29);
    }
    leftSwings ||= pose.leftAnkle[1] > 0.35;
    rightSwings ||= pose.rightAnkle[1] > 0.35;
  }
  assert.ok(leftSwings && rightSwings);
  const start = getEquipmentProps('walking', getExercisePose('walking', 0, 'Treadmill'), 'Treadmill');
  const later = getEquipmentProps('walking', getExercisePose('walking', 0.2, 'Treadmill'), 'Treadmill');
  assert.ok(start.panels.length >= 3);
  assert.notDeepEqual(start.lines.filter(({ radius }) => radius === 0.008), later.lines.filter(({ radius }) => radius === 0.008));
});

test('stationary bike feet stay on opposite crank pedals and leg lengths remain constant', () => {
  for (let step = 0; step <= 30; step += 1) {
    const pose = getExercisePose('cycling', step / 18, 'Stationary bike');
    closeTo(pose.leftPedal[1] + pose.rightPedal[1], pose.crank[1] * 2);
    closeTo(pose.leftPedal[2] + pose.rightPedal[2], pose.crank[2] * 2);
    const equipment = getEquipmentProps('cycling', pose, 'Stationary bike');
    assert.ok(equipment.panels.length >= 3, 'saddle and both pedals are visible');
    for (const side of ['left', 'right']) {
      const ankle = pose[`${side}Ankle`]; const pedal = pose[`${side}Pedal`];
      closeTo(Math.hypot(pedal[1] - pose.crank[1], pedal[2] - pose.crank[2]), 0.26);
      closeTo(ankle[1] - pedal[1], 0.13);
      closeTo(ankle[2] - pedal[2], -0.08);
      closeTo(pointDistance(pose[`${side}Hip`], pose[`${side}Knee`]), 0.61);
      closeTo(pointDistance(pose[`${side}Knee`], ankle), 0.60);
      assert.ok(equipment.lines.some(({ to }) => pointDistance(to, pedal) < 0.00001));
    }
  }
});

test('all six planner demos keep stable equipment geometry throughout the loop', () => {
  for (const [movement, equipment] of [['chestpressmachine', 'Chest press machine'], ['pecdeck', 'Pec deck machine'], ['reardeltfly', 'Dumbbells'], ['cabletricepsextension', 'Cable machine'], ['walking', 'Treadmill'], ['cycling', 'Stationary bike']]) {
    assert.ok(SUPPORTED_MOVEMENTS.includes(movement));
    let expectedCounts;
    for (const time of [0, 0.4, 1, 1.7, 3.1]) {
      const pose = getExercisePose(movement, time, equipment);
      assert.ok(Object.values(pose).every((point) => point.length === 3 && point.every(Number.isFinite)));
      const props = getEquipmentProps(movement, pose, equipment);
      const counts = [props.lines.length, props.panels.length];
      if (expectedCounts) assert.deepEqual(counts, expectedCounts);
      expectedCounts = counts;
      assert.ok(props.lines.every(({ from, to, radius }) => from.every(Number.isFinite) && to.every(Number.isFinite) && radius > 0));
      assert.ok(props.panels.every(({ points }) => points.length === 4 && points.every((point) => point.every(Number.isFinite))));
    }
  }
});
