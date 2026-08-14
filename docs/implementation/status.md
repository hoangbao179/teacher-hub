# Implementation status

File này chỉ mô tả trạng thái hiện hành của hệ thống. Lịch sử milestone, command và
evidence từng lần kiểm thử được giữ trong Git history.

## Runtime và phạm vi

- Monorepo chạy Node.js 24/npm 12 với React/Vite/MUI ở client, Express/MySQL ở
  server và shared contracts qua `@teacher/shared`.
- V1 vận hành cho một giáo viên/admin. Học sinh và phụ huynh không có tài khoản.
- Source of truth chi tiết nằm trong `docs/product-spec/`, `docs/features/`,
  `docs/decisions/` và `docs/api/openapi.yaml`.

## Chức năng hiện hành

- Quản lý lớp, học sinh, enrollment, khoảng hiệu lực và lịch sử bất biến.
- Lịch tuần, lịch bận, đối soát occurrence, đổi lịch, nghỉ, học bù, lớp học ghép và
  ghi nhận buổi học theo transaction.
- Học phí gói 8 buổi, giá lớp tùy chọn, thu trước, settlement đợt dở dang, chuyển
  lớp và biên giới `PAID` bất biến.
- Dashboard `Hôm nay` cho phép tạo/tiếp tục draft lịch thường bằng Simple Mode một
  màn và hoàn tất bằng một thao tác; lesson wizard bốn bước vẫn xử lý tạo thủ công,
  học bù, học thêm, học ghép và chỉnh sửa nâng cao. Calendar gom lớp riêng, lịch
  trường/trung tâm, lịch cá nhân, đổi lịch và học bù trên timeline có nhãn rõ; bề
  mặt chính chỉ giữ menu “Thêm”, còn tạo thủ công, học bù và đối soát tuần vẫn truy
  cập được như công cụ phụ. Tuition management và Excel report tiếp tục hoạt động
  trên desktop/mobile.
- Homepage công khai, Góc học, flashcard/quiz và thư viện sách Global Success với
  prerender/SEO hiện hành; trên mobile thư viện dùng hero gọn, bộ lọc lớp cuộn ngang
  nội bộ và CTA card toàn chiều rộng. Card dùng một hành động mở sách, reader riêng không có
  public header/footer, SGK có audio dùng FlipBuilder trên desktop và NXBGD trên
  mobile, còn SGV luôn dùng NXBGD. NXBGD có âm thanh lật trang UI tùy chọn nhưng
  không có audio bài học.
- Homepage đặt entry Góc học/Tủ sách trong hero; header public luôn có đường vào
  quản trị và `/hoc`–`/sach` dùng chung palette teal/pastel. Admin dùng sidebar từ
  1200 px, bottom navigation dưới breakpoint này; cả hai cùng ưu tiên năm khu vực
  hằng ngày. Account, Kho từ vựng và Bài tập từ vựng nằm trong menu avatar.
- Vocabulary topic/set/media, assignment, public game, result/mastery/review và
  Google Sheet tab ôn từ vựng.
- Legacy Excel preview/apply có reconciliation theo nhóm và transaction MySQL.
- Google Drive/Sheets dùng DB làm nguồn chuẩn, outbox sau commit và regenerate có
  giới hạn vùng hệ thống quản lý. Student Detail ưu tiên trạng thái đồng bộ thân
  thiện và CTA mở sổ phụ huynh; recovery/import nằm trong Công cụ nâng cao.
- CI chạy quality, integration, E2E smoke, schedule regression bắt buộc trước deploy
  và regression cho thao tác env deploy;
  nightly/manual workflow chạy full regression. Production deploy dùng image full
  commit SHA qua GHCR và VPS, xác thực env, kiểm tra storage headroom và giữ snapshot
  env nguyên tử cho image rollback; VPS tự giữ image API/Web hiện tại và đúng một thế hệ
  rollback thay vì tích lũy mọi tag SHA.

## Trạng thái phát hành

- Source hiện tại là release candidate đã qua các targeted/full local gates được
  ghi trong Git history; đây không phải phê duyệt production.
- Production vẫn cần operator cấu hình secrets, DNS, OAuth/provider, chạy backup và
  restore drill trên hạ tầng đích, đo tài nguyên với dữ liệu đại diện và duyệt nội
  dung/media công khai.
- Admin visual refresh đã triển khai; visual target được duyệt nằm trong
  `docs/wireframes/admin-ui-refresh/`.
- Vocabulary result/review đã triển khai nhưng chỉ được enable production sau khi
  hoàn tất provider/content review và restore drill MySQL + media.
- Bản nghe chuyên biệt và chế độ đọc SGK desktop phụ thuộc FlipBuilder;
  hotspot/audio/fullscreen cần kiểm tra thủ công trên thiết bị thật trước release.

## Giới hạn hiện hành

Xem [`known-limitations.md`](known-limitations.md) và các mục “quyết định còn mở”
trong feature doc liên quan. Không suy diễn các gate vận hành chưa hoàn tất thành
lỗi chức năng hoặc bằng chứng production.
