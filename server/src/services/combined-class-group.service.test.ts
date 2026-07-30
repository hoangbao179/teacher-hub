import assert from "node:assert/strict";
import test from "node:test";
import { CombinedClassGroupService } from "./combined-class-group.service";
import type { CombinedClassGroupRepository } from "../repositories/combined-class-group.repository";
import type { LessonService } from "./lesson.service";

const service = new CombinedClassGroupService(
  {} as CombinedClassGroupRepository,
  {} as LessonService,
);

const valid = {
  name: "Lớp 4 + Lớp 5",
  classIds: [4, 5],
  effectiveFrom: "2026-08-01",
  schedules: [{ dayOfWeek: 1 as const, startTime: "08:30", endTime: "11:00" }],
};

test("combined group validation requires at least two unique classes", async () => {
  await assert.rejects(
    service.create({ ...valid, classIds: [4] }),
    (error: { code?: string }) => error.code === "VALIDATION_ERROR",
  );
  await assert.rejects(
    service.create({ ...valid, classIds: [4, 4] }),
    (error: { code?: string }) => error.code === "VALIDATION_ERROR",
  );
});

test("combined group validation rejects invalid date and time ranges", async () => {
  await assert.rejects(
    service.create({ ...valid, effectiveTo: "2026-07-31" }),
    (error: { code?: string }) => error.code === "VALIDATION_ERROR",
  );
  await assert.rejects(
    service.create({
      ...valid,
      schedules: [{ dayOfWeek: 1, startTime: "11:00", endTime: "11:00" }],
    }),
    (error: { code?: string }) => error.code === "VALIDATION_ERROR",
  );
});
