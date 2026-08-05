import assert from "node:assert/strict";
import test from "node:test";
import { millisecondsUntilNextHoChiMinhDay, todayInHoChiMinh } from "../src/utils/date.ts";

test("todayInHoChiMinh uses Vietnam time instead of the machine timezone", () => {
  assert.equal(todayInHoChiMinh(new Date("2026-08-05T16:59:59.500Z")), "2026-08-05");
  assert.equal(todayInHoChiMinh(new Date("2026-08-05T17:00:00.000Z")), "2026-08-06");
});

test("rollover delay targets just after the next Vietnam midnight", () => {
  assert.equal(
    millisecondsUntilNextHoChiMinhDay(new Date("2026-08-05T16:59:58.000Z")),
    3_000,
  );
  assert.equal(
    millisecondsUntilNextHoChiMinhDay(new Date("2026-08-05T17:00:00.000Z"), 500),
    86_400_500,
  );
});

test("rollover delay remains correct over month and leap-day boundaries", () => {
  assert.equal(
    millisecondsUntilNextHoChiMinhDay(new Date("2028-02-28T16:59:59.000Z"), 1_000),
    2_000,
  );
  assert.equal(todayInHoChiMinh(new Date("2028-02-28T17:00:00.000Z")), "2028-02-29");
});
