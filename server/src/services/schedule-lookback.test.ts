import assert from "node:assert/strict";
import test from "node:test";
import { ScheduleRepository } from "../repositories/schedule.repository";
import { LessonRepository } from "../repositories/lesson.repository";
import { TuitionRepository } from "../repositories/tuition.repository";
import { LessonService } from "./lesson.service";
import { ScheduleService } from "./schedule.service";

test("occurrence lookback advances at midnight in Ho Chi Minh, including the 60-day boundary", async (context) => {
  context.mock.timers.enable({ apis: ["Date"], now: new Date("2026-09-04T16:59:59Z") });
  const repository = new ScheduleRepository();
  const list = context.mock.method(repository, "listOccurrences", async () => []);
  const service = new ScheduleService(
    repository, new LessonService(new LessonRepository(), new TuitionRepository()),
  );
  const query = { from: "2026-07-06", to: "2026-09-05", lookbackDays: 60 };

  await service.occurrences(query);
  assert.deepEqual(list.mock.calls[0].arguments, ["2026-07-06", query.to, undefined]);

  context.mock.timers.setTime(new Date("2026-09-04T17:00:00Z").getTime());
  await service.occurrences(query);
  assert.deepEqual(list.mock.calls[1].arguments, ["2026-07-07", query.to, undefined]);

  await service.occurrences({ from: "2026-09-01", to: query.to, lookbackDays: 60 });
  assert.deepEqual(list.mock.calls[2].arguments, ["2026-09-01", query.to, undefined]);
});
