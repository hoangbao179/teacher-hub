# 12. AI implementation guardrails

1. Không suy diễn buổi đã dạy từ recurring schedule; chỉ lesson `COMPLETED` là bằng chứng.
2. Attendance chỉ `PRESENT|ABSENT`; miễn học phí dùng `tuitionExempt` trên enrollment.
3. Học phí theo tháng không dùng cycle cố định; denominator lấy schedule/lesson projection.
4. Schema cycle/receipt/policy/import đã bị drop và không được tái tạo cho compatibility.
5. Không gọi Google API trong transaction; giữ outbox retry/idempotency.
6. Không thêm payment gateway, partial payment, notification, CMS, parent/student
   account hay multi-teacher ngoài scope.
7. Không commit screenshot/log/test artifact; chỉ giữ UI baseline đã được duyệt.
