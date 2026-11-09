import test from "node:test";
import assert from "node:assert/strict";
import { createNarration } from "../narration.js";
import { createSpeechHandler } from "../speech.js";
import { readFileSync } from "node:fs";
import vm from "node:vm";
const settle = () => new Promise(setImmediate);

test("Enable sound enables an unchecked preference and sends a test phrase", async () => {
  const source = readFileSync(new URL("../app.js", import.meta.url), "utf8");
  const elements = new Map(), storage = new Map([["juniper-narration-enabled", "true"]]), spoken = [];
  let enabled = false, unlocks = 0;
  const $ = (id) => {
    if (!elements.has(id)) elements.set(id, { checked: false, listeners: {}, addEventListener(type, callback) { this.listeners[type] = callback; } });
    return elements.get(id);
  };
  const context = vm.createContext({ $, createBrowserSpeechAudio: () => ({ unlock: async () => { unlocks++; } }),
    createNarration: () => ({ setEnabled: (value) => { enabled = value; }, enqueue: (text) => { if (enabled) spoken.push(text); }, stop() {} }),
    localStorage: { getItem: (key) => storage.get(key), setItem: (key, value) => storage.set(key, value) }, window: { addEventListener() {} } });
  vm.runInContext(source.slice(source.indexOf("const speechAudio ="), source.indexOf("let modelsReady =")), context);
  assert.equal($("narration-toggle").checked, false, "Even a legacy saved preference must start off");
  await $("enable-narration").listeners.click();
  assert.equal($("narration-toggle").checked, true);
  assert.equal(unlocks, 1); assert.deepEqual(spoken, ["Hello. I am Juniper. My voice is ready."]);
  $("narration-toggle").checked = false; await $("narration-toggle").listeners.change();
  vm.runInContext("narrate('Do not speak')", context); assert.equal(spoken.length, 1);
  $("narration-toggle").checked = true; await $("narration-toggle").listeners.change();
  assert.equal(spoken.length, 2, "Turning the checkbox on also speaks exactly one confirmation");
  assert.equal(spoken[1], "Hello. I am Juniper. My voice is ready.");
});

test("only first new location visits narrate; ships and repeated visits stay silent", () => {
  const source = readFileSync(new URL("../app.js", import.meta.url), "utf8");
  const spoken = [], thoughts = [];
  const context = vm.createContext({ state: { discoveredLandmarks: [] }, addMemory() {}, addThought: (text) => thoughts.push(text), narrate: (text) => spoken.push(text), render() {}, toast() {} });
  vm.runInContext(source.slice(source.indexOf("function recordLandmarkVisit("), source.indexOf("let reacting =")), context);
  context.landmark = { id: "grove", name: "Grove", description: "Old trees." };
  vm.runInContext("recordLandmarkVisit(landmark); recordLandmarkVisit(landmark); recordLandmarkVisit({id:'ship',name:'Ship'});", context);
  assert.equal(spoken.length, 1); assert.match(spoken[0], /Grove/); assert.equal(thoughts.length, 2);
});

test("narration is opt-in, stops playback, bounds waiting thoughts and releases audio", async () => {
  const requests = [], players = [], released = [];
  const narration = createNarration({
    fetchAudio: async (_, options) => { requests.push(JSON.parse(options.body).text); return { ok: true, blob: async () => new Blob(["wave"]) }; },
    createAudio: () => { const player = { play: async () => {}, pause() { this.paused = true; } }; players.push(player); return player; },
    urls: { createObjectURL: () => `blob:${players.length}`, revokeObjectURL: (url) => released.push(url) },
  });
  narration.enqueue("silent"); await settle(); assert.equal(requests.length, 0);
  narration.setEnabled(true); narration.enqueue("first"); await settle();
  narration.enqueue("old"); narration.enqueue("second"); narration.enqueue("third");
  players[0].onended(); await settle(); assert.deepEqual(requests, ["first", "second"]);
  narration.setEnabled(false); await settle();
  assert.equal(players[1].paused, true); assert.equal(released.length, 2);
  assert.deepEqual(requests, ["first", "second"]);
});

test("disabling during synthesis ignores a late response", async () => {
  let resolveFetch, signal, played = false;
  const narration = createNarration({ fetchAudio: (_, options) => { signal = options.signal; return new Promise((resolve) => { resolveFetch = resolve; }); }, createAudio: () => { played = true; } });
  narration.setEnabled(true); narration.enqueue("late"); narration.setEnabled(false);
  resolveFetch({ ok: true, blob: async () => new Blob() }); await settle();
  assert.equal(signal.aborted, true); assert.equal(played, false);
});

test("speech handler validates input, forwards configured speaker and handles service failure", async () => {
  const wave = Buffer.alloc(44); wave.write("RIFF"); wave.write("WAVE", 8);
  let sent, fail = false;
  const handler = createSpeechHandler({ url: "http://piper/", speaker: 3, transport: async (url, options) => { sent = { url, body: JSON.parse(options.body) }; if (fail) throw new Error("offline"); return new Response(wave); } });
  const response = () => ({ statusCode: 200, on() {}, off() {}, status(code) { this.statusCode = code; return this; }, json(body) { this.body = body; return this; }, set() { return this; }, type() { return this; }, send(body) { this.body = body; return this; } });
  let res = response(); await handler({ body: { text: "" } }, res); assert.equal(res.statusCode, 400);
  res = response(); await handler({ body: { text: "Hello" } }, res); assert.deepEqual(sent, { url: "http://piper/synthesize", body: { text: "Hello", speaker_id: 3 } }); assert.equal(res.body.toString("ascii", 0, 4), "RIFF");
  fail = true; res = response(); await handler({ body: { text: "Hello" } }, res); assert.equal(res.statusCode, 503);
});
