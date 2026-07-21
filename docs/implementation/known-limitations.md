# Known limitations

- Một giáo viên/admin và một API instance; limiter không chia sẻ giữa nhiều replica.
- JWT dùng localStorage khi chọn ghi nhớ hoặc sessionStorage khi không chọn; V1 chưa có
  refresh/revoke tập trung và logout xóa token phía client khỏi cả hai nơi.
- Không import Excel legacy, notification, payment gateway, partial payment, CMS,
  parent account, multi-teacher, offline PWA hay paid-cycle unlock.
- Calendar desktop không drag/drop; mobile week list là flow chuẩn.
- Teacher/contact/domain mặc định là giả và phải cấu hình trước deploy.
- Target host nhỏ và Docker image/memory chưa đo vì Docker không có trong môi trường
  checkpoint; phải benchmark/capacity-check trước production.
- Advisory UUID moderate qua ExcelJS được chấp nhận tạm thời cho code path không dùng.
