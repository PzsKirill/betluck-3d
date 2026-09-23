// Jungle — the entrance. The visitor is the explorer; the camera is their eyes.
//
// Scroll is a step forward along a night trail. Ferns, monstera and hanging vines crowd the lens and bend away as
// you push through them (a vertex shader parts the foliage around the camera), leaves sway in the wind, moonlight
// falls through the canopy in shafts, spores drift in the fog. The spirits of luck — the brand's cyan light — float
// ahead and lead the way. The mushroom folk notice you: one peeks from behind a rock and hops away, one dances,
// and at the end their king waves you up the steps of the Temple of Luck. On its gate the LUCK relic gathers the
// spirits and lights up; the stone door sinks, and the light behind it is the rest of the site.
//
// No people and no animals anywhere (ст. 27 ч. 1 п. 8 «О рекламе»): the explorer is only a point of view.

import * as THREE from "three";
import { register, renderer, lite, reduced, pointerFor, damp, smooth, clamp01 } from "./world.js";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import { ShaderPass } from "three/addons/postprocessing/ShaderPass.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";
import { loadModels, scatter, place, character } from "./models.js";
import { loadPlate, plateGeometry, outlineTrack, createArc, glowTexture, lightBlend, rng } from "./brand.js";

const FOG = 0x0a1820;
const Z_START = 4, Z_TEMPLE = -58;

// ── The bend: foliage parts around the explorer and breathes in the wind ────────────────────────────────────
const camU = { value: new THREE.Vector3() }, timeU = { value: 0 };
const bent = new Map();
function bendMaterial(src, { tint = 0x6f9a86, dim = 0.55, strength = 1 } = {}) {
  const key = src.uuid + strength;
  if (bent.has(key)) return bent.get(key);
  const m = src.clone();
  if (m.color) m.color.multiply(new THREE.Color(tint)).multiplyScalar(dim / 0.55);
  m.roughness = 0.9; m.metalness = 0; m.envMapIntensity = 0.25;
  m.side = THREE.DoubleSide;
  m.onBeforeCompile = (sh) => {
    sh.uniforms.uCam = camU; sh.uniforms.uTime = timeU;
    sh.vertexShader = "uniform vec3 uCam; uniform float uTime;\n" + sh.vertexShader.replace("#include <project_vertex>", /* glsl */ `
      vec4 wp = vec4(transformed, 1.0);
      #ifdef USE_INSTANCING
        wp = instanceMatrix * wp;
      #endif
      wp = modelMatrix * wp;
      float h = clamp(wp.y / 2.6, 0.0, 1.0);
      wp.x += sin(uTime * 1.3 + wp.z * 0.7 + wp.y * 1.3) * 0.045 * h;
      wp.z += cos(uTime * 1.05 + wp.x * 0.6) * 0.035 * h;
      vec2 d = wp.xz - uCam.xz;
      float dist = length(d);
      float ahead = smoothstep(-0.5, 0.8, -d.y);               // in front of the explorer, not behind
      float push = smoothstep(3.4, 0.2, dist) * (0.35 + h) * ${strength.toFixed(2)} * (0.4 + 0.6 * ahead);
      float sx = d.x >= 0.0 ? 1.0 : -1.0;
      wp.x += sx * push * (1.6 - min(abs(d.x), 1.2));          // aside, like a curtain
      wp.z += d.y / max(dist, 0.001) * push * 0.35;
      wp.y += (wp.y > uCam.y ? 0.9 : -0.5) * push * 0.6;      // up over the head, down under the feet
      vec4 mvPosition = viewMatrix * wp;
      gl_Position = projectionMatrix * mvPosition;`);
  };
  m.customProgramCacheKey = () => "bend" + strength;
  bent.set(key, m);
  return m;
}
const nightStone = (src) => { const m = src.clone(); if (m.color) m.color.multiplyScalar(0.62); m.roughness = 0.95; m.metalness = 0; m.envMapIntensity = 0.2; return m; };

// A gradient texture for light shafts
function shaftTexture() {
  const c = document.createElement("canvas"); c.width = 64; c.height = 256;
  const g = c.getContext("2d"), gr = g.createLinearGradient(0, 0, 0, 256);
  gr.addColorStop(0, "rgba(170,210,255,0.9)"); gr.addColorStop(0.7, "rgba(120,180,230,0.25)"); gr.addColorStop(1, "rgba(120,180,230,0)");
  g.fillStyle = gr; g.fillRect(0, 0, 64, 256);
  const side = g.createLinearGradient(0, 0, 64, 0);
  side.addColorStop(0, "rgba(0,0,0,1)"); side.addColorStop(0.5, "rgba(0,0,0,0)"); side.addColorStop(1, "rgba(0,0,0,1)");
  g.globalCompositeOperation = "destination-out"; g.fillStyle = side; g.fillRect(0, 0, 64, 256);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}

export async function initJungle({ gsap, ScrollTrigger }) {
  const section = document.getElementById("jungle");
  const stage = section.querySelector("[data-stage]");
  const beats = [...section.querySelectorAll("[data-beat]")];
  const M = await loadModels(["fern", "plant1", "monstera", "monstera2", "bigleaf", "bush", "grass", "pothos", "vines", "palm1", "palm2", "tree1",
    "rock1", "rock2", "rock3", "pebble", "shrooms", "floor", "stairs", "arch", "wall", "column", "torch", "mushnub", "mushnubEvo", "mushKing"]);
  const plate = await loadPlate();
  const R = rng(5);
  const N = lite ? 0.55 : 1;                      // phones: fewer plants, same walk

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(FOG);
  scene.fog = new THREE.FogExp2(FOG, 0.042);
  const camera = new THREE.PerspectiveCamera(62, 1, 0.05, 120);

  // ── Light: moon from above and behind, a cool sky, the spirits' cyan, the temple's fire ──
  scene.add(new THREE.HemisphereLight(0x6a8fc0, 0x0a140f, 1.15));
  const moon = new THREE.DirectionalLight(0xb8d4ff, 2.4);
  moon.position.set(-8, 16, -40);
  moon.target.position.set(0, 0, 0);
  scene.add(moon, moon.target);
  const fill = new THREE.DirectionalLight(0x2f5f7a, 0.6);
  fill.position.set(6, 6, 12);
  scene.add(fill);
  const spiritLight = new THREE.PointLight(0x3dd9ff, 6, 9, 1.6);
  scene.add(spiritLight);

  // ── Ground: moss with a trodden trail ──
  const groundGeo = new THREE.PlaneGeometry(44, 90, 44, 120).rotateX(-Math.PI / 2);
  const gp = groundGeo.attributes.position, gc = [];
  for (let i = 0; i < gp.count; i++) {
    const x = gp.getX(i), z = gp.getZ(i);
    const trail = Math.exp(-Math.pow(x / 1.1, 2));
    gp.setY(i, (1 - trail) * (Math.sin(x * 0.9) * Math.cos(z * 0.35) * 0.18 + R() * 0.06));
    const moss = new THREE.Color(0x14261c).lerp(new THREE.Color(0x2b2a1f), trail * 0.8);
    gc.push(moss.r, moss.g, moss.b);
  }
  groundGeo.setAttribute("color", new THREE.Float32BufferAttribute(gc, 3));
  groundGeo.computeVertexNormals();
  const ground = new THREE.Mesh(groundGeo, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1, metalness: 0 }));
  ground.position.z = -26;
  scene.add(ground);

  // ── The jungle ──
  const side = (min, max) => (R() < 0.5 ? -1 : 1) * (min + R() * (max - min));
  const POCKETS = [[-1.9, -11.5, 1.8], [1.35, -32, 3.2], [0.8, -26, 1.6], [-2.7, Z_TEMPLE + 4.2, 2.2]];   // [x, z, radius]: peeker, table, king
  const clear = (t) => POCKETS.every(([x, z, r]) => Math.hypot(t.x - x, t.z - z) > r) && Math.abs(t.x) > 0.75;
  const along = (count, zFrom, zTo, fn) => Array.from({ length: Math.round(count * N) }, (_, i) => fn(zFrom + (zTo - zFrom) * (i / Math.max(1, Math.round(count * N) - 1)) + (R() - 0.5) * 1.2));
  const leafy = (name, transforms, height, opts = {}) => {
    const list = (opts.keep ? transforms : transforms.filter(clear)).map((t) => ({ ...t, v: R(), h: R() }));
    if (M[name] && list.length) scene.add(scatter(M[name], list, { height, vary: 0.55, material: (m) => bendMaterial(m, opts) }));
  };
  const stony = (name, transforms, height, keep) => { const list = (keep ? transforms : transforms.filter(clear)).map((t) => ({ ...t, v: R(), h: R() })); if (M[name] && list.length) scene.add(scatter(M[name], list, { height, vary: 0.35, material: nightStone })); };

  // Banks: dense low growth near the trail, taller plants behind
  leafy("fern", along(70, 6, -54, (z) => ({ x: side(0.9, 4.5), z, ry: R() * 6.28, s: 0.7 + R() * 0.7 })), 0.9);
  leafy("plant1", along(34, 5, -52, (z) => ({ x: side(1.2, 5), z, ry: R() * 6.28, s: 0.8 + R() * 0.6 })), 1.6, { tint: 0x7fae8a });
  leafy("monstera", along(26, 5, -50, (z) => ({ x: side(1.1, 4), z, ry: R() * 6.28, s: 0.9 + R() * 0.5 })), 2.2, { tint: 0x86b5a2 });
  leafy("monstera2", along(18, 4, -50, (z) => ({ x: side(1.6, 6), z, ry: R() * 6.28, s: 0.9 + R() * 0.6 })), 2.6, { tint: 0x86b5a2 });
  leafy("bigleaf", along(14, 3, -48, (z) => ({ x: side(2, 7), z, ry: R() * 6.28, s: 0.8 + R() * 0.5 })), 3.2, { tint: 0x7aa58e });
  leafy("bush", along(22, 4, -52, (z) => ({ x: side(2.5, 8), z, ry: R() * 6.28, s: 0.9 + R() * 0.6 })), 1.3, { tint: 0x355c3c, dim: 0.35 });
  leafy("grass", along(60, 6, -54, (z) => ({ x: side(0.7, 5), z, ry: R() * 6.28, s: 0.6 + R() * 0.5 })), 0.8, { tint: 0x7d9b6a });
  leafy("pothos", along(20, 4, -50, (z) => ({ x: side(0.8, 3.5), z, ry: R() * 6.28, s: 0.8 + R() * 0.5 })), 1.1, { tint: 0x8bbfa6 });
  // Curtains: big leaves that lean over the trail — the ones you push through
  leafy("monstera2", [-1, -8, -16, -42, -47].flatMap((z) => [{ x: -0.95 - R() * 0.3, z, ry: 0.6 + R(), rz: -0.2, s: 1 }, { x: 1 + R() * 0.3, z: z - 1.6, ry: -0.8 - R(), rz: 0.2, s: 0.95 }]), 2.3, { tint: 0x9fd0b6, strength: 1.2, keep: true });
  // Vines hanging over the trail
  leafy("vines", along(26, 3, -48, (z) => ({ x: (R() - 0.5) * 3.2, y: 2.5 + R() * 1.4, z, ry: R() * 6.28, s: 0.9 + R() * 0.5 })), 1.3, { tint: 0x9cc9a0, strength: 1.2 });
  // Trees and the canopy
  leafy("palm1", along(16, 4, -52, (z) => ({ x: side(3.5, 10), z, ry: R() * 6.28, s: 1 + R() * 0.6 })), 7, { tint: 0x5d8f6c, dim: 0.45, strength: 0.2 });
  leafy("palm2", along(14, 2, -50, (z) => ({ x: side(4, 12), z, ry: R() * 6.28, s: 1 + R() * 0.7 })), 8, { tint: 0x5d8f6c, dim: 0.45, strength: 0.2 });
  leafy("tree1", along(12, 0, -56, (z) => ({ x: side(7, 16), z, ry: R() * 6.28, s: 1 + R() * 0.5 })), 11, { tint: 0x3f6a4c, dim: 0.4, strength: 0 });
  // Stone: rocks along the trail, pebbles as stepping stones
  stony("rock1", along(9, 2, -50, (z) => ({ x: side(1.6, 5), z, ry: R() * 6.28, s: 0.6 + R() * 0.7 })), 1.1);
  stony("rock2", along(8, 0, -48, (z) => ({ x: side(1.8, 6), z, ry: R() * 6.28, s: 0.6 + R() * 0.8 })), 1.0);
  stony("rock3", along(6, -3, -46, (z) => ({ x: side(2.5, 7), z, ry: R() * 6.28, s: 0.8 + R() * 0.8 })), 1.4);
  stony("pebble", along(40, 5, -52, (z) => ({ x: (R() - 0.5) * 1.1, z, ry: R() * 6.28, s: 1.3 + R() })), 0.12, true);
  if (M.shrooms) {
    const glowShroom = (src) => { const m = src.clone(); m.color = new THREE.Color(0x9fefff); m.emissive = new THREE.Color(0x3dd9ff); m.emissiveIntensity = 1.1; m.roughness = 0.6; return m; };
    const list = along(46, 5, -54, (z) => ({ x: side(0.85, 2.4), z, ry: R() * 6.28, s: 0.7 + R() * 0.9 })).filter(clear);
    scene.add(scatter(M.shrooms, list, { height: 0.32, material: glowShroom }));
    // a few of them light the leaves around (cheap: one moving light stands in for the rest near the camera)
  }

  // ── The Temple of Luck ──
  const temple = new THREE.Group();
  temple.position.z = Z_TEMPLE;
  scene.add(temple);
  if (M.floor) for (let x = -3; x <= 3; x++) for (let z = 0; z < 5; z++) temple.add(place(M.floor, { x: x * 2, y: -0.05, z: 5 + z * 2, height: 0.3, material: nightStone }));
  if (M.stairs) [-1.8, 0, 1.8].forEach((x) => { const s = place(M.stairs, { x, z: 2.3, ry: Math.PI, height: 1.5, material: nightStone }); temple.add(s); });
  const platformY = 1.5;
  if (M.floor) for (let x = -3; x <= 3; x++) for (let z = -1; z <= 1; z++) temple.add(place(M.floor, { x: x * 2, y: platformY - 0.3, z: z * 2 - 0.2, height: 0.3, material: nightStone }));
  if (M.arch) temple.add(place(M.arch, { y: platformY, z: -1.2, height: 7, material: nightStone }));
  if (M.wall) [-5.4, -9, 5.4, 9].forEach((x) => temple.add(place(M.wall, { x, y: platformY, z: -1.2, height: 5.2, material: nightStone })));
  if (M.column) [-3.3, 3.3].forEach((x) => temple.add(place(M.column, { x, y: platformY, z: 0.4, height: 5.4, material: nightStone })));
  const torches = [];
  if (M.torch) [-2.4, 2.4].forEach((x) => {
    temple.add(place(M.torch, { x, y: platformY, z: 1.2, height: 1.6 }));
    const l = new THREE.PointLight(0xffa24a, 10, 9, 1.8);
    l.position.set(x, platformY + 1.75, 1.3);
    temple.add(l);
    const f = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture(), color: 0xffb35c, transparent: true, opacity: 0.8, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false }));
    f.scale.setScalar(1.1); f.position.copy(l.position);
    temple.add(f);
    torches.push({ l, f, seed: R() * 10 });
  });
  // The door: a stone slab in the arch, with the light of the world behind it
  const door = new THREE.Mesh(new THREE.BoxGeometry(3.1, 4.4, 0.35), new THREE.MeshStandardMaterial({ color: 0x3b4238, roughness: 0.95 }));
  door.position.set(0, platformY + 2.2, -1.25);
  temple.add(door);
  const beyond = new THREE.Mesh(new THREE.PlaneGeometry(3.4, 4.8), new THREE.MeshBasicMaterial({ color: 0x3dd9ff, toneMapped: false }));
  beyond.position.set(0, platformY + 2.3, -1.6);
  temple.add(beyond);
  // The relic: the LUCK plate above the gate, with arcs on its edge
  const relicMat = [
    new THREE.MeshStandardMaterial({ color: 0x3dd9ff, emissive: 0x3dd9ff, emissiveIntensity: 0.15, roughness: 0.35 }),
    new THREE.MeshStandardMaterial({ color: 0x0b5a74, emissive: 0x0e7fa3, emissiveIntensity: 0.2, roughness: 0.4 }),
  ];
  const relic = new THREE.Mesh(plateGeometry(plate, { width: 2.6, depth: 0.2, bevel: 0.03 }), relicMat);
  relic.position.set(0, platformY + 5.35, -0.8);
  temple.add(relic);
  const relicHalo = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture(), color: 0x3dd9ff, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false }));
  relicHalo.scale.set(6, 3, 1);
  relicHalo.position.copy(relic.position).add(new THREE.Vector3(0, 0, -0.2));
  temple.add(relicHalo);
  const track = outlineTrack(plate, 2.6, 400, 0.06);
  const relicArc = createArc({ points: 48, width: 0.07 });
  relicArc.mesh.position.copy(relic.position);
  temple.add(relicArc.mesh);

  // ── The mushroom folk ──
  const folk = [];
  const addFolk = (name, height, pos, face, script) => {
    if (!M[name]) return;
    const c = character(M[name], { height });
    c.group.position.copy(pos);
    c.group.rotation.y = face;
    c.play("Idle");
    scene.add(c.group);
    folk.push({ c, home: pos.clone(), script, state: "idle" });
  };
  // 1: peeks from behind a rock, hops when you come close, and hides
  addFolk("mushnub", 0.95, new THREE.Vector3(-1.9, 0, -11.5), 0.7, (f, camZ) => {
    const near = camZ < f.home.z + 5;
    const gone = camZ < f.home.z + 1.5;
    if (near && f.state === "idle") { f.state = "hop"; f.c.play("Jump", { once: true }); }
    if (gone && f.state === "hop") { f.state = "gone"; f.c.play("Walk"); }
    const tx = f.state === "gone" ? f.home.x - 2.6 : f.home.x + (near ? 0.35 : 0);
    f.c.group.position.x = damp(f.c.group.position.x, tx, 2.5, f.dt);
    if (!near && f.state !== "idle") { f.state = "idle"; f.c.play("Idle"); }
  });
  // 2: the counting table — three of them round a flat stone with a glowing rune, nodding over the numbers.
  // This is what the copy means by «сморчки уже всё посчитали», so it sits right in view during that line.
  const TABLE = new THREE.Vector3(1.35, 0, -32);
  if (M.rock2) { const st = place(M.rock2, { x: TABLE.x, z: TABLE.z, height: 0.55, s: 1, material: nightStone }); st.scale.x *= 1.4; scene.add(st); }
  const rune = new THREE.Mesh(plateGeometry(plate, { width: 0.9, depth: 0.04, bevel: 0.008 }), new THREE.MeshStandardMaterial({ color: 0x3dd9ff, emissive: 0x3dd9ff, emissiveIntensity: 0.9, roughness: 0.4 }));
  rune.rotation.x = -Math.PI / 2 + 0.25;
  rune.position.set(TABLE.x, 0.62, TABLE.z);
  scene.add(rune);
  const runeLight = new THREE.PointLight(0x3dd9ff, 12, 7, 1.5);
  runeLight.position.set(TABLE.x, 1.1, TABLE.z + 0.4);
  scene.add(runeLight);
  const nod = (clip) => (f, camZ) => {
    const near = camZ < f.home.z + 16 && camZ > f.home.z - 2;
    const want = near ? clip : "Idle";
    if (f.state !== want) { f.state = want; f.c.play(want); }
  };
  addFolk("mushnub", 1.05, new THREE.Vector3(TABLE.x - 1.05, 0, TABLE.z + 0.45), 0.9, nod("Yes"));
  addFolk("mushnubEvo", 1.3, new THREE.Vector3(TABLE.x + 1.05, 0, TABLE.z + 0.25), -1.0, nod("Dance"));
  addFolk("mushnub", 0.95, new THREE.Vector3(TABLE.x + 0.1, 0, TABLE.z - 0.95), 0.1, nod("Yes"));
  // 3: the king at the temple steps, waving you in
  addFolk("mushKing", 1.6, new THREE.Vector3(-2.7, 0, Z_TEMPLE + 4.2), 0.45, (f, camZ) => {
    const near = camZ < f.home.z + 9;
    const want = near ? "Wave" : "Idle";
    if (f.state !== want) { f.state = want; f.c.play(want); }
  });

  // ── Spirits of luck: they float ahead of you, then flow into the relic ──
  const SP = lite ? 36 : 70;
  const spPos = new Float32Array(SP * 3), spData = [];
  for (let i = 0; i < SP; i++) spData.push({ z: Z_START - R() * 60, x: (R() - 0.5) * 3.6, y: 1 + R() * 2.2, ph: R() * 6.28, sp: 0.4 + R() * 0.6 });
  const spGeo = new THREE.BufferGeometry();
  spGeo.setAttribute("position", new THREE.BufferAttribute(spPos, 3));
  const spirits = new THREE.Points(spGeo, new THREE.PointsMaterial({ map: glowTexture(), color: 0x3dd9ff, size: 0.13, transparent: true, depthWrite: false, toneMapped: false, blending: THREE.AdditiveBlending }));
  scene.add(spirits);
  // Spores: fine dust in the moonlight
  const SPORES = lite ? 400 : 1100;
  const sp2 = new Float32Array(SPORES * 3);
  for (let i = 0; i < SPORES; i++) { sp2[i * 3] = (R() - 0.5) * 18; sp2[i * 3 + 1] = R() * 7; sp2[i * 3 + 2] = Z_START - R() * 66; }
  const sporeGeo = new THREE.BufferGeometry();
  sporeGeo.setAttribute("position", new THREE.BufferAttribute(sp2, 3));
  const spores = new THREE.Points(sporeGeo, new THREE.PointsMaterial({ map: glowTexture(), color: 0xcfe4ff, size: 0.05, transparent: true, opacity: 0.5, depthWrite: false, toneMapped: false, blending: THREE.AdditiveBlending }));
  scene.add(spores);
  // Moonlight shafts through the canopy
  const shaftTex = shaftTexture();
  const shafts = along(9, 0, -50, (z) => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(1.4 + R() * 1.6, 9), new THREE.MeshBasicMaterial({ map: shaftTex, transparent: true, opacity: 0.1, depthWrite: false, fog: false, toneMapped: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide }));
    m.position.set(side(0.5, 4), 4, z);
    m.rotation.set(0, R() * 3, (R() - 0.5) * 0.5);
    scene.add(m);
    return { m, base: 0.05 + R() * 0.06, ph: R() * 6 };
  });

  // ── The walk: a gentle curve through the trees to the foot of the stairs ──
  const path = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, 1.6, Z_START), new THREE.Vector3(0.35, 1.6, -8), new THREE.Vector3(-0.35, 1.62, -20),
    new THREE.Vector3(0.25, 1.65, -32), new THREE.Vector3(-0.1, 1.7, -43), new THREE.Vector3(0, 1.8, Z_TEMPLE + 8.5),
  ]);
  const gatePos = new THREE.Vector3(0, platformY + 2.4, Z_TEMPLE + 3.4);

  let prog = reduced ? 0.86 : 0, cur = prog;
  ScrollTrigger.create({ trigger: section, start: "top top", end: "bottom bottom", onUpdate: (s) => { if (!reduced) prog = s.progress; } });
  const pointer = pointerFor(stage);
  const pos = new THREE.Vector3(), ahead = new THREE.Vector3(), look = new THREE.Vector3(), tmp = new THREE.Vector3();
  let arcTick = 0, beatOn = -1;
  const flash = document.createElement("div");
  flash.className = "jflash";
  stage.appendChild(flash);
  const toast = window.__achieve;

  // ── The threshold: the door is the 18+ gate. You slide the LUCK plate across the stone, and it sinks. ──
  // Keyboard works too (the knob is a button); a visitor who already confirmed walks straight in.
  const gateEl = section.querySelector("[data-gate]");
  const knob = gateEl?.querySelector("[data-gate-knob]");
  const gFill = gateEl?.querySelector("[data-gate-fill]");
  const gHint = gateEl?.querySelector("[data-gate-hint]");
  const gRunes = gateEl ? [...gateEl.querySelectorAll(".jgate__runes i")] : [];
  let confirmed = new URLSearchParams(location.search).has("age");      // QA walks in as a confirmed visitor
  try { confirmed = confirmed || localStorage.getItem("bl_age") === "1"; } catch { /* private mode */ }
  if (confirmed) gateEl?.classList.add("is-done");
  let drag = 0, gateK = 0, unlocked = false, dragging = false, moved = false, startX = 0, startDrag = 0;

  function setDrag(v, snap) {
    drag = clamp01(v);
    if (!gateEl) return;
    const travel = Math.max(1, gateEl.querySelector(".jgate__track").clientWidth - knob.offsetWidth - 10);
    knob.style.transition = snap ? "transform .35s cubic-bezier(.2,.8,.2,1)" : "none";
    knob.style.transform = `translateX(${(drag * travel).toFixed(1)}px)`;
    gFill.style.transform = `scaleX(${drag.toFixed(3)})`;
    knob.setAttribute("aria-valuenow", Math.round(drag * 100));
    gRunes.forEach((r, i) => r.classList.toggle("is-on", drag > (i + 0.6) / gRunes.length));
  }

  function rumble() {                                       // stone on stone, only when the sound is on
    if (!window.__sound || !window.__ac) return;
    const ac = window.__ac, t = ac.currentTime;
    const buf = ac.createBuffer(1, Math.floor(ac.sampleRate * 1.6), ac.sampleRate), d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length);
    const n = ac.createBufferSource(); n.buffer = buf;
    const f = ac.createBiquadFilter(); f.type = "lowpass"; f.frequency.value = 240;
    const g = ac.createGain(); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.16, t + 0.12); g.gain.exponentialRampToValueAtTime(0.0001, t + 1.5);
    n.connect(f).connect(g).connect(ac.destination); n.start(t); n.stop(t + 1.6);
    const o = ac.createOscillator(), og = ac.createGain();
    o.type = "sine"; o.frequency.setValueAtTime(72, t); o.frequency.exponentialRampToValueAtTime(38, t + 1.2);
    og.gain.setValueAtTime(0.0001, t); og.gain.exponentialRampToValueAtTime(0.1, t + 0.1); og.gain.exponentialRampToValueAtTime(0.0001, t + 1.4);
    o.connect(og).connect(ac.destination); o.start(t); o.stop(t + 1.5);
  }

  // While the threshold is closed the page goes no further: forward scrolling is refused at the door.
  // Going back is always allowed — nobody gets trapped, they just can't pass without confirming.
  const LOCK_P = 0.9;
  const stopEl = gateEl?.querySelector("[data-gate-stop]");
  let locked = false, lockY = 0, touchY = 0;
  const lockSpan = () => Math.max(1, section.offsetHeight - innerHeight);
  const lockPoint = () => section.offsetTop + lockSpan() * LOCK_P;
  const gateProg = () => clamp01((scrollY - section.offsetTop) / lockSpan());   // read from the page, so it works off screen too
  function syncLock() {
    const want = !reduced && !confirmed && !unlocked && gateProg() >= LOCK_P - 0.004;
    if (want !== locked) {
      locked = want;
      if (stopEl) stopEl.hidden = !locked;
      gateEl?.classList.toggle("is-locked", locked);
      if (locked) { lockY = lockPoint(); knob?.focus({ preventScroll: true }); }
    }
    if (locked && scrollY > lockY + 2) {                     // anchors, End, scrollbar drags and momentum land here
      if (window.__lenis) window.__lenis.scrollTo(lockY, { immediate: true, force: true }); else scrollTo(0, lockY);
      nudge();
    }
  }
  function nudge() {
    if (!gateEl) return;
    gateEl.classList.remove("is-nudge");
    void gateEl.offsetWidth;                                  // restart the shake
    gateEl.classList.add("is-nudge");
  }
  function refuse(e) {
    if (!locked) return;
    e.preventDefault();
    e.stopPropagation();
    nudge();
  }
  if (!reduced) {
    addEventListener("wheel", (e) => { if (locked && e.deltaY > 0) refuse(e); }, { passive: false, capture: true });
    addEventListener("touchstart", (e) => { touchY = e.touches[0]?.clientY || 0; }, { passive: true, capture: true });
    addEventListener("touchmove", (e) => { if (locked && touchY - (e.touches[0]?.clientY || 0) > 2) refuse(e); }, { passive: false, capture: true });
    const FWD = new Set(["ArrowDown", "PageDown", "End", " ", "Spacebar"]);
    addEventListener("keydown", (e) => { if (locked && FWD.has(e.key) && !e.shiftKey && e.target !== knob) refuse(e); }, { capture: true });
    addEventListener("scroll", syncLock, { passive: true });
    window.__lenis?.on?.("scroll", syncLock);
  }

  function unlock() {
    if (unlocked) return;
    unlocked = true;
    try { localStorage.setItem("bl_age", "1"); } catch { /* private mode */ }
    setDrag(1, true);
    gateEl?.classList.add("is-open");
    if (gHint) gHint.textContent = "Храм открыт";
    knob?.setAttribute("aria-disabled", "true");
    toast?.("Порог пройден", "Вам есть 18 — дверь храма открыта");
    rumble();
  }

  if (knob && !confirmed) {
    knob.addEventListener("pointerdown", (e) => {
      if (unlocked) return;
      dragging = true; moved = false; startX = e.clientX; startDrag = drag;
      gateEl.classList.add("is-drag");
      knob.setPointerCapture?.(e.pointerId);
    });
    knob.addEventListener("pointermove", (e) => {
      if (!dragging) return;
      const travel = Math.max(1, gateEl.querySelector(".jgate__track").clientWidth - knob.offsetWidth - 10);
      const dx = e.clientX - startX;
      if (Math.abs(dx) > 3) moved = true;
      setDrag(startDrag + dx / travel, false);
      if (drag > 0.97) { dragging = false; gateEl.classList.remove("is-drag"); unlock(); }
    });
    const end = () => {
      if (!dragging) return;
      dragging = false; gateEl.classList.remove("is-drag");
      if (drag > 0.9) unlock(); else setDrag(0, true);
    };
    knob.addEventListener("pointerup", end);
    knob.addEventListener("pointercancel", end);
    knob.addEventListener("click", () => { if (moved) { moved = false; return; } unlock(); });   // Enter, Space, or a plain tap
    knob.addEventListener("keydown", (e) => {
      if (e.key === "ArrowRight" || e.key === "ArrowUp") { e.preventDefault(); setDrag(drag + 0.25, true); if (drag > 0.99) unlock(); }
      if (e.key === "ArrowLeft" || e.key === "ArrowDown") { e.preventDefault(); setDrag(drag - 0.25, true); }
    });
    addEventListener("resize", () => { setDrag(drag, false); if (locked) lockY = lockPoint(); });
  }

  const gradeShader = {
    uniforms: { tDiffuse: { value: null }, uTime: { value: 0 } },
    vertexShader: "varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }",
    fragmentShader: `uniform sampler2D tDiffuse; uniform float uTime; varying vec2 vUv;
      float hash(vec2 p){ return fract(sin(dot(p, vec2(12.9898, 78.233)) + uTime) * 43758.5453); }
      void main(){
        vec4 c = texture2D(tDiffuse, vUv);
        float l = dot(c.rgb, vec3(0.299, 0.587, 0.114));
        c.rgb = mix(c.rgb * vec3(0.86, 0.96, 1.12), c.rgb, smoothstep(0.05, 0.5, l));   // blue in the shadows
        c.rgb = (c.rgb - 0.5) * 1.08 + 0.5;                                               // a little contrast
        vec2 d = vUv - 0.5; c.rgb *= 1.0 - dot(d, d) * 1.15;                              // vignette
        c.rgb += (hash(vUv * 900.0) - 0.5) * 0.025;                                       // grain
        gl_FragColor = c;
      }`,
  };
  let composer = null, grade = null;
  if (!lite) {
    composer = new EffectComposer(renderer);
    composer.addPass(new RenderPass(scene, camera));
    composer.addPass(new UnrealBloomPass(new THREE.Vector2(512, 512), 0.85, 0.55, 0.62));
    composer.addPass(new OutputPass());
    grade = new ShaderPass(gradeShader);
    composer.addPass(grade);
    composer.setPixelRatio(renderer.getPixelRatio());
    composer.setSize(innerWidth, innerHeight);
  }

  const chapter = register({
    el: stage, scene, camera,
    toneMapping: THREE.NeutralToneMapping, exposure: 1.3,
    onCanvas(w, h, dpr) { if (composer) { composer.setPixelRatio(dpr); composer.setSize(w, h); } },
    render: composer ? (r) => { grade.uniforms.uTime.value = performance.now() / 1000 % 10; composer.render(); } : undefined,
    update(dt, t) {
      timeU.value = t;
      pointer.ease(dt, 1.8);
      cur = window.__qaInstant ? prog : damp(cur, prog, 5, dt);
      const p = cur;
      // 0–0.8 the walk, 0.8–0.92 up to the gate looking at the relic, 0.92–1 the door opens and we go in
      const w = smooth(0.02, 0.8, p), up = smooth(0.8, 0.92, p);
      // The door waits at the threshold: it sinks for a confirmed 18+ visitor, and trembles while the plate slides
      gateK = damp(gateK, unlocked ? 1 : 0, 3.2, dt);
      syncLock();
      const pass = confirmed ? 1 : gateK;
      const open = Math.max(confirmed ? smooth(0.9, 0.98, p) : 0, gateK, drag * 0.14);
      const inn = smooth(0.95, 1, p) * pass;
      path.getPointAt(Math.min(0.999, w), pos);
      path.getPointAt(Math.min(1, w + 0.02), ahead);
      pos.y += Math.sin(w * 90) * 0.025 * (1 - up);             // footsteps
      // Phones see a narrow slice of the world, so at the gate they stand further back and aim at the door itself
      const narrow = clamp01((1.5 - camera.aspect) / 0.9);
      tmp.copy(gatePos); tmp.z += 1.5 + narrow * 5.2 - inn * (2.2 + narrow * 5.2);
      pos.lerp(tmp, up);
      camera.position.copy(pos);
      ahead.y = pos.y - 0.05;
      look.copy(ahead).lerp(tmp.set(0, platformY + 4.2 - narrow * 1.6 - inn * 2.2, Z_TEMPLE), up);
      const glance = smooth(0.26, 0.34, p) * (1 - smooth(0.48, 0.56, p));   // look at the counting table
      look.lerp(tmp.set(TABLE.x - 0.2, 0.75, TABLE.z + 0.6), glance * 0.85);
      look.x += pointer.x * 1.2 * (1 - up * 0.6);
      look.y += pointer.y * 0.6;
      camera.lookAt(look);
      camera.fov = 62 - up * 8;
      camera.updateProjectionMatrix();
      camU.value.copy(camera.position);

      // The world reacts
      for (const f of folk) { f.dt = dt; f.script(f, camera.position.z); f.c.mixer.update(dt); }
      for (const s of shafts) s.m.material.opacity = s.base + Math.sin(t * 0.7 + s.ph) * 0.04;
      for (const tt of torches) { const k = 0.8 + Math.sin(t * 13 + tt.seed) * 0.1 + Math.sin(t * 7.3 + tt.seed * 2) * 0.1; tt.l.intensity = 10 * k; tt.f.scale.setScalar(1.05 * k); }
      spores.rotation.y = Math.sin(t * 0.05) * 0.02;

      // Spirits: bob ahead of the explorer; near the temple they stream into the relic
      const gather = smooth(0.78, 0.9, p);
      const camZ = camera.position.z;
      for (let i = 0; i < SP; i++) {
        const d = spData[i];
        let z = d.z;
        if (z > camZ - 2.2) z -= 60;                                // never in your face; those behind come round ahead
        const x = d.x + Math.sin(t * d.sp + d.ph) * 0.4, y = d.y + Math.sin(t * d.sp * 1.3 + d.ph) * 0.25;
        const k = Math.min(1, gather * (1.2 + (i % 7) * 0.12));
        spPos[i * 3] = x + (relic.position.x - x) * k;
        spPos[i * 3 + 1] = y + (relic.position.y - y) * k;
        spPos[i * 3 + 2] = z + (Z_TEMPLE + relic.position.z - z) * k;
      }
      spGeo.attributes.position.needsUpdate = true;
      spiritLight.position.set(Math.sin(t * 0.6) * 0.8, 2.2, camZ - 3.5);
      spiritLight.intensity = 6 * (1 - gather);

      // The relic lights as the spirits arrive; the door sinks; the light behind it floods the view
      const lit = gather;
      relicMat[0].emissiveIntensity = 0.15 + lit * 0.9;
      relicMat[1].emissiveIntensity = 0.2 + lit * 0.8;
      relicHalo.material.opacity = lit * 0.6;
      arcTick += dt;
      if (arcTick > 1 / 22) {
        arcTick = 0;
        const head = t * 0.08;
        relicArc.draw((u, out) => { const f = ((head + u * 0.35) % 1) * track.length, i0 = Math.floor(f) % track.length; out.set(track[i0].x, track[i0].y, 0.14); }, { jag: 0.06, seed: Math.floor(t * 22) });
      }
      relicArc.material.uniforms.uIntensity.value = lit * 1.6;
      door.position.y = platformY + 2.2 - open * 4.6;
      beyond.material.color.setRGB(0.24 + inn * 0.7, 0.85 + inn * 0.15, 1);
      flash.style.opacity = (smooth(0.955, 0.995, p) * 0.9 * pass).toFixed(3);

      // Copy beats
      const b = p < 0.1 ? 0 : p > 0.28 && p < 0.5 ? 1 : p > 0.8 && p < (confirmed || unlocked ? 0.97 : 1.01) ? 2 : -1;
      if (b !== beatOn) {
        beatOn = b;
        beats.forEach((el, i) => el.classList.toggle("is-on", i === b));
        if (b === 1) toast?.("Сквозь джунгли", "Вы зашли глубже, чем большинство");
        if (b === 2) toast?.("Храм найден", "Удача где-то рядом");
      }
    },
  });

  return { chapter, start() { if (beatOn < 0) beats[0]?.classList.add("is-on"); } };   // the scroll may already own the beats
}
