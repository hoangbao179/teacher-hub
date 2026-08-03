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

Route đọc là route chính và indexable. Với SGK có `interactiveAudioUrl` hợp lệ,
route này dùng FlipBuilder ở viewport từ 900 px và dùng viewer
ảnh NXBGD ở viewport hẹp hơn. SGV và sách không có nguồn tương tác hợp lệ luôn
dùng NXBGD. Route `/nghe` vẫn là bản nghe chuyên biệt, chỉ tồn tại khi SGK có
`interactiveAudioUrl`, đặt `noindex,follow`, không prerender và không nằm trong
sitemap. Đây là compatibility route cho link cũ và kiểm thử trực tiếp, không phải
luồng được liên kết từ Tủ sách.

## Viewer

`ResponsiveBookViewer` chỉ mount một viewer sau khi client xác định breakpoint;
HTML prerender và render client đầu tiên dùng skeleton nhỏ. Vì vậy desktop không
tải manifest NXBGD trước khi chuyển sang FlipBuilder và resize không để hai viewer
cùng tồn tại. Không dùng user-agent để chọn viewer.

Viewer ảnh NXBGD dùng `OfficialBookReader` và StPageFlip: dưới 900 px hoặc khi
container không đủ rộng hiển thị một trang; desktop đủ rộng hiển thị bìa đơn rồi
các spread trái–phải liên tiếp. Manifest page là source of truth duy nhất cho
toolbar và query `?page=`; engine chỉ cập nhật trang sau khi lật hoàn tất. NXBGD
không có audio và UI của viewer này không quảng bá audio.

NXBGD reader có hiệu ứng âm thanh lật trang UI ngắn do Web Audio API tạo cục bộ,
không dùng asset ngoài và không đại diện cho audio bài học. Âm thanh chỉ phát sau
một thao tác người dùng dẫn tới event flip hoàn tất; mount, resize, reinitialize và
đồng bộ query không phát. Nút icon trong toolbar bật/tắt âm thanh, preference dùng
key `teacher-hub.book-page-sound.enabled` trong localStorage. Lỗi Web Audio không
làm hỏng thao tác lật và tự chuyển control sang trạng thái tắt/disabled.

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

Route đọc chính và compatibility route `/nghe` dùng reader shell riêng: không
mount public header/footer, chỉ dùng thanh tiêu đề gọn có link quay về đúng
grade/type/series filter và mở rộng viewer đến tối đa 1680 px. Không render cover,
breadcrumb, chip hoặc đoạn giới thiệu lớn phía trên viewer. Trên desktop, iframe
cao theo viewport với giới hạn 500–1000 px.

Mỗi card Tủ sách chỉ có một hành động mở route đọc chính (`Mở sách` hoặc `Mở tài
liệu`). Viewer được chọn tự động theo viewport/source; card không trình bày
FlipBuilder, NXBGD hay liên kết `/nghe` như hai phiên bản riêng.

Trên mobile 360–430 px, phần giới thiệu được rút gọn để bộ lọc và sách đầu tiên xuất
hiện sớm hơn. Bộ lọc loại tài liệu là segmented control dùng hết chiều rộng khả dụng;
bộ lọc lớp giữ một hàng và cuộn ngang bên trong, có chỉ dẫn vuốt để xem thêm nhưng
không làm trang cuộn ngang. Nhóm lớp
bỏ khung lồng ngoài trên mobile, còn CTA của card trải hết chiều rộng card và phần mô
tả trùng lặp được ẩn; tên bộ sách, lớp, tập và loại tài liệu vẫn luôn hiển thị.

## SEO và vận hành

`/sach`, toàn bộ SGK và SGV được prerender và đưa vào sitemap từ catalog. Copy
SEO của route đọc không mặc định quảng bá audio. CSP public allowlist
`cdn3.olm.vn` cho ảnh; frame-src NXBGD/FlipBuilder cùng YouTube và Google vẫn giữ
theo domain cụ thể.

Nguồn chi tiết và quyết định deduplicate nằm tại
`docs/operations/global-success-book-source-register.md`.
