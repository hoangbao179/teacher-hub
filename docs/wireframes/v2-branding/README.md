# V2 branding visual references

Đây là screenshot từ ứng dụng chạy thật sau khi V12A, V12B và V12C đều PASS.
Dữ liệu admin trong ảnh là seed/E2E giả (`DEV`, `M5B`, `Browser`), không phải học
sinh thật; ảnh không chứa password, token, contact thật hay workbook riêng tư.

| File | Route/state | Viewport | Quyết định visual hiện hành | P0 được thay về styling |
|---|---|---:|---|---|
| `01-homepage-mobile.png` | `/`, slide đầu, nội dung development | 390×844 | Hero mobile, typography, CTA/section discoverability | `01-homepage-public-mobile.png` |
| `02-homepage-desktop.png` | `/`, slide đầu | 1440×900 | Hero desktop, max-width, decorative balance | `01-homepage-public-mobile.png` (desktop styling mới) |
| `03-login-mobile.png` | `/admin/login`, form idle | 390×844 | Brand card, education accents, field density | Không có P0 riêng; supersedes generic auth styling |
| `04-dashboard-mobile.png` | `/admin`, API test data | 390×844 | Pastel metric hierarchy, quick actions, schedule cards | `02-admin-dashboard.png` |
| `05-student-list-mobile.png` | `/admin/students`, synthetic list | 390×844 | Stable pastel avatar, readable progress/status cards | `11-student-list.png` |
| `06-bottom-navigation-mobile.png` | `/admin`, Hôm nay active | 390×844 | Five equal one-line labels, safe-area/sticky position | `02-admin-dashboard.png` navigation styling |
| `07-lesson-wizard-mobile.png` | `/admin/lessons/new`, step Thông tin | 390×844 | Four step colors/labels, compact fields/sticky action | `04-record-lesson-info.png` |
| `08-tuition-list-mobile.png` | `/admin/tuition`, Cần thu | 390×844 | Status tabs/chips, progress, two-card actions | `14-tuition-list.png` |

Các ảnh này là authority cho visual/layout của màn hình ghi trong bảng, không phải
nguồn business rule hoặc dữ liệu mẫu. Các wireframe P0 tiếp tục mô tả workflow và
information hierarchy khi chưa bị spec/ADR/acceptance thay thế.

Homepage đang dùng media tạm; ảnh, testimonial draft và contact development có thể
đổi theo `docs/content/replacing-public-media.md` mà không làm thay đổi cấu trúc
carousel, thứ tự contact, rule xác minh testimonial hay nghiệp vụ admin.
