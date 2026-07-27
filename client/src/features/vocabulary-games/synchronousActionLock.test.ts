/// <reference types="node" />
import assert from "node:assert/strict";
import test from "node:test";
import { SynchronousActionLock } from "./synchronousActionLock";

test("start and replay actions accept only one synchronous click until released", () => {
  const lock = new SynchronousActionLock();
  assert.equal(lock.tryLock(), true);
  assert.equal(lock.tryLock(), false);
  lock.release();
  assert.equal(lock.tryLock(), true);
});
