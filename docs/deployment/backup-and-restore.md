# Backup and restore

`npm run db:backup -- ./backups/YYYYMMDD-predeploy.sql` gọi `mysqldump` với
transaction nhất quán; credentials lấy từ environment và không in ra log.
Giữ backup mã hóa ngoài host, đề nghị hằng ngày 14 bản và hằng tuần 8 bản, cộng
backup trước mọi migration/release.

Restore luôn vào database kiểm thử/đích mới trước:

```bash
npm run db:restore -- ./backups/file.sql --confirm
npm run db:migrate
npm run check:repo
```

Sau restore kiểm tra `schema_migrations`, utf8mb4, timezone, số lớp/học sinh/buổi,
chu kỳ PAID và login. `--confirm` chỉ xác nhận ý định; operator vẫn phải kiểm tra
đúng host/database. Scripts yêu cầu MySQL client trong PATH và không xóa database.
