import * as THREE from "https://cdn.jsdelivr.net/npm/three@0.170.0/build/three.module.js";
import { OrbitControls } from "https://cdn.jsdelivr.net/npm/three@0.170.0/examples/jsm/controls/OrbitControls.js";
import { PointerLockControls } from "https://cdn.jsdelivr.net/npm/three@0.170.0/examples/jsm/controls/PointerLockControls.js";
import { createCity } from "./city.js";
import { createPet } from "./pet.js";

export function createWorld({ onCaption, onObjectClick, onLandmarkClick, onLandmarkVisit, onWorldEvent, onWorldTime, onAutonomousObject, objects = [], worldSeed = 1 }) {
  // Scene, camera, and renderer setup for the explorable Wychmere region.
  const host = document.getElementById("scene");
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0xa9c6c6);
  scene.fog = new THREE.Fog(0xa9c6c6, 58, 155);
  const camera = new THREE.PerspectiveCamera(38, host.clientWidth / host.clientHeight, 0.1, 260);
  camera.position.set(48, 42, 58);
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.setSize(host.clientWidth, host.clientHeight);
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  host.appendChild(renderer.domElement);
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.target.set(0, 0, 0);
  controls.enablePan = true;
  controls.screenSpacePanning = true;
  controls.minDistance = 12;
  controls.maxDistance = 132;
  controls.minPolarAngle = 0.35;
  controls.maxPolarAngle = 1.35;
  controls.update();
  const firstPersonControls = new PointerLockControls(camera, renderer.domElement);
  firstPersonControls.pointerSpeed = 0.8;
  let trackingJuniper = false;
  let trackingDistance = 10;
  let updatingTrackingCamera = false;
  let firstPersonMode = false;
  const firstPersonHeight = 2.1;
  const movementKeys = new Set();
  let freeCameraState = null;
  const keepTargetInWorld = () => {
    const clampedTarget = controls.target.clone();
    clampedTarget.x = THREE.MathUtils.clamp(clampedTarget.x, worldBounds.minX, worldBounds.maxX);
    clampedTarget.z = THREE.MathUtils.clamp(clampedTarget.z, worldBounds.minZ, worldBounds.maxZ);
    const correction = clampedTarget.sub(controls.target);
    if (correction.lengthSq() > 0) {
      camera.position.add(correction);
      controls.target.copy(clampedTarget);
    }
  };
  const trackButton = document.getElementById("track-juniper");
  const firstPersonButton = document.getElementById("first-person-view");
  const setFirstPersonButton = (active) => {
    firstPersonButton.textContent = active ? "Exit first-person" : "First-person view";
    firstPersonButton.classList.toggle("active", active);
  };
  controls.addEventListener("change", () => {
    if (trackingJuniper && !updatingTrackingCamera) {
      trackingDistance = THREE.MathUtils.clamp(camera.position.distanceTo(controls.target), controls.minDistance, controls.maxDistance);
    }
  });
  const zoom = (factor) => {
    if (firstPersonMode) exitFirstPerson();
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
  // Add fixed regional geometry and the persisted interactive objects.
  const { city, ground, objectMeshes, addObject, removeObject, getObjectPosition, landmarkMeshes, landmarks, worldBounds } = createCity({ worldSeed, objects });
  scene.add(city);
  const juniper = createPet(0x315f68, 0x91e7c1, 0xc4b4ff, new THREE.Vector3(0, 0, 3), "juniper");
  const friend = createPet(0x6f5798, 0xd3a8ed, 0xffdfa0, new THREE.Vector3(-18, 0, -3), "friend");
  scene.add(juniper, friend);
  const wildlife = [];
  function createWildlife(color, position, scale = 1) {
    const animal = new THREE.Group();
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.9 * scale, 0.55 * scale, 1.5 * scale), new THREE.MeshStandardMaterial({ color, roughness: 0.9 })); body.position.y = 0.7 * scale;
    const head = new THREE.Mesh(new THREE.DodecahedronGeometry(0.42 * scale, 0), new THREE.MeshStandardMaterial({ color, roughness: 0.9 })); head.position.set(0, 1.08 * scale, 0.82 * scale);
    animal.add(body, head); animal.position.copy(position); animal.traverse((child) => { child.castShadow = true; }); scene.add(animal);
    return { animal, speed: 0.4 + Math.random() * 0.25, target: new THREE.Vector3(position.x, 0, position.z), nextTarget: 0 };
  }
  wildlife.push(createWildlife(0x9a6f4d, new THREE.Vector3(-62, 0, 54), 1.1));
  wildlife.push(createWildlife(0x7b614b, new THREE.Vector3(63, 0, 38), 0.9));
  wildlife.push(createWildlife(0x4b5f54, new THREE.Vector3(-55, 0, -52), 0.75));
  wildlife.push(createWildlife(0x596f82, new THREE.Vector3(18, 0, 73), 0.45));
  // Destinations are placed on roads, paths, and open spaces across every district.
  const targets = [
    new THREE.Vector3(-30, 0, -5), new THREE.Vector3(-12, 0, 5), new THREE.Vector3(8, 0, -5), new THREE.Vector3(28, 0, 5),
    new THREE.Vector3(-36, 0, -18), new THREE.Vector3(36, 0, -18), new THREE.Vector3(-36, 0, 20), new THREE.Vector3(36, 0, 20),
    new THREE.Vector3(-50, 0, -20), new THREE.Vector3(48, 0, -20), new THREE.Vector3(48, 0, 31),
    new THREE.Vector3(-48, 0, 35), new THREE.Vector3(-28, 0, 42), new THREE.Vector3(-58, 0, 48), new THREE.Vector3(42, 0, 11),
    new THREE.Vector3(-92, 0, -72), new THREE.Vector3(84, 0, -76), new THREE.Vector3(-88, 0, 82), new THREE.Vector3(92, 0, 76),
    ...objects.map((object) => new THREE.Vector3(object.x, 0, object.z)),
    ...landmarks.map((landmark) => new THREE.Vector3(landmark.x, 0, landmark.z)),
  ];
  let destination = targets[0].clone();
  let friendDestination = targets[2].clone();
  let manuallyDirected = false;
  const walkTo = (point, manual = false) => {
    destination.set(THREE.MathUtils.clamp(point.x, worldBounds.minX, worldBounds.maxX), 0, THREE.MathUtils.clamp(point.z, worldBounds.minZ, worldBounds.maxZ));
    manuallyDirected = manual;
    onCaption(manual ? "Juniper is walking to your chosen spot" : "Juniper is exploring Wychmere");
  };
  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();
  let pointerDownPosition = null;
  let pointerMoved = false;
  host.addEventListener("pointerdown", (event) => {
    pointerDownPosition = { x: event.clientX, y: event.clientY };
    pointerMoved = false;
  });
  host.addEventListener("pointermove", (event) => {
    if (!pointerDownPosition) return;
    pointerMoved = Math.hypot(event.clientX - pointerDownPosition.x, event.clientY - pointerDownPosition.y) > 6;
  });
  // Clicks either select an object or send Juniper to a safe ground position.
  host.addEventListener("click", (event) => {
    if (pointerMoved || firstPersonMode) return;
    const rect = renderer.domElement.getBoundingClientRect();
    pointer.set(((event.clientX - rect.left) / rect.width) * 2 - 1, -((event.clientY - rect.top) / rect.height) * 2 + 1);
    raycaster.setFromCamera(pointer, camera);
    const objectHits = raycaster.intersectObjects([...objectMeshes.values()], true);
    if (objectHits.length) {
      onObjectClick?.(objectHits[0].object.userData.objectId);
      return;
    }
    const landmarkHits = raycaster.intersectObjects([...landmarkMeshes.values()], true);
    if (landmarkHits.length) {
      onLandmarkClick?.(landmarks.find((landmark) => landmark.id === landmarkHits[0].object.userData.landmarkId));
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
  const landmarkVisits = new Map();
  const weatherTypes = ["Clear", "Cloudy", "Rain", "Mist"];
  let lastWorldMinute = -1;
  let lastWeather = "";
  let nextWorldEvent = 28;
  let activeWorldEvent = null;
  function updateWorldTime(elapsed) {
    const hour = (worldSeed % 24 + elapsed / 45) % 24;
    const minute = Math.floor((hour % 1) * 60);
    const weather = weatherTypes[Math.floor(elapsed / 90 + worldSeed) % weatherTypes.length];
    if (minute !== lastWorldMinute || weather !== lastWeather) {
      lastWorldMinute = minute;
      lastWeather = weather;
      const isNight = hour < 6 || hour >= 20;
      const skyColor = isNight ? 0x203542 : weather === "Mist" ? 0x9aaead : weather === "Rain" ? 0x78909d : 0xa9c6c6;
      scene.background.setHex(skyColor);
      scene.fog.color.setHex(skyColor);
      sun.intensity = isNight ? 0.7 : weather === "Rain" ? 1.7 : weather === "Mist" ? 1.3 : 3;
      onWorldTime?.({ hour, minute, weather, isNight });
    }
  }
  function triggerWorldEvent(elapsed) {
    const landmark = landmarks[Math.floor((elapsed + worldSeed) / 45) % landmarks.length];
    const eventTypes = [
      ["A fox crosses the path", "A fox pauses near the landmark, watches Juniper, and disappears into the undergrowth."],
      ["Strange lights overhead", "A string of lights moves silently above the horizon. Juniper cannot decide whether it is technology or weather."],
      ["A travelling market arrives", "People have gathered with carts, food, and tools. The settlement's usual rhythm has changed."],
      ["A sudden shower", "Rain moves across the region in a narrow band, making the nearby paths shine."],
    ];
    const [name, description] = eventTypes[Math.floor((elapsed + worldSeed) / 90) % eventTypes.length];
    const marker = new THREE.Mesh(new THREE.SphereGeometry(0.45, 8, 8), new THREE.MeshStandardMaterial({ color: 0xf7d27d, emissive: 0xf7d27d, emissiveIntensity: 1.4 }));
    marker.position.set(landmark.x, 2.4, landmark.z); scene.add(marker);
    activeWorldEvent = { marker, expires: elapsed + 32 };
    onWorldEvent?.({ id: `event-${Math.floor(elapsed)}`, name, description, landmarkId: landmark.id, location: landmark.name });
    nextWorldEvent = elapsed + 42;
  }
  function updateWildlife(elapsed, delta) {
    for (const creature of wildlife) {
      if (elapsed > creature.nextTarget || creature.animal.position.distanceTo(creature.target) < 0.4) {
        creature.target.set(THREE.MathUtils.clamp(creature.animal.position.x + (Math.random() - 0.5) * 24, worldBounds.minX + 4, worldBounds.maxX - 4), 0, THREE.MathUtils.clamp(creature.animal.position.z + (Math.random() - 0.5) * 24, worldBounds.minZ + 4, worldBounds.maxZ - 4));
        creature.nextTarget = elapsed + 4 + Math.random() * 8;
      }
      const direction = creature.target.clone().sub(creature.animal.position); direction.y = 0;
      if (direction.lengthSq() > 0.2) { direction.normalize(); creature.animal.position.addScaledVector(direction, delta * creature.speed); creature.animal.rotation.y = Math.atan2(direction.x, direction.z); }
      creature.animal.position.y = Math.sin(elapsed * 4 + creature.speed) * 0.03;
    }
  }
  function exitFirstPerson() {
    if (!firstPersonMode) return;
    const direction = firstPersonControls.getDirection(new THREE.Vector3()).normalize();
    firstPersonMode = false;
    firstPersonControls.unlock();
    controls.enabled = true;
    controls.enableRotate = !trackingJuniper;
    controls.enablePan = !trackingJuniper;
    controls.target.copy(camera.position).add(direction.multiplyScalar(12));
    controls.target.y = 0.75;
    keepTargetInWorld();
    controls.update();
    setFirstPersonButton(false);
    onCaption("Juniper is exploring Wychmere");
  }
  function enterFirstPerson() {
    if (trackingJuniper) setTracking(false);
    firstPersonMode = true;
    controls.enabled = false;
    camera.position.y = firstPersonHeight;
    const lookTarget = controls.target.clone();
    lookTarget.y = firstPersonHeight;
    camera.lookAt(lookTarget);
    setFirstPersonButton(true);
    onCaption("First-person mode: use WASD or arrow keys to explore");
    firstPersonControls.lock();
  }
  firstPersonControls.addEventListener("unlock", () => {
    if (firstPersonMode) exitFirstPerson();
  });
  firstPersonButton.addEventListener("click", () => {
    if (firstPersonMode) exitFirstPerson();
    else enterFirstPerson();
  });
  window.addEventListener("keydown", (event) => {
    if (!firstPersonMode) return;
    if (["KeyW", "KeyA", "KeyS", "KeyD", "ArrowUp", "ArrowLeft", "ArrowDown", "ArrowRight"].includes(event.code)) {
      event.preventDefault();
      movementKeys.add(event.code);
    }
  });
  window.addEventListener("keyup", (event) => movementKeys.delete(event.code));
  function setTracking(enabled) {
    if (enabled && firstPersonMode) exitFirstPerson();
    if (enabled === trackingJuniper) return;
    if (enabled) {
      freeCameraState = { position: camera.position.clone(), target: controls.target.clone() };
      trackingDistance = THREE.MathUtils.clamp(camera.position.distanceTo(controls.target), controls.minDistance, controls.maxDistance);
    }
    trackingJuniper = enabled;
    controls.enableRotate = !enabled;
    controls.enablePan = !enabled;
    if (!enabled && freeCameraState) {
      camera.position.copy(freeCameraState.position);
      controls.target.copy(freeCameraState.target);
      controls.update();
      freeCameraState = null;
    }
    trackButton.textContent = enabled ? "◎ Free camera" : "◎ Track Juniper";
    trackButton.classList.toggle("active", enabled);
    onCaption(enabled ? "Third-person view is following Juniper" : "Juniper is exploring Wychmere");
  }
  trackButton.addEventListener("click", () => setTracking(!trackingJuniper));
  // Animation loop handles walking, friend movement, tracking, and interactions.
  const animate = () => {
    requestAnimationFrame(animate);
    const delta = Math.min(clock.getDelta(), 0.05);
    updateWorldTime(clock.elapsedTime);
    updateWildlife(clock.elapsedTime, delta);
    if (clock.elapsedTime > nextWorldEvent) triggerWorldEvent(clock.elapsedTime);
    if (activeWorldEvent && clock.elapsedTime > activeWorldEvent.expires) { scene.remove(activeWorldEvent.marker); activeWorldEvent = null; }
    for (const landmark of landmarks) {
      const distance = juniper.position.distanceTo(new THREE.Vector3(landmark.x, 0, landmark.z));
      const lastVisit = landmarkVisits.get(landmark.id) || -Infinity;
      if (distance < 5 && clock.elapsedTime - lastVisit > 90) {
        landmarkVisits.set(landmark.id, clock.elapsedTime);
        onLandmarkVisit?.(landmark);
      }
    }
    if (firstPersonMode && firstPersonControls.isLocked) {
      const distance = delta * 7;
      if (movementKeys.has("KeyW") || movementKeys.has("ArrowUp")) firstPersonControls.moveForward(distance);
      if (movementKeys.has("KeyS") || movementKeys.has("ArrowDown")) firstPersonControls.moveForward(-distance);
      if (movementKeys.has("KeyA") || movementKeys.has("ArrowLeft")) firstPersonControls.moveRight(-distance);
      if (movementKeys.has("KeyD") || movementKeys.has("ArrowRight")) firstPersonControls.moveRight(distance);
      camera.position.x = THREE.MathUtils.clamp(camera.position.x, worldBounds.minX, worldBounds.maxX);
      camera.position.z = THREE.MathUtils.clamp(camera.position.z, worldBounds.minZ, worldBounds.maxZ);
      camera.position.y = firstPersonHeight;
    }
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
      updatingTrackingCamera = true;
      const behind = new THREE.Vector3(0, 5.2, -9).applyAxisAngle(new THREE.Vector3(0, 1, 0), juniper.rotation.y).normalize().multiplyScalar(trackingDistance);
      const desiredCamera = juniper.position.clone().add(behind);
      camera.position.lerp(desiredCamera, 0.1);
      controls.target.lerp(juniper.position.clone().add(new THREE.Vector3(0, 0.65, 0)), 0.12);
      controls.update();
      updatingTrackingCamera = false;
    }
    if (clock.elapsedTime > nextObjectInteraction) {
      const nearby = objects.find((object) => juniper.position.distanceTo(new THREE.Vector3(object.x, 0, object.z)) < 1.5);
      if (nearby) { onAutonomousObject?.(nearby.id); nextObjectInteraction = clock.elapsedTime + 16 + Math.random() * 12; }
    }
    if (!trackingJuniper && !firstPersonMode) keepTargetInWorld();
    if (!trackingJuniper && !firstPersonMode) controls.update();
    renderer.render(scene, camera);
  };
  walkTo(randomTarget());
  animate();
  window.addEventListener("resize", () => { camera.aspect = host.clientWidth / host.clientHeight; camera.updateProjectionMatrix(); renderer.setSize(host.clientWidth, host.clientHeight); });
  function focusObject(id) {
    if (firstPersonMode) exitFirstPerson();
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
  function focusLandmark(id) {
    const landmark = landmarks.find((item) => item.id === id);
    if (!landmark) return false;
    if (firstPersonMode) exitFirstPerson();
    const target = new THREE.Vector3(landmark.x, 0, landmark.z);
    const offset = camera.position.clone().sub(controls.target);
    controls.target.copy(target);
    camera.position.copy(target).add(offset.normalize().multiplyScalar(Math.max(18, Math.min(offset.length(), controls.maxDistance))));
    keepTargetInWorld();
    controls.update();
    onCaption(`Juniper is travelling toward ${landmark.name}`);
    return true;
  }
  return { addObject, removeObject, focusObject, focusLandmark };
}
