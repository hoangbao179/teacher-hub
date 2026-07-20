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
  giờ dự kiến/thực tế, duration, nội dung, bài tập và nhận xét.
- `Học phí`: chỉ stored cycle items billable theo stored sequence; dùng snapshot
  giá và payment data đã lưu, không suy lại từ cấu hình lớp hiện tại.
- `Tổng hợp`: aggregate bounded từ hai tập dữ liệu report.

Header được freeze/filter, text dài wrap, ngày hiển thị `dd/MM/yyyy`, tiền là số
nguyên VND. Text bắt đầu bằng `=`, `+`, `-`, `@` được prefix apostrophe để không
trở thành công thức. Workbook không có macro, external link, credential hoặc dữ
liệu học sinh khác.

## Legacy files

Workbook xuất là normalized canonical output và không mô phỏng cấu trúc file cũ.
Generic import và parsing arbitrary legacy Excel bị hoãn sang một migration task
riêng sau V1.
