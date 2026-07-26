# Backup and restore

> Vocabulary media recovery set: **PLANNED cho V20B/V20E; chưa có trong Compose
> hoặc script production hiện tại.**

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

## Recovery set có vocabulary media

Khi V20 được enable, một backup hợp lệ không còn chỉ là SQL dump. Operator/script
phải:

1. lấy deployment lock và tạm chặn mutation tạo/import media;
2. tạo consistent MySQL dump;
3. archive named volume `vocabulary-media` từ mount read-only, không archive
   writable layer của container;
4. ghi manifest gồm release SHA, schema migration, thời điểm UTC, tên SQL/archive,
   byte size và SHA-256 của từng file;
5. chỉ mở mutation sau khi cả hai artifact và checksum thành công;
6. mã hóa/copy recovery set ra ngoài host như một đơn vị.

Import media ghi file hoàn chỉnh bằng temp file trong chính volume rồi atomic
rename trước transaction tham chiếu DB. Vì vậy recovery set có thể có orphan file
nhưng không được có DB row trỏ tới file dở/không tồn tại. Không tự xóa orphan
trong backup window.

Restore luôn vào database và named volume cô lập:

1. kiểm tra manifest/checksum trước khi giải mã/restore;
2. restore SQL, rồi restore archive giữ nguyên relative path và permission;
3. chạy migration tương thích;
4. kiểm tra mọi `vocabulary_media` ID có file/rendition, SHA-256/MIME/dimension
   đúng và không có path traversal/symlink;
5. mở thử assignment published qua same-origin media endpoint và một attempt;
6. chỉ cut over sau khi các bất biến cũ và media đều đạt.

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
- `docker system df`, dung lượng filesystem và tốc độ tăng volume MySQL cùng
  `vocabulary-media` khi V20 enable;
- dung lượng log theo ngày và chính sách rotate/cap cho Docker/Nginx/API;
- swap đã bật hay chưa (khuyến nghị một lượng swap nhỏ có giám sát trên VPS 1 GB,
  không dùng swap để che thiếu RAM kéo dài);
- headroom sau phép đo, cảnh báo disk/RAM và ngưỡng nâng cấu hình.
