import test from "node:test";
import assert from "node:assert/strict";
import * as THREE from "three";
import { angleDifference, turnTowards, dampHeading, intersectsVehicle, vehicleSweepBlocked, walkerBlockedByVehicle, findSafeReturn, zoomDistance, createShipVisitSchedule } from "../movement.js";
import { createPopulation } from "../population.js";

test("ship visits schedule a return, rest and a later visit without transferring data", () => {
  const visits = createShipVisitSchedule();
  assert.equal(visits.due(359), false); assert.equal(visits.due(360), true);
  visits.begin(); assert.equal(visits.phase, "returning"); assert.equal(visits.due(1000), false);
  visits.arrive(450); assert.equal(visits.phase, "resting");
  visits.update(469); assert.equal(visits.phase, "resting");
  visits.update(470); assert.equal(visits.phase, "exploring");
  assert.equal(visits.due(829), false); assert.equal(visits.due(830), true);
  visits.begin(); visits.cancel(830, true);
  assert.equal(visits.due(859), false); assert.equal(visits.due(860), true);
  visits.cancel(860); assert.equal(visits.due(900), false);
  assert.equal(visits.due(1220), true);
});

test("a walker can leave a vehicle clearance buffer without walking through the vehicle", () => {
  const car = { x: 0, z: -1.7, angle: Math.PI / 2, width: 2, length: 3.5 };
  const start = { x: 0, z: -0.3 };
  assert.equal(walkerBlockedByVehicle(start, { x: 0, z: 0 }, car), false);
  assert.equal(walkerBlockedByVehicle(start, { x: 0, z: -0.5 }, car), true);
  assert.equal(walkerBlockedByVehicle(start, { x: 0, z: -4 }, car), true);
  assert.equal(walkerBlockedByVehicle({ x: -4, z: -1.7 }, { x: 4, z: -1.7 }, car), true);
});

test("people waiting on the other side of a crossing do not hold up the clear lane", () => {
  const scene = new THREE.Scene(), visitor = new THREE.Group(); visitor.position.set(0, 0, 3);
  const navigation = { nearest: (p) => p, route: () => [], routeAround: () => [], segmentClear: () => true };
  const population = createPopulation(scene, { heightAt: () => 0 }, navigation, [visitor]);
  try {
    population.update(10, 0, { isNight: false, weather: "Clear" }, 0);
    const before = population.trafficObstacles()[1].x;
    for (let frame = 1; frame <= 200; frame++) population.update(10 + frame * 0.05, 0.05, { isNight: false, weather: "Clear" }, 0);
    const after = population.trafficObstacles()[1].x;
    assert.ok(before < -9 && after > 9, `Car should cross rather than queue forever: ${before} -> ${after}`);
  } finally { scene.traverse((child) => { child.geometry?.dispose(); child.material?.dispose(); }); }
});

test("a blocked pedestrian replans instead of holding a crossing indefinitely", () => {
  const scene = new THREE.Scene(), visitor = new THREE.Group(); visitor.position.set(0, 0, 0.6);
  let detours = 0;
  const navigation = {
    nearest: (p) => p, segmentClear: () => true,
    route: (start) => [{ x: start.x, z: 4 }],
    routeAround: (start, end) => { detours++; return [{ x: start.x + 2, z: start.z }, { x: start.x + 2, z: end.z }]; },
  };
  const population = createPopulation(scene, { heightAt: () => 0 }, navigation, [visitor]);
  const pedestrian = scene.children.find((actor) => actor.children[0]?.geometry.type === "CapsuleGeometry");
  pedestrian.position.set(0, 0, 0);
  try {
    for (let frame = 0; frame < 100; frame++) population.update(100 + frame * 0.05, 0.05, { isNight: false, weather: "Clear" }, 1);
    assert.ok(detours > 0);
    assert.ok(pedestrian.position.x > 0.5, "The pedestrian should take the detour around the waiting alien");
  } finally { scene.traverse((child) => { child.geometry?.dispose(); child.material?.dispose(); }); }
});

test("tracking zoom reverses at the minimum and respects its preferred distance", () => {
  let distance = 18;
  for (let i = 0; i < 30; i++) distance = zoomDistance(distance, 0.8);
  assert.equal(distance, 2);
  distance = zoomDistance(distance, 1.25);
  assert.equal(distance, 2.5);
  assert.equal(zoomDistance(distance, 1.25), 3.125);
  assert.equal(zoomDistance(130, 1.25), 132);
});

test("return to start prefers the spawn, avoids occupied ground and fails safely", () => {
  const home = { x: 0, z: 3 };
  assert.deepEqual(findSafeReturn(home, () => true), home);
  const result = findSafeReturn(home, (point) => point.z >= 5.5);
  assert.deepEqual(result, { x: 0, z: 5.5 });
  assert.deepEqual(home, { x: 0, z: 3 }, "The saved spawn must not move");
  assert.equal(findSafeReturn(home, () => false), null);
});

test("turning is gradual, uses the shortest arc and does not overshoot", () => {
  const next = turnTowards(0, Math.PI / 2, 1 / 60);
  assert.ok(next > 0 && next < 0.06);
  const wrapped = turnTowards(Math.PI - 0.05, -Math.PI + 0.05, 1 / 60);
  assert.ok(wrapped > Math.PI - 0.05, "Must cross PI rather than turn the long way");
  assert.ok(Math.abs(angleDifference(turnTowards(0, 0.01, 0.1), 0.01)) < 1e-10);
  for (const fps of [30, 60, 144]) {
    let heading = 0;
    for (let i = 0; i < fps; i++) heading = turnTowards(heading, Math.PI / 2, 1 / fps);
    assert.ok(Math.abs(heading - Math.PI / 2) < 1e-10);
  }
});

test("follow heading damping is independent of frame rate", () => {
  const results = [30, 60, 144].map((fps) => {
    let heading = 0;
    for (let i = 0; i < fps; i++) heading = dampHeading(heading, Math.PI / 2, 1 / fps);
    return heading;
  });
  assert.ok(Math.max(...results) - Math.min(...results) < 1e-10);
  assert.ok(results[0] < Math.PI / 2);
});

test("vehicle collision covers sides, rear, bus length and an entire walking step", () => {
  const car = { x: 0, z: 0, angle: 0, width: 2, length: 3.5 };
  assert.ok(intersectsVehicle({ x: -4, z: 0 }, { x: 4, z: 0 }, car));
  assert.ok(intersectsVehicle({ x: 0, z: -4 }, { x: 0, z: 0 }, car));
  assert.equal(intersectsVehicle({ x: 2, z: -4 }, { x: 2, z: 4 }, car), false);
  assert.equal(intersectsVehicle({ x: 0, z: 3 }, { x: 0, z: 3 }, car), false);
  assert.ok(intersectsVehicle({ x: 0, z: 3 }, { x: 0, z: 3 }, { ...car, length: 7 }));
  assert.ok(intersectsVehicle({ x: 3, z: 0 }, { x: 0, z: 0 }, { ...car, angle: Math.PI / 2 }));
});

test("vehicles cannot sweep through a walker between frames or during a turn", () => {
  const car = { x: -5, z: 0, angle: Math.PI / 2, width: 2, length: 3.5 };
  assert.ok(vehicleSweepBlocked(car, { ...car, x: 5 }, [{ x: 0, z: 0 }]));
  assert.equal(vehicleSweepBlocked(car, { ...car, x: 5 }, [{ x: 0, z: 4 }]), false);
  const bus = { x: 62, z: -1.7, angle: Math.PI / 2, width: 2, length: 7 };
  assert.ok(vehicleSweepBlocked(bus, { ...bus, z: -1.3, angle: 0 }, [{ x: 62, z: -4.8 }]));
});

test("live population exposes vehicle blocking, yields to Juniper and prevents occupied spawns", () => {
  const scene = new THREE.Scene(), juniper = new THREE.Group(); juniper.position.set(0, 0, -10);
  const layout = { heightAt: () => 0 };
  const navigation = { nearest: (p) => p, route: () => [], segmentClear: () => true };
  try {
    const population = createPopulation(scene, layout, navigation, [juniper]);
    population.update(10, 0, { isNight: false, weather: "Clear" }, 0);
    assert.ok(population.trafficBlocked({ x: -62, z: -5 }, { x: -62, z: 2 }));
    assert.equal(population.trafficBlocked({ x: -62, z: -6 }, { x: -60, z: -6 }), false);
    const bus = population.trafficObstacles()[0];
    juniper.position.set(-57.8, 0, -1.7);
    population.update(10.1, 0.1, { isNight: false, weather: "Clear" }, 0);
    assert.equal(population.trafficObstacles()[0].x, bus.x, "Bus must yield to Juniper");
    // Hide the third car, stand in its footprint, then increase the population.
    const hidden = scene.children.find((child) => !child.visible && child.children[0]?.geometry.type === "BoxGeometry");
    assert.ok(hidden);
    juniper.position.copy(hidden.position);
    population.update(11, 0, { isNight: false, weather: "Clear" }, 1);
    assert.equal(hidden.visible, false);
  } finally {
    scene.traverse((child) => { child.geometry?.dispose(); child.material?.dispose(); });
  }
});
