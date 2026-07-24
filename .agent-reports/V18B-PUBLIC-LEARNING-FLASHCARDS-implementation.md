# V18B-PUBLIC-LEARNING-FLASHCARDS Implementation

## Phạm vi

Unit overview, flashcards, pronunciation, listen practice và per-Unit progress.

## Vấn đề đã sửa

- Mở Unit thật thay trạng thái disabled V18A; thêm 3 route public có validation.
- Thêm audio asset/Web Speech fallback, native swipe, keyboard và feedback a11y.
- Migrate progress V18A, persist V18B và reset riêng Unit có confirm.

## File chính đã đổi

`client/src/features/learning/`, routing/metadata và public-learning tests.

## API/schema thay đổi

Không có backend/schema; giữ storage key/schemaVersion V18A.

## Kiểm tra đã chạy

Targeted typecheck/lint/unit/build/E2E và `npm run check:full`: PASS.

## Điểm còn lại

Quiz tổng hợp, kết quả cuối và ôn từ sai hoàn chỉnh thuộc V18C.

## Commit

`feat(learning): bổ sung flashcard và luyện nghe`
