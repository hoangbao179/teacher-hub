# UI guidelines

## Brand và tone

- Brand: **Lớp học cô Vy** — **Tiếng Anh lớp 1–9 tại Huế**.
- Homepage nhiều màu và giàu chất giáo dục; phù hợp dải lớp 1–9 nhưng không mang
  phong cách mầm non. Admin dùng palette teal, mint, sky blue, peach và coral ở
  mức bình tĩnh, ít trang trí hơn; palette Admin không thay thế quy tắc riêng của Homepage.
- Copy ngắn, thân thiện và chính xác; không dùng dữ liệu/testimonial chưa xác minh.

## Responsive

Review bắt buộc ở 360, 375, 390, 393, 400, 412 và 430 px, cộng tablet và desktop.
Mobile là ưu tiên: cards/lists thay bảng rộng, touch target tối thiểu 44 px, sticky
action không che nội dung. Desktop dùng sidebar khi đủ rộng.
Homepage dùng section padding khoảng 32–40 px trên mobile và 48–56 px trên desktop.
Homepage bắt đầu bằng section giới thiệu responsive, không có hero chuyển cảnh.

## Typography

Ứng dụng tải Be Vietnam Pro có glyph tiếng Việt. Body chủ yếu 14–15 px, section
title 17–18 px, page title 20–22 px. Admin ưu tiên weight 400–800 và tránh 900 để
không quá nặng; hierarchy phải rõ khi zoom và trên màn hình hẹp.

## Colors

- Trong Admin, teal là primary action, active navigation, focus accent và progress;
  không dùng purple/violet cho các vai trò này.
- Mint, sky blue và peach dùng cho grouping/metric/class type của Admin.
- Warm yellow/orange báo cần chú ý hoặc paused/payment due.
- Coral chỉ là accent nhỏ; green dùng cho success/active/paid.
- Màu không được là tín hiệu duy nhất: luôn kèm nhãn, icon hoặc cấu trúc.

## Surfaces và illustration

- Admin dùng grid cơ sở 8 px, cho phép 4 px để tinh chỉnh icon/badge; card padding
  16 px trên mobile và 18–24 px trên desktop; khoảng cách section tương ứng 16–20 px
  và 20–24 px.
- Radius mặc định 12 px, card chính 16 px, banner lớn tối đa 20–24 px. Card dùng
  border rất nhẹ kết hợp shadow/elevation nhất quán, không dùng glow màu.
- Minh họa theo hướng giáo dục thân thiện, có chọn lọc ở greeting banner, sidebar
  desktop hoặc empty state; không phủ minh họa lên mọi card.
- Asset trang trí Admin phải được bundle/local và tối ưu trước khi đưa vào production;
  không gọi API ảnh bên ngoài ở runtime.
- Ảnh chỉ để trang trí dùng `alt=""` và `aria-hidden="true"`; không đặt text quan
  trọng trong ảnh và không dùng ảnh handoff thay icon từ `@mui/icons-material`.

## Motion

Motion phải tiết chế, không có animation liên tục gây phân tâm.
`prefers-reduced-motion` tắt autoplay và transition không thiết yếu nhưng vẫn giữ
điều khiển thủ công.
Anchor trên Homepage dùng smooth scroll, chừa khoảng cho sticky header và trở về cuộn
bình thường khi `prefers-reduced-motion: reduce`.

## Navigation

Mobile bottom navigation có năm mục: Hôm nay, Lịch, Lớp học, Học phí, Học sinh.
Nhãn luôn một dòng, vùng bấm bằng nhau và cộng safe-area bottom. Sticky button nằm
trên navigation. Desktop sidebar giữ cùng thứ tự/nhãn tại breakpoint phù hợp.

Filter dài trên mobile mở trong dialog/bottom sheet; search chính vẫn nhìn thấy trực tiếp.
Date/time dùng native picker, không cố style popup desktop của trình duyệt.
