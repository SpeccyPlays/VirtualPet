import { readFileSync, mkdirSync, writeFileSync, renameSync } from "node:fs";
import path from "node:path";
import { researchInterval } from "./research-policy.js";

// The local app has one Juniper, so all tabs and both endpoints share one gate.
// Write before starting work; a crash must not silently erase the cooldown.
export function createResearchGate(filename, configuredInterval, now = Date.now) {
  let nextAllowedAt = 0;
  let busy = false;
  let phase = "idle";
  let intervalMs = researchInterval(configuredInterval);
  try {
    const saved = JSON.parse(readFileSync(filename, "utf8"));
    nextAllowedAt = Number(saved.nextAllowedAt) || 0;
    intervalMs = researchInterval(saved.intervalMs, intervalMs);
  } catch (error) {
    if (error.code !== "ENOENT") console.warn("Research schedule could not be restored:", error.message);
  }
  function persist() {
    mkdirSync(path.dirname(filename), { recursive: true });
    writeFileSync(`${filename}.tmp`, JSON.stringify({ nextAllowedAt, intervalMs }));
    renameSync(`${filename}.tmp`, filename);
  }
  const status = () => ({ busy, phase, nextAllowedAt: new Date(nextAllowedAt).toISOString(), retryAfterMs: Math.max(0, nextAllowedAt - now()), intervalMs });
  return {
    status,
    setPhase(value) { if (busy && ["researching", "thinking"].includes(value)) phase = value; },
    begin(requested) {
      if (busy || now() < nextAllowedAt) return false;
      intervalMs = researchInterval(requested, researchInterval(configuredInterval));
      nextAllowedAt = now() + intervalMs;
      persist();
      busy = true;
      phase = "researching";
      return true;
    },
    finish() {
      nextAllowedAt = now() + intervalMs;
      try { persist(); } finally { busy = false; phase = "idle"; }
      return status();
    },
  };
}
