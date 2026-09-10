import { useEffect, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { Pause, Play, RotateCw, Scan } from 'lucide-react';
import './ExerciseDemo.css';

export const SUPPORTED_MOVEMENTS = ['squat', 'pushup', 'curl', 'press', 'lunge', 'plank', 'row', 'jumpingjack', 'benchpress', 'latpulldown', 'cablerow', 'legpress', 'lateralraise', 'tricepspushdown', 'deadlift', 'bridge', 'chestfly', 'frontraise', 'tricepsextension', 'legextension', 'legcurl', 'calfraise', 'crunch', 'reversecrunch', 'deadbug', 'bicyclecrunch', 'heeltap', 'mountainclimber', 'cablecrunch', 'birddog', 'sideplank', 'legraise', 'superman', 'facepull'];
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
  birddog: 'Reach with your opposite arm and leg. Keep your hips level.',
  sideplank: 'Stack your hips and shoulders. Press gently through your supporting forearm.',
  legraise: 'Lower your legs only as far as you can keep your back supported.',
  superman: 'Lift your arms and legs a little. Keep your gaze toward the mat.',
  facepull: 'Draw the rope toward your face. Keep your shoulders relaxed.',
};

export function getAvatarStyle(gender) {
  const kind = gender === 'woman' || gender === 'man' ? gender : 'neutral';
  return {
    kind,
    skin: '#c68f6c',
    hair: '#342c29',
    top: kind === 'woman' ? '#70806a' : '#38574c',
    bottoms: '#303c39',
    chestWidth: kind === 'man' ? 0.37 : kind === 'woman' ? 0.32 : 0.345,
    waistWidth: kind === 'woman' ? 0.235 : kind === 'man' ? 0.275 : 0.255,
    hipWidth: kind === 'woman' ? 0.32 : 0.30,
    limbScale: kind === 'man' ? 1.07 : kind === 'woman' ? 0.94 : 1,
    leggings: kind === 'woman',
  };
}

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
  } else if (movement === 'birddog') {
    pose.hip = [0, 0.83, -0.37];
    pose.shoulder = [0, 0.84, 0.49];
    pose.head = [0, 0.83, 0.91];
    const phase = ((time * 0.35) % 2 + 2) % 2;
    const activeLeg = phase < 1 ? 'left' : 'right';
    const extension = (1 - Math.cos((phase % 1) * Math.PI * 2)) / 2;
    for (const [side, sign] of [['left', -1], ['right', 1]]) {
      const leg = side === activeLeg ? extension : 0;
      const arm = side !== activeLeg ? extension : 0;
      pose[`${side}Hip`] = [sign * 0.22, 0.83, -0.37];
      pose[`${side}Shoulder`] = [sign * 0.35, 0.84, 0.49];
      pose[`${side}Knee`] = [sign * 0.22, 0.15 + leg * 0.65, -0.37 - leg * 0.60];
      pose[`${side}Ankle`] = [sign * 0.22, 0.12 + leg * 0.66, -0.98 - leg * 0.6];
      pose[`${side}Elbow`] = [sign * 0.35, 0.47 + arm * 0.38, 0.51 + arm * 0.45];
      pose[`${side}Hand`] = [sign * 0.35, 0.1 + arm * 0.75, 0.54 + arm * 0.89];
    }
  } else if (movement === 'sideplank') {
    pose.hip = [0, 0.61, -0.29];
    pose.shoulder = [0, 0.85, 0.53];
    pose.head = [0, 0.95, 0.96];
    pose.leftHip = [0, 0.40, -0.29]; pose.rightHip = [0, 0.82, -0.29];
    pose.leftShoulder = [0, 0.48, 0.53]; pose.rightShoulder = [0, 1.22, 0.53];
    pose.leftElbow = [0, 0.11, 0.54]; pose.leftHand = [0.46, 0.10, 0.55];
    pose.rightElbow = [0.05, 1.17, 0.07]; pose.rightHand = [0.03, 0.82, -0.28];
    pose.leftKnee = [0, 0.23, -0.90]; pose.rightKnee = [0, 0.43, -0.91];
    pose.leftAnkle = [0, 0.10, -1.48]; pose.rightAnkle = [0, 0.27, -1.47];
  } else if (movement === 'legraise') {
    supine();
    const angle = 0.15 + amount * 1.25;
    for (const [side, sign] of [['left', -1], ['right', 1]]) {
      pose[`${side}Knee`] = [sign * 0.16, 0.28 + Math.sin(angle) * 0.61, -0.27 - Math.cos(angle) * 0.61];
      pose[`${side}Ankle`] = [sign * 0.16, 0.28 + Math.sin(angle) * 1.20, -0.27 - Math.cos(angle) * 1.20];
    }
  } else if (movement === 'superman') {
    pose.hip = [0, 0.22, -0.27]; pose.shoulder = [0, 0.23 + amount * 0.14, 0.57];
    pose.head = [0, 0.24 + amount * 0.2, 0.98];
    for (const [side, sign] of [['left', -1], ['right', 1]]) {
      pose[`${side}Hip`] = [sign * 0.21, 0.22, -0.27];
      pose[`${side}Shoulder`] = [sign * 0.34, pose.shoulder[1], 0.57];
      pose[`${side}Elbow`] = [sign * 0.36, 0.17 + amount * 0.25, 1.03];
      pose[`${side}Hand`] = [sign * 0.37, 0.13 + amount * 0.35, 1.48];
      pose[`${side}Knee`] = [sign * 0.2, 0.15 + amount * 0.12, -0.88];
      pose[`${side}Ankle`] = [sign * 0.19, 0.12 + amount * 0.25, -1.46];
    }
  } else if (movement === 'facepull') {
    for (const [side, sign] of [['left', -1], ['right', 1]]) {
      pose[`${side}Elbow`] = [sign * (0.37 + amount * 0.36), 2.09 + amount * 0.02, 0.47 - amount * 0.49];
      pose[`${side}Hand`] = [sign * (0.15 + amount * 0.28), 2.17 + amount * 0.16, 0.94 - amount * 0.82];
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
  if (movement === 'pushup' && /knee/i.test(exerciseName)) {
    pose.hip[1] -= 0.07;
    for (const [side, sign] of [['left', -1], ['right', 1]]) {
      pose[`${side}Hip`][1] = pose.hip[1];
      pose[`${side}Knee`] = [sign * 0.23, 0.13, -0.85];
      pose[`${side}Ankle`] = [sign * 0.23, 0.22, -1.43];
    }
  }
  if (movement === 'pushup' && /wall/i.test(exerciseName)) {
    upperBody(1.25, 2.05, 0.12 + amount * 0.2, 0.4 + amount * 0.31);
    pose.head = [0, 2.45, 0.52 + amount * 0.3];
    for (const [side, sign] of [['left', -1], ['right', 1]]) {
      pose[`${side}Knee`] = [sign * 0.25, 0.68, 0.04 + amount * 0.1];
      pose[`${side}Ankle`] = [sign * 0.25, 0.13, -0.08];
      pose[`${side}Elbow`] = [sign * (0.43 + amount * 0.14), 1.9, 0.76];
      pose[`${side}Hand`] = [sign * 0.42, 2.08, 1.18];
    }
  }
  if (movement === 'plank' && /household support|bench/i.test(equipment || '')) {
    Object.assign(pose, getExercisePose('pushup', 0.45, 'Stable household support', 'Incline push-up'));
    for (const [side, sign] of [['left', -1], ['right', 1]]) {
      pose[`${side}Elbow`] = [sign * 0.39, 0.87, 0.4];
      pose[`${side}Hand`] = [sign * 0.39, 0.87, 0.86];
    }
  }
  if (movement === 'squat' && /barbell/i.test(equipment || '')) {
    for (const [side, sign] of [['left', -1], ['right', 1]]) {
      pose[`${side}Hand`] = [sign * 0.64, pose.shoulder[1] + 0.06, pose.shoulder[2] - 0.16];
      pose[`${side}Elbow`] = [sign * 0.69, pose.shoulder[1] - 0.34, pose.shoulder[2] - 0.2];
    }
  }
  if (movement === 'benchpress' && /barbell/i.test(equipment || '')) {
    for (const [side, sign] of [['left', -1], ['right', 1]]) {
      pose[`${side}Hand`][0] = sign * 0.62;
      pose[`${side}Elbow`][0] = sign * (0.75 - amount * 0.22);
    }
  }
  if (movement === 'curl' && /bench/i.test(equipment || '')) {
    for (const [key, joint] of Object.entries(pose)) if (!/Knee|Ankle/.test(key)) joint[1] -= 0.48;
    for (const [side, sign] of [['left', -1], ['right', 1]]) {
      pose[`${side}Knee`] = [sign * 0.27, 0.73, 0.52];
      pose[`${side}Ankle`] = [sign * 0.29, 0.13, 0.61];
    }
  }
  if (movement === 'bridge' && /single-leg/i.test(exerciseName)) {
    pose.rightKnee = [0.2, pose.hip[1] + 0.55, -0.47];
    pose.rightAnkle = [0.2, pose.hip[1] + 1.09, -0.68];
  }
  if (movement === 'bridge' && /bench/i.test(equipment || '')) {
    pose.shoulder[1] = 0.79; pose.head[1] = 0.82;
    pose.hip[1] = 0.43 + amount * 0.4;
    for (const [side, sign] of [['left', -1], ['right', 1]]) {
      pose[`${side}Hip`][1] = pose.hip[1]; pose[`${side}Shoulder`][1] = 0.79;
      pose[`${side}Knee`] = [sign * 0.28, 0.69, -0.87];
      pose[`${side}Ankle`] = [sign * 0.30, 0.13, -0.94];
      pose[`${side}Elbow`] = [sign * 0.42, 0.52 + amount * 0.18, 0.12];
      pose[`${side}Hand`] = [sign * 0.18, pose.hip[1] + 0.16, -0.26];
    }
  }
  if (movement === 'latpulldown' && /neutral-grip/i.test(exerciseName)) {
    for (const [side, sign] of [['left', -1], ['right', 1]]) {
      pose[`${side}Hand`][0] = sign * 0.23;
      pose[`${side}Elbow`][0] = sign * (0.37 + amount * 0.07);
    }
  }
  if (movement === 'cablerow' && /wide-grip/i.test(exerciseName)) {
    for (const [side, sign] of [['left', -1], ['right', 1]]) {
      pose[`${side}Hand`][0] = sign * 0.53;
      pose[`${side}Elbow`][0] = sign * 0.66;
    }
  }
  return pose;
}

export function getEquipmentProps(movement, pose, equipment = '', exerciseName = '') {
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
  if (['crunch', 'reversecrunch', 'deadbug', 'bicyclecrunch', 'heeltap', 'mountainclimber', 'birddog', 'sideplank', 'legraise', 'superman', 'bridge', 'plank'].includes(movement) && !/bench|household support/i.test(equipment)) {
    panel([[-0.78, 0.025, -1.75], [0.78, 0.025, -1.75], [0.78, 0.025, 1.75], [-0.78, 0.025, 1.75]], '#ccd8bc');
  }
  if (movement === 'pushup' && /wall/i.test(exerciseName)) {
    panel([[-1, 0.02, 1.26], [1, 0.02, 1.26], [1, 2.83, 1.26], [-1, 2.83, 1.26]], '#d5dace');
  } else if (['pushup', 'plank'].includes(movement) && /bench|household support/i.test(equipment)) bench(0.80, 0.30, 1.02, 0.7);
  if (movement === 'squat' && /chair/i.test(exerciseName)) bench(0.52, -0.78, -0.25, 0.42);
  if (movement === 'bridge' && /bench/i.test(equipment)) bench(0.60, 0.32, 1.22, 0.53);
  if (movement === 'curl' && /bench/i.test(equipment)) bench(0.60, -0.36, 0.30, 0.41);
  if (movement === 'facepull') {
    for (const x of [-0.66, 0.66]) line([x, 0.02, 1.5], [x, 2.85, 1.5], 0.065);
    line([-0.66, 2.85, 1.5], [0.66, 2.85, 1.5], 0.065);
    const junction = [0, centerHand[1], centerHand[2] + 0.2];
    cable([0, 2.3, 1.5], junction);
    line(junction, pose.leftHand, 0.025, '#344c3f');
    line(junction, pose.rightHand, 0.025, '#344c3f');
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
    if (/neutral-grip/i.test(exerciseName)) {
      line(pose.leftHand, pose.rightHand, 0.035, '#2b4036');
      for (const hand of [pose.leftHand, pose.rightHand]) line([hand[0], hand[1], hand[2] - 0.12], [hand[0], hand[1], hand[2] + 0.12], 0.035, '#2b4036');
    } else line([-0.85, centerHand[1], centerHand[2]], [0.85, centerHand[1], centerHand[2]], 0.035, '#2b4036');
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
    if (/rope/i.test(exerciseName)) {
      const junction = [centerHand[0], centerHand[1] + 0.18, centerHand[2]];
      line(junction, pose.leftHand, 0.025, '#344c3f');
      line(junction, pose.rightHand, 0.025, '#344c3f');
      cable([0, 3.1, 0.63], junction);
    } else {
      line(pose.leftHand, pose.rightHand, 0.035, '#2b4036');
      cable([0, 3.1, 0.63], centerHand);
    }
  }
  return { lines, panels };
}

export function getWeightAttachments(movement, pose, equipment, exerciseName = '') {
  if (/barbell/i.test(equipment || '')) {
    return [{ position: pose.leftHand.map((value, index) => (value + pose.rightHand[index]) / 2), axis: [1, 0, 0], kind: 'barbell' }];
  }
  if (!usesWeights(movement, equipment)) return [];
  if (movement === 'bridge') return [{ position: [0, pose.hip[1] + 0.16, pose.hip[2]], axis: [1, 0, 0] }];
  if (movement === 'squat' || movement === 'tricepsextension') {
    return [{ position: pose.leftHand.map((value, index) => (value + pose.rightHand[index]) / 2), axis: [0, 1, 0] }];
  }
  const hands = movement === 'row' && /single-arm/i.test(exerciseName) ? ['rightHand'] : ['leftHand', 'rightHand'];
  const axis = /hammer/i.test(exerciseName) || movement === 'chestfly' ? [0, 0, 1] : [1, 0, 0];
  return hands.map((hand) => ({ position: pose[hand], axis }));
}

function FallbackPreview({ movement, name, equipment, gender, playingRef, speedRef, viewRef, zoomRef }) {
  const [frame, setFrame] = useState({ pose: getExercisePose(movement, 0, equipment, name), angle: 0.5 });
  const pointersRef = useRef(new Map());
  const avatar = getAvatarStyle(gender);
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
  const project = ([x, y, z]) => [250 + (x * Math.cos(frame.angle) + z * Math.sin(frame.angle)) * 72 * zoomRef.current, 265 - y * 72 * zoomRef.current + (z * Math.cos(frame.angle) - x * Math.sin(frame.angle)) * 12 * zoomRef.current];
  const point = (name) => project(frame.pose[name]);
  const headAxis = frame.pose.head.map((value, index) => value - frame.pose.shoulder[index]);
  const headDistance = Math.hypot(...headAxis) || 1;
  const head = project(frame.pose.head.map((value, index) => value - headAxis[index] / headDistance * 0.09));
  const body = ['leftShoulder', 'rightShoulder', 'rightHip', 'leftHip'].map((name) => point(name).join(',')).join(' ');
  const props = getEquipmentProps(movement, frame.pose, equipment, name);
  const handWeights = getWeightAttachments(movement, frame.pose, equipment, name);
  const drag = (event) => {
    const previous = pointersRef.current.get(event.pointerId);
    if (!previous) return;
    viewRef.current += (event.clientX - previous[0]) * 0.012;
    pointersRef.current.set(event.pointerId, [event.clientX, event.clientY]);
  };
  return (
    <svg className="exercise-demo__fallback" viewBox="0 0 500 300" role="img" aria-label={`Animated ${name} movement illustration. Drag to rotate.`} data-avatar={avatar.kind} data-azimuth={frame.angle.toFixed(4)} onPointerDown={(event) => { event.currentTarget.setPointerCapture(event.pointerId); pointersRef.current.set(event.pointerId, [event.clientX, event.clientY]); }} onPointerMove={drag} onPointerUp={(event) => pointersRef.current.delete(event.pointerId)} onPointerCancel={(event) => pointersRef.current.delete(event.pointerId)}>
      <ellipse cx="250" cy="266" rx="138" ry="24" fill="#d7e0cc" />
      {[205, 225, 245, 265, 285].map((y) => <path key={y} d={`M 50 ${y} H 450`} stroke="#dde4d5" strokeWidth="1" />)}
      {props.panels.map(({ points, color }, index) => <polygon key={`panel-${index}`} points={points.map((item) => project(item).join(',')).join(' ')} fill={color} stroke="#53674f" strokeWidth="3" strokeLinejoin="round" />)}
      {props.lines.map(({ from, to, radius, color }, index) => {
        const a = project(from); const b = project(to);
        return <line key={`prop-${index}`} x1={a[0]} y1={a[1]} x2={b[0]} y2={b[1]} stroke={color} strokeWidth={Math.max(1.5, radius * 130)} strokeLinecap="round" />;
      })}
      {SEGMENTS.map(([from, to]) => {
        const a = point(from); const b = point(to);
        const upperLeg = from.includes('Hip'); const lowerLeg = from.includes('Knee');
        return <line key={`${from}-${to}`} x1={a[0]} y1={a[1]} x2={b[0]} y2={b[1]} stroke={upperLeg || (lowerLeg && avatar.leggings) ? avatar.bottoms : avatar.skin} strokeWidth={(upperLeg ? 17 : lowerLeg ? 12 : 10) * avatar.limbScale} strokeLinecap="round" />;
      })}
      <polygon points={body} fill={avatar.top} stroke={avatar.top} strokeWidth="6" strokeLinejoin="round" />
      <line x1={point('shoulder')[0]} y1={point('shoulder')[1]} x2={head[0]} y2={head[1]} stroke={avatar.skin} strokeWidth="8" />
      {['leftElbow', 'rightElbow', 'leftKnee', 'rightKnee'].map((name) => {
        const joint = point(name);
        return <circle key={name} cx={joint[0]} cy={joint[1]} r="5" fill={name.includes('Knee') && avatar.leggings ? avatar.bottoms : avatar.skin} />;
      })}
      <ellipse cx={head[0]} cy={head[1]} rx="11.5" ry="14.5" fill={avatar.skin} />
      <path d={`M ${head[0] - 11.5} ${head[1] - 4} A 11.5 12 0 0 1 ${head[0] + 11.5} ${head[1] - 4} L ${head[0] + 8} ${head[1] - 9} Q ${head[0]} ${head[1] - 13} ${head[0] - 11.5} ${head[1] - 4}`} fill={avatar.hair} />
      {avatar.kind === 'woman' && <circle cx={head[0] - 8} cy={head[1] - 12} r="5" fill={avatar.hair} />}
      {['leftAnkle', 'rightAnkle'].map((name) => {
        const foot = point(name);
        if (movement === 'calfraise') {
          const ankle = frame.pose[name];
          const toe = project([ankle[0], 0.09, ankle[2] + 0.24]);
          return <line key={name} x1={foot[0]} y1={foot[1]} x2={toe[0]} y2={toe[1]} stroke="#faf9ee" strokeWidth="12" strokeLinecap="round" />;
        }
        return <rect key={name} x={foot[0] - 9} y={foot[1] - 5} width="24" height="12" rx="5" fill="#faf9ee" />;
      })}
      {handWeights.map(({ position, axis, kind }, index) => {
        const half = kind === 'barbell' ? 1.05 : 0.17;
        const a = project(position.map((value, axisIndex) => value - axis[axisIndex] * half));
        const b = project(position.map((value, axisIndex) => value + axis[axisIndex] * half));
        const length = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
        const plateSize = kind === 'barbell' ? 17 : 7;
        const perpendicular = [-(b[1] - a[1]) / length * plateSize, (b[0] - a[0]) / length * plateSize];
        return <g key={index} stroke="#263e33" strokeWidth="5" strokeLinecap="round">
          <line x1={a[0]} y1={a[1]} x2={b[0]} y2={b[1]} />
          {[a, b].map((end, endIndex) => <line key={endIndex} x1={end[0] - perpendicular[0]} y1={end[1] - perpendicular[1]} x2={end[0] + perpendicular[0]} y2={end[1] + perpendicular[1]} />)}
        </g>;
      })}
    </svg>
  );
}

function createHumanFigure(scene, avatar) {
  const figure = new THREE.Group();
  figure.name = `athletic-human-${avatar.kind}`;
  scene.add(figure);
  const skin = new THREE.MeshStandardMaterial({ color: avatar.skin, roughness: 0.82 });
  const top = new THREE.MeshStandardMaterial({ color: avatar.top, roughness: 0.94 });
  const bottoms = new THREE.MeshStandardMaterial({ color: avatar.bottoms, roughness: 0.94 });
  const hair = new THREE.MeshStandardMaterial({ color: avatar.hair, roughness: 1 });
  const shoe = new THREE.MeshStandardMaterial({ color: '#f2efe6', roughness: 0.8 });
  const sole = new THREE.MeshStandardMaterial({ color: '#d6d9ce', roughness: 0.96 });
  const trim = new THREE.MeshStandardMaterial({ color: '#b2c39b', roughness: 0.88 });
  const faceDetail = new THREE.MeshStandardMaterial({ color: '#4a3930', roughness: 1 });
  const eyeWhite = new THREE.MeshStandardMaterial({ color: '#e1d6c8', roughness: 0.9 });
  const up = new THREE.Vector3(0, 1, 0);
  const axisX = new THREE.Vector3(); const axisY = new THREE.Vector3(); const axisZ = new THREE.Vector3();
  const matrix = new THREE.Matrix4();
  const a = new THREE.Vector3(); const b = new THREE.Vector3(); const direction = new THREE.Vector3();
  const sphereGeometry = new THREE.SphereGeometry(1, 20, 14);
  function ellipsoid(parent, material, scale, position = [0, 0, 0]) {
    const mesh = new THREE.Mesh(sphereGeometry, material);
    mesh.scale.fromArray(scale); mesh.position.fromArray(position); mesh.castShadow = true;
    parent.add(mesh); return mesh;
  }
  function taperedLimb(upper, lower, material) {
    const points = [[0, -0.515], [upper * 0.66, -0.49], [upper, -0.35], [upper * 0.94, -0.08], [lower * 1.03, 0.31], [lower * 0.7, 0.48], [0, 0.515]].map(([radius, y]) => new THREE.Vector2(radius, y));
    const mesh = new THREE.Mesh(new THREE.LatheGeometry(points, 20), material);
    mesh.castShadow = true; figure.add(mesh); return mesh;
  }
  function connect(mesh, from, to) {
    a.fromArray(from); b.fromArray(to); direction.subVectors(b, a);
    mesh.position.copy(a).add(b).multiplyScalar(0.5);
    mesh.scale.set(1, direction.length(), 1);
    mesh.quaternion.setFromUnitVectors(up, direction.normalize());
  }
  const limbs = SEGMENTS.map(([from, to]) => {
    const thigh = from.includes('Hip'); const calf = from.includes('Knee'); const upperArm = from.includes('Shoulder');
    const upper = (thigh ? 0.148 : calf ? 0.106 : upperArm ? 0.107 : 0.081) * avatar.limbScale;
    const lower = (thigh ? 0.103 : calf ? 0.059 : upperArm ? 0.074 : 0.046) * avatar.limbScale;
    const mesh = taperedLimb(upper, lower, (thigh || calf) && avatar.leggings ? bottoms : skin);
    const shorts = thigh && !avatar.leggings ? taperedLimb(upper * 1.1, upper * 0.97, bottoms) : null;
    let sleeve = null;
    if (upperArm && avatar.kind !== 'woman') {
      sleeve = new THREE.Mesh(new THREE.CylinderGeometry(upper * 1.03, upper * 1.15, 1, 20, 1, true), top);
      sleeve.name = `${from}Sleeve`;
      sleeve.castShadow = true;
      figure.add(sleeve);
    }
    return { from, to, mesh, shorts, sleeve };
  });
  const torsoGroup = new THREE.Group(); torsoGroup.name = 'torso'; figure.add(torsoGroup);
  const torsoPoints = [[avatar.hipWidth * 0.79, 0], [avatar.waistWidth, 0.16], [avatar.waistWidth * 0.98, 0.32], [avatar.chestWidth * 0.92, 0.58], [avatar.chestWidth, 0.80], [avatar.chestWidth * 0.97, 0.94], [avatar.chestWidth * 0.72, 1.015], [0.12, 1.07]].map(([radius, y]) => new THREE.Vector2(radius, y));
  const torso = new THREE.Mesh(new THREE.LatheGeometry(torsoPoints, 28), top);
  torso.scale.z = 0.64; torso.castShadow = true; torsoGroup.add(torso);
  const hips = ellipsoid(figure, bottoms, [avatar.hipWidth, 0.19, 0.195]);
  const neck = taperedLimb(0.075, 0.068, skin);
  const shoulderBridges = ['leftShoulder', 'rightShoulder'].map((key) => ({ key, mesh: taperedLimb(0.084, 0.105 * avatar.limbScale, avatar.kind === 'woman' ? skin : top) }));
  const jointMeshes = ['leftShoulder', 'rightShoulder', 'leftElbow', 'rightElbow', 'leftKnee', 'rightKnee'].map((key) => {
    const shoulder = key.includes('Shoulder'); const knee = key.includes('Knee');
    const material = shoulder && avatar.kind !== 'woman' ? top : knee && avatar.leggings ? bottoms : skin;
    const radius = (shoulder ? 0.105 : knee ? 0.093 : 0.069) * avatar.limbScale;
    return { key, mesh: ellipsoid(figure, material, [radius, radius, radius * 0.95]) };
  });
  const hands = ['leftHand', 'rightHand'].map((key, index) => {
    const group = new THREE.Group(); group.name = key; figure.add(group);
    ellipsoid(group, skin, [0.06, 0.084, 0.037]);
    ellipsoid(group, skin, [0.025, 0.048, 0.024], [(index ? -1 : 1) * 0.055, 0.006, 0.021]);
    for (const x of [-0.037, -0.012, 0.013, 0.038]) ellipsoid(group, skin, [0.013, 0.035, 0.021], [x, -0.057, 0.016]);
    const wrist = ellipsoid(figure, skin, [0.045, 0.05, 0.042]);
    wrist.visible = false;
    return { key, group, wrist };
  });
  const headGroup = new THREE.Group(); headGroup.name = 'head'; figure.add(headGroup);
  ellipsoid(headGroup, skin, [0.165, 0.215, 0.169]);
  ellipsoid(headGroup, skin, [0.113, 0.091, 0.126], [0, -0.11, 0.023]);
  ellipsoid(headGroup, skin, [0.027, 0.039, 0.028], [0, 0.008, 0.165]);
  [-1, 1].forEach((side) => {
    ellipsoid(headGroup, skin, [0.025, 0.047, 0.025], [side * 0.162, -0.002, -0.002]);
    ellipsoid(headGroup, eyeWhite, [0.03, 0.012, 0.008], [side * 0.059, 0.045, 0.152]);
    ellipsoid(headGroup, faceDetail, [0.010, 0.010, 0.006], [side * 0.059, 0.044, 0.159]);
    ellipsoid(headGroup, hair, [0.031, 0.007, 0.007], [side * 0.059, 0.071, 0.149]);
  });
  ellipsoid(headGroup, faceDetail, [0.038, 0.005, 0.006], [0, -0.073, 0.149]);
  const scalp = new THREE.Mesh(new THREE.SphereGeometry(1, 24, 14, 0, Math.PI * 2, 0, Math.PI * 0.55), hair);
  scalp.scale.set(0.169, 0.216, 0.172); scalp.position.set(0, 0.023, -0.011); scalp.castShadow = true; headGroup.add(scalp);
  if (avatar.kind === 'woman') {
    ellipsoid(headGroup, hair, [0.091, 0.087, 0.099], [0, 0.108, -0.188]);
    ellipsoid(headGroup, trim, [0.067, 0.05, 0.025], [0, 0.096, -0.164]);
  } else {
    ellipsoid(headGroup, hair, [0.116, 0.068, 0.128], [0, 0.18, 0.015]);
  }
  const feet = ['leftAnkle', 'rightAnkle'].map((key) => {
    const group = new THREE.Group(); group.name = key; figure.add(group);
    ellipsoid(group, sole, [0.109, 0.025, 0.207], [0, -0.105, 0.079]);
    ellipsoid(group, shoe, [0.099, 0.067, 0.187], [0, -0.06, 0.074]);
    ellipsoid(group, trim, [0.079, 0.043, 0.042], [0, -0.035, -0.07]);
    for (const z of [0.04, 0.07, 0.10]) ellipsoid(group, sole, [0.064, 0.006, 0.009], [0, 0.005, z]);
    return { key, group };
  });
  const supineMovements = new Set(['benchpress', 'chestfly', 'bridge', 'crunch', 'reversecrunch', 'deadbug', 'bicyclecrunch', 'heeltap', 'legraise']);
  function orient(group, along, across, faceUp = false) {
    axisY.fromArray(along).normalize();
    axisX.fromArray(across).projectOnPlane(axisY).normalize();
    if (faceUp) axisX.negate();
    axisZ.crossVectors(axisX, axisY).normalize();
    matrix.makeBasis(axisX, axisY, axisZ); group.quaternion.setFromRotationMatrix(matrix);
  }
  return {
    update(pose, movement) {
      const bodyAxis = pose.shoulder.map((value, index) => value - pose.hip[index]);
      const across = pose.rightShoulder.map((value, index) => value - pose.leftShoulder[index]);
      const faceUp = supineMovements.has(movement);
      torsoGroup.position.fromArray(pose.hip);
      orient(torsoGroup, bodyAxis, across, faceUp);
      torsoGroup.scale.set(1, Math.hypot(...bodyAxis), 1);
      hips.position.fromArray(pose.hip); hips.quaternion.copy(torsoGroup.quaternion);
      limbs.forEach(({ from, to, mesh, shorts, sleeve }) => {
        connect(mesh, pose[from], pose[to]);
        if (shorts) connect(shorts, pose[from], pose[from].map((value, index) => value + (pose[to][index] - value) * 0.64));
        if (sleeve) connect(sleeve, pose[from], pose[from].map((value, index) => value + (pose[to][index] - value) * 0.46));
      });
      jointMeshes.forEach(({ key, mesh }) => mesh.position.fromArray(pose[key]));
      const headAxis = pose.head.map((value, index) => value - pose.shoulder[index]);
      const headDistance = Math.hypot(...headAxis) || 1;
      const visualHead = pose.head.map((value, index) => value - headAxis[index] / headDistance * 0.09);
      const neckEnd = visualHead.map((value, index) => value - headAxis[index] / headDistance * 0.16);
      connect(neck, pose.shoulder, neckEnd);
      shoulderBridges.forEach(({ key, mesh }) => {
        const inner = pose.shoulder.map((value, index) => value + (pose[key][index] - value) * 0.25 + headAxis[index] / headDistance * 0.04);
        connect(mesh, inner, pose[key]);
      });
      headGroup.position.fromArray(visualHead); orient(headGroup, headAxis, across, faceUp);
      hands.forEach(({ key, group, wrist }) => {
        group.position.fromArray(pose[key]);
        direction.fromArray(pose[key.replace('Hand', 'Elbow')]).sub(a.fromArray(pose[key])).normalize();
        group.quaternion.setFromUnitVectors(up, direction);
        const supporting = ['pushup', 'plank', 'mountainclimber'].includes(movement) || (['birddog', 'sideplank'].includes(movement) && pose[key][1] < 0.25);
        wrist.visible = supporting;
        if (supporting) {
          const wall = movement === 'pushup' && pose[key][1] > 1.6;
          group.rotation.set(wall ? 0 : -Math.PI / 2, 0, wall ? Math.PI : 0);
          if (wall) group.position.z += 0.04;
          else { group.position.y -= 0.055; group.position.z += 0.035; }
          a.fromArray(pose[key]);
          direction.copy(group.position).sub(a);
          wrist.position.copy(a).add(group.position).multiplyScalar(0.5);
          wrist.scale.set(0.045, direction.length() / 2 + 0.027, 0.042);
          wrist.quaternion.setFromUnitVectors(up, direction.normalize());
        }
      });
      feet.forEach(({ key, group }) => {
        group.position.fromArray(pose[key]); group.rotation.set(0, 0, 0);
        if (movement === 'calfraise') group.rotation.x = Math.atan2(pose[key][1] - 0.13, 0.24);
        else if (pose[key][1] > 0.32) {
          direction.fromArray(pose[key.replace('Ankle', 'Knee')]).sub(a.fromArray(pose[key])).normalize();
          group.quaternion.setFromUnitVectors(up, direction);
        } else if (['pushup', 'plank', 'mountainclimber', 'birddog', 'superman'].includes(movement)) group.rotation.x = 0.85;
      });
    },
  };
}

export default function ExerciseDemo({ movement = 'squat', name = 'Squat', equipment = undefined, gender = null }) {
  const normalized = String(movement).toLowerCase().replace(/[^a-z]/g, '');
  const activeMovement = MOVEMENTS.has(normalized) ? normalized : 'squat';
  const avatar = getAvatarStyle(gender);
  const mountRef = useRef(null);
  const [playing, setPlaying] = useState(() => typeof window === 'undefined' || !window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  const [speed, setSpeed] = useState(1);
  const [fallback, setFallback] = useState(false);
  const playingRef = useRef(playing);
  const speedRef = useRef(speed);
  const viewRef = useRef(0.57);
  const zoomRef = useRef(1);
  const cameraActionsRef = useRef(null);
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
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.12;
    renderer.domElement.setAttribute('aria-label', `3D ${name} movement demonstration. Drag to rotate, pinch to zoom. Arrow keys rotate; plus and minus zoom; Home resets the view.`);
    renderer.domElement.setAttribute('role', 'img');
    renderer.domElement.tabIndex = 0;
    renderer.domElement.dataset.avatar = avatar.kind;
    mount.appendChild(renderer.domElement);
    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(36, 1, 0.1, 40);
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.075;
    controls.enablePan = false;
    controls.rotateSpeed = 0.68;
    controls.zoomSpeed = 0.7;
    controls.minPolarAngle = 0.18;
    controls.maxPolarAngle = Math.PI * 0.47;
    controls.minDistance = 2.8;
    controls.maxDistance = 14;
    controls.touches.ONE = THREE.TOUCH.ROTATE;
    controls.touches.TWO = THREE.TOUCH.DOLLY_PAN;
    controls.mouseButtons.LEFT = THREE.MOUSE.ROTATE;
    controls.mouseButtons.RIGHT = THREE.MOUSE.ROTATE;
    scene.add(new THREE.HemisphereLight(0xfff7eb, 0x809080, 2.1));
    const light = new THREE.DirectionalLight(0xfff8ed, 2.4);
    light.position.set(-3, 6, 4);
    light.castShadow = true;
    light.shadow.mapSize.set(512, 512);
    light.shadow.camera.left = -3;
    light.shadow.camera.right = 3;
    light.shadow.camera.top = 4;
    light.shadow.camera.bottom = -3;
    light.shadow.normalBias = 0.025;
    scene.add(light);
    const fill = new THREE.DirectionalLight(0xe4edfa, 1.1);
    fill.position.set(3, 3, -4); scene.add(fill);
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
    const initialProps = getEquipmentProps(activeMovement, getExercisePose(activeMovement, 0, equipment, name), equipment, name);
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
    const human = createHumanFigure(scene, avatar);
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
      scene.add(group);
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
    const floorMovement = ['pushup', 'plank', 'bridge', 'benchpress', 'chestfly', 'crunch', 'reversecrunch', 'deadbug', 'bicyclecrunch', 'heeltap', 'mountainclimber', 'birddog', 'sideplank', 'legraise', 'superman'].includes(activeMovement) && !/wall/i.test(name);
    const incline = ['pushup', 'plank'].includes(activeMovement) && /bench|household support/i.test(equipment || '') && !/wall/i.test(name);
    const tallMachine = ['latpulldown', 'tricepspushdown', 'cablecrunch', 'facepull'].includes(activeMovement);
    const targetHeight = incline || ['benchpress', 'chestfly'].includes(activeMovement) ? 0.98 : floorMovement ? 0.7 : 1.46;
    const cameraOffset = new THREE.Vector3();
    const spherical = new THREE.Spherical();
    let fitDistance = 6;
    const resetView = () => {
      controls.enableDamping = false;
      controls.update();
      controls.target.set(0, targetHeight, 0);
      const polar = floorMovement ? 1.04 : 1.32;
      cameraOffset.setFromSpherical(new THREE.Spherical(fitDistance, polar, /wall/i.test(name) ? 1.45 : 0.65));
      camera.position.copy(controls.target).add(cameraOffset);
      controls.update();
      controls.enableDamping = true;
      controls.saveState();
    };
    const orbitBy = (horizontal, vertical = 0, distanceFactor = 1) => {
      spherical.setFromVector3(cameraOffset.copy(camera.position).sub(controls.target));
      spherical.theta += horizontal;
      spherical.phi = Math.max(controls.minPolarAngle, Math.min(controls.maxPolarAngle, spherical.phi + vertical));
      spherical.radius = Math.max(controls.minDistance, Math.min(controls.maxDistance, spherical.radius * distanceFactor));
      camera.position.copy(controls.target).add(cameraOffset.setFromSpherical(spherical));
      controls.update();
    };
    const onCameraChange = () => {
      viewRef.current = controls.getAzimuthalAngle();
      renderer.domElement.dataset.azimuth = controls.getAzimuthalAngle().toFixed(4);
      renderer.domElement.dataset.polar = controls.getPolarAngle().toFixed(4);
      renderer.domElement.dataset.distance = camera.position.distanceTo(controls.target).toFixed(3);
    };
    const onInteractionStart = () => { renderer.domElement.dataset.interacting = 'true'; };
    const onInteractionEnd = () => { renderer.domElement.dataset.interacting = 'false'; };
    const onKeyDown = (event) => {
      const commands = { ArrowLeft: () => orbitBy(-0.14), ArrowRight: () => orbitBy(0.14), ArrowUp: () => orbitBy(0, -0.10), ArrowDown: () => orbitBy(0, 0.10), '+': () => orbitBy(0, 0, 0.9), '=': () => orbitBy(0, 0, 0.9), '-': () => orbitBy(0, 0, 1.1), Home: resetView };
      if (commands[event.key]) { event.preventDefault(); commands[event.key](); }
    };
    controls.addEventListener('change', onCameraChange);
    controls.addEventListener('start', onInteractionStart);
    controls.addEventListener('end', onInteractionEnd);
    renderer.domElement.addEventListener('keydown', onKeyDown);
    cameraActionsRef.current = { rotate: () => orbitBy(Math.PI / 4), reset: resetView };
    let sized = false;
    const resize = () => {
      const width = mount.clientWidth || 500;
      const height = mount.clientHeight || 300;
      renderer.setSize(width, height);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      const previousFit = fitDistance;
      fitDistance = Math.max(tallMachine ? 6.7 : 5.8, 3.75 / Math.max(camera.aspect, 0.55));
      if (!sized) { resetView(); sized = true; }
      else orbitBy(0, 0, fitDistance / previousFit);
    };
    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(mount);
    resize();
    let frameId;
    let previous;
    let elapsed = 0;
    let lastPoseTime = -1;
    let disposed = false;
    const animate = (time) => {
      if (disposed) return;
      if (previous !== undefined && playingRef.current) elapsed += Math.min((time - previous) / 1000, 0.06) * speedRef.current;
      previous = time;
      if (elapsed !== lastPoseTime) {
      const pose = getExercisePose(activeMovement, elapsed, equipment, name);
      const equipmentProps = getEquipmentProps(activeMovement, pose, equipment, name);
      machineLines.forEach((mesh, index) => setSegment(mesh, equipmentProps.lines[index].from, equipmentProps.lines[index].to));
      machinePanels.forEach((mesh, index) => {
        const points = equipmentProps.panels[index].points;
        const positions = mesh.geometry.attributes.position;
        [0, 1, 2, 0, 2, 3].forEach((point, vertex) => positions.setXYZ(vertex, ...points[point]));
        positions.needsUpdate = true;
        mesh.geometry.computeVertexNormals();
        mesh.geometry.computeBoundingSphere();
      });
      human.update(pose, activeMovement);
      const handWeights = getWeightAttachments(activeMovement, pose, equipment, name);
      weights.forEach(({ group }, index) => {
        const attachment = handWeights[index];
        group.visible = Boolean(attachment);
        if (attachment) {
          group.position.fromArray(attachment.position);
          group.rotation.set(0, attachment.axis[2] ? Math.PI / 2 : 0, attachment.axis[1] ? Math.PI / 2 : 0);
          const barbell = attachment.kind === 'barbell';
          group.children[0].scale.y = barbell ? 6.7 : 1;
          group.children.slice(1).forEach((plate, plateIndex) => {
            plate.position.x = (plateIndex ? 1 : -1) * (barbell ? 0.94 : 0.17);
            plate.scale.set(barbell ? 2.25 : 1, barbell ? 1.5 : 1, barbell ? 2.25 : 1);
          });
        }
      });
      lastPoseTime = elapsed;
      }
      controls.update();
      renderer.render(scene, camera);
      frameId = requestAnimationFrame(animate);
    };
    const onContextLost = (event) => {
      event.preventDefault();
      cancelAnimationFrame(frameId);
      controls.enabled = false;
      setFallback(true);
    };
    renderer.domElement.addEventListener('webglcontextlost', onContextLost);
    frameId = requestAnimationFrame(animate);
    return () => {
      disposed = true;
      cancelAnimationFrame(frameId);
      resizeObserver.disconnect();
      cameraActionsRef.current = null;
      controls.removeEventListener('change', onCameraChange);
      controls.removeEventListener('start', onInteractionStart);
      controls.removeEventListener('end', onInteractionEnd);
      controls.dispose();
      renderer.domElement.removeEventListener('keydown', onKeyDown);
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
  }, [activeMovement, name, equipment, avatar.kind]);

  return (
    <section className="exercise-demo" aria-label={`${name} movement preview`} data-avatar={avatar.kind} data-renderer={fallback ? 'illustration' : 'webgl'}>
      <div className="exercise-demo__stage">
        <div className="exercise-demo__label"><span /> Movement preview</div>
        <span className="exercise-demo__dimension">{fallback ? 'ILLUSTRATED' : '3D'}</span>
        <div ref={mountRef} className={`exercise-demo__canvas${fallback ? ' exercise-demo__canvas--hidden' : ''}`} />
        {fallback && <FallbackPreview movement={activeMovement} name={name} equipment={equipment} gender={gender} playingRef={playingRef} speedRef={speedRef} viewRef={viewRef} zoomRef={zoomRef} />}
        <span className="exercise-demo__floor-label">{fallback ? 'Drag to rotate the illustration' : 'Drag to rotate · Pinch to zoom'}</span>
      </div>
      <div className="exercise-demo__controls">
        <button className="exercise-demo__play" type="button" onClick={() => setPlaying((value) => !value)} aria-label={playing ? 'Pause movement demo' : 'Play movement demo'}>
          {playing ? <Pause size={15} fill="currentColor" /> : <Play size={15} fill="currentColor" />}
          {playing ? 'Pause' : 'Play'}
        </button>
        <button className="exercise-demo__rotate" type="button" onClick={() => { if (!fallback && cameraActionsRef.current) cameraActionsRef.current.rotate(); else viewRef.current += Math.PI / 4; }} aria-label="Rotate movement preview 45 degrees">
          <RotateCw size={15} /> <span>Rotate view</span>
        </button>
        <button className="exercise-demo__reset" type="button" onClick={() => { if (!fallback && cameraActionsRef.current) cameraActionsRef.current.reset(); else { viewRef.current = 0.57; zoomRef.current = 1; } }} aria-label="Reset movement view"><Scan size={15} /><span>Reset view</span></button>
        <label className="exercise-demo__speed"><span>Speed</span><select value={speed} onChange={(event) => setSpeed(Number(event.target.value))} aria-label="Movement playback speed"><option value={0.5}>0.5×</option><option value={1}>1×</option><option value={1.5}>1.5×</option></select></label>
      </div>
      <p className="exercise-demo__cue">{activeMovement === 'press' && /bodyweight/i.test(equipment || '') ? 'Reach gently overhead. Relax your shoulders and breathe.' : CUES[activeMovement]}</p>
    </section>
  );
}
