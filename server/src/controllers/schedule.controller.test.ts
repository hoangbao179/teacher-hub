import assert from "node:assert/strict";
import test from "node:test";
import type { Request, Response } from "express";
import { ScheduleController } from "./schedule.controller";
import type { ScheduleService } from "../services/schedule.service";

test("create busy slot without title responds 201 with the generated title", async () => {
  let statusCode = 0;
  let responseBody: unknown;
  const service = {
    createBusySlot: async () => ({
      slot: {
        id: 1,
        slotType: "EXTERNAL_CLASS" as const,
        organizationType: "SCHOOL" as const,
        organizationName: "Mầm non Hoa Thủy Tiên",
        title: "Mầm non Hoa Thủy Tiên · Thứ 2 08:00",
        recurrenceType: "WEEKLY" as const,
        schedules: [{ dayOfWeek: 1 as const, startTime: "08:00", endTime: "09:00" }],
        specificDate: null,
        startTime: null,
        endTime: null,
        effectiveFrom: "2026-07-31",
        effectiveTo: null,
        location: null,
        note: null,
        conflicts: [],
      },
      conflicts: [],
    }),
  } as unknown as ScheduleService;
  const response = {
    status(code: number) {
      statusCode = code;
      return this;
    },
    json(body: unknown) {
      responseBody = body;
      return this;
    },
  } as unknown as Response;
  const request = {
    body: {
      slotType: "EXTERNAL_CLASS",
      organizationType: "SCHOOL",
      organizationName: "Mầm non Hoa Thủy Tiên",
      recurrenceType: "WEEKLY",
      schedules: [{ dayOfWeek: 1, startTime: "08:00", endTime: "09:00" }],
      effectiveFrom: "2026-07-31",
    },
    auth: { id: 1 },
  } as unknown as Request;

  await new ScheduleController(service).createBusySlot(request, response);

  assert.equal(statusCode, 201);
  assert.equal(
    (responseBody as { data: { slot: { title: string } } }).data.slot.title,
    "Mầm non Hoa Thủy Tiên · Thứ 2 08:00",
  );
});
