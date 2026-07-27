/// <reference types="node" />
import assert from "node:assert/strict";
import test from "node:test";
import { requestCompletion } from "./completionRequest";

test("a failed result request can be retried directly with the same session", async () => {
  let calls = 0;
  const complete = async (token: string) => {
    calls += 1;
    if (calls === 1) throw new Error("network");
    return { attemptId: 1, status: "COMPLETED", session: token } as never;
  };
  await assert.rejects(requestCompletion("same-session", complete), /network/);
  const result = await requestCompletion("same-session", complete);
  assert.equal(result.attemptId, 1);
  assert.equal(calls, 2);
});
