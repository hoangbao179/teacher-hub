# 02. Scope V1

## Trong phạm vi

- Một teacher/admin; lớp 1 kèm 1 và lớp nhóm; student/enrollment/history.
- Lịch lặp, busy slot, external schedule, combined class, nghỉ, đổi lịch và học bù.
- Lesson draft/completed/cancelled, participant snapshot, `PRESENT | ABSENT` và
  nhận xét tùy chọn.
- Bảng học phí theo tháng, amount VND tùy chọn, `PAID` bất biến.
- Excel quá trình học tập và Google Sheet phụ huynh đồng bộ qua outbox.

## Ngoài phạm vi

- Tài khoản học sinh/phụ huynh, nhiều giáo viên, notification, payment gateway,
  partial payment, CMS và import workbook lịch sử.
- Tự động chuyển cycle 8 buổi cũ sang payment tháng.
