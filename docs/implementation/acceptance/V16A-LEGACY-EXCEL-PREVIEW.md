# V16A-LEGACY-EXCEL-PREVIEW Acceptance

- [x] Parser giữ mọi block ở `Quá trình học tập` và đọc `Học phí` chỉ để đối chiếu.
- [x] Ngày thiếu năm được suy từ dữ liệu workbook; ngày nghi sai chỉ được đề xuất.
- [x] Có đủ bảy trạng thái đối soát và payment event mơ hồ không bị tự quyết định.
- [x] Preview mặc định tạo một grade/class context cho cả workbook, không tự tách
  theo 01/06; grade trong tên file chỉ điền đề xuất để người dùng xác nhận.
- [x] Gói học phí được mô phỏng đúng 8 buổi PRESENT billable.
- [x] Endpoint multipart chỉ nhận XLSX tối đa 10 MB, kiểm tra MIME/signature, SHA-256 và xóa temp.
- [x] Endpoint cần auth và không ghi lesson/class/enrollment/tuition.
- [x] Route import nằm trong module Học sinh, có quay lại và không overflow ở 360–430 px.
- [x] Các gate build/typecheck/test/integration/lint/E2E/check:full/check:repo PASS.
