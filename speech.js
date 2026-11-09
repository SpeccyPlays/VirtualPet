// Speech has its own resource limit; it never enters the Ollama inference queue.
export function createSpeechHandler({ url, speaker = 3, timeoutMs = 15000, transport = (...args) => fetch(...args) }) {
  let busy = false;
  return async (req, res) => {
    const text = req.body?.text;
    if (typeof text !== "string" || !text.trim() || text.length > 1200) return res.status(400).json({ error: "Speech requires 1–1200 characters of text." });
    if (!Number.isInteger(speaker) || speaker < 0 || speaker > 3) return res.status(503).json({ error: "Invalid Piper speaker configuration." });
    if (busy) return res.status(429).json({ error: "Speech is busy." });
    busy = true;
    console.log(`[speech] Request accepted (speaker ${speaker}, ${text.length} characters).`);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    const cancel = () => { if (!res.writableEnded) controller.abort(); };
    res.on("close", cancel);
    try {
      const response = await transport(`${url.replace(/\/$/, "")}/synthesize`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ text: text.trim(), speaker_id: speaker }), signal: controller.signal });
      if (!response.ok) throw new Error("Piper failed");
      const audio = Buffer.from(await response.arrayBuffer());
      if (audio.length < 12 || audio.length > 10 * 1024 * 1024 || audio.toString("ascii", 0, 4) !== "RIFF" || audio.toString("ascii", 8, 12) !== "WAVE") throw new Error("Invalid audio");
      if (!res.destroyed) res.set("Cache-Control", "no-store").type("audio/wav").send(audio);
      console.log("[speech] Audio generated.");
    } catch {
      console.warn("[speech] Piper request failed or was cancelled.");
      if (!res.destroyed) res.status(503).json({ error: "Juniper's voice is unavailable. Check the local Piper service." });
    } finally { clearTimeout(timer); res.off("close", cancel); busy = false; }
  };
}
