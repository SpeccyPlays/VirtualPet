import { readFileSync, mkdirSync, writeFileSync, renameSync } from "node:fs";
import path from "node:path";
import { researchInterval } from "./research-policy.js";

// The local app has one Juniper, so all tabs and both endpoints share one gate.
// Write before starting work; a crash must not silently erase the cooldown.
export function createResearchGate(filename, minimum, now = Date.now) {
  let nextAllowedAt = 0;
  let busy = false;
  let intervalMs = researchInterval(minimum);
  try {
    const saved = JSON.parse(readFileSync(filename, "utf8"));
    nextAllowedAt = Number(saved.nextAllowedAt) || 0;
    intervalMs = Math.max(intervalMs, researchInterval(saved.intervalMs));
  } catch (error) {
    if (error.code !== "ENOENT") console.warn("Research schedule could not be restored:", error.message);
  }
  function persist() {
    mkdirSync(path.dirname(filename), { recursive: true });
    writeFileSync(`${filename}.tmp`, JSON.stringify({ nextAllowedAt, intervalMs }));
    renameSync(`${filename}.tmp`, filename);
  }
  const status = () => ({ busy, nextAllowedAt: new Date(nextAllowedAt).toISOString(), retryAfterMs: Math.max(0, nextAllowedAt - now()), intervalMs });
  return {
    status,
    begin(requested) {
      if (busy || now() < nextAllowedAt) return false;
      intervalMs = Math.max(researchInterval(minimum), researchInterval(requested));
      nextAllowedAt = now() + intervalMs;
      persist();
      busy = true;
      return true;
    },
    finish() {
      nextAllowedAt = now() + intervalMs;
      try { persist(); } finally { busy = false; }
      return status();
    },
  };
}
