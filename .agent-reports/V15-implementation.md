# V15 Implementation

## Phạm vi

Hoàn thiện chuỗi đổi lịch–nghỉ–học bù, đổi tạm nhiều lịch tuần, lịch bận, thu trước, chốt đợt dở dang, chuyển lớp và nội dung liên hệ Homepage.

## Defects xác nhận

- Lịch thay thế chưa thể nghỉ mà vẫn giữ occurrence gốc `RESCHEDULED`.
- Quyền học bù trước đây gắn trực tiếp vào lesson, chưa có lifecycle theo từng học sinh.
- Đổi lịch tạm chỉ nhận một lịch tuần; Calendar chỉ hiển thị số lượng conflict.
- Chưa có receipt thu trước, settlement riêng cho `INCOMPLETE` và transaction chuyển lớp.

## Migration

Thêm migration `0009_v15_schedule_makeup_finance_transfer.sql`: metadata nghỉ lịch thay thế, ledger entitlement/backfill, receipt/allocation và settlement fields. Không sửa migration 0001–0008.

## Replacement cancellation

Occurrence `:R` có thể nghỉ hoặc cancel draft; occurrence gốc tiếp tục là `RESCHEDULED`, lịch thay thế thành `SKIPPED`, canonical source key không đổi.

## Makeup entitlement

Theo dõi `OPEN/RESERVED/FULFILLED/WAIVED` theo học sinh. Cancel draft hoặc bỏ participant trả quyền về `OPEN`; `ABSENT` không hoàn tất, `PRESENT/FREE` hoàn tất, correction cập nhật lại và chặn fulfillment trùng.

## Multi-schedule reschedule

Một request nhận 1–7 mapping, tối đa 45 ngày/30 occurrence, preview conflict nội bộ và apply nguyên tử. Đã kiểm tra lớp có 1/2/3 lịch, subset và toàn bộ lịch.

## Conflict and busy slots

Calendar giữ toàn bộ warning và mở dialog chi tiết. `/admin/busy-slots` liệt kê đang áp dụng/sắp tới/đã kết thúc, hỗ trợ thêm, sửa, kết thúc lịch tuần và xóa lịch sắp tới.

## Advance tuition

Receipt thu trước chụp giá tại ngày nhận, chỉ nhận đủ một gói, từ chối `FREE`/số tiền thiếu. Cycle giữ `ACCUMULATING` trước 8/8 và tự `PAID` khi đủ 8 nếu receipt hợp lệ.

## Incomplete settlement

Cycle luôn giữ `INCOMPLETE`; settlement riêng `OPEN/SETTLED/WAIVED`, có số tiền, phương thức, lý do, ghi chú và audit.

## Enrollment transfer

Transaction khóa enrollment/student/lớp đích, kiểm tra ngày và sức chứa, kết thúc lớp cũ, tạo enrollment/policy/active period mới 0/8, xử lý receipt/settlement và rollback toàn bộ khi lỗi.

## Homepage

Cập nhật đúng nội dung contact, CTA và ba chip được yêu cầu; footer được giữ nguyên chính xác.

## Tests

Targeted unit, integration 29/29 và ba E2E V15 PASS. `npm run check:full` PASS.

## Documentation

Đã cập nhật feature docs, teacher guide, OpenAPI, status, task và acceptance V15.

## Remaining issues

Không có lỗi chức năng còn mở. Docker Desktop không khả dụng nên không chạy `docker compose build`.

## Commit

Một commit: `feat(core): hoàn thiện đổi lịch học bù thu trước và chuyển lớp`. Hash được ghi trong final response vì commit chứa chính report này.
