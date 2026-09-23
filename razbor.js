// «Разбор» — the pick taken apart.
//
// The LUCK plate from the hero splits into four glass sheets, one per layer of the prediction. Each sheet carries
// its layer drawn from the real data — form, the maps game by game, how long the games ran, the odds — and comes
// forward in turn while the matching line of copy lights up. Then the sheets close back into one plate and the
// verdict lands on it: VISION 2:1, and the series did end 2:1.

import * as THREE from "three";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";
import { register, renderer, reduced, lite, pointerFor, damp, smooth, dotTexture } from "./world.js";
import { loadPlate, plateShape, plateGeometry, glowTexture } from "./brand.js";
import { stoneTotem } from "./props.js";
import { loadModels, place } from "./models.js";
import { MATCH } from "./content.js";

const PW = 5.4;
const INK = "#F8F8F8", CYAN = "#3DD9FF", MUTE = "#9A98B8", SILVER = "#C9D1E6";

// The layers as drawings. Values come from tournament.json (see docs/research.md); games listed in playoff order.
async function sheetTextures(tour) {
  await Promise.race([document.fonts?.load("800 60px Geologica"), new Promise((r) => setTimeout(r, 1500))]);
  const ser = Object.fromEntries(tour.rounds.flatMap((r) => r.series).map((s) => [s.id, s]));
  const before = ["ub-qf-2", "ub-sf-1", "ub-qf-3", "ub-sf-2"];
  const teamGames = (team) => before.map((id) => ser[id]).filter((s) => s.a === team || s.b === team).map((s) => {
    const side = s.a === team ? "a" : "b", opp = side === "a" ? s.b : s.a;
    return { opp, won: s.winner === side, score: side === "a" ? s.score : [...s.score].reverse(), games: s.games.map((g) => ({ win: g.winner === side, min: Math.round(g.duration / 60) })) };
  });
  const V = teamGames("TEAM VISION"), Y = teamGames("Team Yandex");
  const short = (n) => n.replace(/^Team /, "").replace("Nigma Galaxy", "Nigma");

  const make = (draw) => {
    const c = document.createElement("canvas");
    c.width = 1024; c.height = 256;
    const g = c.getContext("2d");
    g.textBaseline = "alphabetic";
    draw(g);
    const t = new THREE.CanvasTexture(c);
    t.colorSpace = THREE.SRGBColorSpace;
    t.anisotropy = 4;
    return t;
  };
  const font = (w, px) => `${w} ${px}px Geologica, "Segoe UI", sans-serif`;
  const rowLabel = (g, y, name) => { g.fillStyle = INK; g.font = font(800, 34); g.fillText(name, 150, y); };

  return [
    // 1 · Form: the playoff series before the final
    make((g) => {
      [[V, "VISION", 104], [Y, "Yandex", 186]].forEach(([list, name, y]) => {
        rowLabel(g, y, name);
        list.forEach((s, i) => {
          const x = 380 + i * 250;
          g.fillStyle = s.won ? CYAN : SILVER; g.font = font(800, 38);
          g.fillText(`${s.score[0]}:${s.score[1]}`, x, y);
          g.fillStyle = MUTE; g.font = font(500, 24);
          g.fillText(short(s.opp), x + 76, y);
        });
      });
    }),
    // 2 · Maps: every game, won or lost
    make((g) => {
      [[V, "VISION", 104], [Y, "Yandex", 186]].forEach(([list, name, y]) => {
        rowLabel(g, y, name);
        let x = 380;
        list.forEach((s) => {
          s.games.forEach((m) => {
            g.fillStyle = m.win ? CYAN : "#3A3960";
            g.beginPath(); g.moveTo(x + 10, y - 34); g.lineTo(x + 50, y - 34); g.lineTo(x + 40, y + 2); g.lineTo(x, y + 2); g.closePath(); g.fill();
            x += 60;
          });
          x += 34;
        });
      });
    }),
    // 3 · Tempo: game lengths in minutes, the average marked
    make((g) => {
      [[V, "VISION", 104], [Y, "Yandex", 186]].forEach(([list, name, y]) => {
        rowLabel(g, y, name);
        const mins = list.flatMap((s) => s.games.map((m) => m.min));
        const avg = Math.round(mins.reduce((a, b) => a + b, 0) / mins.length);
        const x0 = 380, scale = 5.2;
        g.fillStyle = "#26244A"; g.fillRect(x0, y - 30, 80 * scale, 30);
        g.fillStyle = name === "VISION" ? CYAN : SILVER; g.fillRect(x0, y - 30, avg * scale, 30);
        g.fillStyle = INK; g.font = font(800, 34); g.fillText(`${avg} мин`, x0 + 80 * scale + 20, y);
        g.fillStyle = MUTE; g.font = font(500, 22); g.fillText(mins.join(" · "), x0, y + 32);
      });
    }),
    // 4 · Odds: favourite, underdog, and the score we picked
    make((g) => {
      const rows = [["VISION", MATCH.a.odds, CYAN, 94], ["Yandex", MATCH.b.odds, SILVER, 160], ["VISION 2:1", MATCH.pick.odds, CYAN, 226]];
      rows.forEach(([k, v, col, y], i) => {
        g.fillStyle = i === 2 ? CYAN : INK; g.font = font(800, i === 2 ? 36 : 32); g.fillText(k, 150, y);
        g.fillStyle = "#26244A"; g.fillRect(420, y - 28, 420, 26);
        g.fillStyle = col; g.fillRect(420, y - 28, Math.min(420, (v / 4.2) * 420), 26);
        g.fillStyle = INK; g.font = font(800, 34); g.fillText(v.toFixed(2), 860, y);
      });
    }),
  ];
}

export async function initRazbor({ ScrollTrigger }) {
  const section = document.getElementById("razbor");
  const stage = section.querySelector("[data-stage]");
  const layerEls = [...section.querySelectorAll(".layer")];
  const verdictEl = document.getElementById("razborVerdict");
  const [plate, tour, M] = await Promise.all([loadPlate(), fetch("assets/data/tournament.json").then((r) => r.json()),
    loadModels(["wall", "arch", "column", "torch", "vines", "pothos", "fern", "bush", "rock2", "shrooms", "pebble"])]);
  const textures = await sheetTextures(tour);

  const FOG = 0x0a1820, FLOOR_Y = -3.2;
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(FOG);
  scene.fog = new THREE.FogExp2(FOG, 0.042);
  const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 100);
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environmentIntensity = 0.22;
  scene.add(new THREE.HemisphereLight(0x6f97c0, 0x16241c, 1.25));
  const key = new THREE.DirectionalLight(0xbcd6ff, 1.25);
  key.position.set(-4, 8, 6);
  scene.add(key);

  // ── The oracles' chamber: mossy stone, hanging vines, torchlight and a shaft of moonlight ──
  const room = new THREE.Group();
  scene.add(room);
  const mossy = (dim = 1) => (src) => { const m = src.clone(); if (m.color) m.color.multiplyScalar(dim); m.roughness = 0.97; m.metalness = 0; m.envMapIntensity = 0.15; return m; };
  const floorMat = new THREE.MeshStandardMaterial({ color: 0x223138, roughness: 0.98, metalness: 0 });
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(60, 46).rotateX(-Math.PI / 2), floorMat);
  floor.position.set(0, FLOOR_Y, -6);
  room.add(floor);
  const backWall = new THREE.Mesh(new THREE.PlaneGeometry(46, 20), new THREE.MeshStandardMaterial({ color: 0x1a2b31, roughness: 1, metalness: 0 }));
  backWall.position.set(0, FLOOR_Y + 10, -16);
  room.add(backWall);
  if (M.arch) room.add(place(M.arch, { x: 0, y: FLOOR_Y, z: -13.5, height: 7.5, material: mossy(0.8) }));
  for (const sx of [-1, 1]) {
    if (M.column) room.add(place(M.column, { x: sx * 8.5, y: FLOOR_Y, z: -11, height: 9, material: mossy(0.8) }));
    if (M.rock2) room.add(place(M.rock2, { x: sx * 6.4, y: FLOOR_Y, z: -8.5, height: 1.5, ry: sx * 2, material: mossy(0.7) }));
    if (M.fern) room.add(place(M.fern, { x: sx * 5.2, y: FLOOR_Y, z: -6.4, height: 1.2, ry: sx, material: mossy(0.5) }));
    if (M.shrooms) room.add(place(M.shrooms, { x: sx * 6.8, y: FLOOR_Y, z: -5.6, height: 0.55, material: (m) => { const c = m.clone(); c.emissive = new THREE.Color(0x3dd9ff); c.emissiveIntensity = 1.1; return c; } }));
    if (M.vines) for (let i = 0; i < 3; i++) room.add(place(M.vines, { x: sx * (2.6 + i * 2.4), y: FLOOR_Y + 12.5, z: -9 + i * 1.6, height: 5.5, ry: i, material: mossy(0.5) }));
    if (M.pothos) room.add(place(M.pothos, { x: sx * 9.2, y: FLOOR_Y + 9, z: -10, height: 4, ry: sx, material: mossy(0.5) }));
  }
  const torches = [];
  for (const sx of [-1, 1]) {
    if (M.torch) room.add(place(M.torch, { x: sx * 3.1, y: FLOOR_Y + 2.4, z: -10, height: 1.7, material: mossy(0.95) }));
    const l = new THREE.PointLight(0xffab52, 40, 22, 1.6);
    l.position.set(sx * 3.1, FLOOR_Y + 3.9, -9.6);
    const f = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture(), color: 0xffa040, transparent: true, opacity: 0.8, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false }));
    f.scale.setScalar(1.7); f.position.copy(l.position);
    room.add(l, f);
    torches.push({ l, f, seed: Math.random() * 10 });
  }
  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(1.4, 4.2, 14, 20, 1, true),
    new THREE.MeshBasicMaterial({ color: 0x9fd8ff, transparent: true, opacity: 0.07, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, toneMapped: false }));
  shaft.position.set(0, FLOOR_Y + 7, -7.5);
  room.add(shaft);
  const runeRing = new THREE.Mesh(new THREE.TorusGeometry(4.6, 0.05, 6, 48).rotateX(-Math.PI / 2),
    new THREE.MeshBasicMaterial({ color: 0x3dd9ff, transparent: true, opacity: 0.35, toneMapped: false }));
  runeRing.position.set(0, FLOOR_Y + 0.03, -4);
  room.add(runeRing);
  const spores = new THREE.Points(
    new THREE.BufferGeometry().setAttribute("position", new THREE.BufferAttribute(new Float32Array(Array.from({ length: (lite ? 40 : 90) * 3 }, () => 0)), 3)),
    new THREE.PointsMaterial({ size: 0.07, color: 0x8fd8ee, map: dotTexture(), transparent: true, opacity: 0.5, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false }));
  const spData = Array.from({ length: lite ? 40 : 90 }, () => ({ x: (Math.random() - 0.5) * 26, y: Math.random() * 9, z: -14 + Math.random() * 14, sp: 0.1 + Math.random() * 0.2, ph: Math.random() * 9 }));
  room.add(spores);

  // The sheets: the plate's outline without letters, dark glass, the drawing inside
  const shape = plateShape({ outer: plate.outer, holes: [] }, PW);
  const sheetGeo = new THREE.ShapeGeometry(shape, 8);
  sheetGeo.computeBoundingBox();
  const bb = sheetGeo.boundingBox, uv = sheetGeo.attributes.uv, pos = sheetGeo.attributes.position;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, (pos.getX(i) - bb.min.x) / (bb.max.x - bb.min.x), (pos.getY(i) - bb.min.y) / (bb.max.y - bb.min.y));
  const edge = new THREE.EdgesGeometry(sheetGeo);
  const group = new THREE.Group();
  scene.add(group);
  const setGroupScale = () => group.scale.setScalar(narrow ? 0.9 : 0.62);   // the tablets float between the oracles
  const sheets = textures.map((tex, i) => {
    const g = new THREE.Group();
    const back = new THREE.Mesh(sheetGeo, new THREE.MeshStandardMaterial({ color: 0x1b2d35, roughness: 0.95, metalness: 0, transparent: true, opacity: 0.95, envMapIntensity: 0.25 }));
    const art = new THREE.Mesh(sheetGeo, new THREE.MeshBasicMaterial({ map: tex, transparent: true, toneMapped: false }));
    art.position.z = 0.01;
    const line = new THREE.LineSegments(edge, new THREE.LineBasicMaterial({ color: 0x3dd9ff, transparent: true, opacity: 0.5, toneMapped: false }));
    line.position.z = 0.012;
    g.add(back, art, line);
    group.add(g);
    return { g, art, line, back, on: 0 };
  });

  // The whole plate that the sheets come out of, and close back into
  const solid = new THREE.Mesh(plateGeometry(plate, { width: PW, depth: 0.26, bevel: 0.04 }), [
    new THREE.MeshPhysicalMaterial({ color: 0x3dd9ff, emissive: 0x13a4d4, emissiveIntensity: 0.25, roughness: 0.42, clearcoat: 0.35, envMapIntensity: 0.28 }),
    new THREE.MeshStandardMaterial({ color: 0x0b5a74, emissive: 0x0e7fa3, emissiveIntensity: 0.35, roughness: 0.4, metalness: 0.2 }),
  ]);
  group.add(solid);
  const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture(), color: 0x3dd9ff, transparent: true, opacity: 0.2, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false }));
  halo.scale.set(PW * 1.8, PW * 0.8, 1);
  halo.position.z = -0.8;
  group.add(halo);

  // Two oracles stand under the tablets and hold them up; the one on the speaking side opens its eyes
  const oracles = [-1, 1].map((sx) => {
    const t = stoneTotem({ height: 6.2, seed: sx + 2 });
    t.group.rotation.y = -sx * 0.34;                       // both turned in toward the tablets
    t.base = sx;
    room.add(t.group);
    return t;
  });
  // Desktop: two oracles flank the tablets. Phone: one stands behind them, tall enough for its face to clear the stack.
  const placeOracles = () => oracles.forEach((t, i) => {
    t.group.visible = !narrow || i === 0;
    t.group.position.set(narrow ? 2.2 : (i ? 2.5 : -3.9), FLOOR_Y, narrow ? -4 : -3.5);
    t.group.scale.setScalar(0.62);
  });

  let prog = reduced ? 0.95 : 0, cur = prog;
  ScrollTrigger.create({ trigger: section, start: "top top", end: "bottom bottom", onUpdate: (s) => { if (!reduced) prog = s.progress; } });
  const pointer = pointerFor(stage);
  let W = 1, H = 1, narrow = false, active = -1, verdictOn = false;

  let composer = null;
  if (!lite) {
    composer = new EffectComposer(renderer);
    composer.addPass(new RenderPass(scene, camera));
    composer.addPass(new UnrealBloomPass(new THREE.Vector2(512, 512), 0.7, 0.55, 0.65));
    composer.addPass(new OutputPass());
    composer.setPixelRatio(renderer.getPixelRatio());
    composer.setSize(innerWidth, innerHeight);
  }

  const chapter = register({
    el: stage, scene, camera,
    onCanvas(w, h, dpr) { if (composer) { composer.setPixelRatio(dpr); composer.setSize(w, h); } },
    render: composer ? () => composer.render() : undefined,
    toneMapping: THREE.NeutralToneMapping, exposure: 1,
    resize(w, h) { W = w; H = h; narrow = w < 860; placeOracles(); setGroupScale(); },
    update(dt, t) {
      pointer.ease(dt, 2);
      oracles.forEach((o, i) => o.setGlow(active < 0 ? 0.1 : narrow || active % 2 === i ? 1 : 0.15));
      for (const tt of torches) {
        const k = 0.8 + Math.sin(t * 12 + tt.seed) * 0.12 + Math.sin(t * 7 + tt.seed * 2) * 0.08;
        tt.l.intensity = 40 * k;
        tt.f.scale.setScalar(1.7 * k);
      }
      runeRing.material.opacity = 0.22 + Math.sin(t * 1.4) * 0.08 + (active >= 0 ? 0.2 : 0);
      shaft.material.opacity = 0.075 + Math.sin(t * 0.6) * 0.015;
      const sp = spores.geometry.attributes.position;
      for (let i = 0; i < spData.length; i++) {
        const d = spData[i];
        d.y += dt * d.sp;
        if (d.y > 9) d.y = 0;
        sp.setXYZ(i, d.x + Math.sin(t * 0.3 + d.ph) * 0.6, FLOOR_Y + d.y, d.z);
      }
      sp.needsUpdate = true;
      cur = window.__qaInstant ? prog : damp(cur, prog, 7, dt);
      const p = cur;
      const open = smooth(0.06, 0.2, p) * (1 - smooth(0.8, 0.9, p));   // sheets out of the plate, then back in
      const span = 0.62 / 4;                                             // four layers between 0.17 and 0.79
      const idx = p < 0.17 ? -1 : p > 0.79 ? 4 : Math.floor((p - 0.17) / span);

      // The solid plate thins out while the sheets are open
      solid.visible = open < 0.98;
      solid.scale.setScalar(1 - open * 0.08);
      solid.material[0].opacity = 1;
      halo.material.opacity = 0.14 + (1 - open) * 0.14 + (p > 0.9 ? 0.2 : 0);

      sheets.forEach((s, i) => {
        const isOn = idx === i ? 1 : 0;
        s.on = window.__qaInstant ? isOn : damp(s.on, isOn, 6, dt);
        const stackZ = (i - 1.5) * 0.9 * open;                          // a deck, fanned out in depth
        const lift = (i - 1.5) * -0.5 * open;
        s.g.position.set(0.35 * s.on, lift * (1 - s.on) + s.on * 0.1, stackZ + s.on * 1.3);
        s.g.rotation.y = -0.35 * open * (1 - s.on);
        s.g.rotation.x = 0.12 * open * (1 - s.on);
        s.g.visible = open > 0.02;
        s.art.material.opacity = 0.25 + s.on * 0.75;
        s.line.material.opacity = 0.25 + s.on * 0.6;
        s.back.material.opacity = 0.55 + s.on * 0.4;
      });

      group.rotation.y = pointer.x * 0.08 - 0.08;
      group.rotation.x = -pointer.y * 0.05;
      group.position.y = Math.sin(t * 0.6) * 0.04;
      camera.position.set(0, 0.2, narrow ? 23 : 14.5);
      camera.lookAt(0, narrow ? -1.6 : 0, 0);
      if (!narrow) camera.setViewOffset(W, H, -W * 0.22, 0, W, H); else camera.setViewOffset(W, H, 0, -H * 0.2, W, H);
      camera.updateProjectionMatrix();

      // Copy: the matching layer lights up; the verdict when the plate has closed
      if (idx !== active) {
        active = idx;
        layerEls.forEach((el, i) => el.classList.toggle("is-on", i === idx || (idx === 4 && !narrow)));
      }
      const v = p > 0.86;
      if (v !== verdictOn) { verdictOn = v; verdictEl.classList.toggle("is-on", v); }
    },
  });

  return { chapter, start() {} };
}
