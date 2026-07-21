# Admin UI

Khu vực `/admin/*` dành cho một tài khoản Cô Vy. Giao diện mobile-first, dùng dữ
liệu từ API và không tự suy diễn học phí/trạng thái. Phong cách pastel có tiết chế:
Admin bình tĩnh và dày thông tin hơn Homepage, vẫn giữ nhận diện giáo dục phù hợp
học sinh lớp 1–9, không tạo cảm giác mầm non.

## Responsive và navigation

- Viewport hỗ trợ chính: 360, 375, 390, 393, 400, 412 và 430 px; kiểm tra thêm
  tablet và desktop 1440 px.
- Mobile có năm mục bottom navigation một dòng: Hôm nay, Lịch, Lớp học, Học phí,
  Học sinh; có safe-area và sticky actions luôn nằm phía trên navigation.
- Desktop chuyển sang sidebar cố định ở breakpoint phù hợp; nội dung không dùng
  bảng rộng cho thao tác cốt lõi.

## Phân cấp màu

- Dashboard metric: lavender cho học phí, mint cho buổi cần xác nhận, soft blue cho lịch;
  thao tác nhanh dùng grid một nút chính và hai nút phụ bằng nhau.
- Mỗi lớp có accent pastel ổn định tính từ `classId`, dùng nhất quán ở card/lịch mà không
  thay schema. ACTIVE: green; PAUSED: warm orange; CLOSED: neutral outline.
- Học sinh dùng avatar pastel ổn định theo ID và progress bar tím rõ, không tạo dữ
  liệu giả ở client.
- Lesson wizard: Thông tin blue, Điểm danh mint, Nội dung yellow, Xác nhận purple;
  nhãn/số vẫn truyền đạt trạng thái khi không nhìn màu.
- Học phí: Chưa đủ 8 buổi blue, Cần thu orange, Đã thu green, Dở dang neutral.
  Không hiển thị raw enum.

## Bộ lọc và biểu mẫu

- Danh sách học sinh tìm theo họ tên, tên gọi và lớp; mặc định A–Z, hỗ trợ Z–A và lọc
  Đang học/Tạm dừng/Đã nghỉ/Miễn phí/Cần thu ở dialog mobile.
- Học phí mobile chỉ để search và nút **Lọc** trên mặt chính; trạng thái/lớp/sắp xếp
  được áp dụng một lần từ dialog. Desktop giữ filter inline.
- Lớp mới mặc định môn Tiếng Anh, giá để trống và format VND; form chia Thông tin lớp,
  Học phí, Lịch học hằng tuần và Ghi chú.
- Giao diện lịch dùng **Xác nhận lịch dạy**/**Kiểm tra lịch tuần**. Input ngày/giờ tiếp
  tục dùng native picker cho iPhone/Android.

## Ranh giới hành vi

Greeting và metric dashboard đến từ authenticated user/API. Class/student/lesson/
tuition/schedule giữ nguyên state machine và server authority. Màu sắc chỉ hỗ trợ
scan; status luôn có nhãn tiếng Việt. Loading, empty, error, disabled và focus state
phải rõ, touch target tối thiểu 44 px.
