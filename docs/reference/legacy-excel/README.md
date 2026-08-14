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

- `Quá trình học tập` giữ nội dung và nhận xét; thiếu dòng `Học phí` không làm lesson
  invalid, không tự tạo nợ và không tự gán `FREE`. Ngược lại, dòng chỉ có trong
  `Học phí` là hợp lệ và có thể tạo buổi học đã có ngày, giờ, attendance và học phí,
  còn nội dung/bài tập/nhận xét để trống sau khi cô xác nhận nhóm.
- Một workbook mặc định thuộc một grade/class context từ lesson đầu đến lesson cuối;
  không tự tách hoặc tăng grade tại 01/06.
- `20h5-22h`, `20h8-22h`, `20-22h` và `20h-21h35)` lần lượt giữ phút thực,
  bổ sung `:00` khi thiếu và loại dấu câu cuối. Dạng 12 giờ như `7h15-9h5` vẫn cần
  xác nhận; chuỗi mơ hồ hoặc duration trên sáu giờ không được tự Apply.
- Marker đã thu có thể đặt ở dòng bên dưới bằng chữ `PAID` tại cột F (file cũ) hoặc
  cột G. `TOTAL` và `TOTAL HOURS` đều kết thúc block nhưng vẫn được scan marker.
  `UNPAID` explicit nghĩa là chưa thu; block có cả `PAID` và `UNPAID` phải review.
- `PAID` chỉ chốt đúng tám dòng billable phía trước. Dòng billable phía sau vẫn là
  `PRESENT + BILLABLE` và bắt đầu cycle tiếp theo; chỉ marker `FREE` explicit mới tạo
  buổi miễn phí.
- Năm ngoài 2000–2100 bị chặn, không tự sửa typo như `0226` thành `2026`.
- Preview ưu tiên lớp hiện tại của học sinh khi lớp đó có trong danh sách lựa chọn;
  nếu không có lớp hiện tại mới fallback sang tạo lớp lịch sử đã đóng.
- Bulk review dùng equivalence riêng theo issue; backend vẫn validate từng row.
