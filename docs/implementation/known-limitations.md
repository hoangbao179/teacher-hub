# Known limitations

- Một giáo viên/admin. Limiter login lưu in-memory theo một API instance và không
  chia sẻ giữa nhiều replica; multi-instance cần shared store.
- JWT dùng localStorage khi chọn ghi nhớ hoặc sessionStorage khi không chọn; V1 chưa có
  refresh/revoke tập trung và logout xóa token phía client khỏi cả hai nơi.
- Legacy Import không phải generic Excel importer: chỉ nhận `.xlsx` tối đa 10 MB,
  theo từng học sinh, với hai sheet chuẩn `Quá trình học tập` và `Học phí`. File sai
  cấu trúc/không khớp học sinh bị chặn; dòng mơ hồ phải được resolve hoặc skip có lý
  do trước khi apply. Apply là toàn bộ transaction, không có partial apply.
- Chưa có notification, payment gateway, partial payment, CMS, parent account,
  multi-teacher, offline PWA hay paid-cycle unlock.
- Calendar desktop không drag/drop; mobile week list là flow chuẩn.
- Homepage còn dùng public media tạm; thay theo tài liệu media trước public chính thức.
- Testimonial chưa verified/published không được hiển thị như phản hồi thật.
- Contact/domain example là placeholder; action không hợp lệ bị ẩn và phải cấu hình
  giá trị thật trước production.
- Mức password tối thiểu 6 ký tự là cấu hình V1 chủ ý tối giản; phải tăng khi phạm
  vi public/rủi ro tăng.
- Capacity production trên target host nhỏ chưa được benchmark đầy đủ; phải đo
  image/memory/load trước production dù Docker build có thể chạy ở checkpoint sau.
- Full dev audit còn advisory high ở `shell-quote` qua `concurrently`; chỉ tác động
  tooling chạy script tĩnh. NPM đề xuất downgrade breaking qua `--force`, nên cần
  task dependency riêng thay vì sửa cưỡng bức trong release checkpoint.
