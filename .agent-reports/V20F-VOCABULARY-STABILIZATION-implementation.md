# V20F Implementation

## Phạm vi

Tiếp quản diff V20F đang làm dở; ổn định wizard, Pixabay/media, game/analytics và Google Sheet sync.

## Vấn đề đã sửa

- Wizard rỗng, topic/unit/manual, `returnTo`, loading/error độc lập và preview được hoàn thiện.
- Queue không còn orphan review; missing-letter chấm option ID; pair/memory ghi first/final/retry theo từng item.
- Flashcard, memory và bốn presentation có hành vi thực; kết quả theo tuổi và teacher sync status được bổ sung.
- Tab `Ôn từ vựng` dùng template v2 và outbox idempotent; guest OPEN_LINK không đồng bộ student sheet.
- Bỏ credential Pixabay vô tình xuất hiện trong file example; chỉ giữ placeholder rỗng.

## File chính đã đổi

Contracts `shared/src`, migration `0021`/`0022`, vocabulary repositories/services,
Google provider/template/worker, assignment/game/result pages và các V20 E2E scripts.

## API/schema thay đổi

Thêm `imageSearchTerms`, `questionKind`, `scoreWeight`, bảng kết quả question-item và event
`VOCABULARY_ATTEMPT_UPSERT`; `lesson_id` của outbox nullable để tương thích event cũ.

## Kiểm tra đã chạy

Targeted typecheck/unit/integration và vocabulary assignment/game/media/results E2E đều PASS.
Full gate được ghi trong verification report.

## Điểm còn lại

Local không có Pixabay key nên live smoke chưa chạy. Google thật và restore VPS tiếp tục là operator gate.

## Commit

Chuẩn bị commit `fix(vocabulary): stabilize assignment games media and sheet sync` sau staged review.
