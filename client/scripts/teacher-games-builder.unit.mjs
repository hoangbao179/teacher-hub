import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { teacherWordsFromPaste, teacherWordsFromRows, teacherWordRowsFromItems, teacherWordsToPaste } from "../src/features/teacher-games/teacherWordDraft.ts";
import { isTeacherGamesPath } from "../src/features/teacher-games/teacherGameRoutes.ts";
import { ageBandForGrade, teacherGradeLabel, teacherGradeOptions } from "../src/features/teacher-games/teacherGrades.ts";

const src = (file) => fs.readFileSync(path.resolve(import.meta.dirname, "../src", file), "utf8");

test("import from textbook supports dash/tab/comma and does not require pictures", () => {
  const draft = teacherWordsFromPaste("apple - quả táo\nbanana\tquả chuối\nhungry, đói\ndelicious; ngon");
  assert.deepEqual(draft.errors, []);
  assert.deepEqual(draft.items.map((item) => item.word), ["apple", "banana", "hungry", "delicious"]);
  assert.deepEqual(draft.items.map((item) => item.illustration.kind), ["EMOJI", "EMOJI", "NONE", "NONE"]);
  assert.equal(draft.items[2].supportsImageGame, false);
  assert.equal(draft.items[3].supportsImageGame, false);
});

test("an empty or one-word input is a valid saved draft, but malformed rows still block saves", () => {
  const empty = teacherWordsFromPaste("");
  assert.deepEqual(empty.items, []);
  assert.deepEqual(empty.errors, []);
  const one = teacherWordsFromPaste("apple - quả táo");
  assert.equal(one.items.length, 1);
  assert.deepEqual(one.errors, []);
  const malformed = teacherWordsFromPaste("apple");
  assert.equal(malformed.items.length, 0);
  assert.ok(malformed.errors.some((message) => message.includes("chưa đủ từ")));
  const duplicate = teacherWordsFromPaste("apple - quả táo\napple - quả táo");
  assert.ok(duplicate.errors.some((message) => message.includes("bị lặp")));
  const builder = src("features/teacher-games/pages/TeacherGameBuilderPage.tsx");
  assert.match(builder, /Chỉ tên bài là bắt buộc/);
  assert.match(builder, /wordDraft\.errors\.length > 0 \|\| busy/);
  assert.doesNotMatch(builder, /activities\.length === 0 \|\| busy/);
  assert.match(builder, /value=\{form\.audienceType \?\? ""\}/);
  assert.match(builder, /audienceType: event\.target\.value \?/);
});

test("two-field rows allow empty drafts but reject incomplete and duplicate pairs", () => {
  assert.deepEqual(teacherWordRowsFromItems([]), []);
  assert.deepEqual(teacherWordsFromRows([{ word: "", meaningVi: "" }]).errors, []);
  const half = teacherWordsFromRows([{ word: "apple", meaningVi: "" }]);
  assert.equal(half.items.length, 0);
  assert.ok(half.errors.some((msg) => msg.includes("dòng 1")));
  const complete = teacherWordsFromRows([
    { word: "apple", meaningVi: "quả táo" },
    { word: "banana", meaningVi: "quả chuối" },
    { word: "", meaningVi: "" },
  ]);
  assert.deepEqual(complete.errors, []);
  assert.deepEqual(complete.items.map((item) => item.displayOrder), [1, 2]);
  const oldMedia = { ...complete.items[0], illustration: { kind: "STORED_MEDIA", mediaId: 22 } };
  const revised = teacherWordsFromRows([
    { word: "banana", meaningVi: "quả chuối" },
    { word: "apple", meaningVi: "quả táo" },
  ], [oldMedia, complete.items[1]]);
  assert.deepEqual(revised.items[1].illustration, oldMedia.illustration);
  assert.deepEqual(teacherWordsFromRows([
    { word: "apple", meaningVi: "một nghĩa khác" },
  ], [oldMedia]).items[0].illustration, { kind: "NONE" });
  const duplicate = teacherWordsFromRows([
    { word: "apple", meaningVi: "quả táo" },
    { word: " Apple ", meaningVi: "QUẢ TÁO" },
  ]);
  assert.deepEqual(duplicate.duplicateLines, [2]);
  const tooLong = teacherWordsFromRows(Array.from({ length: 41 }, (_, n) => ({
    word: String(n), meaningVi: "nghĩa " + n,
  })));
  assert.ok(tooLong.errors.some((msg) => msg.includes("40")));
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
  assert.match(builder, /teacherWordsFromRows\(wordRows, previousItems\)/);
  assert.match(builder, /data-testid="teacher-game-add-word"/);
  assert.match(builder, /data-testid="teacher-game-word-row"/);
  assert.doesNotMatch(builder, /data-testid="teacher-game-words"/);
  assert.match(builder, /Xem thử thẻ học/);
  assert.match(list, /listAssignments\(/);
  for (const code of [builder, list]) {
    assert.doesNotMatch(code, /publishAssignment\(|regenerateAssignmentAccess\(|\/play\//);
  }
});

test("lesson catalog separates school grade, actual teaching class and delivery audience", () => {
  assert.equal(teacherGradeOptions.length, 10);
  assert.equal(teacherGradeLabel(0), "Mầm non");
  assert.equal(teacherGradeLabel(3), "Lớp 3");
  assert.equal(teacherGradeLabel(null), "Chưa phân khối");
  for (const [grade, band] of [[0, "PRESCHOOL_G1"], [1, "PRESCHOOL_G1"], [2, "G2_G3"], [3, "G2_G3"], [4, "G4_G5"], [5, "G4_G5"], [6, "G6_G9"], [9, "G6_G9"]]) {
    assert.equal(ageBandForGrade(grade), band);
  }
  assert.throws(() => ageBandForGrade(10));
  const builder = src("features/teacher-games/pages/TeacherGameBuilderPage.tsx");
  const list = src("features/teacher-games/pages/TeacherGamesPage.tsx");
  assert.match(builder, /data-testid="teacher-game-grade"/);
  assert.match(builder, /data-testid="teacher-game-teaching-class"/);
  assert.match(builder, /data-testid="teacher-game-textbook"/);
  assert.match(builder, /data-testid="teacher-game-lesson"/);
  assert.match(builder, /classId: audienceType === "CLASS"/);
  assert.match(builder, /form.audienceType === "CLASS" && !form.classId/);
  assert.match(list, /data-testid="teacher-games-grade-filter"/);
  assert.match(list, /data-testid="teacher-games-class-filter"/);
  assert.match(list, /teacherGradeLabel\(item.gradeLevel\)/);
});
