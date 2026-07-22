# V2 branding visual references

Đây là screenshot từ ứng dụng chạy thật sau khi V13 PASS. Dữ liệu admin trong ảnh
là seed/E2E giả, không phải học sinh thật; ảnh không chứa password, token, contact
thật hay workbook riêng tư.

| File | Route/state | Viewport | Quyết định visual hiện hành | P0 được thay về styling |
|---|---|---:|---|---|
| `03-login-mobile.png` | `/admin/login`, form idle | 390×844 | Brand card, education accents và field density | Không có P0 riêng; thay generic auth styling |
| `04-dashboard-mobile.png` | `/admin`, API test data | 390×844 | Metric cards, lưới thao tác nhanh và lịch hôm nay | `02-admin-dashboard.png` |
| `05-student-list-mobile.png` | `/admin/students`, synthetic list | 390×844 | Tìm kiếm, lọc gọn, avatar/progress/status card | `11-student-list.png` |
| `06-bottom-navigation-mobile.png` | `/admin`, Hôm nay active | 390×844 | Năm mục một dòng, safe-area và sticky position | `02-admin-dashboard.png` navigation styling |
| `07-lesson-wizard-mobile.png` | `/admin/lessons/new`, bước Thông tin | 390×844 | Bốn màu/nhãn bước, field gọn và sticky action | `04-record-lesson-info.png` |
| `08-tuition-list-mobile.png` | `/admin/tuition`, Cần thu | 390×844 | Tìm kiếm, nút Lọc và trạng thái rỗng | `14-tuition-list.png` |
| `09-class-list-mobile.png` | `/admin/classes`, synthetic list | 390×844 | Màu lớp ổn định và status bằng chữ | `09-class-list.png` |
| `10-class-form-mobile.png` | `/admin/classes/new`, form rỗng | 390×844 | Bốn nhóm thông tin và học phí nhập trống | `10-class-create.png` |
| `11-reconciliation-mobile.png` | `/admin/schedule/reconciliation` | 390×844 | Thuật ngữ xác nhận lịch dạy và ba hành động | `07-schedule-reconciliation.png` |
| `12-weekly-calendar-mobile.png` | `/admin/schedule/week` | 390×844 | Date picker native và danh sách lịch tuần | `06-weekly-calendar.png` |

Các ảnh này là authority cho visual/layout của màn hình ghi trong bảng, không phải
nguồn business rule hoặc dữ liệu mẫu. Wireframe P0 tiếp tục mô tả workflow và
information hierarchy khi chưa bị spec/ADR/acceptance thay thế.

Hai ảnh Homepage `01-homepage-mobile.png` và `02-homepage-desktop.png` ghi lại giao
diện cũ nên không còn là authority cho Homepage hiện hành. Homepage đang dùng media
tạm; ảnh, testimonial preview và contact development có thể đổi theo
`docs/content/replacing-public-media.md` mà không làm thay đổi thứ tự contact, rule
xác minh testimonial hay nghiệp vụ admin.
