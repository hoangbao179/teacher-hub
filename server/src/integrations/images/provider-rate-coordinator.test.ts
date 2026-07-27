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
