# Teacher Game Builder Phase 2 — giao diện tạo bài đơn giản

## Task level
**Level 3** (route allowlist trong auth boundary, thay đổi đường dẫn sau đăng nhập). Không sửa auth mechanism, token, database, payment, PDF hoặc deployment.

## Problem
Legacy Admin đang TEMP_DISABLED, giáo viên chỉ tới `/admin/tools`. Wizard từ vựng 6 bước không truy cập được trong giao diện hiện hành; chức năng tìm ảnh cũ thường bị 429; giáo viên cần dán từ theo giáo trình và lưu bản nháp bằng một trang.

## Decision
- Chỉ allowlist ba route có xác thực: `/admin/games`, `/admin/games/new`, `/admin/games/:id/edit` dưới `Protected`.
- Chỉ thêm một CTA **Soạn trò chơi từ vựng** vào Teacher Tools, không hồi sinh AdminLayout/legacy routes.
- Tận dụng endpoints, DTO, template, preview và assignment draft có sẵn; không thêm migration, service, third-party runtime.
- Hỗ trợ dán từ bằng dấu phẩy/tab/chấm phẩy/` - `, hiển thị preview cục bộ, chọn bộ từ đã lưu, mẫu game và dự định người nhận, lưu/nhân bản bản nháp.
- Giữ `VOCABULARY_GAMES_ENABLED=false`: không publish, không phát link/QR giả, không thay đổi dữ liệu game public. Không nói preview flashcard là lượt chơi thử.

## Alternatives
- Bật `LEGACY_ADMIN_ENABLED`: bác bỏ vì mở lại hàng loạt màn không liên quan.
- Xây game engine hoặc dùng source Next.js/Tailwind từ GitHub: bác bỏ vì đã có template + engine V20 và repo đang dùng React/MUI/Vite.
- Tạo mới database/schema cho textbook metadata: hoãn. Tên sách/Unit được đặt trong tên bài, tránh migration khi MVP chưa xác định giáo trình.

## Changes
- Public header thêm entry đăng nhập giáo viên; giữ nguyên `Công cụ` tới public PDF `/tools`.
- Teacher Tools thêm card soạn trò chơi; **card PDF cũ không bị thay đổi hành vi**.
- Pages teacher games: danh sách, nhân bản, soạn bài + quick preview và lưu nháp.
- Route allowlist mới và safe post-login redirect đúng route nếu người dùng truy cập trực tiếp.
- Tests kiểm tra parser, bảo toàn image, route bảo vệ auth và bất biến PDF; docs feature/current status cập nhật.

## Verification
- Targeted frontend typecheck/lint/unit, backend regression và public tools/PDF browser smoke theo GitHub CI.
- Kiểm tra sự khác biệt với branch Phase 1, phải không có source PDF/Worker hoặc download path bị sửa.
- UI manual: 360/390/430 px, đăng nhập, nhập/dán danh sách, từ trừu tượng không cần ảnh, xem thử, lưu, refresh/mở lại, nhân bản. Verify API failures không làm mất nội dung trong trang.
- **Không xác nhận production-ready chỉ từ CI**; feature chưa merge hoặc deploy.

## Rollback
Đóng draft PR / không merge nhánh Phase 2. Nếu đã merge sau này, revert các file Phase 2; không có migration hay data backfill. Các draft do giáo viên tạo dùng assignment schema hiện có, không tự xóa trong rollback.

## Remaining risks
- Phát hành link/QR và trò chơi học sinh vẫn tắt, sẽ xử lý ở phase sau với security/release review.
- Danh sách chỉ nạp tối đa 50 bài/bộ từ ở UI Phase 2; chưa có phân trang.
- Data entry là text paste, không OCR PDF hoặc tự trích trang sách.
- Chưa nghiệm thu thao tác giáo viên trên thiết bị thật và môi trường production.
