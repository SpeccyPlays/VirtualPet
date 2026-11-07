// One inference at a time keeps a small local model responsive. Priority only
// changes waiting work: an already-running inference is allowed to finish.
export class AIQueue {
  constructor({ limit = 12, now = Date.now } = {}) {
    this.limit = limit;
    this.now = now;
    this.waiting = [];
    this.running = false;
  }
  run(task, { priority = 0, ttl = 120000 } = {}) {
    if (this.waiting.length >= this.limit) return Promise.reject(Object.assign(new Error("Juniper has too much to consider. Try again shortly."), { status: 429 }));
    return new Promise((resolve, reject) => {
      this.waiting.push({ task, priority, expires: this.now() + ttl, resolve, reject });
      this.waiting.sort((a, b) => b.priority - a.priority);
      void this.drain();
    });
  }
  async drain() {
    if (this.running) return;
    this.running = true;
    while (this.waiting.length) {
      const job = this.waiting.shift();
      try {
        if (this.now() > job.expires) throw Object.assign(new Error("This observation is no longer current."), { status: 408 });
        job.resolve(await job.task());
      } catch (error) { job.reject(error); }
    }
    this.running = false;
  }
}
