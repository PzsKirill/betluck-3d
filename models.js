// Models: one loader for the whole site (meshopt-compressed GLBs in assets/models, all CC0 — see docs/credits),
// a cache, and a scatter helper that turns a model into instanced meshes so a jungle of hundreds of plants costs
// one draw call per model part.

import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { MeshoptDecoder } from "three/addons/libs/meshopt_decoder.module.js";
import { clone as cloneSkinned } from "three/addons/utils/SkeletonUtils.js";

const loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
const cache = new Map();

export function loadModel(name) {
  if (!cache.has(name)) cache.set(name, loader.loadAsync(`assets/models/${name}.glb`));
  return cache.get(name);
}

export async function loadModels(names) {
  const out = {};
  await Promise.all(names.map(async (n) => { try { out[n] = await loadModel(n); } catch (e) { console.warn("[models]", n, e); } }));
  return out;
}

// A model normalised to a target height, its base on y = 0 and centred in x/z
export function normalise(object, height) {
  const box = new THREE.Box3().setFromObject(object);
  const size = box.getSize(new THREE.Vector3());
  const s = height / (size.y || 1);
  object.scale.multiplyScalar(s);
  const b2 = new THREE.Box3().setFromObject(object);
  const c = b2.getCenter(new THREE.Vector3());
  object.position.sub(new THREE.Vector3(c.x, b2.min.y, c.z));
  const g = new THREE.Group();
  g.add(object);
  return g;
}

// Instances of a static model: transforms = [{ x, y, z, ry, s }]. Every mesh inside becomes an InstancedMesh; the
// mesh's own offset inside the model is kept. `material` lets the caller swap or patch materials (e.g. the leaf bend).
export function scatter(gltf, transforms, { height = 1, material, vary = 0 } = {}) {
  const root = normalise(gltf.scene.clone(true), height);
  root.updateMatrixWorld(true);
  const group = new THREE.Group();
  const m = new THREE.Matrix4(), q = new THREE.Quaternion(), e = new THREE.Euler(), v = new THREE.Vector3(), sc = new THREE.Vector3();
  root.traverse((node) => {
    if (!node.isMesh) return;
    const local = node.matrixWorld.clone();
    const mat = material ? material(node.material, node) : node.material;
    const inst = new THREE.InstancedMesh(node.geometry, mat, transforms.length);
    transforms.forEach((t, i) => {
      e.set(t.rx ?? 0, t.ry ?? 0, t.rz ?? 0);
      q.setFromEuler(e);
      v.set(t.x, t.y ?? 0, t.z);
      const s = t.s ?? 1;
      sc.set(s * (t.sx ?? 1), s * (t.sy ?? 1), s * (t.sz ?? 1));
      m.compose(v, q, sc).multiply(local);
      inst.setMatrixAt(i, m);
    });
    inst.instanceMatrix.needsUpdate = true;
    if (vary) {
      const c = new THREE.Color();
      transforms.forEach((t, i) => { const k = 1 - vary / 2 + (t.v ?? Math.random()) * vary; c.setRGB(k, k * (0.96 + (t.h ?? 0.5) * 0.08), k * (0.92 + (1 - (t.h ?? 0.5)) * 0.12)); inst.setColorAt(i, c); });
      inst.instanceColor.needsUpdate = true;
    }
    inst.computeBoundingSphere();
    group.add(inst);
  });
  return group;
}

// A single placed copy (static), for set pieces
export function place(gltf, { x = 0, y = 0, z = 0, ry = 0, rx = 0, rz = 0, s = 1, height = 1, material } = {}) {
  const g = normalise(gltf.scene.clone(true), height);
  if (material) g.traverse((n) => { if (n.isMesh) n.material = material(n.material, n); });
  g.position.set(x, y, z);
  g.rotation.set(rx, ry, rz);
  g.scale.multiplyScalar(s);
  return g;
}

// An animated character: its own skeleton, a mixer, and play(name) with a short cross-fade
export function character(gltf, { height = 1 } = {}) {
  const obj = cloneSkinned(gltf.scene);
  const g = normalise(obj, height);
  const mixer = new THREE.AnimationMixer(obj);
  const actions = Object.fromEntries(gltf.animations.map((a) => [a.name, mixer.clipAction(a)]));
  let current = null;
  const play = (name, { fade = 0.25, once = false, speed = 1 } = {}) => {
    const next = actions[name];
    if (!next || next === current) return;
    next.reset();
    next.setLoop(once ? THREE.LoopOnce : THREE.LoopRepeat, once ? 1 : Infinity);
    next.clampWhenFinished = once;
    next.timeScale = speed;
    next.play();
    if (current) current.crossFadeTo(next, fade, false);
    current = next;
  };
  return { group: g, mixer, actions, play, get current() { return current; } };
}
