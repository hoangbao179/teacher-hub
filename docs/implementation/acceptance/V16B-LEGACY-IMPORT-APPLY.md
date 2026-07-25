# V16B-LEGACY-IMPORT-APPLY Acceptance

Trạng thái: **PLANNED**. Tất cả checkbox để trống cho tới khi implementation và
verification thực tế hoàn tất.

## Functional acceptance

- [ ] File đúng student và chưa import có thể review rồi apply vào canonical DB.
- [ ] `VALID` được accepted không cần thao tác; `NEEDS_REVIEW` và `BLOCKED` làm nút Apply disabled.
- [ ] Mỗi `NEEDS_REVIEW` có structured decision và chỉ thành `RESOLVED`/`SKIPPED` sau validation.
- [ ] `BLOCKED` chỉ thành `RESOLVED` sau khi dữ liệu hợp lệ hoặc thành `SKIPPED`; không có force-import raw invalid row.
- [ ] Một dòng lỗi không bắt buộc hủy toàn file khi admin có quyền skip, nhập lý do hợp lệ và các dòng còn lại đã sẵn sàng.
- [ ] File-level error chặn cả file và không thể được giải quyết bằng skip row.
- [ ] File không khớp student bị chặn; nhiều năm học/grade/class giữ mapping đã xác nhận.
- [ ] Student 1–1 và group dùng cùng model; file nhiều student dùng lại exact lesson nhưng có participant/attendance/note riêng.
- [ ] Exact match dùng class/date/scheduled start/end; near duplicate bắt buộc user quyết định.
- [ ] Duplicate/near-match có decision ghép lesson hiện có, tạo lesson mới hoặc bỏ qua; không tự merge.
- [ ] Có action sửa ngày, map period/class, chọn attendance, giữ/dùng content, chỉnh thủ công và bỏ qua dòng theo đúng issue.
- [ ] `PRESENT`, `ABSENT`, `FREE` và `ABSENT_CHARGED` (nếu được bật) có billable semantics đúng.
- [ ] Cycle đủ 8, cycle dở, paid rõ và payment chưa rõ được xử lý đúng feature spec; không nhóm cứ tám dòng Excel.
- [ ] Conflict content/homework không bị ghi đè; comment file student là note riêng và comment giống nhau chỉ được gợi ý gộp.
- [ ] Bulk decision chỉ chạy cho cùng issue code + raw normalized value, hiển thị affected row count và cần confirmation.
- [ ] Workbook chỉ là migration source; Sheet sau này phải được dựng từ DB.

## Transaction/idempotency

- [ ] Apply nhiều bảng commit toàn bộ hoặc rollback toàn bộ.
- [ ] Tất cả `VALID + RESOLVED` được ghi trong cùng transaction; lỗi database mutation hoặc audit write rollback toàn bộ.
- [ ] Unique student + SHA-256 bảo đảm replay trả idempotent và không tạo record/audit lần hai.
- [ ] Metadata filename/size/SHA/status/applied time được lưu; temp binary luôn được xóa.
- [ ] Retry một lỗi Google trong checkpoint sau không thể gọi apply DB lần hai.
- [ ] `PAID` và item liên quan bất biến; late-entry conflict rollback đúng.
- [ ] Mọi structured decision có issue/action/payload, decided by/at và before/after phù hợp.
- [ ] `SKIPPED` lưu source sheet/row, raw hoặc sanitized snapshot, issue code, skip reason, decided by/at.
- [ ] `SKIPPED` không tạo business row, không ảnh hưởng bộ đếm/cycle học phí.

## Privacy/isolation

- [ ] Không log/fixture/response chứa workbook bytes, dữ liệu thật hoặc secret.
- [ ] Group import không làm lộ note/nội dung định danh của student khác.
- [ ] Original filename được sanitize; workbook không được đưa vào vùng chia sẻ parent.
- [ ] Raw/sanitized skipped-row snapshot được giới hạn truy cập và không bị đưa vào log/client ngoài nhu cầu review.

## Responsive admin UI

- [ ] Preview/confirm/apply có loading, error, retry an toàn và confirmation rõ.
- [ ] Không page-level horizontal scroll tại 360, 375, 390, 393, 400, 412, 430 px.
- [ ] Near match/conflict/payment review có action thật, không dùng raw enum.
- [ ] UI hiển thị summary theo trạng thái, số unresolved/blocked và affected count trước bulk decision.

## Google failure behavior

- [ ] V16B không import Google dependency và không gọi Google trong hoặc ngoài DB transaction.
- [ ] Test kiến trúc chứng minh apply không phụ thuộc OAuth/Drive/Sheets availability.
- [ ] Skipped row không tạo outbox/sync payload và không xuất hiện trên Google Sheet ở test contract liên checkpoint.

## Native MySQL integration

- [ ] Migration mới chạy trên MySQL native và có constraints/index/idempotency key phù hợp.
- [ ] Integration test kiểm tra exact match, multi-student group, rollback, replay, cycle dở xuyên enrollment và `PAID` boundary.
- [ ] Integration test bao phủ mixed valid/resolved/skipped rows, unresolved guard, file-level error, bulk-decision guard và mutation failure rollback.

## Fake Google provider tests

- [ ] Không cần fake provider trong production path V16B; boundary test dùng fake “không được gọi” và fail nếu có invocation.

## Manual production smoke test

- [ ] Dùng workbook đã ẩn danh trong restricted environment: preview, apply, replay cùng SHA và xác minh DB/audit.
- [ ] Với một row lỗi, quyết định skip rồi Apply; xác minh các accepted row được ghi, skipped audit đủ và tuition không đếm dòng bị skip.
- [ ] Xác minh không có request Google và không còn temp binary sau apply/lỗi.
