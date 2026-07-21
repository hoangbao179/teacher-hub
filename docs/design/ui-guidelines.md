# UI guidelines

## Brand và tone

- Brand: **Lớp học cô Vy** — **Tiếng Anh lớp 1–9 tại Huế**.
- Homepage nhiều màu và giàu chất giáo dục; phù hợp dải lớp 1–9 nhưng không mang
  phong cách mầm non. Admin dùng cùng hệ màu ở mức bình tĩnh, ít trang trí hơn.
- Copy ngắn, thân thiện và chính xác; không dùng dữ liệu/testimonial chưa xác minh.

## Responsive

Review bắt buộc ở 360, 375, 390, 393, 400, 412 và 430 px, cộng tablet và desktop.
Mobile là ưu tiên: cards/lists thay bảng rộng, touch target tối thiểu 44 px, sticky
action không che nội dung. Desktop dùng sidebar khi đủ rộng.
Homepage dùng section padding khoảng 32–40 px trên mobile và 48–56 px trên desktop.
Hero theo dải 400/410/420/450 px ở các mốc 360/390/400/430 và khoảng 510 px desktop.

## Typography

Ứng dụng tải Be Vietnam Pro có glyph tiếng Việt. Body chủ yếu 14–15 px, section
title 17–18 px, page title 20–22 px. Admin ưu tiên weight 400–800 và tránh 900 để
không quá nặng; hierarchy phải rõ khi zoom và trên màn hình hẹp.

## Colors

- Purple/violet là primary action và active navigation.
- Lavender, soft blue và mint dùng cho grouping/metric/class type.
- Warm yellow/orange báo cần chú ý hoặc paused/payment due.
- Coral chỉ là accent nhỏ; green dùng cho success/active/paid.
- Màu không được là tín hiệu duy nhất: luôn kèm nhãn, icon hoặc cấu trúc.

## Motion

Motion phải tiết chế. Carousel chỉ tự chuyển 5–6 giây, dừng khi hover/focus/tab ẩn;
không có animation liên tục gây phân tâm. `prefers-reduced-motion` tắt autoplay và
transition không thiết yếu nhưng vẫn giữ điều khiển thủ công.

## Navigation

Mobile bottom navigation có năm mục: Hôm nay, Lịch, Lớp học, Học phí, Học sinh.
Nhãn luôn một dòng, vùng bấm bằng nhau và cộng safe-area bottom. Sticky button nằm
trên navigation. Desktop sidebar giữ cùng thứ tự/nhãn tại breakpoint phù hợp.

Filter dài trên mobile mở trong dialog/bottom sheet; search chính vẫn nhìn thấy trực tiếp.
Date/time dùng native picker, không cố style popup desktop của trình duyệt.
