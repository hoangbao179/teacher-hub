# Public Homepage

Trang `/` giới thiệu **Lớp tiếng Anh cô Vy** tại Huế. Trang không cần đăng nhập,
không gọi API quản trị và không công khai học phí.

## Nội dung và cấu trúc

- `client/src/content/publicHome.ts` là source of truth cho nội dung, liên hệ,
  địa điểm, chương trình và đường dẫn media của Homepage.
- Homepage có đúng một H1: `Cô Vy dạy tiếng Anh tại Huế`.
- Nội dung công khai gồm hero, hồ sơ giáo viên, chương trình học, phương pháp,
  hình thức và địa điểm học, video tham khảo, FAQ và liên hệ.
- Chương trình gồm tiếng Anh mầm non, tiểu học, THCS, luyện thi Nguyễn Tri
  Phương, luyện thi lớp 9 lên 10 và giao tiếp cơ bản.
- Không render testimonial cho đến khi có phản hồi thật đã được xác minh và
  cho phép công khai.
- Video hiện tại là tài liệu tham khảo bên ngoài, không được mô tả là video hoặc
  phương pháp giảng dạy do cô Vy thực hiện. Iframe YouTube chỉ tải sau tương tác.

## Liên hệ và địa điểm

- Zalo: `https://zalo.me/0971697759`.
- Facebook: `https://www.facebook.com/uyenvy.le.12`.
- Học sinh có thể học tại nhà cô Vy ở `101 Kiệt 245 Bùi Thị Xuân, Huế`.
- Cô Vy cũng nhận dạy tại nhà học sinh trong khu vực Huế.
- Phụ huynh liên hệ trước để trao đổi lịch và hình thức học phù hợp.
- External link dùng `noopener noreferrer`; địa chỉ luôn có text crawlable.

## SEO và accessibility

Metadata public, canonical, Open Graph, Twitter và JSON-LD `@graph` có sẵn trong
`client/index.html`. Graph chỉ gồm `WebSite`, `LocalBusiness` và `Person`, không
có review/rating. `RouteMetadata` chỉ chuyển metadata sang `noindex` cho route
admin sau khi SPA chạy.

Build client prerender riêng route `/` vào `client/dist/index.html`; admin vẫn
là SPA. Nginx gửi `X-Robots-Tag: noindex, nofollow, noarchive` cho `/admin` và
`/admin/*`.

Trang giữ heading tuần tự, landmark, focus-visible, touch target phù hợp, ảnh
responsive có kích thước cố định và không có page-level horizontal scroll tại
các viewport 360–430 px.

Footer công khai giữ nguyên:
`2026 — từ người hâm mộ cô Vy, with love ❤️`. Link quản trị chỉ nằm ở header.
