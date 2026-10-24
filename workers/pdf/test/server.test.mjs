import assert from "node:assert/strict";
import { once } from "node:events";
import test from "node:test";
import { createWorkerServer, startWorker } from "../src/server.mjs";

test("HTTP health and unsupported requests through a real listener", async (t) => {
  const server = createWorkerServer();
  t.after(() => new Promise((resolve) => server.close(resolve)));
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const origin = `http://127.0.0.1:${server.address().port}`;
  const health = await fetch(`${origin}/health`);
  assert.equal(health.status, 200);
  assert.deepEqual(await health.json(), { status: "ok" });
  assert.equal(health.headers.get("cache-control"), "no-store");
  const head = await fetch(`${origin}/health`, { method: "HEAD" });
  assert.equal(head.status, 200);
  assert.equal(await head.text(), "");
  for (const [path, method] of [["/health", "POST"], ["/", "GET"], ["/jobs", "POST"], ["/pdf", "GET"]]) {
    const response = await fetch(`${origin}${path}`, { method });
    assert.equal(response.status, 404);
    assert.deepEqual(await response.json(), { error: "not_found" });
  }
});

test("invalid runtime PORT fails before opening a listener", () => {
  for (const port of ["", "0", "-1", "65536", "8080oops", "1.5"]) {
    assert.throws(() => startWorker(port), /PORT must be an integer/);
  }
});

test("shutdown drains and exits successfully", async () => {
  const { spawn } = await import('node:child_process');
  const child = spawn(process.execPath, ['--input-type=module', '-e', `
    import { createServer } from 'node:net';
    import { startWorker } from './src/server.mjs';
    const probe = createServer();
    probe.listen(0, '127.0.0.1', () => {
      const port = probe.address().port;
      probe.close(() => {
        const server = startWorker(port);
        server.on('listening', () => process.emit('SIGTERM'));
      });
    });
  `], { stdio: 'pipe' });
  const [code] = await once(child, 'exit');
  assert.equal(code, 0);
});
