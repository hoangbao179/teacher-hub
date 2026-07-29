# Legacy Excel

Không lưu workbook học sinh thật trong cây source này. Các workbook local phục vụ
đối chiếu thủ công phải đặt tại `.private-data/legacy-excel/` (đã bị Git, Docker và
source package loại trừ). Không đưa tên, số điện thoại hay lịch sử học thật vào fixture.

Các file này chỉ là dữ liệu tham khảo cho migration sau. V1 base không import tự động.

M6B chỉ triển khai canonical normalized export. Generic import, tự nhận diện cột
và parsing arbitrary workbook vẫn là một controlled migration task sau V1.

Trước khi import phải có preview, xác nhận grade/class context, làm sạch ngày/giờ
và không tin trực tiếp cột HOURS do Excel có thể tự chuyển thành serial date.

- `Quá trình học tập` là nguồn chuẩn của lesson; thiếu dòng `Học phí` không làm
  lesson invalid, không tự tạo nợ và không tự gán `FREE`.
- Một workbook mặc định thuộc một grade/class context từ lesson đầu đến lesson cuối;
  không tự tách hoặc tăng grade tại 01/06.
- `20h-21h35)` được chuẩn hóa thành `20:00-21:35`; raw time thực sự mơ hồ vẫn cần xác nhận.
- Bulk review dùng equivalence riêng theo issue; backend vẫn validate từng row.
