import * as THREE from 'three';

const SEGMENTS = [
  ['leftShoulder', 'leftElbow'], ['leftElbow', 'leftHand'],
  ['rightShoulder', 'rightElbow'], ['rightElbow', 'rightHand'],
  ['leftHip', 'leftKnee'], ['leftKnee', 'leftAnkle'],
  ['rightHip', 'rightKnee'], ['rightKnee', 'rightAnkle'],
];

export function createHumanFigure(scene, avatar, targets = { primary: [], secondary: [] }) {
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
  const iris = new THREE.MeshStandardMaterial({ color: '#493e2d', roughness: 0.65 });
  const pupil = new THREE.MeshStandardMaterial({ color: '#171b18', roughness: 0.55 });
  const lips = new THREE.MeshStandardMaterial({ color: '#96634f', roughness: 0.83 });
  const innerEar = new THREE.MeshStandardMaterial({ color: new THREE.Color(avatar.skin).multiplyScalar(0.84), roughness: 0.94 });
  const primary = new THREE.MeshStandardMaterial({ color: '#ef7958', roughness: 0.77, polygonOffset: true, polygonOffsetFactor: -1 });
  const secondary = new THREE.MeshStandardMaterial({ color: '#e7b454', roughness: 0.81, polygonOffset: true, polygonOffsetFactor: -1 });
  const regionMaterials = new Map([skin, top, bottoms].map(material => [material, new THREE.MeshStandardMaterial({
    color: material.color.clone(),
    roughness: material.roughness,
    polygonOffset: true,
    polygonOffsetFactor: -1,
  })]));
  // Feather the illustrative color into the fitted clothing or skin at each
  // region edge. The opaque body underneath still supplies depth and shadows.
  [primary, secondary, ...regionMaterials.values()].forEach(material => {
    material.transparent = true;
    material.depthWrite = false;
    material.onBeforeCompile = shader => {
      shader.vertexShader = `attribute float muscleOpacity;\nvarying float vMuscleOpacity;\n${shader.vertexShader}`
        .replace('#include <begin_vertex>', '#include <begin_vertex>\nvMuscleOpacity = muscleOpacity;');
      shader.fragmentShader = `varying float vMuscleOpacity;\n${shader.fragmentShader}`
        .replace('#include <color_fragment>', '#include <color_fragment>\ndiffuseColor.a *= vMuscleOpacity;');
    };
    material.customProgramCacheKey = () => 'fitted-muscle-surface-v1';
  });
  const muscleMeshes = [];
  const up = new THREE.Vector3(0, 1, 0);
  const axisX = new THREE.Vector3(); const axisY = new THREE.Vector3(); const axisZ = new THREE.Vector3();
  const bodyFront = new THREE.Vector3(); const bodyUp = new THREE.Vector3();
  const limbFront = new THREE.Vector3(); const limbAcross = new THREE.Vector3();
  const localSide = new THREE.Vector3(); const inverseRotation = new THREE.Quaternion();
  const matrix = new THREE.Matrix4();
  const a = new THREE.Vector3(); const b = new THREE.Vector3(); const direction = new THREE.Vector3();
  const sphereGeometry = new THREE.SphereGeometry(1, 18, 12);
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
  // Shallow patches conform to the body surface, rather than floating capsules.
  // They remain part of their anatomical parent when the figure bends or rotates.
  function musclePatch(parent, region, baseMaterial, { low, high, shapeLow = low, shapeHigh = high, angle = 0, width = 0.5, radiusAt, depth = 1, offset = 0.006, bulge = 0.01 }) {
    const vertices = []; const indices = []; const opacities = [];
    const rows = 10; const columns = 10;
    for (let row = 0; row <= rows; row += 1) {
      const y = low + (high - low) * row / rows;
      const v = (y - shapeLow) / (shapeHigh - shapeLow);
      const outline = Math.pow(Math.max(0, Math.sin(Math.PI * v)), 0.42);
      for (let column = 0; column <= columns; column += 1) {
        const u = column / columns * 2 - 1;
        const theta = angle + u * width * outline;
        const contour = Math.pow(Math.max(0, Math.sin(Math.PI * v) * Math.cos(u * Math.PI / 2)), 0.8);
        const radius = radiusAt(y) + offset * 0.2 + bulge * 0.18 * contour;
        vertices.push(Math.sin(theta) * radius, y, Math.cos(theta) * radius * depth);
        opacities.push(THREE.MathUtils.smoothstep(1 - Math.abs(u), 0, 0.25)
          * THREE.MathUtils.smoothstep(v, 0, 0.10) * THREE.MathUtils.smoothstep(1 - v, 0, 0.10));
        if (row < rows && column < columns) {
          const a = row * (columns + 1) + column;
          const b = a + 1; const c = a + columns + 1; const d = c + 1;
          indices.push(a, b, d, a, d, c);
        }
      }
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
    geometry.setAttribute('muscleOpacity', new THREE.Float32BufferAttribute(opacities, 1));
    geometry.setIndex(indices); geometry.computeVertexNormals();
    const material = regionMaterials.get(baseMaterial) || baseMaterial;
    const mesh = new THREE.Mesh(geometry, material);
    mesh.name = `${parent.name || 'body'}-${region}`;
    mesh.userData.muscleRegion = region;
    mesh.userData.highlightRole = 'none';
    mesh.userData.regionAngle = angle;
    mesh.renderOrder = 1;
    parent.add(mesh);
    muscleMeshes.push({ mesh, material });
    return mesh;
  }
  function interpolateRadius(points, y) {
    for (let index = 1; index < points.length; index += 1) {
      if (y <= points[index][1]) {
        const [r0, y0] = points[index - 1]; const [r1, y1] = points[index];
        return r0 + (r1 - r0) * Math.max(0, (y - y0) / (y1 - y0));
      }
    }
    return points.at(-1)[0];
  }
  const limbProfile = (upper, lower) => [[0, -0.515], [upper * 0.66, -0.49], [upper, -0.35], [upper * 0.94, -0.08], [lower * 1.03, 0.31], [lower * 0.7, 0.48], [0, 0.515]];
  function connect(mesh, from, to, anterior) {
    a.fromArray(from); b.fromArray(to); direction.subVectors(b, a);
    mesh.position.copy(a).add(b).multiplyScalar(0.5);
    mesh.scale.set(1, direction.length(), 1);
    direction.normalize();
    if (anterior) {
      limbFront.copy(anterior).projectOnPlane(direction);
      if (limbFront.lengthSq() < 0.0001) limbFront.copy(bodyUp).projectOnPlane(direction);
      if (limbFront.lengthSq() < 0.0001) limbFront.set(1, 0, 0).projectOnPlane(direction);
      limbFront.normalize();
      limbAcross.crossVectors(direction, limbFront).normalize();
      limbFront.crossVectors(limbAcross, direction).normalize();
      matrix.makeBasis(limbAcross, direction, limbFront);
      mesh.quaternion.setFromRotationMatrix(matrix);
    } else mesh.quaternion.setFromUnitVectors(up, direction);
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
    mesh.name = `${from}-${to}`;
    const profile = limbProfile(upper, lower);
    const surfaceRadius = y => {
      let radius = interpolateRadius(profile, y);
      const t = y + 0.5;
      if (shorts && t >= 0 && t < 0.64) radius = Math.max(radius, interpolateRadius(limbProfile(upper * 1.1, upper * 0.97), t / 0.64 - 0.5));
      if (sleeve && t >= 0 && t < 0.46) radius = Math.max(radius, upper * (1.15 - 0.12 * t / 0.46));
      return radius;
    };
    const patch = (region, low, high, angle, width = 0.72, bulge = 0.006) => {
      const garmentEnd = shorts ? 0.14 : sleeve ? -0.04 : null;
      const intervals = garmentEnd !== null && low < garmentEnd && high > garmentEnd
        ? [[low, garmentEnd, shorts ? bottoms : top], [garmentEnd, high, skin]]
        : [[low, high, (thigh || calf) && avatar.leggings ? bottoms : garmentEnd !== null && high <= garmentEnd ? shorts ? bottoms : top : skin]];
      intervals.forEach(([start, end, material]) => musclePatch(mesh, region, material, { low: start, high: end, shapeLow: low, shapeHigh: high, angle, width, radiusAt: surfaceRadius, offset: 0.004, bulge }));
    };
    if (upperArm) {
      patch('biceps', -0.33, 0.38, 0, 0.8, 0.009);
      patch('triceps', -0.35, 0.36, Math.PI, 0.91, 0.008);
    } else if (from.includes('Elbow')) {
      patch('forearms', -0.36, 0.35, 0, 0.96, 0.004);
      patch('forearms', -0.37, 0.32, Math.PI, 0.88, 0.004);
    } else if (thigh) {
      patch('quads', -0.20, 0.39, -0.31, 0.43, 0.009);
      patch('quads', -0.23, 0.42, 0.35, 0.42, 0.009);
      patch('hamstrings', -0.30, 0.36, Math.PI, 0.88, 0.010);
      patch('hipFlexors', -0.46, -0.23, 0, 0.82, 0.004);
      patch('adductors', -0.37, 0.12, from.startsWith('left') ? Math.PI / 2 : -Math.PI / 2, 0.65, 0.006);
    } else if (calf) {
      patch('calves', -0.35, 0.25, Math.PI, 1.1, 0.014);
    }
    return { from, to, mesh, shorts, sleeve };
  });
  const torsoGroup = new THREE.Group(); torsoGroup.name = 'torso'; figure.add(torsoGroup);
  const torsoPoints = [[avatar.hipWidth * 0.79, 0], [avatar.waistWidth, 0.16], [avatar.waistWidth * 0.98, 0.32], [avatar.chestWidth * 0.92, 0.58], [avatar.chestWidth, 0.80], [avatar.chestWidth * 0.97, 0.94], [avatar.chestWidth * 0.72, 1.015], [0.12, 1.07]].map(([radius, y]) => new THREE.Vector2(radius, y));
  const torso = new THREE.Mesh(new THREE.LatheGeometry(torsoPoints, 28), top);
  torso.scale.z = 0.64; torso.castShadow = true; torsoGroup.add(torso);
  const torsoRadius = y => interpolateRadius(torsoPoints.map(point => [point.x, point.y]), y);
  const torsoPatch = (region, low, high, angle, width, bulge = 0.009) => musclePatch(torsoGroup, region, top, { low, high, angle, width, radiusAt: torsoRadius, depth: 0.64, offset: 0.004, bulge });
  for (const side of [-1, 1]) {
    torsoPatch('chest', 0.64, 0.97, side * 0.43, 0.43, 0.020);
    torsoPatch('lats', 0.22, 0.79, side * 2.12, 0.48, 0.009);
    torsoPatch('upperBack', 0.69, 1.015, side * 2.70, 0.43, 0.011);
    torsoPatch('obliques', 0.16, 0.64, side * 1.08, 0.26, 0.008);
    for (const [low, high] of [[0.16, 0.32], [0.33, 0.48], [0.49, 0.64]]) torsoPatch('abs', low, high, side * 0.20, 0.18, 0.012);
  }
  torsoPatch('lowerBack', 0.15, 0.60, Math.PI, 0.43, 0.007);
  const hips = ellipsoid(figure, bottoms, [avatar.hipWidth, 0.19, 0.195]);
  hips.name = 'pelvis';
  for (const side of [-1, 1]) musclePatch(hips, 'glutes', bottoms, { low: -0.79, high: 0.78, angle: Math.PI + side * 0.44, width: 0.48, radiusAt: y => Math.sqrt(Math.max(0, 1 - y * y)), offset: 0.016, bulge: 0.032 });
  const neck = taperedLimb(0.075, 0.068, skin);
  const shoulderBridges = ['leftShoulder', 'rightShoulder'].map((key) => ({ key, mesh: taperedLimb(0.084, 0.105 * avatar.limbScale, avatar.kind === 'woman' ? skin : top) }));
  const jointMeshes = ['leftShoulder', 'rightShoulder', 'leftElbow', 'rightElbow', 'leftKnee', 'rightKnee'].map((key) => {
    const shoulder = key.includes('Shoulder'); const knee = key.includes('Knee');
    const material = shoulder && avatar.kind !== 'woman' ? top : knee && avatar.leggings ? bottoms : skin;
    const radius = (shoulder ? 0.105 : knee ? 0.093 : 0.069) * avatar.limbScale;
    const mesh = ellipsoid(figure, material, [radius, radius, radius * 0.95]);
    mesh.name = key;
    if (shoulder) {
      const side = key.startsWith('left') ? -1 : 1;
      for (const [region, angle, width] of [['frontDelts', 0, 0.76], ['sideDelts', side * Math.PI / 2, 0.69], ['rearDelts', Math.PI, 0.76]]) {
        musclePatch(mesh, region, material, { low: -0.72, high: 0.67, angle, width, radiusAt: y => Math.sqrt(Math.max(0, 1 - y * y)), offset: 0.028, bulge: 0.036 });
      }
    }
    return { key, mesh };
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
  const headGeometry = new THREE.SphereGeometry(1, 28, 20);
  const headVertices = headGeometry.attributes.position;
  for (let index = 0; index < headVertices.count; index += 1) {
    const x = headVertices.getX(index); const y = headVertices.getY(index); const z = headVertices.getZ(index);
    const jawTaper = 1 - Math.max(0, -y - 0.1) * (avatar.kind === 'man' ? 0.13 : 0.22);
    const chin = z > 0 && y < -0.35 ? Math.max(0, 1 - Math.abs(y + 0.67) / 0.36) * 0.055 : 0;
    headVertices.setXYZ(index, x * jawTaper, y, z + chin);
  }
  headGeometry.computeVertexNormals();
  const head = new THREE.Mesh(headGeometry, skin);
  head.name = 'face-contour'; head.scale.set(0.165, 0.215, 0.169); head.castShadow = true;
  headGroup.add(head);
  // The small facial volumes overlap the head surface to create cheekbones,
  // a jaw, nose bridge and eyelids without detached features.
  ellipsoid(headGroup, skin, [0.073, 0.035, 0.030], [0, -0.146, 0.089]);
  ellipsoid(headGroup, skin, [0.019, 0.047, 0.019], [0, 0.018, 0.153]);
  ellipsoid(headGroup, skin, [0.022, 0.017, 0.021], [0, -0.012, 0.168]);
  [-1, 1].forEach((side) => {
    ellipsoid(headGroup, skin, [0.042, 0.033, 0.013], [side * 0.089, -0.031, 0.127]);
    ellipsoid(headGroup, skin, [0.020, 0.043, 0.024], [side * 0.162, -0.004, -0.008]);
    ellipsoid(headGroup, innerEar, [0.008, 0.027, 0.012], [side * 0.177, -0.005, 0.003]);
    ellipsoid(headGroup, skin, [0.009, 0.014, 0.014], [side * 0.164, -0.016, 0.014]);
    ellipsoid(headGroup, skin, [0.014, 0.010, 0.012], [side * 0.020, -0.020, 0.162]);
    ellipsoid(headGroup, innerEar, [0.004, 0.0025, 0.004], [side * 0.014, -0.025, 0.173]);
    ellipsoid(headGroup, eyeWhite, [0.024, 0.0085, 0.005], [side * 0.060, 0.044, 0.153]);
    ellipsoid(headGroup, iris, [0.007, 0.0075, 0.003], [side * 0.060, 0.044, 0.158]);
    ellipsoid(headGroup, pupil, [0.0034, 0.0044, 0.0015], [side * 0.060, 0.044, 0.161]);
    ellipsoid(headGroup, eyeWhite, [0.0012, 0.0014, 0.001], [side * 0.060 - 0.0015, 0.046, 0.1625]);
    ellipsoid(headGroup, skin, [0.027, 0.0045, 0.007], [side * 0.060, 0.0525, 0.153]);
    ellipsoid(headGroup, skin, [0.027, 0.0035, 0.006], [side * 0.060, 0.035, 0.153]);
    ellipsoid(headGroup, skin, [0.035, 0.016, 0.018], [side * 0.060, 0.073, 0.140]);
    const brow = ellipsoid(headGroup, hair, [0.030, 0.0045, 0.006], [side * 0.060, 0.073, 0.154]);
    brow.rotation.z = -side * 0.08;
  });
  ellipsoid(headGroup, lips, [0.033, 0.006, 0.009], [0, -0.074, 0.152]);
  ellipsoid(headGroup, lips, [0.030, 0.008, 0.010], [0, -0.084, 0.148]);
  ellipsoid(headGroup, faceDetail, [0.030, 0.0018, 0.003], [0, -0.078, 0.160]);
  // A higher front hairline leaves the brow and eyes visible; the back reaches
  // the nape. The old hemispherical cap covered the front of the face.
  const hairVertices = []; const hairIndices = [];
  for (let row = 0; row <= 12; row += 1) {
    for (let column = 0; column <= 28; column += 1) {
      const phi = column / 28 * Math.PI * 2;
      const theta = row / 12 * (1.45 - Math.cos(phi) * 0.40);
      hairVertices.push(Math.sin(phi) * Math.sin(theta) * 0.170, Math.cos(theta) * 0.220 + 0.008, Math.cos(phi) * Math.sin(theta) * 0.175 - 0.006);
      if (row < 12 && column < 28) {
        const a = row * 29 + column; const b = a + 1; const c = a + 29; const d = c + 1;
        hairIndices.push(a, c, d, a, d, b);
      }
    }
  }
  const hairGeometry = new THREE.BufferGeometry();
  hairGeometry.setAttribute('position', new THREE.Float32BufferAttribute(hairVertices, 3));
  hairGeometry.setIndex(hairIndices); hairGeometry.computeVertexNormals();
  const scalp = new THREE.Mesh(hairGeometry, hair);
  scalp.name = 'sculpted-hairline'; scalp.castShadow = true; headGroup.add(scalp);
  if (avatar.kind === 'woman') {
    ellipsoid(headGroup, hair, [0.091, 0.087, 0.099], [0, 0.108, -0.188]);
    ellipsoid(headGroup, trim, [0.067, 0.05, 0.025], [0, 0.096, -0.164]);
  } else {
    const sweptHair = ellipsoid(headGroup, hair, [0.123, 0.049, 0.116], [0.010, 0.203, 0.005]);
    sweptHair.rotation.z = -0.12;
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
  function alignLateralPatch(mesh, region, worldSide) {
    inverseRotation.copy(mesh.quaternion).invert();
    localSide.fromArray(worldSide).applyQuaternion(inverseRotation);
    const angle = Math.atan2(localSide.x, localSide.z);
    mesh.children.forEach(child => {
      if (child.userData.muscleRegion === region) child.rotation.y = angle - child.userData.regionAngle;
    });
  }
  function setHighlights(nextTargets = { primary: [], secondary: [] }, enabled = true) {
    const primaryRegions = new Set(Array.isArray(nextTargets?.primary) ? nextTargets.primary : []);
    const secondaryRegions = new Set(Array.isArray(nextTargets?.secondary) ? nextTargets.secondary : []);
    muscleMeshes.forEach(({ mesh, material }) => {
      const region = mesh.userData.muscleRegion;
      const role = enabled && primaryRegions.has(region) ? 'primary' : enabled && secondaryRegions.has(region) ? 'secondary' : 'none';
      mesh.userData.highlightRole = role;
      mesh.material = role === 'primary' ? primary : role === 'secondary' ? secondary : material;
    });
  }
  setHighlights(targets);
  return {
    setHighlights,
    update(pose, movement) {
      const bodyAxis = pose.shoulder.map((value, index) => value - pose.hip[index]);
      const across = pose.rightShoulder.map((value, index) => value - pose.leftShoulder[index]);
      const faceUp = supineMovements.has(movement);
      torsoGroup.position.fromArray(pose.hip);
      orient(torsoGroup, bodyAxis, across, faceUp);
      torsoGroup.scale.set(1, Math.hypot(...bodyAxis), 1);
      hips.position.fromArray(pose.hip); hips.quaternion.copy(torsoGroup.quaternion);
      bodyFront.set(0, 0, 1).applyQuaternion(torsoGroup.quaternion);
      bodyUp.set(0, 1, 0).applyQuaternion(torsoGroup.quaternion);
      limbs.forEach(({ from, to, mesh, shorts, sleeve }) => {
        connect(mesh, pose[from], pose[to], bodyFront);
        if (shorts) connect(shorts, pose[from], pose[from].map((value, index) => value + (pose[to][index] - value) * 0.64), bodyFront);
        if (sleeve) connect(sleeve, pose[from], pose[from].map((value, index) => value + (pose[to][index] - value) * 0.46), bodyFront);
        if (from.includes('Hip')) alignLateralPatch(mesh, 'adductors', pose.hip.map((value, index) => value - pose[from][index]));
      });
      jointMeshes.forEach(({ key, mesh }) => {
        mesh.position.fromArray(pose[key]);
        if (key.includes('Shoulder')) {
          mesh.quaternion.copy(limbs.find(limb => limb.from === key).mesh.quaternion);
          alignLateralPatch(mesh, 'sideDelts', pose[key].map((value, index) => value - pose.shoulder[index]));
        }
      });
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
        if (['walking', 'cycling'].includes(movement)) group.rotation.set(0, 0, 0);
        else if (movement === 'calfraise') group.rotation.x = Math.atan2(pose[key][1] - 0.13, 0.24);
        else if (pose[key][1] > 0.32) {
          direction.fromArray(pose[key.replace('Ankle', 'Knee')]).sub(a.fromArray(pose[key])).normalize();
          group.quaternion.setFromUnitVectors(up, direction);
        } else if (['pushup', 'plank', 'mountainclimber', 'birddog', 'superman'].includes(movement)) group.rotation.x = 0.85;
      });
    },
    dispose() {
      const geometries = new Set();
      const materials = new Set([primary, secondary, ...regionMaterials.values()]);
      figure.traverse(object => {
        if (object.geometry) geometries.add(object.geometry);
        if (object.material) (Array.isArray(object.material) ? object.material : [object.material]).forEach(material => materials.add(material));
      });
      geometries.forEach(geometry => geometry.dispose());
      materials.forEach(material => material.dispose());
      figure.removeFromParent();
    },
  };
}
