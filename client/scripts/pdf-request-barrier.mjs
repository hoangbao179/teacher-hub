// Test-only HTTP lifecycle control for the MySQL/FakeCloud browser fixture.
// Draining alone cannot prevent a queued browser request from arriving later.
export function createPdfRequestBarrier() {
  const pending = new Set();
  let paused = false;
  return {
    wrap(handler) {
      return (...args) => {
        if (paused) return Promise.resolve(args[1].sendStatus(503));
        const request = handler(...args);
        pending.add(request);
        void request.then(() => pending.delete(request), () => pending.delete(request));
        return request;
      };
    },
    pause() { paused = true; },
    resume() { paused = false; },
    get size() { return pending.size; },
    async drain() {
      while (pending.size) await Promise.all([...pending]);
    },
  };
}
