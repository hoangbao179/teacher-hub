# Thay thế media công khai

`client/src/content/publicHome.ts` là nguồn duy nhất cho nội dung và đường dẫn media của
Homepage. Ảnh local nằm trong `client/public/images` và được đóng gói trực tiếp vào Docker
Web image; Homepage không lấy đường dẫn ảnh từ biến môi trường.

## Hero carousel

Mỗi slide có `mobileImage`, `desktopImage`, `focalPosition` và `alt`, và ba slide phải
dùng ba media khác nhau. Các file hiện tại:

- slide 1: `teacher-english-hero-720.jpg` và `teacher-english-hero-1440.jpg`;
- slide 2: `teacher-hero-720.webp` và `teacher-hero-1440.webp`;
- slide 3: `teacher-secondary-study-720.jpg` và `teacher-secondary-study-1440.jpg`.

- Mobile nên có tỉ lệ gần 4:5, tối thiểu 720px chiều ngang.
- Desktop nên có tỉ lệ gần 16:10, tối thiểu 1440×900.
- Chọn focal position để mặt người hoặc nội dung chính không nằm dưới chữ/nút.
- Alt mô tả cảnh thật, không gọi nhân vật là cô Vy nếu ảnh không phải cô Vy.
- Ảnh đầu được tải eager; ảnh sau lazy và được preload sau initial render.

Muốn thay ảnh, thay file trong `client/public/images` và giữ nguyên tên; hoặc cập nhật đồng
thời đường dẫn, alt và focal position trong `publicHome.ts`. Sau đó commit và deploy để Web
image mới chứa asset mới. Không sửa business logic hoặc cấu trúc page khi chỉ thay media.

## Video, ảnh giáo viên và phản hồi

Video dài, ảnh khu giới thiệu, alt/focal position và testimonial hiện có đều nằm trong
`publicHome.ts`. Player YouTube privacy-enhanced chỉ được tạo sau tương tác; thumbnail tải
trước. Ảnh tạm không được mô tả hay trình bày như chân dung xác thực của cô Vy.

Production chỉ hiển thị testimonial có cả `verified=true` và `published=true`. Không đưa
tên đầy đủ, số điện thoại, thông tin riêng tư hoặc lời chứng thực chưa được phụ huynh chấp
thuận vào source.

## Liên hệ

Chỉ `VITE_PUBLIC_ZALO_URL` thay đổi theo deployment và phải là URL HTTPS `zalo.me` thật.
Development dùng fallback an toàn khi biến này chưa hợp lệ; production validation bắt buộc
một URL liên hệ có path hợp lệ. Không hardcode số điện thoại và không thêm lại CTA gọi điện.

Site URL là `https://tienganhcovy.com`; Facebook dùng URL đã duyệt
`https://www.facebook.com/uyenvy.le.12`. Cả hai nằm trong `publicHome.ts`.
