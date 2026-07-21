# Public Homepage

Trang `/` giới thiệu **Lớp học cô Vy**, chương trình Tiếng Anh lớp 1–9 tại Huế,
lớp 1–1 và nhóm nhỏ. Nội dung nhấn mạnh vững nền tảng, bám sát chương trình trường,
ôn kiểm tra và chuẩn bị Nguyễn Tri Phương. Trang không cần đăng nhập, không gọi API
quản trị và không công khai giá học phí.

## Carousel và nội dung

- Hero có ba slide cấu hình tập trung trong `client/src/content/publicHome.ts`.
- Ba slide dùng ba media khác nhau. Hero cao khoảng 400 px ở 360, 410 px ở 390,
  420 px ở 400, tối đa 450 px ở 430 và 510 px trên desktop 1440×900.
- Slide tự chuyển mỗi 5,5 giây, dừng khi hover/focus/tab ẩn; previous/next,
  indicators, bàn phím và swipe đều hoạt động.
- `prefers-reduced-motion` tắt autoplay/transition nhưng giữ điều hướng thủ công.
- Ảnh slide đầu được ưu tiên tải; ảnh sau lazy/preload để tránh tranh tài nguyên.
- Ba card chương trình là Tiếng Anh lớp 1–5, lớp 6–9 và ôn thi/chuyển cấp; đây là
  mô tả mục tiêu học, không phải bảng giá.

## Media tạm thời

Ảnh hiện tại là asset tạm, không được mô tả như chân dung thật của Cô Vy. Thay
ảnh/alt/focal point theo `docs/content/replacing-public-media.md` và chạy validator,
E2E cùng review mobile/desktop. Thay media không được làm đổi business logic.
Video dài chỉ tạo iframe `youtube-nocookie.com` sau tương tác và không autoplay audio.

## Phản hồi và liên hệ

- Production chỉ hiển thị testimonial có cả `published=true` và `verified=true`;
  bản chưa xác minh không được trình bày như phản hồi khách hàng thật.
- Development có thể preview ba testimonial đã cấu hình mà không gắn nhãn nội bộ.
  Khi preview/testimonial hợp lệ đang hiển thị, FAQ fallback không render cùng lúc.
  Production không có testimonial hợp lệ thì dùng **Phụ huynh thường quan tâm**.
- Zalo hợp lệ là CTA chính; điện thoại và Facebook hợp lệ là phụ. Action thiếu/sai
  bị ẩn, không dùng link `#` và external link dùng `noopener noreferrer`.
- Local development có bộ contact tạm đã cấu hình để section không rỗng; production
  bắt buộc qua validation với contact thật trước build.

## Cấu hình, SEO và accessibility

Fallback/source nằm ở `client/src/content/publicHome.ts`; deployment override bằng
`VITE_PUBLIC_*` theo `client/.env.example`. Biến frontend không được chứa secret.
Production validation từ chối contact/domain placeholder và testimonial published
nhưng chưa verified. Đồng bộ domain thật vào sitemap/robots trước release.

Trang dùng landmark, một H1, heading tuần tự, focus-visible, touch target tối thiểu
44 px, ảnh responsive và không phụ thuộc animation. Canonical/Open Graph/Twitter và
Person JSON-LD lấy từ cấu hình public đã duyệt.

Footer phải giữ nguyên: `2026 — từ người hâm mộ cô Vy, with love ❤️`.

Contact V15 dùng tiêu đề “Cùng cô Vy tìm cách học phù hợp cho con”, CTA “Nhắn cô
Vy qua Zalo” và chip Lớp 1–9, 1–1 hoặc nhóm nhỏ, Tại Huế trong section hiện có.
