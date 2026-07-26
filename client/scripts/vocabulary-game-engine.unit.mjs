import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";

const root = path.resolve(import.meta.dirname, "..");
const read = (relative) => fs.readFileSync(path.join(root, relative), "utf8");
const app = read("src/App.tsx");
const api = read("src/api/vocabularyGames.ts");
const metadata = read("src/components/RouteMetadata.tsx");
const question = read("src/features/vocabulary-games/GameQuestion.tsx");
const start = read("src/features/vocabulary-games/pages/PlayStartPage.tsx");
const game = read("src/features/vocabulary-games/pages/PlayGamePage.tsx");

test("student game routes stay outside the authenticated AdminLayout", () => {
  const playIndex = app.indexOf('<Route path="/play/:publicCode"');
  const adminBoundaryIndex = app.indexOf("<Route element={<AdminAuthBoundary />}>");
  assert.ok(playIndex > 0 && playIndex < adminBoundaryIndex);
  assert.match(app, /\/play\/session\/:sessionToken\/result/);
});

test("public game client uses no-referrer and never uses teacher auth API", () => {
  assert.match(api, /referrerPolicy: "no-referrer"/);
  assert.match(api, /\/api\/public\/learning-attempts/);
  assert.doesNotMatch(api, /Authorization/);
  assert.match(metadata, /noindex,nofollow,noarchive/);
  assert.match(metadata, /no-referrer/);
});

test("game UI includes all V20D mechanics with child-sized controls", () => {
  assert.match(question, /EXPLORE_CARD/);
  assert.match(question, /MATCH_PAIRS/);
  assert.match(question, /MEMORY_PAIRS/);
  assert.match(question, /BUILD_WORD/);
  assert.match(question, /FEED_MONSTER/);
  assert.match(question, /OPEN_TREASURE/);
  assert.match(question, /POP_BALLOON/);
  assert.match(question, /minHeight: 56/);
  assert.match(question, /first\.matchKey === second\?\.matchKey/);
  assert.match(question, /reducedMotion \? 120 : 800/);
  assert.match(question, /flashcardRevealed/);
  assert.match(question, /MISSING_LETTER/);
  assert.match(question, /data-memory-card/);
  assert.doesNotMatch(question, /void playGameSpeech\(question\.prompt\.speechText\).*useEffect/s);
});

test("access URL is replaced and network retries preserve the answer id", () => {
  assert.ok(start.includes("encodeURIComponent(result.sessionToken)"));
  assert.ok(start.includes("{ replace: true }"));
  assert.ok(game.includes("pending.current"));
  assert.ok(game.includes("crypto.randomUUID()"));
  assert.ok(game.includes("pending.current ? send() : load()"));
});
