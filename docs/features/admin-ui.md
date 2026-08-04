# Admin UI

Khu vực `/admin/*` dành cho một tài khoản Cô Vy. Giao diện mobile-first, dùng dữ
liệu từ API và không tự suy diễn học phí/trạng thái. Phong cách pastel có tiết chế:
Admin bình tĩnh và dày thông tin hơn Homepage, vẫn giữ nhận diện giáo dục phù hợp
học sinh lớp 1–9, không tạo cảm giác mầm non.

Visual refresh đã được duyệt dùng teal làm primary, kết hợp mint, sky blue, peach
và coral có tiết chế. Đây chỉ là thay đổi trình bày; route, API, validation, state
machine, query/cache, dữ liệu và hành vi hiện có không thay đổi.

## Trạng thái triển khai

**IMPLEMENTED – PENDING FINAL VISUAL REVIEW** từ 29/07/2026. Phạm vi đã áp dụng gồm
theme Admin tách khỏi Homepage, login, desktop sidebar/topbar, mobile header/bottom
navigation, Dashboard và các surface/control dùng chung trong `UiKit`. Illustration
greeting/sidebar dùng WebP local; không thêm route, menu, API, query, dữ liệu demo hay
feature từ annotated board.

Dashboard đã được chụp và audit tại 1440×900, 1366×768, 390×844 và 360×800. Client
typecheck, lint, unit test, production build, Playwright responsive/navigation smoke
và gate `npm run check:full` đã PASS. Chi tiết triển khai và khác biệt có chủ đích nằm tại
[`../design/admin-ui-visual-refresh.md`](../design/admin-ui-visual-refresh.md).

## Responsive và navigation

- Viewport hỗ trợ chính: 360, 375, 390, 393, 400, 412 và 430 px; kiểm tra thêm
  tablet và desktop 1440 px.
- Mobile có năm mục bottom navigation một dòng: Hôm nay, Lịch, Lớp học, Học phí,
  Học sinh; có safe-area và sticky actions luôn nằm phía trên navigation.
- Sidebar cố định chỉ xuất hiện từ `lg` (1200 px); dưới `lg` nội dung full-width
  và bottom navigation năm mục tiếp tục hoạt động.
- Menu tài khoản trên top bar mở được bằng chuột hoặc bàn phím, cung cấp Kho từ
  vựng, Bài tập từ vựng, Tài khoản và Đăng xuất. Ba route phụ không được nhồi vào
  bottom navigation.

## Phân cấp màu và minh họa

- Dashboard dùng teal cho primary action và active navigation; mint, sky blue,
  peach và coral hỗ trợ phân nhóm metric/trạng thái. Thao tác nhanh dùng grid một
  nút chính và hai nút phụ bằng nhau.
- Mỗi lớp có accent pastel ổn định tính từ `classId`, dùng nhất quán ở card/lịch mà không
  thay schema. ACTIVE: green; PAUSED: warm orange; CLOSED: neutral outline.
- Học sinh dùng avatar pastel ổn định theo ID và progress bar có tương phản rõ,
  không tạo dữ liệu giả ở client.
- Lesson wizard: Thông tin sky blue, Điểm danh mint, Nội dung peach, Xác nhận teal;
  nhãn/số vẫn truyền đạt trạng thái khi không nhìn màu.
- Học phí: Chưa đủ 8 buổi blue, Cần thu orange, Đã thu green, Dở dang neutral.
  Không hiển thị raw enum.
- Minh họa Admin phải là static asset local đã tối ưu; không gọi API ảnh bên ngoài
  ở runtime. Ảnh trang trí dùng `alt=""` và `aria-hidden="true"`, không chứa text
  quan trọng và không thay thế icon của thư viện hiện tại.
- Annotated board chỉ định hướng palette, spacing, hierarchy, icon và illustration.
  Không tạo dữ liệu giả, metric, section hoặc feature chỉ vì chúng xuất hiện trong ảnh.

## Bộ lọc và biểu mẫu

- Danh sách lớp mặc định hiển thị lớp **Đang dạy** và **Tạm dừng** trong bộ lọc **Đang
  quản lý**. Lớp **Đã đóng** vẫn truy cập được qua bộ lọc; tìm kiếm tên lớp chạy client-side.
- Danh sách học sinh tìm theo họ tên, tên gọi và lớp; mặc định A–Z, hỗ trợ Z–A và lọc
  Đang học/Tạm dừng/Đã nghỉ/Miễn phí/Cần thu ở dialog mobile.
- Học phí mobile chỉ để search và nút **Lọc** trên mặt chính; trạng thái/lớp/sắp xếp
  được áp dụng một lần từ dialog. Desktop giữ filter inline.
- Lớp mới mặc định môn Tiếng Anh, giá để trống và format VND; form chia Thông tin lớp,
  Học phí, Lịch học hằng tuần và Ghi chú.
- Giao diện lịch dùng **Xác nhận lịch dạy**/**Kiểm tra lịch tuần**. Input ngày/giờ tiếp
  tục dùng native picker cho iPhone/Android. Các buổi backend `DRAFT` được diễn đạt là
  buổi cần/đang ghi nhận, không hiển thị thuật ngữ kỹ thuật “bản nháp” trong màn xác nhận.

## Ranh giới hành vi

Greeting và metric dashboard đến từ authenticated user/API. Class/student/lesson/
tuition/schedule giữ nguyên state machine và server authority. Màu sắc chỉ hỗ trợ
scan; status luôn có nhãn tiếng Việt. Loading, empty, error, disabled và focus state
phải rõ, touch target tối thiểu 44 px.
