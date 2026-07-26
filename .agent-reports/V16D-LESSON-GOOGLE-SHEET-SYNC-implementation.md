# V16D-LESSON-GOOGLE-SHEET-SYNC Implementation

## Phạm vi

Triển khai nhận xét chung/riêng, quick attendance, transactional outbox, worker
đồng bộ lesson một chiều, sync status và manual resync.

## Vấn đề đã sửa

- Google không còn nằm trên đường transaction lesson; mutation chỉ upsert event
  theo student/lesson/revision và commit cùng business data.
- Worker claim ngắn, retry/backoff, stale-lock recovery và revision guard; payload
  luôn đọc lại từ canonical database.
- `ABSENT` không nhận general performance comment; student note được cô lập theo
  student. Worker không sửa tab Học phí.
- UI có bulk attendance/Undo, note riêng thu gọn, chuyển note thành nhận xét chung
  có xác nhận, cùng trạng thái pending/retry/dead/resync.

## File chính đã đổi

Migration `0014`, lesson/shared contracts và service/repository, Google provider/
client, outbox repository/worker, Lesson Wizard, Student Detail, OpenAPI và tài liệu.

## API/schema thay đổi

- Thêm `lesson_sessions.general_comment` và `google_sheet_sync_outbox`.
- Thêm `POST /api/students/:studentId/google-sheet/resync`.
- Mở rộng lesson comment contract và Google Sheet sync state.

## Kiểm tra đã chạy

Typecheck, lint, build, unit, native MySQL integration, targeted Google Sheet E2E,
full E2E, `check:full`, `check:repo` và `git diff --check` đều đạt.

## Điểm còn lại

Manual Google smoke chưa chạy vì môi trường có Drive/sync disabled và không có
credential test. Không đánh dấu PASS và không commit.

## Commit

Chưa có.

Hardening trước OAuth được theo dõi tại task
`HARDEN-V16C-V16D-BEFORE-GOOGLE-OAUTH`.
