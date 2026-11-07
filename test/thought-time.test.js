import test from "node:test";
import assert from "node:assert/strict";
import { thoughtAge, restoreState } from "../save-state.js";

test("only the newest recent thought says Just now; older thoughts age naturally", () => {
  const now = 10000000;
  const label = (seconds, index = 1) => thoughtAge({ createdAt: now - seconds * 1000 }, index, now);
  assert.equal(label(5, 0), "Just now");
  assert.equal(label(5), "5 seconds ago");
  assert.equal(label(0), "1 second ago");
  assert.equal(label(60), "1 minute ago");
  assert.equal(label(18 * 60), "18 minutes ago");
  assert.equal(label(3600, 0), "1 hour ago");
  assert.equal(label(7200), "2 hours ago");
  assert.equal(label(86400), "1 day ago");
  assert.equal(thoughtAge({ createdAt: now + 5000 }, 0, now), "Just now");
});

test("timestamps survive reloads and legacy display strings are not treated as dates", () => {
  const defaults = { thoughts: [] };
  const state = restoreState(JSON.stringify({ thoughts: [{ text: "Old thought", time: "Just now" }, { text: "Dated", createdAt: 12345 }] }), defaults, () => 42);
  assert.equal(thoughtAge(state.thoughts[0], 0), "Earlier");
  assert.equal(state.thoughts[1].createdAt, 12345);
  const restored = restoreState(JSON.stringify(state), defaults, () => 42);
  assert.equal(restored.thoughts[1].createdAt, 12345);
  assert.equal(thoughtAge(restored.thoughts[1], 1, 12345 + 18 * 60000), "18 minutes ago");
});
