# RESPONSIVE-DENSITY-AND-HOMEPAGE-POLISH Implementation

## Phạm vi

Tinh gọn Homepage và mật độ responsive của các trang admin/form, không đổi business logic, API, database hoặc auth.

## Vấn đề đã sửa

- Hero chỉ còn hai ảnh, cao 240/276/300px, autoplay 2 giây và fade 400ms.
- Thêm video học tập thứ hai; mobile dùng scroll snap, desktop dùng hai card bằng nhau.
- Control desktop gọn từ breakpoint 768px, mobile giữ touch target tối thiểu 44px.
- Toolbar Dashboard, Calendar, Tuition, Students và Classes có chiều rộng thực tế.
- Form desktop giới hạn 620px; multiline rỗng giảm còn 1–3 dòng phù hợp.

## File chính đã đổi

`client/src/theme.ts`, `client/src/pages/HomePage.tsx`, các trang admin/form liên quan và bốn E2E UI.

## API/schema thay đổi

Không có.

## Kiểm tra đã chạy

Client typecheck, lint, production build, targeted Homepage/admin/wizard/schedule E2E và `npm run check:full`.

## Điểm còn lại

Không có trong phạm vi task.

## Commit

`refactor(ui): tối ưu mật độ desktop và tinh gọn homepage`
