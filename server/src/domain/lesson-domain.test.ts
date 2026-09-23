import assert from "node:assert/strict";
import test from "node:test";
import {
  isEnrollmentEligible,
  parseRuntimeAttendanceStatus,
} from "./lesson-domain";

test("historical enrollment eligibility includes the ending date", () => {
  assert.equal(isEnrollmentEligible("2026-07-01", null, "2026-07-10"), true);
  assert.equal(isEnrollmentEligible("2026-07-11", null, "2026-07-10"), false);
  assert.equal(isEnrollmentEligible("2026-07-01", "2026-07-10", "2026-07-10"), true);
  assert.equal(isEnrollmentEligible("2026-07-01", "2026-07-09", "2026-07-10"), false);
});

test("runtime attendance accepts only present and absent", () => {
  assert.equal(parseRuntimeAttendanceStatus("PRESENT"), "PRESENT");
  assert.equal(parseRuntimeAttendanceStatus("ABSENT"), "ABSENT");
  assert.throws(() => parseRuntimeAttendanceStatus("EXCUSED"), /Trạng thái điểm danh không hợp lệ/);
});
