// «Где ставить» — the same outcome, five prices.
//
// The partners stand in a row as slanted plates, always in the same order, each as tall as its odds on the chosen
// outcome. Change the outcome and they rise and fall; the tallest takes the light — cyan, with the arc running along
// its top — and the readout says what that difference is worth on the reader's own stake. This block is advertising,
// so it carries the label, the advertiser, the erid and the addiction warning (see blocks.js / docs/research.md).

import * as THREE from "three";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import { register, renderer, reduced, damp, pointerFor } from "./world.js";
import { createArc, glowTexture } from "./brand.js";
import { state } from "./blocks.js";
import { BOOKS } from "./content.js";

const SLANT = Math.tan(THREE.MathUtils.degToRad(12));
const GAP = 1.25, BW = 0.9;

export async function initOdds() {
  const section = document.getElementById("odds");
  const stage = section.querySelector("[data-stage]");

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 100);
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  scene.add(new THREE.AmbientLight(0x8fa0ff, 0.35));
  const key = new THREE.DirectionalLight(0xffffff, 1.1);
  key.position.set(-4, 6, 8);
  scene.add(key);

  // A floor line for the plates to stand on
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(GAP * BOOKS.length + 2, 3).rotateX(-Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0x1b192f, roughness: 0.4, metalness: 0.5, envMapIntensity: 0.4, transparent: true, opacity: 0.9 }));
  floor.position.set(0, 0, 0);
  scene.add(floor);

  const box = new THREE.BoxGeometry(BW, 1, 0.34).translate(0, 0.5, 0);
  const bars = BOOKS.map((b, i) => {
    const mat = new THREE.MeshStandardMaterial({ color: 0x232140, emissive: 0x3dd9ff, emissiveIntensity: 0.02, roughness: 0.35, metalness: 0.45, envMapIntensity: 0.8 });
    const m = new THREE.Mesh(box, mat);
    m.matrixAutoUpdate = false;
    scene.add(m);
    const edge = new THREE.LineSegments(new THREE.EdgesGeometry(box), new THREE.LineBasicMaterial({ color: 0x3dd9ff, transparent: true, opacity: 0.35, toneMapped: false }));
    edge.matrixAutoUpdate = false;
    scene.add(edge);
    const label = document.createElement("b");
    label.className = "oddslabel";
    const name = document.createElement("span");
    name.className = "oddsname";
    name.textContent = b.name;
    stage.append(label, name);
    return { b, m, mat, edge, label, name, x: (i - (BOOKS.length - 1) / 2) * GAP, h: 0.2, target: 0.2, best: 0, lw: 0, nw: 0 };
  });
  const arc = createArc({ points: 40, width: 0.08 });
  scene.add(arc.mesh);
  const pool = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTexture(), color: 0x3dd9ff, transparent: true, opacity: 0.35, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false }));
  pool.scale.set(2.4, 0.8, 1);
  scene.add(pool);
  const legend = document.createElement("p");
  legend.className = "oddslegend";
  legend.textContent = "Высота плиты — коэффициент на выбранный исход. Коэффициенты — иллюстрация.";
  stage.appendChild(legend);

  let bestI = 0;
  state.on((s) => {
    const ks = BOOKS.map((b) => b.odds[s.outcome]);
    const max = Math.max(...ks), min = Math.min(...ks);
    bestI = ks.indexOf(max);
    bars.forEach((r, i) => {
      r.k = ks[i];
      r.target = 0.7 + ((ks[i] - min) / Math.max(0.01, max - min)) * 2.1;   // the spread is what matters to a bettor
      r.label.textContent = ks[i].toFixed(2);
      r.label.classList.toggle("is-best", i === bestI);
      r.name.classList.toggle("is-best", i === bestI);
      r.lw = r.label.offsetWidth;
    });
  });

  const pointer = pointerFor(stage);
  const shear = new THREE.Matrix4().makeShear(SLANT, 0, 0, 0, 0, 0);
  const T = new THREE.Matrix4(), S = new THREE.Matrix4(), tmp = new THREE.Vector3();
  let W = 1, H = 1, narrow = false;

  const chapter = register({
    el: stage, scene, camera,
    toneMapping: THREE.NeutralToneMapping, exposure: 1,
    resize(w, h) {
      W = w; H = h; narrow = w < 860;
      // phones keep the flat bars (blocks.js): a row of five plates would shrink to slivers
      section.classList.toggle("is-3d", !narrow);
      scene.visible = !narrow;
      bars.forEach((r) => { r.lw = r.label.offsetWidth; r.nw = r.name.offsetWidth; });
    },
    update(dt, t) {
      pointer.ease(dt, 2);
      camera.position.set(pointer.x * 0.5, 2.6 + pointer.y * 0.3, 12.8);
      camera.lookAt(0, 1.3, 0);
      camera.setViewOffset(W, H, -W * 0.2, -H * 0.02, W, H);
      camera.updateProjectionMatrix();

      bars.forEach((r, i) => {
        r.h = window.__qaInstant || reduced ? r.target : damp(r.h, r.target, 6, dt);
        r.best = damp(r.best, i === bestI ? 1 : 0, 6, dt);
        T.makeTranslation(r.x, 0, 0); S.makeScale(1, r.h, 1);
        r.m.matrix.copy(T).multiply(shear).multiply(S);
        r.edge.matrix.copy(r.m.matrix);
        r.mat.color.setRGB(0.137 + r.best * 0.1, 0.13 + r.best * 0.72, 0.25 + r.best * 0.75);
        r.mat.emissiveIntensity = 0.03 + r.best * 0.35;
        r.edge.material.opacity = 0.3 + r.best * 0.5;
        // labels: odds over the top, name under the foot
        tmp.set(r.x + r.h * SLANT, r.h + 0.12, 0.2).project(camera);
        r.label.style.transform = `translate3d(${((tmp.x * 0.5 + 0.5) * W - r.lw / 2).toFixed(1)}px, ${((-tmp.y * 0.5 + 0.5) * H - 34).toFixed(1)}px, 0)`;
        tmp.set(r.x, -0.1, 0.2).project(camera);
        r.name.style.transform = `translate3d(${((tmp.x * 0.5 + 0.5) * W - r.nw / 2).toFixed(1)}px, ${((-tmp.y * 0.5 + 0.5) * H + 6).toFixed(1)}px, 0)`;
      });
      // The light: the arc runs along the top of the best plate
      const b = bars[bestI];
      const x0 = b.x - BW / 2 + b.h * SLANT, x1 = b.x + BW / 2 + b.h * SLANT;
      arc.draw((u, out) => out.set(x0 + (x1 - x0) * u, b.h + 0.04, 0.18), { jag: 0.06, seed: Math.floor(t * 22) });
      arc.material.uniforms.uIntensity.value = 1.3;
      pool.position.set(b.x, 0.05, 0.4);
    },
  });

  section.classList.toggle("is-3d", innerWidth >= 860);
  return { chapter, start() { bars.forEach((r) => { r.lw = r.label.offsetWidth; r.nw = r.name.offsetWidth; }); } };
}
