# FIX-PARTIAL-V20F-MIGRATION Implementation

## Phạm vi

Khôi phục migration V20F bị ngắt do MySQL auto-commit DDL mà không sửa file migration đã phát hành.

## Vấn đề đã sửa

Runner nhận diện dấu vết `0021`/`0022`, hoàn tất riêng từng column, constraint, index,
trigger và chỉ ghi `schema_migrations` sau khi schema đạt trạng thái đích.

## File chính đã đổi

- `server/src/db/migration-recovery.ts`
- `server/src/db/migrate.ts`
- `server/scripts/migration-recovery.integration.cjs`

## API/schema thay đổi

Không thêm API hoặc schema mới; chỉ phục hồi idempotent schema V20F đã được duyệt.

## Kiểm tra đã chạy

- Server typecheck và unit test: PASS.
- Migration recovery integration và full integration: PASS.
- `npm run check:full`: PASS.

## Điểm còn lại

Production cần deploy commit mới; runner sẽ tự hoàn tất trạng thái dở dang hiện có.
