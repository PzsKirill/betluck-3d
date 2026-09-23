// «Сундук удачи» — the temple's chest of welcome bonuses.
//
// Five stone tablets circle the chest, one per legal bookmaker from our rating. Open the chest and the ring spins:
// it runs fast, slows down over six seconds, overshoots the notch and settles back into it — the pacing of a
// case opening, which is what makes the moment worth watching. The tablet at the notch rises over the light while
// the spirits of luck pour out of the lid.
//
// It is not a game for money and nothing is won here: the chest only shows one of five real welcome offers, and all
// five stand in the rating below (ст. 27 «О рекламе» — no promise of winnings, no players, 18+ and the warning stay).

import * as THREE from "three";
import { register, renderer, lite, reduced, pointerFor, damp, clamp01, dotTexture } from "./world.js";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";
import { loadModels, place } from "./models.js";
import { glowTexture } from "./brand.js";
import { BOOKS } from "./content.js";

const FOG = 0x0b1a22, CYAN = 0x3dd9ff, TAU = Math.PI * 2;
const PED_TOP = 0.7, CH_H = 0.98, CUT = 0.52;            // pedestal top, chest height, where the lid is cut off
const RAD = 2.2, RY = 2.05;                              // the ring of tablets

// A carved tablet: the bookmaker's name and what it offers
function tabletTexture(book) {
  const c = document.createElement("canvas");
  c.width = 512; c.height = 320;
  const g = c.getContext("2d");
  g.fillStyle = "#18272F"; g.fillRect(0, 0, 512, 320);
  for (let i = 0; i < 1200; i++) {                        // stone grain
    g.fillStyle = `rgba(${Math.random() < 0.5 ? "255,255,255" : "0,0,0"},${Math.random() * 0.05})`;
    g.fillRect(Math.random() * 512, Math.random() * 320, 2, 2);
  }
  const frame = g.createLinearGradient(0, 0, 0, 320);
  frame.addColorStop(0, "#3DD9FFaa"); frame.addColorStop(1, "#3DD9FF44");
  g.strokeStyle = frame; g.lineWidth = 6; g.strokeRect(20, 20, 472, 280);
  g.textAlign = "center";
  g.fillStyle = "#F4FCFF"; g.font = '800 68px Geologica, "Segoe UI", sans-serif';
  g.fillText(book.name, 256, 162, 430);
  g.fillStyle = "#A8DCEC"; g.font = '500 30px Geologica, "Segoe UI", sans-serif';
  const lines = [""];
  for (const w of book.bonus.split(" ")) {
    const line = lines.at(-1) ? `${lines.at(-1)} ${w}` : w;
    if (g.measureText(line).width > 400) lines.push(w); else lines[lines.length - 1] = line;
  }
  lines.slice(0, 2).forEach((l, i) => g.fillText(l, 256, 220 + i * 36));
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = Math.min(4, renderer.capabilities.getMaxAnisotropy());
  return t;
}

function tick() {                                          // one stone click as a tablet passes the notch
  if (!window.__sound || !window.__ac) return;
  const ac = window.__ac, t = ac.currentTime;
  const o = ac.createOscillator(), g = ac.createGain();
  o.type = "square"; o.frequency.value = 760 + Math.random() * 180;
  g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.05, t + 0.004); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.055);
  o.connect(g).connect(ac.destination); o.start(t); o.stop(t + 0.06);
}

function creak() {                                         // the lid
  if (!window.__sound || !window.__ac) return;
  const ac = window.__ac, t = ac.currentTime;
  const o = ac.createOscillator(), g = ac.createGain();
  o.type = "sawtooth"; o.frequency.setValueAtTime(90, t); o.frequency.exponentialRampToValueAtTime(210, t + 0.5);
  const f = ac.createBiquadFilter(); f.type = "lowpass"; f.frequency.value = 700;
  g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.09, t + 0.08); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.7);
  o.connect(f).connect(g).connect(ac.destination); o.start(t); o.stop(t + 0.75);
}

export async function initChest({ gsap, ScrollTrigger }) {
  const section = document.getElementById("chest");
  const stage = section.querySelector("[data-stage]");
  const goBtn = section.querySelector("#chestGo");
  const card = section.querySelector("#chestCard");
  const M = await loadModels(["chestGold", "column", "torch", "pot", "rock2", "shrooms"]);
  await document.fonts?.ready;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(FOG);
  scene.fog = new THREE.FogExp2(FOG, 0.055);
  const camera = new THREE.PerspectiveCamera(42, 1, 0.05, 60);
  const room = new THREE.Group();                          // the whole set slides right of the copy on wide screens
  scene.add(room);

  scene.add(new THREE.HemisphereLight(0x87b0d6, 0x16241c, 1.5));
  const key = new THREE.DirectionalLight(0xcfe4ff, 1.5);
  key.position.set(-5, 8, 6);
  scene.add(key);
  const rim = new THREE.DirectionalLight(0x2f7f9c, 1.1);   // a cold edge from behind, so the stone has a shape
  rim.position.set(3, 3, -7);
  scene.add(rim);

  const stone = (src, dim = 1) => { const m = src.clone(); if (m.color) m.color.multiplyScalar(dim); m.roughness = 0.9; m.metalness = 0; m.envMapIntensity = 0.25; return m; };

  // ── The treasury: a stone floor, a back wall, two columns and their torches ──
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(30, 30).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0x223840, roughness: 0.95 }));
  room.add(floor);
  const wall = new THREE.Mesh(new THREE.PlaneGeometry(22, 9), new THREE.MeshStandardMaterial({ color: 0x1a2c35, roughness: 1 }));
  wall.position.set(0, 4.5, -6.2);
  room.add(wall);
  for (const sx of [-1, 1]) {
    if (M.column) room.add(place(M.column, { x: sx * 3.3, y: 0, z: -2.4, height: 4.4, material: (m) => stone(m, 0.9) }));
    if (M.pot) room.add(place(M.pot, { x: sx * 2.1, y: 0, z: 0.8, height: 0.55, ry: sx, material: (m) => stone(m, 0.9) }));
    if (M.rock2) room.add(place(M.rock2, { x: sx * 4.2, y: 0, z: -0.6, height: 0.7, ry: sx * 2, material: (m) => stone(m, 0.8) }));
    if (M.shrooms) room.add(place(M.shrooms, { x: sx * 3.6, y: 0, z: 0.4, height: 0.35, material: (m) => { const s = m.clone(); s.emissive = new THREE.Color(CYAN); s.emissiveIntensity = 1.1; return s; } }));
  }
  const torches = [];
  for (const sx of [-1, 1]) {
    if (M.torch) room.add(place(M.torch, { x: sx * 2.9, y: 1.1, z: -2.5, height: 0.8, material: (m) => stone(m, 0.9) }));
    const l = new THREE.PointLight(0xffab52, 14, 9, 1.7);
    l.position.set(sx * 2.9, 1.78, -2.4);
    const f = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture(), color: 0xffa040, transparent: true, opacity: 0.8, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false }));
    f.scale.setScalar(1.1); f.position.copy(l.position);
    room.add(l, f);
    torches.push({ l, f, seed: Math.random() * 10 });
  }

  // ── The pedestal and the chest. The lid is the same model, cut in two by a plane that rides with the hinge ──
  renderer.localClippingEnabled = true;
  const stepMat = new THREE.MeshStandardMaterial({ color: 0x24333b, roughness: 0.94 });
  const step = new THREE.Mesh(new THREE.BoxGeometry(2, 0.2, 1.6), stepMat);
  step.position.y = 0.1;
  const ped = new THREE.Mesh(new THREE.BoxGeometry(1.5, PED_TOP - 0.2, 1.15), stepMat);
  ped.position.y = 0.2 + (PED_TOP - 0.2) / 2;
  room.add(step, ped);

  const cutY = PED_TOP + CH_H * CUT;
  const planeBase = new THREE.Plane(new THREE.Vector3(0, -1, 0), cutY);
  const planeLid0 = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), planeLid = planeLid0.clone();
  let lidGroup = null;
  const clipped = (plane) => (src) => { const m = stone(src, 1); m.clippingPlanes = [plane]; return m; };
  if (M.chestGold) {
    room.add(place(M.chestGold, { y: PED_TOP, height: CH_H, material: clipped(planeBase) }));
    const pivot = new THREE.Group();
    pivot.position.set(0, cutY, -0.36);                                              // the hinge sits on the back edge
    pivot.add(place(M.chestGold, { y: -(cutY - PED_TOP), z: 0.36, height: CH_H, material: clipped(planeLid) }));
    room.add(pivot);
    lidGroup = pivot;
  }

  // Inside: a dark box so the open chest is not see-through, and the light that lives in it
  const inner = new THREE.Mesh(new THREE.BoxGeometry(0.72, 0.5, 0.5), new THREE.MeshStandardMaterial({ color: 0x08141a, roughness: 1, side: THREE.BackSide }));
  inner.position.set(0, PED_TOP + 0.28, 0);
  room.add(inner);
  const innerLight = new THREE.PointLight(CYAN, 0, 5, 1.6);
  innerLight.position.set(0, PED_TOP + 0.45, 0);
  room.add(innerLight);
  const burst = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture(), color: CYAN, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false }));
  burst.scale.setScalar(1.5);
  burst.position.set(0, PED_TOP + 0.45, 0);
  room.add(burst);
  const beam = new THREE.Mesh(
    new THREE.CylinderGeometry(0.1, 0.44, 2.4, 24, 1, true),
    new THREE.MeshBasicMaterial({ color: CYAN, transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, toneMapped: false }),
  );
  beam.position.set(0, PED_TOP + 1.3, 0);
  room.add(beam);

  // Spirits of luck pouring out of the open lid
  const SP = lite ? 26 : 60;
  const spGeo = new THREE.BufferGeometry();
  const spPos = new Float32Array(SP * 3);
  const spData = Array.from({ length: SP }, () => ({ a: Math.random() * TAU, r: 0.12 + Math.random() * 0.5, y: Math.random() * 2, sp: 0.3 + Math.random() * 0.5 }));
  spGeo.setAttribute("position", new THREE.BufferAttribute(spPos, 3));
  const spirits = new THREE.Points(spGeo, new THREE.PointsMaterial({ size: 0.075, map: dotTexture(), color: CYAN, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false }));
  room.add(spirits);

  // ── The ring of tablets, tilted so it reads as a ring, and the notch they land in ──
  const ring = new THREE.Group();
  ring.position.y = RY;
  ring.rotation.x = -0.18;
  room.add(ring);
  const tablets = BOOKS.map((b, i) => {
    const g = new THREE.Group();
    const face = new THREE.Mesh(new THREE.PlaneGeometry(0.72, 0.45), new THREE.MeshBasicMaterial({ map: tabletTexture(b), transparent: true, toneMapped: false }));
    face.position.z = 0.035;
    const frame = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.53, 0.06), new THREE.MeshStandardMaterial({ color: 0x2a3b45, roughness: 0.92 }));
    const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture(), color: CYAN, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false }));
    halo.scale.set(1.7, 1.3, 1); halo.position.z = -0.1;
    g.add(frame, face, halo);
    ring.add(g);
    return { g, face, halo, pull: 0, book: b, base: (i / BOOKS.length) * TAU };
  });
  const notch = new THREE.Group();                                                   // two cyan teeth mark the slot
  for (const sy of [-1, 1]) {
    const tooth = new THREE.Mesh(new THREE.ConeGeometry(0.07, 0.17, 3), new THREE.MeshBasicMaterial({ color: CYAN, toneMapped: false }));
    tooth.position.set(0, sy * 0.34, 0);
    tooth.rotation.x = sy > 0 ? Math.PI : 0;
    notch.add(tooth);
  }
  notch.position.set(0, 0, RAD - 0.02);                                              // inside the ring, so it carries the tilt
  ring.add(notch);

  // ── The spin ──
  const DUR = reduced ? 1.2 : 6.0, SETTLE = 0.85, OVER = 0.17;
  let angle = 0, spinAt = -99, from = 0, to = 0, winner = -1, opened = false, shown = false, lastCross = 0, now = 0;

  function spin() {
    if (spinAt > 0 && now < spinAt + DUR + SETTLE + 0.2) return;
    let i = Math.floor(Math.random() * tablets.length);
    if (tablets.length > 1 && i === winner) i = (i + 1 + Math.floor(Math.random() * (tablets.length - 1))) % tablets.length;
    winner = i;
    from = angle;
    const want = -tablets[i].base;
    const turns = 4 + Math.floor(Math.random() * 2);
    to = want + Math.ceil((from + turns * TAU - want) / TAU) * TAU;
    spinAt = now;
    opened = true; shown = false;
    lastCross = Math.floor(angle / (TAU / tablets.length));
    card.hidden = true;
    goBtn.disabled = true;
    goBtn.querySelector("span").textContent = "Сундук открывается…";
    creak();
  }

  function reveal() {
    shown = true;
    const b = tablets[winner].book;
    card.innerHTML = `<p class="chest__k">Духи вынесли</p>
      <p class="chest__name">${b.name}</p>
      <p class="chest__bonus">${b.bonus}</p>
      <p class="chest__cond">${b.score ? `Оценка в нашем рейтинге — ${String(b.score).replace(".", ",")} из 5. ` : ""}Размер и условия — на сайте букмекера.</p>
      <div class="chest__acts"><a class="btn btn--ghost" href="#books"><span>Все пять в рейтинге</span></a>
      <button class="link" type="button" data-again>Открыть ещё раз</button></div>`;
    card.hidden = false;
    section.classList.add("is-open");                    // on phones this frees the room the card needs
    goBtn.disabled = false;
    goBtn.querySelector("span").textContent = "Открыть ещё раз";
    window.__achieve?.("Сундук открыт", "В нём — предложения легальных букмекеров");
  }

  goBtn.addEventListener("click", spin);
  card.addEventListener("click", (e) => { if (e.target.closest("[data-again]")) spin(); });

  let approach = 0;
  ScrollTrigger.create({ trigger: section, start: "top bottom", end: "bottom top", onUpdate: (s) => { approach = s.progress; } });
  const pointer = pointerFor(stage);
  let narrow = false;

  let composer = null;
  if (!lite) {
    composer = new EffectComposer(renderer);
    composer.addPass(new RenderPass(scene, camera));
    composer.addPass(new UnrealBloomPass(new THREE.Vector2(512, 512), 0.62, 0.5, 0.7));
    composer.addPass(new OutputPass());
    composer.setPixelRatio(renderer.getPixelRatio());
    composer.setSize(innerWidth, innerHeight);
  }

  const chapter = register({
    el: stage, scene, camera,
    toneMapping: THREE.NeutralToneMapping, exposure: 1.2,
    onCanvas(w, h, dpr) { if (composer) { composer.setPixelRatio(dpr); composer.setSize(w, h); } },
    render: composer ? () => composer.render() : undefined,
    resize(w, h) {
      narrow = w / h < 1;
      room.position.x = narrow ? 0 : 1.8;                 // on wide screens the chest stands right of the copy
    },
    update(dt, t) {
      now = t;
      pointer.ease(dt, 1.6);
      const near = clamp01((approach - 0.15) / 0.5);
      camera.position.set(pointer.x * 0.45, (narrow ? 3.1 : 2.6) + pointer.y * 0.25, (narrow ? 7.4 : 5.6) - near * 0.5);
      camera.lookAt(room.position.x, narrow ? 0.9 : 1.75, 0);   // on a phone the set rides high, above the copy

      for (const tt of torches) {
        const k = 0.8 + Math.sin(t * 12 + tt.seed) * 0.12 + Math.sin(t * 7 + tt.seed * 2) * 0.08;
        tt.l.intensity = 14 * k;
        tt.f.scale.setScalar(1.1 * k);
      }

      // the spin: fast, then a long ease out past the notch, then it settles back into it
      if (spinAt > 0) {
        const e = t - spinAt;
        if (e < DUR) angle = from + (to + OVER - from) * (1 - Math.pow(1 - e / DUR, 4.2));
        else if (e < DUR + SETTLE) angle = to + OVER * Math.pow(1 - (e - DUR) / SETTLE, 3);
        else { angle = to; if (!shown) reveal(); }
        const cross = Math.floor(angle / (TAU / tablets.length));
        if (cross !== lastCross) { lastCross = cross; tick(); }
      } else {
        angle += dt * 0.12;                                 // before the first opening the ring drifts slowly
      }

      if (lidGroup) {
        lidGroup.rotation.x = damp(lidGroup.rotation.x, opened ? -0.95 : 0, 2.6, dt);
        lidGroup.updateMatrixWorld(true);
        planeLid.copy(planeLid0).applyMatrix4(lidGroup.matrixWorld);     // the cut rides with the hinge
      }
      const glow = lidGroup ? clamp01(-lidGroup.rotation.x / 0.95) : (opened ? 1 : 0);
      innerLight.intensity = 2.5 + glow * 20;                 // even shut, the chest breathes a little light
      burst.material.opacity = 0.12 + glow * 0.78;
      burst.scale.setScalar(1.2 + glow * 0.8 + Math.sin(t * 2.2) * 0.05);
      beam.material.opacity = glow * (shown ? 0.26 : 0.14);
      spirits.material.opacity = glow * 0.9;
      for (let i = 0; i < SP; i++) {
        const d = spData[i];
        d.y += dt * d.sp * (0.5 + glow);
        if (d.y > 2.3) { d.y = 0; d.a = Math.random() * TAU; }
        const r = d.r * (0.5 + d.y * 0.7);
        spPos[i * 3] = Math.cos(d.a + d.y * 1.6) * r;
        spPos[i * 3 + 1] = PED_TOP + 0.35 + d.y;
        spPos[i * 3 + 2] = Math.sin(d.a + d.y * 1.6) * r;
      }
      spGeo.attributes.position.needsUpdate = true;
      for (const tooth of notch.children) { tooth.material.transparent = true; tooth.material.opacity = shown ? 0.35 : 0.9; }

      for (let i = 0; i < tablets.length; i++) {
        const tb = tablets[i], a = tb.base + angle;
        tb.pull = damp(tb.pull, shown && i === winner ? 1 : 0, 3.4, dt);
        const r = RAD - tb.pull * 0.45;                      // the winner rises rather than rushes the lens
        tb.g.position.set(Math.sin(a) * r, tb.pull * 0.66 + Math.sin(t * 0.9 + i) * 0.025, Math.cos(a) * r);
        tb.g.position.x -= tb.pull * 0.62;                   // and drifts back over the chest, clear of the toast
        tb.g.rotation.y = a * (1 - tb.pull);
        tb.g.rotation.x = ring.rotation.x * -tb.pull;        // the winner squares up to the camera
        tb.g.scale.setScalar(1 + tb.pull * 0.55);
        tb.halo.material.opacity = tb.pull * 0.6;
        const facing = clamp01(Math.cos(a) * 1.4 + 0.25);    // the far side of the ring fades out, or it is just clutter
        tb.face.material.opacity = (shown ? 0.35 + tb.pull * 0.65 : 1) * (0.1 + facing * 0.9);
        tb.g.children[0].visible = facing > 0.04;
      }
    },
  });

  section.classList.add("is-3d");
  return { chapter, start() {} };
}
