import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import * as THREE from 'three';
import { EXERCISES } from '../src/data.js';

const source = await readFile(new URL('../src/components/ExerciseDemo.jsx', import.meta.url), 'utf8');
const pureSource = source.slice(source.indexOf('export const SUPPORTED_MOVEMENTS'), source.indexOf('function FallbackPreview'));
const { getExercisePose, getAvatarStyle } = await import(`data:text/javascript;base64,${Buffer.from(pureSource).toString('base64')}`);
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
