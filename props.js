// Props of the temple, built in code rather than loaded: the CC0 packs have no carved totem (their statues are a
// blank moai head, a gravestone and a wooden fence), and a licence-free one we model ourselves is also ours to keep.
// No people and no animals (ст. 27 ч. 1 п. 8): a totem is carved stone, and its only expression is the light in it.

import * as THREE from "three";

// A carved totem: plinth, banded shaft, a mask with deep sockets and teeth, a stepped headdress, moss on the ledges.
// Modelled 10 units tall and scaled to `height`. `setGlow(k)` lights the eyes, the mouth and the carved bands.
export function stoneTotem({ height = 6, color = 0x6e7168, moss = 0x3d5a36, eye = 0x3dd9ff, seed = 0 } = {}) {
  const group = new THREE.Group();
  const stone = new THREE.MeshStandardMaterial({ color, roughness: 0.98, metalness: 0, flatShading: true });
  const dark = new THREE.MeshStandardMaterial({ color: 0x1a1d1c, roughness: 1, metalness: 0 });
  const mossMat = new THREE.MeshStandardMaterial({ color: moss, roughness: 1, metalness: 0, flatShading: true });
  const bone = new THREE.MeshStandardMaterial({ color: 0xcfc9b4, roughness: 0.85, metalness: 0, flatShading: true });
  const glowMat = new THREE.MeshStandardMaterial({ color: 0x08222c, emissive: eye, emissiveIntensity: 0.5, toneMapped: false });
  const add = (geo, mat, x, y, z, rx = 0, ry = 0, rz = 0) => {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, y, z); m.rotation.set(rx, ry, rz);
    group.add(m);
    return m;
  };

  // plinth and shaft
  add(new THREE.CylinderGeometry(1.95, 2.15, 0.7, 8), stone, 0, 0.35, 0);
  add(new THREE.CylinderGeometry(1.62, 1.82, 5.6, 8), stone, 0, 3.4, 0);
  add(new THREE.CylinderGeometry(1.7, 1.7, 0.22, 8), stone, 0, 1.4, 0);          // carved bands
  add(new THREE.CylinderGeometry(1.66, 1.66, 0.22, 8), stone, 0, 2.6, 0);
  const band = add(new THREE.TorusGeometry(1.5, 0.12, 6, 8), glowMat, 0, 2.05, 0, Math.PI / 2);
  add(new THREE.CylinderGeometry(0.72, 0.72, 0.16, 8), stone, 0, 3.6, 1.72, Math.PI / 2);        // the rune on its chest
  const spiral = add(new THREE.TorusGeometry(0.46, 0.1, 6, 14), glowMat, 0, 3.6, 1.82);
  for (const y of [1.9, 2.95]) for (const sx of [-1, 1])
    add(new THREE.BoxGeometry(0.9, 0.2, 0.22), stone, sx * 0.55, y, 1.62, 0, 0, sx * 0.5);       // carved chevrons

  // the mask: a block on the front of the shaft, with everything cut into it
  add(new THREE.BoxGeometry(3.3, 3.2, 2.5), stone, 0, 6.6, 0.1);
  add(new THREE.BoxGeometry(3.2, 0.66, 0.95), stone, 0, 7.62, 1.1, 0.12);        // brow ridge, tilted forward
  const eyes = [];
  for (const sx of [-1, 1]) {
    add(new THREE.BoxGeometry(1.02, 0.92, 0.55), dark, sx * 0.66, 7.0, 1.22);    // socket, cut deep
    eyes.push(add(new THREE.BoxGeometry(0.62, 0.34, 0.2), glowMat, sx * 0.66, 7.0, 1.42));
    add(new THREE.BoxGeometry(0.52, 1.5, 0.7), stone, sx * 1.22, 6.6, 1.15, 0, 0, sx * 0.16);   // cheek
  }
  add(new THREE.BoxGeometry(0.78, 1.7, 1.3), stone, 0, 6.5, 1.35);              // nose, from brow to mouth
  add(new THREE.BoxGeometry(1.2, 0.44, 1.1), stone, 0, 5.75, 1.45);             // nostrils
  add(new THREE.BoxGeometry(2.7, 1.15, 0.55), dark, 0, 5.1, 1.18);               // mouth
  add(new THREE.BoxGeometry(2.45, 0.9, 0.12), glowMat, 0, 5.1, 1.02);            // the light inside it
  const teeth = [];
  for (const x of [-0.9, -0.3, 0.3, 0.9]) teeth.push(add(new THREE.BoxGeometry(0.4, 0.46, 0.3), bone, x, 5.45, 1.34));
  for (const x of [-0.6, 0, 0.6]) teeth.push(add(new THREE.BoxGeometry(0.4, 0.4, 0.3), bone, x, 4.76, 1.34));
  for (const sx of [-1, 1]) {                                                    // ear discs
    add(new THREE.CylinderGeometry(0.66, 0.66, 0.42, 8), stone, sx * 1.62, 6.8, 0.1, 0, 0, Math.PI / 2);
    add(new THREE.CylinderGeometry(0.3, 0.3, 0.5, 8), glowMat, sx * 1.74, 6.8, 0.1, 0, 0, Math.PI / 2);
  }

  // headdress: two steps and three crests
  add(new THREE.BoxGeometry(3.6, 0.55, 2.9), stone, 0, 8.4, 0.05);
  add(new THREE.BoxGeometry(2.8, 0.5, 2.3), stone, 0, 8.9, 0.05);
  for (const [i, x] of [-0.85, 0, 0.85].entries()) {
    add(new THREE.BoxGeometry(0.34, 1.15 - Math.abs(i - 1) * 0.35, 0.9), stone, x, 9.6 - Math.abs(i - 1) * 0.18, 0.05, 0, 0, (i - 1) * 0.16);
  }

  // moss on the ledges it has stood under for centuries
  const r = (n) => ((Math.sin(seed * 12.9898 + n * 78.233) * 43758.5453) % 1 + 1) % 1;
  for (let i = 0; i < 9; i++) {
    const s = 0.5 + r(i) * 0.7;
    const y = [8.68, 8.16, 7.86, 6.9, 1.5, 2.72, 0.72, 9.3, 4.1][i];
    add(new THREE.BoxGeometry(s * 1.6, 0.17, s * 1.2), mossMat, (r(i + 20) - 0.5) * 2.4, y, 0.6 + (r(i + 40) - 0.5) * 1.2, 0, r(i + 60) * 0.6, 0);
  }

  group.scale.setScalar(height / 10);
  return {
    group, stone, eyes,
    setGlow(k) { glowMat.emissiveIntensity = 0.3 + k * 2.6; },   // every glowing cut on this totem shares one material
  };
}

// The older, simpler idol is still used where a small marker is enough (team plinths in the trial)
export function stoneIdol({ height = 3, color = 0x25343c, eye = 0x3dd9ff } = {}) {
  const t = stoneTotem({ height, color, eye });
  return t;
}
