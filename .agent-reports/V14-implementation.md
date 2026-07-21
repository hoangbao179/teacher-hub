# V14 Implementation

## Phạm vi

Hoàn thiện tính toàn vẹn lịch sử lesson/lịch lặp, active period theo ngày,
cancel/skip/makeup, đổi lịch tạm thời, conflict warning và các UI fix liên quan.

## Vấn đề source ban đầu

1. Class update tái tạo toàn bộ recurring schedule đang active.
2. Schedule PATCH sửa row trực tiếp.
3. Schedule DELETE hard-delete.
4. Projection lịch sử phụ thuộc `classes.status='ACTIVE'` hiện tại.
5. Eligibility chưa xét khoảng pause của enrollment.
6. Tên lớp/học sinh lịch sử dùng live join.
7. Cancelled source lesson làm occurrence thành RECORDED.
8. MAKEUP chưa liên kết occurrence nghỉ.
9. Conflict từ create draft chưa hiển thị nhất quán.
10. Quick actions Calendar dùng spacing/gap/flexWrap lệch trên mobile.

## Migration

Thêm migration `0008` với snapshot, cancellation metadata, class/enrollment
active periods, participant-level makeup mapping, backfill và constraints/indexes.

## Snapshot lịch sử

Draft và participant ghi snapshot trong transaction; lesson list/detail/report ưu
tiên snapshot nên đổi tên hiện tại không viết lại lịch sử.

## Class/enrollment active periods

Pause/resume/close dùng ngày hiệu lực và audit; projection/eligibility đọc range
inclusive. Pause ngay ngày bắt đầu xử lý period rỗng mà không sinh occurrence.

## Recurring schedule versioning

Class update diff theo schedule ID; metadata-only giữ nguyên ID. Thay đổi tạo
version mới, remove chỉ end-date, exceptions/draft cũ tiếp tục gắn version nguồn.

## Cancel/skip/makeup

Cancel draft lưu metadata, tạo SKIPPED và hai audit trong một transaction. MAKEUP
có source tùy chọn, hỗ trợ nhiều subset và unique replacement theo enrollment.

## Temporary reschedule

Preview/dry-run và apply all-or-nothing tạo RESCHEDULED exceptions, giới hạn 45
ngày/20 occurrence, xác nhận conflict rõ ràng và không sửa pattern gốc.

## Conflict handling

Thêm preflight dùng chung; manual lesson, occurrence draft, busy slot,
reschedule/temporary reschedule và Calendar đều hiển thị warning có nhãn truy cập.

## UI fixes

Hoàn thiện luồng makeup/cancel/status theo ngày, Calendar grid 360–430 px, login
helper, teacher profile tập trung; footer bắt buộc được giữ nguyên.

## Tests

Bổ sung unit/integration/E2E cho snapshot, periods, versioning, cancel/makeup,
temporary reschedule, conflicts và responsive UI.

## Documentation

Cập nhật ADR, feature docs, teacher guide, OpenAPI, task/acceptance và status.

## Điểm còn lại

Không có tồn tại chức năng trong phạm vi V14. Docker build không chạy vì Docker
CLI/Desktop không khả dụng trên máy kiểm tra.

## Commit

Commit hash được ghi trong final response sau khi tạo commit cuối.
