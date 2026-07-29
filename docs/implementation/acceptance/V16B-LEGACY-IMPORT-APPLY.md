# V16B-LEGACY-IMPORT-APPLY Acceptance

Trạng thái: **PASS on 26/07/2026**. Các tiêu chí dưới đây đã được xác minh bằng
unit/integration/E2E, gate toàn repository và smoke workbook thật đã ẩn danh trong
môi trường restricted; không lưu workbook hoặc log chứa dữ liệu riêng tư.

## Functional acceptance

- [x] File đúng student và chưa import có thể review rồi apply vào canonical DB.
- [x] `VALID` được accepted không cần thao tác; `NEEDS_REVIEW` và `BLOCKED` làm nút Apply disabled.
- [x] Mỗi `NEEDS_REVIEW` có structured decision và chỉ thành `RESOLVED`/`SKIPPED` sau validation.
- [x] `BLOCKED` chỉ thành `RESOLVED` sau khi dữ liệu hợp lệ hoặc thành `SKIPPED`; không có force-import raw invalid row.
- [x] Một dòng lỗi không bắt buộc hủy toàn file khi admin có quyền skip, nhập lý do hợp lệ và các dòng còn lại đã sẵn sàng.
- [x] File-level error chặn cả file và không thể được giải quyết bằng skip row.
- [x] File không khớp student bị chặn; workbook không tự tách grade/class theo 01/06.
- [x] Student 1–1 và group dùng cùng model; file nhiều student dùng lại exact lesson nhưng có participant/attendance/note riêng.
- [x] Exact match dùng class/date/scheduled start/end; near duplicate bắt buộc user quyết định.
- [x] Duplicate/near-match có decision ghép lesson hiện có, tạo lesson mới hoặc bỏ qua; không tự merge.
- [x] Có action sửa ngày, map period/class, chọn attendance, giữ/dùng content, chỉnh thủ công và bỏ qua dòng theo đúng issue.
- [x] `PRESENT`, `ABSENT`, `FREE` có billable semantics đúng; chỉ `PRESENT` tính phí.
- [x] Cycle đủ 8, cycle dở, paid rõ và payment chưa rõ được xử lý đúng feature spec; không nhóm cứ tám dòng Excel.
- [x] Conflict content/homework không bị ghi đè; comment file student là note riêng và comment giống nhau chỉ được gợi ý gộp.
- [x] Bulk decision dùng equivalence riêng theo issue, hiển thị affected row count
  thực tế và cần confirmation trước khi thay đổi state; backend validate từng row.
- [x] Workbook chỉ là migration source; Sheet sau này phải được dựng từ DB.

## Transaction/idempotency

- [x] Apply nhiều bảng commit toàn bộ hoặc rollback toàn bộ.
- [x] Tất cả `VALID + RESOLVED` được ghi trong cùng transaction; lỗi database mutation hoặc audit write rollback toàn bộ.
- [x] Unique student + SHA-256 bảo đảm replay trả idempotent và không tạo record/audit lần hai.
- [x] Metadata filename/size/SHA/status/applied time được lưu; temp binary luôn được xóa.
- [x] Retry một lỗi Google trong checkpoint sau không thể gọi apply DB lần hai.
- [x] `PAID` và item liên quan bất biến; late-entry conflict rollback đúng.
- [x] Mọi structured decision có issue/action/payload, decided by/at và before/after phù hợp.
- [x] `SKIPPED` lưu source sheet/row, raw hoặc sanitized snapshot, issue code, skip reason, decided by/at.
- [x] `SKIPPED` không tạo business row, không ảnh hưởng bộ đếm/cycle học phí.

## Privacy/isolation

- [x] Không log/fixture/response chứa workbook bytes, dữ liệu thật hoặc secret.
- [x] Group import không làm lộ note/nội dung định danh của student khác.
- [x] Original filename được sanitize; workbook không được đưa vào vùng chia sẻ parent.
- [x] Raw/sanitized skipped-row snapshot được giới hạn truy cập và không bị đưa vào log/client ngoài nhu cầu review.

## Responsive admin UI

- [x] Preview/confirm/apply có loading, error, retry an toàn và confirmation rõ.
- [x] Không page-level horizontal scroll tại 360, 375, 390, 393, 400, 412, 430 px.
- [x] Near match/conflict/payment review có action thật, không dùng raw enum.
- [x] UI hiển thị summary theo trạng thái, số unresolved/blocked và affected count trước bulk decision.

## Google failure behavior

- [x] V16B không import Google dependency và không gọi Google trong hoặc ngoài DB transaction.
- [x] Test kiến trúc chứng minh apply không phụ thuộc OAuth/Drive/Sheets availability.
- [x] Skipped row không tạo outbox/sync payload và không xuất hiện trên Google Sheet ở test contract liên checkpoint.

## Native MySQL integration

- [x] Migration mới chạy trên MySQL native và có constraints/index/idempotency key phù hợp.
- [x] Integration test kiểm tra exact match, multi-student group, rollback, replay, cycle dở xuyên enrollment và `PAID` boundary.
- [x] Integration test bao phủ mixed valid/resolved/skipped rows, unresolved guard, file-level error, bulk-decision guard và mutation failure rollback.

## Fake Google provider tests

- [x] Không cần fake provider trong production path V16B; boundary test dùng fake “không được gọi” và fail nếu có invocation.

## Manual production smoke test

- [x] Dùng workbook đã ẩn danh trong restricted environment: preview, apply, replay cùng SHA và xác minh DB/audit.
- [x] Với một row lỗi, quyết định skip rồi Apply; xác minh các accepted row được ghi, skipped audit đủ và tuition không đếm dòng bị skip.
- [x] Xác minh không có request Google và không còn temp binary sau apply/lỗi.
