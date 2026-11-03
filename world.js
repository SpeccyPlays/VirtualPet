import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.170.0/build/three.module.js";
import { OrbitControls } from "https://cdn.jsdelivr.net/npm/three@0.170.0/examples/jsm/controls/OrbitControls.js";
import { createCity } from "./city.js";
import { createPet } from "./pet.js";

export function createWorld({ onCaption, onObjectClick, onAutonomousObject, objects = [] }) {
  // Scene, camera, and renderer setup for the explorable high street.
  const host = document.getElementById("scene");
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0xa9c6c6);
  scene.fog = new THREE.Fog(0xa9c6c6, 34, 92);
  const camera = new THREE.PerspectiveCamera(38, host.clientWidth / host.clientHeight, 0.1, 220);
  camera.position.set(30, 28, 36);
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.setSize(host.clientWidth, host.clientHeight);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  host.appendChild(renderer.domElement);
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.target.set(0, 0, 0);
  controls.enablePan = false;
  controls.minDistance = 12;
  controls.maxDistance = 78;
  controls.minPolarAngle = 0.35;
  controls.maxPolarAngle = 1.35;
  controls.update();
  let trackingJuniper = false;
  const trackButton = document.getElementById("track-juniper");
  const zoom = (factor) => {
    const offset = camera.position.clone().sub(controls.target);
    camera.position.copy(controls.target).add(offset.normalize().multiplyScalar(THREE.MathUtils.clamp(offset.length() * factor, controls.minDistance, controls.maxDistance)));
    controls.update();
  };
  document.getElementById("zoom-in").addEventListener("click", () => zoom(0.8));
  document.getElementById("zoom-out").addEventListener("click", () => zoom(1.25));
  scene.add(new THREE.HemisphereLight(0xe8f2ec, 0x456b72, 2.4));
  const sun = new THREE.DirectionalLight(0xffedc2, 3);
  sun.position.set(-8, 14, 7);
  sun.castShadow = true;
  scene.add(sun);
  // Add fixed city geometry and the persisted interactive objects.
  const { city, ground, objectMeshes, addObject, removeObject, getObjectPosition } = createCity({ objects });
  scene.add(city);
  const juniper = createPet(0x315f68, 0x91e7c1, 0xc4b4ff, new THREE.Vector3(18, 0, 3), "juniper");
  const friend = createPet(0x6f5798, 0xd3a8ed, 0xffdfa0, new THREE.Vector3(-16, 0, -3), "friend");
  scene.add(juniper, friend);
  // Walking destinations stay on pavements and the road edge rather than inside shops.
  const targets = [
    new THREE.Vector3(-24, 0, -3), new THREE.Vector3(-14, 0, 4), new THREE.Vector3(-4, 0, -3),
    new THREE.Vector3(7, 0, 4), new THREE.Vector3(17, 0, -3), new THREE.Vector3(25, 0, 4),
    new THREE.Vector3(-20, 0, 7), new THREE.Vector3(3, 0, 7), new THREE.Vector3(22, 0, 7),
    ...objects.map((object) => new THREE.Vector3(object.x, 0, object.z)),
  ];
  let destination = targets[0].clone();
  let friendDestination = targets[2].clone();
  let manuallyDirected = false;
  const walkTo = (point, manual = false) => {
    destination.set(THREE.MathUtils.clamp(point.x, -26, 26), 0, THREE.MathUtils.clamp(point.z, -20, 20));
    manuallyDirected = manual;
    onCaption(manual ? "Juniper is walking to your chosen spot" : "Juniper is exploring the city");
  };
  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();
  // Clicks either select an object or send Juniper to a safe ground position.
  host.addEventListener("click", (event) => {
    const rect = renderer.domElement.getBoundingClientRect();
    pointer.set(((event.clientX - rect.left) / rect.width) * 2 - 1, -((event.clientY - rect.top) / rect.height) * 2 + 1);
    raycaster.setFromCamera(pointer, camera);
    const objectHits = raycaster.intersectObjects([...objectMeshes.values()], true);
    if (objectHits.length) {
      onObjectClick?.(objectHits[0].object.userData.objectId);
      return;
    }
    const hits = raycaster.intersectObject(ground);
    if (hits.length) walkTo(hits[0].point, true);
  });
  const clock = new THREE.Clock();
  let nextWander = 3;
  let nextFriendWander = 5;
  let nextObjectInteraction = 8;
  const randomTarget = () => targets[Math.floor(Math.random() * targets.length)].clone();
  function setTracking(enabled) {
    trackingJuniper = enabled;
    controls.enableRotate = !enabled;
    trackButton.textContent = enabled ? "◎ Free camera" : "◎ Track Juniper";
    trackButton.classList.toggle("active", enabled);
    onCaption(enabled ? "Third-person view is following Juniper" : "Juniper is exploring the city");
  }
  trackButton.addEventListener("click", () => setTracking(!trackingJuniper));
  // Animation loop handles walking, friend movement, tracking, and interactions.
  const animate = () => {
    requestAnimationFrame(animate);
    const delta = Math.min(clock.getDelta(), 0.05);
    if (juniper.position.distanceTo(destination) < 0.12) {
      if (manuallyDirected) { onCaption("Juniper has arrived - click the streets to guide her"); manuallyDirected = false; }
      else if (clock.elapsedTime > nextWander) { walkTo(randomTarget()); nextWander = clock.elapsedTime + 2 + Math.random() * 3; }
    } else {
      const direction = destination.clone().sub(juniper.position).normalize();
      juniper.position.addScaledVector(direction, delta * 0.75);
      juniper.rotation.y = Math.atan2(direction.x, direction.z);
      juniper.position.y = Math.sin(clock.elapsedTime * 8) * 0.025;
    }
    if (friend.position.distanceTo(friendDestination) < 0.12) { friendDestination = randomTarget(); nextFriendWander = clock.elapsedTime + 2 + Math.random() * 4; }
    else if (clock.elapsedTime > nextFriendWander) { const direction = friendDestination.clone().sub(friend.position).normalize(); friend.position.addScaledVector(direction, delta * 0.58); friend.rotation.y = Math.atan2(direction.x, direction.z); friend.position.y = Math.sin(clock.elapsedTime * 7 + 1) * 0.02; }
    if (trackingJuniper) {
      const behind = new THREE.Vector3(0, 5.2, -9).applyAxisAngle(new THREE.Vector3(0, 1, 0), juniper.rotation.y);
      const desiredCamera = juniper.position.clone().add(behind);
      camera.position.lerp(desiredCamera, 0.1);
      controls.target.lerp(juniper.position.clone().add(new THREE.Vector3(0, 0.65, 0)), 0.12);
    }
    if (clock.elapsedTime > nextObjectInteraction) {
      const nearby = objects.find((object) => juniper.position.distanceTo(new THREE.Vector3(object.x, 0, object.z)) < 1.5);
      if (nearby) { onAutonomousObject?.(nearby.id); nextObjectInteraction = clock.elapsedTime + 16 + Math.random() * 12; }
    }
    controls.update();
    renderer.render(scene, camera);
  };
  walkTo(randomTarget());
  animate();
  window.addEventListener("resize", () => { camera.aspect = host.clientWidth / host.clientHeight; camera.updateProjectionMatrix(); renderer.setSize(host.clientWidth, host.clientHeight); });
  function focusObject(id) {
    const position = getObjectPosition(id);
    if (!position) return false;
    const target = new THREE.Vector3(position.x, 0, position.z);
    const offset = camera.position.clone().sub(controls.target);
    controls.target.copy(target);
    camera.position.copy(target).add(offset.normalize().multiplyScalar(Math.max(16, Math.min(offset.length(), controls.maxDistance))));
    controls.update();
    onCaption("Juniper is showing you something interesting");
    return true;
  }
  return { addObject, removeObject, focusObject };
}
