import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import { createLayout, overlaps } from "../layout.js";
import { createNavigation } from "../navigation.js";
import { restoreState } from "../save-state.js";
import { researchInterval } from "../research-policy.js";
import { createResearchGate } from "../research-gate.js";
import { AIQueue } from "../ai-queue.js";

test("seeds reproduce layouts; building plots avoid roads, water and each other", () => {
  assert.deepEqual(createLayout(42).plots, createLayout(42).plots);
  assert.notDeepEqual(createLayout(42).plots, createLayout(43).plots);
  for (const seed of [0, 1, 42, 100, 4294967295]) {
    const layout = createLayout(seed);
    for (const plot of layout.plots) {
      assert.ok(!layout.roads.some((r) => overlaps(plot, r, 1)), plot.id);
      assert.ok(!layout.water.some((r) => overlaps(plot, r, 1)), plot.id);
      assert.ok(!layout.plots.some((other) => other !== plot && overlaps(plot, other)), plot.id);
    }
    assert.equal(layout.heightAt(0, 0), 0);
    assert.ok(layout.heightAt(70, -72) < 0);
  }
});

test("every landmark is reachable without corner-cutting or crossing water", () => {
  for (const seed of [1, 42, 4294967295]) {
    const layout = createLayout(seed), nav = createNavigation(layout);
    for (const place of layout.landmarks) {
      const route = nav.route({ x: 0, z: 3 }, { x: place.x, z: place.z + place.depth / 2 + 2 });
      assert.ok(route.length, place.id);
      for (let i = 1; i < route.length; i++) assert.ok(nav.segmentClear(route[i - 1], route[i]), place.id);
    }
    const plot = layout.plots[0];
    const route = nav.route({ x: 0, z: 3 }, plot);
    assert.ok(route.length);
    assert.ok(layout.isWalkable(route.at(-1).x, route.at(-1).z));
    assert.deepEqual(nav.route({ x: NaN, z: 0 }, plot), []);
  }
});

test("garden fences block direct paths and can be routed around", () => {
  const layout = createLayout(42), nav = createNavigation(layout);
  const fence = layout.fences[0];
  const start = { x: fence.x, z: fence.z - 1 }, end = { x: fence.x, z: fence.z + 1 };
  assert.equal(layout.isWalkable(fence.x, fence.z), false);
  assert.equal(nav.segmentClear(start, end), false);
  const route = nav.route(start, end);
  assert.ok(route.length);
  for (let i = 1; i < route.length; i++) assert.ok(nav.segmentClear(route[i - 1], route[i]));
});

test("the ship and companion have clear reserved space outside the high street", () => {
  for (const seed of [1, 42, 4294967295]) {
    const layout = createLayout(seed), ship = layout.landmarks.find((p) => p.id === "ship");
    assert.ok(Math.abs(ship.z) > 50);
    assert.ok(!layout.plots.some((plot) => overlaps(ship, plot, 2)));
    assert.ok(!layout.roads.some((road) => overlaps(ship, road, 2)));
    assert.ok(!layout.water.some((water) => overlaps(ship, water, 2)));
    assert.equal(layout.isWalkable(ship.x, ship.z), false);
    assert.equal(layout.canPlace(ship.x, ship.z), false);
    assert.ok(layout.isWalkable(ship.x - 8, ship.z + 1), "Companion's resting spot must be outside the hull");
    assert.ok(layout.isWalkable(ship.x, ship.z + ship.depth / 2 + 2));
  }
});

test("save recovery and generator upgrades preserve seed, memories and objects", () => {
  const defaults = { objects: [], thoughts: [], memories: [] };
  assert.equal(restoreState("broken{", defaults, () => 123).worldSeed, 123);
  const restored = restoreState(JSON.stringify({ worldSeed: 42, worldVersion: 1, objects: [{ id: "a", x: 2, z: 3 }], memories: [{ text: "I remember" }], thoughts: [null, { text: "Hello" }] }), defaults, () => 999);
  assert.equal(restored.worldSeed, 42); assert.equal(restored.objects[0].id, "a"); assert.equal(restored.memories[0].text, "I remember"); assert.equal(restored.thoughts.length, 1);
});

test("research gate honours configurable intervals, locks concurrent calls and survives restart", () => {
  const dir = mkdtempSync(path.join(os.tmpdir(), "juniper-gate-"));
  try {
    let now = 1000000;
    const filename = path.join(dir, "schedule.json");
    const gate = createResearchGate(filename, 60000, () => now);
    assert.equal(researchInterval("bad"), 300000);
    assert.equal(researchInterval(120000), 120000);
    assert.equal(researchInterval(3600000), 3600000, "No hard-coded upper duration");
    for (const value of [null, "", -1, 0, 1.5, Infinity]) assert.equal(researchInterval(value, 120000), 120000);
    assert.ok(gate.begin(60000)); assert.equal(gate.begin(300000), false);
    assert.equal(gate.status().phase, "researching");
    gate.setPhase("thinking"); assert.equal(gate.status().phase, "thinking");
    now += 70000; gate.finish();
    assert.equal(gate.status().phase, "idle");
    assert.equal(gate.status().retryAfterMs, 60000);
    const restarted = createResearchGate(filename, 60000, () => now);
    assert.equal(restarted.begin(60000), false);
    now += 300000; assert.ok(restarted.begin(600000)); restarted.finish();
    assert.equal(restarted.status().retryAfterMs, 600000);
    now += 600000;
    assert.ok(restarted.begin()); restarted.finish();
    assert.equal(restarted.status().retryAfterMs, 60000, "Omitted browser interval uses configured value, not persisted choice");
    now += 60000;
    assert.ok(restarted.begin(120000)); restarted.finish();
    assert.equal(restarted.status().retryAfterMs, 120000);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test("AI queue prioritises reactions, bounds pending work and recovers from failure", async () => {
  const queue = new AIQueue({ limit: 2 }); const order = [];
  let release;
  const running = queue.run(() => new Promise((resolve) => { release = resolve; }));
  const research = queue.run(() => order.push("research"));
  const reaction = queue.run(() => order.push("reaction"), { priority: 10 });
  await assert.rejects(queue.run(() => {}), /too much/);
  release(); await Promise.all([running, research, reaction]);
  assert.deepEqual(order, ["reaction", "research"]);
  await assert.rejects(queue.run(() => { throw new Error("offline"); }), /offline/);
  assert.equal(await queue.run(() => "recovered"), "recovered");
});

test("expired observations leave the queue without invoking the model", async () => {
  let now = 0, release, called = false;
  const queue = new AIQueue({ now: () => now });
  const active = queue.run(() => new Promise((resolve) => { release = resolve; }));
  const stale = queue.run(() => { called = true; }, { ttl: 10 });
  const rejected = assert.rejects(stale, /no longer current/);
  now = 20; release(); await active; await rejected;
  assert.equal(called, false);
});
