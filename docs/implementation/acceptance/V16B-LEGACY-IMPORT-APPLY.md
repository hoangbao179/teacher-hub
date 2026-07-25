# V16B-LEGACY-IMPORT-APPLY Acceptance

Trạng thái: **PLANNED**. Tất cả checkbox để trống cho tới khi implementation và
verification thực tế hoàn tất.

## Functional acceptance

- [ ] File đúng student và chưa import có thể review rồi apply vào canonical DB.
- [ ] File không khớp student bị chặn; nhiều năm học/grade/class giữ mapping đã xác nhận.
- [ ] Student 1–1 và group dùng cùng model; file nhiều student dùng lại exact lesson nhưng có participant/attendance/note riêng.
- [ ] Exact match dùng class/date/scheduled start/end; near duplicate bắt buộc user quyết định.
- [ ] `PRESENT`, `ABSENT`, `FREE` và `ABSENT_CHARGED` (nếu được bật) có billable semantics đúng.
- [ ] Cycle đủ 8, cycle dở, paid rõ và payment chưa rõ được xử lý đúng feature spec; không nhóm cứ tám dòng Excel.
- [ ] Conflict content/homework không bị ghi đè; comment file student là note riêng và comment giống nhau chỉ được gợi ý gộp.
- [ ] Workbook chỉ là migration source; Sheet sau này phải được dựng từ DB.

## Transaction/idempotency

- [ ] Apply nhiều bảng commit toàn bộ hoặc rollback toàn bộ.
- [ ] Unique student + SHA-256 bảo đảm replay trả idempotent và không tạo record/audit lần hai.
- [ ] Metadata filename/size/SHA/status/applied time được lưu; temp binary luôn được xóa.
- [ ] Retry một lỗi Google trong checkpoint sau không thể gọi apply DB lần hai.
- [ ] `PAID` và item liên quan bất biến; late-entry conflict rollback đúng.

## Privacy/isolation

- [ ] Không log/fixture/response chứa workbook bytes, dữ liệu thật hoặc secret.
- [ ] Group import không làm lộ note/nội dung định danh của student khác.
- [ ] Original filename được sanitize; workbook không được đưa vào vùng chia sẻ parent.

## Responsive admin UI

- [ ] Preview/confirm/apply có loading, error, retry an toàn và confirmation rõ.
- [ ] Không page-level horizontal scroll tại 360, 375, 390, 393, 400, 412, 430 px.
- [ ] Near match/conflict/payment review có action thật, không dùng raw enum.

## Google failure behavior

- [ ] V16B không import Google dependency và không gọi Google trong hoặc ngoài DB transaction.
- [ ] Test kiến trúc chứng minh apply không phụ thuộc OAuth/Drive/Sheets availability.

## Native MySQL integration

- [ ] Migration mới chạy trên MySQL native và có constraints/index/idempotency key phù hợp.
- [ ] Integration test kiểm tra exact match, multi-student group, rollback, replay, cycle dở xuyên enrollment và `PAID` boundary.

## Fake Google provider tests

- [ ] Không cần fake provider trong production path V16B; boundary test dùng fake “không được gọi” và fail nếu có invocation.

## Manual production smoke test

- [ ] Dùng workbook đã ẩn danh trong restricted environment: preview, apply, replay cùng SHA và xác minh DB/audit.
- [ ] Xác minh không có request Google và không còn temp binary sau apply/lỗi.
