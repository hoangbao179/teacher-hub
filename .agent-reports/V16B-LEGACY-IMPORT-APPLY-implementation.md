# V16B-LEGACY-IMPORT-APPLY Implementation

## Phạm vi

Review, resolve và Apply workbook Excel lịch sử vào canonical MySQL; không tích hợp Google.

## Vấn đề đã sửa

- Thêm lifecycle từng dòng, structured decision, skip có lý do và bulk guard.
- Apply atomic/idempotent, exact/near lesson matching, attendance riêng và audit đầy đủ.
- Chu kỳ 8 buổi tiếp tục theo học sinh qua enrollment, giữ ranh giới `PAID` và hỗ trợ `ABSENT_CHARGED` có xác nhận.
- Hoàn thiện UI mobile review/confirm/result và E2E 360–430 px.

## File chính đã đổi

Contracts legacy/lesson/tuition, migration `0012`, legacy domain/service/repository/controller, tuition allocation, trang Legacy Import và tài liệu V16B.

## API/schema thay đổi

- Thêm `POST /api/students/{studentId}/legacy-imports/apply` multipart.
- Thêm ba bảng audit/import/link và mở rộng attendance `ABSENT_CHARGED`.

## Kiểm tra đã chạy

Typecheck, lint, unit, native MySQL integration, targeted/full E2E, full/repository gates và smoke workbook thật đã ẩn danh.

## Điểm còn lại

Google Drive/Sheets tiếp tục thuộc V16C–V16E.

## Commit

`feat(import): áp dụng dữ liệu Excel lịch sử`
