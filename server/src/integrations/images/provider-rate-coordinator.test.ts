import assert from "node:assert/strict";
import test from "node:test";
import { AppError } from "../../errors/app-error";
import { InMemoryProviderRateCoordinator } from "./provider-rate-coordinator";

test("provider coordinator does not call upstream during shared cooldown", async () => {
  let now = 1_000;
  let calls = 0;
  const coordinator = new InMemoryProviderRateCoordinator(0, () => now);
  await assert.rejects(coordinator.run("PIXABAY", async () => {
    calls += 1;
    throw new AppError(429, "IMAGE_PROVIDER_RATE_LIMITED", "limited", undefined, 10);
  }));
  await assert.rejects(coordinator.run("PIXABAY", async () => { calls += 1; }),
    (error: unknown) => (error as { retryAfterSeconds?: number }).retryAfterSeconds === 10);
  assert.equal(calls, 1);
  now += 10_000;
  await coordinator.run("PIXABAY", async () => { calls += 1; });
  assert.equal(calls, 2);
});

test("provider coordinator serializes and waits for its internal interval instead of returning 429", async () => {
  let now = 1_000;
  const waits: number[] = [];
  const calls: number[] = [];
  const coordinator = new InMemoryProviderRateCoordinator(350, () => now, async (milliseconds) => {
    waits.push(milliseconds);
    now += milliseconds;
  });
  await coordinator.run("PIXABAY", async () => { calls.push(now); });
  await coordinator.run("PIXABAY", async () => { calls.push(now); });
  assert.deepEqual(calls, [1_000, 1_350]);
  assert.deepEqual(waits, [350]);
});

test("provider coordinator never overlaps provider calls", async () => {
  const coordinator = new InMemoryProviderRateCoordinator(0);
  let release!: () => void;
  const firstDone = new Promise<void>((resolve) => { release = resolve; });
  const order: string[] = [];
  const first = coordinator.run("PIXABAY", async () => { order.push("first-start"); await firstDone; order.push("first-end"); });
  const second = coordinator.run("PIXABAY", async () => { order.push("second"); });
  await Promise.resolve();
  assert.deepEqual(order, ["first-start"]);
  release();
  await Promise.all([first, second]);
  assert.deepEqual(order, ["first-start", "first-end", "second"]);
});

test("provider coordinator opens an isolated 30-second circuit after two consecutive outages", async () => {
  let now = 1_000;
  let arasaacCalls = 0;
  let pixabayCalls = 0;
  const coordinator = new InMemoryProviderRateCoordinator(0, () => now);
  const fail = async () => {
    arasaacCalls += 1;
    throw new AppError(503, "IMAGE_PROVIDER_UNAVAILABLE", "down", {
      provider: "ARASAAC", operation: "SEARCH", upstreamStatus: 503,
    });
  };
  await assert.rejects(coordinator.run("ARASAAC", fail));
  await assert.rejects(coordinator.run("ARASAAC", fail),
    (error: unknown) => error instanceof AppError && error.retryAfterSeconds === 30);
  await assert.rejects(coordinator.run("ARASAAC", async () => { arasaacCalls += 1; }),
    (error: unknown) => error instanceof AppError &&
      error.code === "IMAGE_PROVIDER_UNAVAILABLE" && error.retryAfterSeconds === 30 &&
      (error.details as { reason?: string }).reason === "CIRCUIT_OPEN");
  assert.equal(arasaacCalls, 2);
  await coordinator.run("PIXABAY", async () => { pixabayCalls += 1; });
  assert.equal(pixabayCalls, 1);
  assert.equal(coordinator.cooldownUntil("ARASAAC")?.getTime(), 31_000);
  now += 30_000;
  await coordinator.run("ARASAAC", async () => { arasaacCalls += 1; });
  assert.equal(arasaacCalls, 3);
  assert.equal(coordinator.cooldownUntil("ARASAAC"), null);
});

test("provider coordinator resets consecutive outage count after success", async () => {
  const coordinator = new InMemoryProviderRateCoordinator(0);
  const outage = () => Promise.reject(new AppError(503, "IMAGE_PROVIDER_UNAVAILABLE", "down"));
  await assert.rejects(coordinator.run("ARASAAC", outage));
  await coordinator.run("ARASAAC", async () => "ok");
  await assert.rejects(coordinator.run("ARASAAC", outage),
    (error: unknown) => error instanceof AppError && error.retryAfterSeconds === undefined);
});
