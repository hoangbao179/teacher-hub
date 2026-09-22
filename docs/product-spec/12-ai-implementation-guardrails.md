# 12. AI implementation guardrails

1. Không suy diễn buổi đã dạy từ recurring schedule; chỉ lesson `COMPLETED` là bằng chứng.
2. Attendance runtime chỉ `PRESENT|ABSENT`; tuition mode `FREE` không phải attendance.
3. Học phí theo tháng không phụ thuộc số buổi, duration, giá gói hoặc cycle cũ.
4. Không backfill hoặc xóa cycle/receipt/import history nếu chưa có task riêng được duyệt.
5. Không gọi Google API trong transaction; giữ outbox retry/idempotency.
6. Không thêm payment gateway, partial payment, notification, CMS, parent/student
   account hay multi-teacher ngoài scope.
7. Không xóa wireframe; không commit screenshot/log/test artifact.
