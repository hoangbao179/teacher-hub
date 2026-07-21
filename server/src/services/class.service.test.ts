import assert from "node:assert/strict";
import test from "node:test";
import type { CreateClassRequest } from "@teacher/shared";
import { AppError } from "../errors/app-error";
import { ClassRepository } from "../repositories/class.repository";
import { ClassService } from "./class.service";

const valid: CreateClassRequest = {
  name: "Lớp mẫu", type: "GROUP", defaultPackagePrice: 2000000,
  defaultDurationMinutes: 90, startDate: "2026-07-20", schedules: [],
};

test("class package price must be a positive integer", async () => {
  const service = new ClassService({ create: async () => 1 } as unknown as ClassRepository);
  for (const price of [0, -1, 1.5]) {
    await assert.rejects(() => service.create({ ...valid, defaultPackagePrice: price }),
      (error: unknown) => error instanceof AppError && error.code === "VALIDATION_ERROR");
  }
});

test("class mutations forward actor for audit", async () => {
  const calls: unknown[][] = [];
  const repository = {
    create: async (...args: unknown[]) => { calls.push(args); return 5; },
    setStatus: async (...args: unknown[]) => { calls.push(args); return "UPDATED" as const; },
  } as unknown as ClassRepository;
  const service = new ClassService(repository);
  await service.create(valid, 77);
  await service.setStatus(5, "PAUSED", { effectiveDate: "2026-07-21" }, 77);
  assert.equal(calls[0]?.[1], 77);
  assert.deepEqual(calls[1], [5, "PAUSED", "2026-07-21", undefined, 77]);
});
