// «Проверь себя» — your pick against ours and the readers'.
//
// The LUCK plate hangs between the two teams of today's match, with a thin arc feeling toward each side. Grab it and
// throw it at the team you believe in (or tap the name): it lands there with a thud, and the arcs settle into the
// readers' split — the brighter the arc, the more readers backed that side. The copy says where the editors stand.

import * as THREE from "three";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import { register, renderer, reduced, lite, damp, smooth } from "./world.js";
import { loadPlate, plateGeometry, createArc, glowTexture } from "./brand.js";
import { state } from "./blocks.js";
import { stoneIdol } from "./props.js";
import { DAY } from "./content.js";

function thud() {
  const ac = window.__ac;
  if (!window.__sound || !ac) return;
  const t = ac.currentTime;
  const o = ac.createOscillator(), g = ac.createGain();
  o.type = "sine"; o.frequency.setValueAtTime(110, t); o.frequency.exponentialRampToValueAtTime(42, t + 0.35);
  g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.45, t + 0.01); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.7);
  o.connect(g).connect(ac.destination); o.start(t); o.stop(t + 0.8);
  const len = Math.floor(ac.sampleRate * 0.12), buf = ac.createBuffer(1, len, ac.sampleRate), d = buf.getChannelData(0);
  for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3);
  const n = ac.createBufferSource(), f = ac.createBiquadFilter(), ng = ac.createGain();
  n.buffer = buf; f.type = "highpass"; f.frequency.value = 2400; ng.gain.value = 0.14;
  n.connect(f).connect(ng).connect(ac.destination); n.start(t);
}

export async function initCheck() {
  const section = document.getElementById("check");
  const stage = section.querySelector("[data-stage]");
  const teamEls = [...section.querySelectorAll(".team-drop")];
  const plate = await loadPlate();

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 100);
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.add(new THREE.AmbientLight(0x8fa0ff, 0.3));
  const key = new THREE.DirectionalLight(0xffffff, 1.2);
  key.position.set(-3, 5, 8);
  scene.add(key);

  const PW = 2.6;
  const body = new THREE.Mesh(plateGeometry(plate, { width: PW, depth: 0.16, bevel: 0.025 }), [
    new THREE.MeshPhysicalMaterial({ color: 0x3dd9ff, emissive: 0x13a4d4, emissiveIntensity: 0.3, roughness: 0.42, clearcoat: 0.35, envMapIntensity: 0.28 }),
    new THREE.MeshStandardMaterial({ color: 0x0b5a74, emissive: 0x0e7fa3, emissiveIntensity: 0.35, roughness: 0.4, metalness: 0.2 }),
  ]);
  const puck = new THREE.Group();
  puck.add(body);
  const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture(), color: 0x3dd9ff, transparent: true, opacity: 0.3, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false }));
  halo.scale.set(PW * 1.9, PW * 0.9, 1);
  halo.position.z = -0.4;
  puck.add(halo);
  scene.add(puck);

  // Each team stands as a carved idol; the plate is thrown to the one you believe in
  const idols = { a: stoneIdol({ height: 2.6 }), b: stoneIdol({ height: 2.6 }) };
  for (const side of ["a", "b"]) { idols[side].group.rotation.y = side === "a" ? 0.34 : -0.34; scene.add(idols[side].group); }

  const arcs = { a: createArc({ points: 64, width: 0.07 }), b: createArc({ points: 64, width: 0.07 }) };
  scene.add(arcs.a.mesh, arcs.b.mesh);

  // Where the team names are, in world space (they are DOM buttons at the sides)
  const anchor = { a: new THREE.Vector3(), b: new THREE.Vector3() };
  let W = 1, H = 1, half = 4, dist = 12;
  const placeAnchors = () => {
    const r = stage.getBoundingClientRect();
    for (const el of teamEls) {
      const b = el.querySelector(".team-drop__name").getBoundingClientRect();
      const nx = ((b.left + b.width / 2 - r.left) / r.width) * 2 - 1, ny = -(((b.top + b.height * 1.2 - r.top) / r.height) * 2 - 1);
      anchor[el.dataset.side].set(nx * half, ny * half / (W / H), 0);
      const ai = anchor[el.dataset.side];
      idols[el.dataset.side].group.position.set(ai.x, ai.y - 2.9, -4);   // the idol stands under its name
    }
  };

  // ── Drag ──
  let mine = state.mine, target = new THREE.Vector3(0, -0.3, 0), dragging = false, landT = -10, t0 = 0;
  const px = { x: 0, y: 0 };
  const toWorld = (e) => {
    const r = stage.getBoundingClientRect();
    return new THREE.Vector3((((e.clientX - r.left) / r.width) * 2 - 1) * half, -(((e.clientY - r.top) / r.height) * 2 - 1) * half / (W / H), 0);
  };
  let narrow = false;
  // Where the plate rests: between the teams, or by the chosen one (under it on a phone)
  const home = () => {
    if (!mine) return new THREE.Vector3(0, narrow ? -1.1 : -0.3, 0);
    return anchor[mine].clone().add(narrow ? new THREE.Vector3(mine === "a" ? 0.35 : -0.35, -0.72, 0) : new THREE.Vector3(mine === "a" ? PW * 0.62 : -PW * 0.62, -0.45, 0));
  };
  stage.addEventListener("pointerdown", (e) => {
    if (e.target.closest("button, a, input")) return;
    const w = toWorld(e);
    if (w.distanceTo(puck.position) > PW * 0.75 * puck.scale.x + 0.2) return;      // only the plate itself is grabbed
    dragging = true;
    stage.setPointerCapture(e.pointerId);
    stage.classList.add("is-dragging");
  });
  stage.addEventListener("pointermove", (e) => {
    const w = toWorld(e);
    px.x = w.x; px.y = w.y;
    stage.classList.toggle("can-grab", !dragging && w.distanceTo(puck.position) < PW * 0.75);
    if (dragging) target.copy(w);
  });
  const release = () => {
    if (!dragging) return;
    dragging = false;
    stage.classList.remove("is-dragging");
    const side = target.x < -half * 0.25 ? "a" : target.x > half * 0.25 ? "b" : null;
    if (side) state.choose(side);       // blocks.js renders the split; the listener below lands the plate
    else target.copy(home());
  };
  stage.addEventListener("pointerup", release);
  stage.addEventListener("pointercancel", release);
  state.on((s) => {
    if (s.mine && s.mine !== mine) { mine = s.mine; landT = performance.now() / 1000; thud(); }
    target.copy(home());
  });

  const chapter = register({
    el: stage, scene, camera,
    toneMapping: THREE.NeutralToneMapping, exposure: 1,
    resize(w, h) {
      W = w; H = h;
      narrow = w < 860;
      dist = narrow ? 15 : 12;
      puck.scale.setScalar(narrow ? 0.5 : 1);
      half = dist * Math.tan(THREE.MathUtils.degToRad(15)) * (w / h);
      placeAnchors();
      if (!dragging) target.copy(home());
    },
    update(dt, t) {
      t0 = t;
      camera.position.set(0, 0, dist);
      camera.lookAt(0, 0, 0);
      const k = window.__qaInstant ? 1 : 1 - Math.exp(-(dragging ? 18 : 7) * dt);
      puck.position.lerp(target, k);
      puck.position.y += Math.sin(t * 1.4) * 0.002;
      puck.rotation.z = THREE.MathUtils.clamp((target.x - puck.position.x) * -0.15, -0.35, 0.35);
      puck.rotation.y = Math.sin(t * 0.7) * 0.12;
      for (const side of ["a", "b"]) idols[side].setGlow(mine === side ? 0.95 : mine ? 0.12 : 0.3 + Math.sin(t * 2 + (side === "a" ? 0 : 1.6)) * 0.12);
      const since = performance.now() / 1000 - landT;
      body.material[0].emissiveIntensity = 0.3 + (since < 1.2 ? (1 - since / 1.2) * 0.9 : 0);
      halo.material.opacity = 0.25 + (since < 1.2 ? (1 - since / 1.2) * 0.5 : 0);

      // Arcs: before a choice they feel toward both sides; after it, they carry the readers' split
      const share = mine ? DAY.readers : { a: 0.5, b: 0.5 };
      for (const side of ["a", "b"]) {
        const from = puck.position, to = anchor[side];
        const near = from.distanceTo(to) < PW * puck.scale.x * 0.95 && mine === side;
        arcs[side].mesh.visible = !near;
        arcs[side].draw((u, out) => { out.lerpVectors(from, to, u); out.y += Math.sin(Math.PI * u) * 0.35; }, { jag: 0.28, seed: Math.floor(t * 20) + (side === "a" ? 0 : 50), w: 0.05 + share[side] * 0.1 });
        arcs[side].material.uniforms.uIntensity.value = (mine ? 0.35 + share[side] * 1.6 : 0.55 + Math.sin(t * 3 + (side === "a" ? 0 : 2)) * 0.2) * (reduced ? 0.8 : 1);
      }
    },
  });
  addEventListener("resize", () => requestAnimationFrame(placeAnchors));
  document.fonts?.ready.then(placeAnchors);
  section.classList.add("is-3d");
  return { chapter, start() { placeAnchors(); } };
}
