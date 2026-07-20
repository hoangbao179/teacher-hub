import assert from "node:assert/strict";
import test from "node:test";
import {
  assertNonOverlappingRanges,
  isBillableAttendance,
  isEnrollmentEligible,
  resolvePolicyPrice,
} from "./lesson-domain";

test("historical enrollment eligibility includes the ending date", () => {
  assert.equal(isEnrollmentEligible("2026-07-01", null, "2026-07-10"), true);
  assert.equal(isEnrollmentEligible("2026-07-11", null, "2026-07-10"), false);
  assert.equal(isEnrollmentEligible("2026-07-01", "2026-07-10", "2026-07-10"), true);
  assert.equal(isEnrollmentEligible("2026-07-01", "2026-07-09", "2026-07-10"), false);
});

test("effective policy price handles class default, custom and free", () => {
  assert.equal(resolvePolicyPrice("CLASS_DEFAULT", null, 2_400_000), 2_400_000);
  assert.equal(resolvePolicyPrice("CUSTOM", 2_000_000, 2_400_000), 2_000_000);
  assert.equal(resolvePolicyPrice("FREE", null, 2_400_000), null);
});

test("overlapping effective ranges are rejected", () => {
  assert.throws(
    () => assertNonOverlappingRanges([
      { effectiveFrom: "2026-07-01", effectiveTo: "2026-07-15" },
      { effectiveFrom: "2026-07-15", effectiveTo: null },
    ]),
    /TUITION_POLICY_OVERLAP/,
  );
  assert.doesNotThrow(() => assertNonOverlappingRanges([
    { effectiveFrom: "2026-07-01", effectiveTo: "2026-07-14" },
    { effectiveFrom: "2026-07-15", effectiveTo: null },
  ]));
});

test("only present non-free attendance is billable", () => {
  assert.equal(isBillableAttendance("PRESENT", "CLASS_DEFAULT"), true);
  assert.equal(isBillableAttendance("PRESENT", "FREE"), false);
  assert.equal(isBillableAttendance("ABSENT", "CUSTOM"), false);
  assert.equal(isBillableAttendance("FREE", "CUSTOM"), false);
});
