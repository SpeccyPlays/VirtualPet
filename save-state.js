// Do not reset the seed just because the rendering/generation algorithm changed.
// Keep a separate data version for future migrations of the *saved data* shape.
export const GENERATOR_VERSION = 5;
export function restoreState(raw, defaults, makeSeed) {
  let saved;
  try { saved = JSON.parse(raw || "null"); } catch { saved = null; }
  const state = { ...structuredClone(defaults), ...(saved && typeof saved === "object" && !Array.isArray(saved) ? saved : {}) };
  for (const key of ["interests", "removedInterests", "researchHistory", "researchJournal", "memories", "discoveredLandmarks", "worldEvents", "objects", "thoughts"]) {
    if (!Array.isArray(state[key])) state[key] = structuredClone(defaults[key] || []);
  }
  state.objects = state.objects.filter((item) => item && typeof item.id === "string" && Number.isFinite(item.x) && Number.isFinite(item.z));
  // Legacy saves contain display strings rather than dates. Their real ages
  // cannot be recovered: preserve the thoughts and mark the time as unknown.
  state.thoughts = state.thoughts.filter((item) => item && typeof item.text === "string").map((item) => ({ ...item, icon: String(item.icon || "*"), createdAt: Number.isFinite(item.createdAt) && item.createdAt >= 0 ? item.createdAt : null }));
  state.discoveredLandmarks = state.discoveredLandmarks.filter((item) => item && typeof item.id === "string" && typeof item.name === "string");
  state.researchHistory = state.researchHistory.filter((item) => typeof item === "string");
  state.removedInterests = state.removedInterests.filter((item) => typeof item === "string");
  state.worldEvents = state.worldEvents.filter((item) => item && typeof item.id === "string");
  state.memories = state.memories.filter((item) => item && typeof item.text === "string");
  if (!Number.isInteger(state.worldSeed)) state.worldSeed = makeSeed();
  state.saveVersion = 2;
  state.generatorVersion = GENERATOR_VERSION;
  return state;
}

export function thoughtAge(thought, index, now = Date.now()) {
  if (!Number.isFinite(thought.createdAt)) return "Earlier";
  const seconds = Math.max(0, Math.floor((now - thought.createdAt) / 1000));
  if (seconds < 60) {
    if (index === 0) return "Just now";
    const age = Math.max(1, seconds);
    return `${age} second${age === 1 ? "" : "s"} ago`;
  }
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? "" : "s"} ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"} ago`;
  const days = Math.floor(hours / 24);
  return `${days} day${days === 1 ? "" : "s"} ago`;
}
