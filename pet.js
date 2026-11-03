import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.170.0/build/three.module.js";

// Juniper is deliberately not a pet-shaped character: her silhouette is an
// angular visitor with a sensor crown, three eyes, and four light-footed limbs.
export function createPet(bodyColor, headColor, accentColor, start, variant = "juniper") {
  // Build one reusable alien body; colours and crown angle distinguish characters.
  const material = (color, roughness = 1, emissive = 0) => new THREE.MeshStandardMaterial({ color, roughness, emissive, emissiveIntensity: emissive ? 0.45 : 0 });
  const character = new THREE.Group();
  const body = new THREE.Mesh(new THREE.IcosahedronGeometry(0.38, 1), material(bodyColor, 0.62));
  body.scale.set(0.86, 1.35, 0.7);
  body.position.y = 0.62;
  body.castShadow = true;
  character.add(body);
  const head = new THREE.Mesh(new THREE.OctahedronGeometry(0.38, 1), material(headColor, 0.55));
  head.scale.set(0.92, 0.82, 0.86);
  head.position.set(0, 1.25, 0);
  head.castShadow = true;
  character.add(head);
  const eyeMaterial = material(accentColor, 0.3, accentColor);
  [-0.15, 0, 0.15].forEach((x, index) => {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(index === 1 ? 0.052 : 0.038, 8, 6), eyeMaterial);
    eye.position.set(x, 1.3 + (index === 1 ? 0.03 : 0), 0.32);
    character.add(eye);
  });
  const crown = new THREE.Mesh(new THREE.ConeGeometry(0.09, 0.38, 5), material(accentColor, 0.4, accentColor));
  crown.position.y = 1.75;
  crown.rotation.z = variant === "friend" ? -0.35 : 0.2;
  character.add(crown);
  [-0.22, 0.22].forEach((x) => {
    const arm = new THREE.Mesh(new THREE.CapsuleGeometry(0.065, 0.38, 4, 6), material(bodyColor, 0.75));
    arm.position.set(x, 0.62, 0);
    arm.rotation.z = x > 0 ? -0.35 : 0.35;
    arm.castShadow = true;
    character.add(arm);
  });
  [-0.19, 0.19].forEach((x) => {
    const limb = new THREE.Mesh(new THREE.CapsuleGeometry(0.075, 0.32, 4, 6), material(accentColor, 0.7));
    limb.position.set(x, 0.2, 0);
    limb.rotation.z = x > 0 ? -0.12 : 0.12;
    limb.castShadow = true;
    character.add(limb);
  });
  character.position.copy(start);
  return character;
}
