# Thay thế media công khai

`client/src/content/publicHome.ts` là nguồn duy nhất cho nội dung và đường dẫn
media của Homepage. Asset local nằm trong `client/public`.

## Ảnh giáo viên

Ảnh nguồn hiện tại là `client/public/images/covy-image-master-1536x1152.png`. Homepage dùng các bản WebP
responsive:

- `covy-image-v2-480.webp`;
- `covy-image-v2-768.webp`;
- `covy-image-v2-1200.webp`.

Fallback và ảnh social dùng `covy-image-v2-1200.jpg`; file PNG gốc chỉ là nguồn để
sinh lại asset.

Sau khi thay ảnh gốc, chạy:

```bash
npm -w client run assets:seo
```

Khi thay ảnh trong tương lai, phải tăng version trong filename (ví dụ `v3`) ở
script sinh asset và các đường dẫn runtime để cache immutable của browser và CDN
không giữ lại ảnh cũ.

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
