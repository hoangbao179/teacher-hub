# Legacy Import hardening

## Task level

Level 3 — thay đổi import hàng loạt có tác động tới attendance, cycle học phí và
khoảng hiệu lực dữ liệu persisted.

## Problem

Reconciliation từng coi các dòng sau một marker `PAID` rõ ràng là lesson miễn phí,
loại chúng khỏi cycle tiếp theo và suy luận giờ thiếu bằng dominant time của toàn
workbook. Apply cũng tính bounds chủ yếu từ learning lesson nên có thể không bao phủ
các tuition-only lesson đã được người dùng xác nhận.

## Root cause

Một giả định legacy đã gắn vị trí sau `PAID` với semantics `FREE`; cycle planner sau
đó chỉ nhận tám candidate trước marker. Preview và Apply dùng hai tập ngày khác nhau,
còn parser chưa phân biệt explicit `UNPAID` hay terminator `TOTAL HOURS`.

## Decision

- Chỉ marker `FREE` explicit quyết định miễn phí.
- `PAID` rõ ràng chốt đúng tám billable trước marker; billable phía sau bắt đầu cycle
  mới `UNPAID`. Marker mơ hồ vẫn review, không thêm advance/partial payment.
- Tuition-only là dữ liệu hợp lệ nhưng cần một confirmation theo nhóm trước khi tạo
  lesson thiếu nội dung/nhận xét.
- Runtime bounds được tính từ đúng tập ngày Apply sau decision.
- Time inference chỉ dùng hàng xóm gần; dữ liệu mơ hồ, duration trên sáu giờ và năm
  ngoài 2000–2100 không được tự sửa.
- Giữ field response `postPaidFree` ở trạng thái luôn `false` để tránh breaking API;
  field không còn tham gia attendance, billing, cycle hoặc UI semantics.

Quyết định cuối về `postPaidFree` đã được thay thế bởi follow-up
`LEGACY-IMPORT-POST-PAID-FREE.md`: field chỉ bật trong phạm vi clean `PAID → TOTAL`.

## Changes

Parser nhận phút một chữ số, `20-22h`, trailing punctuation, `TOTAL HOURS` và explicit
`UNPAID`. Preview ưu tiên lớp hiện tại, dùng copy tuition-only theo nghiệp vụ và chỉ
đếm FREE explicit. Apply đưa accepted tuition-only dates vào class/enrollment/policy
bounds và loại group đã skip khỏi cycle plan.

## Verification

Regression dùng workbook tổng hợp, không dùng workbook thật. Coverage gồm PAID +
billable tiếp theo, explicit FREE, create/skip tuition-only bounds, time formats và
duration guard, invalid year, TOTAL HOURS/UNPAID, current-class default, transaction,
idempotency và audit.

- Legacy domain/decision tests: 38/38 PASS.
- Legacy review unit: 7/7 PASS.
- Server integration: 82/82 PASS, gồm bounds create/skip và cycle sau PAID.
- Legacy Import E2E: PASS ở viewport 360–430 px.
- `npm run check:full`: PASS sau khi đồng bộ các E2E Student Detail với accordion
  `Công cụ nâng cao`; gồm CI checks, integration và toàn bộ E2E.

## Documentation updated

- `docs/product-spec/03-business-rules.md`
- `docs/features/student-parent-tracking.md`
- `docs/reference/legacy-excel/README.md`
- `docs/implementation/status.md`

Không có thay đổi schema, migration, architecture deployment hay thao tác production;
vì vậy không cần cập nhật tài liệu operations hoặc rollback migration.

## Rollback

Revert commit code và tài liệu trước khi import production. Không có migration để
rollback. Dữ liệu đã import bằng behavior mới không nên tự động chuyển về semantics
cũ; nếu cần hoàn tác dữ liệu phải dùng audit/import ID và quy trình phục hồi DB có
phê duyệt riêng.

## Remaining risks

Layout workbook ngoài hai sheet/cột legacy đã hỗ trợ vẫn bị chặn. Typos ngày/tháng,
chuỗi giờ mơ hồ, marker PAID không đúng tám buổi và conflict PAID/UNPAID tiếp tục cần
chỉnh workbook hoặc xác nhận thủ công. Workbook thật không nằm trong repository nên
fixture chỉ đại diện các pattern đã được mô tả và ẩn danh.
