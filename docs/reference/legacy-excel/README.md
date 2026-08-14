# Legacy Excel

Không lưu workbook học sinh thật trong cây source này. Các workbook local phục vụ
đối chiếu thủ công phải đặt tại `.private-data/legacy-excel/` (đã bị Git, Docker và
source package loại trừ). Không đưa tên, số điện thoại hay lịch sử học thật vào fixture.

Runtime hiện hỗ trợ **Legacy Import** có kiểm soát theo từng học sinh: cô Vy chủ động
chọn file `.xlsx`, xem preview, xử lý các dòng cần xác nhận/bị chặn rồi mới apply.
Hệ thống không tự quét hoặc tự import workbook trong `.private-data/`.

Generic import, tự nhận diện mọi kiểu cột và parsing arbitrary workbook không được
hỗ trợ. Importer hiện hành chỉ nhận cấu trúc legacy chuẩn với hai sheet `Quá trình
học tập` và `Học phí`; giới hạn chi tiết nằm trong
[`../../implementation/known-limitations.md`](../../implementation/known-limitations.md).

Trước khi import phải có preview, xác nhận grade/class context, làm sạch ngày/giờ
và không tin trực tiếp cột HOURS do Excel có thể tự chuyển thành serial date.

- `Quá trình học tập` là nguồn chuẩn của lesson; thiếu dòng `Học phí` không làm
  lesson invalid, không tự tạo nợ và không tự gán `FREE`.
- Một workbook mặc định thuộc một grade/class context từ lesson đầu đến lesson cuối;
  không tự tách hoặc tăng grade tại 01/06.
- `20h-21h35)` được chuẩn hóa thành `20:00-21:35`; raw time thực sự mơ hồ vẫn cần xác nhận.
- Marker đã thu có thể đặt ở dòng bên dưới bằng chữ `PAID` tại cột F (file cũ) hoặc cột G. Màu nền chỉ để dễ nhìn và không ảnh hưởng nhận diện.
- Bulk review dùng equivalence riêng theo issue; backend vẫn validate từng row.
