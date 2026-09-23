import { useEffect, useMemo, useRef, useState } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { Activity, Pause, Play, RotateCw, Scan } from 'lucide-react';
import { createHumanFigure } from './HumanFigure';
import ExerciseIllustration from './ExerciseIllustration';
import { getExerciseMuscles, MUSCLE_REGIONS } from '../muscleData';
import './ExerciseDemo.css';

export const SUPPORTED_MOVEMENTS = ['squat', 'pushup', 'curl', 'press', 'lunge', 'plank', 'row', 'jumpingjack', 'benchpress', 'latpulldown', 'cablerow', 'legpress', 'lateralraise', 'tricepspushdown', 'deadlift', 'bridge', 'chestfly', 'frontraise', 'tricepsextension', 'legextension', 'legcurl', 'calfraise', 'crunch', 'reversecrunch', 'deadbug', 'bicyclecrunch', 'heeltap', 'mountainclimber', 'cablecrunch', 'birddog', 'sideplank', 'legraise', 'superman', 'facepull', 'chestpressmachine', 'pecdeck', 'reardeltfly', 'cabletricepsextension', 'walking', 'cycling'];
const MOVEMENTS = new Set(SUPPORTED_MOVEMENTS);
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
  chestpressmachine: 'Keep your back against the pad. Press forward and return with control.',
  pecdeck: 'Keep your forearms on the pads. Bring your arms together in a smooth arc.',
  reardeltfly: 'Hinge at your hips. Open your arms with a soft bend in your elbows.',
  cabletricepsextension: 'Keep your upper arms steady. Extend your elbows overhead with control.',
  walking: 'Walk at a comfortable pace. Stay upright and let your arms swing naturally.',
  cycling: 'Keep a soft bend in your knees. Pedal smoothly with your hips steady on the saddle.',
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

function bendJoint(start, end, upperLength, lowerLength, preferredBend) {
  const delta = end.map((value, index) => value - start[index]);
  const distance = Math.max(0.0001, Math.hypot(...delta));
  const axis = delta.map((value) => value / distance);
  const along = (upperLength ** 2 - lowerLength ** 2 + distance ** 2) / (2 * distance);
  const height = Math.sqrt(Math.max(0, upperLength ** 2 - along ** 2));
  const projection = preferredBend.reduce((sum, value, index) => sum + value * axis[index], 0);
  let perpendicular = preferredBend.map((value, index) => value - projection * axis[index]);
  let normalLength = Math.hypot(...perpendicular);
  if (normalLength < 0.0001) {
    const alternative = Math.abs(axis[0]) < 0.9 ? [1, 0, 0] : [0, 0, 1];
    const dot = alternative.reduce((sum, value, index) => sum + value * axis[index], 0);
    perpendicular = alternative.map((value, index) => value - dot * axis[index]);
    normalLength = Math.hypot(...perpendicular);
  }
  return start.map((value, index) => value + axis[index] * along + perpendicular[index] / normalLength * height);
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
  } else if (movement === 'chestpressmachine' || movement === 'pecdeck') {
    upperBody(0.90, 1.75, -0.25, -0.25);
    for (const [side, sign] of [['left', -1], ['right', 1]]) {
      pose[`${side}Knee`] = [sign * 0.27, 0.84, 0.36];
      pose[`${side}Ankle`] = [sign * 0.29, 0.13, 0.51];
      if (movement === 'chestpressmachine') {
        const handleZ = 0.14 + amount * 0.47;
        pose[`${side}Hand`] = [sign * 0.45, 2.65 - Math.sqrt(1.05 ** 2 - (handleZ - 0.10) ** 2), handleZ];
        pose[`${side}Elbow`] = bendJoint(pose[`${side}Shoulder`], pose[`${side}Hand`], 0.46, 0.45, [sign, -0.3, -0.2]);
      } else {
        const angle = amount * 2.08;
        pose[`${side}Elbow`] = [sign * (0.39 + Math.cos(angle) * 0.46), 1.70, -0.25 + Math.sin(angle) * 0.46];
        pose[`${side}Hand`] = [pose[`${side}Elbow`][0], 2.13, pose[`${side}Elbow`][2] + 0.035];
      }
    }
  } else if (movement === 'reardeltfly') {
    upperBody(1.15, 1.62, -0.25, 0.35);
    pose.head = [0, 1.91, 0.6];
    const angle = amount * Math.PI / 2;
    for (const [side, sign] of [['left', -1], ['right', 1]]) {
      pose[`${side}Knee`] = [sign * 0.26, 0.65, 0.12];
      pose[`${side}Elbow`] = [sign * (0.39 + Math.sin(angle) * 0.46), 1.58 - Math.cos(angle) * 0.46, 0.35];
      pose[`${side}Hand`] = [sign * (0.39 + Math.sin(angle) * 0.88), 1.57 - Math.cos(angle) * 0.88, 0.41 - amount * 0.10];
    }
  } else if (movement === 'cabletricepsextension') {
    Object.assign(pose, getExercisePose('tricepsextension', time, 'Cable machine'));
    pose.leftAnkle[2] = 0.2; pose.leftKnee[2] = 0.1;
    pose.rightAnkle[2] = -0.2; pose.rightKnee[2] = -0.1;
  } else if (movement === 'walking') {
    const phase = time * Math.PI * 1.3;
    const bob = Math.cos(phase * 2) * 0.018;
    upperBody(1.39 + bob, 2.24 + bob, 0, 0.025);
    pose.head = [0, 2.65 + bob, 0.06];
    pose.beltMarker = [0, 0.164, ((time * 0.7) % 0.36 + 0.36) % 0.36];
    for (const [side, sign] of [['left', -1], ['right', 1]]) {
      const cycle = ((time * 0.65 + (side === 'right' ? 0.5 : 0)) % 1 + 1) % 1;
      const swing = cycle >= 0.6;
      const progress = swing ? (cycle - 0.6) / 0.4 : cycle / 0.6;
      pose[`${side}Ankle`] = [sign * 0.19, 0.29 + (swing ? Math.sin(progress * Math.PI) * 0.18 : 0), swing ? -0.38 + progress * 0.78 : 0.4 - progress * 0.78];
      pose[`${side}Hip`][0] = sign * 0.20;
      pose[`${side}Knee`] = bendJoint(pose[`${side}Hip`], pose[`${side}Ankle`], 0.62, 0.60, [0, 0.05, 1]);
      const angle = -Math.cos(phase + (side === 'right' ? Math.PI : 0)) * 0.31;
      pose[`${side}Elbow`] = [sign * 0.42, pose.shoulder[1] - 0.04 - Math.cos(angle) * 0.46, pose.shoulder[2] + Math.sin(angle) * 0.46];
      pose[`${side}Hand`] = [sign * 0.43, pose[`${side}Elbow`][1] - Math.cos(angle + 0.18) * 0.43, pose[`${side}Elbow`][2] + Math.sin(angle + 0.18) * 0.43];
    }
  } else if (movement === 'cycling') {
    upperBody(1.43, 2.15, -0.4, 0.01);
    pose.head = [0, 2.5, 0.19];
    const phase = time * Math.PI * 1.2;
    pose.crank = [0, 0.52, 0.05];
    for (const [side, sign] of [['left', -1], ['right', 1]]) {
      const angle = phase + (side === 'right' ? Math.PI : 0);
      const pedal = [sign * 0.25, 0.52 + Math.cos(angle) * 0.26, 0.05 + Math.sin(angle) * 0.26];
      pose[`${side}Pedal`] = pedal;
      pose[`${side}Ankle`] = [pedal[0], pedal[1] + 0.13, pedal[2] - 0.08];
      pose[`${side}Knee`] = bendJoint(pose[`${side}Hip`], pose[`${side}Ankle`], 0.61, 0.60, [0, 0.25, 1]);
      pose[`${side}Hand`] = [sign * 0.38, 1.96, 0.78];
      pose[`${side}Elbow`] = bendJoint(pose[`${side}Shoulder`], pose[`${side}Hand`], 0.46, 0.44, [sign * 0.25, -1, 0]);
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
  if (movement === 'chestpressmachine' || movement === 'pecdeck') {
    bench(0.71, -0.51, 0.30, 0.40);
    panel([[-0.35, 0.73, -0.45], [0.35, 0.73, -0.45], [0.35, 1.91, -0.45], [-0.35, 1.91, -0.45]], '#566d57');
    for (const x of [-0.70, 0.70]) line([x, 0.06, -0.65], [x, 2.55, -0.65], 0.07);
    line([-0.70, 2.55, -0.65], [0.70, 2.55, -0.65], 0.07);
    line([-0.70, 0.06, -0.65], [0.70, 0.06, -0.65], 0.065);
    if (movement === 'chestpressmachine') {
      for (const [side, sign] of [['left', -1], ['right', 1]]) {
        const hand = pose[`${side}Hand`];
        line([sign * 0.70, 2.55, -0.65], [sign * 0.45, 2.65, 0.10], 0.055);
        line([sign * 0.45, 2.65, 0.10], hand, 0.055);
        line([hand[0] - 0.12, hand[1], hand[2]], [hand[0] + 0.12, hand[1], hand[2]], 0.032, '#2e4437');
      }
    } else {
      for (const [side, sign] of [['left', -1], ['right', 1]]) {
        const elbow = pose[`${side}Elbow`]; const hand = pose[`${side}Hand`];
        line([sign * 0.70, 2.55, -0.65], [sign * 0.39, 2.47, -0.37], 0.05);
        line([sign * 0.39, 2.47, -0.37], [elbow[0], 2.47, elbow[2] - 0.12], 0.05);
        line([elbow[0], 2.47, elbow[2] - 0.12], [elbow[0], 1.60, elbow[2] - 0.12], 0.05);
        line([elbow[0], 1.71, elbow[2] - 0.10], [elbow[0], 2.03, elbow[2] - 0.10], 0.10, '#566d57');
        line([elbow[0], 2.10, elbow[2] - 0.12], hand, 0.032, '#2e4437');
      }
    }
  }
  if (movement === 'cabletricepsextension') {
    for (const x of [-0.66, 0.66]) line([x, 0.02, -1.18], [x, 3.18, -1.18], 0.065);
    line([-0.66, 3.18, -1.18], [0.66, 3.18, -1.18], 0.065);
    line([-0.66, 0.25, -1.18], [0.66, 0.25, -1.18], 0.055);
    line([-0.06, 0.25, -1.18], [0.06, 0.25, -1.18], 0.11, '#344c3f');
    const junction = [0, centerHand[1] + 0.04, centerHand[2] - 0.18];
    cable([0, 0.25, -1.07], junction);
    line(junction, pose.leftHand, 0.025, '#344c3f');
    line(junction, pose.rightHand, 0.025, '#344c3f');
  }
  if (movement === 'walking') {
    panel([[-0.62, 0.16, -1.34], [0.62, 0.16, -1.34], [0.62, 0.16, 1.34], [-0.62, 0.16, 1.34]], '#465c4c');
    for (const x of [-0.69, 0.69]) {
      line([x, 0.11, -1.38], [x, 0.11, 1.38], 0.085, '#85937d');
      line([x, 0.16, 1.06], [x, 1.76, 1.06], 0.052);
      line([x, 1.53, 0.36], [x, 1.53, 1.09], 0.045, '#344c3f');
    }
    line([-0.64, 0.105, -1.32], [0.64, 0.105, -1.32], 0.07, '#85937d');
    line([-0.65, 1.76, 1.06], [0.65, 1.76, 1.06], 0.045);
    panel([[-0.52, 1.71, 0.97], [0.52, 1.71, 0.97], [0.52, 1.98, 1.13], [-0.52, 1.98, 1.13]], '#435c4b');
    panel([[-0.30, 1.78, 1.01], [0.30, 1.78, 1.01], [0.30, 1.92, 1.09], [-0.30, 1.92, 1.09]], '#b3c4a5');
    for (let index = 0; index < 7; index += 1) {
      const z = ((index * 0.36 - pose.beltMarker[2] + 1.26 + 2.52) % 2.52) - 1.26;
      line([-0.60, 0.164, z], [0.60, 0.164, z], 0.008, '#6c806a');
    }
  }
  if (movement === 'cycling') {
    line([-0.49, 0.07, -0.58], [0.49, 0.07, -0.58], 0.065);
    line([-0.49, 0.07, 0.90], [0.49, 0.07, 0.90], 0.065);
    line([0, 0.09, -0.58], [0, 0.09, 0.90], 0.075);
    line([0, 0.09, -0.48], [0, 1.24, -0.40], 0.055);
    line([0, 1.0, -0.42], [0, 0.18, 0.67], 0.075, '#788b71');
    line([0, 0.12, -0.48], pose.crank, 0.085, '#788b71');
    line(pose.crank, [0, 0.46, 0.62], 0.095, '#788b71');
    panel([[-0.20, 1.24, -0.60], [0.20, 1.24, -0.60], [0.15, 1.24, -0.23], [-0.15, 1.24, -0.23]], '#3e5244');
    line([0, 0.14, 0.73], [0, 1.74, 0.73], 0.052);
    line([0, 1.74, 0.73], [0, 1.96, 0.78], 0.045);
    line(pose.leftHand, pose.rightHand, 0.038, '#2f4438');
    for (const hand of [pose.leftHand, pose.rightHand]) line([hand[0], hand[1], hand[2] - 0.13], [hand[0], hand[1], hand[2] + 0.13], 0.04, '#2f4438');
    line([-0.075, 0.46, 0.62], [0.075, 0.46, 0.62], 0.335, '#52694f');
    const wheelAngle = Math.atan2(pose.leftPedal[2] - pose.crank[2], pose.leftPedal[1] - pose.crank[1]);
    for (const x of [-0.085, 0.085]) for (let index = 0; index < 6; index += 1) {
      const angle = wheelAngle + index * Math.PI / 3;
      line([x, 0.46, 0.62], [x, 0.46 + Math.cos(angle) * 0.28, 0.62 + Math.sin(angle) * 0.28], 0.013, '#a3b393');
    }
    for (const [side, sign] of [['left', -1], ['right', 1]]) {
      const pedal = pose[`${side}Pedal`];
      line([sign * 0.20, pose.crank[1], pose.crank[2]], pedal, 0.025, '#2f4438');
      panel([[pedal[0] - 0.09, pedal[1], pedal[2] - 0.13], [pedal[0] + 0.09, pedal[1], pedal[2] - 0.13], [pedal[0] + 0.09, pedal[1], pedal[2] + 0.13], [pedal[0] - 0.09, pedal[1], pedal[2] + 0.13]], '#2f4438');
    }
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
  const axis = /hammer/i.test(exerciseName) || ['chestfly', 'reardeltfly'].includes(movement) ? [0, 0, 1] : [1, 0, 0];
  return hands.map((hand) => ({ position: pose[hand], axis }));
}

export default function ExerciseDemo({ movement = 'squat', name = 'Squat', equipment = undefined, gender = null, exerciseId, group }) {
  const normalized = String(movement).toLowerCase().replace(/[^a-z]/g, '');
  const activeMovement = MOVEMENTS.has(normalized) ? normalized : 'squat';
  const avatar = getAvatarStyle(gender);
  const targets = useMemo(() => getExerciseMuscles({id:exerciseId,movement:normalized,name,group,equipment}), [exerciseId,normalized,name,group,equipment]);
  const posteriorMuscles = new Set(['triceps','rearDelts','lats','upperBack','lowerBack','glutes','hamstrings','calves']);
  const startBehind = targets.primary.length > 0 && targets.primary.every(id => posteriorMuscles.has(id));
  const defaultAngle = /wall/i.test(name) ? 1.45 : ['walking','cycling'].includes(activeMovement) ? 1.05 : startBehind ? Math.PI - 0.65 : 0.65;
  const [showMuscles,setShowMuscles] = useState(true);
  const humanRef = useRef(null);
  const muscleVisibilityRef = useRef(true);
  const mountRef = useRef(null);
  const [playing, setPlaying] = useState(() => typeof window === 'undefined' || !window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  const [speed, setSpeed] = useState(1);
  const [fallback, setFallback] = useState(false);
  const playingRef = useRef(playing);
  const speedRef = useRef(speed);
  const viewRef = useRef(defaultAngle);
  const zoomRef = useRef(1);
  const cameraActionsRef = useRef(null);
  useEffect(() => { playingRef.current = playing; }, [playing]);
  useEffect(() => { speedRef.current = speed; }, [speed]);
  useEffect(() => {
    muscleVisibilityRef.current = showMuscles;
    humanRef.current?.setHighlights(targets,showMuscles);
  }, [targets,showMuscles]);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return undefined;
    viewRef.current = defaultAngle;
    zoomRef.current = 1;
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
    renderer.domElement.setAttribute('aria-label', `3D ${name} movement demonstration. ${targets.primary.length ? `Primary muscles: ${targets.primary.map(id => MUSCLE_REGIONS[id]).join(', ')}. ` : ''}Drag to rotate, pinch to zoom. Arrow keys rotate; plus and minus zoom; Home resets the view.`);
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
      const mesh = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, 1, radius > 0.15 ? 28 : 10), new THREE.MeshStandardMaterial({ color, roughness: 0.7, metalness: 0.15 }));
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
    const human = createHumanFigure(scene, avatar, targets);
    humanRef.current = human;
    human.setHighlights(targets,muscleVisibilityRef.current);
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
    const tallMachine = ['latpulldown', 'tricepspushdown', 'cablecrunch', 'facepull', 'cabletricepsextension', 'walking'].includes(activeMovement);
    const targetHeight = incline || ['benchpress', 'chestfly'].includes(activeMovement) ? 0.98 : floorMovement ? 0.7 : 1.46;
    const cameraOffset = new THREE.Vector3();
    const spherical = new THREE.Spherical();
    let fitDistance = 6;
    const resetView = () => {
      controls.enableDamping = false;
      controls.update();
      controls.target.set(0, targetHeight, 0);
      const polar = floorMovement ? 1.04 : 1.32;
      cameraOffset.setFromSpherical(new THREE.Spherical(fitDistance, polar, defaultAngle));
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
    const anatomicalView = (back) => {
      controls.enableDamping = false;
      controls.update();
      const distance = camera.position.distanceTo(controls.target);
      const axisY = new THREE.Vector3(0,1,0).applyQuaternion(scene.getObjectByName('torso').quaternion);
      const axisZ = new THREE.Vector3(0,0,1).applyQuaternion(scene.getObjectByName('torso').quaternion);
      // Use the body's front/back for standing and floor exercises alike.
      const offset = axisZ.multiplyScalar(back ? -1 : 1).addScaledVector(axisY,0.2).normalize();
      if (offset.y < 0.15) offset.y = 0.15;
      camera.position.copy(controls.target).add(offset.normalize().multiplyScalar(distance));
      controls.update();
      controls.enableDamping = true;
    };
    cameraActionsRef.current = { rotate: () => orbitBy(Math.PI / 4), reset: resetView, front: () => anatomicalView(false), back: () => anatomicalView(true) };
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
      humanRef.current = null;
      controls.removeEventListener('change', onCameraChange);
      controls.removeEventListener('start', onInteractionStart);
      controls.removeEventListener('end', onInteractionEnd);
      controls.dispose();
      renderer.domElement.removeEventListener('keydown', onKeyDown);
      renderer.domElement.removeEventListener('webglcontextlost', onContextLost);
      human.dispose();
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
  }, [activeMovement, name, equipment, avatar.kind, targets, defaultAngle]);

  return (
    <section className="exercise-demo" aria-label={`${name} movement preview`} data-avatar={avatar.kind} data-renderer={fallback ? 'illustration' : 'webgl'} data-primary-muscles={targets.primary.join(' ')} data-secondary-muscles={targets.secondary.join(' ')} data-muscles-visible={showMuscles}>
      <div className="exercise-demo__stage">
        <div className="exercise-demo__label"><span /> Movement preview</div>
        <span className="exercise-demo__dimension">{fallback ? 'ILLUSTRATED' : '3D'}</span>
        <div ref={mountRef} className={`exercise-demo__canvas${fallback ? ' exercise-demo__canvas--hidden' : ''}`} />
        {fallback && <ExerciseIllustration defaultAngle={defaultAngle} targets={targets} showMuscles={showMuscles} getExercisePose={getExercisePose} getEquipmentProps={getEquipmentProps} getWeightAttachments={getWeightAttachments} getAvatarStyle={getAvatarStyle} movement={activeMovement} name={name} equipment={equipment} gender={gender} playingRef={playingRef} speedRef={speedRef} viewRef={viewRef} zoomRef={zoomRef} />}
        <div className="exercise-demo__views" role="group" aria-label="Anatomical views">
          <button type="button" onClick={() => { if (!fallback && cameraActionsRef.current) cameraActionsRef.current.front(); else viewRef.current = 0; }} aria-label="Show front muscles">Front</button>
          <button type="button" onClick={() => { if (!fallback && cameraActionsRef.current) cameraActionsRef.current.back(); else viewRef.current = Math.PI; }} aria-label="Show back muscles">Back</button>
        </div>
        <span className="exercise-demo__floor-label">{fallback ? 'Drag to rotate the illustration' : 'Drag to rotate · Pinch to zoom'}</span>
      </div>
      {targets.primary.length > 0 && <div className="exercise-demo__muscles" aria-label="Muscle focus">
        <div className="exercise-demo__muscle-heading"><strong>{group==='Mobility'?'Movement focus':'Muscles worked'}</strong><button type="button" aria-label="Highlight target muscles" aria-pressed={showMuscles} onClick={() => setShowMuscles(value => !value)}><Activity size={14}/>{showMuscles?'Highlights on':'Highlights off'}</button></div>
        <div className="exercise-demo__muscle-row"><span className="exercise-demo__muscle-key"><i className="muscle-primary"/>Primary</span><p>{targets.primary.map(id => MUSCLE_REGIONS[id]).join(' · ')}</p></div>
        {targets.secondary.length > 0 && <div className="exercise-demo__muscle-row"><span className="exercise-demo__muscle-key"><i className="muscle-secondary"/>Supporting</span><p>{targets.secondary.map(id => MUSCLE_REGIONS[id]).join(' · ')}</p></div>}
      </div>}
      <div className="exercise-demo__controls">
        <button className="exercise-demo__play" type="button" onClick={() => setPlaying((value) => !value)} aria-label={playing ? 'Pause movement demo' : 'Play movement demo'}>
          {playing ? <Pause size={15} fill="currentColor" /> : <Play size={15} fill="currentColor" />}
          {playing ? 'Pause' : 'Play'}
        </button>
        <button className="exercise-demo__rotate" type="button" onClick={() => { if (!fallback && cameraActionsRef.current) cameraActionsRef.current.rotate(); else viewRef.current += Math.PI / 4; }} aria-label="Rotate movement preview 45 degrees">
          <RotateCw size={15} /> <span>Rotate view</span>
        </button>
        <button className="exercise-demo__reset" type="button" onClick={() => { if (!fallback && cameraActionsRef.current) cameraActionsRef.current.reset(); else { viewRef.current = defaultAngle; zoomRef.current = 1; } }} aria-label="Reset movement view"><Scan size={15} /><span>Reset view</span></button>
        <label className="exercise-demo__speed"><span>Speed</span><select value={speed} onChange={(event) => setSpeed(Number(event.target.value))} aria-label="Movement playback speed"><option value={0.5}>0.5×</option><option value={1}>1×</option><option value={1.5}>1.5×</option></select></label>
      </div>
      <p className="exercise-demo__cue">{activeMovement === 'press' && /bodyweight/i.test(equipment || '') ? 'Reach gently overhead. Relax your shoulders and breathe.' : CUES[activeMovement]}</p>
    </section>
  );
}
