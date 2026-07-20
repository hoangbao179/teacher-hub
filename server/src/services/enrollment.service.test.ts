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
