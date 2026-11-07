import * as THREE from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { PointerLockControls } from "three/addons/controls/PointerLockControls.js";
import { createCity } from "./city.js";
import { createPet } from "./pet.js";
import { createNavigation } from "./navigation.js";
import { createPopulation } from "./population.js";
import { turnTowards, findSafeReturn, zoomDistance, createShipVisitSchedule } from "./movement.js";

export function createWorld({ onCaption, onObjectClick, onLandmarkClick, onLandmarkVisit, onShipVisit, onWorldEvent, onWorldTime, onAutonomousObject, objects = [], worldSeed = 1 }) {
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
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.1;
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
  const trackingDirection = new THREE.Vector3(0, 5.2, -9).normalize();
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
      // Dragging changes the orbit direction. Never learn a zoom distance from
      // the rendered camera: a nearby wall may have temporarily shortened it.
      trackingDirection.copy(camera.position).sub(controls.target).normalize();
    }
  });
  const zoom = (factor) => {
    if (firstPersonMode) exitFirstPerson();
    if (trackingJuniper) {
      trackingDistance = zoomDistance(trackingDistance, factor, 2, controls.maxDistance);
      return;
    }
    const offset = camera.position.clone().sub(controls.target);
    camera.position.copy(controls.target).add(offset.normalize().multiplyScalar(THREE.MathUtils.clamp(offset.length() * factor, controls.minDistance, controls.maxDistance)));
    controls.update();
  };
  document.getElementById("zoom-in").addEventListener("click", () => zoom(0.8));
  document.getElementById("zoom-out").addEventListener("click", () => zoom(1.25));
  renderer.domElement.addEventListener("wheel", (event) => {
    if (!trackingJuniper) return;
    event.preventDefault();
    if (event.deltaY) zoom(Math.exp(Math.sign(event.deltaY) * 0.12));
  }, { passive: false });
  const ambient = new THREE.HemisphereLight(0xe8f2ec, 0x456b72, 2.4);
  scene.add(ambient);
  const sun = new THREE.DirectionalLight(0xffedc2, 3);
  sun.position.set(-8, 14, 7);
  sun.castShadow = true;
  // The default shadow camera covers only a tiny area. Expand it to the town;
  // distant countryside does not need costly high-resolution building shadows.
  Object.assign(sun.shadow.camera, { left: -70, right: 70, top: 70, bottom: -70, near: 0.5, far: 200 });
  sun.position.set(-40, 85, 30);
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.normalBias = 0.06;
  scene.add(sun);
  // Add fixed regional geometry and the persisted interactive objects.
  const { city, ground, layout, cameraObstacles, objectMeshes, addObject, removeObject, updateDetails, getObjectPosition, landmarkMeshes, landmarks, worldBounds } = createCity({ worldSeed, objects });
  const navigation = createNavigation(layout);
  const ship = landmarks.find((place) => place.id === "ship");
  const shipApproach = new THREE.Vector3(ship.x, 0, ship.z + ship.depth / 2 + 2);
  // Seconds of simulation time: return every six minutes, then pause for twenty
  // seconds. Manual directions override a visit; failed approaches retry later.
  const shipVisits = createShipVisitSchedule();
  scene.add(city);
  // Share the ship's clear approach point with scheduled visits and the rescue
  // button. Clone it so adjusting the spawn height never changes route targets.
  const startingPosition = shipApproach.clone();
  startingPosition.y = layout.heightAt(startingPosition.x, startingPosition.z) + 0.13;
  const juniper = createPet(0x315f68, 0x91e7c1, 0xc4b4ff, startingPosition, "juniper");
  // Move the initial overview with her so she is visible immediately on load.
  camera.position.add(startingPosition);
  controls.target.copy(startingPosition);
  controls.update();
  const friend = createPet(0x6f5798, 0xd3a8ed, 0xffdfa0, new THREE.Vector3(ship.x - 8, layout.heightAt(ship.x - 8, ship.z + 1) + 0.13, ship.z + 1), "friend");
  friend.rotation.y = Math.PI / 2;
  scene.add(juniper, friend);
  const population = createPopulation(scene, layout, navigation, [juniper, friend]);
  let density = 1;
  let worldTime = { isNight: false, weather: "Clear" };
  let reactionUntil = 0;
  let thinking = false, observationUntil = 0;
  // A Sprite always faces the camera, including when the user orbits Juniper.
  // The canvas is generated locally once; no image downloads or model calls.
  const bubbleCanvas = document.createElement("canvas"); bubbleCanvas.width = 192; bubbleCanvas.height = 144;
  const bubbleContext = bubbleCanvas.getContext("2d");
  bubbleContext.fillStyle = "#f3f9f0";
  for (const [x, y, radius] of [[60, 53, 29], [96, 40, 32], [131, 53, 29], [95, 67, 38], [55, 111, 9], [40, 129, 5]]) {
    bubbleContext.beginPath(); bubbleContext.arc(x, y, radius, 0, Math.PI * 2); bubbleContext.fill();
  }
  bubbleContext.fillStyle = "#315f68";
  for (const x of [69, 96, 123]) { bubbleContext.beginPath(); bubbleContext.arc(x, 62, 6, 0, Math.PI * 2); bubbleContext.fill(); }
  const bubbleTexture = new THREE.CanvasTexture(bubbleCanvas); bubbleTexture.colorSpace = THREE.SRGBColorSpace;
  const thoughtBubble = new THREE.Sprite(new THREE.SpriteMaterial({ map: bubbleTexture, transparent: true, depthWrite: false }));
  thoughtBubble.name = "thinking-bubble"; thoughtBubble.scale.set(1.35, 1.01, 1); thoughtBubble.visible = false; scene.add(thoughtBubble);
  // Rain uses one line-segment buffer rather than hundreds of individual meshes.
  // It follows Juniper, so the effect stays visible while exploring the region.
  const rainPositions = new Float32Array(240 * 6);
  for (let i = 0; i < 240; i++) {
    const x = (Math.random() - 0.5) * 50, y = Math.random() * 16, z = (Math.random() - 0.5) * 50;
    rainPositions.set([x, y, z, x + 0.1, y + 0.7, z], i * 6);
  }
  const rainGeometry = new THREE.BufferGeometry(); rainGeometry.setAttribute("position", new THREE.BufferAttribute(rainPositions, 3));
  const rain = new THREE.LineSegments(rainGeometry, new THREE.LineBasicMaterial({ color: 0xb6cfd3, transparent: true, opacity: 0.5 }));
  rain.frustumCulled = false; scene.add(rain);
  const populationSelect = document.getElementById("population-density");
  populationSelect.addEventListener("change", () => { density = Number(populationSelect.value); });
  document.getElementById("graphics-quality").addEventListener("change", (event) => {
    const high = event.target.value === "high";
    renderer.setPixelRatio(high ? Math.min(devicePixelRatio, 2) : 1);
    renderer.shadowMap.enabled = high;
    renderer.setSize(host.clientWidth, host.clientHeight);
  });
  // Destinations are placed on roads, paths, and open spaces across every district.
  const targets = [
    new THREE.Vector3(-30, 0, -5), new THREE.Vector3(-12, 0, 5), new THREE.Vector3(8, 0, -5), new THREE.Vector3(28, 0, 5),
    new THREE.Vector3(-36, 0, -18), new THREE.Vector3(36, 0, -18), new THREE.Vector3(-36, 0, 20), new THREE.Vector3(36, 0, 20),
    new THREE.Vector3(-50, 0, -20), new THREE.Vector3(48, 0, -20), new THREE.Vector3(48, 0, 31),
    new THREE.Vector3(-48, 0, 35), new THREE.Vector3(-28, 0, 42), new THREE.Vector3(-58, 0, 48), new THREE.Vector3(42, 0, 11),
    new THREE.Vector3(-92, 0, -72), new THREE.Vector3(84, 0, -76), new THREE.Vector3(-88, 0, 82), new THREE.Vector3(92, 0, 76),
    ...objects.map((object) => new THREE.Vector3(object.x, 0, object.z)),
    ...landmarks.filter((landmark) => landmark.id !== "ship").map((landmark) => new THREE.Vector3(landmark.x, 0, landmark.z + landmark.depth / 2 + 2)),
  ];
  let destination = targets[0].clone();
  let route = [];
  let manuallyDirected = false;
  const walkTo = (point, manual = false) => {
    const candidate = navigation.route(juniper.position, point);
    if (!candidate.length) {
      if (manual) onCaption("Juniper cannot reach that spot; her current exploration can continue.");
      return false; // An invalid click must not erase a working route.
    }
    route = candidate;
    if (manual) shipVisits.cancel(clock.elapsedTime);
    const last = route[route.length - 1];
    destination.set(last.x, 0, last.z);
    manuallyDirected = manual;
    onCaption(manual ? "Juniper is walking to your chosen spot" : "Juniper is exploring Wychmere");
    return true;
  };
  const raycaster = new THREE.Raycaster();
  const followRay = new THREE.Raycaster();
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
  let nextObjectInteraction = 8;
  const randomTarget = () => targets[Math.floor(Math.random() * targets.length)].clone();
  const landmarkVisits = new Map();
  const weatherTypes = ["Clear", "Cloudy", "Rain", "Mist"];
  let lastWorldMinute = -1;
  let lastWeather = "";
  let nextWorldEvent = 28;
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
      ambient.intensity = isNight ? 0.6 : weather === "Rain" ? 1.5 : 2.4;
      worldTime = { isNight, weather };
      scene.fog.near = weather === "Mist" ? 28 : 58;
      scene.fog.far = weather === "Mist" ? 95 : 180;
      onWorldTime?.({ hour, minute, weather, isNight });
    }
  }
  function triggerWorldEvent(elapsed) {
    const nearby = population.observations(juniper.position);
    const witness = nearby[Math.floor(Math.random() * nearby.length)];
    const landmark = [...landmarks].sort((a, b) => Math.hypot(a.x - juniper.position.x, a.z - juniper.position.z) - Math.hypot(b.x - juniper.position.x, b.z - juniper.position.z))[0];
    // These are simulation facts, not Juniper's response. Ollama supplies her
    // interpretation. Do not announce an animal or market that is not present.
    if (witness || worldTime.weather === "Rain") {
      const close = Math.hypot(landmark.x - juniper.position.x, landmark.z - juniper.position.z) < 22;
      onWorldEvent?.({ id: crypto.randomUUID(), createdAt: Date.now(), name: witness ? "Movement nearby" : "Rain arrives", description: witness ? witness.label : "Rain is falling around Juniper and the sky has darkened.", landmarkId: close ? landmark.id : null, location: close ? landmark.name : "Wychmere", x: juniper.position.x, z: juniper.position.z });
      reactionUntil = elapsed + 8;
    }
    nextWorldEvent = elapsed + 45 + Math.random() * 30;
  }
  function exitFirstPerson() {
    if (!firstPersonMode) return;
    const direction = firstPersonControls.getDirection(new THREE.Vector3()).normalize();
    firstPersonMode = false;
    firstPersonControls.unlock();
    controls.enabled = true;
    controls.enableRotate = true;
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
    // An orbit camera can be above a roof. Move onto the nearest accessible
    // ground cell before enabling collision-aware first-person movement.
    const entry = navigation.nearest(camera.position);
    camera.position.set(entry.x, layout.heightAt(entry.x, entry.z) + firstPersonHeight, entry.z);
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
  window.addEventListener("blur", () => movementKeys.clear());
  function setTracking(enabled) {
    if (enabled && firstPersonMode) exitFirstPerson();
    if (enabled === trackingJuniper) return;
    if (enabled) {
      trackingDirection.copy(camera.position).sub(controls.target).normalize();
      freeCameraState = { position: camera.position.clone(), target: controls.target.clone() };
      trackingDistance = THREE.MathUtils.clamp(Math.min(18, camera.position.distanceTo(controls.target)), controls.minDistance, controls.maxDistance);
    }
    trackingJuniper = enabled;
    controls.minDistance = enabled ? 2 : 12;
    controls.enableRotate = true;
    // OrbitControls handles dragging; our tracking zoom uses the unobstructed
    // preferred distance for both buttons and wheel, avoiding feedback loops.
    controls.enableZoom = !enabled;
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
  // Horizontal distance avoids the old bug where terrain elevation stopped a
  // character ever "arriving". Clamp each step so low frame rates cannot overshoot.
  function followRoute(actor, path, delta, speed) {
    const next = path[0]; if (!next) return false;
    if (!navigation.segmentClear(actor.position, next)) {
      const end = path[path.length - 1];
      path.splice(0, path.length, ...navigation.route(actor.position, end));
      if (!path.length) actor.userData.routeFailed = true;
      return false;
    }
    const dx = next.x - actor.position.x, dz = next.z - actor.position.z;
    const distance = Math.hypot(dx, dz), amount = Math.min(distance, delta * speed);
    if (distance > 0.001) actor.rotation.y = turnTowards(actor.rotation.y, Math.atan2(dx, dz), delta);
    const nextPosition = { x: actor.position.x + (distance ? dx / distance * amount : 0), z: actor.position.z + (distance ? dz / distance * amount : 0) };
    if (population.walkerBlocked(actor.position, nextPosition, actor) || population.trafficBlocked(actor.position, nextPosition)) {
      const previousWait = actor.userData.blockedTime || 0;
      actor.userData.blockedTime = previousWait + delta;
      if (Math.floor(previousWait / 2) < Math.floor(actor.userData.blockedTime / 2)) {
        const detour = navigation.routeAround(actor.position, path.at(-1), [...population.trafficObstacles(), ...population.crowdObstacles(actor)]);
        if (detour.length) path.splice(0, path.length, ...detour);
      }
      // Never wait forever on an inaccessible goal. Return control to the
      // exploration scheduler instead of reporting an arrival that never happened.
      if (actor.userData.blockedTime >= 10) { path.length = 0; actor.userData.routeFailed = true; actor.userData.blockedTime = 0; }
      return false;
    }
    actor.userData.blockedTime = 0;
    if (distance > 0.001) {
      actor.position.x += dx / distance * amount; actor.position.z += dz / distance * amount;
    }
    actor.position.y = layout.heightAt(actor.position.x, actor.position.z) + 0.13;
    if (distance <= amount + 1e-6) { actor.position.x = next.x; actor.position.z = next.z; path.shift(); }
    return true;
  }
  // One update per frame; simulation speeds use delta seconds rather than frames.
  let frameId, disposed = false;
  const animate = () => {
    if (disposed) return;
    frameId = requestAnimationFrame(animate);
    const delta = Math.min(clock.getDelta(), 0.05);
    updateWorldTime(clock.elapsedTime);
    population.update(clock.elapsedTime, delta, worldTime, density);
    rain.visible = worldTime.weather === "Rain";
    if (rain.visible) {
      rain.position.copy(juniper.position);
      for (let i = 0; i < rainPositions.length; i += 6) {
        rainPositions[i + 1] -= delta * 13;
        if (rainPositions[i + 1] < 0) rainPositions[i + 1] = 16;
        rainPositions[i + 4] = rainPositions[i + 1] + 0.7;
      }
      rainGeometry.attributes.position.needsUpdate = true;
    }
    if (clock.elapsedTime > nextWorldEvent) triggerWorldEvent(clock.elapsedTime);
    for (const landmark of landmarks) {
      const distance = juniper.position.distanceTo(new THREE.Vector3(landmark.x, 0, landmark.z));
      const lastVisit = landmarkVisits.get(landmark.id) || -Infinity;
      if (distance < Math.max(7, landmark.depth / 2 + 3) && clock.elapsedTime - lastVisit > 90) {
        landmarkVisits.set(landmark.id, clock.elapsedTime);
        onLandmarkVisit?.(landmark);
      }
    }
    if (firstPersonMode && firstPersonControls.isLocked) {
      const previousPosition = camera.position.clone();
      const distance = delta * 7;
      if (movementKeys.has("KeyW") || movementKeys.has("ArrowUp")) firstPersonControls.moveForward(distance);
      if (movementKeys.has("KeyS") || movementKeys.has("ArrowDown")) firstPersonControls.moveForward(-distance);
      if (movementKeys.has("KeyA") || movementKeys.has("ArrowLeft")) firstPersonControls.moveRight(-distance);
      if (movementKeys.has("KeyD") || movementKeys.has("ArrowRight")) firstPersonControls.moveRight(distance);
      camera.position.x = THREE.MathUtils.clamp(camera.position.x, worldBounds.minX, worldBounds.maxX);
      camera.position.z = THREE.MathUtils.clamp(camera.position.z, worldBounds.minZ, worldBounds.maxZ);
      if (!navigation.segmentClear(previousPosition, camera.position)) camera.position.copy(previousPosition);
      camera.position.y = layout.heightAt(camera.position.x, camera.position.z) + firstPersonHeight;
    }
    shipVisits.update(clock.elapsedTime);
    if (shipVisits.due(clock.elapsedTime) && !manuallyDirected) {
      if (walkTo(shipApproach)) { shipVisits.begin(); onCaption("Juniper is returning to her ship."); }
      else shipVisits.cancel(clock.elapsedTime, true);
    }
    const walking = followRoute(juniper, route, delta, 1.1);
    if (juniper.userData.routeFailed) {
      if (shipVisits.phase === "returning") shipVisits.cancel(clock.elapsedTime, true);
      juniper.userData.routeFailed = false; manuallyDirected = false;
      nextWander = clock.elapsedTime + 1;
      onCaption("Juniper is choosing another route around the obstruction.");
    }
    if (!route.length && shipVisits.phase === "returning") {
      if (Math.hypot(juniper.position.x - shipApproach.x, juniper.position.z - shipApproach.z) < 1.2) {
        shipVisits.arrive(clock.elapsedTime); manuallyDirected = false;
        onCaption("Juniper is resting by her ship. Her companion is nearby.");
        // Arrival notification is the future extension point for memory transfer.
        // No handler is installed by app.js, and no memories are shared here.
        onShipVisit?.({ shipId: ship.id, arrivedAt: Date.now() });
      } else shipVisits.cancel(clock.elapsedTime, true);
    }
    if (!route.length && shipVisits.phase !== "resting") {
      if (manuallyDirected) { onCaption("Juniper has arrived - click the streets to guide her"); manuallyDirected = false; }
      else if (clock.elapsedTime > nextWander) {
        for (let attempt = 0; attempt < 6; attempt++) if (walkTo(randomTarget())) break;
        nextWander = clock.elapsedTime + 2 + Math.random() * 3;
      }
    }
    juniper.userData.animate(clock.elapsedTime, walking, clock.elapsedTime < reactionUntil);
    friend.userData.animate(clock.elapsedTime + 2, false);
    thoughtBubble.visible = thinking || clock.elapsedTime < Math.max(observationUntil, reactionUntil);
    thoughtBubble.position.copy(juniper.position).add(new THREE.Vector3(0, 2.65 + Math.sin(clock.elapsedTime * 3) * 0.05, 0));
    thoughtBubble.material.opacity = 0.9 + Math.sin(clock.elapsedTime * 4) * 0.1;
    if (trackingJuniper) {
      updatingTrackingCamera = true;
      const lookAt = juniper.position.clone().add(new THREE.Vector3(0, 1.15, 0));
      const desiredCamera = lookAt.clone().addScaledVector(trackingDirection, trackingDistance);
      // Shorten the follow arm when a wall lies between the camera and Juniper.
      // The orbit distance is kept separately, so it returns after the obstruction.
      const arm = desiredCamera.clone().sub(lookAt);
      followRay.set(lookAt, arm.clone().normalize()); followRay.far = arm.length();
      const obstruction = followRay.intersectObjects([...cameraObstacles, ...landmarkMeshes.values()], true)[0];
      if (obstruction) desiredCamera.copy(lookAt).addScaledVector(arm.normalize(), Math.max(2, obstruction.distance - 0.4));
      camera.position.copy(desiredCamera);
      controls.target.copy(lookAt);
      controls.update();
      updatingTrackingCamera = false;
    }
    if (clock.elapsedTime > nextObjectInteraction) {
      const nearby = objects.find((object) => juniper.position.distanceTo(new THREE.Vector3(object.x, 0, object.z)) < 1.5);
      if (nearby) { onAutonomousObject?.(nearby.id); nextObjectInteraction = clock.elapsedTime + 16 + Math.random() * 12; }
    }
    if (!trackingJuniper && !firstPersonMode) keepTargetInWorld();
    if (!trackingJuniper && !firstPersonMode) controls.update();
    updateDetails(camera, document.getElementById("graphics-quality").value === "high" ? 125 : 65);
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
    const travelling = walkTo(new THREE.Vector3(landmark.x, 0, landmark.z + landmark.depth / 2 + 2), true);
    if (travelling && landmark.id === "ship") shipVisits.begin();
    return true;
  }
  function returnToStart() {
    const safe = findSafeReturn(startingPosition, (point) => layout.isWalkable(point.x, point.z, 0.6)
      && !population.trafficBlocked(point, point) && !population.occupied(point.x, point.z)
      && Math.hypot(friend.position.x - point.x, friend.position.z - point.z) > 1);
    if (!safe) { onCaption("The starting area is busy. Try returning Juniper again shortly."); return false; }
    if (firstPersonMode) exitFirstPerson();
    // A rescue teleport must work even when no walking route exists. Clear the
    // old route and waiting state; saved thoughts, interests and objects stay intact.
    route.length = 0; manuallyDirected = false; juniper.userData.trafficWait = 0;
    shipVisits.cancel(clock.elapsedTime);
    juniper.userData.blockedTime = 0; juniper.userData.routeFailed = false;
    juniper.position.set(safe.x, layout.heightAt(safe.x, safe.z) + 0.13, safe.z);
    juniper.rotation.y = 0; reactionUntil = 0;
    destination.copy(juniper.position); nextWander = clock.elapsedTime + 5;
    if (!trackingJuniper) {
      const offset = camera.position.clone().sub(controls.target);
      controls.target.copy(juniper.position).add(new THREE.Vector3(0, 1, 0));
      camera.position.copy(controls.target).add(offset); controls.update();
    }
    onCaption("Juniper is back at her starting area. She will explore again shortly.");
    return true;
  }
  function dispose() {
    disposed = true; cancelAnimationFrame(frameId);
    controls.dispose(); firstPersonControls.dispose();
    const geometries = new Set(), materials = new Set(), textures = new Set();
    scene.traverse((child) => { if (child.geometry) geometries.add(child.geometry); for (const material of Array.isArray(child.material) ? child.material : child.material ? [child.material] : []) { materials.add(material); if (material.map) textures.add(material.map); } });
    geometries.forEach((g) => g.dispose()); textures.forEach((t) => t.dispose()); materials.forEach((m) => m.dispose()); renderer.dispose(); renderer.domElement.remove();
  }
  return { addObject, removeObject, focusObject, focusLandmark, returnToStart, setThinking: (active) => { thinking = Boolean(active); }, showObservation: () => { observationUntil = clock.elapsedTime + 4; }, canPlace: (x, z) => layout.canPlace(x, z, objects) && Math.hypot(juniper.position.x - x, juniper.position.z - z) > 3 && Math.hypot(friend.position.x - x, friend.position.z - z) > 3, dispose, metrics: () => ({ tracking: trackingJuniper, preferredDistance: trackingDistance, orbitDirection: trackingDirection.toArray(), cameraDistance: camera.position.distanceTo(controls.target), bubbleVisible: thoughtBubble.visible, calls: renderer.info.render.calls, triangles: renderer.info.render.triangles, geometries: renderer.info.memory.geometries, textures: renderer.info.memory.textures }) };
}
