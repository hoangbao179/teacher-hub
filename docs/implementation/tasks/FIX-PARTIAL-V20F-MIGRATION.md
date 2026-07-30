# FIX-PARTIAL-V20F-MIGRATION

## Phạm vi

- Khôi phục an toàn migration `0021` hoặc `0022` bị ngắt giữa chừng bởi MySQL DDL auto-commit.
- Giữ nguyên các file migration đã phát hành.
- Không tự restore hay rollback dữ liệu production.

## Rủi ro và kiểm tra

- Recovery phải kiểm tra từng column, constraint, index và trigger trước khi sửa.
- Backfill phải idempotent và không ghi đè search terms đã có.
- Chạy typecheck, test backend, integration và gate `check:full` trước khi commit.
