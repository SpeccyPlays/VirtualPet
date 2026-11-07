import * as THREE from "three";
import { intersectsVehicle, vehicleSweepBlocked, walkerBlockedByVehicle } from "./movement.js";

// Background actors use simple simulation, never AI calls. These constants are
// deliberately collected here so population density and speeds are easy to tune.
const PEOPLE = 24;
const WALK_SPEED = 1.15;
const CAR_SPEED = 5;
export function createPopulation(scene, layout, navigation, visitors = []) {
  const people = [], cars = [], animals = [];
  const materials = new Map();
  function mesh(group, geometry, color, x = 0, y = 0, z = 0) {
    if (!materials.has(color)) materials.set(color, new THREE.MeshStandardMaterial({ color, roughness: 0.8 }));
    const part = new THREE.Mesh(geometry, materials.get(color)); part.position.set(x, y, z); part.castShadow = true; group.add(part); return part;
  }
  const destinations = [];
  for (const x of [-58, -30, -12, 10, 28, 58]) for (const z of [-33, -5.7, 5.7, 33]) destinations.push({ x, z });
  const choose = () => destinations[Math.floor(Math.random() * destinations.length)];
  for (let i = 0; i < PEOPLE; i++) {
    const actor = new THREE.Group();
    mesh(actor, new THREE.CapsuleGeometry(0.22, 0.55, 3, 8), [0x5b747f, 0x925d50, 0x7e7858, 0x635b77][i % 4], 0, 1.02);
    mesh(actor, new THREE.SphereGeometry(0.18, 10, 8), [0xc79b7c, 0x9c7055, 0xe1baa1][i % 3], 0, 1.65);
    const legs = [-0.12, 0.12].map((x) => mesh(actor, new THREE.CapsuleGeometry(0.07, 0.5, 3, 6), 0x343c43, x, 0.37));
    const start = choose(); actor.position.set(start.x, 0.12, start.z); scene.add(actor);
    people.push({ actor, legs, path: [], pause: i * 0.3, index: i, label: "A pedestrian walks between the shops and residential streets." });
  }
  // Eastbound traffic uses the north lane (its left), westbound the south lane.
  // A closed loop allows headway checks using one scalar distance per vehicle.
  const loopLength = 124 * 2 + 3.4 * 2;
  function lanePoint(progress) {
    let t = ((progress % loopLength) + loopLength) % loopLength;
    if (t < 124) return { x: -62 + t, z: -1.7, angle: Math.PI / 2 };
    t -= 124;
    if (t < 3.4) return { x: 62, z: -1.7 + t, angle: 0 };
    t -= 3.4;
    if (t < 124) return { x: 62 - t, z: 1.7, angle: -Math.PI / 2 };
    return { x: -62, z: 1.7 - (t - 124), angle: Math.PI };
  }
  for (let i = 0; i < 9; i++) {
    const actor = new THREE.Group(), bus = i === 0, length = bus ? 7 : 3.5;
    mesh(actor, new THREE.BoxGeometry(1.6, bus ? 1.9 : 0.65, length), [0x9e4b40, 0x71878a, 0xc7bfac, 0x4c6169][i % 4], 0, bus ? 1.35 : 0.85);
    mesh(actor, new THREE.BoxGeometry(1.45, 0.65, length * 0.55), 0x53727a, 0, bus ? 1.7 : 1.4, -0.2);
    for (const x of [-0.85, 0.85]) for (const z of [-length * 0.32, length * 0.32]) { const wheel = mesh(actor, new THREE.CylinderGeometry(0.31, 0.31, 0.2, 10), 0x292e31, x, 0.45, z); wheel.rotation.z = Math.PI / 2; }
    const progress = i * loopLength / 9, start = lanePoint(progress);
    actor.position.set(start.x, 0, start.z); actor.rotation.y = start.angle;
    actor.visible = false; // update() reveals it only when its spawn space is clear.
    scene.add(actor); cars.push({ actor, progress, length, bus, label: bus ? "A local bus passes along High Street." : "Cars pass along High Street in left-hand traffic." });
  }
  // Parked cars use the same familiar scale without entering the traffic loop.
  for (const x of [-54, -44, 46, 56]) {
    const parked = new THREE.Group(); mesh(parked, new THREE.BoxGeometry(1.7, 0.8, 3.5), 0x777f78, 0, 0.7); mesh(parked, new THREE.BoxGeometry(1.5, 0.6, 1.9), 0x58727b, 0, 1.3); parked.rotation.y = Math.PI / 2; parked.position.set(x, 0, 25.8); scene.add(parked);
  }
  // Bus shelter and lamps provide scale cues even when the roads are quiet.
  const shelter = new THREE.Group(); shelter.position.set(20, 0, 6);
  mesh(shelter, new THREE.BoxGeometry(4, 0.15, 1.7), 0x495d57, 0, 2.5);
  for (const x of [-1.8, 1.8]) mesh(shelter, new THREE.CylinderGeometry(0.06, 0.06, 2.5, 8), 0x515c57, x, 1.25);
  mesh(shelter, new THREE.BoxGeometry(3.8, 1.7, 0.08), 0x849d96, 0, 1.4, -0.75); scene.add(shelter);
  for (let x = -60; x <= 60; x += 12) for (const z of [-5.5, 5.5]) {
    const lamp = new THREE.Group(); lamp.position.set(x, 0, z); mesh(lamp, new THREE.CylinderGeometry(0.06, 0.1, 5, 8), 0x53605b, 0, 2.5);
    const light = mesh(lamp, new THREE.SphereGeometry(0.2, 8, 6), 0xefe1ac, 0, 5); light.material = new THREE.MeshStandardMaterial({ color: 0xefe1ac, emissive: 0xe7ce81, emissiveIntensity: 0.7 }); scene.add(lamp);
  }
  for (let i = 0; i < 12; i++) {
    const bird = i >= 6, fox = i < 3, actor = new THREE.Group();
    const home = bird ? { x: 16 + i, z: 5.8 } : { x: i % 2 ? -58 : 58, z: 46 + i * 2 };
    const scale = bird ? 0.3 : fox ? 0.8 : 0.55, color = bird ? 0x7d8587 : fox ? 0xa56b3e : 0x615b54;
    const body = mesh(actor, new THREE.SphereGeometry(0.5, 12, 8), color, 0, 0.55); body.scale.set(0.6, 0.65, 1.3);
    mesh(actor, new THREE.SphereGeometry(0.25, 10, 8), color, 0, 0.85, 0.52);
    if (!bird) {
      for (const x of [-0.2, 0.2]) for (const z of [-0.35, 0.35]) mesh(actor, new THREE.CapsuleGeometry(0.06, 0.3, 3, 6), color, x, 0.2, z);
      for (const x of [-0.15, 0.15]) mesh(actor, new THREE.ConeGeometry(0.12, 0.3, 6), color, x, 1.12, 0.48);
      const tail = mesh(actor, new THREE.ConeGeometry(0.22, 0.8, 8), color, 0, 0.6, -0.85); tail.rotation.x = -Math.PI / 2;
    } else mesh(actor, new THREE.ConeGeometry(0.1, 0.3, 5), 0xc0a46c, 0, 0.8, 0.8).rotation.x = Math.PI / 2;
    actor.scale.setScalar(scale); const start = navigation.nearest(home); actor.position.set(start.x, layout.heightAt(start.x, start.z), start.z); scene.add(actor);
    animals.push({ actor, home: start, path: [], pause: i, bird, label: bird ? "A pigeon pecks at the pavement and walks a few steps." : fox ? "A fox explores the edge of the trees, pausing to look around." : "A cat wanders along the edge of the neighbourhood." });
  }
  function moveWalker(item, delta, elapsed, speed, target) {
    if (elapsed < item.pause) return;
    if (!item.path.length) { item.path = navigation.route(item.actor.position, target()); if (!item.path.length) item.pause = elapsed + 3; }
    const next = item.path[0]; if (!next) return;
    if (!navigation.segmentClear(item.actor.position, next)) { item.path = []; item.pause = elapsed + 1; return; }
    const dx = next.x - item.actor.position.x, dz = next.z - item.actor.position.z, distance = Math.hypot(dx, dz);
    // Stop behind nearby actors rather than pushing meshes through one another.
    const amount = Math.min(distance, delta * speed);
    const nextPosition = { x: item.actor.position.x + (distance ? dx / distance * amount : 0), z: item.actor.position.z + (distance ? dz / distance * amount : 0) };
    if (walkerBlocked(item.actor.position, nextPosition, item.actor) || trafficBlocked(item.actor.position, nextPosition)) {
      item.waitingSince ??= elapsed;
      if (elapsed - item.waitingSince > 1.5) {
        const end = item.path.at(-1);
        // NPCs need the same detour policy as Juniper. Otherwise a pedestrian
        // waiting behind a stopped bus can hold the entire crossing indefinitely.
        item.path = navigation.routeAround(item.actor.position, end, [...trafficObstacles(), ...crowdObstacles(item.actor)]);
        item.waitingSince = null;
      }
      item.pause = elapsed + 0.2; return;
    }
    item.waitingSince = null;
    if (distance > 0.001) { item.actor.position.x += dx / distance * amount; item.actor.position.z += dz / distance * amount; item.actor.rotation.y = Math.atan2(dx, dz); }
    item.actor.position.y = layout.heightAt(item.actor.position.x, item.actor.position.z) + 0.12;
    if (distance <= amount + 1e-6) { item.actor.position.x = next.x; item.actor.position.z = next.z; item.path.shift(); if (!item.path.length) item.pause = elapsed + 2 + Math.random() * 6; }
    item.legs?.forEach((leg, i) => { leg.rotation.x = Math.sin(elapsed * 7 + i * Math.PI) * 0.4; });
  }
  function update(elapsed, delta, { isNight, weather }, density = 1) {
    const active = Math.round(PEOPLE * density * (isNight ? 0.35 : weather === "Rain" ? 0.65 : 1));
    people.forEach((item, i) => { item.actor.visible = i < active; if (item.actor.visible) moveWalker(item, delta, elapsed, WALK_SPEED, choose); });
    animals.forEach((item) => moveWalker(item, delta, elapsed, item.bird ? 0.45 : 0.7, () => ({ x: item.home.x + (Math.random() - 0.5) * (item.bird ? 8 : 20), z: item.home.z + (Math.random() - 0.5) * 12 })));
    cars.forEach((item, i) => {
      const walkers = [...people.map((p) => p.actor), ...visitors].filter((actor) => actor.visible);
      const wanted = i < Math.max(2, Math.round(cars.length * density));
      // Increasing density must not materialise a hidden car on top of Juniper.
      const spawnBlocked = !item.actor.visible && walkers.some((actor) => intersectsVehicle(actor.position, actor.position, vehiclePose(item)));
      item.actor.visible = wanted && !spawnBlocked;
      if (!item.actor.visible) return;
      const point = lanePoint(item.progress), nearCrossing = Math.abs(point.x) < 9 && Math.abs(point.z) < 3;
      const headway = cars.some((other) => other !== item && other.actor.visible && (other.progress - item.progress + loopLength) % loopLength < item.length + 4);
      const busStop = item.bus && item.progress > 74 && item.progress < 78 && elapsed % 40 < 9;
      // A timed crossing phase also gives pedestrians a predictable gap.
      const nextProgress = (item.progress + delta * (item.bus ? CAR_SPEED * 0.8 : CAR_SPEED)) % loopLength;
      const nextPose = { ...lanePoint(nextProgress), width: 2, length: item.length };
      const wouldHitWalker = vehicleSweepBlocked(vehiclePose(item), nextPose, walkers.map((actor) => actor.position));
      // Yield to an actual swept collision in this lane, not everyone anywhere
      // on the crossing. People waiting for the opposite lane must not stop us.
      if (!headway && !busStop && !wouldHitWalker && !(nearCrossing && elapsed % 26 < 5)) item.progress = nextProgress;
      const next = lanePoint(item.progress); item.actor.position.set(next.x, 0, next.z); item.actor.rotation.y = next.angle;
    });
  }
  const observations = (position) => [...animals, ...people, ...cars].filter((item) => item.actor.visible && item.actor.position.distanceTo(position) < 18);
  const occupied = (x, z) => people.some((p) => p.actor.visible && Math.hypot(p.actor.position.x - x, p.actor.position.z - z) < 0.55);
  const vehiclePose = (item) => ({ x: item.actor.position.x, z: item.actor.position.z, angle: item.actor.rotation.y, width: 2, length: item.length });
  const trafficBlocked = (start, end) => cars.some((item) => item.actor.visible && walkerBlockedByVehicle(start, end, vehiclePose(item)));
  const trafficObstacles = () => cars.filter((item) => item.actor.visible).map((item) => {
    const pose = vehiclePose(item), c = Math.abs(Math.cos(pose.angle)), s = Math.abs(Math.sin(pose.angle));
    return { x: pose.x, z: pose.z, width: pose.width * c + pose.length * s + 0.2, depth: pose.width * s + pose.length * c + 0.2 };
  });
  const crowdObstacles = (except) => [...people.map((p) => p.actor), ...visitors].filter((actor) => actor.visible && actor !== except).map((actor) => ({ x: actor.position.x, z: actor.position.z, width: 0.4, depth: 0.4 }));
  const walkerBlocked = (start, end, except) => [...people.map((p) => p.actor), ...visitors].some((actor) => {
    if (!actor.visible || actor === except) return false;
    const before = Math.hypot(actor.position.x - start.x, actor.position.z - start.z);
    const after = Math.hypot(actor.position.x - end.x, actor.position.z - end.z);
    return after < 0.65 && after < before - 1e-8;
  });
  return { update, observations, occupied, walkerBlocked, crowdObstacles, trafficBlocked, trafficObstacles };
}
