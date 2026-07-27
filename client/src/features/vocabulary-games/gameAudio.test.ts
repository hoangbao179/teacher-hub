/// <reference types="node" />
import assert from "node:assert/strict";
import test from "node:test";
import { canPlayGameSpeech, playGameSpeech } from "./gameAudio";

test("audio unavailable is detected and pronunciation resolves false without crashing", async () => {
  assert.equal(canPlayGameSpeech(), false);
  assert.equal(await playGameSpeech("hello"), false);
});
