import assert from "node:assert/strict";
import test from "node:test";
import { getEnrollmentCandidates } from "../src/features/class-enrollment.ts";

function student(overrides = {}) {
  return {
    id: 1,
    fullName: "An",
    nickname: null,
    status: "ACTIVE",
    parentName: null,
    parentPhone: null,
    classId: null,
    className: null,
    enrollmentId: null,
    enrollmentStatus: null,
    tuitionMode: null,
    customPackagePrice: null,
    currentProgress: null,
    hasPaymentDue: false,
    ...overrides,
  };
}

test("enrollment candidates contain only active students without an enrollment", () => {
  const candidates = getEnrollmentCandidates([
    student(),
    student({ id: 2, fullName: "Bình", enrollmentId: 12, classId: 4, className: "Lớp 6" }),
    student({ id: 3, fullName: "Chi", status: "INACTIVE" }),
  ]);

  assert.deepEqual(candidates.map((item) => item.fullName), ["An"]);
});

test("a refreshed student list removes the newly enrolled student from candidates", () => {
  const before = [student({ id: 7, fullName: "Dung" })];
  const after = [student({
    id: 7,
    fullName: "Dung",
    enrollmentId: 23,
    enrollmentStatus: "ACTIVE",
    classId: 9,
    className: "Lớp 7",
  })];

  assert.equal(getEnrollmentCandidates(before).length, 1);
  assert.equal(getEnrollmentCandidates(after).length, 0);
});
