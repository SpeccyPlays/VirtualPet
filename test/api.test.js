import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";

test("HTTP routes share cooldown, keep event inference local, and hide private files", async () => {
  const dir = mkdtempSync(path.join(os.tmpdir(), "juniper-api-"));
  process.env.RESEARCH_SCHEDULE_FILE = path.join(dir, "schedule.json");
  const nativeFetch = globalThis.fetch;
  let searches = 0, inferences = 0;
  // Stub only external services; all application requests use a real HTTP server.
  globalThis.fetch = async (url, options) => {
    if (String(url).includes("duckduckgo.com")) { searches++; return new Response('<a class="result__a" href="https://example.com/birds">Bird research</a><div class="result__snippet">Birds have feathers.</div>'); }
    if (String(url).endsWith("/api/chat")) {
      inferences++;
      return Response.json({ message: { content: JSON.stringify({ summary: "Birds have feathers.", thought: "Those feathers reveal a remarkable structure.", sourceIds: [1] }) } });
    }
    return nativeFetch(url, options);
  };
  let server;
  try {
    const { app } = await import("../server.js");
    server = app.listen(0, "127.0.0.1"); await new Promise((resolve) => server.once("listening", resolve));
    const base = `http://127.0.0.1:${server.address().port}`;
    const post = (endpoint, body) => nativeFetch(base + endpoint, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
    assert.equal((await nativeFetch(base + "/server.js")).status, 404);
    assert.equal((await nativeFetch(base + "/.env")).status, 404);
    assert.equal((await nativeFetch(base + "/vendor/three/build/three.module.js")).status, 200);
    assert.equal((await nativeFetch(base + "/movement.js")).status, 200);
    assert.equal((await post("/api/research", { query: "" })).status, 400);
    const research = await post("/api/research", { query: "Birds", intervalMs: 60000 });
    assert.equal(research.status, 200);
    const answer = await research.json(); assert.ok(answer.retryAfterMs >= 299000);
    const blocked = await post("/api/self-research", { query: "Birds", override: true }); assert.equal(blocked.status, 429);
    assert.equal(searches, 1);
    const event = { id: "bird-1", createdAt: Date.now(), description: "A pigeon pecks at the pavement.", location: "High Street" };
    const reaction = await post("/api/event-reaction", { event, interests: ["Birds"] }); assert.equal(reaction.status, 200); assert.equal((await reaction.json()).eventId, event.id);
    assert.equal(searches, 1); assert.equal(inferences, 2);
    assert.equal((await post("/api/event-reaction", { event: { ...event, createdAt: Date.now() - 100000 } })).status, 400);
  } finally {
    globalThis.fetch = nativeFetch;
    if (server) await new Promise((resolve) => server.close(resolve));
    rmSync(dir, { recursive: true, force: true });
  }
});
