// Shared browser/server policy. A research session may use several model calls;
// the pause applies between sessions, so event reactions can still run.
export const MIN_RESEARCH_MS = 5 * 60 * 1000;
export const RESEARCH_INTERVALS = [MIN_RESEARCH_MS, 600000, 900000, 1800000];
export function researchInterval(value) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.max(MIN_RESEARCH_MS, Math.min(number, 1800000)) : MIN_RESEARCH_MS;
}
