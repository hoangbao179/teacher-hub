# Excel reports

`GET /api/students/{studentId}/export.xlsx` đọc MySQL authoritative và tạo một sheet
**Quá trình học tập**. Bộ lọc `fromDate`, `toDate`, `classId` là tùy chọn; class phải
thuộc lịch sử ghi danh của học sinh. Export được audit nhưng bytes không được lưu.

Mỗi row là attendance của lesson completed, gồm ngày, lớp, loại buổi, giờ dự kiến,
trạng thái, nội dung, bài tập và nhận xét học sinh. `ABSENT` tô đỏ nhạt. Header freeze,
text wrap, ngày `dd/MM/yyyy`; chuỗi bắt đầu bằng
`= + - @` được prefix apostrophe để chặn formula injection.

Workbook không chứa sheet payment/cycle và không dùng làm import. Legacy Import và
schema của nó đã được gỡ bỏ.
