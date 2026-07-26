# V20D — Vocabulary games

## Trạng thái

**PASS — 26/07/2026**

## Phạm vi

- Đăng ký public API trước auth middleware; implement access/session token hash,
  expiry, close invalidation và public limiter.
- Tạo attempt + seeded question queue snapshot; implement
  `learning_attempt_answers` và answer idempotency.
- Xây game shell cùng flashcard, select-one, matching, memory và build-word MVP.
- Implement unique distractor, minimum option theo age band, media fallback và
  adaptive repeat sau 2–3 câu bằng presentation/mechanic khác.
- Persist first/final correct/retry count; flashcard không tính mastery.
- Thêm noindex/nofollow/noarchive và no-referrer cho `/play/*`.

## Ngoài phạm vi

- Dashboard aggregate/review release; AI pronunciation, microphone, multiplayer.

## Dependency và verification

Phụ thuộc V20C. Chạy public security/rate-limit/idempotency/integration tests,
game unit/E2E responsive/a11y targeted và full gate theo
[acceptance V20D](../acceptance/V20D-VOCABULARY-GAMES.md).
