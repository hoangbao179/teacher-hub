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

## Lịch vận hành và kiểm chứng

- Chạy backup hằng ngày; giữ tối thiểu 14 bản ngày và 8 bản tuần, cộng một bản
  ngay trước migration/release.
- Mỗi backup phải có checksum, mã hóa khi lưu/chuyển và ít nhất một bản sao ngoài
  máy chủ. Không coi bản nằm cạnh volume MySQL đang chạy là phương án khôi phục.
- Hằng tháng chọn một backup, restore vào database mới/cô lập, chạy migration và
  kiểm tra các bất biến lớp, học sinh, lịch sử buổi, chu kỳ PAID và đăng nhập.
- Ghi thời lượng, dung lượng, checksum và kết quả restore drill; không ghi secret
  hoặc dữ liệu học sinh vào log vận hành.

## Checklist đo dung lượng máy nhỏ

Không coi cấu hình 1 GB RAM là đã được chứng minh nếu chưa đo trên đúng image và
dữ liệu đại diện. Trước production, ghi lại:

- `docker stats` khi idle và trong một phiên sử dụng thông thường;
- đỉnh RAM của API khi xuất Excel lớn đại diện;
- đỉnh RAM/IO khi `mysqldump` và khi restore thử;
- `docker system df`, dung lượng filesystem và tốc độ tăng volume MySQL;
- dung lượng log theo ngày và chính sách rotate/cap cho Docker/Nginx/API;
- swap đã bật hay chưa (khuyến nghị một lượng swap nhỏ có giám sát trên VPS 1 GB,
  không dùng swap để che thiếu RAM kéo dài);
- headroom sau phép đo, cảnh báo disk/RAM và ngưỡng nâng cấu hình.
