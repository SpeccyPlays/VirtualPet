import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.170.0/build/three.module.js";

export function createPet(bodyColor, headColor, earColor, start) {
  const material = (color, roughness = 1) => new THREE.MeshStandardMaterial({ color, roughness });
  const character = new THREE.Group();
  const body = new THREE.Mesh(new THREE.SphereGeometry(0.34, 12, 8), material(bodyColor, 0.7));
  body.scale.set(1, 1.15, 0.86);
  body.position.y = 0.39;
  body.castShadow = true;
  character.add(body);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.27, 12, 8), material(headColor, 0.7));
  head.position.set(0, 0.82, 0);
  head.castShadow = true;
  character.add(head);
  [-0.15, 0.15].forEach((x) => {
    const ear = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.25, 4), material(earColor));
    ear.position.set(x, 1.06, 0);
    ear.rotation.z = x > 0 ? -0.32 : 0.32;
    character.add(ear);
  });
  [-0.09, 0.09].forEach((x) => {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.025, 8, 6), material(0x203d3b));
    eye.position.set(x, 0.84, 0.25);
    character.add(eye);
  });
  character.position.copy(start);
  return character;
}
