// Disposable local container supervisor. Metrics include the test runner + fixture servers + qpdf.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { spawn } from 'node:child_process';
import { once } from 'node:events';

assert.equal(readFileSync('/sys/fs/cgroup/memory.max', 'utf8').trim(), '2147483648');
assert.equal(readFileSync('/sys/fs/cgroup/cpu.max', 'utf8').trim(), '100000 100000');
const cpu = () => Number(readFileSync('/sys/fs/cgroup/cpu.stat', 'utf8').match(/usage_usec (\d+)/)[1]);
const startCPU = cpu(); const start = performance.now();
const child = spawn(process.execPath, ['--test', 'test/server.test.mjs', 'test/processing.test.mjs', 'test/storage.test.mjs'], { stdio: 'inherit' });
const timeout = setTimeout(() => child.kill('SIGKILL'), 45000);
const [code] = await once(child, 'exit'); clearTimeout(timeout);
console.log(JSON.stringify({ kind: 'local-fixture-suite', exitCode: code,
  wallSeconds: (performance.now() - start) / 1000, cpuSeconds: (cpu() - startCPU) / 1e6,
  cgroupPeakBytes: Number(readFileSync('/sys/fs/cgroup/memory.peak', 'utf8')) }));
process.exitCode = code ?? 1;
