import * as THREE from "three";

// Juniper's body plan is radial rather than humanoid: three supporting limbs,
// a translucent sensory mantle, offset luminous organs and a small expressive face.
export function createPet(bodyColor, headColor, accentColor, start, variant = "juniper") {
  const character = new THREE.Group();
  const skin = new THREE.MeshStandardMaterial({ color: bodyColor, roughness: 0.48 });
  const glow = new THREE.MeshStandardMaterial({ color: accentColor, emissive: accentColor, emissiveIntensity: 0.65, roughness: 0.3 });
  const membrane = new THREE.MeshPhysicalMaterial({ color: headColor, roughness: 0.25, transparent: true, opacity: 0.72, side: THREE.DoubleSide, depthWrite: false });
  const torso = new THREE.Mesh(new THREE.SphereGeometry(0.34, 20, 16), skin);
  torso.scale.set(0.86, 1.8, 0.7); torso.position.y = 1.05; character.add(torso);
  const mantle = new THREE.Group(); mantle.position.y = 1.55; character.add(mantle);
  // Shape + LatheGeometry revolves a profile around the Y axis. Adjust these
  // points to change the mantle silhouette without modelling individual faces.
  const profile = [new THREE.Vector2(0.12, -0.18), new THREE.Vector2(0.36, -0.08), new THREE.Vector2(0.64, 0.15), new THREE.Vector2(0.48, 0.25), new THREE.Vector2(0.16, 0.44)];
  mantle.add(new THREE.Mesh(new THREE.LatheGeometry(profile, 32), membrane));
  const sensors = [];
  for (let i = 0; i < 5; i++) {
    const angle = i / 5 * Math.PI * 2;
    const organ = new THREE.Mesh(new THREE.SphereGeometry(0.045 + i * 0.008, 10, 8), glow);
    organ.position.set(Math.cos(angle) * 0.45, 0.18 + Math.sin(angle * 2) * 0.08, Math.sin(angle) * 0.45); mantle.add(organ); sensors.push(organ);
  }
  // Keep the face on the character, not the spinning mantle, so it always looks
  // in her walking direction. Two slit pupils keep her distinct from three-eyed
  // cartoon aliens. All coordinates here are local to this small face group.
  const face = new THREE.Group(); face.name = "face"; face.position.set(0, 1.46, 0.27);
  const dark = new THREE.MeshStandardMaterial({ color: 0x172d34, roughness: 0.55 });
  const plate = new THREE.Mesh(new THREE.SphereGeometry(0.24, 20, 12), dark);
  plate.scale.set(1, 0.76, 0.4); face.add(plate);
  const eyes = [];
  for (const x of [-0.105, 0.105]) {
    const eye = new THREE.Group(); eye.name = x < 0 ? "left-eye" : "right-eye"; eye.position.set(x, 0.035, 0.087);
    const iris = new THREE.Mesh(new THREE.SphereGeometry(0.067, 16, 10), glow); iris.scale.set(0.85, 1.1, 0.45);
    const pupil = new THREE.Mesh(new THREE.SphereGeometry(0.045, 12, 8), dark); pupil.scale.set(0.3, 1, 0.35); pupil.position.z = 0.025;
    eye.add(iris, pupil); face.add(eye); eyes.push(eye);
  }
  const smile = new THREE.QuadraticBezierCurve3(new THREE.Vector3(-0.08, -0.085, 0.09), new THREE.Vector3(0, -0.15, 0.11), new THREE.Vector3(0.08, -0.085, 0.09));
  const mouth = new THREE.Mesh(new THREE.TubeGeometry(smile, 12, 0.011, 6, false), glow); mouth.name = "mouth"; face.add(mouth);
  character.add(face);
  const limbs = [];
  for (let i = 0; i < 3; i++) {
    const angle = i / 3 * Math.PI * 2 + Math.PI / 6;
    const pivot = new THREE.Group(); pivot.position.set(Math.sin(angle) * 0.17, 0.75, Math.cos(angle) * 0.17); pivot.rotation.y = angle;
    const upper = new THREE.Mesh(new THREE.CapsuleGeometry(0.055, 0.42, 4, 8), skin); upper.rotation.x = -0.7; upper.position.set(0, -0.19, 0.16);
    const lower = new THREE.Mesh(new THREE.CapsuleGeometry(0.035, 0.38, 4, 8), glow); lower.rotation.x = 0.4; lower.position.set(0, -0.53, 0.27);
    pivot.add(upper, lower); character.add(pivot); limbs.push(pivot);
  }
  // Named groups make animation editable without depending on child indexes.
  character.userData.animate = (elapsed, walking = false, alert = false) => {
    // Close and reopen over 0.18 seconds; otherwise leave both eyes open.
    const blinkPhase = (elapsed + (variant === "friend" ? 2 : 0)) % 5.7;
    const blink = blinkPhase < 0.18 ? Math.max(0.06, Math.abs(blinkPhase - 0.09) / 0.09) : 1;
    eyes.forEach((eye) => { eye.scale.y = blink * (alert ? 1.15 : 1); });
    mantle.rotation.z = Math.sin(elapsed * 1.3) * 0.08;
    mantle.rotation.y = elapsed * 0.15;
    const expansion = alert ? 1.12 : 1 + Math.sin(elapsed * 1.8) * 0.025;
    mantle.scale.set(expansion * (variant === "friend" ? 1.2 : 1), expansion, expansion);
    torso.scale.y = 1.8 + Math.sin(elapsed * 2) * 0.04;
    glow.emissiveIntensity = (alert ? 1.2 : 0.55) + Math.sin(elapsed * 2.2) * 0.15;
    limbs.forEach((limb, i) => { limb.rotation.x = walking ? Math.sin(elapsed * 7 + i * Math.PI * 2 / 3) * 0.24 : Math.sin(elapsed + i) * 0.025; });
  };
  if (variant === "friend") { character.scale.set(0.72, 0.8, 0.72); mantle.scale.x = 1.2; }
  character.position.copy(start); character.traverse((child) => { if (child.isMesh) child.castShadow = true; });
  return character;
}
