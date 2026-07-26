# V20D Vocabulary Games Implementation

## Phạm vi

Public access/session, attempt snapshot, game engine và giao diện học sinh `/play/*`.

## Vấn đề đã sửa

- Session 32 byte, hash-only, sliding expiry 24 giờ và invalidation theo assignment/recipient.
- Queue seeded deterministic, answer idempotent, server grading và adaptive retry sau 2–3 câu.
- Flashcard, select-one/skin, matching, memory, build-word, audio và reward responsive.

## File chính đã đổi

`0019_v20d_vocabulary_game_engine.sql`, game repository/service/controller,
shared game contracts và `client/src/features/vocabulary-games/`.

## API/schema thay đổi

Thêm public assignment access/attempt/answer/complete API và bốn bảng game runtime.

## Kiểm tra đã chạy

Typecheck, lint, unit, MySQL integration, targeted Playwright, build, repo/full gate.

## Điểm còn lại

Analytics, teacher review và recovery-set thuộc V20E.

## Commit

Ghi hash trong final response sau khi commit.
