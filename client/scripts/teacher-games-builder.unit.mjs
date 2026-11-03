import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { teacherWordsFromPaste, teacherWordsToPaste } from "../src/features/teacher-games/teacherWordDraft.ts";
import { isTeacherGamesPath } from "../src/features/teacher-games/teacherGameRoutes.ts";

const src = (file) => fs.readFileSync(path.resolve(import.meta.dirname, "../src", file), "utf8");

test("import from textbook supports dash/tab/comma and does not require pictures", () => {
  const draft = teacherWordsFromPaste("apple - quả táo\nbanana\tquả chuối\nhungry, đói\ndelicious; ngon");
  assert.deepEqual(draft.errors, []);
  assert.deepEqual(draft.items.map((item) => item.word), ["apple", "banana", "hungry", "delicious"]);
  assert.deepEqual(draft.items.map((item) => item.illustration.kind), ["EMOJI", "EMOJI", "NONE", "NONE"]);
  assert.equal(draft.items[2].supportsImageGame, false);
  assert.equal(draft.items[3].supportsImageGame, false);
});

test("a preserved custom image survives paste roundtrip and reordering", () => {
  const original = teacherWordsFromPaste("cat - con mèo\ndog - con chó").items;
  original[0].illustration = { kind: "STORED_MEDIA", mediaId: 27 };
  const pasted = teacherWordsFromPaste(teacherWordsToPaste([original[1], original[0]]), original);
  assert.equal(pasted.items[0].word, "dog");
  assert.deepEqual(pasted.items[1].illustration, { kind: "STORED_MEDIA", mediaId: 27 });
  assert.deepEqual(pasted.items.map((item) => item.displayOrder), [1, 2]);
});

test("ambiguous and duplicate word senses fail safely without guessing images", () => {
  const ambiguous = teacherWordsFromPaste("orange - quả cam\norange - màu cam\nbat - gậy bóng chày");
  assert.deepEqual(ambiguous.errors, []);
  assert.deepEqual(ambiguous.items.map((item) => item.illustration.kind), ["EMOJI", "EMOJI", "NONE"]);
  const repeated = teacherWordsFromPaste("apple - quả táo\n Apple - QUẢ TÁO");
  assert.deepEqual(repeated.duplicateLines, [2]);
  assert.ok(repeated.errors.some((msg) => msg.includes("bị lặp")));
  const missing = teacherWordsFromPaste("apple\nbanana - quả chuối");
  assert.equal(missing.preview.invalidCount, 1);
  assert.ok(missing.errors.length > 0);
});

test("only exact teacher game routes bypass legacy redirect, never the authentication boundary", () => {
  for (const route of ["/admin/games", "/admin/games/new", "/admin/games/5/edit"])
    assert.equal(isTeacherGamesPath(route), true);
  for (const route of ["/tools", "/admin", "/admin/students", "/admin/assignments", "/admin/games/5/results", "/admin/games/../../tools", "/admin/games/0/edit"])
    assert.equal(isTeacherGamesPath(route), false);
  const app = src("App.tsx");
  const protectedIndex = app.indexOf('<Route element={<Protected />}>');
  const gamesIndex = app.indexOf('path="/admin/games" element={<TeacherGamesPage />}');
  assert(protectedIndex !== -1 && gamesIndex > protectedIndex, "teacher routes must stay behind <Protected>");
  assert.match(app, /!isTeacherGamesPath\(location.pathname\)/);
  assert.match(src("pages/LoginPage.tsx"), /isTeacherGamesPath\(destination\)/);
});

test("teacher tools still expose PDF and public tools remain outside auth", () => {
  const tools = src("pages/TeacherToolsPage.tsx");
  const app = src("App.tsx");
  const header = src("components/PublicHeader.tsx");
  assert.match(tools, /Tải tài liệu từ liên kết/);
  assert.match(tools, /data-testid="teacher-games-entry"/);
  assert.match(header, /data-testid="header-tools"/);
  assert.match(header, /data-testid="header-teacher-login"/);
  assert(app.indexOf('path="/tools" element={<PublicToolsPage />}') < app.indexOf('<Route element={<AdminAuthBoundary />}>'));
  assert.match(src("config/featureAvailability.ts"), /VOCABULARY_GAMES_ENABLED: boolean = false/);
});

test("teacher game UI only creates drafts and cannot expose a dead game share link", () => {
  const builder = src("features/teacher-games/pages/TeacherGameBuilderPage.tsx");
  const list = src("features/teacher-games/pages/TeacherGamesPage.tsx");
  assert.match(builder, /createAssignment\(request\)/);
  assert.match(builder, /updateAssignment\(id, \{ \.\.\.request, version \}\)/);
  assert.match(builder, /teacherWordsFromPaste\(paste, previousItems\)/);
  assert.match(builder, /Xem thử thẻ học/);
  assert.match(list, /listAssignments\(/);
  for (const code of [builder, list]) {
    assert.doesNotMatch(code, /publishAssignment\(|regenerateAssignmentAccess\(|\/play\//);
  }
});
