import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.dirname(fileURLToPath(import.meta.url));
export function startupConfig(env) {
  const url = new URL(env.PIPER_URL || "http://127.0.0.1:5000");
  if (url.protocol !== "http:" || !["localhost", "127.0.0.1"].includes(url.hostname) || url.pathname !== "/" || url.username || url.password || url.search || url.hash) throw new Error("PIPER_URL must be a local HTTP address with no path or credentials.");
  const speaker = Number(env.PIPER_SPEAKER_ID ?? 3);
  if (!Number.isInteger(speaker) || speaker < 0 || speaker > 3) throw new Error("PIPER_SPEAKER_ID must be 0, 1, 2 or 3 for Semaine.");
  return {
    url: url.origin, host: url.hostname, port: url.port || "80", speaker,
    model: env.PIPER_MODEL || "en_GB-semaine-medium",
    data: path.resolve(root, env.PIPER_DATA_DIR || "data/piper"),
    python: path.resolve(root, env.PIPER_PYTHON || (process.platform === "win32" ? ".venv-piper/Scripts/python.exe" : ".venv-piper/bin/python")),
  };
}

export async function start() {
  // Load privately at runtime. Never print configuration contents or secrets.
  const dotenv = await import("dotenv");
  dotenv.config({ path: process.env.DOTENV_CONFIG_PATH || path.join(root, ".env") });
  const config = startupConfig(process.env);
  const children = new Set();
  let stopping = false;
  function stop(code = 0) {
    if (stopping) return;
    stopping = true;
    process.exitCode = code;
    for (const child of children) child.kill();
  }
  function launch(command, args, label) {
    const child = spawn(command, args, { cwd: root, env: process.env, stdio: "inherit", windowsHide: true });
    children.add(child);
    child.on("error", () => { console.error(`${label} could not start. Check its installation and configured path.`); stop(1); });
    child.on("exit", (code) => {
      children.delete(child);
      if (!stopping) { console.error(`${label} stopped (exit ${code ?? "signal"}).`); stop(code || 1); }
    });
    return child;
  }
  process.once("SIGINT", () => stop());
  process.once("SIGTERM", () => stop());
  try {
    async function probe() {
      let response;
      try { response = await fetch(`${config.url}/info`, { signal: AbortSignal.timeout(1500) }); }
      catch { return null; }
      if (!response.ok) throw new Error("The configured Piper port is occupied by a service without a working /info endpoint.");
      const info = await response.json();
      if (info.voice?.name !== config.model || info.voice?.num_speakers <= config.speaker) throw new Error("The existing Piper service has the wrong voice or speaker range. Stop it and rerun npm start.");
      return info;
    }
    if (await probe()) console.log("Using the existing Piper service; it will stay running when Juniper stops.");
    else {
      if (!existsSync(config.python)) throw new Error("Piper Python environment is missing. See PIPER_SETUP.md.");
      if (!existsSync(path.join(config.data, `${config.model}.onnx`)) || !existsSync(path.join(config.data, `${config.model}.onnx.json`))) throw new Error("Piper voice files are missing. See PIPER_SETUP.md.");
      launch(config.python, ["-m", "piper.http_server", "-m", config.model, "--data-dir", config.data, "--host", config.host, "--port", config.port, "--speaker", String(config.speaker)], "Piper");
      const deadline = Date.now() + 30000;
      let ready = false;
      while (!stopping && Date.now() < deadline) {
        if (await probe()) { ready = true; break; }
        await new Promise((resolve) => setTimeout(resolve, 300));
      }
      if (!ready || stopping) throw new Error("Piper did not become ready within 30 seconds.");
    }
    // Check actual synthesis, explicitly selecting the same speaker as server.js.
    const response = await fetch(`${config.url}/synthesize`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ text: "Juniper's voice is ready.", speaker_id: config.speaker }), signal: AbortSignal.timeout(20000) });
    const audio = Buffer.from(await response.arrayBuffer());
    if (!response.ok || audio.toString("ascii", 0, 4) !== "RIFF" || audio.toString("ascii", 8, 12) !== "WAVE") throw new Error("Piper's speech check failed; Node was not started.");
    if (stopping) return;
    console.log(`Piper speech verified: ${config.model}, speaker ${config.speaker} (CPU). Starting Juniper...`);
    launch(process.execPath, ["server.js"], "Juniper");
  } catch (error) { console.error(error.message); stop(1); }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await start();
