# V16A-LEGACY-EXCEL-PREVIEW

## Phạm vi

Thêm luồng upload `.xlsx` đã xác thực trên chi tiết học sinh để đọc hai sheet
legacy, chuẩn hóa ngày, đối soát lesson/học phí và mô phỏng gói 8 buổi.

## Giới hạn

- Chỉ preview/audit; không ghi lesson, class, enrollment hoặc tuition.
- Không migration và không tích hợp Drive/Sheets.
- Không suy khối từ tên file; khối và mapping lớp được trình bày theo từng năm học.
- Workbook thật chỉ được dùng cục bộ trong `.private-data` và không được commit/log.

## Kiểm tra

Unit parser/normalizer/reconciliation, HTTP integration bất biến dữ liệu, UI E2E
targeted và các gate bắt buộc trong task.
