import { createWorld } from "./world.js";

const MIN_INTERESTS = 3;
const MAX_INTERESTS = 10;
const DEFAULT_STATE = {
  stats: { energy: 72, happiness: 84, curiosity: 91 },
  level: 3,
  interests: ["Mushrooms after rain", "The language of crows", "Moon gardens", "Tiny architecture"],
  removedInterests: [],
  researchHistory: [],
  objects: [
    { id: "fountain-1", type: "fountain", name: "The little fountain", description: "A quiet fountain catching the Lantern District's light.", x: 11, z: 6, createdBy: "city" },
    { id: "bench-1", type: "bench", name: "Rainy day bench", description: "A warm wooden bench where Juniper can pause and watch the street.", x: -8, z: 6.5, createdBy: "city" },
    { id: "garden-1", type: "garden", name: "Moon garden", description: "A small patch of flowers that seems to glow after sunset.", x: -16, z: 5, createdBy: "juniper" },
  ],
  thoughts: [
    { text: "The city smells different after the rain. I wonder who lives above the bakery.", icon: "*", time: "Just now" },
    { text: "I saw a crow carrying a blue thread. A very purposeful bird.", icon: "o", time: "18 min ago" },
    { text: "Today feels like a good day to learn something new.", icon: "~", time: "1 hr ago" },
  ],
};
const $ = (id) => document.getElementById(id);
const saved = JSON.parse(localStorage.getItem("juniper-state") || "null");
const state = { ...structuredClone(DEFAULT_STATE), ...(saved || {}) };
state.stats = { ...DEFAULT_STATE.stats, ...(saved?.stats || {}) };
state.interests = Array.isArray(state.interests) ? state.interests.filter((item) => typeof item === "string" && item.trim()).map((item) => item.trim()) : [];
state.removedInterests = Array.isArray(state.removedInterests) ? state.removedInterests : [];
state.researchHistory = Array.isArray(state.researchHistory) ? state.researchHistory : [];
state.objects = Array.isArray(state.objects) ? state.objects : structuredClone(DEFAULT_STATE.objects);
state.thoughts = Array.isArray(state.thoughts) ? state.thoughts : [];
state.interests = [...new Map(state.interests.map((item) => [item.toLowerCase(), item])).values()];
if (state.interests.length > MAX_INTERESTS) { state.removedInterests.push(...state.interests.slice(MAX_INTERESTS)); state.interests = state.interests.slice(0, MAX_INTERESTS); }
for (const fallback of DEFAULT_STATE.interests) { if (state.interests.length >= MIN_INTERESTS) break; if (!state.interests.some((item) => item.toLowerCase() === fallback.toLowerCase())) state.interests.push(fallback); }

function save() { localStorage.setItem("juniper-state", JSON.stringify(state)); $("save-status").textContent = "Saved just now"; setTimeout(() => ($("save-status").textContent = "Saved locally"), 1800); }
function escapeHtml(value) { const div = document.createElement("div"); div.textContent = value; return div.innerHTML; }
function render() {
  ["energy", "happiness", "curiosity"].forEach((key) => { $(`${key}-value`).textContent = `${state.stats[key]}%`; $(`${key}-bar`).style.width = `${state.stats[key]}%`; });
  $("level").textContent = state.level;
  $("interest-list").innerHTML = state.interests.map((item, index) => `<span class="interest">${escapeHtml(item)}<button class="remove-interest" data-interest-index="${index}" aria-label="Remove ${escapeHtml(item)}" title="Remove interest">x</button></span>`).join("");
  $("research-topic").innerHTML = state.interests.map((item) => `<option>${escapeHtml(item)}</option>`).join("");
  $("thought-count").textContent = `${state.thoughts.length} entries`;
  $("thought-list").innerHTML = state.thoughts.map((thought) => `<article class="thought"><span class="thought-icon">${escapeHtml(thought.icon)}</span><span>${escapeHtml(thought.text)}</span><time>${thought.time}</time></article>`).join("");
}
function addThought(text, icon = "*") { state.thoughts.unshift({ text, icon, time: "Just now" }); state.thoughts = state.thoughts.slice(0, 12); render(); save(); }
async function addGeneratedThought(fallback, context, icon = "*", markWake = false) {
  let thought = fallback;
  try { const model = $("model-select").value; if (!model) throw new Error("No model"); const response = await fetch("/api/thought", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ model, context }) }); const data = await response.json(); if (!response.ok || !data.thought) throw new Error(data.error || "Thought generation failed"); thought = data.thought; } catch { /* Fallback keeps Juniper expressive when Ollama is offline. */ }
  addThought(thought, icon); if (markWake) localStorage.setItem("juniper-last-ai-thought", String(Date.now()));
}
function toast(message) { $("toast").textContent = message; $("toast").classList.add("visible"); setTimeout(() => $("toast").classList.remove("visible"), 2600); }
const OBJECT_TYPES = {
  fountain: { actions: [{ label: "Watch the water", effect: { happiness: 3, curiosity: 2 }, thought: "The fountain is making tiny rainbows. I could watch it forever." }, { label: "Play nearby", effect: { happiness: 5, energy: -2 }, thought: "The fountain splashed my paws. The whole city feels playful now." }] },
  bench: { actions: [{ label: "Rest here", effect: { happiness: 2, energy: 8 }, thought: "A quiet bench is a good place to let my thoughts settle." }, { label: "Inspect it", effect: { curiosity: 3 }, thought: "Someone built this bench for people who need a small pause." }] },
  garden: { actions: [{ label: "Smell the flowers", effect: { happiness: 4 }, thought: "The flowers smell like a secret the moon has been keeping." }, { label: "Tend the garden", effect: { curiosity: 2, energy: -1 }, thought: "A little water and patience can make a place feel alive." }] },
  birdhouse: { actions: [{ label: "Listen for birds", effect: { curiosity: 4 }, thought: "I heard a flutter inside the birdhouse. Someone may be moving in." }, { label: "Watch quietly", effect: { happiness: 2 }, thought: "The best way to meet a bird is to wait and let it choose the moment." }] },
  lantern: { actions: [{ label: "Light it", effect: { happiness: 2 }, thought: "The lantern makes this corner feel like a tiny room under the stars." }, { label: "Study the design", effect: { curiosity: 2 }, thought: "Even a small lantern can change the shape of a whole street." }] },
  sculpture: { actions: [{ label: "Admire it", effect: { curiosity: 4 }, thought: "Someone turned a strange idea into something we can walk around." }] },
};
let worldApi;
function renderWorldObjects() { $("world-object-list").innerHTML = state.objects.map((object) => `<button class="world-object-tag" data-world-object-id="${escapeHtml(object.id)}" title="Show ${escapeHtml(object.name)} in the city"><span>${escapeHtml(object.name)}</span><small>${escapeHtml(object.type)} · ${object.x}, ${object.z}</small></button>`).join(""); }
function closeObjectPanel() { $("object-panel").hidden = true; }
function autonomouslyInteract(objectId) {
  const object = state.objects.find((item) => item.id === objectId); if (!object) return;
  const definition = OBJECT_TYPES[object.type] || OBJECT_TYPES.sculpture; const action = definition.actions[Math.floor(Math.random() * definition.actions.length)];
  Object.entries(action.effect).forEach(([key, amount]) => { state.stats[key] = Math.max(0, Math.min(100, state.stats[key] + amount)); });
  addThought(action.thought, "*"); $("scene-caption").textContent = `Juniper is ${action.label.toLowerCase()} at ${object.name}`; toast(`Juniper ${action.label.toLowerCase()}`);
}
function showObjectPanel(objectId) {
  const object = state.objects.find((item) => item.id === objectId); if (!object) return;
  const definition = OBJECT_TYPES[object.type] || OBJECT_TYPES.sculpture;
  $("object-name").textContent = object.name; $("object-description").textContent = object.description; $("object-actions").innerHTML = definition.actions.map((action, index) => `<button data-object-action="${index}">${escapeHtml(action.label)}</button>`).join("") + `<button data-object-action="remove">Pack away</button>`; $("object-panel").hidden = false;
  $("object-actions").onclick = (event) => {
    const button = event.target.closest("[data-object-action]"); if (!button) return;
    if (button.dataset.objectAction === "remove") { if (object.createdBy === "city" && !window.confirm("Let Juniper pack away this city fixture?")) return; state.objects.splice(state.objects.findIndex((item) => item.id === object.id), 1); worldApi.removeObject(object.id); renderWorldObjects(); save(); closeObjectPanel(); toast(`${object.name} was packed away`); return; }
    const action = definition.actions[Number(button.dataset.objectAction)]; Object.entries(action.effect).forEach(([key, amount]) => { state.stats[key] = Math.max(0, Math.min(100, state.stats[key] + amount)); }); addThought(action.thought, "*"); $("scene-caption").textContent = `Juniper is interacting with ${object.name}`; toast(action.label); closeObjectPanel();
  };
}
$("object-close").addEventListener("click", closeObjectPanel);
$("world-object-list").addEventListener("click", (event) => {
  const button = event.target.closest("[data-world-object-id]"); if (!button) return;
  const objectId = button.dataset.worldObjectId; const object = state.objects.find((item) => item.id === objectId); if (!object || !worldApi?.focusObject(objectId)) return;
  $("world").scrollIntoView({ behavior: "smooth", block: "start" }); showObjectPanel(objectId);
});
function rememberResearch(query) { state.researchHistory = [...state.researchHistory.filter((item) => item.toLowerCase() !== query.toLowerCase()), query].slice(-20); save(); }
function researchContext() { return { researchHistory: state.researchHistory, removedInterests: state.removedInterests }; }
function showResearchResult(data) { $("research-summary").textContent = data.summary; const cited = data.sources.filter((source) => data.sourceIds.includes(source.id)); $("source-list").innerHTML = (cited.length ? cited : data.sources).map((source) => `<a class="source-link" href="${escapeHtml(source.url)}" target="_blank" rel="noopener noreferrer">[${source.id}] ${escapeHtml(source.title)} -></a>`).join(""); $("research-result").hidden = false; }
async function loadOllamaModels() {
  try { const response = await fetch("/api/models"); if (!response.ok) throw new Error(); const data = await response.json(); $("model-select").innerHTML = data.models.map((model) => `<option value="${escapeHtml(model)}">${escapeHtml(model)}</option>`).join("") || '<option value="">No models installed</option>'; if (data.defaultModel && data.models.includes(data.defaultModel)) $("model-select").value = data.defaultModel; $("research-note").textContent = `${data.models.length} local Ollama model${data.models.length === 1 ? "" : "s"} available.`; if (Date.now() - Number(localStorage.getItem("juniper-last-ai-thought") || 0) > 300000) void addGeneratedThought("I wonder what small surprise the city is keeping for us today.", "Juniper is waking up and taking in the Lantern District.", "~", true); } catch { $("model-select").innerHTML = '<option value="">Ollama unavailable</option>'; $("research-note").textContent = "Ollama unavailable - start Ollama, then refresh this page."; }
}

document.querySelectorAll("[data-action]").forEach((button) => button.addEventListener("click", () => {
  const action = button.dataset.action;
  if (action === "feed") { state.stats.energy = Math.min(100, state.stats.energy + 10); state.stats.happiness = Math.min(100, state.stats.happiness + 4); $("mood-label").textContent = "Feeling pleasantly peckish"; $("scene-caption").textContent = "Juniper is nibbling a snack near the bakery"; void addGeneratedThought("The moonberries are sweet today. I saved the biggest one for you.", "Juniper just ate a snack near the bakery and feels pleasantly peckish.", "o"); toast("Juniper enjoyed the snack"); }
  if (action === "play") { state.stats.happiness = Math.min(100, state.stats.happiness + 9); state.stats.energy = Math.max(0, state.stats.energy - 6); $("mood-label").textContent = "Feeling bright and playful"; $("scene-caption").textContent = "Juniper is chasing a sunbeam down the street"; void addGeneratedThought("Playing is a form of research too. I learned that your laugh makes the streetlights wake up.", "Juniper is playing with her owner in the Lantern District.", "*"); toast("Juniper had a lovely time"); }
  if (action === "rest") { state.stats.energy = Math.min(100, state.stats.energy + 15); $("mood-label").textContent = "Feeling soft and sleepy"; $("scene-caption").textContent = "Juniper is resting in the little city park"; void addGeneratedThought("I am going to dream about the places we have not explored yet.", "Juniper is resting in the city park after a busy day.", "z"); toast("Juniper is resting"); }
  save();
}));

$("research-button").addEventListener("click", async () => {
  const query = $("research-topic").value; const model = $("model-select").value; if (!query || !model) return toast("Choose an interest and an available Ollama model");
  const button = $("research-button"); button.disabled = true; button.textContent = "Thinking..."; $("research-result").hidden = true;
  try { const response = await fetch("/api/research", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ query, model, ...researchContext() }) }); const data = await response.json(); if (!response.ok) throw new Error(data.error || "Research failed"); showResearchResult(data); rememberResearch(query); state.stats.curiosity = Math.min(100, state.stats.curiosity + 3); addThought(data.thought, "~"); toast(`Juniper researched "${query}" with ${model}`); } catch (error) { toast(error.message); } finally { button.disabled = false; button.textContent = "Research ->"; }
});

function formatCooldown(milliseconds) { const minutes = Math.max(1, Math.ceil(milliseconds / 60000)); return `${minutes} minute${minutes === 1 ? "" : "s"}`; }
function syncSelfResearchStatus(message) { $("self-research-status").textContent = message; }
function applyInterestUpdate(update) {
  if (!update || !["add", "remove", "keep"].includes(update.action)) return "";
  const candidate = String(update.interest || "").trim();
  if (update.action === "add" && candidate && state.interests.length < MAX_INTERESTS && !state.removedInterests.some((item) => item.toLowerCase() === candidate.toLowerCase()) && !state.interests.some((item) => item.toLowerCase() === candidate.toLowerCase())) { state.interests.push(candidate); render(); save(); return `Juniper added "${candidate}" to her interests.`; }
  if (update.action === "remove" && candidate && state.interests.length > MIN_INTERESTS) { const index = state.interests.findIndex((item) => item.toLowerCase() === candidate.toLowerCase()); if (index >= 0) { state.interests.splice(index, 1); state.removedInterests.push(candidate); render(); save(); return `Juniper removed "${candidate}" from her interests.`; } }
  return "";
}
function nextSelfResearchTopic() { const recent = state.researchHistory.slice(-3).map((item) => item.toLowerCase()); return state.interests.find((item) => !recent.includes(item.toLowerCase())) || ""; }
async function runSelfResearch(override = false) {
  if (!override && !$("self-research-toggle").checked) return;
  const query = override ? $("research-topic").value : nextSelfResearchTopic(); const model = $("model-select").value; if (!query || !model) return syncSelfResearchStatus("Juniper has no unrepeated interests to research right now.");
  const button = $("self-research-button"); button.disabled = true; syncSelfResearchStatus(override ? "Juniper is using her one-time override..." : "Juniper is looking something up...");
  try { const response = await fetch("/api/self-research", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ query, model, override, interests: state.interests, ...researchContext() }) }); const data = await response.json(); if (!response.ok) { if (response.status === 429) syncSelfResearchStatus(`Juniper's web cooldown is active. Try again in ${formatCooldown(data.retryAfterMs)}.`); throw new Error(data.error || "Self-research failed"); } showResearchResult(data); rememberResearch(query); state.stats.curiosity = Math.min(100, state.stats.curiosity + 3); addThought(data.thought, "~"); const change = applyInterestUpdate(data.interestUpdate); localStorage.setItem("juniper-self-research-next", data.nextAllowedAt); syncSelfResearchStatus(`${change || `Juniper kept "${query}" on her list.`} Next automatic check after ${new Date(data.nextAllowedAt).toLocaleTimeString()}.`); toast(change || `Juniper researched "${query}" on her own`); } catch (error) { if (!String(error.message).includes("breathing room")) syncSelfResearchStatus(error.message); } finally { button.disabled = false; }
}
$("self-research-toggle").addEventListener("change", () => { const enabled = $("self-research-toggle").checked; localStorage.setItem("juniper-self-research-enabled", String(enabled)); syncSelfResearchStatus(enabled ? "Self-research enabled. Juniper will avoid her most recent topics." : "Self-research is off. You remain in control of Juniper's outbound requests."); });
$("self-research-interval").addEventListener("change", () => localStorage.setItem("juniper-self-research-interval", $("self-research-interval").value));
$("self-research-button").addEventListener("click", () => runSelfResearch(false));
$("self-research-override").addEventListener("click", () => { if (window.confirm("Allow Juniper to make one web request now, even if her cooldown has not finished?")) void runSelfResearch(true); });
function setupSelfResearch() { $("self-research-toggle").checked = localStorage.getItem("juniper-self-research-enabled") === "true"; const savedInterval = localStorage.getItem("juniper-self-research-interval"); if (savedInterval) $("self-research-interval").value = savedInterval; syncSelfResearchStatus($("self-research-toggle").checked ? "Self-research enabled. Juniper will avoid her most recent topics." : "Self-research is off. You remain in control of Juniper's outbound requests."); setInterval(() => { if (!$("self-research-toggle").checked) return; const nextAllowed = Date.parse(localStorage.getItem("juniper-self-research-next") || ""); const interval = Number($("self-research-interval").value); if (!nextAllowed || Date.now() >= nextAllowed + Math.max(0, interval - 60000)) void runSelfResearch(false); }, 30000); }

$("add-interest").addEventListener("click", () => { const interest = window.prompt("What should Juniper be curious about?")?.trim(); if (!interest) return; state.interests.push(interest); state.removedInterests = state.removedInterests.filter((item) => item.toLowerCase() !== interest.toLowerCase()); render(); save(); void addGeneratedThought(`A new question arrived: "${interest}". I cannot wait to follow it.`, `Juniper has just discovered a new interest called "${interest}".`, "*"); toast("A new interest joined the city"); });
$("develop-interest").addEventListener("click", async () => { const model = $("model-select").value; if (!model) return toast("Choose an available Ollama model first"); const button = $("develop-interest"); button.disabled = true; button.textContent = "Thinking..."; try { const response = await fetch("/api/interest", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ model, interests: state.interests, thoughts: state.thoughts.map((thought) => thought.text), researchHistory: state.researchHistory, removedInterests: state.removedInterests }) }); const data = await response.json(); if (!response.ok) throw new Error(data.error || "Juniper could not develop an interest"); if (state.interests.some((item) => item.toLowerCase() === data.interest.toLowerCase()) || state.removedInterests.some((item) => item.toLowerCase() === data.interest.toLowerCase())) throw new Error("Juniper suggested a repeated or removed interest - try again"); state.interests.push(data.interest); render(); save(); addThought(data.reason, "*"); toast(`Juniper is now curious about ${data.interest}`); } catch (error) { toast(error.message); } finally { button.disabled = false; button.textContent = "Juniper chooses"; } });

$("world-decision-button").addEventListener("click", async () => {
  const model = $("model-select").value; if (!model) return toast("Choose an available Ollama model first");
  const button = $("world-decision-button"); button.disabled = true; button.textContent = "Thinking..."; $("world-decision-status").textContent = "Juniper is imagining a small change...";
  try {
    const response = await fetch("/api/world-decision", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ model, interests: state.interests, thoughts: state.thoughts.map((thought) => thought.text), objects: state.objects }) });
    const decision = await response.json(); if (!response.ok) throw new Error(decision.error || "Juniper could not decide");
    const allowedTypes = new Set(Object.keys(OBJECT_TYPES));
    if (decision.action === "add" && allowedTypes.has(decision.type) && decision.name && Number.isFinite(decision.x) && Number.isFinite(decision.z) && Math.abs(decision.x) <= 28 && Math.abs(decision.z) <= 20 && state.objects.length < 20) {
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
$("add-interest").addEventListener("click", (event) => { if (state.interests.length >= MAX_INTERESTS) { event.stopImmediatePropagation(); toast(`Juniper has ${MAX_INTERESTS} interests already - remove one first`); } }, true);
async function askJuniperToMakeRoom() {
  const button = $("develop-interest"); const model = $("model-select").value; if (!model) return toast("Choose an available Ollama model first");
  button.disabled = true; button.textContent = "Choosing...";
  try { const response = await fetch("/api/interest", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ model, interests: state.interests, thoughts: state.thoughts.map((thought) => thought.text), researchHistory: state.researchHistory, removedInterests: state.removedInterests }) }); const data = await response.json(); if (!response.ok) throw new Error(data.error || "Juniper could not choose an interest to release"); const index = state.interests.findIndex((item) => item.toLowerCase() === String(data.interest || "").toLowerCase()); if (data.action !== "remove" || index < 0 || index >= state.interests.length - MIN_INTERESTS) throw new Error("Juniper could not find a suitable interest to release"); const removed = state.interests.splice(index, 1)[0]; state.removedInterests.push(removed); render(); save(); addThought(data.reason || `I am making room by saying goodbye to ${removed} for now.`, "*"); toast(`Juniper let go of "${removed}" to make room`); } catch (error) { toast(error.message); } finally { button.disabled = false; button.textContent = "Juniper chooses"; }
}
$("develop-interest").addEventListener("click", (event) => { if (state.interests.length >= MAX_INTERESTS) { event.stopImmediatePropagation(); void askJuniperToMakeRoom(); } }, true);
$("reset-button").addEventListener("click", () => { if (window.confirm("Reset Juniper's local world and memories?")) { localStorage.removeItem("juniper-state"); location.reload(); } });

save();
render();
renderWorldObjects();
worldApi = createWorld({ objects: state.objects, onCaption: (caption) => { $("scene-caption").textContent = caption; }, onObjectClick: showObjectPanel, onAutonomousObject: autonomouslyInteract });
setupSelfResearch();
void loadOllamaModels();
