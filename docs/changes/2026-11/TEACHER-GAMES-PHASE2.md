# Teacher Game Builder Phase 2 — giao diện tạo bài đơn giản

## Task level
**Level 3** (route allowlist trong auth boundary; bổ sung migration nullable có index/FK và trường metadata bài học). Không sửa token, payment, PDF hoặc deployment.

## Problem
Legacy Admin đang TEMP_DISABLED, giáo viên chỉ tới `/admin/tools`. Wizard từ vựng 6 bước không truy cập được trong giao diện hiện hành; chức năng tìm ảnh cũ thường bị 429; giáo viên cần dán từ theo giáo trình và lưu bản nháp bằng một trang.

## Decision
- Chỉ allowlist ba route có xác thực: `/admin/games`, `/admin/games/new`, `/admin/games/:id/edit` dưới `Protected`.
- Chỉ thêm một CTA **Soạn trò chơi từ vựng** vào Teacher Tools, không hồi sinh AdminLayout/legacy routes.
- Tận dụng endpoints, DTO, template, preview và assignment draft có sẵn; bổ sung migration append-only `0031_teacher_game_catalog.sql` trên bảng `learning_assignments`, **không** thêm service hoặc third-party runtime.
- Hỗ trợ dán từ bằng dấu phẩy/tab/chấm phẩy/` - `, hiển thị preview cục bộ, chọn bộ từ đã lưu, mẫu game và dự định người nhận, lưu/nhân bản bản nháp.
- **Only title required on DRAFT:** lớp/khối/sách/Unit/người nhận/từ vựng/hoạt động đều có thể để trống khi lưu nháp; nhóm trình độ và template có mặc định kỹ thuật. Đã chọn `CLASS` nhưng chưa chọn lớp nhận được lưu thành người nhận chưa xác định; không tự phát link hoặc giao bài. Dòng từ đã nhập mà lỗi/trùng vẫn phải được sửa để tránh mất dữ liệu.
- Giữ `VOCABULARY_GAMES_ENABLED=false`: không publish, không phát link/QR giả, không thay đổi dữ liệu game public. Không nói preview flashcard là lượt chơi thử.

## Alternatives
- Bật `LEGACY_ADMIN_ENABLED`: bác bỏ vì mở lại hàng loạt màn không liên quan.
- Xây game engine hoặc dùng source Next.js/Tailwind từ GitHub: bác bỏ vì đã có template + engine V20 và repo đang dùng React/MUI/Vite.
- Chỉ dùng tên bài chứa lớp/giáo trình/Unit: không đáp ứng lọc chính xác, khó dùng lại giữa các lớp và gây lẫn với người nhận. Chọn ba metadata tách biệt + khối lớp có migration an toàn; giá trị NULL với bài cũ.

## Changes
- Public header thêm entry đăng nhập giáo viên; giữ nguyên `Công cụ` tới public PDF `/tools`.
- Teacher Tools thêm card soạn trò chơi; **card PDF cũ không bị thay đổi hành vi**.
- Pages teacher games: danh sách, nhân bản, soạn bài + quick preview và lưu nháp.
- Phân loại hai tầng: `gradeLevel` = Mầm non (0)/Lớp 1–9; `teachingClassId` = lớp học cô quản lý. `textbookName` và `lessonName` là tên giáo trình và Unit. Đây là **tổ chức bài học**, độc lập `audienceType`/`classId` dùng khi giao bài.
- API danh sách lọc theo grade và teaching class, tìm trong title/textbook/lesson, phân trang; backend validate ID lớp và độ dài metadata. Nhân bản giữ bản gốc và cho phép chuyển bản sao sang lớp mới.
- Route allowlist mới và safe post-login redirect đúng route nếu người dùng truy cập trực tiếp.
- Tests kiểm tra parser, bảo toàn image, route bảo vệ auth và bất biến PDF; docs feature/current status cập nhật.

## Verification
- Targeted frontend typecheck/lint/unit, backend MySQL migration + validation/filter/duplicate regression, E2E browser 360/390/430 px và public tools/PDF smoke theo GitHub CI.
- Regression cho lưu bản nháp **chỉ có tên**, từ 0 hoặc 1; mở lại các trường optional vẫn trống, sau đó bổ sung từ/giáo trình; không thay đổi điều kiện publish hoặc bảo vệ public games.
- Kiểm tra sự khác biệt với branch Phase 1, phải không có source PDF/Worker hoặc download path bị sửa.
- UI manual: 360/390/430 px, đăng nhập, nhập/dán danh sách, từ trừu tượng không cần ảnh, xem thử, lưu, refresh/mở lại, nhân bản. Verify API failures không làm mất nội dung trong trang.
- **Không xác nhận production-ready chỉ từ CI**; feature chưa merge hoặc deploy.

## Rollback
Đóng draft PR / không merge nhánh Phase 2. Nếu đã deploy sau này, rollback code phải tương thích schema đã mở rộng; **không xóa column/index/foreign key hoặc dữ liệu bài cũ**. Migration chỉ thêm cột nullable, không backfill hoặc sửa lịch sử; có kiểm tra recovery DDL nếu crash sau ALTER trước khi ghi version.

## Remaining risks
- Phát hành link/QR và trò chơi học sinh vẫn tắt, sẽ xử lý ở phase sau với security/release review.
- Danh sách phân trang 50 bài/trang phía server; bộ từ nguồn vẫn nạp tối đa 50 bộ ở dropdown.
- Chỉ có thể chọn lớp học cụ thể đã tồn tại trong `/api/classes` (legacy class management vẫn TEMP_DISABLED); khối Mầm non/Lớp 1–9 có thể chọn ngay cả khi chưa có lớp học.
- Bài cũ có các metadata mới NULL, không tự suy đoán khối/lớp/Unit từ tên bài. Cần duyệt nghiệp vụ nếu sau này muốn gắn nhãn lại lịch sử.
- Data entry là text paste, không OCR PDF hoặc tự trích trang sách.
- Chưa nghiệm thu thao tác giáo viên trên thiết bị thật và môi trường production.
