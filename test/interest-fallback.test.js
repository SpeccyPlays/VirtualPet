import test from "node:test";
import assert from "node:assert/strict";
import { recoverInterestDecision } from "../interest-fallback.js";

test("duplicate replacement triggers Ollama fresh-topic generation while retaining the replacement target", async () => {
  const existing = ["Empathy", "Moral development", "Birds", "Cities"];
  let calls = 0;
  const result = await recoverInterestDecision({ action: "replace", removeInterest: "Empathy", interest: "Moral development" }, {
    existing, removed: ["Music"], query: "Empathy", isNovel: () => true, random: () => 0,
    generate: async ({ rejected, domain }) => { calls++; assert.equal(domain, "astronomy"); assert.ok(rejected.includes("Moral development")); return { interest: "How pulsars rotate", reason: "A new direction." }; },
  });
  assert.equal(calls, 1); assert.equal(result.action, "replace"); assert.equal(result.removeInterest, "Empathy"); assert.equal(result.interest, "How pulsars rotate");
  assert.equal(existing.length, 4, "Generation must not mutate interests before client validation");
});

test("removed and recently researched topics are rejected; retries are bounded", async () => {
  let calls = 0;
  const result = await recoverInterestDecision({ action: "add", interest: "Music" }, {
    existing: ["Birds", "Cities"], removed: ["Music"], query: "Birds", isNovel: (topic) => topic !== "Old research",
    generate: async () => ({ interest: ++calls === 1 ? "Old research" : "Music" }),
  });
  assert.equal(calls, 2); assert.equal(result.action, "keep"); assert.equal(result.fallbackFailed, true);
});

test("valid updates do not add model calls", async () => {
  const decision = { action: "replace", removeInterest: "Birds", interest: "Rivers" };
  const result = await recoverInterestDecision(decision, { existing: ["Birds", "Cities"], removed: [], query: "Birds", isNovel: () => true, generate: () => { throw new Error("Unexpected inference"); } });
  assert.equal(result, decision);
});
