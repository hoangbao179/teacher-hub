# Thay thế media công khai

`client/src/content/publicHome.ts` là nguồn cấu trúc duy nhất cho Homepage. Media hiện tại là tạm thời; có thể thay bằng media thật của cô Vy qua biến `VITE_PUBLIC_*` mà không đổi page structure hoặc business logic.

## Hero carousel

Mỗi slide có `mobileImage`, `desktopImage`, `focalPosition` và `alt`, và ba slide phải
dùng ba media khác nhau:

- slide 1: `VITE_PUBLIC_HERO_MOBILE_URL`/`VITE_PUBLIC_HERO_DESKTOP_URL`;
- slide 2: `VITE_PUBLIC_HERO_ALT_MOBILE_URL`/`VITE_PUBLIC_HERO_ALT_DESKTOP_URL`;
- slide 3: `VITE_PUBLIC_HERO_SECONDARY_MOBILE_URL`/`VITE_PUBLIC_HERO_SECONDARY_DESKTOP_URL`.

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
- `VITE_PUBLIC_SITE_URL`: public base URL thật;
- `VITE_PUBLIC_OG_IMAGE_URL`: ảnh chia sẻ mạng xã hội.

Facebook dùng mặc định đã duyệt `https://www.facebook.com/uyenvy.le.12`. Homepage không
dùng biến phone hoặc Facebook ở build production.

Link thiếu, placeholder hoặc sai host bị ẩn khỏi visitor. Production validation bắt buộc các giá trị liên hệ hợp lệ.

## Ảnh giáo viên

`VITE_PUBLIC_TEACHER_PHOTO_URL`, `VITE_PUBLIC_TEACHER_PHOTO_ALT` và
`VITE_PUBLIC_TEACHER_PHOTO_FOCAL_POSITION` cấu hình tập trung khu giới thiệu. Ảnh tạm
không được mô tả hay trình bày như chân dung xác thực của cô Vy.

## Phản hồi phụ huynh

Mỗi item trong `VITE_PUBLIC_TESTIMONIALS_JSON` có `id`, `guardianLabel`, `studentLevel`, `location`, `quote`, `verified`, `published` và `date` tùy chọn. Development có thể preview item cấu hình mà không lộ metadata/nhãn mẫu. Production chỉ hiển thị item có cả `verified=true` và `published=true`, đồng thời validation từ chối `published=true` khi `verified=false`. Testimonial và FAQ không render đồng thời; production không có phản hồi đủ điều kiện mới hiển thị các chủ đề phụ huynh thường quan tâm.

Không đưa tên đầy đủ, số điện thoại, thông tin riêng tư hoặc lời chứng thực chưa được phụ huynh chấp thuận vào cấu hình production.
