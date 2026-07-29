# V16A-LEGACY-EXCEL-PREVIEW

## Phạm vi

Thêm luồng upload `.xlsx` đã xác thực trên chi tiết học sinh để đọc hai sheet
legacy, chuẩn hóa ngày, đối soát lesson/học phí và mô phỏng gói 8 buổi.

## Giới hạn

- Chỉ preview/audit; không ghi lesson, class, enrollment hoặc tuition.
- Không migration và không tích hợp Drive/Sheets.
- Một workbook mặc định là một ngữ cảnh grade/class lịch sử từ lesson đầu đến
  lesson cuối. Grade trong tên workbook được dùng làm đề xuất và vẫn cần user xác nhận;
  không tự tăng grade hay tách period theo mốc 01/06.
- Workbook thật chỉ được dùng cục bộ trong `.private-data` và không được commit/log.

## Kiểm tra

Unit parser/normalizer/reconciliation, HTTP integration bất biến dữ liệu, UI E2E
targeted và các gate bắt buộc trong task.
