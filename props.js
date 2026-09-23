// Props of the temple, built in code rather than loaded: the CC0 packs have no idols, and a carved figure made of
// boxes and a hexagonal pillar reads better at this scale than a boulder. No people and no animals (ст. 27 ч. 1 п. 8):
// an idol is a carved stone, and its only expression is the light in its eyes.

import * as THREE from "three";

export function stoneIdol({ height = 3, color = 0x25343c, eye = 0x3dd9ff, rough = 0.96 } = {}) {
  const group = new THREE.Group();
  const mat = new THREE.MeshStandardMaterial({ color, roughness: rough, metalness: 0, envMapIntensity: 0.12 });
  const u = height / 6;                                    // the figure is modelled 6 units tall, then scaled
  const body = new THREE.Mesh(new THREE.CylinderGeometry(1.05, 1.55, 4.2, 6), mat);
  body.position.y = 2.1;
  const head = new THREE.Mesh(new THREE.BoxGeometry(2.1, 1.8, 1.8), mat);
  head.position.y = 5;
  const brow = new THREE.Mesh(new THREE.BoxGeometry(2.34, 0.42, 0.55), mat);
  brow.position.set(0, 5.6, 0.8);
  const jaw = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.36, 0.45), mat);
  jaw.position.set(0, 4.32, 0.8);
  const collar = new THREE.Mesh(new THREE.CylinderGeometry(1.3, 1.3, 0.3, 6), mat);
  collar.position.y = 4.05;
  const nose = new THREE.Mesh(new THREE.BoxGeometry(0.34, 1.05, 0.5), mat);
  nose.position.set(0, 4.92, 0.82);
  const crown = new THREE.Mesh(new THREE.BoxGeometry(2.7, 0.5, 2.2), mat);   // the headdress of a carved idol
  crown.position.y = 6.05;
  const crest = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.75, 2.3), mat);
  crest.position.y = 6.5;
  group.add(body, head, brow, jaw, collar, nose, crown, crest);

  const eyeMat = new THREE.MeshStandardMaterial({ color: 0x07222c, emissive: eye, emissiveIntensity: 0.5, toneMapped: false });
  const eyes = [-0.48, 0.48].map((ex) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.24, 0.14), eyeMat.clone());
    m.position.set(ex, 5.02, 0.93);
    group.add(m);
    return m;
  });
  group.scale.setScalar(u);
  return { group, mat, eyes, setGlow(k) { for (const e of eyes) e.material.emissiveIntensity = 0.35 + k * 2.2; } };
}
