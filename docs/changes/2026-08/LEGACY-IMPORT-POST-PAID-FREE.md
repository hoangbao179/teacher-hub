# Legacy Import post-paid FREE và invalid tuition date

## Task level

Level 3 — sửa semantics import hàng loạt liên quan attendance và cycle học phí.

## Problem

Sau hardening trước, mọi dòng billable sau `PAID` đều đi vào cycle kế tiếp. Điều này
không đúng với block thực tế nơi các buổi sau một cycle đã thu, nhưng trước `TOTAL`,
là buổi học miễn phí. Đồng thời parser bỏ qua tuition row khi date normalizer trả
`null`, khiến Preview và Apply không báo dữ liệu bị thiếu.

## Root cause

Engine đã bỏ toàn bộ concept post-paid FREE thay vì giới hạn nó theo clean block.
Parser dùng nhánh `if (!date) continue`, nên year guard chặn `0226` nhưng cũng làm
mất source row trước reconciliation.

## Decision

- Chỉ suy luận post-paid FREE khi cùng block có `PAID_CLEAR`: đúng tám billable trước
  marker, không có `UNPAID`, conflict hoặc invalid tuition date.
- Phạm vi FREE bắt đầu sau marker và dừng tại `TOTAL`/`TOTAL HOURS`; block kế tiếp
  trở lại BILLABLE.
- Matched lesson giữ nguyên content/homework/note; chỉ đổi attendance thành `FREE`
  và loại khỏi tuition cycle.
- Tuition-only post-paid row vẫn qua confirmation nhóm; nếu tạo thì là minimal
  lesson `FREE` và không tính học phí.
- Tuition entry có raw date không hợp lệ được giữ thành blocking preview issue có
  sheet, source row và raw value. UI yêu cầu sửa file rồi tải lại; Apply không được
  bỏ qua hoặc resolve giả bằng action hiện hành.

## Changes

Parser giữ invalid tuition rows riêng khỏi tập date hợp lệ. Reconciliation đánh dấu
post-paid rows sau khi block đạt `PAID_CLEAR`, rồi loại đúng các source rows đó khỏi
cycle plan. Preview bổ sung counter/copy dễ hiểu và blocking card cho ngày lỗi.

## Verification

Regression chỉ dùng workbook tổng hợp, không dùng workbook thật. Coverage gồm clean
8 + PAID + 2 + TOTAL, block kế tiếp 3/8, ambiguous 6 + PAID, matched history,
tuition-only FREE, raw `27/7/0226`, Apply blocking và control `27/7/2026`.

- Legacy domain/decision tests: 40/40 PASS.
- Client Legacy Import review tests: 7/7 PASS.
- Server integration: 83/83 PASS.
- Legacy Import E2E: PASS ở viewport 360–430 px.
- `npm run check:full`: PASS, gồm CI checks, integration và toàn bộ E2E.

## Documentation updated

- `docs/product-spec/03-business-rules.md`
- `docs/features/student-parent-tracking.md`
- `docs/reference/legacy-excel/README.md`
- `docs/implementation/status.md`

Không có schema, migration, deployment hoặc operations change.

## Rollback

Revert commit code và tài liệu trước khi import production. Không có migration để
rollback. Dữ liệu đã import phải được hoàn tác qua audit/import ID và quy trình phục
hồi DB riêng, không tự chuyển attendance/cycle về semantics cũ.

## Remaining risks

Marker/layout ngoài định dạng legacy đã hỗ trợ vẫn cần review. Block PAID không đúng
tám buổi, có marker conflict hoặc chứa tuition date lỗi không được auto-FREE.
