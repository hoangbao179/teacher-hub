import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

test("Google OAuth uses only drive.file", () => {
  return readFile(path.join(process.cwd(), "src/scripts/google-drive-authorize.ts"), "utf8").then((source) => {
    const scopes = source.match(/https:\/\/www\.googleapis\.com\/auth\/[a-z.]+/g) ?? [];
    assert.deepEqual(scopes, ["https://www.googleapis.com/auth/drive.file"]);
  });
});
