# Thay thế media công khai

`client/src/content/publicHome.ts` là nguồn duy nhất cho nội dung và đường dẫn media của
Homepage. Ảnh local nằm trong `client/public/images` và được đóng gói trực tiếp vào Docker
Web image; Homepage không lấy đường dẫn ảnh từ biến môi trường.

## Video, ảnh giáo viên và phản hồi

Video dài, ảnh khu giới thiệu, alt/focal position và testimonial hiện có đều nằm trong
`publicHome.ts`. Khu giới thiệu dùng `covy-image.png`. Player YouTube privacy-enhanced chỉ
được tạo sau tương tác; thumbnail tải trước.

Production chỉ hiển thị testimonial có cả `verified=true` và `published=true`. Không đưa
tên đầy đủ, số điện thoại, thông tin riêng tư hoặc lời chứng thực chưa được phụ huynh chấp
thuận vào source.

## Liên hệ

Zalo và Facebook là URL cố định trong `publicHome.ts`, không thay đổi theo deployment.
Không hardcode số điện thoại và không thêm lại CTA gọi điện.

Site URL là `https://tienganhcovy.com`; Facebook dùng URL đã duyệt
`https://www.facebook.com/uyenvy.le.12`. Cả hai nằm trong `publicHome.ts`.
