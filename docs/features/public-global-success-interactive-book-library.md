# Official English Book Library

## Mục tiêu và phạm vi

Tủ sách công khai tại `/sach` giúp học sinh đọc SGK và giáo viên đọc SGV Tiếng
Anh lớp 1–9 từ nguồn chính thức của Nhà xuất bản Giáo dục Việt Nam (NXBGD).
FlipBuilder chỉ là nguồn phụ cho bản nghe tương tác của những SGK đã được xác
minh.

Feature dùng catalog và page manifest tĩnh ở frontend; không có database, API,
Admin CRUD, runtime scraping, proxy hoặc rehost PDF/audio/ảnh trang sách.

## Nguồn và data model

- `officialDetailUrl` và `officialViewerUrl`: chỉ `https://taphuan.nxbgd.vn/tap-huan/`.
- `officialPageManifestUrl`: JSON local dưới `/book-pages/`; mỗi URL ảnh đã xác
  minh dùng `https://cdn3.olm.vn/upload/taphuan/`.
- `interactiveAudioUrl`: tùy chọn, chỉ dành cho `STUDENT_BOOK`, chỉ
  `https://online.flipbuilder.com/sdtta/`.
- `bookType`: `STUDENT_BOOK`, `TEACHER_BOOK`, hoặc `WORKBOOK` cho giai đoạn sau.
- NXBGD không được mô tả là nguồn audio; FlipBuilder không được mô tả là nguồn
  chính thức của nhà xuất bản.

Catalog đã xác minh gồm 13 SGK và 8 SGV. Lớp 6 chưa có link mang nhãn SGV trên
trang chi tiết NXBGD nên không tạo record suy đoán. Không đưa SBT vào phạm vi.

## Routing

```text
/sach
/sach/:seriesSlug/:bookSlug
/sach/:seriesSlug/:bookSlug/nghe
```

Route đọc là route chính, indexable, dùng NXBGD. Route `/nghe` chỉ tồn tại khi
SGK có `interactiveAudioUrl`, đặt `noindex,follow`, không prerender và không nằm
trong sitemap.

## Viewer

Viewer đọc chính dùng `OfficialBookReader` và StPageFlip: dưới 900 px hoặc khi
container không đủ rộng hiển thị một trang; desktop đủ rộng hiển thị bìa đơn rồi
các spread trái–phải liên tiếp. Manifest page là source of truth duy nhất cho
toolbar và query `?page=`; engine chỉ cập nhật trang sau khi lật hoàn tất.

Ở zoom 100%, swipe/kéo góc và nút điều hướng dùng hiệu ứng lật. Zoom 100–250% dùng
lớp ảnh riêng với native scroll và khóa gesture lật; đổi trang hoặc `Vừa trang`
đưa zoom về 100% và reset scroll. Toàn bộ page node cần cho engine vẫn tồn tại,
nhưng chỉ spread hiện tại và các trang lân cận được gắn URL ảnh để tránh tải cả
cuốn lúc mở. Lỗi khởi tạo engine fallback về reader ảnh đơn, không dùng iframe.

Manifest được thu thập một lần khi triển khai; trình duyệt người dùng không scrape
NXBGD. Ảnh vẫn tải trực tiếp từ CDN chính thức, không lưu trên VPS. Nếu manifest
thiếu/lỗi hoặc ảnh không tải được, UI không dùng iframe mà hiện fallback mở nguồn
NXBGD ở tab mới.

Viewer FlipBuilder nằm riêng trong `InteractiveAudioViewer`, giữ autoplay,
fullscreen, cảnh báo tải chậm, fallback tab mới và sandbox không cấp quyền top
navigation. Không truy cập DOM cross-origin, inject CSS, xóa `.clickToRead`, khóa
xoay màn hình hoặc proxy nội dung.

## SEO và vận hành

`/sach`, toàn bộ SGK và SGV được prerender và đưa vào sitemap từ catalog. Copy
SEO của route đọc không mặc định quảng bá audio. CSP public allowlist
`cdn3.olm.vn` cho ảnh; frame-src NXBGD/FlipBuilder cùng YouTube và Google vẫn giữ
theo domain cụ thể.

Nguồn chi tiết và quyết định deduplicate nằm tại
`docs/operations/global-success-book-source-register.md`.
