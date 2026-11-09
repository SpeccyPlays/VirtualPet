import { createWorld } from "./world.js";
import { createNarration, createBrowserSpeechAudio } from "./narration.js";
import { restoreState, thoughtAge } from "./save-state.js";
import { RESEARCH_INTERVALS, researchInterval } from "./research-policy.js";

// Interest limits and the clean starting state for a newly arrived alien.
const MIN_INTERESTS = 2;
const MAX_INTERESTS = 4;
const DEFAULT_STATE = {
  worldVersion: 4,
  worldSeed: null,
  interests: ["What is Earth?", "How humans communicate", "Why humans build cities", "Earth's living ecosystems"],
  removedInterests: [],
  researchHistory: [],
  researchJournal: [],
  memories: [],
  discoveredLandmarks: [],
  worldEvents: [],
  objects: [
    { id: "bench-1", type: "bench", name: "High-street bench", description: "A practical place to observe human life and passing traffic.", x: -13, z: 6.4, createdBy: "city" },
    { id: "phonebox-1", type: "phonebox", name: "Red telephone box", description: "A bright red British street landmark Juniper cannot yet explain.", x: 8, z: -6.4, createdBy: "city" },
    { id: "litterbin-1", type: "litterbin", name: "Council litter bin", description: "A small piece of municipal infrastructure with a surprisingly important role.", x: 22, z: 6.4, createdBy: "city" },
    { id: "tree-1", type: "tree", name: "Street tree", description: "A living organism sharing the pavement with human commerce.", x: -25, z: 6.5, createdBy: "city" },
    { id: "bush-1", type: "bush", name: "Pavement bush", description: "A carefully contained patch of greenery beside the shops.", x: 28, z: -6.4, createdBy: "city" },
  ],
  thoughts: [
    { text: "The rain is chemically ordinary but emotionally significant to the humans here. I want to understand why.", icon: "*", time: "Just now" },
    { text: "I landed alone, but this city is full of signals, routines, and possible allies.", icon: "o", time: "18 min ago" },
    { text: "Earth is not my home, yet I may be capable of becoming someone new here.", icon: "~", time: "1 hr ago" },
  ],
};
// DOM access and local state restoration.
const $ = (id) => document.getElementById(id);
// Only explicit research/discovery call sites enqueue speech; ordinary thoughts stay silent.
const speechAudio = createBrowserSpeechAudio();
const narration = createNarration({ createAudio: () => speechAudio.createAudio(), onStatus: (message) => { $("narration-status").textContent = message; } });
const narrationToggle = $("narration-toggle");
narrationToggle.checked = false;
// Audio activation lasts for this page session only; never restore a checked
// control when the browser still requires a fresh gesture to enable sound.
let narrationArmed = false;
async function enableNarration() {
  narrationArmed = false;
  narration.setEnabled(false);
  if (!narrationToggle.checked) return;
  try {
    await speechAudio.unlock();
    if (!narrationToggle.checked) return;
    narrationArmed = true;
    narration.setEnabled(true);
    narration.enqueue("Hello. I am Juniper. My voice is ready.");
  } catch { $("narration-status").textContent = "Click Enable sound to allow playback."; }
}
// This button both enables narration and tests the whole speech path. Previously
// it silently did nothing when the separate checkbox was off.
$("enable-narration").addEventListener("click", async () => {
  narrationToggle.checked = true;
  await enableNarration();
});
narrationToggle.addEventListener("change", async () => {
  await enableNarration();
});
$("narration-status").textContent = narrationToggle.checked ? "Click Enable sound to resume narration." : "Narration is off.";
window.addEventListener("pagehide", () => { narration.stop(); narrationArmed = false; });
window.addEventListener("pageshow", (event) => {
  if (event.persisted) { narrationToggle.checked = false; narrationArmed = false; narration.setEnabled(false); }
});
function narrate(text) {
  if (!narrationToggle.checked) return;
  if (!narrationArmed) { $("narration-status").textContent = "Thought recorded. Click Enable sound to hear future narration."; return; }
  narration.enqueue(text);
}
let modelsReady = false;
const sessionResetGeneration = localStorage.getItem("juniper-reset-generation") || "0";
const createWorldSeed = () => {
  if (window.crypto?.getRandomValues) return window.crypto.getRandomValues(new Uint32Array(1))[0];
  return Math.floor(Math.random() * 0xffffffff);
};
const rawSave = localStorage.getItem("juniper-state");
// Preserve a damaged save for manual recovery before replacing it with defaults.
try { JSON.parse(rawSave || "null"); } catch { localStorage.setItem("juniper-state-recovery", rawSave); }
const state = restoreState(rawSave, DEFAULT_STATE, createWorldSeed);
// Remove legacy pet metrics from migrated saves; Juniper is now observed through thoughts and actions.
delete state.stats;
delete state.level;
state.interests = Array.isArray(state.interests) ? state.interests.filter((item) => typeof item === "string" && item.trim()).map((item) => item.trim()) : [];
state.removedInterests = Array.isArray(state.removedInterests) ? state.removedInterests : [];
state.researchHistory = Array.isArray(state.researchHistory) ? state.researchHistory : [];
state.researchJournal = Array.isArray(state.researchJournal) ? state.researchJournal.filter((entry) => entry && typeof entry.query === "string") : [];
state.memories = Array.isArray(state.memories) ? state.memories : [];
state.discoveredLandmarks = Array.isArray(state.discoveredLandmarks) ? state.discoveredLandmarks : [];
state.worldEvents = Array.isArray(state.worldEvents) ? state.worldEvents : [];
if (!state.researchJournal.length && state.researchHistory.length) state.researchJournal = state.researchHistory.slice(-12).map((query) => ({ query, summary: "", sources: [], timestamp: "" }));
state.objects = Array.isArray(state.objects) ? state.objects : structuredClone(DEFAULT_STATE.objects);
state.worldVersion = DEFAULT_STATE.worldVersion;
if (!Number.isInteger(state.worldSeed)) state.worldSeed = createWorldSeed();
state.thoughts = Array.isArray(state.thoughts) ? state.thoughts : [];
state.interests = [...new Map(state.interests.map((item) => [item.toLowerCase(), item])).values()];
if (state.interests.length > MAX_INTERESTS) { state.removedInterests.push(...state.interests.slice(MAX_INTERESTS)); state.interests = state.interests.slice(0, MAX_INTERESTS); }
for (const fallback of DEFAULT_STATE.interests) { if (state.interests.length >= MIN_INTERESTS) break; if (!state.interests.some((item) => item.toLowerCase() === fallback.toLowerCase())) state.interests.push(fallback); }

// Normalize saved data so older versions cannot reintroduce unsupported state.
function save() {
  // A reset in another tab invalidates this tab's in-memory state.
  if ((localStorage.getItem("juniper-reset-generation") || "0") !== sessionResetGeneration) return;
  try {
    localStorage.setItem("juniper-state", JSON.stringify(state)); $("save-status").textContent = "Saved just now"; setTimeout(() => ($("save-status").textContent = "Saved locally"), 1800);
  } catch { $("save-status").textContent = "Save unavailable: browser storage is full or disabled"; }
}
window.addEventListener("storage", (event) => {
  if (event.key === "juniper-reset-generation" && event.newValue !== sessionResetGeneration) location.reload();
});
function escapeHtml(value) { const div = document.createElement("div"); div.textContent = value; return div.innerHTML; }
function render() {
  $("interest-list").innerHTML = state.interests.map((item, index) => `<span class="interest">${escapeHtml(item)}<button class="remove-interest" data-interest-index="${index}" aria-label="Remove ${escapeHtml(item)}" title="Remove interest">x</button></span>`).join("");
  $("research-topic").innerHTML = state.interests.map((item) => `<option>${escapeHtml(item)}</option>`).join("");
  $("thought-count").textContent = `${state.thoughts.length} entries`;
  $("thought-list").innerHTML = state.thoughts.map((thought) => `<article class="thought"><span class="thought-icon">${escapeHtml(thought.icon)}</span><span>${escapeHtml(thought.text)}</span><time></time></article>`).join("");
  updateThoughtTimes();
  const discoveries = $("landmark-list");
  if (discoveries) discoveries.innerHTML = state.discoveredLandmarks.length ? state.discoveredLandmarks.map((landmark) => `<span class="landmark-tag">${escapeHtml(landmark.name)}</span>`).join("") : '<span class="empty-discoveries">Juniper has not discovered any landmarks yet.</span>';
}
function updateThoughtTimes() {
  const now = Date.now();
  $("thought-list").querySelectorAll("time").forEach((element, index) => {
    const thought = state.thoughts[index]; if (!thought) return;
    element.textContent = thoughtAge(thought, index, now);
    if (Number.isFinite(thought.createdAt)) {
      element.dateTime = new Date(thought.createdAt).toISOString();
      element.title = new Date(thought.createdAt).toLocaleString();
    }
  });
}
function addThought(text, icon = "*") { state.thoughts.unshift({ text, icon, createdAt: Date.now() }); state.thoughts = state.thoughts.slice(0, 12); render(); save(); worldApi?.showObservation(); }
async function addGeneratedThought(fallback, context, icon = "*", markWake = false) {
  let thought = fallback;
  try { const model = $("model-select").value; if (!model) throw new Error("No model"); const response = await fetchThinking("/api/thought", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ model, context }) }); const data = await response.json(); if (!response.ok || !data.thought) throw new Error(data.error || "Thought generation failed"); thought = data.thought; } catch { /* Fallback keeps Juniper expressive when Ollama is offline. */ }
  addThought(thought, icon); if (markWake) localStorage.setItem("juniper-last-ai-thought", String(Date.now()));
}
function toast(message) { $("toast").textContent = message; $("toast").classList.add("visible"); setTimeout(() => $("toast").classList.remove("visible"), 2600); }
// UK high-street objects share their interaction rules with the 3D city.
// UK street objects and their effects on Juniper's internal state.
const OBJECT_TYPES = {
  bench: { actions: [{ label: "Sit and observe", thought: "A bench is an excellent human invention for watching the street." }, { label: "Inspect it", thought: "This bench is public, yet no one seems to own it. Fascinating." }] },
  phonebox: { actions: [{ label: "Study the box", thought: "Humans built a room for communication and then mostly stopped using it." }, { label: "Look inside", thought: "The red box contains layers of human history, stickers, and unanswered questions." }] },
  litterbin: { actions: [{ label: "Inspect the label", thought: "Humans created a system for deciding where unwanted matter belongs." }, { label: "Keep the pavement tidy", thought: "Small acts of maintenance may be one of the hidden systems holding cities together." }] },
  tree: { actions: [{ label: "Study the leaves", thought: "This organism is quietly converting sunlight into a presence on the pavement." }, { label: "Rest in its shade", thought: "The tree changes the street without asking anyone for permission." }] },
  bush: { actions: [{ label: "Examine the greenery", thought: "Humans place living things beside concrete and call the arrangement decoration." }, { label: "Check for life", thought: "There are smaller lives here that the humans walk past every day." }] },
};
const SUPPORTED_OBJECT_TYPES = new Set(Object.keys(OBJECT_TYPES));
state.objects = state.objects.filter((object) => object && SUPPORTED_OBJECT_TYPES.has(object.type));
if (!state.objects.length) state.objects = structuredClone(DEFAULT_STATE.objects);
let worldApi;
let pendingThinkingRequests = 0;
async function fetchThinking(url, options) {
  // Requests can overlap. A counter keeps the bubble visible until the final
  // thought/research operation settles, including failures and aborted requests.
  pendingThinkingRequests++;
  worldApi?.setThinking(true);
  try { return await fetch(url, options); }
  finally { pendingThinkingRequests--; worldApi?.setThinking(pendingThinkingRequests > 0); }
}
function renderWorldObjects() { $("world-object-list").innerHTML = state.objects.map((object) => `<button class="world-object-tag" data-world-object-id="${escapeHtml(object.id)}" title="Show ${escapeHtml(object.name)} in the city"><span>${escapeHtml(object.name)}</span><small>${escapeHtml(object.type)} · ${object.x}, ${object.z}</small></button>`).join(""); }
function closeObjectPanel() { $("object-panel").hidden = true; }
function autonomouslyInteract(objectId) {
  const object = state.objects.find((item) => item.id === objectId); if (!object) return;
  const definition = OBJECT_TYPES[object.type] || OBJECT_TYPES.bench; const action = definition.actions[Math.floor(Math.random() * definition.actions.length)];
  addThought(action.thought, "*"); $("scene-caption").textContent = `Juniper is ${action.label.toLowerCase()} at ${object.name}`; toast(`Juniper ${action.label.toLowerCase()}`);
}
function showObjectPanel(objectId) {
  const object = state.objects.find((item) => item.id === objectId); if (!object) return;
  const definition = OBJECT_TYPES[object.type] || OBJECT_TYPES.bench;
  $("object-name").textContent = object.name; $("object-description").textContent = object.description; $("object-actions").innerHTML = definition.actions.map((action, index) => `<button data-object-action="${index}">${escapeHtml(action.label)}</button>`).join("") + `<button data-object-action="remove">Pack away</button>`; $("object-panel").hidden = false;
  $("object-actions").onclick = (event) => {
    const button = event.target.closest("[data-object-action]"); if (!button) return;
    if (button.dataset.objectAction === "remove") { if (object.createdBy === "city" && !window.confirm("Let Juniper pack away this city fixture?")) return; state.objects.splice(state.objects.findIndex((item) => item.id === object.id), 1); worldApi.removeObject(object.id); renderWorldObjects(); save(); closeObjectPanel(); toast(`${object.name} was packed away`); return; }
    const action = definition.actions[Number(button.dataset.objectAction)]; addThought(action.thought, "*"); $("scene-caption").textContent = `Juniper is interacting with ${object.name}`; toast(action.label); closeObjectPanel();
  };
}
function addMemory(landmark, text) {
  state.memories.unshift({ landmarkId: landmark.id, landmarkName: landmark.name, text, time: new Date().toISOString() });
  state.memories = state.memories.slice(0, 24);
  save();
}
function showLandmarkPanel(landmark) {
  if (!landmark) return;
  $("object-name").textContent = landmark.name;
  $("object-description").textContent = landmark.description;
  $("object-actions").innerHTML = '<button data-landmark-action="observe">Record observation</button><button data-landmark-action="route">Guide Juniper here</button>';
  $("object-panel").hidden = false;
  $("object-actions").onclick = (event) => {
    const button = event.target.closest("[data-landmark-action]");
    if (!button) return;
    if (button.dataset.landmarkAction === "route") {
      worldApi.focusLandmark(landmark.id);
      closeObjectPanel();
      return;
    }
    const thought = landmark.id === "ship"
      ? "I have returned to my ship."
      : `I have found ${landmark.name}. ${landmark.description}`;
    addMemory(landmark, thought);
    addThought(thought, "~");
    toast(`Juniper recorded ${landmark.name}`);
    closeObjectPanel();
  };
}
function recordLandmarkVisit(landmark) {
  if (!state.discoveredLandmarks.some((item) => item.id === landmark.id)) {
    state.discoveredLandmarks.push({ id: landmark.id, name: landmark.name });
    // Her own ship is already familiar, so describe a return rather than a
    // discovery. Keep the landmark ID recorded to prevent repeated first visits.
    const isShip = landmark.id === "ship";
    addMemory(landmark, isShip ? "I have returned to my ship." : `I reached ${landmark.name}. ${landmark.description}`);
    addThought(isShip ? "I have returned to my ship." : `I have discovered ${landmark.name}. ${landmark.description}`, "~");
    if (!isShip) narrate(`I have discovered ${landmark.name}. ${landmark.description}`);
    render();
    toast(isShip ? "Juniper returned to her ship" : `Juniper discovered ${landmark.name}`);
  }
}
let reacting = false;
let pendingEvent = null;
function recordWorldEvent(event) {
  if (state.worldEvents.some((entry) => entry.id === event.id)) return;
  state.worldEvents.unshift({ ...event, reactionStatus: "pending", time: new Date().toISOString() });
  state.worldEvents = state.worldEvents.slice(0, 12);
  $("world-event-status").textContent = `${event.name} near ${event.location}.`;
  save();
  // Coalesce observations while inference is busy. Only the newest waiting event
  // matters; an old reaction should not arrive several minutes after the event.
  if (pendingEvent) {
    const skipped = state.worldEvents.find((entry) => entry.id === pendingEvent.id);
    if (skipped) skipped.reactionStatus = "superseded";
  }
  pendingEvent = event;
  void reactToEvents();
}
async function reactToEvents() {
  if (reacting || !pendingEvent) return;
  reacting = true;
  const event = pendingEvent; pendingEvent = null;
  const entry = state.worldEvents.find((item) => item.id === event.id);
  try {
    const model = $("model-select").value;
    if (!model) throw new Error("Ollama unavailable");
    const response = await fetchThinking("/api/event-reaction", { method: "POST", headers: { "content-type": "application/json" }, signal: AbortSignal.timeout(90000), body: JSON.stringify({ event, model, interests: state.interests, memories: state.memories.slice(0, 3).map((m) => m.text) }) });
    const data = await response.json();
    if (!response.ok || data.eventId !== event.id || typeof data.thought !== "string") throw new Error(data.error || "Reaction unavailable");
    if (Date.now() - event.createdAt > 90000 || !state.worldEvents.includes(entry)) throw new Error("Observation expired");
    entry.reaction = data.thought; entry.reactionStatus = "complete";
    addThought(data.thought, "*");
    if (state.worldEvents[0]?.id === event.id) $("world-event-status").textContent = `${event.name}: ${data.thought}`;
  } catch (error) {
    if (entry) entry.reactionStatus = "unavailable";
    if (state.worldEvents[0]?.id === event.id) $("world-event-status").textContent = `${event.description} Reaction unavailable: ${error.message}.`;
  } finally { reacting = false; save(); if (pendingEvent) void reactToEvents(); }
}
function updateWorldTime({ hour, minute, weather, isNight }) {
  const clock = `${String(Math.floor(hour)).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
  $("weather-chip").textContent = `${clock} · ${weather}${isNight ? " · Night" : ""}`;
}
$("object-close").addEventListener("click", closeObjectPanel);
$("world-object-list").addEventListener("click", (event) => {
  const button = event.target.closest("[data-world-object-id]"); if (!button) return;
  const objectId = button.dataset.worldObjectId; const object = state.objects.find((item) => item.id === objectId); if (!object || !worldApi?.focusObject(objectId)) return;
  $("world").scrollIntoView({ behavior: "smooth", block: "start" }); showObjectPanel(objectId);
});
// Research journal persistence and rendering of Ollama results.
function rememberResearch(query, data) {
  state.researchHistory = [...state.researchHistory.filter((item) => item.toLowerCase() !== query.toLowerCase()), query].slice(-20);
  const entry = {
    query,
    summary: String(data?.summary || "").slice(0, 450),
    sources: Array.isArray(data?.sources) ? data.sources.slice(0, 3).map((source) => ({ title: String(source.title || "").slice(0, 100), url: String(source.url || "").slice(0, 180) })) : [],
    timestamp: new Date().toISOString(),
  };
  state.researchJournal = [...state.researchJournal.filter((item) => item.query.toLowerCase() !== query.toLowerCase()), entry].slice(-12);
  save();
}
function researchContext() { return { researchHistory: state.researchHistory, researchJournal: state.researchJournal, removedInterests: state.removedInterests }; }
function showResearchResult(data) { $("research-summary").textContent = data.summary; const cited = data.sources.filter((source) => data.sourceIds.includes(source.id)); $("source-list").innerHTML = (cited.length ? cited : data.sources).map((source) => `<a class="source-link" href="${escapeHtml(source.url)}" target="_blank" rel="noopener noreferrer">[${source.id}] ${escapeHtml(source.title)} -></a>`).join(""); $("research-result").hidden = false; }
async function loadOllamaModels() {
  try { const response = await fetch("/api/models"); if (!response.ok) throw new Error(); const data = await response.json(); $("model-select").innerHTML = data.models.map((model) => `<option value="${escapeHtml(model)}">${escapeHtml(model)}</option>`).join("") || '<option value="">No models installed</option>'; modelsReady = true; void checkSelfResearch(); if (data.defaultModel && data.models.includes(data.defaultModel)) $("model-select").value = data.defaultModel; $("research-note").textContent = `${data.models.length} local Ollama model${data.models.length === 1 ? "" : "s"} available.`; if (Date.now() - Number(localStorage.getItem("juniper-last-ai-thought") || 0) > 300000) void addGeneratedThought("I detect a new question forming about this city.", "Juniper is waking up and observing Wychmere, a UK city where she has landed.", "~", true); } catch { $("model-select").innerHTML = '<option value="">Ollama unavailable</option>'; $("research-note").textContent = "Ollama unavailable - start Ollama, then refresh this page."; }
}

$("research-button").addEventListener("click", async () => {
  const query = $("research-topic").value; const model = $("model-select").value; if (!query || !model) return toast("Choose an interest and an available Ollama model");
  if (!canResearch()) return;
  const button = $("research-button"); button.disabled = true; button.textContent = "Thinking..."; $("research-result").hidden = true;
  try { const data = await requestResearch("/api/research", query, model); showResearchResult(data); rememberResearch(query, data); addThought(data.thought, "~"); narrate(data.thought); toast(`Juniper researched "${query}" with ${model}`); } catch (error) { toast(error.message); } finally { button.disabled = false; button.textContent = "Research"; }
});

// Autonomous research scheduling and interest evolution.
function syncSelfResearchStatus(message) { $("self-research-status").textContent = message; }
let researchBusy = false;
let nextResearchAt = 0;
let scheduleReady = false;
let serverResearchBusy = false;
let checkingSelfResearch = false;
let lastSelfResearchSummary = "";
let researchPhase = "researching";
function syncSelfResearchSelection() {
  // Setting checkbox.checked during restoration does not fire a change event.
  // Startup, toggles and schedule refreshes must all update the same status.
  if (lastSelfResearchSummary && !researchBusy && !serverResearchBusy) return syncSelfResearchStatus(lastSelfResearchSummary);
  if (researchBusy) return syncSelfResearchStatus(researchPhase === "thinking" ? "Juniper is thinking." : "Juniper is researching.");
  if (!$("self-research-toggle").checked) return syncSelfResearchStatus("Self-research is off.");
  const prefix = "Self-research enabled. ";
  if (researchBusy || serverResearchBusy) return syncSelfResearchStatus(prefix + "Juniper is researching.");
  if (!scheduleReady) return syncSelfResearchStatus(prefix + "Waiting for the server schedule; it will retry automatically.");
  if (Date.now() < nextResearchAt) return syncSelfResearchStatus(prefix + `Next research after ${new Date(nextResearchAt).toLocaleTimeString()}.`);
  if (!modelsReady || !$("model-select").value) return syncSelfResearchStatus(prefix + "Waiting for an available Ollama model.");
  if (reacting || pendingEvent) return syncSelfResearchStatus(prefix + "Juniper is reacting to something nearby first.");
  syncSelfResearchStatus(prefix + "Juniper will research when ready; event reactions take priority.");
}
function updateResearchSchedule(data) {
  const next = Date.parse(data.nextAllowedAt);
  if (Number.isFinite(next)) {
    nextResearchAt = next;
    localStorage.setItem("juniper-self-research-next", data.nextAllowedAt);
  }
  scheduleReady = true;
}
function canResearch(quiet = false) {
  if (!modelsReady || !scheduleReady || researchBusy || serverResearchBusy || reacting || pendingEvent || Date.now() < nextResearchAt) {
    if (!quiet) syncSelfResearchStatus(researchBusy ? "Juniper is researching." : reacting ? "Juniper is reacting to something nearby." : `Research available after ${new Date(nextResearchAt).toLocaleTimeString()}.`);
    return false;
  }
  return true;
}
async function requestResearch(endpoint, query, model) {
  researchBusy = true;
  lastSelfResearchSummary = "";
  researchPhase = "researching";
  syncSelfResearchStatus("Juniper is researching.");
  let observing = true, polling = false;
  // The POST remains open during web search and inference. Read the actual
  // server phase instead of guessing when search has finished.
  const progressTimer = setInterval(async () => {
    if (polling || !observing) return;
    polling = true;
    try {
      const response = await fetch("/api/research-status");
      if (!response.ok) return;
      const progress = await response.json();
      if (observing && progress.busy && progress.phase === "thinking") {
        researchPhase = "thinking";
        syncSelfResearchStatus("Juniper is thinking.");
      }
    } catch { /* Progress is advisory; the research POST owns failure handling. */ }
    finally { polling = false; }
  }, 500);
  try {
    const response = await fetchThinking(endpoint, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ query, model, intervalMs: $("self-research-interval").value ? researchInterval($("self-research-interval").value) : undefined, interests: state.interests, ...researchContext() }) });
    const data = await response.json(); updateResearchSchedule(data);
    if (!response.ok) throw Object.assign(new Error(data.error || "Research unavailable"), { researchData: data });
    syncSelfResearchStatus(`Next research after ${new Date(nextResearchAt).toLocaleTimeString()}. Juniper has time to observe the city.`);
    return data;
  } finally { observing = false; clearInterval(progressTimer); researchBusy = false; }
}
async function applyInterestUpdate(update) {
  if (!update) return "Juniper requested an invalid change: Ollama returned no interest decision.";
  if (!["add", "remove", "replace", "keep"].includes(update.action)) return `Juniper requested an invalid change: ${String(update.action || "no action")} was not a recognised interest action.`;
  const candidate = String(update.interest || "").trim();
  const replacement = String(update.removeInterest || "").trim();
  const isAllowedNewInterest = candidate && !state.removedInterests.some((item) => item.toLowerCase() === candidate.toLowerCase()) && !state.interests.some((item) => item.toLowerCase() === candidate.toLowerCase());
  const attemptedChange = update.action === "replace"
    ? `replace "${replacement || "an unspecified interest"}" with "${candidate || "an unspecified new interest"}"`
    : `${update.action} "${candidate || "an unspecified interest"}"`;
  const invalidChange = (reason) => `Juniper requested an invalid change: she tried to ${attemptedChange}, but ${reason}.`;
  if (update.action === "replace" && isAllowedNewInterest && replacement) {
    const index = state.interests.findIndex((item) => item.toLowerCase() === replacement.toLowerCase());
    if (index >= 0) {
      const removed = state.interests.splice(index, 1)[0];
      state.removedInterests.push(removed);
      state.interests.push(candidate);
      render(); save();
      return `Juniper followed a new rabbit hole: replaced "${removed}" with "${candidate}".`;
    }
  }
  if (update.action === "add" && candidate && state.interests.length >= MAX_INTERESTS) {
    await askJuniperToMakeRoom();
    if (state.interests.length < MAX_INTERESTS && !state.removedInterests.some((item) => item.toLowerCase() === candidate.toLowerCase()) && !state.interests.some((item) => item.toLowerCase() === candidate.toLowerCase())) {
      state.interests.push(candidate);
      render(); save();
      return `Juniper made room first, then added "${candidate}" to her interests.`;
    }
    return invalidChange("her list was full and no suitable interest was removed first");
  }
  if (update.action === "add" && candidate && state.interests.length < MAX_INTERESTS && !state.removedInterests.some((item) => item.toLowerCase() === candidate.toLowerCase()) && !state.interests.some((item) => item.toLowerCase() === candidate.toLowerCase())) { state.interests.push(candidate); render(); save(); return `Juniper added "${candidate}" to her interests.`; }
  if (update.action === "remove" && candidate && state.interests.length > MIN_INTERESTS) { const index = state.interests.findIndex((item) => item.toLowerCase() === candidate.toLowerCase()); if (index >= 0) { state.interests.splice(index, 1); state.removedInterests.push(candidate); render(); save(); return `Juniper removed "${candidate}" from her interests.`; } }
  if (update.action === "keep") return update.fallbackFailed ? update.reason : "";
  if (update.action === "add" && state.interests.length >= MAX_INTERESTS) return invalidChange(`her list already has ${MAX_INTERESTS} interests`);
  if (update.action === "remove" && state.interests.length <= MIN_INTERESTS) return invalidChange(`she must keep at least ${MIN_INTERESTS} interests`);
  if (update.action === "replace" && state.interests.length <= MIN_INTERESTS) return invalidChange(`she must keep at least ${MIN_INTERESTS} interests`);
  if (update.action === "replace" && !replacement) return invalidChange("no existing interest was identified for removal");
  if (update.action === "replace" && !state.interests.some((item) => item.toLowerCase() === replacement.toLowerCase())) return invalidChange(`"${replacement}" is not currently one of her interests`);
  if (candidate && !isAllowedNewInterest) return invalidChange(`"${candidate}" is already present or was explicitly removed`);
  return invalidChange("the request did not meet the interest rules");
}
function nextSelfResearchTopic() {
  if (!state.interests.length) return "";
  const lastTopic = localStorage.getItem("juniper-last-self-research-topic")?.toLowerCase();
  const lastIndex = state.interests.findIndex((item) => item.toLowerCase() === lastTopic);
  const recent = state.researchHistory.slice(-2).map((item) => item.toLowerCase());
  for (let offset = 1; offset <= state.interests.length; offset += 1) {
    const index = (Math.max(lastIndex, -1) + offset) % state.interests.length;
    const candidate = state.interests[index];
    if (!recent.includes(candidate.toLowerCase()) || offset === state.interests.length) {
      localStorage.setItem("juniper-last-self-research-topic", candidate);
      return candidate;
    }
  }
  return state.interests[0];
}
// A button press can request a session with autonomy off, but never bypasses the gate.
async function runSelfResearch(manual = false) {
  if ((!manual && !$("self-research-toggle").checked) || !canResearch(!manual)) return;
  const query = nextSelfResearchTopic(), model = $("model-select").value;
  if (!query || !model) return;
  const button = $("self-research-button"); button.disabled = true;
  const previousInterests = [...state.interests];
  try {
    const data = await requestResearch("/api/self-research", query, model);
    showResearchResult(data); rememberResearch(query, data); addThought(data.thought, "~"); narrate(data.thought);
    syncSelfResearchStatus("Juniper is thinking.");
    const change = data.interestUpdate ? await applyInterestUpdate(data.interestUpdate) : "";
    const removed = previousInterests.filter((item) => !state.interests.includes(item));
    const added = state.interests.filter((item) => !previousInterests.includes(item));
    const changes = [
      ...removed.map((item) => `She removed "${item}" from her interests.`),
      ...added.map((item) => `She added "${item}" to her interests.`),
    ].join(" ") || change || "Her interests stayed the same.";
    lastSelfResearchSummary = `Juniper researched "${query}". ${changes} Next research after ${new Date(nextResearchAt).toLocaleTimeString()}.`;
    syncSelfResearchStatus(lastSelfResearchSummary);
  } catch (error) {
    let change = error.researchData?.interestUpdateError || "";
    if (error.researchData?.interestUpdate) {
      syncSelfResearchStatus("Juniper is thinking.");
      try { change = await applyInterestUpdate(error.researchData.interestUpdate); }
      catch { change = "Juniper could not update her interests."; }
    }
    const removed = previousInterests.filter((item) => !state.interests.includes(item));
    const added = state.interests.filter((item) => !previousInterests.includes(item));
    const actualChanges = [...removed.map((item) => `She removed "${item}" from her interests.`), ...added.map((item) => `She added "${item}" to her interests.`)].join(" ");
    const nextTime = nextResearchAt > Date.now() ? `Next research after ${new Date(nextResearchAt).toLocaleTimeString()}.`
      : "The next research time will be confirmed when the server schedule is available.";
    lastSelfResearchSummary = `${error.message} ${actualChanges || change} ${nextTime}`;
    syncSelfResearchStatus(lastSelfResearchSummary);
  }
  finally { button.disabled = false; }
}
$("self-research-toggle").addEventListener("change", () => {
  localStorage.setItem("juniper-self-research-enabled", String($("self-research-toggle").checked));
  syncSelfResearchSelection();
  if ($("self-research-toggle").checked) void checkSelfResearch();
});
$("self-research-interval").addEventListener("change", () => localStorage.setItem("juniper-self-research-interval", $("self-research-interval").value));
$("self-research-button").addEventListener("click", () => void runSelfResearch(true));
async function refreshResearchSchedule() {
  try {
    const response = await fetch("/api/research-status");
    if (!response.ok) throw new Error("Research schedule unavailable");
    const data = await response.json(); updateResearchSchedule(data);
    serverResearchBusy = Boolean(data.busy);
    syncSelfResearchSelection();
    return !serverResearchBusy;
  } catch { scheduleReady = false; serverResearchBusy = false; syncSelfResearchSelection(); return false; }
}
async function checkSelfResearch() {
  // Startup, model discovery, tab visibility and the timer can race. Keep one
  // check in flight so restoring an enabled save cannot launch duplicate work.
  if (document.hidden || researchBusy || checkingSelfResearch) return;
  checkingSelfResearch = true;
  try { if (await refreshResearchSchedule()) await runSelfResearch(false); }
  finally { checkingSelfResearch = false; }
}
function setupSelfResearch() {
  $("self-research-toggle").checked = localStorage.getItem("juniper-self-research-enabled") === "true";
  const savedInterval = researchInterval(localStorage.getItem("juniper-self-research-interval"), null);
  $("self-research-interval").value = RESEARCH_INTERVALS.includes(savedInterval) ? String(savedInterval) : "";
  syncSelfResearchSelection();
  void checkSelfResearch();
  // Read the server on every automatic check; another tab may have researched.
  setInterval(() => void checkSelfResearch(), 30000);
  document.addEventListener("visibilitychange", () => { if (!document.hidden) void checkSelfResearch(); });
}
// Manual interest management and Ollama-assisted interest changes.
async function developInterestWithCapacity() {
  if (state.interests.length >= MAX_INTERESTS) await askJuniperToMakeRoom();
  if (state.interests.length >= MAX_INTERESTS) return;
  const model = $("model-select").value;
  if (!model) return toast("Choose an available Ollama model first");
  const button = $("develop-interest");
  button.disabled = true;
  button.textContent = "Thinking...";
  try {
    const response = await fetchThinking("/api/interest", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ model, interests: state.interests, thoughts: state.thoughts.map((thought) => thought.text), researchHistory: state.researchHistory, removedInterests: state.removedInterests }) });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "Juniper could not develop an interest");
    const candidate = String(data.interest || "").trim();
    if (state.interests.length >= MAX_INTERESTS) throw new Error("Juniper's list changed while she was thinking; remove an interest first.");
    if (data.action !== "add" || !candidate || state.interests.some((item) => item.toLowerCase() === candidate.toLowerCase()) || state.removedInterests.some((item) => item.toLowerCase() === candidate.toLowerCase())) throw new Error("Juniper suggested an invalid new interest - try again");
    state.interests.push(candidate);
    render(); save(); addThought(data.reason, "*"); toast(`Juniper is now curious about ${candidate}`);
  } catch (error) { toast(error.message); }
  finally { button.disabled = false; button.textContent = "Juniper chooses"; }
}
let developingInterest = false;
$("develop-interest").addEventListener("click", async () => {
  if (developingInterest) return;
  developingInterest = true;
  try { await developInterestWithCapacity(); } finally { developingInterest = false; }
});
$("add-interest").addEventListener("click", () => {
  if (state.interests.length >= MAX_INTERESTS) return toast("Remove an interest first; Juniper can keep four.");
  const interest = window.prompt("What should Juniper be curious about?")?.trim().slice(0, 80);
  if (!interest || state.interests.some((item) => item.toLowerCase() === interest.toLowerCase())) return;
  state.interests.push(interest);
  state.removedInterests = state.removedInterests.filter((item) => item.toLowerCase() !== interest.toLowerCase());
  render(); save();
  void addGeneratedThought(`I am curious about ${interest}.`, `Juniper discovered a new interest: ${interest}`, "*");
});
// Ollama-controlled street object creation and removal.
$("world-decision-button").addEventListener("click", async () => {
  const model = $("model-select").value; if (!model) return toast("Choose an available Ollama model first");
  const button = $("world-decision-button"); button.disabled = true; button.textContent = "Thinking..."; $("world-decision-status").textContent = "Juniper is imagining a small change...";
  try {
    const response = await fetchThinking("/api/world-decision", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ model, interests: state.interests, thoughts: state.thoughts.map((thought) => thought.text), worldSeed: state.worldSeed, objects: state.objects }) });
    const decision = await response.json(); if (!response.ok) throw new Error(decision.error || "Juniper could not decide");
    const allowedTypes = new Set(Object.keys(OBJECT_TYPES));
    if (decision.action === "add" && allowedTypes.has(decision.type) && decision.name && Number.isFinite(decision.x) && Number.isFinite(decision.z) && Math.abs(decision.x) <= 108 && Math.abs(decision.z) <= 108 && worldApi.canPlace(decision.x, decision.z) && state.objects.length < 20) {
      const object = { id: `juniper-${Date.now()}`, type: decision.type, name: decision.name, description: decision.description || "A new little part of Juniper's city.", x: decision.x, z: decision.z, createdBy: "juniper" };
      state.objects.push(object); worldApi.addObject(object); renderWorldObjects(); save(); $("world-decision-status").textContent = decision.reason; toast(`Juniper added ${object.name}`);
    } else if (decision.action === "remove") {
      const object = state.objects.find((item) => item.id === decision.objectId && item.createdBy === "juniper");
      if (object) { state.objects.splice(state.objects.findIndex((item) => item.id === object.id), 1); worldApi.removeObject(object.id); renderWorldObjects(); save(); $("world-decision-status").textContent = decision.reason; toast(`Juniper removed ${object.name}`); } else { $("world-decision-status").textContent = "Juniper decided to leave the city as it is."; }
    } else { $("world-decision-status").textContent = decision.reason || "Juniper decided to leave the city as it is."; toast("Juniper is content with the city for now"); }
  } catch (error) { $("world-decision-status").textContent = error.message; toast(error.message); } finally { button.disabled = false; button.textContent = "Ask Juniper"; }
});
$("interest-list").addEventListener("click", (event) => { const button = event.target.closest("[data-interest-index]"); if (!button) return; const index = Number(button.dataset.interestIndex); const interest = state.interests[index]; if (!interest || !window.confirm(`Remove Juniper's interest in "${interest}"?`)) return; state.interests.splice(index, 1); if (!state.removedInterests.some((item) => item.toLowerCase() === interest.toLowerCase())) state.removedInterests.push(interest); render(); save(); toast(`Removed "${interest}" from Juniper's interests`); });
$("interest-list").addEventListener("click", (event) => { const button = event.target.closest("[data-interest-index]"); if (button && state.interests.length <= MIN_INTERESTS) { event.stopImmediatePropagation(); toast(`Juniper needs to keep at least ${MIN_INTERESTS} interests`); } }, true);
async function askJuniperToMakeRoom() {
  const button = $("develop-interest"); const model = $("model-select").value; if (!model) return toast("Choose an available Ollama model first");
  button.disabled = true; button.textContent = "Choosing...";
  try { const response = await fetchThinking("/api/interest", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ model, interests: state.interests, thoughts: state.thoughts.map((thought) => thought.text), researchHistory: state.researchHistory, removedInterests: state.removedInterests }) }); const data = await response.json(); if (!response.ok) throw new Error(data.error || "Juniper could not choose an interest to release"); const index = state.interests.findIndex((item) => item.toLowerCase() === String(data.interest || "").toLowerCase()); if (data.action !== "remove" || index < 0 || state.interests.length <= MIN_INTERESTS) throw new Error("Juniper could not find a suitable interest to release"); const removed = state.interests.splice(index, 1)[0]; state.removedInterests.push(removed); render(); save(); addThought(data.reason || `I am making room by saying goodbye to ${removed} for now.`, "*"); toast(`Juniper let go of "${removed}" to make room`); } catch (error) { toast(error.message); } finally { button.disabled = false; button.textContent = "Juniper chooses"; }
}
// Final page setup: render saved state and start the Three.js world.
$("reset-button").addEventListener("click", () => {
  if (!window.confirm("Reset Juniper's local world and memories?")) return;
  narration.stop();
  localStorage.removeItem("juniper-state");
  localStorage.removeItem("juniper-self-research-enabled");
  localStorage.removeItem("juniper-self-research-interval");
  localStorage.removeItem("juniper-self-research-next");
  localStorage.removeItem("juniper-last-self-research-topic");
  localStorage.removeItem("juniper-last-ai-thought");
  localStorage.setItem("juniper-reset-generation", String(Date.now()));
  location.reload();
});

save();
render();
renderWorldObjects();
worldApi = createWorld({ worldSeed: state.worldSeed, objects: state.objects, onCaption: (caption) => { $("scene-caption").textContent = caption; }, onObjectClick: showObjectPanel, onLandmarkClick: showLandmarkPanel, onLandmarkVisit: recordLandmarkVisit, onWorldEvent: recordWorldEvent, onWorldTime: updateWorldTime, onAutonomousObject: autonomouslyInteract });
// Generation may relocate legacy objects; persist their new clear positions.
renderWorldObjects(); save();
// Refresh labels without rebuilding the UI (which would reset form selections).
setInterval(updateThoughtTimes, 15000);
document.addEventListener("visibilitychange", () => { if (!document.hidden) updateThoughtTimes(); });
$("return-juniper").addEventListener("click", () => {
  toast(worldApi.returnToStart() ? "Juniper returned to her starting area" : "Starting area is busy - try again shortly");
});
// The browser's back/forward cache freezes this page; do not dispose a world it
// intends to resume. A normal navigation releases GPU resources immediately.
window.addEventListener("pagehide", (event) => { if (!event.persisted) worldApi.dispose(); });
if (new URLSearchParams(location.search).has("debug")) window.juniperDebug = { metrics: worldApi.metrics };
setupSelfResearch();
void loadOllamaModels();
