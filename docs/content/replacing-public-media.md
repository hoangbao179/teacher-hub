# Thay thế media công khai

`client/src/content/publicHome.ts` là nguồn cấu trúc duy nhất cho Homepage. Media hiện tại là tạm thời; có thể thay bằng media thật của cô Vy qua biến `VITE_PUBLIC_*` mà không đổi page structure hoặc business logic.

## Hero carousel

Mỗi slide có `mobileImage`, `desktopImage`, `focalPosition` và `alt`. Slide đầu hiện dùng `VITE_PUBLIC_HERO_MOBILE_URL`/`VITE_PUBLIC_HERO_DESKTOP_URL`; slide 2 dùng cùng bộ ảnh với focal point khác; slide 3 dùng `VITE_PUBLIC_HERO_ALT_MOBILE_URL`/`VITE_PUBLIC_HERO_ALT_DESKTOP_URL`.

- Mobile nên có tỉ lệ gần 4:5, tối thiểu 720px chiều ngang.
- Desktop nên có tỉ lệ gần 16:10, tối thiểu 1440×900.
- Chọn focal position để mặt người hoặc nội dung chính không nằm dưới chữ/nút.
- Alt mô tả cảnh thật, không gọi nhân vật là cô Vy nếu ảnh không phải cô Vy.
- Ảnh đầu được tải eager; ảnh sau lazy và được preload sau initial render.

## Video, poster và thumbnail

`VITE_PUBLIC_VIDEOS_JSON` cấu hình video dài. Player YouTube privacy-enhanced chỉ được tạo sau tương tác; thumbnail tải trước. Nếu chuyển sang video tự host trong tương lai, lưu URL video, poster và thumbnail tập trung tại content config, giữ muted/no-autoplay-audio và không đổi page layout.

## Liên hệ và public URL

Thay đồng thời:

- `VITE_PUBLIC_ZALO_URL`: URL HTTPS `zalo.me` thật;
- `VITE_PUBLIC_PHONE_DISPLAY` và `VITE_PUBLIC_PHONE_E164`: nhãn và số E.164 cho `tel:`;
- `VITE_PUBLIC_FACEBOOK_URL`: URL trang/profile HTTPS cụ thể, không dùng Facebook root;
- `VITE_PUBLIC_SITE_URL`: public base URL thật;
- `VITE_PUBLIC_OG_IMAGE_URL`: ảnh chia sẻ mạng xã hội.

Link thiếu, placeholder hoặc sai host bị ẩn khỏi visitor. Production validation bắt buộc các giá trị liên hệ hợp lệ.

## Ảnh giáo viên

`VITE_PUBLIC_TEACHER_PHOTO_URL` dành cho ảnh thật khi cô Vy phê duyệt. Ảnh tạm không được mô tả hay trình bày như chân dung xác thực của cô Vy.

## Phản hồi phụ huynh

Mỗi item trong `VITE_PUBLIC_TESTIMONIALS_JSON` có `id`, `guardianLabel`, `studentLevel`, `location`, `quote`, `verified`, `published` và `date` tùy chọn. Chỉ item có cả `verified=true` và `published=true` mới được hiển thị như phản hồi thật. Production validation từ chối `published=true` khi `verified=false`. Khi chưa có phản hồi đủ điều kiện, Homepage hiển thị các chủ đề phụ huynh thường quan tâm.

Không đưa tên đầy đủ, số điện thoại, thông tin riêng tư hoặc lời chứng thực chưa được phụ huynh chấp thuận vào cấu hình production.
