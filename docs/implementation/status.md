# Implementation status

Đây là nguồn duy nhất mô tả trạng thái runtime hiện hành. Lịch sử triển khai nằm
trong Git.

## Active

- Một giáo viên/admin quản lý lớp 1 kèm 1 và lớp nhóm; học sinh/phụ huynh không có
  tài khoản. Mỗi học sinh tối đa một enrollment `ACTIVE`.
- Dashboard **Hôm nay** là luồng ghi buổi chính: participant mặc định `PRESENT`, cô
  chỉ đổi em vắng sang `ABSENT`; nội dung, bài tập và nhận xét đều không bắt buộc.
- Schedule engine giữ lịch lặp, busy slot, lịch trường/trung tâm, nghỉ, đổi lịch,
  học bù và combined class. Lịch dự kiến không chứng minh đã dạy.
- `/admin/tuition` là bảng học phí theo tháng dương lịch. Mỗi row lấy số có mặt từ
  attendance và tổng buổi hợp lệ từ schedule/lesson projection, gồm cả occurrence
  tương lai trong tháng. Giáo viên có thể nhập số tiền tùy chọn và đánh dấu `PAID`.
  Enrollment có `tuitionExempt=true` không xuất hiện.
- Student Detail cho phép xuất một sheet Excel **Quá trình học tập** và quản lý
  Google Sheet phụ huynh. Google Sheet có một tab hiển thị **Sổ theo dõi học tập**,
  metadata kỹ thuật ẩn, đồng bộ một chiều qua transactional outbox.
- Homepage, `/hoc`, sách, kho từ vựng và bài tập tiếp tục hoạt động độc lập.

## Advanced

- Reconciliation, học bù, đổi lịch tạm thời, combined class và full lesson wizard
  phục vụ ngoại lệ; không nằm trong happy path hằng ngày.
- Retry, regenerate, resync và archive Google Sheet nằm trong **Công cụ nâng cao**.

## Removed from runtime

- Chu kỳ học phí 8 buổi, receipt/advance payment và Legacy Import không còn route,
  UI, shared contract hoặc orchestration runtime.
- Schema cycle, receipt, tuition policy và Legacy Import đã được drop bằng cleanup
  migration vì hệ thống clean-reset không giữ compatibility dữ liệu cũ.

## Temporary disabled

- Vocabulary public game giữ source nhưng entry point vẫn tắt cho đến khi hoàn tất
  review nội dung/provider.

## Release status

Source là release candidate, chưa thay cho duyệt production. Operator vẫn phải cấu
hình secret/OAuth, backup, restore drill và kiểm tra thiết bị thật trước release.
