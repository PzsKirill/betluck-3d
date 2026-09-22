// The brand in three.js: the LUCK plate as a solid you can fly through, and the electric arc the client asked for.
//
// plate.json holds the plate's outline and the four letter holes, traced from the 2025 wordmark (tools/trace-logo.py),
// in unit space (width 1, y up). Everything here scales from that, so a clean source file drops straight in.

import * as THREE from "three";

let cache;
export async function loadPlate() {
  if (!cache) cache = fetch("assets/data/plate.json").then((r) => r.json());
  return cache;
}

const toV2 = (p, s) => new THREE.Vector2(p[0] * s, p[1] * s);

// Outline area sign decides winding; three.js wants the outer contour counter-clockwise and holes clockwise
const area = (pts) => pts.reduce((a, p, i) => { const q = pts[(i + 1) % pts.length]; return a + p.x * q.y - q.x * p.y; }, 0) / 2;

export function plateShape(data, width = 1) {
  let outer = data.outer.map((p) => toV2(p, width));
  if (area(outer) < 0) outer.reverse();
  const shape = new THREE.Shape(outer);
  for (const h of data.holes) {
    let hole = h.map((p) => toV2(p, width));
    if (area(hole) > 0) hole.reverse();
    shape.holes.push(new THREE.Path(hole));
  }
  return shape;
}

export function plateGeometry(data, { width = 1, depth = 0.08, bevel = 0.012 } = {}) {
  const g = new THREE.ExtrudeGeometry(plateShape(data, width), {
    depth, bevelEnabled: bevel > 0, bevelThickness: bevel, bevelSize: bevel * 0.8, bevelSegments: 3, curveSegments: 4,
  });
  g.translate(0, 0, -depth / 2);
  g.computeVertexNormals();
  return g;
}

// A letter hole's centre and size, so the camera can aim through it (holes are ordered left to right: L U C K)
export function holeInfo(data, index, width = 1) {
  const holes = [...data.holes].sort((a, b) => Math.min(...a.map((p) => p[0])) - Math.min(...b.map((p) => p[0])));
  const h = holes[index];
  const xs = h.map((p) => p[0] * width), ys = h.map((p) => p[1] * width);
  return { holes, x0: Math.min(...xs), x1: Math.max(...xs), y0: Math.min(...ys), y1: Math.max(...ys), pts: h.map((p) => toV2(p, width)) };
}

// The outline resampled at even spacing — the track the arc crawls along. `offset` pushes it outward, so the arc
// glows against the night rather than over the plate's own light.
export function outlineTrack(data, width = 1, n = 600, offset = 0) {
  let pts = data.outer.map((p) => toV2(p, width));
  if (area(pts) < 0) pts = pts.reverse();
  if (offset) {
    pts = pts.map((p, i) => {
      const a = pts[(i - 1 + pts.length) % pts.length], b = pts[(i + 1) % pts.length];
      const nx = b.y - a.y, ny = -(b.x - a.x), l = Math.hypot(nx, ny) || 1;
      return new THREE.Vector2(p.x + (nx / l) * offset, p.y + (ny / l) * offset);
    });
  }
  const segs = [];
  let total = 0;
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i], b = pts[(i + 1) % pts.length], l = a.distanceTo(b);
    segs.push({ a, b, l, at: total });
    total += l;
  }
  const out = [];
  let k = 0;
  for (let i = 0; i < n; i++) {
    const d = (i / n) * total;
    while (k < segs.length - 1 && segs[k].at + segs[k].l < d) k++;
    const s = segs[k], t = s.l ? (d - s.at) / s.l : 0;
    out.push(new THREE.Vector2().lerpVectors(s.a, s.b, t));
  }
  return out;
}

// Additive light on a transparent canvas: add colour and coverage, so the page shows through where the light is faint
export const lightBlend = {
  blending: THREE.CustomBlending, blendEquation: THREE.AddEquation,
  blendSrc: THREE.OneFactor, blendDst: THREE.OneFactor, blendSrcAlpha: THREE.OneFactor, blendDstAlpha: THREE.OneFactor,
};

// ── The arc ──────────────────────────────────────────────────────────────────
// A ribbon with a hot core and a cyan glow, redrawn a couple of dozen times a second with a new jag, so it crackles
// instead of flowing. Additive, never tone-mapped: it is the one light of the site.
const arcVert = /* glsl */ `
  attribute vec2 uvw;
  varying vec2 vUv;
  void main() { vUv = uvw; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`;
const arcFrag = /* glsl */ `
  uniform vec3 uColor; uniform float uIntensity;
  varying vec2 vUv;
  void main() {
    float across = 1.0 - abs(vUv.y * 2.0 - 1.0);
    float ends = smoothstep(0.0, 0.12, vUv.x) * smoothstep(1.0, 0.88, vUv.x);
    float glow = pow(across, 2.4) * 0.55;
    float core = pow(across, 18.0) * 1.6;
    vec3 c = mix(uColor, vec3(1.0), clamp(core, 0.0, 1.0));
    float k = (glow + core) * uIntensity * ends;
    // light is added, never painted: alpha follows the light so the transparent canvas stays see-through
    gl_FragColor = vec4(c * k, clamp(k * 0.8, 0.0, 1.0));
  }`;

export function createArc({ points = 64, width = 0.05, color = 0x3dd9ff } = {}) {
  const pos = new Float32Array(points * 2 * 3);
  const uvw = new Float32Array(points * 2 * 2);
  const idx = [];
  for (let i = 0; i < points; i++) {
    uvw.set([i / (points - 1), 0, i / (points - 1), 1], i * 4);
    if (i < points - 1) { const a = i * 2; idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  geo.setAttribute("uvw", new THREE.BufferAttribute(uvw, 2));
  geo.setIndex(idx);
  const mat = new THREE.ShaderMaterial({
    vertexShader: arcVert, fragmentShader: arcFrag,
    uniforms: { uColor: { value: new THREE.Color(color) }, uIntensity: { value: 1 } },
    transparent: true, depthWrite: false, depthTest: false, toneMapped: false, ...lightBlend,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.frustumCulled = false;
  mesh.renderOrder = 10;

  const P = [], N = new THREE.Vector3(), T = new THREE.Vector3(), Z = new THREE.Vector3(0, 0, 1);
  for (let i = 0; i < points; i++) P.push(new THREE.Vector3());

  // path(t) → Vector3 for t in 0..1; jag = sideways displacement; the plane normal is +z (the arc lies on the plate)
  function draw(path, { jag = 0.02, seed = Math.random(), w = width } = {}) {
    let r = seed * 9301 + 49297;
    const rnd = () => ((r = (r * 9301 + 49297) % 233280) / 233280) * 2 - 1;
    // Midpoint-style noise: a few octaves of random offsets, larger in the middle of the arc
    const o1 = [], o2 = [];
    for (let k = 0; k < 9; k++) o1.push(rnd());
    for (let k = 0; k < 33; k++) o2.push(rnd());
    for (let i = 0; i < points; i++) {
      const t = i / (points - 1);
      path(t, P[i]);
      const f1 = t * 8, i1 = Math.floor(f1), a1 = o1[i1] + (o1[Math.min(8, i1 + 1)] - o1[i1]) * (f1 - i1);
      const f2 = t * 32, i2 = Math.floor(f2), a2 = o2[i2] + (o2[Math.min(32, i2 + 1)] - o2[i2]) * (f2 - i2);
      P[i].userData = (a1 * 0.7 + a2 * 0.3) * jag * Math.sin(Math.PI * t) ** 0.6;
    }
    for (let i = 0; i < points; i++) {
      const a = P[Math.max(0, i - 1)], b = P[Math.min(points - 1, i + 1)];
      T.subVectors(b, a).normalize();
      N.crossVectors(T, Z).normalize();
      const off = P[i].userData;
      const x = P[i].x + N.x * off, y = P[i].y + N.y * off, z = P[i].z;
      const ww = w * (0.55 + 0.45 * Math.sin(Math.PI * i / (points - 1)));
      pos.set([x - N.x * ww, y - N.y * ww, z, x + N.x * ww, y + N.y * ww, z], i * 6);
    }
    geo.attributes.position.needsUpdate = true;
  }
  return { mesh, draw, material: mat };
}

// A soft round glow for halos and sparks
let glow;
export function glowTexture(color = "61,217,255") {
  if (glow) return glow;
  const c = document.createElement("canvas");
  c.width = c.height = 128;
  const g = c.getContext("2d"), gr = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  gr.addColorStop(0, `rgba(${color},1)`); gr.addColorStop(0.25, `rgba(${color},0.35)`); gr.addColorStop(1, `rgba(${color},0)`);
  g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
  glow = new THREE.CanvasTexture(c);
  glow.colorSpace = THREE.SRGBColorSpace;
  return glow;
}

// Tiny deterministic random, so scenes look the same on every load (and in QA screenshots)
export function rng(seed = 1) {
  let s = seed >>> 0;
  return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
}
