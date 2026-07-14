import * as THREE from 'three/webgpu';
import { OrbitControls } from '../vendor/OrbitControls.js';

const viewer = document.querySelector('#viewer');
const fallback = document.querySelector('#fallback');
const paramsForm = document.querySelector('#paramsForm');
const selectedName = document.querySelector('#selectedName');
const rendererStatus = document.querySelector('#rendererStatus');
const versionSelect = document.querySelector('#versionSelect');
const explodedControl = document.querySelector('#explodedAmount');
const resetButton = document.querySelector('#resetButton');
const exportButton = document.querySelector('#exportButton');

const versionPresets = {
  v1: {
    base: { width: 5.8, depth: 3.0, height: 0.36, cornerRadius: 0.5 },
    feet: { radius: 0.38, heightScale: 0.42, xOffset: 2.25, zOffset: 1.05 },
    body: { width: 3.9, depth: 2.2, height: 0.78, roundness: 0.22 },
    transitionLayer: { width: 4.45, depth: 2.75, height: 0.24, expansion: 0.18, roundness: 0.32 },
    shell: { width: 5.15, depth: 3.25, height: 0.82, roundness: 0.52, taper: 0.09, sideCurve: 0.22 },
    massageHead: { width: 3.35, depth: 1.95, height: 0.46, curvature: 0.34 },
    spikes: { rows: 8, columns: 20, height: 0.28, radius: 0.065, spacing: 0.18, curvatureInfluence: 1.0 },
  },
  v2: {
    base: { width: 5.8, depth: 2.75, height: 0.22, cornerRadius: 0.5, waist: 0.34, cornerBulge: 0.22, profile: 'physical' },
    feet: { radius: 0.43, heightScale: 0.46, xOffset: 2.25, zOffset: 1.02, flatTop: true },
    body: { width: 4.28, depth: 1.78, height: 0.58, roundness: 0.18 },
    transitionLayer: { width: 4.9, depth: 2.34, height: 0.16, expansion: 0.08, roundness: 0.36 },
    foam: { width: 5.35, depth: 2.62, cushionHeight: 0.62, headWidth: 3.85, headDepth: 1.45, headHeight: 0.55, roundness: 0.54, saddleCurvature: 0.24, edgeBlend: 0.34 },
    guidePosts: { radius: 0.075, height: 1.02, xOffset: 1.55, rearOffset: 0.78 },
    spikes: { rows: 7, columns: 22, height: 0.24, radius: 0.055, spacing: 0.15, curvatureInfluence: 1.0, bluntness: 0.88 },
  },
  v3: {
    base: { width: 5.8, depth: 2.75, height: 0.22, cornerRadius: 0.5, waist: 0.34, cornerBulge: 0.22, profile: 'physical' },
    feet: { radius: 0.43, heightScale: 0.46, xOffset: 2.25, zOffset: 1.02, flatTop: true },
    motionUnit: { width: 4.18, depth: 1.82, height: 0.92, roundness: 0.28, topCapHeight: 0.13 },
    transitionLayer: { width: 4.7, depth: 2.35, height: 0.14, expansion: 0.05, roundness: 0.32 },
    upperApplication: { width: 5.35, depth: 3.0, height: 0.64, rim: 0.28, roundness: 0.38, insetDepth: 0.11, meshHeight: 0.055 },
    meshPad: { width: 4.55, depth: 2.2, height: 0.1, rows: 17, columns: 31, sag: 0.12 },
  },
};

let currentVersion = 'v3';
let defaultDesignParams = versionPresets[currentVersion];
let designParams = structuredClone(defaultDesignParams);
const originalY = {
  Base: 0,
  Feet: -0.02,
  MachineBody: 0.48,
  WhiteTransitionLayer: 1.24,
  BlueOuterShell: 1.48,
  MassageHead: 2.32,
  MassageSpikes: 2.32,
  GuidePosts: 1.22,
  PUFoamBody: 1.42,
  SaddleMotionUnit: 0.48,
  MotionTransitionLayer: 1.54,
  UpperCoreApplication: 1.68,
  MeshSupportPad: 1.68,
};

const explodedLayer = {
  Base: 0,
  Feet: 0,
  MachineBody: 0.35,
  WhiteTransitionLayer: 0.85,
  BlueOuterShell: 1.25,
  MassageHead: 1.75,
  MassageSpikes: 1.75,
  GuidePosts: 0.15,
  PUFoamBody: 1.35,
  SaddleMotionUnit: 0.55,
  MotionTransitionLayer: 0.9,
  UpperCoreApplication: 1.35,
  MeshSupportPad: 1.35,
};

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x0a0f17);

const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 100);
camera.position.set(6, 4.8, 7.8);

let renderer = new THREE.WebGPURenderer({ antialias: true });

try {
  await renderer.init();
} catch (webgpuError) {
  renderer = new THREE.WebGPURenderer({ antialias: true, forceWebGL: true });
  await renderer.init();
  fallback.hidden = false;
  fallback.textContent = `WebGPU 初始化失敗（${webgpuError.message}），已使用 WebGPURenderer 的 WebGL2 backend。模型仍可正常操作。`;
}

const usingWebGPU = renderer.backend?.isWebGPUBackend === true;
const usingWebGLBackend = renderer.backend?.isWebGLBackend === true;

renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
viewer.appendChild(renderer.domElement);

if (usingWebGPU) {
  rendererStatus.textContent = 'Renderer: Three.js WebGPURenderer active';
} else if (usingWebGLBackend) {
  fallback.hidden = false;
  fallback.textContent ||= 'WebGPU 未被瀏覽器提供，已自動使用 WebGPURenderer 的 WebGL2 backend。模型仍可正常操作。';
  rendererStatus.textContent = 'Renderer: Three.js WebGPURenderer with WebGL2 backend fallback';
} else {
  rendererStatus.textContent = 'Renderer: Three.js WebGPURenderer active, backend unknown';
}

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.target.set(0, 1.45, 0);
controls.minDistance = 4;
controls.maxDistance = 14;

const raycaster = new THREE.Raycaster();
const pointer = new THREE.Vector2();
let selectedMesh = null;
let selectedOriginalEmissive = null;
let outline = null;
let explodedAmount = 0;

const materials = {
  base: new THREE.MeshStandardMaterial({ color: 0x151515, roughness: 0.82, metalness: 0.02 }),
  foot: new THREE.MeshStandardMaterial({ color: 0x1d1a15, roughness: 0.86, metalness: 0.01 }),
  footTop: new THREE.MeshStandardMaterial({ color: 0x5a554b, roughness: 0.92, metalness: 0.0 }),
  body: new THREE.MeshStandardMaterial({ color: 0x101114, roughness: 0.7, metalness: 0.08 }),
  transition: new THREE.MeshStandardMaterial({ color: 0xe8e2d5, roughness: 0.42, metalness: 0.02 }),
  shell: new THREE.MeshStandardMaterial({ color: 0x142b78, roughness: 0.48, metalness: 0.04 }),
  head: new THREE.MeshStandardMaterial({ color: 0x17150f, roughness: 0.78, metalness: 0.02 }),
  foam: new THREE.MeshStandardMaterial({ color: 0x121a3d, roughness: 0.72, metalness: 0.01 }),
  guidePost: new THREE.MeshStandardMaterial({ color: 0x16181d, roughness: 0.48, metalness: 0.35 }),
  spikes: new THREE.MeshStandardMaterial({ color: 0x242016, roughness: 0.86, metalness: 0.01 }),
  motionUnit: new THREE.MeshStandardMaterial({ color: 0x111216, roughness: 0.62, metalness: 0.12 }),
  motionCap: new THREE.MeshStandardMaterial({ color: 0x292c31, roughness: 0.45, metalness: 0.2 }),
  application: new THREE.MeshStandardMaterial({ color: 0x172f80, roughness: 0.5, metalness: 0.03 }),
  meshPad: new THREE.MeshStandardMaterial({ color: 0xdb777d, roughness: 0.8, metalness: 0.0 }),
  ground: new THREE.MeshStandardMaterial({ color: 0x202832, roughness: 0.74, metalness: 0.0 }),
};

const machineGroup = new THREE.Group();
machineGroup.name = 'machineGroup';
scene.add(machineGroup);

const parts = new Map();

function disposeObject(object) {
  if (!object) return;
  object.traverse((child) => {
    if (child.geometry) child.geometry.dispose();
  });
}

function roundedRectShape(width, depth, radius, sideCurve = 0, irregularity = 0) {
  const shape = new THREE.Shape();
  const halfW = width / 2;
  const halfD = depth / 2;
  const steps = 12;
  const points = [];

  for (let i = 0; i <= steps; i += 1) {
    const t = i / steps;
    const angle = Math.PI + t * Math.PI / 2;
    points.push(cornerPoint(angle, -halfW + radius, -halfD + radius, radius, sideCurve, irregularity));
  }
  for (let i = 0; i <= steps; i += 1) {
    const t = i / steps;
    const angle = -Math.PI / 2 + t * Math.PI / 2;
    points.push(cornerPoint(angle, halfW - radius, -halfD + radius, radius, sideCurve, irregularity));
  }
  for (let i = 0; i <= steps; i += 1) {
    const t = i / steps;
    const angle = t * Math.PI / 2;
    points.push(cornerPoint(angle, halfW - radius, halfD - radius, radius, sideCurve, irregularity));
  }
  for (let i = 0; i <= steps; i += 1) {
    const t = i / steps;
    const angle = Math.PI / 2 + t * Math.PI / 2;
    points.push(cornerPoint(angle, -halfW + radius, halfD - radius, radius, sideCurve, irregularity));
  }

  shape.moveTo(points[0].x, points[0].y);
  for (let i = 1; i < points.length; i += 1) shape.lineTo(points[i].x, points[i].y);
  shape.closePath();
  return shape;
}

function cornerPoint(angle, cx, cy, radius, sideCurve, irregularity) {
  let x = cx + Math.cos(angle) * radius;
  let y = cy + Math.sin(angle) * radius;
  const normalizedY = Math.abs(y / Math.max(Math.abs(cy) + radius, 0.001));
  x *= 1 + sideCurve * 0.06 * (1 - normalizedY * normalizedY);
  y += Math.sin(x * 2.2) * irregularity;
  return new THREE.Vector2(x, y);
}

function extrudeShapeGeometry(shape, height, bevelSize = 0.05) {
  const geometry = new THREE.ExtrudeGeometry(shape, {
    depth: height,
    bevelEnabled: true,
    bevelSize,
    bevelThickness: bevelSize,
    bevelSegments: 8,
  });
  geometry.rotateX(Math.PI / 2);
  geometry.computeVertexNormals();
  return geometry;
}

function createBaseGeometry(params) {
  if (params.profile === 'physical') {
    const shape = new THREE.Shape();
    const halfW = params.width / 2;
    const halfD = params.depth / 2;
    const radius = params.cornerRadius;
    const waist = params.waist ?? 0.3;
    const bulge = params.cornerBulge ?? 0.18;

    shape.moveTo(-halfW + radius, -halfD);
    shape.bezierCurveTo(-halfW * 0.45, -halfD * (1 - waist), halfW * 0.45, -halfD * (1 - waist), halfW - radius, -halfD);
    shape.quadraticCurveTo(halfW + bulge, -halfD, halfW, -halfD + radius);
    shape.bezierCurveTo(halfW * (1 - waist * 0.26), -halfD * 0.32, halfW * (1 - waist * 0.26), halfD * 0.32, halfW, halfD - radius);
    shape.quadraticCurveTo(halfW + bulge, halfD, halfW - radius, halfD);
    shape.bezierCurveTo(halfW * 0.45, halfD * (1 - waist), -halfW * 0.45, halfD * (1 - waist), -halfW + radius, halfD);
    shape.quadraticCurveTo(-halfW - bulge, halfD, -halfW, halfD - radius);
    shape.bezierCurveTo(-halfW * (1 - waist * 0.26), halfD * 0.32, -halfW * (1 - waist * 0.26), -halfD * 0.32, -halfW, -halfD + radius);
    shape.quadraticCurveTo(-halfW - bulge, -halfD, -halfW + radius, -halfD);

    return extrudeShapeGeometry(shape, params.height, 0.035);
  }

  const shape = new THREE.Shape();
  const pointCount = 120;
  const points = [];

  for (let i = 0; i < pointCount; i += 1) {
    const angle = (i / pointCount) * Math.PI * 2;
    const c = Math.cos(angle);
    const s = Math.sin(angle);
    const xBase = Math.sign(c) * Math.pow(Math.abs(c), 0.44) * params.width / 2;
    const z = Math.sign(s) * Math.pow(Math.abs(s), 0.56) * params.depth / 2;
    const waist = 1 - 0.22 * (1 - Math.pow(Math.abs(z) / (params.depth / 2), 2));
    const cornerLobe = 1 + 0.09 * Math.pow(Math.abs(s), 2);
    points.push(new THREE.Vector2(xBase * waist * cornerLobe, z));
  }

  shape.moveTo(points[0].x, points[0].y);
  for (let i = 1; i < points.length; i += 1) shape.lineTo(points[i].x, points[i].y);
  shape.closePath();
  return extrudeShapeGeometry(shape, params.height, 0.06);
}

function createRoundedExtrudeGeometry(params, sideCurve = 0, irregularity = 0) {
  const shape = roundedRectShape(params.width, params.depth, params.roundness || params.cornerRadius || 0.2, sideCurve, irregularity);
  return extrudeShapeGeometry(shape, params.height, Math.min((params.roundness || 0.2) * 0.18, params.height * 0.25));
}

function makeSoftRectPoints(width, depth, roundness, sideCurve, count = 96) {
  const points = [];
  const exponent = 4.2 - THREE.MathUtils.clamp(roundness, 0.05, 0.9) * 1.7;
  for (let i = 0; i < count; i += 1) {
    const a = (i / count) * Math.PI * 2;
    const c = Math.cos(a);
    const s = Math.sin(a);
    let x = Math.sign(c) * Math.pow(Math.abs(c), 2 / exponent) * width / 2;
    const z = Math.sign(s) * Math.pow(Math.abs(s), 2 / exponent) * depth / 2;
    const sideBulge = 1 + sideCurve * 0.1 * (1 - Math.pow(Math.abs(z) / (depth / 2), 2));
    x *= sideBulge;
    points.push(new THREE.Vector2(x, z));
  }
  return points;
}

function createSoftBoxGeometry(params) {
  const points = makeSoftRectPoints(params.width, params.depth, params.roundness, params.sideCurve, 112);
  const vertices = [];
  const normals = [];
  const indices = [];
  const topScale = 1 - params.taper;
  const bottomY = 0;
  const topY = params.height;

  for (const point of points) vertices.push(point.x, bottomY, point.y);
  for (const point of points) vertices.push(point.x * topScale, topY, point.y * (1 - params.taper * 0.45));
  vertices.push(0, bottomY, 0, 0, topY, 0);

  const count = points.length;
  const bottomCenter = count * 2;
  const topCenter = count * 2 + 1;

  for (let i = 0; i < count; i += 1) {
    const next = (i + 1) % count;
    indices.push(i, next, count + next, i, count + next, count + i);
    indices.push(bottomCenter, next, i);
    indices.push(topCenter, count + i, count + next);
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

function headSurfaceY(x, params) {
  const normalizedX = x / (params.width / 2);
  return params.height + params.curvature * Math.pow(Math.abs(normalizedX), 1.7);
}

function smoothstep(edge0, edge1, value) {
  const t = THREE.MathUtils.clamp((value - edge0) / (edge1 - edge0), 0, 1);
  return t * t * (3 - 2 * t);
}

function foamSurfaceY(x, z, params) {
  const xEdge = params.headWidth / 2;
  const zEdge = params.headDepth / 2;
  const blend = Math.max(params.edgeBlend, 0.01);
  const xMask = 1 - smoothstep(xEdge - blend, xEdge + blend, Math.abs(x));
  const zMask = 1 - smoothstep(zEdge - blend, zEdge + blend, Math.abs(z));
  const islandMask = xMask * zMask;
  const saddle = params.saddleCurvature * Math.pow(Math.abs(x) / Math.max(xEdge, 0.001), 1.65);
  const edgeSoftening = 1 - smoothstep(params.width * 0.38, params.width * 0.5, Math.abs(x)) * 0.08;

  return (params.cushionHeight + islandMask * (params.headHeight + saddle)) * edgeSoftening;
}

function createPUFoamGeometry(params) {
  const segX = 44;
  const segZ = 24;
  const vertices = [];
  const indices = [];

  for (let zIndex = 0; zIndex <= segZ; zIndex += 1) {
    const v = zIndex / segZ;
    const z = -params.depth / 2 + v * params.depth;
    for (let xIndex = 0; xIndex <= segX; xIndex += 1) {
      const u = xIndex / segX;
      const x = -params.width / 2 + u * params.width;
      const cornerRound = 1 - Math.pow(Math.abs(x) / (params.width / 2), 6) * Math.pow(Math.abs(z) / (params.depth / 2), 6) * params.roundness * 0.18;
      vertices.push(x * cornerRound, foamSurfaceY(x, z, params), z * cornerRound);
    }
  }

  const topCount = vertices.length / 3;
  for (let zIndex = 0; zIndex <= segZ; zIndex += 1) {
    const v = zIndex / segZ;
    const z = -params.depth / 2 + v * params.depth;
    for (let xIndex = 0; xIndex <= segX; xIndex += 1) {
      const u = xIndex / segX;
      const x = -params.width / 2 + u * params.width;
      const cornerRound = 1 - Math.pow(Math.abs(x) / (params.width / 2), 6) * Math.pow(Math.abs(z) / (params.depth / 2), 6) * params.roundness * 0.18;
      vertices.push(x * cornerRound, 0, z * cornerRound);
    }
  }

  const row = segX + 1;
  for (let z = 0; z < segZ; z += 1) {
    for (let x = 0; x < segX; x += 1) {
      const a = z * row + x;
      const b = a + 1;
      const c = a + row;
      const d = c + 1;
      indices.push(a, c, b, b, c, d);
      indices.push(topCount + a, topCount + b, topCount + c, topCount + b, topCount + d, topCount + c);
    }
  }

  for (let x = 0; x < segX; x += 1) {
    indices.push(x, x + 1, topCount + x, x + 1, topCount + x + 1, topCount + x);
    const back = segZ * row + x;
    indices.push(back, topCount + back, back + 1, back + 1, topCount + back, topCount + back + 1);
  }
  for (let z = 0; z < segZ; z += 1) {
    const left = z * row;
    const right = z * row + segX;
    indices.push(left, topCount + left, left + row, left + row, topCount + left, topCount + left + row);
    indices.push(right, right + row, topCount + right, right + row, topCount + right + row, topCount + right);
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

function createMassageHeadGeometry(params) {
  const segX = 36;
  const segZ = 18;
  const vertices = [];
  const indices = [];

  for (let zIndex = 0; zIndex <= segZ; zIndex += 1) {
    const z = -params.depth / 2 + (zIndex / segZ) * params.depth;
    for (let xIndex = 0; xIndex <= segX; xIndex += 1) {
      const x = -params.width / 2 + (xIndex / segX) * params.width;
      const edgeFalloff = 1 - Math.pow(Math.abs(z) / (params.depth / 2), 3) * 0.08;
      vertices.push(x, headSurfaceY(x, params) * edgeFalloff, z);
    }
  }
  const topCount = vertices.length / 3;
  for (let zIndex = 0; zIndex <= segZ; zIndex += 1) {
    const z = -params.depth / 2 + (zIndex / segZ) * params.depth;
    for (let xIndex = 0; xIndex <= segX; xIndex += 1) {
      const x = -params.width / 2 + (xIndex / segX) * params.width;
      vertices.push(x, 0, z);
    }
  }

  const row = segX + 1;
  for (let z = 0; z < segZ; z += 1) {
    for (let x = 0; x < segX; x += 1) {
      const a = z * row + x;
      const b = a + 1;
      const c = a + row;
      const d = c + 1;
      indices.push(a, c, b, b, c, d);
      indices.push(topCount + a, topCount + b, topCount + c, topCount + b, topCount + d, topCount + c);
    }
  }
  for (let x = 0; x < segX; x += 1) {
    indices.push(x, x + 1, topCount + x, x + 1, topCount + x + 1, topCount + x);
    const back = segZ * row + x;
    indices.push(back, topCount + back, back + 1, back + 1, topCount + back, topCount + back + 1);
  }
  for (let z = 0; z < segZ; z += 1) {
    const left = z * row;
    const right = z * row + segX;
    indices.push(left, topCount + left, left + row, left + row, topCount + left, topCount + left + row);
    indices.push(right, right + row, topCount + right, right + row, topCount + right + row, topCount + right);
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

function createFeetGroup(params) {
  const group = new THREE.Group();
  group.name = 'Feet';
  for (const x of [-params.xOffset, params.xOffset]) {
    for (const z of [-params.zOffset, params.zOffset]) {
      if (params.flatTop) {
        const height = params.radius * 1.0;
        const side = new THREE.Mesh(new THREE.CylinderGeometry(params.radius, params.radius * 1.08, height, 40), materials.foot);
        side.name = 'Feet';
        side.position.set(x, height / 2 - 0.03, z);
        side.castShadow = true;
        side.receiveShadow = true;
        group.add(side);

        const shoulder = new THREE.Mesh(new THREE.TorusGeometry(params.radius * 0.86, params.radius * 0.09, 10, 40), materials.foot);
        shoulder.name = 'Feet';
        shoulder.rotation.x = Math.PI / 2;
        shoulder.position.set(x, height - 0.02, z);
        shoulder.castShadow = true;
        group.add(shoulder);

        const top = new THREE.Mesh(new THREE.CylinderGeometry(params.radius * 0.72, params.radius * 0.78, 0.04, 36), materials.footTop);
        top.name = 'Feet';
        top.position.set(x, height + 0.015, z);
        top.castShadow = true;
        group.add(top);
      } else {
        const foot = new THREE.Mesh(new THREE.SphereGeometry(params.radius, 32, 16), materials.foot);
        foot.name = 'Feet';
        foot.scale.set(1.15, params.heightScale, 0.9);
        foot.position.set(x, 0, z);
        foot.castShadow = true;
        foot.receiveShadow = true;
        group.add(foot);
      }
    }
  }
  return group;
}

function createGuidePostsGroup(params) {
  const group = new THREE.Group();
  group.name = 'GuidePosts';
  for (const x of [-params.xOffset, params.xOffset]) {
    const post = new THREE.Mesh(new THREE.CylinderGeometry(params.radius, params.radius, params.height, 24), materials.guidePost);
    post.name = 'GuidePosts';
    post.position.set(x, params.height / 2, params.rearOffset);
    post.castShadow = true;
    post.receiveShadow = true;
    group.add(post);

    const cap = new THREE.Mesh(new THREE.CylinderGeometry(params.radius * 1.55, params.radius * 1.55, 0.055, 24), materials.guidePost);
    cap.name = 'GuidePosts';
    cap.position.set(x, params.height + 0.025, params.rearOffset);
    cap.castShadow = true;
    group.add(cap);
  }
  return group;
}

function createSaddleMotionUnit(params) {
  const group = new THREE.Group();
  group.name = 'SaddleMotionUnit';

  const housing = new THREE.Mesh(createRoundedExtrudeGeometry({ ...params, height: params.height, roundness: params.roundness }, 0.04, 0), materials.motionUnit);
  housing.name = 'SaddleMotionUnit';
  housing.position.y = params.height * 0.5;
  housing.castShadow = true;
  housing.receiveShadow = true;
  group.add(housing);

  const cap = new THREE.Mesh(createRoundedExtrudeGeometry({ width: params.width * 0.95, depth: params.depth * 0.92, height: params.topCapHeight, roundness: params.roundness * 0.65 }, 0, 0), materials.motionCap);
  cap.name = 'SaddleMotionUnit';
  cap.position.y = params.height + params.topCapHeight * 0.5;
  cap.castShadow = true;
  group.add(cap);

  const frontPanel = new THREE.Mesh(new THREE.BoxGeometry(params.width * 0.58, 0.28, 0.035), materials.motionCap);
  frontPanel.name = 'SaddleMotionUnit';
  frontPanel.position.set(0, params.height * 0.5, -params.depth * 0.505);
  frontPanel.castShadow = true;
  group.add(frontPanel);

  for (const x of [-params.width * 0.36, params.width * 0.36]) {
    const mount = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.18, 0.1, 20), materials.motionUnit);
    mount.name = 'SaddleMotionUnit';
    mount.position.set(x, 0.05, 0);
    mount.castShadow = true;
    group.add(mount);
  }
  return group;
}

function createUpperCoreApplication(params, meshParams) {
  const group = new THREE.Group();
  group.name = 'UpperCoreApplication';

  const blueFrame = new THREE.Mesh(createRoundedExtrudeGeometry({ width: params.width, depth: params.depth, height: params.height, roundness: params.roundness }, 0.06, 0), materials.application);
  blueFrame.name = 'UpperCoreApplication';
  blueFrame.position.y = params.height * 0.5;
  blueFrame.castShadow = true;
  blueFrame.receiveShadow = true;
  group.add(blueFrame);

  const meshBase = new THREE.Mesh(createRoundedExtrudeGeometry({ width: meshParams.width, depth: meshParams.depth, height: meshParams.height, roundness: Math.min(params.roundness, 0.22) }, 0, 0), materials.meshPad);
  meshBase.name = 'MeshSupportPad';
  meshBase.position.y = params.height + meshParams.height * 0.5 - params.insetDepth;
  meshBase.castShadow = true;
  group.add(meshBase);

  const lineMaterial = new THREE.MeshStandardMaterial({ color: 0xf3a0a0, roughness: 0.75 });
  const lineRadius = 0.012;
  for (let row = 0; row < meshParams.rows; row += 1) {
    const z = -meshParams.depth * 0.46 + (row / Math.max(meshParams.rows - 1, 1)) * meshParams.depth * 0.92;
    const sag = meshParams.sag * (1 - Math.pow(z / (meshParams.depth * 0.5), 2));
    const line = new THREE.Mesh(new THREE.CylinderGeometry(lineRadius, lineRadius, meshParams.width * 0.92, 8), lineMaterial);
    line.name = 'MeshSupportPad';
    line.rotation.z = Math.PI / 2;
    line.position.set(0, params.height + meshParams.height - params.insetDepth - sag, z);
    group.add(line);
  }
  for (let column = 0; column < meshParams.columns; column += 1) {
    const x = -meshParams.width * 0.46 + (column / Math.max(meshParams.columns - 1, 1)) * meshParams.width * 0.92;
    const sag = meshParams.sag * (1 - Math.pow(x / (meshParams.width * 0.5), 2));
    const line = new THREE.Mesh(new THREE.CylinderGeometry(lineRadius, lineRadius, meshParams.depth * 0.92, 8), lineMaterial);
    line.name = 'MeshSupportPad';
    line.rotation.x = Math.PI / 2;
    line.position.set(x, params.height + meshParams.height - params.insetDepth - sag, 0);
    group.add(line);
  }

  return group;
}

function createSpikesMesh(spikeParams, surfaceParams, mode = 'v1') {
  const count = spikeParams.rows * spikeParams.columns;
  const spikeRadius = mode === 'v2' ? spikeParams.radius * (0.75 + spikeParams.bluntness * 0.35) : spikeParams.radius;
  const geometry = mode === 'v2'
    ? new THREE.CapsuleGeometry(spikeRadius, Math.max(spikeParams.height - spikeRadius * 2, 0.01), 5, 12)
    : new THREE.ConeGeometry(spikeRadius, spikeParams.height, 12);
  const mesh = new THREE.InstancedMesh(geometry, materials.spikes, count);
  mesh.name = 'MassageSpikes';
  mesh.castShadow = true;
  mesh.receiveShadow = true;

  const matrix = new THREE.Matrix4();
  const surfaceWidth = mode === 'v2' ? surfaceParams.headWidth : surfaceParams.width;
  const surfaceDepth = mode === 'v2' ? surfaceParams.headDepth : surfaceParams.depth;
  const usableWidth = Math.min(surfaceWidth * 0.86, (spikeParams.columns - 1) * spikeParams.spacing);
  const usableDepth = Math.min(surfaceDepth * 0.75, (spikeParams.rows - 1) * spikeParams.spacing);
  let index = 0;

  for (let row = 0; row < spikeParams.rows; row += 1) {
    const z = -usableDepth / 2 + (row / Math.max(spikeParams.rows - 1, 1)) * usableDepth;
    for (let col = 0; col < spikeParams.columns; col += 1) {
      const x = -usableWidth / 2 + (col / Math.max(spikeParams.columns - 1, 1)) * usableWidth;
      const curveY = mode === 'v2'
        ? foamSurfaceY(x, z, surfaceParams) * spikeParams.curvatureInfluence
        : headSurfaceY(x, surfaceParams) * spikeParams.curvatureInfluence;
      matrix.makeTranslation(x, curveY + spikeParams.height / 2, z);
      mesh.setMatrixAt(index, matrix);
      index += 1;
    }
  }
  mesh.instanceMatrix.needsUpdate = true;
  return mesh;
}

function createMesh(name, geometry, material, y) {
  const mesh = new THREE.Mesh(geometry, material);
  mesh.name = name;
  mesh.position.y = y;
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

function buildMachine() {
  parts.clear();
  machineGroup.clear();

  const base = createMesh('Base', createBaseGeometry(designParams.base), materials.base, originalY.Base);
  const feet = createFeetGroup(designParams.feet);
  feet.position.y = originalY.Feet;
  const versionObjects = [base, feet];

  if (currentVersion === 'v1') {
    const body = createMesh('MachineBody', createRoundedExtrudeGeometry(designParams.body, 0.08, 0), materials.body, originalY.MachineBody);
    const transition = createMesh('WhiteTransitionLayer', createRoundedExtrudeGeometry(designParams.transitionLayer, designParams.transitionLayer.expansion, 0.035), materials.transition, originalY.WhiteTransitionLayer);
    const shell = createMesh('BlueOuterShell', createSoftBoxGeometry(designParams.shell), materials.shell, originalY.BlueOuterShell);
    const head = createMesh('MassageHead', createMassageHeadGeometry(designParams.massageHead), materials.head, originalY.MassageHead);
    const spikes = createSpikesMesh(designParams.spikes, designParams.massageHead, 'v1');
    spikes.position.y = originalY.MassageSpikes;
    versionObjects.push(body, transition, shell, head, spikes);
  } else if (currentVersion === 'v2') {
    const body = createMesh('MachineBody', createRoundedExtrudeGeometry(designParams.body, 0.08, 0), materials.body, originalY.MachineBody);
    const transition = createMesh('WhiteTransitionLayer', createRoundedExtrudeGeometry(designParams.transitionLayer, designParams.transitionLayer.expansion, 0.035), materials.transition, originalY.WhiteTransitionLayer);
    const posts = createGuidePostsGroup(designParams.guidePosts);
    posts.position.y = originalY.GuidePosts;
    const foam = createMesh('PUFoamBody', createPUFoamGeometry(designParams.foam), materials.foam, originalY.PUFoamBody);
    const spikes = createSpikesMesh(designParams.spikes, designParams.foam, 'v2');
    spikes.position.y = originalY.PUFoamBody;
    versionObjects.push(body, transition, posts, foam, spikes);
  } else {
    const motion = createSaddleMotionUnit(designParams.motionUnit);
    motion.position.y = originalY.SaddleMotionUnit;
    const transition = createMesh('MotionTransitionLayer', createRoundedExtrudeGeometry(designParams.transitionLayer, designParams.transitionLayer.expansion, 0.02), materials.transition, originalY.MotionTransitionLayer);
    const application = createUpperCoreApplication(designParams.upperApplication, designParams.meshPad);
    application.position.y = originalY.UpperCoreApplication;
    versionObjects.push(motion, transition, application);
  }

  for (const object of versionObjects) {
    machineGroup.add(object);
    parts.set(object.name, object);
  }
  applyExplodedView();
}

function rebuildPart(partName) {
  const oldObject = parts.get(partName);
  const transform = oldObject ? { position: oldObject.position.clone(), rotation: oldObject.rotation.clone(), scale: oldObject.scale.clone() } : null;
  let newObject;

  if (partName === 'Base') newObject = createMesh('Base', createBaseGeometry(designParams.base), materials.base, originalY.Base);
  if (partName === 'Feet') newObject = createFeetGroup(designParams.feet);
  if (partName === 'MachineBody') newObject = createMesh('MachineBody', createRoundedExtrudeGeometry(designParams.body, 0.08, 0), materials.body, originalY.MachineBody);
  if (partName === 'WhiteTransitionLayer') newObject = createMesh('WhiteTransitionLayer', createRoundedExtrudeGeometry(designParams.transitionLayer, designParams.transitionLayer.expansion, 0.035), materials.transition, originalY.WhiteTransitionLayer);
  if (partName === 'BlueOuterShell') newObject = createMesh('BlueOuterShell', createSoftBoxGeometry(designParams.shell), materials.shell, originalY.BlueOuterShell);
  if (partName === 'MassageHead') newObject = createMesh('MassageHead', createMassageHeadGeometry(designParams.massageHead), materials.head, originalY.MassageHead);
  if (partName === 'GuidePosts') newObject = createGuidePostsGroup(designParams.guidePosts);
  if (partName === 'PUFoamBody') newObject = createMesh('PUFoamBody', createPUFoamGeometry(designParams.foam), materials.foam, originalY.PUFoamBody);
  if (partName === 'SaddleMotionUnit') newObject = createSaddleMotionUnit(designParams.motionUnit);
  if (partName === 'MotionTransitionLayer') newObject = createMesh('MotionTransitionLayer', createRoundedExtrudeGeometry(designParams.transitionLayer, designParams.transitionLayer.expansion, 0.02), materials.transition, originalY.MotionTransitionLayer);
  if (partName === 'UpperCoreApplication') newObject = createUpperCoreApplication(designParams.upperApplication, designParams.meshPad);
  if (partName === 'MassageSpikes') newObject = currentVersion === 'v2'
    ? createSpikesMesh(designParams.spikes, designParams.foam, 'v2')
    : createSpikesMesh(designParams.spikes, designParams.massageHead, 'v1');

  if (!newObject) return;
  if (partName === 'Feet') newObject.position.y = originalY.Feet;
  if (partName === 'GuidePosts') newObject.position.y = originalY.GuidePosts;
  if (partName === 'MassageSpikes') newObject.position.y = currentVersion === 'v2' ? originalY.PUFoamBody : originalY.MassageSpikes;
  if (partName === 'SaddleMotionUnit') newObject.position.y = originalY.SaddleMotionUnit;
  if (partName === 'MotionTransitionLayer') newObject.position.y = originalY.MotionTransitionLayer;
  if (partName === 'UpperCoreApplication') newObject.position.y = originalY.UpperCoreApplication;
  if (transform) {
    newObject.position.copy(transform.position);
    newObject.rotation.copy(transform.rotation);
    newObject.scale.copy(transform.scale);
  }
  if (oldObject) {
    machineGroup.remove(oldObject);
    disposeObject(oldObject);
  }
  machineGroup.add(newObject);
  parts.set(partName, newObject);
  if (selectedMesh?.name === partName) selectMesh(newObject);
  applyExplodedView();
}

function rebuildShell() { rebuildPart('BlueOuterShell'); }
function rebuildHeadAndSpikes() { rebuildPart('MassageHead'); rebuildPart('MassageSpikes'); }
function rebuildFoamAndSpikes() { rebuildPart('PUFoamBody'); rebuildPart('MassageSpikes'); }
function rebuildUpperCoreApplication() { rebuildPart('UpperCoreApplication'); }

function applyExplodedView() {
  for (const [name, object] of parts) {
    object.position.y = originalY[name] + explodedAmount * explodedLayer[name];
  }
  if (outline && selectedMesh) outline.update();
}

function createGround() {
  const ground = new THREE.Mesh(new THREE.PlaneGeometry(18, 18), materials.ground);
  ground.name = 'GroundPlane';
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -0.26;
  ground.receiveShadow = true;
  scene.add(ground);
  const grid = new THREE.GridHelper(18, 18, 0x425064, 0x202a38);
  grid.position.y = -0.255;
  scene.add(grid);
}

function createLights() {
  scene.add(new THREE.HemisphereLight(0xdbeafe, 0x18202c, 2.1));
  const key = new THREE.DirectionalLight(0xffffff, 3.3);
  key.position.set(4.5, 7, 5);
  key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048);
  key.shadow.camera.left = -7;
  key.shadow.camera.right = 7;
  key.shadow.camera.top = 7;
  key.shadow.camera.bottom = -7;
  scene.add(key);
}

function getControlSpec() {
  const baseFields = currentVersion === 'v2'
    || currentVersion === 'v3'
    ? { width: [4.2, 7.2, 0.05], depth: [2.0, 4.6, 0.05], height: [0.12, 0.5, 0.01], cornerRadius: [0.15, 1.0, 0.01], waist: [0, 0.55, 0.01], cornerBulge: [0, 0.45, 0.01] }
    : { width: [4.2, 7.2, 0.05], depth: [2.0, 4.6, 0.05], height: [0.18, 0.8, 0.01], cornerRadius: [0.15, 1.0, 0.01] };

  if (currentVersion === 'v3') {
    return {
      base: { part: 'Base', fields: baseFields },
      feet: { part: 'Feet', fields: { radius: [0.22, 0.7, 0.01], heightScale: [0.18, 0.8, 0.01], xOffset: [1.4, 3.0, 0.05], zOffset: [0.55, 1.65, 0.05] } },
      motionUnit: { part: 'SaddleMotionUnit', fields: { width: [2.8, 5.2, 0.05], depth: [1.2, 3.0, 0.05], height: [0.45, 1.5, 0.01], roundness: [0.05, 0.6, 0.01], topCapHeight: [0.05, 0.3, 0.01] } },
      transitionLayer: { part: 'MotionTransitionLayer', fields: { width: [3.4, 5.8, 0.05], depth: [1.8, 3.8, 0.05], height: [0.06, 0.45, 0.01], expansion: [-0.2, 0.55, 0.01], roundness: [0.08, 0.65, 0.01] } },
      upperApplication: { part: 'UpperCoreApplication', customRebuild: rebuildUpperCoreApplication, fields: { width: [4.0, 6.8, 0.05], depth: [2.1, 4.2, 0.05], height: [0.3, 1.1, 0.01], roundness: [0.08, 0.7, 0.01], insetDepth: [0, 0.3, 0.01] } },
      meshPad: { customRebuild: rebuildUpperCoreApplication, fields: { width: [3.0, 6.0, 0.05], depth: [1.2, 3.4, 0.05], height: [0.03, 0.25, 0.01], rows: [6, 28, 1], columns: [8, 42, 1], sag: [0, 0.35, 0.01] } },
    };
  }

  const common = {
    base: { part: 'Base', fields: baseFields },
    feet: { part: 'Feet', fields: { radius: [0.18, 0.7, 0.01], heightScale: [0.18, 0.8, 0.01], xOffset: [1.4, 3.0, 0.05], zOffset: [0.55, 1.65, 0.05] } },
    body: { part: 'MachineBody', fields: { width: [2.4, 5.0, 0.05], depth: [1.2, 3.3, 0.05], height: [0.35, 1.4, 0.01], roundness: [0.05, 0.55, 0.01] } },
    transitionLayer: { part: 'WhiteTransitionLayer', fields: { width: [3.2, 5.8, 0.05], depth: [1.8, 3.8, 0.05], height: [0.08, 0.55, 0.01], expansion: [-0.2, 0.55, 0.01], roundness: [0.08, 0.65, 0.01] } },
  };

  if (currentVersion === 'v1') {
    return {
      ...common,
      shell: { part: 'BlueOuterShell', customRebuild: rebuildShell, fields: { width: [3.8, 6.8, 0.05], depth: [2.4, 4.6, 0.05], height: [0.35, 1.4, 0.01], roundness: [0.08, 0.9, 0.01], taper: [-0.15, 0.35, 0.01], sideCurve: [-0.35, 0.6, 0.01] } },
      massageHead: { customRebuild: rebuildHeadAndSpikes, fields: { width: [2.0, 4.8, 0.05], depth: [1.0, 2.8, 0.05], height: [0.2, 1.1, 0.01], curvature: [0, 0.8, 0.01] } },
      spikes: { part: 'MassageSpikes', fields: { rows: [2, 14, 1], columns: [4, 32, 1], height: [0.06, 0.55, 0.01], radius: [0.025, 0.16, 0.005], spacing: [0.08, 0.35, 0.005], curvatureInfluence: [0.4, 1.3, 0.01] } },
    };
  }

  return {
    ...common,
    foam: { part: 'PUFoamBody', customRebuild: rebuildFoamAndSpikes, fields: { width: [4.2, 6.6, 0.05], depth: [1.9, 3.5, 0.05], cushionHeight: [0.25, 1.0, 0.01], headWidth: [2.2, 5.0, 0.05], headDepth: [0.9, 2.4, 0.05], headHeight: [0.1, 0.9, 0.01], roundness: [0.05, 0.9, 0.01], saddleCurvature: [0, 0.6, 0.01], edgeBlend: [0.05, 0.7, 0.01] } },
    guidePosts: { part: 'GuidePosts', fields: { radius: [0.03, 0.18, 0.005], height: [0.35, 1.55, 0.01], xOffset: [0.7, 2.3, 0.05], rearOffset: [0.15, 1.25, 0.05] } },
    spikes: { part: 'MassageSpikes', fields: { rows: [2, 14, 1], columns: [4, 32, 1], height: [0.06, 0.45, 0.01], radius: [0.025, 0.14, 0.005], spacing: [0.08, 0.28, 0.005], curvatureInfluence: [0.4, 1.25, 0.01], bluntness: [0.2, 1.0, 0.01] } },
  };
}

function buildParameterPanel() {
  paramsForm.innerHTML = '';
  for (const [groupName, spec] of Object.entries(getControlSpec())) {
    const fieldset = document.createElement('section');
    fieldset.className = 'param-group';
    fieldset.innerHTML = `<h2>${labelFor(groupName)}</h2>`;

    for (const [field, [min, max, step]] of Object.entries(spec.fields)) {
      const row = document.createElement('div');
      row.className = 'control-row';
      const value = designParams[groupName][field];
      row.innerHTML = `
        <label>${field}</label>
        <input type="range" min="${min}" max="${max}" step="${step}" value="${value}" data-group="${groupName}" data-field="${field}">
        <input type="number" min="${min}" max="${max}" step="${step}" value="${value}" data-group="${groupName}" data-field="${field}">
      `;
      fieldset.appendChild(row);
    }
    paramsForm.appendChild(fieldset);
  }
}

function labelFor(name) {
  return name.replace(/([A-Z])/g, ' $1').replace(/^./, (char) => char.toUpperCase());
}

function updateLinkedInputs(group, field, value) {
  paramsForm.querySelectorAll(`[data-group="${group}"][data-field="${field}"]`).forEach((input) => {
    input.value = value;
  });
}

paramsForm.addEventListener('input', (event) => {
  const input = event.target;
  if (!input.dataset.group) return;

  const group = input.dataset.group;
  const field = input.dataset.field;
  const step = Number(input.step);
  const value = step >= 1 ? Math.round(Number(input.value)) : Number(input.value);
  designParams[group][field] = value;
  updateLinkedInputs(group, field, value);

  const spec = getControlSpec()[group];
  if (spec.customRebuild) spec.customRebuild();
  else rebuildPart(spec.part);
});

explodedControl.addEventListener('input', () => {
  explodedAmount = Number(explodedControl.value);
  applyExplodedView();
});

versionSelect.addEventListener('change', () => {
  currentVersion = versionSelect.value;
  defaultDesignParams = versionPresets[currentVersion];
  designParams = structuredClone(defaultDesignParams);
  explodedAmount = 0;
  explodedControl.value = 0;
  selectMesh(null);
  buildParameterPanel();
  buildMachine();
});

resetButton.addEventListener('click', () => {
  designParams = structuredClone(defaultDesignParams);
  explodedAmount = 0;
  explodedControl.value = 0;
  selectMesh(null);
  buildParameterPanel();
  buildMachine();
});

exportButton.addEventListener('click', () => {
  const blob = new Blob([JSON.stringify({ version: currentVersion, designParams }, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = 'steady-saddle-pro-params.json';
  anchor.click();
  URL.revokeObjectURL(url);
});

function selectMesh(mesh) {
  if (selectedMesh?.material?.emissive && selectedOriginalEmissive) {
    selectedMesh.material.emissive.copy(selectedOriginalEmissive);
  }
  if (outline) {
    scene.remove(outline);
    outline.geometry.dispose();
    outline.material.dispose();
    outline = null;
  }

  selectedMesh = mesh;
  selectedOriginalEmissive = null;
  selectedName.textContent = mesh?.name || 'None';
  if (!mesh) return;

  if (mesh.material?.emissive) {
    selectedOriginalEmissive = mesh.material.emissive.clone();
    mesh.material.emissive.set(0x1f4fff);
  }
  outline = new THREE.BoxHelper(mesh, 0x75a7ff);
  scene.add(outline);
}

renderer.domElement.addEventListener('dblclick', (event) => {
  const rect = renderer.domElement.getBoundingClientRect();
  pointer.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
  pointer.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
  raycaster.setFromCamera(pointer, camera);

  const pickable = [...parts.values()].flatMap((part) => part.type === 'Group' ? part.children : [part]);
  const hits = raycaster.intersectObjects(pickable, false);
  if (!hits.length) {
    selectMesh(null);
    return;
  }
  const hit = hits[0].object;
  selectMesh(parts.get(hit.name) || hit);
});

function resize() {
  const { clientWidth, clientHeight } = viewer;
  camera.aspect = clientWidth / clientHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(clientWidth, clientHeight, false);
}

function animate() {
  controls.update();
  if (outline) outline.update();
  renderer.render(scene, camera);
  requestAnimationFrame(animate);
}

createGround();
createLights();
versionSelect.value = currentVersion;
buildParameterPanel();
buildMachine();
resize();
window.addEventListener('resize', resize);
animate();
