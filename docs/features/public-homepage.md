# Public Homepage

Trang `/` giới thiệu **Lớp học cô Vy**, chương trình Tiếng Anh lớp 1–9 tại Huế,
lớp 1–1 và nhóm nhỏ. Nội dung nhấn mạnh vững nền tảng, bám sát chương trình trường,
ôn kiểm tra và chuẩn bị Nguyễn Tri Phương. Trang không cần đăng nhập, không gọi API
quản trị và không công khai giá học phí.

## Carousel và nội dung

- Hero có hai slide cấu hình tập trung trong `client/src/content/publicHome.ts`.
- Hai slide dùng hai media khác nhau. Hero cao trong khoảng 360–420 px trên mobile
  và khoảng 480 px trên desktop.
- Slide tự chuyển mỗi 5,5 giây, dừng khi hover/focus/tab ẩn; previous/next,
  indicators, bàn phím và swipe đều hoạt động.
- `prefers-reduced-motion` tắt autoplay/transition nhưng giữ điều hướng thủ công.
- Ảnh slide đầu được ưu tiên tải; ảnh sau lazy/preload để tránh tranh tài nguyên.
- Ba card chương trình là Tiếng Anh tiểu học lớp 1–5, Tiếng Anh THCS lớp 6–9 và
  luyện thi Nguyễn Tri Phương/9 lên 10; đây là mô tả mục tiêu học, không phải bảng giá.
- Trên mobile, hai video vuốt ngang thủ công với scroll snap, hé card kế tiếp và có
  chỉ dẫn ngắn nhưng không hiện scrollbar; video không tự chuyển như testimonial.

## Media tạm thời

Ảnh hiện tại là asset tạm, không được mô tả như chân dung thật của Cô Vy. Thay
ảnh/alt/focal point theo `docs/content/replacing-public-media.md` và chạy production validation,
E2E cùng review mobile/desktop. Thay media không được làm đổi business logic.
Video dài chỉ tạo iframe `youtube-nocookie.com` sau tương tác và không autoplay audio.

## Phản hồi và liên hệ

- Homepage hiển thị ba testimonial mẫu được cấu hình trực tiếp trong
  `client/src/content/publicHome.ts`; giữ cấu trúc này để thay bằng phản hồi thật sau này.
- Chỉ dùng tên phụ huynh/học sinh viết tắt, không hiển thị ảnh đại diện, trường học,
  điểm số hoặc thông tin cá nhân. Mobile dùng carousel tự chuyển, hỗ trợ vuốt và chấm
  điều hướng nhưng không hiện scrollbar; desktop hiển thị ba card trên cùng một hàng.
- Homepage không hiển thị CTA gọi điện và production không yêu cầu cấu hình phone. Zalo và
  Facebook nằm cùng một hàng, rộng bằng nhau trên mobile; Facebook dùng URL công khai cố định
  `https://www.facebook.com/uyenvy.le.12`. External link dùng `noopener noreferrer`.
- Zalo và Facebook là liên kết cố định trong source, không phải cấu hình deployment.

## Cấu hình, SEO và accessibility

Text, SEO, Zalo, Facebook, video/testimonial, alt text và đường dẫn media local nằm ở
`client/src/content/publicHome.ts`. Homepage không dùng biến môi trường cho nội dung công
khai. Domain production được cố định trong source, sitemap và robots.

Trang dùng landmark, một H1, heading tuần tự, focus-visible, touch target tối thiểu
44 px, ảnh responsive và không phụ thuộc animation. Canonical/Open Graph/Twitter và
Person JSON-LD lấy từ cấu hình public đã duyệt.

Link **Liên hệ** giữ anchor `#contact`; trang cuộn mượt và chừa khoảng cho sticky header.
Khi người dùng bật reduced motion, thao tác trở về cuộn bình thường.

Footer phải giữ nguyên: `2026 — từ người hâm mộ cô Vy, with love ❤️`.

Contact dùng tiêu đề “Cùng cô Vy tìm cách học phù hợp cho con”, hai CTA Zalo/Facebook
và chip Lớp 1–9, 1–1 hoặc nhóm nhỏ, Tại Huế trong section hiện có.
