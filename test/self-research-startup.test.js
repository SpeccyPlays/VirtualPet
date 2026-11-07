import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import { MIN_RESEARCH_MS, RESEARCH_INTERVALS, researchInterval } from "../research-policy.js";

// Execute the actual UI scheduling code with a small DOM/storage harness. No
// WebGL, external search, Ollama, or changes to a user's browser save are needed.
const source = readFileSync(new URL("../app.js", import.meta.url), "utf8");
const schedulingCode = source.slice(source.indexOf("// Autonomous research scheduling"), source.indexOf("// Manual interest management"));
const settle = () => new Promise(setImmediate);
function harness({ enabled = true, ready = true, cooling = false, unavailable = false } = {}) {
  const storage = new Map([["juniper-self-research-enabled", String(enabled)], ["juniper-self-research-interval", "600000"]]);
  const elements = new Map(), timers = [];
  const element = (id) => {
    if (!elements.has(id)) elements.set(id, { value: id === "model-select" ? "test-model" : "", checked: false, listeners: {}, addEventListener(type, handler) { this.listeners[type] = handler; } });
    return elements.get(id);
  };
  let nextAllowedAt = cooling ? Date.now() + 600000 : 0;
  let requests = 0;
  const context = vm.createContext({
    $, MIN_RESEARCH_MS, RESEARCH_INTERVALS, researchInterval, modelsReady: ready,
    document: { hidden: false, addEventListener() {} },
    localStorage: { getItem: (key) => storage.get(key) ?? null, setItem: (key, value) => storage.set(key, String(value)) },
    setInterval: (callback) => timers.push(callback),
    state: { interests: ["Birds"], researchHistory: [], removedInterests: [] }, reacting: false, pendingEvent: null,
    fetch: async () => { if (unavailable) throw new Error("Offline"); return { ok: true, json: async () => ({ nextAllowedAt: new Date(nextAllowedAt).toISOString(), busy: false }) }; },
    fetchThinking: async () => {
      requests++; nextAllowedAt = Date.now() + 600000;
      return { ok: true, json: async () => ({ nextAllowedAt: new Date(nextAllowedAt).toISOString(), thought: "Birds!", interestUpdate: { action: "keep" } }) };
    },
    researchContext: () => ({}), showResearchResult() {}, rememberResearch() {}, addThought() {},
  });
  function $(id) { return element(id); }
  vm.runInContext(schedulingCode, context);
  return { context, element, storage, timers, requests: () => requests, reconnect: () => { unavailable = false; } };
}

test("refresh restores enabled selection and interval without bypassing a saved cooldown", async () => {
  const h = harness({ cooling: true });
  vm.runInContext("setupSelfResearch()", h.context); await settle();
  assert.equal(h.element("self-research-toggle").checked, true);
  assert.equal(h.element("self-research-interval").value, "600000");
  assert.match(h.element("self-research-status").textContent, /Self-research enabled.*Next research/);
  assert.equal(h.requests(), 0);
});

test("restored autonomy resumes once models are ready, without toggling or duplicate requests", async () => {
  const h = harness({ ready: false });
  vm.runInContext("setupSelfResearch()", h.context); await settle();
  assert.match(h.element("self-research-status").textContent, /enabled.*Waiting for an available Ollama model/);
  assert.equal(h.requests(), 0);
  h.context.modelsReady = true;
  await Promise.all([vm.runInContext("checkSelfResearch()", h.context), vm.runInContext("checkSelfResearch()", h.context)]);
  assert.equal(h.requests(), 1);
  h.timers[0](); await settle();
  assert.equal(h.requests(), 1, "Polling must respect the new cooldown");
});

test("disabled autonomy stays off after refresh", async () => {
  const h = harness({ enabled: false });
  vm.runInContext("setupSelfResearch()", h.context); await settle();
  assert.equal(h.element("self-research-toggle").checked, false);
  assert.equal(h.element("self-research-status").textContent, "Self-research is off.");
  assert.equal(h.requests(), 0);
});

test("an enabled session recovers automatically from an unavailable schedule", async () => {
  const h = harness({ unavailable: true });
  vm.runInContext("setupSelfResearch()", h.context); await settle();
  assert.match(h.element("self-research-status").textContent, /enabled.*retry automatically/);
  assert.equal(h.requests(), 0);
  h.reconnect(); h.timers[0](); await settle();
  assert.equal(h.requests(), 1);
  assert.equal(h.storage.get("juniper-self-research-enabled"), "true");
});
