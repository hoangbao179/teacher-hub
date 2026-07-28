# Excel reports

## Canonical export

Giáo viên mở chi tiết học sinh và chọn **Xuất báo cáo Excel**. Client chỉ bắt đầu
download đã xác thực; server đọc MySQL authoritative và trả XLSX. Không dựng
workbook từ state React và không lưu workbook vào database hoặc file tạm.

Endpoint:

```text
GET /api/students/{studentId}/export.xlsx?fromDate=&toDate=&classId=
```

- `fromDate`/`toDate` là inclusive theo `lesson_sessions.session_date`.
- `classId` cho phép lọc lịch sử nhưng phải thuộc một enrollment của học sinh.
- Mỗi sheet bị giới hạn 5.000 data rows để memory có biên rõ ràng.
- Audit `STUDENT_REPORT_EXPORTED` lưu actor, student ID, filters và timestamp.

## Workbook

- `Quá trình học tập`: một dòng/attendance hoàn thành, gồm PRESENT/ABSENT/FREE,
  giờ dự kiến, nội dung, bài tập và nhận xét học sinh.
- `Học phí`: chỉ stored cycle items billable theo stored sequence; dùng snapshot
  và payment data đã lưu, không suy lại từ cấu hình lớp hiện tại. Thông tin đầu
  chu kỳ được gộp dọc theo các dòng ngày học thuộc cùng chu kỳ.
- `Tổng hợp`: aggregate bounded từ hai tập dữ liệu report.

Header được freeze/filter, text dài wrap, ngày hiển thị `dd/MM/yyyy`, tiền là số
nguyên VND. Text bắt đầu bằng `=`, `+`, `-`, `@` được prefix apostrophe để không
trở thành công thức. Workbook không có macro, external link, credential hoặc dữ
liệu học sinh khác.

## Legacy files

Workbook xuất là normalized canonical output và không mô phỏng cấu trúc file cũ.
V16B đã parse/preview controlled workbook legacy theo student và chỉ ghi database
sau khi structured decisions được xác nhận; workbook gốc chỉ là migration source, binary
không được giữ lâu dài theo mặc định. Google Sheet V16C–V16E sẽ được dựng từ dữ
liệu canonical trong DB, không convert hoặc chia sẻ nguyên trạng workbook cũ.
