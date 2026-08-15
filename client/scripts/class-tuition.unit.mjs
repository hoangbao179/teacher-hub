import assert from "node:assert/strict";
import test from "node:test";
import { hasConfiguredClassTuition } from "../src/features/class-tuition.ts";

test("zero class price is displayed as not configured rather than a zero-value package", () => {
  assert.equal(hasConfiguredClassTuition(0), false);
  assert.equal(hasConfiguredClassTuition(1_200_000), true);
});
