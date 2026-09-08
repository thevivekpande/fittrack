import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { Pause, Play, RotateCw } from 'lucide-react';
import './ExerciseDemo.css';

export const SUPPORTED_MOVEMENTS = ['squat', 'pushup', 'curl', 'press', 'lunge', 'plank', 'row', 'jumpingjack', 'benchpress', 'latpulldown', 'cablerow', 'legpress', 'lateralraise', 'tricepspushdown', 'deadlift', 'bridge', 'chestfly', 'frontraise', 'tricepsextension', 'legextension', 'legcurl', 'calfraise', 'crunch', 'reversecrunch', 'deadbug', 'bicyclecrunch', 'heeltap', 'mountainclimber', 'cablecrunch'];
const MOVEMENTS = new Set(SUPPORTED_MOVEMENTS);
const SEGMENTS = [
  ['leftShoulder', 'leftElbow'], ['leftElbow', 'leftHand'],
  ['rightShoulder', 'rightElbow'], ['rightElbow', 'rightHand'],
  ['leftHip', 'leftKnee'], ['leftKnee', 'leftAnkle'],
  ['rightHip', 'rightKnee'], ['rightKnee', 'rightAnkle'],
];
const CUES = {
  squat: 'Sit your hips back. Keep your chest lifted.',
  pushup: 'Keep a straight line from your shoulders to your heels.',
  curl: 'Keep your elbows close. Lower with control.',
  press: 'Brace your core. Press straight overhead.',
  lunge: 'Take a comfortable step. Lower both knees with control.',
  plank: 'Brace your core and breathe steadily.',
  row: 'Hinge at your hips. Draw your elbows back.',
  jumpingjack: 'Land softly with a gentle bend in your knees.',
  benchpress: 'Keep your feet planted. Lower the weights beside your chest.',
  latpulldown: 'Draw the bar toward your upper chest. Keep your torso steady.',
  cablerow: 'Sit tall. Pull toward your lower ribs without rocking backward.',
  legpress: 'Keep your hips supported. Press smoothly without locking your knees.',
  lateralraise: 'Lead your arms out to the sides. Keep the weights light and controlled.',
  tricepspushdown: 'Keep your elbows by your sides. Move through your elbows.',
  deadlift: 'Move your hips back. Keep the weights close to your legs.',
  bridge: 'Press through your feet. Lift your hips without arching your back.',
  chestfly: 'Keep a soft bend in your elbows. Open and close your arms in a wide arc.',
  frontraise: 'Lift forward to shoulder height. Keep your torso still.',
  tricepsextension: 'Keep your upper arms steady. Bend and extend your elbows.',
  legextension: 'Keep your thighs on the pad. Extend your knees smoothly.',
  legcurl: 'Keep your thighs still. Bend your knees to pull the roller back.',
  calfraise: 'Rise onto the balls of your feet. Lower your heels with control.',
  crunch: 'Lift your shoulder blades gently. Keep your neck relaxed.',
  reversecrunch: 'Curl your pelvis up slightly. Lower with control instead of swinging.',
  deadbug: 'Extend the opposite arm and leg. Keep your lower back comfortably supported.',
  bicyclecrunch: 'Turn toward the opposite knee. Keep your fingertips light beside your head.',
  heeltap: 'Reach sideways toward each heel. Keep both feet planted.',
  mountainclimber: 'Bring one knee forward at a time. Keep your shoulders over your hands.',
  cablecrunch: 'Curl your ribs toward your pelvis. Keep the rope beside your head.',
};

function usesWeights(movement, equipment) {
  return equipment === undefined
    ? ['curl', 'press', 'row'].includes(movement)
    : /dumbbell/i.test(equipment);
}

export function getExercisePose(movement, time, equipment, exerciseName = '') {
  const gentleReach = movement === 'press' && /bodyweight/i.test(equipment || '');
  const amount = (1 - Math.cos(time * Math.PI * (gentleReach ? 0.45 : 0.7))) / 2;
  const pose = {
    hip: [0, 1.27, 0], shoulder: [0, 2.12, 0], head: [0, 2.55, 0],
    leftHip: [-0.22, 1.27, 0], rightHip: [0.22, 1.27, 0],
    leftShoulder: [-0.39, 2.08, 0], rightShoulder: [0.39, 2.08, 0],
    leftElbow: [-0.43, 1.57, 0.03], rightElbow: [0.43, 1.57, 0.03],
    leftHand: [-0.43, 1.09, 0.1], rightHand: [0.43, 1.09, 0.1],
    leftKnee: [-0.24, 0.69, 0.03], rightKnee: [0.24, 0.69, 0.03],
    leftAnkle: [-0.25, 0.13, 0], rightAnkle: [0.25, 0.13, 0],
  };
  const upperBody = (hipY, shoulderY, hipZ = 0, shoulderZ = 0) => {
    pose.hip = [0, hipY, hipZ];
    pose.shoulder = [0, shoulderY, shoulderZ];
    pose.head = [0, shoulderY + 0.43, shoulderZ];
    for (const [side, sign] of [['left', -1], ['right', 1]]) {
      pose[`${side}Hip`] = [sign * 0.22, hipY, hipZ];
      pose[`${side}Shoulder`] = [sign * 0.39, shoulderY - 0.04, shoulderZ];
    }
  };
  const supine = () => {
    pose.hip = [0, 0.28, -0.27];
    pose.shoulder = [0, 0.25, 0.56];
    pose.head = [0, 0.23, 1.0];
    for (const [side, sign] of [['left', -1], ['right', 1]]) {
      pose[`${side}Hip`] = [sign * 0.22, 0.28, -0.27];
      pose[`${side}Shoulder`] = [sign * 0.35, 0.25, 0.56];
      pose[`${side}Knee`] = [sign * 0.25, 0.7, -0.67];
      pose[`${side}Ankle`] = [sign * 0.27, 0.13, -1.11];
      pose[`${side}Elbow`] = [sign * 0.43, 0.12, 0.1];
      pose[`${side}Hand`] = [sign * 0.45, 0.12, -0.35];
    }
  };
  if (movement === 'squat') {
    upperBody(1.27 - amount * 0.55, 2.12 - amount * 0.57, -amount * 0.33, amount * 0.04);
    for (const [side, sign] of [['left', -1], ['right', 1]]) {
      pose[`${side}Knee`] = [sign * (0.26 + amount * 0.1), 0.65 - amount * 0.08, amount * 0.29];
      pose[`${side}Ankle`] = [sign * 0.32, 0.13, 0];
      pose[`${side}Elbow`] = [sign * 0.39, 1.68 - amount * 0.48, 0.3 + amount * 0.15];
      pose[`${side}Hand`] = [sign * 0.18, 1.68 - amount * 0.3, 0.68 + amount * 0.12];
      if (usesWeights(movement, equipment)) {
        pose[`${side}Elbow`] = [sign * 0.39, pose.shoulder[1] - 0.56, pose.shoulder[2] + 0.17];
        pose[`${side}Hand`] = [sign * 0.1, pose.shoulder[1] - 0.28, pose.shoulder[2] + 0.35];
      }
    }
  } else if (movement === 'curl') {
    for (const side of ['left', 'right']) {
      const alternating = /alternating/i.test(exerciseName);
      const phase = ((time * 0.35) % 2 + 2) % 2;
      const activeSide = phase < 1 ? 'left' : 'right';
      const armAmount = alternating ? (side === activeSide ? (1 - Math.cos((phase % 1) * Math.PI * 2)) / 2 : 0) : amount;
      const angle = -Math.PI / 2 + armAmount * Math.PI * 0.86;
      pose[`${side}Hand`][1] = 1.57 + Math.sin(angle) * 0.46;
      pose[`${side}Hand`][2] = 0.03 + Math.cos(angle) * 0.46;
    }
  } else if (movement === 'press') {
    for (const [side, sign] of [['left', -1], ['right', 1]]) {
      if (gentleReach) {
        const angle = -Math.PI / 2 + amount * Math.PI * 0.94;
        pose[`${side}Elbow`] = [sign * (0.39 + Math.cos(angle) * 0.5), 2.08 + Math.sin(angle) * 0.5, 0.04];
        pose[`${side}Hand`] = [sign * (0.39 + Math.cos(angle) * 0.94), 2.08 + Math.sin(angle) * 0.94, 0.06];
      } else {
        pose[`${side}Elbow`] = [sign * (0.77 - amount * 0.34), 1.94 + amount * 0.59, 0.06];
        pose[`${side}Hand`] = [sign * (0.76 - amount * 0.4), 2.43 + amount * 0.58, 0.06];
      }
    }
  } else if (movement === 'lunge') {
    upperBody(1.27 - amount * 0.52, 2.12 - amount * 0.52, -0.03, 0.06);
    pose.leftAnkle = [-0.23, 0.13, 0.65];
    pose.rightAnkle = [0.23, 0.13, -0.7];
    pose.leftKnee = [-0.23, 0.71 - amount * 0.08, 0.35 + amount * 0.28];
    pose.rightKnee = [0.23, 0.66 - amount * 0.44, -0.34];
    for (const [side, sign] of [['left', -1], ['right', 1]]) {
      pose[`${side}Elbow`] = [sign * 0.44, 1.62 - amount * 0.52, 0.02];
      pose[`${side}Hand`] = [sign * 0.43, 1.15 - amount * 0.52, 0.04];
    }
  } else if (movement === 'pushup' || movement === 'plank') {
    const drop = movement === 'plank' ? 0.13 : amount * 0.45;
    pose.hip = [0, 0.65 - drop * 0.5, -0.35];
    pose.shoulder = [0, 0.88 - drop, 0.61];
    pose.head = [0, 0.88 - drop, 1.03];
    for (const [side, sign] of [['left', -1], ['right', 1]]) {
      pose[`${side}Hip`] = [sign * 0.2, pose.hip[1], -0.35];
      pose[`${side}Shoulder`] = [sign * 0.38, pose.shoulder[1], 0.61];
      pose[`${side}Knee`] = [sign * 0.21, 0.38 - drop * 0.22, -0.96];
      pose[`${side}Ankle`] = [sign * 0.22, 0.13, -1.54];
      pose[`${side}Elbow`] = movement === 'plank'
        ? [sign * 0.4, 0.14, 0.57]
        : [sign * (0.39 + amount * 0.24), 0.47 - drop * 0.53, 0.34];
      pose[`${side}Hand`] = [sign * 0.42, 0.12, movement === 'plank' ? 1.02 : 0.7];
    }
    if (movement === 'pushup' && /bench|household support/i.test(equipment || '')) {
      pose.hip = [0, 0.98 - amount * 0.18, -0.4];
      pose.shoulder = [0, 1.55 - amount * 0.36, 0.48];
      pose.head = [0, 1.75 - amount * 0.36, 0.84];
      for (const [side, sign] of [['left', -1], ['right', 1]]) {
        pose[`${side}Hip`] = [sign * 0.2, pose.hip[1], -0.4];
        pose[`${side}Shoulder`] = [sign * 0.38, pose.shoulder[1], 0.48];
        pose[`${side}Knee`] = [sign * 0.21, 0.54 - amount * 0.07, -0.98];
        pose[`${side}Elbow`] = [sign * (0.42 + amount * 0.14), 1.19 - amount * 0.18, 0.36 - amount * 0.16];
        pose[`${side}Hand`] = [sign * 0.42, 0.88, 0.53];
      }
    }
  } else if (movement === 'row') {
    upperBody(1.15, 1.62, -0.25, 0.35);
    pose.head = [0, 1.92, 0.57];
    for (const [side, sign] of [['left', -1], ['right', 1]]) {
      pose[`${side}Knee`] = [sign * 0.25, 0.65, 0.12];
      pose[`${side}Elbow`] = [sign * 0.43, 1.1 + amount * 0.43, 0.39 - amount * 0.63];
      pose[`${side}Hand`] = [sign * 0.43, 0.66 + amount * 0.49, 0.39 - amount * 0.47];
    }
  } else if (movement === 'benchpress' || movement === 'chestfly') {
    pose.hip = [0, 0.85, -0.38];
    pose.shoulder = [0, 0.87, 0.48];
    pose.head = [0, 0.91, 0.94];
    for (const [side, sign] of [['left', -1], ['right', 1]]) {
      pose[`${side}Hip`] = [sign * 0.22, 0.85, -0.38];
      pose[`${side}Shoulder`] = [sign * 0.38, 0.87, 0.48];
      pose[`${side}Knee`] = [sign * 0.42, 0.75, -0.88];
      pose[`${side}Ankle`] = [sign * 0.48, 0.13, -1.04];
      pose[`${side}Elbow`] = [sign * (0.82 - amount * 0.43), 0.89 + amount * 0.46, 0.3];
      pose[`${side}Hand`] = [sign * (0.82 - amount * 0.46), 1.37 + amount * 0.43, 0.32];
      if (movement === 'chestfly') {
        const angle = amount * Math.PI / 2;
        pose[`${side}Elbow`] = [sign * (0.38 + Math.sin(angle) * 0.46), 0.87 + Math.cos(angle) * 0.46, 0.43];
        pose[`${side}Hand`] = [pose[`${side}Elbow`][0] + sign * Math.sin(angle - 0.22) * 0.45, pose[`${side}Elbow`][1] + Math.cos(angle - 0.22) * 0.45, 0.43];
      }
    }
  } else if (movement === 'latpulldown' || movement === 'cablerow') {
    const isLat = movement === 'latpulldown';
    const hipY = isLat ? 0.91 : 0.7;
    upperBody(hipY, hipY + 0.85, -0.15, -0.15);
    for (const [side, sign] of [['left', -1], ['right', 1]]) {
      pose[`${side}Knee`] = [sign * 0.26, isLat ? 0.85 : 0.52, 0.45];
      pose[`${side}Ankle`] = [sign * 0.28, 0.14, isLat ? 0.55 : 1.04];
      pose[`${side}Elbow`] = isLat
        ? [sign * (0.65 + amount * 0.08), 2.14 - amount * 0.69, 0.05]
        : [sign * 0.43, 1.26, 0.27 - amount * 0.59];
      pose[`${side}Hand`] = isLat
        ? [sign * 0.65, 2.63 - amount * 0.83, 0.21]
        : [sign * 0.22, 1.17, 0.73 - amount * 0.69];
    }
  } else if (movement === 'legpress') {
    pose.hip = [0, 0.65, -0.45];
    pose.shoulder = [0, 1.36, -0.94];
    pose.head = [0, 1.71, -1.19];
    for (const [side, sign] of [['left', -1], ['right', 1]]) {
      pose[`${side}Hip`] = [sign * 0.22, 0.65, -0.45];
      pose[`${side}Shoulder`] = [sign * 0.38, 1.36, -0.94];
      pose[`${side}Elbow`] = [sign * 0.47, 0.93, -0.87];
      pose[`${side}Hand`] = [sign * 0.5, 0.58, -0.53];
      pose[`${side}Knee`] = [sign * 0.28, 1.03 + amount * 0.02, -0.14 + amount * 0.33];
      pose[`${side}Ankle`] = [sign * 0.28, 1.04 + amount * 0.55, 0.4 + amount * 0.42];
    }
  } else if (movement === 'legextension' || movement === 'legcurl') {
    upperBody(0.86, 1.71, -0.35, -0.35);
    const angle = movement === 'legextension' ? -Math.PI / 2 + amount * Math.PI / 2 : -amount * Math.PI / 2;
    for (const [side, sign] of [['left', -1], ['right', 1]]) {
      pose[`${side}Knee`] = [sign * 0.25, 0.83, 0.27];
      pose[`${side}Ankle`] = [sign * 0.25, 0.83 + Math.sin(angle) * 0.64, 0.27 + Math.cos(angle) * 0.64];
      pose[`${side}Elbow`] = [sign * 0.45, 1.2, -0.29];
      pose[`${side}Hand`] = [sign * 0.49, 0.73, -0.17];
    }
  } else if (movement === 'frontraise') {
    const angle = -Math.PI / 2 + amount * Math.PI / 2;
    for (const [side, sign] of [['left', -1], ['right', 1]]) {
      pose[`${side}Elbow`] = [sign * 0.39, 2.08 + Math.sin(angle) * 0.49, Math.cos(angle) * 0.49];
      pose[`${side}Hand`] = [sign * 0.39, 2.08 + Math.sin(angle) * 0.94, Math.cos(angle) * 0.94 + 0.04];
    }
  } else if (movement === 'tricepsextension') {
    const angle = -0.7 + amount * 2.12;
    for (const [side, sign] of [['left', -1], ['right', 1]]) {
      pose[`${side}Elbow`] = [sign * 0.23, 2.51, -0.03];
      pose[`${side}Hand`] = [sign * 0.06, 2.52 + Math.sin(angle) * 0.48, -0.08 - Math.cos(angle) * 0.48];
    }
  } else if (movement === 'calfraise') {
    Object.values(pose).forEach((joint) => { joint[1] += amount * 0.18; });
  } else if (movement === 'lateralraise') {
    const angle = -Math.PI / 2 + amount * Math.PI / 2;
    for (const [side, sign] of [['left', -1], ['right', 1]]) {
      pose[`${side}Elbow`] = [sign * (0.39 + Math.cos(angle) * 0.49), 2.08 + Math.sin(angle) * 0.49, 0.04];
      pose[`${side}Hand`] = [sign * (0.39 + Math.cos(angle) * 0.94), 2.08 + Math.sin(angle) * 0.9, 0.12];
    }
  } else if (movement === 'tricepspushdown') {
    const angle = -amount * Math.PI * 0.48;
    for (const [side, sign] of [['left', -1], ['right', 1]]) {
      pose[`${side}Elbow`] = [sign * 0.4, 1.61, 0.12];
      pose[`${side}Hand`] = [sign * 0.24, 1.61 + Math.sin(angle) * 0.48, 0.12 + Math.cos(angle) * 0.48];
    }
  } else if (movement === 'deadlift') {
    upperBody(1.27 - amount * 0.12, 2.12 - amount * 0.56, -amount * 0.4, amount * 0.31);
    pose.head = [0, pose.shoulder[1] + 0.4 - amount * 0.17, pose.shoulder[2] + amount * 0.25];
    for (const [side, sign] of [['left', -1], ['right', 1]]) {
      pose[`${side}Knee`] = [sign * 0.25, 0.69 - amount * 0.04, 0.03 + amount * 0.1];
      pose[`${side}Elbow`] = [sign * 0.42, pose.shoulder[1] - 0.53, pose.shoulder[2] + 0.09];
      pose[`${side}Hand`] = [sign * 0.42, pose.shoulder[1] - 0.98, pose.shoulder[2] + 0.1];
    }
  } else if (movement === 'bridge') {
    pose.hip = [0, 0.31 + amount * 0.47, -0.26];
    pose.shoulder = [0, 0.25, 0.56];
    pose.head = [0, 0.23, 1.01];
    for (const [side, sign] of [['left', -1], ['right', 1]]) {
      pose[`${side}Hip`] = [sign * 0.22, pose.hip[1], -0.26];
      pose[`${side}Shoulder`] = [sign * 0.38, 0.25, 0.56];
      pose[`${side}Elbow`] = [sign * 0.43, 0.12, 0.1];
      pose[`${side}Hand`] = [sign * 0.45, 0.12, -0.35];
      pose[`${side}Knee`] = [sign * 0.25, 0.7 + amount * 0.12, -0.69];
      pose[`${side}Ankle`] = [sign * 0.27, 0.13, -1.11];
    }
  } else if (movement === 'crunch') {
    supine();
    pose.shoulder = [0, 0.25 + amount * 0.23, 0.56 - amount * 0.06];
    pose.head = [0, 0.23 + amount * 0.39, 1 - amount * 0.14];
    for (const [side, sign] of [['left', -1], ['right', 1]]) {
      pose[`${side}Shoulder`] = [sign * 0.35, pose.shoulder[1], pose.shoulder[2]];
      pose[`${side}Elbow`] = [sign * 0.5, pose.shoulder[1] + 0.02, pose.shoulder[2] - 0.42];
      pose[`${side}Hand`] = [-sign * 0.02, pose.shoulder[1] + 0.12, pose.shoulder[2] - 0.28];
    }
  } else if (movement === 'reversecrunch') {
    supine();
    pose.hip = [0, 0.28 + amount * 0.18, -0.27 + amount * 0.12];
    for (const [side, sign] of [['left', -1], ['right', 1]]) {
      pose[`${side}Hip`] = [sign * 0.22, pose.hip[1], pose.hip[2]];
      pose[`${side}Knee`] = [sign * 0.25, 0.87 + amount * 0.16, -0.35 + amount * 0.34];
      pose[`${side}Ankle`] = [sign * 0.25, 0.86 + amount * 0.28, -0.98 + amount * 0.43];
    }
  } else if (movement === 'deadbug') {
    supine();
    const phase = ((time * 0.35) % 2 + 2) % 2;
    const extendingLeg = phase < 1 ? 'left' : 'right';
    const extension = (1 - Math.cos((phase % 1) * Math.PI * 2)) / 2;
    for (const [side, sign] of [['left', -1], ['right', 1]]) {
      const legAmount = side === extendingLeg ? extension : 0;
      const armAmount = side !== extendingLeg ? extension : 0;
      const legAngle = Math.PI / 2 - legAmount * (Math.PI / 2 - 0.15);
      const armAngle = armAmount * 1.4;
      pose[`${side}Knee`] = [sign * 0.25, 0.28 + Math.sin(legAngle) * 0.6, -0.27 - Math.cos(legAngle) * 0.6];
      pose[`${side}Ankle`] = [sign * 0.25, pose[`${side}Knee`][1] - legAmount * 0.12, pose[`${side}Knee`][2] - 0.61];
      pose[`${side}Elbow`] = [sign * 0.35, 0.25 + Math.cos(armAngle) * 0.47, 0.56 + Math.sin(armAngle) * 0.47];
      pose[`${side}Hand`] = [sign * 0.35, 0.25 + Math.cos(armAngle) * 0.91, 0.56 + Math.sin(armAngle) * 0.91];
    }
  } else if (movement === 'bicyclecrunch') {
    supine();
    const turn = Math.sin(time * Math.PI * 0.7);
    pose.shoulder = [0, 0.5, 0.51];
    pose.head = [-turn * 0.05, 0.73, 0.87];
    for (const [side, sign] of [['left', -1], ['right', 1]]) {
      const tuck = (1 - sign * turn) / 2;
      pose[`${side}Shoulder`] = [sign * 0.3, 0.5 + sign * turn * 0.07, 0.51 - sign * turn * 0.12];
      pose[`${side}Knee`] = [sign * 0.24, 0.37 + tuck * 0.56, -0.79 + tuck * 0.7];
      pose[`${side}Ankle`] = [sign * 0.25, 0.2 + tuck * 0.4, -1.34 + tuck * 0.66];
      pose[`${side}Elbow`] = [sign * 0.36 - turn * 0.41, 0.6 + sign * turn * 0.05, 0.49 - sign * turn * 0.12];
      pose[`${side}Hand`] = [sign * 0.15 - turn * 0.03, 0.76, 0.8];
    }
  } else if (movement === 'heeltap') {
    supine();
    const reach = Math.sin(time * Math.PI * 0.7);
    pose.shoulder = [reach * 0.16, 0.42, 0.44];
    pose.head = [reach * 0.18, 0.56, 0.83];
    for (const [side, sign] of [['left', -1], ['right', 1]]) {
      pose[`${side}Shoulder`] = [sign * 0.35 + reach * 0.16, 0.42, 0.44 - sign * reach * 0.08];
      pose[`${side}Ankle`] = [sign * 0.27, 0.13, -0.76];
      pose[`${side}Elbow`] = [sign * 0.45 + reach * 0.08, 0.23, -sign * reach * 0.1];
      pose[`${side}Hand`] = [sign * 0.46, 0.17, -0.43 - sign * reach * 0.18];
    }
  } else if (movement === 'mountainclimber') {
    Object.assign(pose, getExercisePose('pushup', 0, 'Bodyweight'));
    const step = Math.sin(time * Math.PI * 0.7);
    for (const [side, sign] of [['left', -1], ['right', 1]]) {
      const tuck = Math.max(0, -sign * step);
      pose[`${side}Knee`] = [sign * 0.22, 0.38 + tuck * 0.1, -0.96 + tuck * 1.25];
      pose[`${side}Ankle`] = [sign * 0.22, 0.13 + tuck * 0.22, -1.54 + tuck * 1.24];
    }
  } else if (movement === 'cablecrunch') {
    upperBody(0.87, 1.64 - amount * 0.47, -0.25, 0.05 + amount * 0.37);
    pose.head = [0, 2.06 - amount * 0.73, 0.09 + amount * 0.68];
    for (const [side, sign] of [['left', -1], ['right', 1]]) {
      pose[`${side}Knee`] = [sign * 0.25, 0.15, 0.06];
      pose[`${side}Ankle`] = [sign * 0.25, 0.13, -0.61];
      pose[`${side}Hand`] = [sign * 0.15, pose.head[1] - 0.12, pose.head[2] - 0.03];
      const shoulder = pose[`${side}Shoulder`];
      const hand = pose[`${side}Hand`];
      const arm = hand.map((value, index) => value - shoulder[index]);
      const reach = Math.hypot(...arm);
      const bend = Math.sqrt(Math.max(0, 0.46 ** 2 - (reach / 2) ** 2));
      const direction = [0, -arm[2], arm[1]];
      const directionLength = Math.hypot(...direction) || 1;
      pose[`${side}Elbow`] = shoulder.map((value, index) => (value + hand[index]) / 2 + direction[index] / directionLength * bend);
    }
  } else if (movement === 'jumpingjack') {
    const lift = Math.sin(amount * Math.PI) * 0.14;
    upperBody(1.27 + lift, 2.12 + lift);
    for (const [side, sign] of [['left', -1], ['right', 1]]) {
      const angle = -Math.PI / 2 + amount * Math.PI * 0.86;
      pose[`${side}Elbow`] = [sign * (0.39 + Math.cos(angle) * 0.5), 2.08 + lift + Math.sin(angle) * 0.5, 0];
      pose[`${side}Hand`] = [sign * (0.39 + Math.cos(angle) * 0.94), 2.08 + lift + Math.sin(angle) * 0.94, 0];
      pose[`${side}Knee`] = [sign * (0.24 + amount * 0.2), 0.69 + lift * 0.5, 0];
      pose[`${side}Ankle`] = [sign * (0.25 + amount * 0.49), 0.13 + lift * 0.3, 0];
    }
  }
  if (movement === 'squat' && /sumo/i.test(exerciseName)) {
    for (const side of ['left', 'right']) {
      pose[`${side}Ankle`][0] *= 1.7;
      pose[`${side}Knee`][0] *= 1.5;
    }
  }
  if (movement === 'pushup' && /wide|narrow/i.test(exerciseName)) {
    const width = /wide/i.test(exerciseName) ? 1.45 : 0.77;
    for (const side of ['left', 'right']) {
      pose[`${side}Hand`][0] *= width;
      pose[`${side}Elbow`][0] *= width;
    }
  }
  if (movement === 'benchpress' && /incline/i.test(equipment || '')) {
    pose.shoulder = [0, 1.3, 0.36];
    pose.head = [0, 1.52, 0.76];
    for (const [side, sign] of [['left', -1], ['right', 1]]) {
      pose[`${side}Shoulder`] = [sign * 0.38, 1.3, 0.36];
      pose[`${side}Elbow`][1] += 0.43;
      pose[`${side}Elbow`][2] -= 0.12;
      pose[`${side}Hand`][1] += 0.43;
      pose[`${side}Hand`][2] -= 0.12;
    }
  }
  if (movement === 'press' && /bench/i.test(equipment || '')) {
    for (const [key, joint] of Object.entries(pose)) {
      if (!/Knee|Ankle/.test(key)) joint[1] -= 0.48;
    }
    for (const [side, sign] of [['left', -1], ['right', 1]]) {
      pose[`${side}Knee`] = [sign * 0.25, 0.73, 0.55];
      pose[`${side}Ankle`] = [sign * 0.27, 0.13, 0.68];
    }
  }
  if (movement === 'row' && /single-arm/i.test(exerciseName)) {
    pose.leftAnkle = [-0.26, 0.13, 0.61];
    pose.leftKnee = [-0.25, 0.69, 0.46];
    pose.rightAnkle = [0.26, 0.13, -0.3];
    pose.leftElbow = [-0.36, 1.14, 0.36];
    pose.leftHand = [-0.25, 0.81, 0.44];
  }
  return pose;
}

export function getEquipmentProps(movement, pose, equipment = '') {
  const lines = [];
  const panels = [];
  const line = (from, to, radius = 0.045, color = '#627361') => lines.push({ from, to, radius, color });
  const panel = (points, color = '#788a71') => panels.push({ points, color });
  const bench = (height, fromZ, toZ, width = 0.42) => {
    panel([[-width, height, fromZ], [width, height, fromZ], [width, height, toZ], [-width, height, toZ]]);
    for (const x of [-width * 0.8, width * 0.8]) {
      for (const z of [fromZ + 0.12, toZ - 0.12]) line([x, 0.02, z], [x, height, z], 0.055);
    }
  };
  const cable = (from, to) => line(from, to, 0.014, '#344c3f');
  const centerHand = pose.leftHand.map((value, index) => (value + pose.rightHand[index]) / 2);
  if (['crunch', 'reversecrunch', 'deadbug', 'bicyclecrunch', 'heeltap', 'mountainclimber'].includes(movement)) {
    panel([[-0.78, 0.025, -1.75], [0.78, 0.025, -1.75], [0.78, 0.025, 1.75], [-0.78, 0.025, 1.75]], '#ccd8bc');
  }
  if (movement === 'cablecrunch') {
    panel([[-0.7, 0.025, -0.95], [0.7, 0.025, -0.95], [0.7, 0.025, 0.48], [-0.7, 0.025, 0.48]], '#ccd8bc');
    for (const x of [-0.71, 0.71]) line([x, 0.025, 1.38], [x, 2.92, 1.38], 0.065);
    line([-0.71, 2.92, 1.38], [0.71, 2.92, 1.38], 0.065);
    line([0, 2.92, 1.38], [0, 2.92, 1.05], 0.045);
    const ropeJunction = [centerHand[0], centerHand[1] + 0.15, centerHand[2] + 0.08];
    cable([0, 2.92, 1.05], ropeJunction);
    line(ropeJunction, pose.leftHand, 0.025, '#344c3f');
    line(ropeJunction, pose.rightHand, 0.025, '#344c3f');
  }
  if (movement === 'benchpress' && /incline/i.test(equipment)) {
    bench(0.68, -0.7, -0.33);
    panel([[-0.42, 0.68, -0.38], [0.42, 0.68, -0.38], [0.42, 1.52, 1.12], [-0.42, 1.52, 1.12]]);
    line([0, 0.05, 0.84], [0, 1.35, 0.84], 0.055);
  } else if (movement === 'benchpress' || movement === 'chestfly') bench(0.68, -0.6, 1.2);
  if (movement === 'press' && /bench/i.test(equipment)) {
    bench(0.6, -0.3, 0.39);
    panel([[-0.42, 0.6, -0.23], [0.42, 0.6, -0.23], [0.42, 1.93, -0.23], [-0.42, 1.93, -0.23]]);
  }
  if (movement === 'curl' && /cable/i.test(equipment)) {
    for (const x of [-0.62, 0.62]) line([x, 0.03, 1.12], [x, 2.48, 1.12], 0.06);
    line([-0.62, 2.48, 1.12], [0.62, 2.48, 1.12], 0.06);
    line(pose.leftHand, pose.rightHand, 0.035, '#2b4036');
    cable([0, 0.16, 1.12], centerHand);
  }
  if (movement === 'legextension' || movement === 'legcurl') {
    bench(0.66, -0.69, 0.3);
    panel([[-0.45, 0.66, -0.59], [0.45, 0.66, -0.59], [0.45, 1.81, -0.59], [-0.45, 1.81, -0.59]]);
    const [, y, z] = pose.leftAnkle;
    const rollerZ = z + (movement === 'legextension' ? 0.1 : -0.09);
    line([-0.57, y, rollerZ], [0.57, y, rollerZ], 0.1, '#405b46');
    for (const x of [-0.59, 0.59]) {
      line([x, 0.12, -0.07], [x, 0.83, 0.27], 0.055);
      line([x, 0.83, 0.27], [x, y, rollerZ], 0.045);
    }
    if (movement === 'legcurl') line([-0.5, 1.0, 0.15], [0.5, 1.0, 0.15], 0.085, '#405b46');
  }
  if (movement === 'latpulldown') {
    bench(0.71, -0.49, 0.26);
    line([-0.8, 0.02, -0.62], [-0.8, 3.23, -0.62], 0.07);
    line([0.8, 0.02, -0.62], [0.8, 3.23, -0.62], 0.07);
    line([-0.8, 3.23, -0.62], [0.8, 3.23, -0.62], 0.07);
    line([0, 3.23, -0.62], [0, 3.23, 0.21], 0.06);
    line([-0.85, centerHand[1], centerHand[2]], [0.85, centerHand[1], centerHand[2]], 0.035, '#2b4036');
    line([-0.5, 0.99, 0.25], [0.5, 0.99, 0.25], 0.08);
    cable([0, 3.23, 0.21], centerHand);
  }
  if (movement === 'cablerow') {
    bench(0.52, -0.58, 0.11);
    line([-0.65, 0.02, 1.5], [-0.65, 1.7, 1.5], 0.06);
    line([0.65, 0.02, 1.5], [0.65, 1.7, 1.5], 0.06);
    line([-0.65, 1.7, 1.5], [0.65, 1.7, 1.5], 0.06);
    line(pose.leftHand, pose.rightHand, 0.035, '#2b4036');
    panel([[-0.54, 0.05, 1.18], [0.54, 0.05, 1.18], [0.54, 0.38, 1.35], [-0.54, 0.38, 1.35]]);
    cable([0, 0.87, 1.5], centerHand);
  }
  if (movement === 'legpress') {
    bench(0.46, -0.68, -0.08, 0.46);
    panel([[-0.46, 0.47, -0.68], [0.46, 0.47, -0.68], [0.46, 1.63, -1.49], [-0.46, 1.63, -1.49]]);
    for (const x of [-0.74, 0.74]) line([x, 0.45, 0.01], [x, 2.06, 1.24], 0.065);
    const [, y, z] = pose.leftAnkle;
    panel([[-0.65, y - 0.25, z + 0.33], [0.65, y - 0.25, z + 0.33], [0.65, y + 0.3, z - 0.1], [-0.65, y + 0.3, z - 0.1]], '#556b54');
  }
  if (movement === 'tricepspushdown') {
    for (const x of [-0.66, 0.66]) line([x, 0.02, 1.13], [x, 3.1, 1.13], 0.065);
    line([-0.66, 3.1, 1.13], [0.66, 3.1, 1.13], 0.065);
    line([0, 3.1, 1.13], [0, 3.1, 0.63], 0.045);
    line(pose.leftHand, pose.rightHand, 0.035, '#2b4036');
    cable([0, 3.1, 0.63], centerHand);
  }
  return { lines, panels };
}

export function getWeightAttachments(movement, pose, equipment, exerciseName = '') {
  if (!usesWeights(movement, equipment)) return [];
  if (movement === 'squat' || movement === 'tricepsextension') {
    return [{ position: pose.leftHand.map((value, index) => (value + pose.rightHand[index]) / 2), axis: [0, 1, 0] }];
  }
  const hands = movement === 'row' && /single-arm/i.test(exerciseName) ? ['rightHand'] : ['leftHand', 'rightHand'];
  const axis = /hammer/i.test(exerciseName) || movement === 'chestfly' ? [0, 0, 1] : [1, 0, 0];
  return hands.map((hand) => ({ position: pose[hand], axis }));
}

function FallbackPreview({ movement, name, equipment, playingRef, speedRef, viewRef }) {
  const [frame, setFrame] = useState({ pose: getExercisePose(movement, 0, equipment, name), angle: 0.5 });
  useEffect(() => {
    let request;
    let lastTime;
    let lastPaint = 0;
    let elapsed = 0;
    const animate = (time) => {
      if (lastTime !== undefined && playingRef.current) elapsed += Math.min((time - lastTime) / 1000, 0.06) * speedRef.current;
      lastTime = time;
      if (time - lastPaint > 45) {
        setFrame({ pose: getExercisePose(movement, elapsed, equipment, name), angle: viewRef.current });
        lastPaint = time;
      }
      request = requestAnimationFrame(animate);
    };
    request = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(request);
  }, [movement, name, equipment, playingRef, speedRef, viewRef]);
  const project = ([x, y, z]) => [250 + (x * Math.cos(frame.angle) + z * Math.sin(frame.angle)) * 72, 265 - y * 72 + (z * Math.cos(frame.angle) - x * Math.sin(frame.angle)) * 12];
  const point = (name) => project(frame.pose[name]);
  const head = point('head');
  const body = ['leftShoulder', 'rightShoulder', 'rightHip', 'leftHip'].map((name) => point(name).join(',')).join(' ');
  const props = getEquipmentProps(movement, frame.pose, equipment);
  const handWeights = getWeightAttachments(movement, frame.pose, equipment, name);
  return (
    <svg className="exercise-demo__fallback" viewBox="0 0 500 300" role="img" aria-label={`Animated ${movement} movement illustration`}>
      <ellipse cx="250" cy="266" rx="138" ry="24" fill="#d7e0cc" />
      {[205, 225, 245, 265, 285].map((y) => <path key={y} d={`M 50 ${y} H 450`} stroke="#dde4d5" strokeWidth="1" />)}
      {props.panels.map(({ points, color }, index) => <polygon key={`panel-${index}`} points={points.map((item) => project(item).join(',')).join(' ')} fill={color} stroke="#53674f" strokeWidth="3" strokeLinejoin="round" />)}
      {props.lines.map(({ from, to, radius, color }, index) => {
        const a = project(from); const b = project(to);
        return <line key={`prop-${index}`} x1={a[0]} y1={a[1]} x2={b[0]} y2={b[1]} stroke={color} strokeWidth={Math.max(1.5, radius * 130)} strokeLinecap="round" />;
      })}
      {movement === 'pushup' && /bench|household support/i.test(equipment || '') && <g>
        {[-0.59, 0.59].flatMap((x) => [0.4, 0.8].map((z) => {
          const top = project([x, 0.78, z]); const bottom = project([x, 0.02, z]);
          return <line key={`${x}-${z}`} x1={top[0]} y1={top[1]} x2={bottom[0]} y2={bottom[1]} stroke="#506051" strokeWidth="6" />;
        }))}
        <polygon points={[[-0.7, 0.83, 0.32], [0.7, 0.83, 0.32], [0.7, 0.83, 0.9], [-0.7, 0.83, 0.9]].map((point) => project(point).join(',')).join(' ')} fill="#71826b" stroke="#506051" strokeWidth="5" strokeLinejoin="round" />
      </g>}
      {SEGMENTS.map(([from, to]) => {
        const a = point(from); const b = point(to);
        return <line key={`${from}-${to}`} x1={a[0]} y1={a[1]} x2={b[0]} y2={b[1]} stroke="#356c59" strokeWidth={from.includes('Hip') || from.includes('Knee') ? 16 : 12} strokeLinecap="round" />;
      })}
      <polygon points={body} fill="#477d65" stroke="#356c59" strokeWidth="5" strokeLinejoin="round" />
      {['leftElbow', 'rightElbow', 'leftKnee', 'rightKnee'].map((name) => {
        const joint = point(name);
        return <circle key={name} cx={joint[0]} cy={joint[1]} r="6" fill="#649074" />;
      })}
      <circle cx={head[0]} cy={head[1]} r="17" fill="#b9cba3" />
      {['leftAnkle', 'rightAnkle'].map((name) => {
        const foot = point(name);
        if (movement === 'calfraise') {
          const ankle = frame.pose[name];
          const toe = project([ankle[0], 0.09, ankle[2] + 0.24]);
          return <line key={name} x1={foot[0]} y1={foot[1]} x2={toe[0]} y2={toe[1]} stroke="#faf9ee" strokeWidth="12" strokeLinecap="round" />;
        }
        return <rect key={name} x={foot[0] - 9} y={foot[1] - 5} width="24" height="12" rx="5" fill="#faf9ee" />;
      })}
      {handWeights.map(({ position, axis }, index) => {
        const a = project(position.map((value, axisIndex) => value - axis[axisIndex] * 0.17));
        const b = project(position.map((value, axisIndex) => value + axis[axisIndex] * 0.17));
        const length = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
        const perpendicular = [-(b[1] - a[1]) / length * 7, (b[0] - a[0]) / length * 7];
        return <g key={index} stroke="#263e33" strokeWidth="5" strokeLinecap="round">
          <line x1={a[0]} y1={a[1]} x2={b[0]} y2={b[1]} />
          {[a, b].map((end, endIndex) => <line key={endIndex} x1={end[0] - perpendicular[0]} y1={end[1] - perpendicular[1]} x2={end[0] + perpendicular[0]} y2={end[1] + perpendicular[1]} />)}
        </g>;
      })}
    </svg>
  );
}

export default function ExerciseDemo({ movement = 'squat', name = 'Squat', equipment = undefined }) {
  const normalized = String(movement).toLowerCase().replace(/[^a-z]/g, '');
  const activeMovement = MOVEMENTS.has(normalized) ? normalized : 'squat';
  const mountRef = useRef(null);
  const [playing, setPlaying] = useState(() => typeof window === 'undefined' || !window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  const [speed, setSpeed] = useState(1);
  const [fallback, setFallback] = useState(false);
  const playingRef = useRef(playing);
  const speedRef = useRef(speed);
  const viewRef = useRef(0.57);
  useEffect(() => { playingRef.current = playing; }, [playing]);
  useEffect(() => { speedRef.current = speed; }, [speed]);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return undefined;
    let renderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'low-power' });
    } catch {
      setFallback(true);
      return undefined;
    }
    setFallback(false);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.domElement.setAttribute('aria-label', `3D ${name} movement demonstration`);
    renderer.domElement.setAttribute('role', 'img');
    mount.appendChild(renderer.domElement);
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(38, 1, 0.1, 30);
    scene.add(new THREE.HemisphereLight(0xfffef1, 0x708064, 2.7));
    const light = new THREE.DirectionalLight(0xfffdf0, 3.2);
    light.position.set(-3, 6, 4);
    light.castShadow = true;
    light.shadow.mapSize.set(1024, 1024);
    light.shadow.camera.left = -3;
    light.shadow.camera.right = 3;
    light.shadow.camera.top = 4;
    light.shadow.camera.bottom = -3;
    light.shadow.normalBias = 0.025;
    scene.add(light);
    const bodyMaterial = new THREE.MeshStandardMaterial({ color: 0x3c765c, roughness: 0.77, flatShading: true });
    const jointMaterial = new THREE.MeshStandardMaterial({ color: 0x74966b, roughness: 0.83 });
    const headMaterial = new THREE.MeshStandardMaterial({ color: 0xbace9f, roughness: 0.83, flatShading: true });
    const shoeMaterial = new THREE.MeshStandardMaterial({ color: 0xf7f4e6, roughness: 0.85 });
    const weightMaterial = new THREE.MeshStandardMaterial({ color: 0x293e34, roughness: 0.68, metalness: 0.2 });
    const platform = new THREE.Mesh(new THREE.CylinderGeometry(1.9, 1.95, 0.05, 64), new THREE.MeshStandardMaterial({ color: 0xe1e8d6, roughness: 1 }));
    platform.position.y = -0.045;
    platform.receiveShadow = true;
    scene.add(platform);
    const grid = new THREE.GridHelper(6, 20, 0xd7e0cb, 0xd7e0cb);
    grid.material.transparent = true;
    grid.material.opacity = 0.55;
    grid.position.y = -0.065;
    scene.add(grid);
    if (activeMovement === 'pushup' && /bench|household support/i.test(equipment || '')) {
      const benchMaterial = new THREE.MeshStandardMaterial({ color: 0x71826b, roughness: 0.9 });
      const benchTop = new THREE.Mesh(new THREE.BoxGeometry(1.4, 0.1, 0.58), benchMaterial);
      benchTop.position.set(0, 0.78, 0.61);
      benchTop.castShadow = true;
      benchTop.receiveShadow = true;
      scene.add(benchTop);
      [-0.59, 0.59].forEach((x) => [0.4, 0.8].forEach((z) => {
        const leg = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.73, 0.07), weightMaterial);
        leg.position.set(x, 0.365, z);
        leg.castShadow = true;
        scene.add(leg);
      }));
    }
    const initialProps = getEquipmentProps(activeMovement, getExercisePose(activeMovement, 0, equipment, name), equipment);
    const machineLines = initialProps.lines.map(({ radius, color }) => {
      const mesh = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, 1, 10), new THREE.MeshStandardMaterial({ color, roughness: 0.7, metalness: 0.15 }));
      mesh.castShadow = true;
      scene.add(mesh);
      return mesh;
    });
    const machinePanels = initialProps.panels.map(({ color }) => {
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(18), 3));
      const mesh = new THREE.Mesh(geometry, new THREE.MeshStandardMaterial({ color, roughness: 0.85, side: THREE.DoubleSide }));
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      scene.add(mesh);
      return mesh;
    });
    const figure = new THREE.Group();
    scene.add(figure);
    const segmentMeshes = SEGMENTS.map(([from, to]) => {
      const leg = from.includes('Hip') || from.includes('Knee');
      const mesh = new THREE.Mesh(new THREE.CylinderGeometry(leg ? 0.13 : 0.09, leg ? 0.105 : 0.073, 1, 10), bodyMaterial);
      mesh.castShadow = true;
      figure.add(mesh);
      return { from, to, mesh };
    });
    const torso = new THREE.Mesh(new THREE.CylinderGeometry(0.37, 0.25, 1, 8), bodyMaterial);
    torso.castShadow = true;
    figure.add(torso);
    const hips = new THREE.Mesh(new THREE.SphereGeometry(0.29, 12, 8), bodyMaterial);
    hips.scale.set(1, 0.68, 0.75);
    figure.add(hips);
    const head = new THREE.Mesh(new THREE.IcosahedronGeometry(0.235, 2), headMaterial);
    head.scale.set(0.86, 1.07, 0.93);
    head.castShadow = true;
    figure.add(head);
    const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.095, 0.1, 1, 10), jointMaterial);
    figure.add(neck);
    const jointNames = [...new Set(SEGMENTS.flat())].filter((key) => !key.includes('Hip'));
    const joints = jointNames.map((key) => {
      const mesh = new THREE.Mesh(new THREE.SphereGeometry(key.includes('Knee') ? 0.115 : 0.092, 10, 8), jointMaterial);
      figure.add(mesh);
      return { key, mesh };
    });
    const feet = ['leftAnkle', 'rightAnkle'].map((key) => {
      const mesh = new THREE.Mesh(new THREE.CapsuleGeometry(0.105, 0.19, 4, 8), shoeMaterial);
      mesh.rotation.x = Math.PI / 2;
      mesh.scale.z = 0.7;
      mesh.castShadow = true;
      figure.add(mesh);
      return { key, mesh };
    });
    const weights = ['leftHand', 'rightHand'].map((key) => {
      const group = new THREE.Group();
      const bar = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.35, 8), weightMaterial);
      bar.rotation.z = Math.PI / 2;
      group.add(bar);
      [-0.17, 0.17].forEach((x) => {
        const plate = new THREE.Mesh(new THREE.CylinderGeometry(0.115, 0.115, 0.1, 8), weightMaterial);
        plate.rotation.z = Math.PI / 2;
        plate.position.x = x;
        plate.castShadow = true;
        group.add(plate);
      });
      group.visible = false;
      figure.add(group);
      return { key, group };
    });
    const up = new THREE.Vector3(0, 1, 0);
    const start = new THREE.Vector3();
    const end = new THREE.Vector3();
    const direction = new THREE.Vector3();
    const setSegment = (mesh, from, to, depthScale = 1) => {
      start.fromArray(from);
      end.fromArray(to);
      direction.subVectors(end, start);
      mesh.position.copy(start).add(end).multiplyScalar(0.5);
      mesh.scale.set(1, direction.length(), depthScale);
      mesh.quaternion.setFromUnitVectors(up, direction.normalize());
    };
    const resize = () => {
      const width = mount.clientWidth || 500;
      const height = mount.clientHeight || 300;
      renderer.setSize(width, height);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
    };
    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(mount);
    resize();
    let frameId;
    let previous;
    let elapsed = 0;
    let angle = viewRef.current;
    let disposed = false;
    const animate = (time) => {
      if (disposed) return;
      if (previous !== undefined && playingRef.current) elapsed += Math.min((time - previous) / 1000, 0.06) * speedRef.current;
      previous = time;
      const pose = getExercisePose(activeMovement, elapsed, equipment, name);
      const equipmentProps = getEquipmentProps(activeMovement, pose, equipment);
      machineLines.forEach((mesh, index) => setSegment(mesh, equipmentProps.lines[index].from, equipmentProps.lines[index].to));
      machinePanels.forEach((mesh, index) => {
        const points = equipmentProps.panels[index].points;
        const positions = mesh.geometry.attributes.position;
        [0, 1, 2, 0, 2, 3].forEach((point, vertex) => positions.setXYZ(vertex, ...points[point]));
        positions.needsUpdate = true;
        mesh.geometry.computeVertexNormals();
        mesh.geometry.computeBoundingSphere();
      });
      segmentMeshes.forEach(({ from, to, mesh }) => setSegment(mesh, pose[from], pose[to]));
      setSegment(torso, pose.hip, pose.shoulder, 0.65);
      hips.position.fromArray(pose.hip);
      head.position.fromArray(pose.head);
      const neckEnd = pose.head.map((value, index) => value + (index === 1 ? -0.12 : 0));
      setSegment(neck, pose.shoulder, neckEnd);
      joints.forEach(({ key, mesh }) => mesh.position.fromArray(pose[key]));
      feet.forEach(({ key, mesh }) => {
        if (activeMovement === 'calfraise') {
          const ankle = pose[key];
          setSegment(mesh, [ankle[0], ankle[1] - 0.04, ankle[2] - 0.03], [ankle[0], 0.09, ankle[2] + 0.24], 0.7);
          mesh.scale.y /= 0.4;
        } else {
          mesh.position.fromArray(pose[key]);
          mesh.position.z += 0.08;
          mesh.position.y -= 0.04;
        }
      });
      const handWeights = getWeightAttachments(activeMovement, pose, equipment, name);
      weights.forEach(({ group }, index) => {
        const attachment = handWeights[index];
        group.visible = Boolean(attachment);
        if (attachment) {
          group.position.fromArray(attachment.position);
          group.rotation.set(0, attachment.axis[2] ? Math.PI / 2 : 0, attachment.axis[1] ? Math.PI / 2 : 0);
        }
      });
      angle += (viewRef.current - angle) * 0.085;
      const floorMovement = ['pushup', 'plank', 'bridge', 'benchpress', 'chestfly', 'crunch', 'reversecrunch', 'deadbug', 'bicyclecrunch', 'heeltap', 'mountainclimber'].includes(activeMovement);
      const incline = activeMovement === 'pushup' && /bench|household support/i.test(equipment || '');
      const tallMachine = ['latpulldown', 'tricepspushdown', 'cablecrunch'].includes(activeMovement);
      const radius = Math.max(tallMachine ? 6.8 : 5.65, 3.7 / Math.max(camera.aspect, 0.6));
      camera.position.set(Math.sin(angle) * radius, floorMovement ? 3.1 : 2.85, Math.cos(angle) * radius);
      camera.lookAt(0, incline || activeMovement === 'benchpress' || activeMovement === 'chestfly' ? 0.95 : floorMovement ? 0.55 : 1.48, 0);
      renderer.render(scene, camera);
      frameId = requestAnimationFrame(animate);
    };
    const onContextLost = (event) => {
      event.preventDefault();
      cancelAnimationFrame(frameId);
      setFallback(true);
    };
    renderer.domElement.addEventListener('webglcontextlost', onContextLost);
    frameId = requestAnimationFrame(animate);
    return () => {
      disposed = true;
      cancelAnimationFrame(frameId);
      resizeObserver.disconnect();
      renderer.domElement.removeEventListener('webglcontextlost', onContextLost);
      const geometries = new Set();
      const materials = new Set();
      scene.traverse((object) => {
        if (object.geometry) geometries.add(object.geometry);
        if (object.material) (Array.isArray(object.material) ? object.material : [object.material]).forEach((material) => materials.add(material));
      });
      geometries.forEach((geometry) => geometry.dispose());
      materials.forEach((material) => material.dispose());
      light.shadow.dispose();
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, [activeMovement, name, equipment]);

  return (
    <section className="exercise-demo" aria-label={`${name} movement preview`}>
      <div className="exercise-demo__stage">
        <div className="exercise-demo__label"><span /> Movement preview</div>
        <span className="exercise-demo__dimension">{fallback ? 'ILLUSTRATED' : '3D'}</span>
        <div ref={mountRef} className={`exercise-demo__canvas${fallback ? ' exercise-demo__canvas--hidden' : ''}`} />
        {fallback && <FallbackPreview movement={activeMovement} name={name} equipment={equipment} playingRef={playingRef} speedRef={speedRef} viewRef={viewRef} />}
        <span className="exercise-demo__floor-label">MOVE WITH INTENTION</span>
      </div>
      <div className="exercise-demo__controls">
        <button className="exercise-demo__play" type="button" onClick={() => setPlaying((value) => !value)} aria-label={playing ? 'Pause movement demo' : 'Play movement demo'}>
          {playing ? <Pause size={15} fill="currentColor" /> : <Play size={15} fill="currentColor" />}
          {playing ? 'Pause' : 'Play'}
        </button>
        <button className="exercise-demo__rotate" type="button" onClick={() => { viewRef.current += Math.PI / 4; }} aria-label="Rotate movement preview 45 degrees">
          <RotateCw size={15} /> <span>Rotate view</span>
        </button>
        <label className="exercise-demo__speed"><span>Speed</span><select value={speed} onChange={(event) => setSpeed(Number(event.target.value))} aria-label="Movement playback speed"><option value={0.5}>0.5×</option><option value={1}>1×</option><option value={1.5}>1.5×</option></select></label>
      </div>
      <p className="exercise-demo__cue">{activeMovement === 'press' && /bodyweight/i.test(equipment || '') ? 'Reach gently overhead. Relax your shoulders and breathe.' : CUES[activeMovement]}</p>
    </section>
  );
}
