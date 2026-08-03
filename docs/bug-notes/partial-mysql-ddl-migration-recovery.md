# Partial MySQL DDL migration recovery

## Symptom

Migration `0021` hoặc `0022` không có record trong `schema_migrations`, nhưng một
phần column, constraint, index hoặc trigger đã tồn tại. Chạy lại migration nguyên
khối có thể lỗi vì object đã được tạo hoặc xóa.

## Root cause

MySQL auto-commit nhiều DDL statement. Nếu deploy bị ngắt giữa migration, rollback
transaction không đưa schema về trạng thái ban đầu dù migration record chưa được
ghi.

## Resolution

Migration runner nhận diện dấu vết của đúng hai migration đã phát hành, kiểm tra
từng object, hoàn tất phần còn thiếu và backfill idempotent. Chỉ ghi migration
record sau khi schema đạt trạng thái đích. Không sửa ngược file migration đã áp
dụng và không tự restore hoặc rollback dữ liệu production.

## Regression coverage

Integration coverage phải gồm fresh database, partial `0021`, partial `0022`,
backfill chạy lại và trạng thái cuối có migration record đúng.

## Related files

- `server/src/db/migration-recovery.ts`
- `server/src/db/migrate.ts`
- `server/scripts/migration-recovery.integration.cjs`
- `docs/operations/backup-and-restore.md`

## Remaining risks

Recovery này chỉ dành cho dấu vết đã biết của `0021`/`0022`; migration mới phải có
recovery hoặc correction riêng nếu gặp DDL partial state khác.
