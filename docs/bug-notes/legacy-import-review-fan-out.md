# Legacy import review fan-out

## Symptom

Một workbook lịch sử có thể sinh hàng chục card “unresolved” dù người vận hành chỉ
cần vài quyết định nghiệp vụ, làm preview khó duyệt và dễ map sai cycle.

## Root cause

Ba nguyên nhân kết hợp: parser giả định cột cố định; near matching đánh dấu row đã
dùng trước khi reserve toàn bộ exact match; learning-only/tuition-only tạo quyết
định riêng cho từng dòng.

## Resolution

- Tìm header theo label thay vì vị trí cột cố định.
- Reserve toàn bộ exact match trước, sau đó near match theo thứ tự workbook và
  khoảng cách ngày.
- Gom các issue tương đương thành grouped decision.
- Giữ `tuitionCyclePlans` theo source row từ Preview tới Apply; không regroup
  global trong bước ghi dữ liệu.
- Validate cycle `PAID` đủ 8 member, không trùng và không gồm `FREE`/`ABSENT`/`OFF`
  trước insert.

## Regression coverage

Giữ fixture ẩn danh cho long-history, shifted columns, no-PAID,
`V`/`OFF`/duplicate-date và kiểm tra Preview → Apply giữ nguyên member từng cycle.

## Related files

- `server/src/domain/legacy-import-preview.ts`
- `server/src/domain/legacy-import-decisions.ts`
- `server/src/repositories/legacy-import.repository.ts`
- `client/src/features/legacy-import-review.ts`
- `client/src/pages/LegacyImportPage.tsx`
- `docs/features/student-parent-tracking.md`

## Remaining risks

Workbook thật không được lưu trong source. Layout mới chưa có fixture phải được ẩn
danh trước khi thêm regression coverage.
