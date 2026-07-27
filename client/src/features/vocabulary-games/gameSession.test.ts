/// <reference types="node" />
import assert from "node:assert/strict";
import test from "node:test";
import { clearGameSession, loadGameSession, saveGameSession } from "./gameSession";

class MemoryStorage implements Storage {
  private values = new Map<string, string>();
  get length() { return this.values.size; }
  clear() { this.values.clear(); }
  getItem(key: string) { return this.values.get(key) ?? null; }
  key(index: number) { return [...this.values.keys()][index] ?? null; }
  removeItem(key: string) { this.values.delete(key); }
  setItem(key: string, value: string) { this.values.set(key, value); }
}

test("lost start response can recover the same unexpired session", () => {
  const storage = new MemoryStorage();
  const value = { publicCode: "ABCDEFGH", sessionToken: "session-token", expiresAt: new Date(Date.now() + 60_000).toISOString() };
  saveGameSession(value, storage);
  assert.deepEqual(loadGameSession(value.publicCode, storage), value);
  clearGameSession(value.sessionToken, storage);
  assert.equal(loadGameSession(value.publicCode, storage), null);
});
