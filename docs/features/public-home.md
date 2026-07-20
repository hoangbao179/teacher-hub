# Public Home

Trang public tại `/` là nội dung tĩnh do developer quản lý, không cần đăng nhập,
không đọc API quản trị và không công khai học phí.

## Cập nhật nội dung

Toàn bộ tên giáo viên, mô tả, phương pháp, chương trình, video, testimonial và
contact mặc định nằm tại `client/src/content/publicHome.ts`. Một deployment cụ
thể nên cung cấp các biến build public trong `client/.env.example`, đặc biệt:

- `VITE_PUBLIC_SITE_URL` cho canonical/Open Graph;
- `VITE_PUBLIC_TEACHER_NAME`, `VITE_PUBLIC_BRAND_NAME`;
- `VITE_PUBLIC_ZALO_URL`;
- `VITE_PUBLIC_PHONE_DISPLAY`, `VITE_PUBLIC_PHONE_E164`;
- `VITE_PUBLIC_FACEBOOK_URL`.

Các biến `VITE_*` được nhúng vào frontend và tuyệt đối không được chứa secret.
Khi đổi domain production, đồng bộ `client/public/robots.txt` và
`client/public/sitemap.xml`; sitemap chỉ chứa `/`, không chứa `/admin/*`.

## Media và liên hệ

- Hero dùng WebP responsive tự host với kích thước khai báo để giữ layout ổn định.
- Video dài dùng thumbnail và chỉ tạo iframe `youtube-nocookie.com` sau khi bấm.
- CTA ưu tiên Zalo, sau đó điện thoại (`tel:`) và Facebook; external link dùng
  `noopener noreferrer`. Đây là link liên hệ, không phải tích hợp Zalo/Facebook API.
- Không autoplay audio, không CMS và không tải iframe video dài khi mở trang.

## SEO và accessibility

Homepage đặt title, description, canonical, Open Graph/Twitter và Person JSON-LD.
Admin routes đặt `noindex,nofollow,noarchive`. Trang dùng landmark semantic, một
H1, heading tuần tự, focus-visible, touch target 44px và không phụ thuộc animation.
