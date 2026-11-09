// One player and a bounded queue keep discoveries from talking over each other.
// Resume the audio context during a click, before asynchronous speech arrives.
export function createBrowserSpeechAudio() {
  let context;
  return {
    unlock() { context ||= new AudioContext(); return context.resume(); },
    createAudio() {
      let source, cancelled = false;
      return {
        src: "", onended: null, onerror: null,
        async play() {
          if (!context || context.state !== "running") throw new Error("Enable sound first");
          const response = await fetch(this.src);
          const buffer = await context.decodeAudioData(await response.arrayBuffer());
          if (cancelled) return;
          source = context.createBufferSource(); source.buffer = buffer;
          source.connect(context.destination); source.onended = () => this.onended?.(); source.start();
        },
        pause() { cancelled = true; source?.stop(); },
      };
    },
  };
}
export function createNarration({ fetchAudio = fetch, createAudio = () => new Audio(), urls = URL, now = Date.now, onStatus = () => {} } = {}) {
  let enabled = false, generation = 0, active = null;
  const queue = [];
  function stop() {
    generation++;
    queue.length = 0;
    if (active) {
      active.controller.abort();
      active.audio?.pause();
      active.finish?.();
      if (active.url) urls.revokeObjectURL(active.url);
      active = null;
    }
  }
  async function drain() {
    if (!enabled || active) return;
    const item = queue.shift();
    if (!item) return;
    if (now() - item.createdAt > 60000) return drain();
    const token = generation;
    const current = { controller: new AbortController(), text: item.text };
    active = current;
    const timeout = setTimeout(() => current.controller.abort(), 20000);
    try {
      onStatus("Preparing Juniper's voice...");
      const response = await fetchAudio("/api/speech", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ text: item.text }), signal: current.controller.signal });
      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || `Speech request failed (${response.status}).`);
      }
      const blob = await response.blob();
      clearTimeout(timeout);
      if (!enabled || token !== generation) return;
      current.url = urls.createObjectURL(blob);
      current.audio = createAudio();
      current.audio.src = current.url;
      await new Promise((resolve, reject) => {
        current.finish = resolve;
        current.audio.onended = resolve;
        current.audio.onerror = () => reject(new Error("Audio unavailable"));
        Promise.resolve(current.audio.play()).catch(reject);
        onStatus("Juniper is speaking.");
      });
      if (token === generation) onStatus("Narration is on.");
    } catch (error) {
      if (token === generation) {
        queue.length = 0;
        onStatus(`${error.message || "Speech unavailable."} Click Enable sound to retry.`);
      }
    } finally {
      clearTimeout(timeout);
      if (current.url && token === generation) urls.revokeObjectURL(current.url);
      if (active === current) { active = null; void drain(); }
    }
  }
  return {
    setEnabled(value) { stop(); enabled = Boolean(value); onStatus(enabled ? "Narration is on." : "Narration is off."); },
    enqueue(text) {
      if (!enabled || typeof text !== "string" || !text.trim()) return;
      if (active?.text === text || queue.some((item) => item.text === text)) return;
      if (queue.length >= 2) queue.shift();
      queue.push({ text, createdAt: now() });
      void drain();
    },
    stop,
  };
}
