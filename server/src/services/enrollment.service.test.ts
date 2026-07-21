import assert from "node:assert/strict";
import test from "node:test";
import type { CreateEnrollmentRequest } from "@teacher/shared";
import { AppError } from "../errors/app-error";
import { EnrollmentRepository, type EnrollmentWriteResult } from "../repositories/enrollment.repository";
import { EnrollmentService } from "./enrollment.service";

const valid: CreateEnrollmentRequest = {
  studentId: 7,
  joinedAt: "2026-07-20",
  tuitionMode: "CLASS_DEFAULT",
};

function serviceReturning(result: EnrollmentWriteResult) {
  const repository = { create: async () => result } as unknown as EnrollmentRepository;
  return new EnrollmentService(repository);
}

function serviceWithRepository(repository: Partial<EnrollmentRepository>) {
  return new EnrollmentService(repository as EnrollmentRepository);
}

async function expectCode(run: () => Promise<unknown>, code: string) {
  await assert.rejects(run, (error: unknown) => error instanceof AppError && error.code === code);
}

test("a student cannot have two active enrollments", async () => {
  await expectCode(() => serviceReturning({ kind: "STUDENT_ACTIVE_ENROLLMENT" }).create(2, valid), "STUDENT_ACTIVE_ENROLLMENT");
});

test("ONE_TO_ONE cannot contain two active students", async () => {
  await expectCode(() => serviceReturning({ kind: "ONE_TO_ONE_LIMIT" }).create(2, valid), "ONE_TO_ONE_LIMIT");
});

test("CUSTOM tuition requires an integer positive price", async () => {
  await expectCode(() => serviceReturning({ kind: "OK", id: 1 }).create(2, { ...valid, tuitionMode: "CUSTOM" }), "CUSTOM_PRICE_REQUIRED");
});

test("FREE enrollment has no custom price", async () => {
  await expectCode(() => serviceReturning({ kind: "OK", id: 1 }).create(2, { ...valid, tuitionMode: "FREE", customPackagePrice: 1000 }), "FREE_CUSTOM_PRICE");
});

test("closed classes cannot accept new enrollments", async () => {
  await expectCode(() => serviceReturning({ kind: "CLASS_CLOSED" }).create(2, valid), "CLASS_CLOSED");
});

test("paused classes cannot accept new enrollments", async () => {
  await expectCode(() => serviceReturning({ kind: "CLASS_PAUSED" }).create(2, valid), "CLASS_PAUSED");
});

test("CLASS_DEFAULT enrollment rejects a custom price", async () => {
  await expectCode(() => serviceReturning({ kind: "OK", id: 1 }).create(2, { ...valid, customPackagePrice: 1000 }), "CLASS_DEFAULT_CUSTOM_PRICE");
});

test("pause, resume and end request audited repository transitions with actor", async () => {
  const calls: unknown[][] = [];
  const service = serviceWithRepository({
    setStatus: async (...args: unknown[]) => { calls.push(args); return { kind: "OK", id: 9 }; },
  } as Partial<EnrollmentRepository>);
  await service.pause(9, { effectiveDate: "2026-07-20" }, 42);
  await service.resume(9, { effectiveDate: "2026-07-21" }, 42);
  await service.end(9, { endedAt: "2026-07-20", reason: "Hoàn tất" }, 42);
  assert.deepEqual(calls, [
    [9, "PAUSED", "2026-07-20", undefined, undefined, 42],
    [9, "ACTIVE", "2026-07-21", undefined, undefined, 42],
    [9, "ENDED", "2026-07-20", "2026-07-20", "Hoàn tất", 42],
  ]);
});
