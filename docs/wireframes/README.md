# Visual reference policy

Các PNG P0 đánh số 01–18 trong thư mục này là lịch sử thiết kế workflow và phân
cấp thông tin ban đầu. Không cần di chuyển hàng loạt vì sẽ tạo diff binary nhiễu.

Screenshot đã duyệt trong `v2-branding/` được chụp từ ứng dụng chạy thật và là
tham chiếu styling hiện hành cho màn hình tương ứng. Khi có V2, không hoàn nguyên
màu sắc/layout về P0. P0 vẫn hữu ích cho workflow chưa có V2.

## Admin UI refresh

Thư mục [`admin-ui-refresh/`](admin-ui-refresh/README.md) lưu design handoff đã
duyệt cho đợt refresh Admin Dashboard. Ba visual target chính là:

- `01-dashboard-desktop-approved.png`;
- `02-dashboard-mobile-390-approved.png`;
- `03-dashboard-mobile-360-approved.png`.

Các ảnh Playwright approved có ưu tiên cao hơn annotated board về layout. Design
system board và annotated board chỉ hướng dẫn palette, spacing, hierarchy, icon
và illustration; text, số liệu hoặc section minh họa không phải requirement.
Wireframe không được ghi đè business rule, contract hoặc source hiện tại.

V13 cập nhật lại các ảnh V2 của Homepage, Dashboard, danh sách học sinh và học phí
sau khi hoàn thiện hero/filter/thuật ngữ mobile; chỉ ảnh tài liệu chính thức được lưu tại đây.

Business rule không đến từ text/số liệu trong wireframe được tạo. Khi xung đột,
tuân theo priority trong `AGENTS.md` và `docs/README.md`; ảnh chỉ mô tả visual.

## V19A Homepage

V19A dùng wireframe `20-homepage-single-location-google-maps-desktop.png` và
`21-homepage-single-location-google-maps-mobile.png` làm visual target cho
Homepage một cơ sở và Google Maps. Business rules vẫn lấy từ feature, task và
acceptance. Không dùng icon vẽ trong ảnh làm production asset; production dùng
`@mui/icons-material`.

## Vocabulary assignments and games

Feature planned dùng bộ wireframe 22–26:

- `22-vocabulary-assignment-teacher-mobile.png`;
- `23-vocabulary-assignment-teacher-desktop.png`;
- `24-vocabulary-games-student-mobile.png`;
- `25-vocabulary-games-student-desktop.png`;
- `26-vocabulary-assignment-results-responsive.png`.

Ghi chú workflow và responsive nằm tại
[`vocabulary-assignments.md`](vocabulary-assignments.md). Business rule nằm tại
[`../features/vocabulary-assignments-and-games.md`](../features/vocabulary-assignments-and-games.md).
