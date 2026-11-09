import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import os from "node:os";
import path from "node:path";

test("no-source self research proposes a replacement and still enforces completion cooldown", async () => {
  const dir = mkdtempSync(path.join(os.tmpdir(), "juniper-no-sources-"));
  process.env.RESEARCH_SCHEDULE_FILE = path.join(dir, "schedule.json");
  const nativeFetch = globalThis.fetch;
  let inferences = 0;
  globalThis.fetch = async (url, options) => {
    if (String(url).includes("duckduckgo.com")) return new Response("<html>No results</html>");
    if (String(url).endsWith("/api/chat")) {
      inferences++;
      assert.match(JSON.parse(options.body).messages.at(-1).content, /NO sources/);
      return Response.json({ message: { content: JSON.stringify({ action: "add", interest: "Bird migration", reason: "I will try a concrete question." }) } });
    }
    return nativeFetch(url, options);
  };
  let server;
  try {
    const { app } = await import("../server.js");
    server = app.listen(0, "127.0.0.1"); await new Promise((resolve) => server.once("listening", resolve));
    const base = `http://127.0.0.1:${server.address().port}`;
    const post = (body) => nativeFetch(base + "/api/self-research", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
    const response = await post({ query: "Communication", interests: ["Communication", "Earth"], intervalMs: 120000 });
    assert.equal(response.status, 404);
    const data = await response.json();
    assert.match(data.error, /No web sources/);
    assert.equal(data.interestUpdate.action, "replace"); assert.equal(data.interestUpdate.removeInterest, "Communication");
    assert.equal(data.interestUpdate.interest, "Bird migration");
    assert.ok(Date.parse(data.nextAllowedAt) > Date.now()); assert.equal(inferences, 1);
    assert.equal((await post({ query: "Bird migration" })).status, 429);
  } finally {
    globalThis.fetch = nativeFetch;
    if (server) await new Promise((resolve) => server.close(resolve));
    rmSync(dir, { recursive: true, force: true });
  }
});
