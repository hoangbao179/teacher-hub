# FIX-PARTIAL-V20F-MIGRATION Acceptance

- [x] Database có dấu vết `0021` nhưng chưa có migration record được hoàn tất an toàn.
- [x] `0022` bị ngắt sau khi drop/create trigger có thể chạy lại an toàn.
- [x] Fresh database vẫn chạy chuỗi migration bình thường.
- [x] Không sửa ngược file migration `0021`/`0022` đã phát hành.
- [x] Typecheck, backend test, integration và `check:full` PASS.
