# Thay thế media công khai

`client/src/content/publicHome.ts` là nguồn duy nhất cho nội dung và đường dẫn
media của Homepage. Asset local nằm trong `client/public`.

## Ảnh giáo viên

Ảnh gốc là `client/public/images/covy-image.png`. Homepage dùng các bản WebP
responsive:

- `covy-image-480.webp`;
- `covy-image-768.webp`;
- `covy-image-1200.webp`.

Fallback và ảnh social dùng `covy-image-1200.jpg`; file PNG gốc chỉ là nguồn để
sinh lại asset.

Sau khi thay ảnh gốc, chạy:

```bash
npm -w client run assets:seo
```

Lệnh này sinh lại WebP, PNG logo và icon từ các SVG nguồn. Luôn kiểm tra lại
`width`, `height`, focal position và alt text trong `publicHome.ts`. Ảnh đầu
trang không lazy-load và giữ `fetchPriority="high"`.

## Logo và favicon

Nguồn vector:

- `client/public/logo-covy.svg`;
- `client/public/favicon.svg`.

Không dùng chân dung làm favicon và không thêm font file vào asset SVG.

## Video và phản hồi

Video hiện tại là tài liệu học tiếng Anh tham khảo bên ngoài. Player
`youtube-nocookie.com` chỉ được tạo sau tương tác.

Không thêm testimonial vào public source nếu chưa có dữ liệu thật, xác minh và
quyền công khai. Không thêm review structured data.
