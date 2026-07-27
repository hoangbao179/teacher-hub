/// <reference types="node" />
import assert from "node:assert/strict";
import test from "node:test";
import { TopicSuggestionRequestSequence } from "./topicSuggestionRequest";

test("selecting the same topic twice performs a real refetch and keeps the newest suggestions", async () => {
  const sequence = new TopicSuggestionRequestSequence();
  let calls = 0;
  let resolveFirst!: (value: { items: never[] }) => void;
  const first = sequence.run(() => {
    calls += 1;
    return new Promise((resolve) => { resolveFirst = resolve; });
  });
  const newest = [{ id: 2, word: "new" }] as never[];
  const second = sequence.run(async () => { calls += 1; return { items: newest }; });
  assert.deepEqual(await second, newest);
  resolveFirst({ items: [] });
  assert.equal(await first, null);
  assert.equal(calls, 2);
});
