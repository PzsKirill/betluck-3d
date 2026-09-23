// Tournament — The International 2026 as a track of light, and our predictions on it.
//
// The playoff bracket lies on a dark floor, day by day from left to right. Every series is a small LUCK plate; over
// it rise the games of that series as ridges — the gold-earned difference minute by minute (OpenDota), cyan for the
// first team in its label, silver for the second — so who dominated reads before any text. Where betluck.ru
// published a pick, the plate stands up over the series as a stamp: «зашёл» or «не зашёл». The camera walks the
// days; at the end it rises and the champion's path lights up: Team Spirit, through the lower bracket, to the trophy.

import * as THREE from "three";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import { register, renderer, lite, reduced, pointerFor, damp, smooth } from "./world.js";
import { loadPlate, plateShape, plateGeometry, glowTexture, lightBlend } from "./brand.js";

const COLW = 5;           // distance between tournament days (columns)
const NODE_W = 3;         // a series plate's width
const POS = {             // [column, z] — upper bracket far, lower bracket near
  "ub-qf-1": [0, -7.2], "ub-qf-2": [0, -5.2], "ub-qf-3": [0, -3.2], "ub-qf-4": [0, -1.2],
  "ub-sf-1": [1, -6.2], "ub-sf-2": [1, -2.2], "lb-r1-1": [1, 2.4], "lb-r1-2": [1, 4.8],
  "ub-f": [2, -4.2], "lb-qf-1": [2, 2.4], "lb-qf-2": [2, 4.8],
  "lb-sf": [3, 3.6], "lb-f": [4, 1.2], "gf": [5, -1.5],
};
const SHORT = { "TEAM VISION": "VISION", "Team Spirit": "Spirit", "Team Yandex": "Yandex", "Team Liquid": "Liquid", "Team Falcons": "Falcons", "Nigma Galaxy": "Nigma", "BoomBoys": "BoomBoys", "Iron Wing": "Iron Wing" };
// What happened on each day — every line from the data (tournament.json)
const DAYS = [
  { col: 0, when: "20 августа · 1/4 верхней сетки", text: "Spirit, VISION, Yandex и Nigma Galaxy проходят в полуфиналы верхней сетки." },
  { col: 1, when: "21 августа · полуфиналы", text: "VISION обыгрывает Spirit 2:1 — будущий чемпион уходит в нижнюю сетку." },
  { col: 2, when: "22 августа · три прогноза BetLuck", text: "VISION 2:1 — зашёл. BoomBoys 2:1 — зашёл. Spirit 2:1 — нет: Spirit выиграла 2:0." },
  { col: 3, when: "22 августа · нижняя сетка", text: "Spirit — BoomBoys 2:0. Четвёртая карта подряд без поражений." },
  { col: 4, when: "23 августа · финал нижней сетки", text: "Spirit — Yandex 2:0: шесть карт подряд в нижней сетке." },
  { col: 5, when: "23 августа · гранд-финал", text: "Spirit — VISION 3:2. Реванш за полуфинал — и трофей The International." },
  { col: 6, when: "Итог турнира", text: "" },
];

const edgeVert = /* glsl */ `
  attribute float along;
  varying float vAlong; varying float vSide;
  attribute float side;
  void main() { vAlong = along; vSide = side; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;
const edgeFrag = /* glsl */ `
  uniform vec3 uColor; uniform float uOn; uniform float uTime; uniform float uBase; uniform float uLen;
  varying float vAlong; varying float vSide;
  void main() {
    float across = 1.0 - abs(vSide * 2.0 - 1.0);
    float pulse = pow(fract(vAlong / uLen * 1.0 - uTime * 0.35), 18.0) * uOn;
    float a = (uBase + uOn * 0.55) * pow(across, 1.6) + pulse * 1.2 * across;
    gl_FragColor = vec4(uColor * a, clamp(a * 0.8, 0.0, 1.0));
  }`;

function ribbon(points, width) {
  // a flat ribbon over the floor along a polyline; `along` is the distance from the start, for the pulse
  const pos = [], along = [], side = [], idx = [];
  let d = 0;
  for (let i = 0; i < points.length; i++) {
    const p = points[i], a = points[Math.max(0, i - 1)], b = points[Math.min(points.length - 1, i + 1)];
    if (i > 0) d += p.distanceTo(points[i - 1]);
    const t = new THREE.Vector3().subVectors(b, a).normalize();
    const n = new THREE.Vector3(-t.z, 0, t.x).multiplyScalar(width / 2);
    pos.push(p.x - n.x, p.y, p.z - n.z, p.x + n.x, p.y, p.z + n.z);
    along.push(d, d); side.push(0, 1);
    if (i < points.length - 1) { const k = i * 2; idx.push(k, k + 2, k + 1, k + 1, k + 2, k + 3); }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute("along", new THREE.Float32BufferAttribute(along, 1));
  g.setAttribute("side", new THREE.Float32BufferAttribute(side, 1));
  g.setIndex(idx);
  return { g, length: d };
}

// One game as a ridge: minutes along x, the gold difference as height; the sign picks the colour
function ridgeGeometry(gold, width, depth) {
  const N = 40, xs = [], hs = [];
  const n = gold.length;
  for (let i = 0; i <= N; i++) {
    const f = (i / N) * (n - 1), i0 = Math.floor(f), i1 = Math.min(n - 1, i0 + 1);
    xs.push(-width / 2 + (i / N) * width);
    hs.push(gold[i0] + (gold[i1] - gold[i0]) * (f - i0));
  }
  const pos = [], col = [], idx = [];
  const cyan = new THREE.Color(0x3dd9ff), silver = new THREE.Color(0xc9d1e6), base = new THREE.Color(0x14304a);
  const H = (v) => Math.min(0.8, Math.abs(v) / 17000) + 0.02;
  for (let i = 0; i <= N; i++) {
    const h = H(hs[i]), c = hs[i] >= 0 ? cyan : silver;
    // three rows across the ridge: foot, crest, foot
    pos.push(xs[i], 0, -depth / 2, xs[i], h, 0, xs[i], 0, depth / 2);
    const k = Math.min(1, Math.abs(hs[i]) / 6000);
    const cc = base.clone().lerp(c, 0.35 + 0.65 * k);
    col.push(base.r, base.g, base.b, cc.r, cc.g, cc.b, base.r, base.g, base.b);
    if (i < N) {
      const a = i * 3, b = (i + 1) * 3;
      idx.push(a, b, a + 1, a + 1, b, b + 1, a + 1, b + 1, a + 2, a + 2, b + 1, b + 2);
    }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  g.setAttribute("color", new THREE.Float32BufferAttribute(col, 3));
  g.setIndex(idx);
  g.computeVertexNormals();
  return g;
}

export async function initTournament({ gsap, ScrollTrigger }) {
  const section = document.getElementById("tournament");
  const stage = section.querySelector("[data-stage]");
  const labelsEl = document.getElementById("tourBracket");
  const ledeEl = document.getElementById("tourLede");
  const [data, plate] = await Promise.all([fetch("assets/data/tournament.json").then((r) => r.json()), loadPlate()]);
  const series = data.rounds.flatMap((r) => r.series.map((s) => ({ ...s, round: r.name })));
  const byId = Object.fromEntries(series.map((s) => [s.id, s]));

  // ── The text version (screen readers, reduced motion, no WebGL): every series in order ──
  const list = document.createElement("ol");
  list.className = "tour-list";
  list.innerHTML = series.map((s) => {
    const p = s.prediction;
    const stamp = p ? ` <span class="stamp ${p.hit ? "stamp--hit" : "stamp--miss"}">${p.hit ? "Зашёл" : "Не зашёл"}</span> прогноз BetLuck ${p.pick} · ${p.odds.toFixed(2)}` : "";
    return `<li><span class="tour-list__r">${s.round}</span> ${s.a} <b>${s.score[0]}:${s.score[1]}</b> ${s.b}${stamp}</li>`;
  }).join("");
  section.querySelector(".tournament__copy").appendChild(list);
  const hits = series.filter((s) => s.prediction?.hit).length, preds = series.filter((s) => s.prediction).length;

  // ── Scene ──
  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(0x0f0e1d, 26, 70);
  const camera = new THREE.PerspectiveCamera(34, 1, 0.1, 200);
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.environmentIntensity = 0.3;                  // the map lies in the temple, not in a studio
  scene.add(new THREE.AmbientLight(0x6f86b0, 0.26));
  const key = new THREE.DirectionalLight(0xdbe8ff, 0.85);
  key.position.set(-6, 14, 10);
  scene.add(key);

  // The floor: dark, faintly glossy, fading out at the edges
  const fade = (() => {
    const c = document.createElement("canvas"); c.width = c.height = 256;
    const g = c.getContext("2d"), gr = g.createRadialGradient(128, 128, 30, 128, 128, 128);
    gr.addColorStop(0, "#fff"); gr.addColorStop(0.6, "#888"); gr.addColorStop(1, "#000");
    g.fillStyle = gr; g.fillRect(0, 0, 256, 256);
    return new THREE.CanvasTexture(c);
  })();
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(90, 50).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0x1d2a31, roughness: 0.96, metalness: 0, alphaMap: fade, transparent: true, envMapIntensity: 0.2 }));
  floor.position.set(COLW * 2.5, -0.02, -1);
  scene.add(floor);

  // ── Series plates ──
  const nodeGeo = plateGeometry({ outer: plate.outer, holes: [] }, { width: NODE_W, depth: 0.12, bevel: 0.02 }).rotateX(-Math.PI / 2);
  const nodeMat = () => new THREE.MeshStandardMaterial({ color: 0x25343c, emissive: 0x3dd9ff, emissiveIntensity: 0.06, roughness: 0.9, metalness: 0, envMapIntensity: 0.25 });
  const edgeLine = new THREE.EdgesGeometry(nodeGeo, 30);
  const pools = glowTexture();
  const nodes = {};
  for (const s of series) {
    const [c, z] = POS[s.id] ?? [0, 0];
    const g = new THREE.Group();
    g.position.set(c * COLW, 0, z);
    const mat = nodeMat();
    const mesh = new THREE.Mesh(nodeGeo, mat);
    mesh.position.y = 0.06;
    g.add(mesh);
    const lineMat = new THREE.LineBasicMaterial({ color: 0x3dd9ff, transparent: true, opacity: 0.35, toneMapped: false });
    const line = new THREE.LineSegments(edgeLine, lineMat);
    line.position.y = 0.06;
    g.add(line);
    const pool = new THREE.Sprite(new THREE.SpriteMaterial({ map: pools, color: 0x3dd9ff, transparent: true, opacity: 0.12, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false }));
    pool.scale.set(NODE_W * 1.6, 1.2, 1);
    pool.position.y = 0.05;
    g.add(pool);

    // Terrain: one ridge per game, stacked front to back over the plate
    const terrain = new THREE.Group();
    const games = s.games.filter((x) => x.gold && x.gold.length > 2);
    const depth = 0.16, gap = 0.2, total = s.games.length * gap;
    s.games.forEach((game, i) => {
      if (!game.gold || game.gold.length < 3) return;
      const m = new THREE.Mesh(ridgeGeometry(game.gold, NODE_W * 0.72, depth), new THREE.MeshStandardMaterial({ vertexColors: true, emissive: 0xffffff, emissiveIntensity: 0.0, roughness: 0.5, metalness: 0.1, flatShading: true, side: THREE.DoubleSide }));
      m.position.set(0.12, 0.12, -total / 2 + i * gap + gap / 2);
      terrain.add(m);
    });
    terrain.scale.y = 0.001;
    g.add(terrain);
    scene.add(g);
    nodes[s.id] = { s, g, mesh, mat, line, lineMat, pool, terrain, col: c, games: games.length, hot: 0 };
  }

  // ── Stamps: the LUCK plate stands up where betluck.ru made a pick ──
  const stampGeo = plateGeometry(plate, { width: 1.5, depth: 0.08, bevel: 0.015 });
  for (const s of series) {
    if (!s.prediction) continue;
    const hit = s.prediction.hit;
    const m = new THREE.Mesh(stampGeo, new THREE.MeshStandardMaterial({ color: hit ? 0x3dd9ff : 0x7d8496, emissive: hit ? 0x19b7e6 : 0x2f3542, emissiveIntensity: hit ? 0.6 : 0.18, roughness: 0.6, metalness: 0, envMapIntensity: 0.3 }));
    m.position.set(-NODE_W * 0.95, 0.85, 0);
    m.scale.setScalar(0.85);
    nodes[s.id].g.add(m);
    nodes[s.id].stamp = m;
  }

  // ── Tracks: winners go on, losers drop to the lower bracket ──
  const edges = [];
  const mkEdge = (from, to, kind) => {
    const a = nodes[from], b = nodes[to];
    if (!a || !b) return;
    const p0 = a.g.position.clone().add(new THREE.Vector3(NODE_W / 2 + 0.05, 0.03, 0));
    const p3 = b.g.position.clone().add(new THREE.Vector3(-NODE_W / 2 - 0.05, 0.03, 0));
    const mx = (p0.x + p3.x) / 2;
    const pts = [p0, new THREE.Vector3(mx - 0.3, 0.03, p0.z), new THREE.Vector3(mx, 0.03, p0.z + Math.sign(p3.z - p0.z) * 0.3),
      new THREE.Vector3(mx, 0.03, p3.z - Math.sign(p3.z - p0.z) * 0.3), new THREE.Vector3(mx + 0.3, 0.03, p3.z), p3];
    const { g, length } = ribbon(pts, kind === "win" ? 0.24 : 0.14);
    const mat = new THREE.ShaderMaterial({
      vertexShader: edgeVert, fragmentShader: edgeFrag,
      uniforms: { uColor: { value: new THREE.Color(kind === "win" ? 0x3dd9ff : 0x8e93b3) }, uOn: { value: 0 }, uTime: { value: 0 }, uBase: { value: kind === "win" ? 0.4 : 0.22 }, uLen: { value: length } },
      transparent: true, depthWrite: false, toneMapped: false, side: THREE.DoubleSide, ...lightBlend,
    });
    const mesh = new THREE.Mesh(g, mat);
    scene.add(mesh);
    edges.push({ from, to, kind, mesh, mat, col: b.col, on: 0 });
  };
  for (const s of series) {
    if (s.next) mkEdge(s.id, s.next, "win");
    if (s.loserNext) mkEdge(s.id, s.loserNext, "lose");
  }

  // ── Labels: names and score under each plate; the pick on the stamp ──
  const shortName = (n) => SHORT[n] ?? n;
  const labels = series.map((s) => {
    const el = document.createElement("div");
    el.className = "tlabel";
    const [sa, sb] = s.score;
    el.innerHTML = `<span class="tlabel__r"></span><span class="tlabel__m"><b class="${s.winner === "a" ? "w" : ""}"></b><i>${sa}:${sb}</i><b class="${s.winner === "b" ? "w" : ""}"></b></span>`;
    el.querySelector(".tlabel__r").textContent = s.round;
    const bs = el.querySelectorAll("b");
    bs[0].textContent = shortName(s.a); bs[1].textContent = shortName(s.b);
    labelsEl.appendChild(el);
    let st = null;
    if (s.prediction) {
      st = document.createElement("div");
      st.className = "tstamp " + (s.prediction.hit ? "is-hit" : "is-miss");
      st.innerHTML = `<span class="tstamp__k">Прогноз BetLuck</span><b></b><span class="tstamp__v"></span>`;
      st.querySelector("b").textContent = `${s.prediction.pick} · ${s.prediction.odds.toFixed(2)}`;
      st.querySelector(".tstamp__v").textContent = s.prediction.hit ? `Зашёл — ${s.prediction.result}` : `Не зашёл — ${s.prediction.result}`;
      labelsEl.appendChild(st);
    }
    return { s, el, st, w: 0, h: 0, sw: 0, sh: 0 };
  });
  const measure = () => labels.forEach((l) => { l.w = l.el.offsetWidth; l.h = l.el.offsetHeight; if (l.st) { l.sw = l.st.offsetWidth; l.sh = l.st.offsetHeight; } });
  measure();
  document.fonts?.ready.then(measure);

  // ── Team paths: click a team, its road through the bracket lights up ──
  const teams = [...new Set(series.flatMap((s) => [s.a, s.b]))];
  const teamBar = document.createElement("div");
  teamBar.className = "tteams";
  teamBar.innerHTML = `<span class="tteams__k">Путь команды</span>` + teams.map((t) => `<button type="button" data-team="${t}">${shortName(t)}</button>`).join("");
  stage.appendChild(teamBar);
  const legend = document.createElement("p");
  legend.className = "tlegend";
  legend.textContent = "Гряды — карты серии: высота — перевес по золоту по минутам, бирюза — первая команда в подписи, серебро — вторая.";
  stage.appendChild(legend);
  let chosen = null, auto = null;
  teamBar.addEventListener("click", (e) => {
    const b = e.target.closest("button");
    if (!b) return;
    chosen = chosen === b.dataset.team ? null : b.dataset.team;
    teamBar.querySelectorAll("button").forEach((x) => x.classList.toggle("is-on", x.dataset.team === chosen));
  });
  const inPath = (team, s) => team && (s.a === team || s.b === team);
  const edgeInPath = (team, e) => {
    if (!team) return false;
    const a = byId[e.from], b = byId[e.to];
    const won = (a.winner === "a" ? a.a : a.b) === team, lost = (a.winner === "a" ? a.b : a.a) === team;
    return (e.kind === "win" && won) || (e.kind === "lose" && lost);
  };

  // Day captions
  let day = -1;
  const setDay = (d) => {
    if (d === day) return;
    const first = day < 0;
    day = d;
    const html = `<span class="tday__w"></span><span class="tday__t"></span>`;
    const apply = () => { ledeEl.innerHTML = html; ledeEl.querySelector(".tday__w").textContent = DAYS[d].when; ledeEl.querySelector(".tday__t").textContent = DAYS[d].text; };
    if (first || reduced) { apply(); return; }
    gsap.to(ledeEl, { opacity: 0, y: 6, duration: 0.18, overwrite: true, onComplete: () => { apply(); gsap.to(ledeEl, { opacity: 1, y: 0, duration: 0.45, ease: "power3.out" }); } });
  };
  const intro = `Прогнозы BetLuck на турнир: ${hits} из ${preds} зашли. Каждый узел — серия, гряды над ним — карты.`;
  DAYS[6].text = `Чемпион — Team Spirit: пришла из нижней сетки, в плей-офф — 12 карт из 16. Прогнозы BetLuck на турнир: ${hits} из ${preds} зашли.`;
  ledeEl.textContent = intro;

  // ── Scroll ──
  let prog = reduced ? 1 : 0, cur = prog;
  ScrollTrigger.create({ trigger: section, start: "top top", end: "bottom bottom", onUpdate: (s) => { if (!reduced) prog = s.progress; } });
  const pointer = pointerFor(stage);
  const tmp = new THREE.Vector3(), camPos = new THREE.Vector3(), camLook = new THREE.Vector3();
  const over = { pos: new THREE.Vector3(COLW * 2.5, 46, 31), posN: new THREE.Vector3(COLW * 2.5, 58, 30), look: new THREE.Vector3(COLW * 2.5, 0, -1.2) };
  let W = 1, H = 1, narrow = false;

  const chapter = register({
    el: stage, scene, camera,
    toneMapping: THREE.NeutralToneMapping, exposure: 1,
    resize(w, h) { W = w; H = h; narrow = w < 860; },
    update(dt, t) {
      pointer.ease(dt, 2);
      cur = window.__qaInstant ? prog : damp(cur, prog, 6, dt);
      const p = cur;
      // The walk: the whole bracket → day by day → the whole bracket again, with the champion's road lit
      const walk = smooth(0.08, 0.84, p), end = smooth(0.86, 0.98, p), start = 1 - smooth(0.02, 0.1, p);
      const colF = walk * 5;                          // 0..5, the day the camera stands on
      const x = colF * COLW;
      camLook.set(x + 1.2, 0, -1.2);
      if (narrow) camPos.set(camLook.x - 1, 27, camLook.z + 15); else camPos.set(camLook.x - 2.5, 17.5, camLook.z + 12);
      const wide = Math.max(start, end);
      camPos.lerp(narrow ? over.posN : over.pos, wide);
      camLook.lerp(over.look, wide);
      camPos.x += pointer.x * 0.6; camPos.y += pointer.y * 0.4;
      camera.position.copy(camPos);
      camera.lookAt(camLook);
      // Desktop: the scene sits right of the copy
      if (!narrow) camera.setViewOffset(W, H, -W * (0.2 + wide * 0.01), H * 0.03, W, H); else camera.setViewOffset(W, H, 0, -H * 0.1, W, H);
      camera.updateProjectionMatrix();

      const played = end > 0.5 ? 6 : start > 0.5 ? -1 : colF + 0.45;
      const team = chosen ?? (end > 0.3 ? "Team Spirit" : null);
      if (team !== auto && !chosen) { auto = team; teamBar.querySelectorAll("button").forEach((b) => b.classList.toggle("is-auto", b.dataset.team === team)); }
      setDay(end > 0.5 ? 6 : Math.min(5, Math.max(0, Math.round(colF))));
      if (p < 0.05 && day !== -1 && !reduced) { /* keep the day caption once shown */ }

      // Nodes: terrain rises once its day is reached; the path of the chosen team burns brighter
      for (const n of Object.values(nodes)) {
        const reached = played >= n.col;
        const grow = window.__qaInstant ? (reached ? 1 : 0) : damp(n.terrain.scale.y, reached ? 1 : 0.001, 3, dt);
        n.terrain.scale.y = Math.max(0.001, grow);
        const hot = inPath(team, n.s) ? 1 : 0;
        n.hot = damp(n.hot, hot, 5, dt);
        const near = 1 - Math.min(1, Math.abs(n.col - colF) / 1.6) * (1 - end);
        n.mat.emissiveIntensity = 0.05 + near * 0.08 + n.hot * 0.3;
        n.lineMat.opacity = 0.25 + near * 0.35 + n.hot * 0.4;
        n.pool.material.opacity = 0.06 + near * 0.08 + n.hot * 0.2;
        if (n.stamp) { n.stamp.rotation.y = 0.5 + Math.sin(t * 0.6 + n.col) * 0.25; n.stamp.position.y = 0.85 + Math.sin(t * 1.1 + n.col) * 0.05; n.stamp.scale.setScalar(reached ? 0.85 : 0.001); }
      }
      for (const e of edges) {
        const on = edgeInPath(team, e) ? 1 : 0;
        e.on = damp(e.on, on, 5, dt);
        e.mat.uniforms.uOn.value = e.on;
        e.mat.uniforms.uTime.value = t;
        e.mat.uniforms.uBase.value = (e.kind === "win" ? 0.75 : 0.4) * (played >= e.col - 0.5 ? 1 : 0.4);
      }

      // Labels, with a little level-of-detail: only the day in view (or everything in the final picture)
      for (const l of labels) {
        const n = nodes[l.s.id];
        tmp.copy(n.g.position); tmp.z += 0.62;
        tmp.project(camera);
        const lx = (tmp.x * 0.5 + 0.5) * W, ly = (-tmp.y * 0.5 + 0.5) * H;
        // in a wide shot only the road of the chosen team is named; walking, only the day in view
        const focus = wide > 0.5 ? (n.hot > 0.5 ? 1 : 0) : 1 - Math.min(1, Math.abs(n.col - colF) / 1.1);
        const vis = Math.max(0, Math.min(1, focus * 1.6)) * (played >= n.col - 0.2 ? 1 : 0.35);
        l.el.style.transform = `translate3d(${(lx - l.w / 2).toFixed(1)}px, ${ly.toFixed(1)}px, 0)`;
        const low = 1 - smooth(H - 150, H - 110, ly);      // keep clear of the team bar and legend
        l.el.style.opacity = (tmp.z < 1 ? vis * low : 0).toFixed(3);
        l.el.classList.toggle("is-hot", n.hot > 0.5);
        if (l.st) {
          tmp.copy(n.g.position); tmp.x -= NODE_W * 0.95; tmp.y += 1.55;
          tmp.project(camera);
          const sx = (tmp.x * 0.5 + 0.5) * W, sy = (-tmp.y * 0.5 + 0.5) * H;
          const sv = played >= n.col && wide < 0.5 ? Math.max(0, Math.min(1, focus * 2)) : 0;
          l.st.style.transform = `translate3d(${(sx - l.sw / 2).toFixed(1)}px, ${(sy - l.sh).toFixed(1)}px, 0)`;
          l.st.style.opacity = (tmp.z < 1 ? sv * (1 - smooth(H - 150, H - 110, sy)) : 0).toFixed(3);
        }
      }
    },
  });

  section.classList.add("is-3d");
  return { chapter, start() {} };
}
