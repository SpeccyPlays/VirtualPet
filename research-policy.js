// Shared browser/server policy. A research session may use several model calls;
// the pause applies between sessions, so event reactions can still run.
export const DEFAULT_RESEARCH_MS = 5 * 60 * 1000;
export const RESEARCH_INTERVALS = [120000, 300000, 600000, 900000, 1800000];
export function researchInterval(value, fallback = DEFAULT_RESEARCH_MS) {
  const number = Number(value);
  return value !== null && value !== "" && Number.isSafeInteger(number) && number > 0 ? number : fallback;
}
