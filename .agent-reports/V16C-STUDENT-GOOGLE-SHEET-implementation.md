# V16C-STUDENT-GOOGLE-SHEET Implementation

## Phạm vi

OAuth/Drive/Sheets abstraction, một Sheet Restricted theo student, snapshot DB, quản lý từ Student Detail; không auto-sync/share.

## Vấn đề đã sửa

- Thêm state machine atomic/idempotent, timeout recovery bằng appProperties và orphan cleanup.
- Dựng bốn sheet parent-facing từ canonical DB, escape formula và cô lập note student.
- Thêm create/retry/regenerate/archive và UI mobile mở/copy/confirm.
- Hoàn thiện cleanup V16B/V16C để test/reset không giữ orphan legacy links.

## File chính đã đổi

Migration `0013`, Google integration, repository/service/controller, shared contracts, Student Detail, config/deployment/test/docs.

## API/schema thay đổi

Thêm `student_google_sheets` và năm endpoint `/api/students/:studentId/google-sheet*`.

## Kiểm tra đã chạy

`npm run check:full`, MySQL 40/40, fake-provider E2E, repo/OpenAPI 68 route và package source/check đều PASS.

## Điểm còn lại

OAuth và smoke thật cần credential Google test; V16D/V16E xử lý auto-sync và sharing.

## Commit

Chưa commit khi manual smoke chưa PASS.
