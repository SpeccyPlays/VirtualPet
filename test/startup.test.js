import test from "node:test";
import assert from "node:assert/strict";
import { startupConfig } from "../start.js";

test("startup defaults and overrides select the speech service and speaker", () => {
  assert.equal(startupConfig({}).speaker, 3);
  const config = startupConfig({ PIPER_URL: "http://127.0.0.1:5090", PIPER_SPEAKER_ID: "2", PIPER_DATA_DIR: "data/other" });
  assert.equal(config.port, "5090"); assert.equal(config.speaker, 2); assert.match(config.data, /other$/);
});
test("startup rejects remote services and invalid speakers", () => {
  for (const PIPER_URL of ["https://127.0.0.1:5000", "http://example.com:5000", "http://127.0.0.1:5000/path"]) assert.throws(() => startupConfig({ PIPER_URL }));
  for (const PIPER_SPEAKER_ID of ["-1", "4", "banana", "1.5"]) assert.throws(() => startupConfig({ PIPER_SPEAKER_ID }));
});
