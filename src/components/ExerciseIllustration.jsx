import { useEffect, useId, useMemo, useRef, useState } from 'react';

const SEGMENTS = [
  ['leftShoulder', 'leftElbow'], ['leftElbow', 'leftHand'],
  ['rightShoulder', 'rightElbow'], ['rightElbow', 'rightHand'],
  ['leftHip', 'leftKnee'], ['leftKnee', 'leftAnkle'],
  ['rightHip', 'rightKnee'], ['rightKnee', 'rightAnkle'],
];
const SUPINE = new Set(['benchpress', 'chestfly', 'bridge', 'crunch', 'reversecrunch', 'deadbug', 'bicyclecrunch', 'heeltap', 'legraise']);
const FLOOR_MOVEMENTS = new Set([...SUPINE, 'pushup', 'plank', 'mountainclimber', 'birddog', 'sideplank', 'superman']);
const add = (a, b) => a.map((value, index) => value + b[index]);
const subtract = (a, b) => a.map((value, index) => value - b[index]);
const scale = (a, amount) => a.map(value => value * amount);
const dot = (a, b) => a.reduce((sum, value, index) => sum + value * b[index], 0);
const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
const normalize = (value, fallback = [0, 1, 0]) => Math.hypot(...value) > 0.00001 ? scale(value, 1 / Math.hypot(...value)) : fallback;
const interpolate = (a, b, amount) => add(a, scale(subtract(b, a), amount));
const clamp = (value, minimum, maximum) => Math.min(maximum, Math.max(minimum, value));

function getMotionEnvelope(movement, equipment, name, getExercisePose, getEquipmentProps, getWeightAttachments) {
  const points = [];
  // Include both sides of alternating movements and overhead/extended phases.
  // A fixed envelope prevents the camera from breathing with every repetition.
  for (let sample = 0; sample <= 48; sample += 1) {
    const pose = getExercisePose(movement, sample / 8, equipment, name);
    for (const [joint, position] of Object.entries(pose)) {
      if (!Array.isArray(position) || position.length !== 3) continue;
      if (joint === 'head') {
        const axis = normalize(subtract(pose.head, pose.shoulder));
        points.push({ position: add(position, scale(axis, -0.09)), padding: 18 });
      } else points.push({ position, padding: /Hip|Shoulder|hip|shoulder/.test(joint) ? 14 : 10 });
    }
    for (const side of ['left', 'right']) {
      const ankle = pose[`${side}Ankle`];
      points.push({ position: add(ankle, [0, movement === 'calfraise' ? 0.09 - ankle[1] : -0.06, 0.25]), padding: 10 });
    }
    const props = getEquipmentProps(movement, pose, equipment, name);
    for (const { points: panel } of props.panels) for (const position of panel) points.push({ position, padding: 2 });
    for (const { from, to, radius } of props.lines) {
      const padding = Math.max(1.5, radius * 130) / 2 + 1;
      points.push({ position: from, padding }, { position: to, padding });
    }
    for (const { position, axis, kind } of getWeightAttachments(movement, pose, equipment, name)) {
      const half = kind === 'barbell' ? 1.05 : 0.17;
      const padding = (kind === 'barbell' ? 17 : 7) + 3;
      points.push({ position: add(position, scale(axis, -half)), padding }, { position: add(position, scale(axis, half)), padding });
    }
  }
  return points;
}

function getIllustrationFraming(points, angle, viewport, projectionDepth = 12) {
  let left = Infinity; let right = -Infinity; let top = Infinity; let bottom = -Infinity;
  const sin = Math.sin(angle); const cos = Math.cos(angle);
  for (const { position: [x, y, z], padding } of points) {
    const screenX = 250 + (x * cos + z * sin) * 72;
    const screenY = 265 - y * 72 + (z * cos - x * sin) * projectionDepth;
    left = Math.min(left, screenX - padding); right = Math.max(right, screenX + padding);
    top = Math.min(top, screenY - padding); bottom = Math.max(bottom, screenY + padding);
  }
  const contentWidth = Math.max(1, right - left); const contentHeight = Math.max(1, bottom - top);
  const availableWidth = Math.max(1, viewport.width - 28);
  const availableHeight = Math.max(1, viewport.height - 90);
  const fitScale = Math.min(availableWidth / contentWidth, availableHeight / contentHeight);
  return {
    scale: fitScale,
    x: viewport.width / 2 - (left + right) / 2 * fitScale,
    y: 44 + (availableHeight - contentHeight * fitScale) / 2 - top * fitScale,
    contentWidth: contentWidth * fitScale,
  };
}

export default function ExerciseIllustration({
  movement, name, equipment, gender, playingRef, speedRef, viewRef, zoomRef, defaultAngle = 0.65,
  targets = { primary: [], secondary: [] }, showMuscles = false,
  getExercisePose, getEquipmentProps, getWeightAttachments, getAvatarStyle,
}) {
  const [frame, setFrame] = useState(() => ({ pose: getExercisePose(movement, 0, equipment, name), angle: viewRef.current, zoom: zoomRef.current }));
  const [viewport, setViewport] = useState({ width: 500, height: 300 });
  const svgRef = useRef(null);
  const pointersRef = useRef(new Map());
  const gradientId = `illustration-${useId().replace(/[^a-zA-Z0-9-]/g, '')}`;
  const avatar = getAvatarStyle(gender);
  const projectionDepth = FLOOR_MOVEMENTS.has(movement) ? 36 : 12;
  const envelope = useMemo(() => getMotionEnvelope(movement, equipment, name, getExercisePose, getEquipmentProps, getWeightAttachments), [movement, equipment, name, getExercisePose, getEquipmentProps, getWeightAttachments]);
  const framing = useMemo(() => getIllustrationFraming(envelope, frame.angle, viewport, projectionDepth), [envelope, frame.angle, viewport, projectionDepth]);

  useEffect(() => {
    const svg = svgRef.current;
    if (!svg) return undefined;
    const resize = () => {
      const { width, height } = svg.getBoundingClientRect();
      if (width > 0 && height > 0) setViewport(previous => previous.width === width && previous.height === height ? previous : { width, height });
    };
    resize();
    if (typeof ResizeObserver === 'undefined') {
      window.addEventListener('resize', resize);
      return () => window.removeEventListener('resize', resize);
    }
    const observer = new ResizeObserver(resize);
    observer.observe(svg);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    let request; let lastTime; let lastPaint = 0; let elapsed = 0;
    const animate = time => {
      if (lastTime !== undefined && playingRef.current) elapsed += Math.min((time - lastTime) / 1000, 0.06) * speedRef.current;
      lastTime = time;
      if (time - lastPaint > 45) {
        setFrame({ pose: getExercisePose(movement, elapsed, equipment, name), angle: viewRef.current, zoom: zoomRef.current });
        lastPaint = time;
      }
      request = requestAnimationFrame(animate);
    };
    request = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(request);
  }, [movement, name, equipment, playingRef, speedRef, viewRef, zoomRef, getExercisePose]);

  const pose = frame.pose;
  const zoom = frame.zoom || 1;
  const camera = normalize([-Math.sin(frame.angle), projectionDepth / 72, Math.cos(frame.angle)]);
  const project = ([x, y, z]) => [
    250 + (x * Math.cos(frame.angle) + z * Math.sin(frame.angle)) * 72 * zoom,
    265 - y * 72 * zoom + (z * Math.cos(frame.angle) - x * Math.sin(frame.angle)) * projectionDepth * zoom + (zoom - 1) * 104,
  ];
  const projected = point => project(point).join(',');
  const depth = point => dot(point, camera);
  const up = normalize(subtract(pose.shoulder, pose.hip));
  const across = normalize(subtract(pose.rightShoulder, pose.leftShoulder), [1, 0, 0]);
  const front = scale(normalize(cross(across, up), [0, 0, 1]), SUPINE.has(movement) ? -1 : 1);
  const back = scale(front, -1);
  const bodyLength = Math.hypot(...subtract(pose.shoulder, pose.hip));
  const bodyPoint = (x, height, forward = 0) => add(add(add(pose.hip, scale(up, height * bodyLength)), scale(across, x)), scale(front, forward));
  const primary = new Set(targets?.primary || []);
  const secondary = new Set(targets?.secondary || []);

  // Each patch is an ellipse on a local body surface, not a screen-positioned
  // label. Its normal decides whether the front, back, or side is visible.
  const patch = (region, key, center, along, normal, halfLength, halfWidth) => {
    if (!showMuscles || (!primary.has(region) && !secondary.has(region))) return null;
    const facing = dot(normal, camera);
    if (facing <= 0.025) return null;
    const longAxis = normalize(subtract(along, scale(normal, dot(along, normal))), up);
    const wideAxis = normalize(cross(longAxis, normal), across);
    const points = Array.from({ length: 20 }, (_, index) => {
      const angle = index / 20 * Math.PI * 2;
      return projected(add(add(center, scale(longAxis, Math.sin(angle) * halfLength)), scale(wideAxis, Math.cos(angle) * halfWidth)));
    }).join(' ');
    const role = primary.has(region) ? 'primary' : 'secondary';
    return <polygon key={key} points={points} fill={role === 'primary' ? '#ef7958' : '#e7b454'} fillOpacity={clamp(facing * 2 + 0.25, 0.45, 0.9)} stroke={role === 'primary' ? '#f8b599' : '#f5d58d'} strokeWidth={0.7 * zoom} strokeLinejoin="round" data-muscle-region={region} data-muscle-role={role}/>;
  };

  const capsule = (from, to, startWidth, endWidth, fill, key, outline = true) => {
    const a = project(from); const b = project(to);
    const length = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
    const normal = [-(b[1] - a[1]) / length, (b[0] - a[0]) / length];
    const top = startWidth * 72 * zoom; const bottom = endWidth * 72 * zoom;
    const offset = (point, amount) => [point[0] + normal[0] * amount, point[1] + normal[1] * amount];
    const leftA = offset(a, top); const rightA = offset(a, -top);
    const leftB = offset(b, bottom); const rightB = offset(b, -bottom);
    return <path key={key} d={`M ${leftA} Q ${offset(interpolate(a, b, 0.4), top)} ${leftB} Q ${b[0] + (b[0] - a[0]) / length * bottom},${b[1] + (b[1] - a[1]) / length * bottom} ${rightB} Q ${offset(interpolate(a, b, 0.4), -top)} ${rightA} Q ${a[0] - (b[0] - a[0]) / length * top},${a[1] - (b[1] - a[1]) / length * top} ${leftA} Z`} fill={fill} stroke={outline ? '#263d3233' : 'none'} strokeWidth={0.7 * zoom} strokeLinejoin="round"/>;
  };

  const parts = SEGMENTS.map(([from, to]) => {
    const a = pose[from]; const b = pose[to];
    const axis = normalize(subtract(b, a));
    const length = Math.hypot(...subtract(b, a));
    const upperLeg = from.includes('Hip'); const lowerLeg = from.includes('Knee'); const upperArm = from.includes('Shoulder');
    const limbFront = normalize(subtract(front, scale(axis, dot(front, axis))), normalize(cross(across, axis), front));
    const limbBack = scale(limbFront, -1);
    const radius = (upperLeg ? 0.145 : lowerLeg ? 0.103 : upperArm ? 0.10 : 0.077) * avatar.limbScale;
    const lowerRadius = (upperLeg ? 0.103 : lowerLeg ? 0.055 : upperArm ? 0.070 : 0.044) * avatar.limbScale;
    const leggings = (upperLeg || lowerLeg) && avatar.leggings;
    const at = (fraction, normal, distance = radius * 0.92) => add(interpolate(a, b, fraction), scale(normal, distance));
    const overlays = [];
    if (upperArm) {
      overlays.push(patch('biceps', `${from}-biceps`, at(0.48, limbFront), axis, limbFront, length * 0.27, radius * 0.68));
      overlays.push(patch('triceps', `${from}-triceps`, at(0.49, limbBack), axis, limbBack, length * 0.29, radius * 0.71));
      overlays.push(patch('frontDelts', `${from}-frontDelts`, at(0.06, limbFront), axis, limbFront, 0.115, radius * 0.89));
      overlays.push(patch('rearDelts', `${from}-rearDelts`, at(0.07, limbBack), axis, limbBack, 0.115, radius * 0.89));
      const outward = scale(across, from.startsWith('left') ? -1 : 1);
      const sideNormal = normalize(subtract(outward, scale(axis, dot(outward, axis))), outward);
      overlays.push(patch('sideDelts', `${from}-sideDelts`, at(0.04, sideNormal), axis, sideNormal, 0.115, radius * 0.82));
    } else if (upperLeg) {
      overlays.push(patch('quads', `${from}-quads`, at(0.50, limbFront), axis, limbFront, length * 0.34, radius * 0.73));
      overlays.push(patch('hamstrings', `${from}-hamstrings`, at(0.48, limbBack), axis, limbBack, length * 0.32, radius * 0.65));
      const inward = scale(across, from.startsWith('left') ? 1 : -1);
      const innerNormal = normalize(add(scale(limbFront, 0.45), scale(inward, 0.85)));
      overlays.push(patch('adductors', `${from}-adductors`, at(0.32, innerNormal), axis, innerNormal, length * 0.23, radius * 0.4));
    } else if (lowerLeg) {
      overlays.push(patch('calves', `${from}-calves`, at(0.36, limbBack), axis, limbBack, length * 0.26, radius * 0.75));
    } else {
      overlays.push(patch('forearms', `${from}-forearms-front`, at(0.38, limbFront), axis, limbFront, length * 0.3, radius * 0.7));
      overlays.push(patch('forearms', `${from}-forearms-back`, at(0.38, limbBack), axis, limbBack, length * 0.3, radius * 0.7));
    }
    return { key: from, depth: depth(interpolate(a, b, 0.5)), node: <g data-body-part={from}>
      {capsule(a, b, radius, lowerRadius, leggings ? avatar.bottoms : `url(#${gradientId}-skin)`, 'limb')}
      {upperLeg && !avatar.leggings && capsule(a, interpolate(a, b, 0.60), radius * 1.06, radius * 0.92, avatar.bottoms, 'shorts')}
      {upperArm && avatar.kind !== 'woman' && capsule(a, interpolate(a, b, 0.33), radius * 1.05, radius, avatar.top, 'sleeve')}
      {overlays}
    </g> };
  });

  // Project the silhouette of elliptical torso rings so the body retains its
  // depth when viewed directly from the side.
  const torsoAxis = subtract(project(pose.shoulder), project(pose.hip));
  const outlineNormal = normalize([-torsoAxis[1], torsoAxis[0]], [1, 0]);
  const shoulderWidth = Math.hypot(...subtract(pose.rightShoulder, pose.leftShoulder)) / 2;
  const torsoRings = [[0, avatar.hipWidth * 0.82], [0.28, avatar.waistWidth], [0.65, avatar.chestWidth * 0.94], [0.85, avatar.chestWidth], [1, shoulderWidth]].map(([height, width]) => {
    const center = project(bodyPoint(0, height));
    const lateral = subtract(project(bodyPoint(width, height)), center);
    const forward = subtract(project(bodyPoint(0, height, 0.18)), center);
    const radius = Math.hypot(dot(lateral, outlineNormal), dot(forward, outlineNormal));
    return { center, radius };
  });
  const bodyOutline = [...torsoRings.map(({ center, radius }) => add(center, scale(outlineNormal, -radius))), ...[...torsoRings].reverse().map(({ center, radius }) => add(center, scale(outlineNormal, radius)))];
  const torsoPatches = [];
  for (const sign of [-1, 1]) {
    torsoPatches.push(patch('chest', `chest-${sign}`, bodyPoint(sign * avatar.chestWidth * 0.44, 0.76, 0.155), up, front, bodyLength * 0.13, avatar.chestWidth * 0.40));
    torsoPatches.push(patch('obliques', `obliques-${sign}`, bodyPoint(sign * avatar.waistWidth * 0.73, 0.35, 0.145), up, front, bodyLength * 0.19, 0.055));
    for (const height of [0.22, 0.37, 0.52]) torsoPatches.push(patch('abs', `abs-${sign}-${height}`, bodyPoint(sign * 0.062, height, 0.17), up, front, bodyLength * 0.060, 0.049));
    torsoPatches.push(patch('upperBack', `upperBack-${sign}`, bodyPoint(sign * 0.14, 0.77, -0.16), up, back, bodyLength * 0.16, 0.11));
    torsoPatches.push(patch('lowerBack', `lowerBack-${sign}`, bodyPoint(sign * 0.072, 0.28, -0.16), up, back, bodyLength * 0.18, 0.055));
    const latNormal = normalize(add(back, scale(across, sign * 0.45)));
    torsoPatches.push(patch('lats', `lats-${sign}`, bodyPoint(sign * avatar.waistWidth * 0.78, 0.48, -0.15), up, latNormal, bodyLength * 0.22, 0.085));
    torsoPatches.push(patch('glutes', `glutes-${sign}`, bodyPoint(sign * 0.145, -0.03, -0.16), up, back, 0.13, 0.12));
    torsoPatches.push(patch('hipFlexors', `hipFlexors-${sign}`, bodyPoint(sign * 0.16, 0.035, 0.16), up, front, 0.09, 0.062));
  }
  parts.push({ key: 'torso', depth: depth(interpolate(pose.hip, pose.shoulder, 0.5)), node: <g data-body-part="torso">
    <polygon points={bodyOutline.map(point => point.join(',')).join(' ')} fill={`url(#${gradientId}-shirt)`} stroke={avatar.top} strokeWidth={4 * zoom} strokeLinejoin="round"/>
    <path d={`M ${projected(bodyPoint(-avatar.hipWidth * 0.78, 0.025))} Q ${projected(bodyPoint(0, -0.045))} ${projected(bodyPoint(avatar.hipWidth * 0.78, 0.025))}`} fill="none" stroke={avatar.bottoms} strokeWidth={12 * zoom} strokeLinecap="round"/>
    <path d={`M ${projected(bodyPoint(-0.12, 0.96, 0.04))} Q ${projected(bodyPoint(0, 0.77, 0.12))} ${projected(bodyPoint(0.12, 0.96, 0.04))}`} fill="none" stroke="#a9b89e" strokeWidth={1.2 * zoom}/>
    <path d={`M ${projected(bodyPoint(-avatar.waistWidth * 0.74, 0.14))} L ${projected(bodyPoint(-avatar.chestWidth * 0.76, 0.73))} M ${projected(bodyPoint(avatar.waistWidth * 0.74, 0.14))} L ${projected(bodyPoint(avatar.chestWidth * 0.76, 0.73))}`} stroke="#ffffff16" strokeWidth={1.5 * zoom}/>
    {torsoPatches}
  </g> });

  const headAxis = normalize(subtract(pose.head, pose.shoulder));
  const headCenter = add(pose.head, scale(headAxis, -0.09));
  const head = project(headCenter);
  const headFront = scale(normalize(cross(across, headAxis), front), SUPINE.has(movement) ? -1 : 1);
  const faceVisible = dot(headFront, camera) > 0.035;
  const headPoint = (x, y, forward) => add(add(add(headCenter, scale(across, x)), scale(headAxis, y)), scale(headFront, forward));
  const headTop = project(add(headCenter, headAxis));
  const headAngle = Math.atan2(headTop[1] - head[1], headTop[0] - head[0]) * 180 / Math.PI + 90;
  const facePoints = [-1, 1].map(sign => ({ eye: project(headPoint(sign * 0.061, 0.037, 0.153)), brow: project(headPoint(sign * 0.061, 0.073, 0.145)), ear: project(headPoint(sign * 0.161, -0.005, 0)) }));
  parts.push({ key: 'head', depth: depth(headCenter) + 0.03, node: <g data-body-part="head">
    {capsule(pose.shoulder, headCenter, 0.065, 0.060, avatar.skin, 'neck')}
    {facePoints.map(({ ear }, index) => <ellipse key={index} cx={ear[0]} cy={ear[1]} rx={2.5 * zoom} ry={3.8 * zoom} fill={avatar.skin}/>)}
    <g transform={`translate(${head[0]} ${head[1]}) rotate(${headAngle}) scale(${zoom})`}>
      <path d="M -10 -9 Q -13 0 -8 10 Q 0 17 8 10 Q 13 0 10 -9 Q 0 -17 -10 -9Z" fill={`url(#${gradientId}-skin)`} stroke="#80594544" strokeWidth="0.7"/>
      <path d={faceVisible ? 'M -11 -3 Q -14 -16 0 -16 Q 13 -16 11 -3 L 7 -8 Q 1 -6 -3 -10 Z' : 'M -11 -5 Q -13 -16 0 -16 Q 14 -15 11 0 L 8 10 Q 0 12 -8 10 Z'} fill={avatar.hair}/>
    </g>
    {avatar.kind === 'woman' && <circle cx={project(headPoint(-0.025, 0.13, -0.18))[0]} cy={project(headPoint(-0.025, 0.13, -0.18))[1]} r={6 * zoom} fill={avatar.hair}/>}
    {faceVisible && <g fill="#46332d" strokeLinecap="round">
      {facePoints.map(({ eye, brow }, index) => <g key={index}><ellipse cx={eye[0]} cy={eye[1]} rx={1.7 * zoom} ry={0.85 * zoom} fill="#eee1cf"/><circle cx={eye[0]} cy={eye[1]} r={0.65 * zoom}/><path d={`M ${brow[0] - 1.7 * zoom} ${brow[1]} l ${3.1 * zoom} ${-0.3 * zoom}`} stroke={avatar.hair} strokeWidth={0.8 * zoom}/></g>)}
      <path d={`M ${projected(headPoint(0, 0.02, 0.172))} L ${projected(headPoint(0.017, -0.032, 0.19))} L ${projected(headPoint(-0.012, -0.035, 0.177))}`} fill="none" stroke="#906448" strokeWidth={0.7 * zoom}/>
      <path d={`M ${projected(headPoint(-0.035, -0.086, 0.14))} Q ${projected(headPoint(0, -0.102, 0.151))} ${projected(headPoint(0.035, -0.086, 0.14))}`} fill="none" stroke="#805a4a" strokeWidth={0.7 * zoom}/>
    </g>}
  </g> });

  for (const side of ['left', 'right']) {
    const ankle = pose[`${side}Ankle`]; const hand = pose[`${side}Hand`];
    const foot = project(add(ankle, [0, -0.04, 0.075]));
    const toe = project(add(ankle, [0, movement === 'calfraise' ? 0.09 - ankle[1] : -0.06, 0.25]));
    parts.push({ key: `${side}-foot`, depth: depth(ankle), node: <g data-body-part={`${side}Foot`}><line x1={foot[0]} y1={foot[1] + 3 * zoom} x2={toe[0]} y2={toe[1] + 3 * zoom} stroke="#bac6b2" strokeWidth={12 * zoom} strokeLinecap="round"/><line x1={foot[0]} y1={foot[1]} x2={toe[0]} y2={toe[1]} stroke="#f4f3e9" strokeWidth={11 * zoom} strokeLinecap="round"/></g> });
    const handAt = project(hand);
    parts.push({ key: `${side}-hand`, depth: depth(hand), node: <ellipse data-body-part={`${side}Hand`} cx={handAt[0]} cy={handAt[1]} rx={4.1 * zoom} ry={5.5 * zoom} fill={avatar.skin} stroke="#80594544" strokeWidth={0.7 * zoom}/> });
  }
  parts.sort((a, b) => a.depth - b.depth);
  const equipmentProps = getEquipmentProps(movement, pose, equipment, name);
  const handWeights = getWeightAttachments(movement, pose, equipment, name);

  const drag = event => {
    const pointers = pointersRef.current;
    const previous = pointers.get(event.pointerId);
    if (!previous) return;
    const oldPoints = [...pointers.values()];
    pointers.set(event.pointerId, [event.clientX, event.clientY]);
    if (pointers.size > 1) {
      const newPoints = [...pointers.values()];
      const before = Math.hypot(oldPoints[0][0] - oldPoints[1][0], oldPoints[0][1] - oldPoints[1][1]);
      const after = Math.hypot(newPoints[0][0] - newPoints[1][0], newPoints[0][1] - newPoints[1][1]);
      if (before > 1) zoomRef.current = clamp(zoomRef.current * after / before, 0.65, 1.65);
    } else viewRef.current += (event.clientX - previous[0]) * 0.012;
  };
  const keyDown = event => {
    if (!['ArrowLeft', 'ArrowRight', '+', '=', '-', '_', 'Home'].includes(event.key)) return;
    event.preventDefault();
    if (event.key === 'ArrowLeft') viewRef.current -= 0.2;
    else if (event.key === 'ArrowRight') viewRef.current += 0.2;
    else if (event.key === 'Home') { viewRef.current = defaultAngle; zoomRef.current = 1; }
    else zoomRef.current = clamp(zoomRef.current * (['+', '='].includes(event.key) ? 1.1 : 1 / 1.1), 0.65, 1.65);
  };

  const floorY = clamp(framing.y + 266 * framing.scale, 60, viewport.height - 44);
  return <svg ref={svgRef} className="exercise-demo__fallback" viewBox={`0 0 ${viewport.width} ${viewport.height}`} role="img" tabIndex={0} aria-label={`Animated ${name} movement illustration${showMuscles ? ' with highlighted muscles' : ''}. Drag or use arrow keys to rotate. Pinch or use plus and minus to zoom. Home resets the view.`} data-avatar={avatar.kind} data-azimuth={frame.angle.toFixed(4)} data-zoom={zoom.toFixed(3)} data-fit-scale={framing.scale.toFixed(3)} data-muscles={showMuscles ? 'on' : 'off'} onKeyDown={keyDown} onPointerDown={event => { event.currentTarget.setPointerCapture(event.pointerId); pointersRef.current.set(event.pointerId, [event.clientX, event.clientY]); }} onPointerMove={drag} onPointerUp={event => pointersRef.current.delete(event.pointerId)} onPointerCancel={event => pointersRef.current.delete(event.pointerId)} onLostPointerCapture={event => pointersRef.current.delete(event.pointerId)}>
    <title>{`${name} — illustrated movement guide`}</title>
    <desc>Primary working muscles are coral; secondary muscles are gold. Highlights follow the figure as it moves. Rotate to see muscles on the other side.</desc>
    <defs><linearGradient id={`${gradientId}-skin`} x1="0" y1="0" x2="1" y2="0"><stop offset="0" stopColor="#ac7557"/><stop offset="0.42" stopColor={avatar.skin}/><stop offset="0.75" stopColor="#d4a383"/><stop offset="1" stopColor="#b57e5c"/></linearGradient><linearGradient id={`${gradientId}-shirt`} x1="0" y1="0" x2="1" y2="0"><stop offset="0" stopColor="#2e463e"/><stop offset="0.5" stopColor={avatar.top}/><stop offset="1" stopColor="#456053"/></linearGradient></defs>
    <ellipse cx={viewport.width / 2} cy={floorY} rx={Math.min(viewport.width * 0.42, Math.max(90, framing.contentWidth * 0.7))} ry="18" fill="#d7e0cc"/>
    {[-40, -25, -10, 5, 20].map(offset => <path key={offset} d={`M 14 ${floorY + offset} H ${viewport.width - 14}`} stroke="#dde4d5" strokeWidth="1"/>)}
    <g data-illustration-scene="" transform={`translate(${framing.x} ${framing.y}) scale(${framing.scale})`}>
    {equipmentProps.panels.map(({ points, color }, index) => <polygon key={`panel-${index}`} points={points.map(projected).join(' ')} fill={color} stroke="#53674f" strokeWidth={3 * zoom} strokeLinejoin="round"/>)}
    {equipmentProps.lines.map(({ from, to, radius, color }, index) => { const a = project(from); const b = project(to); return <line key={`prop-${index}`} x1={a[0]} y1={a[1]} x2={b[0]} y2={b[1]} stroke={color} strokeWidth={Math.max(1.5, radius * 130) * zoom} strokeLinecap="round"/>; })}
    {parts.map(part => <g key={part.key}>{part.node}</g>)}
    {handWeights.map(({ position, axis, kind }, index) => {
      const half = kind === 'barbell' ? 1.05 : 0.17;
      const a = project(add(position, scale(axis, -half))); const b = project(add(position, scale(axis, half)));
      const length = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
      const plateSize = (kind === 'barbell' ? 17 : 7) * zoom;
      const perpendicular = [-(b[1] - a[1]) / length * plateSize, (b[0] - a[0]) / length * plateSize];
      return <g key={index} stroke="#263e33" strokeWidth={5 * zoom} strokeLinecap="round"><line x1={a[0]} y1={a[1]} x2={b[0]} y2={b[1]}/>{[a, b].map((end, i) => <line key={i} x1={end[0] - perpendicular[0]} y1={end[1] - perpendicular[1]} x2={end[0] + perpendicular[0]} y2={end[1] + perpendicular[1]}/>)}</g>;
    })}
    </g>
  </svg>;
}
