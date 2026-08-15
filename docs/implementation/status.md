# Implementation status

File này là canonical **CURRENT IMPLEMENTATION STATUS** và chỉ mô tả trạng thái
hiện hành của hệ thống. Lịch sử milestone, command và evidence từng lần kiểm thử
được giữ trong Git history.

## Runtime và phạm vi

- Monorepo chạy Node.js 24/npm 12 với React/Vite/MUI ở client, Express/MySQL ở
  server và shared contracts qua `@teacher/shared`.
- V1 vận hành cho một giáo viên/admin. Học sinh và phụ huynh không có tài khoản.
- Business rule và thiết kế chi tiết nằm trong `docs/product-spec/`, `docs/features/`,
  `docs/decisions/` và `docs/api/openapi.yaml`; các tài liệu này có thể giữ context
  lịch sử nên phải đối chiếu file này và code khi xác định feature hiện đang bật.

## Phân loại trạng thái feature

- **ACTIVE**: đang hoạt động và phù hợp để dùng thực tế.
- **ADVANCED**: đã hoạt động nhưng dành cho ngoại lệ hoặc thao tác không thuộc happy path.
- **DEVELOPING**: bề mặt liên quan đã có nhưng chức năng còn đang hoàn thiện.
- **TEMP_DISABLED**: source/domain được giữ nguyên nhưng entry point đang chủ động tắt.

### ACTIVE — dùng thực tế

- **Lớp và học sinh**: quản lý lớp 1–1/lớp nhóm, học sinh, enrollment, khoảng hiệu
  lực, chuyển lớp, tạm dừng/ngừng học và lịch sử bất biến.
- **Schedule**: Calendar hiển thị chung lớp riêng, lịch trường/trung tâm, lịch cá
  nhân, lịch đổi và học bù. Lịch trường/trung tâm chỉ là busy slot, không tạo học
  sinh, attendance hoặc học phí. Desktop Calendar dùng từng ngày một hàng và card
  sự kiện responsive; occurrence chưa ghi mở thông tin lớp thay vì tự chuyển vào
  Reconciliation.
- **Lesson recording**: Dashboard `Hôm nay` là happy path. Với buổi thường chưa ghi,
  nút **Ghi buổi** tạo draft rồi mở Simple Mode một màn; học sinh mặc định có mặt,
  cô chỉ đánh dấu em nghỉ nếu có, nhập nội dung/nhận xét tùy chọn và chọn **Lưu &
  hoàn tất**. Manual flow vẫn tồn tại dưới nhãn **Buổi học ngoài lịch** và full
  lesson wizard vẫn tồn tại cho chỉnh sửa đầy đủ.
- **Học phí**: `/admin/tuition` hiển thị một row cho mỗi học sinh đang học hoặc còn
  khoản `PAYMENT_DUE`/`INCOMPLETE` chưa xử lý sau khi nghỉ, ưu tiên khoản cần thu,
  tổng hợp rõ nhiều khoản còn nợ và phân biệt đang theo dõi/chưa cấu hình/miễn học phí.
  Lịch sử cycle ở `/admin/tuition/history`; gói đúng 8 buổi, thu trước, xử lý đợt
  dở, chuyển lớp và biên `PAID` bất biến tiếp tục hoạt động trên desktop/mobile.
- **Google Sheet học sinh/phụ huynh**: Teacher Hub database là nguồn chuẩn; lesson
  hoàn thành và học phí được đồng bộ sang sổ phụ huynh. Student Detail ưu tiên trạng
  thái dễ hiểu, CTA mở sổ và sao chép liên kết.
- **Legacy Import**: import lịch sử theo từng học sinh từ file `.xlsx` tối đa 10 MB
  với hai sheet chuẩn `Quá trình học tập` và `Học phí`. Luồng preview cho phép xử lý
  dòng cần xác nhận/bị chặn trước khi apply; apply transactionally, chống import
  trùng theo student + SHA-256 và không hỗ trợ generic workbook tùy ý. Dòng chỉ có
  học phí được xác nhận theo nhóm để tạo buổi thiếu nhận xét. Trong clean block có
  đúng tám billable trước `PAID`, dòng thường sau marker đến trước `TOTAL` được lưu
  `FREE`; block mơ hồ không tự suy luận. Raw tuition date lỗi còn trong Preview và
  chặn Apply. Mapping lớp mặc định ưu tiên lớp hiện tại của học sinh.
- **Public**: Homepage chỉ quảng bá dịch vụ Tiếng Anh lớp 1–9 tại Huế. Catalog Mầm
  non vẫn tồn tại riêng trong Góc học miễn phí. Góc học, flashcard/quiz, Tủ sách và
  prerender/SEO đang hoạt động.
- **Admin shell và vận hành**: desktop có sidebar, mobile có bottom navigation năm
  mục; Account, Kho từ vựng và Bài tập từ vựng nằm trong menu avatar. CI/deploy,
  backup và rollback hiện hành được mô tả trong tài liệu operations.

### ADVANCED — có nhưng không nằm happy path

- **Reconciliation**: dùng cho lịch cũ, buổi chưa xử lý và ngoại lệ; không còn là
  bước bắt buộc trước khi ghi buổi thường hằng ngày. Trên desktop đây là màn vận
  hành rộng vừa, có bộ lọc một hàng và danh sách occurrence hai cột khi đủ chỗ.
- **Học bù và đổi lịch**: tạo học bù, đổi một buổi hoặc đổi lịch tạm thời vẫn giữ
  business rule, preview conflict và lịch sử nguồn.
- **Combined class**: nhóm lớp học ghép và combined teaching occurrence vẫn dùng
  canonical parent flow riêng.
- **Full lesson wizard**: tạo buổi thủ công, học thêm, học bù, học ghép và chỉnh sửa
  kỹ thuật vẫn dùng flow đầy đủ.
- **Google Sheet recovery**: đồng bộ lại, retry creation, tạo lại nội dung Sheet,
  archive và chi tiết lỗi không bị xóa nhưng nằm trong **Công cụ nâng cao**.

### DEVELOPING

- **Account settings**: trang tài khoản hiện có tên hiển thị, username, trạng thái
  đăng nhập và đăng xuất. Đổi mật khẩu/cập nhật thông tin trong UI chưa hoàn thiện;
  trang không hiển thị action giả.

### TEMP_DISABLED

- **Vocabulary public game**: `VOCABULARY_GAMES_ENABLED = false`. Các route `/play/*`
  hiển thị “Trò chơi đang được hoàn thiện” và dẫn về `/hoc`; action giao/chia sẻ game
  bị ẩn. Source engine, API, schema và dữ liệu vẫn được giữ để bật lại sau.

## Trạng thái phát hành

- Source hiện tại là release candidate đã qua các targeted/full local gates được
  ghi trong Git history; đây không phải phê duyệt production.
- Production vẫn cần operator cấu hình secrets, DNS, OAuth/provider, chạy backup và
  restore drill trên hạ tầng đích, đo tài nguyên với dữ liệu đại diện và duyệt nội
  dung/media công khai.
- Admin visual refresh đã triển khai; visual target được duyệt nằm trong
  `docs/wireframes/admin-ui-refresh/`.
- Vocabulary public game/result/review đã có source nhưng đang `TEMP_DISABLED`; chỉ
  bật lại sau khi hoàn tất provider/content review và restore drill MySQL + media.
- Bản nghe chuyên biệt và chế độ đọc SGK desktop phụ thuộc FlipBuilder;
  hotspot/audio/fullscreen cần kiểm tra thủ công trên thiết bị thật trước release.

## Giới hạn hiện hành

Xem [`known-limitations.md`](known-limitations.md) và các mục “quyết định còn mở”
trong feature doc liên quan. Không suy diễn các gate vận hành chưa hoàn tất thành
lỗi chức năng hoặc bằng chứng production.
