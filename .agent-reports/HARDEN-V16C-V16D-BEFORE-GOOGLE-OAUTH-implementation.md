# HARDEN-V16C-V16D-BEFORE-GOOGLE-OAUTH Implementation

## Phạm vi

Hardening OAuth, attendance/tuition snapshot, generation recovery và Google error/
regenerate safety của V16C/V16D; không triển khai V16E.

## Vấn đề đã sửa

- OAuth chỉ xin `drive.file`; loại trạng thái nghỉ có tính phí xuyên contract/runtime/UI/docs.
- Migration `0015` chuyển dữ liệu cũ, rebuild cycle mutable, giữ `PAID` và thêm
  `generation_started_at`.
- Snapshot dùng cycle window không giao nhau, nhận `PAYMENT_DUE`/`PAID` là 8/8.
- Stale create được reclaim sau 10 phút và tìm resource theo appProperties trước create.
- 404 phân biệt folder/file; regenerate chỉ cleanup formatting/protection Teacher Hub.

## API/schema thay đổi

`StudentGoogleSheet` thêm `generationStartedAt`, `canRetryGeneration`; attendance
enum thu hẹp còn `PRESENT`, `ABSENT`, `FREE`.

## Kiểm tra đã chạy

Typecheck, unit, native MySQL integration, targeted Google Sheet E2E, full E2E,
`check:full`, `check:repo` và `git diff --check` đều PASS.

## Điểm còn lại

Google smoke thật chủ động chưa chạy theo phạm vi task.

## Commit

Nằm trong commit hoàn tất task.
