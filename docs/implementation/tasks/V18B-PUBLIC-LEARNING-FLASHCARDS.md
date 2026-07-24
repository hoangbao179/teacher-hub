# V18B-PUBLIC-LEARNING-FLASHCARDS

## Mục tiêu

Hoàn thiện chọn Unit, học flashcard và luyện nghe public trên nền V18A.

## Phạm vi

- Route overview, `flashcards` và `listen`, với validation level/Unit chéo.
- Flashcard có audio, swipe, keyboard, remembered/review và progress.
- Listen practice 4 nghĩa deterministic, feedback accessible và audio fallback.
- Migration progress V18A, reset riêng Unit có confirm.
- Responsive 360–430, tablet, desktop; không gọi Admin API.

## Ngoài phạm vi

Quiz tổng hợp, kết quả cuối Unit, ôn từ sai hoàn chỉnh, backend/API/database/CMS và Admin.

## Verification

Typecheck, lint, unit, production build, public learning E2E, `check:full`,
`check:repo` và `git diff --check`.

## Commit sau PASS

`feat(learning): bổ sung flashcard và luyện nghe`
