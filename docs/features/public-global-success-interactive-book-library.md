# Tủ sách công khai Global Success có audio — V21B

## 1. Mục tiêu

Bổ sung tủ sách công khai tại `tienganhcovy.com` để học sinh, phụ huynh và cô giáo có thể:

- chọn nhanh sách theo lớp;
- phân biệt Tập 1/Tập 2 ở lớp 3–6;
- xem sách bằng FlipBuilder ngay trong website;
- lật trang, phóng to, toàn màn hình và bấm nút loa để nghe;
- liên hệ cô Vy qua Zalo;
- sử dụng không cần đăng nhập trên desktop và mobile.

## 2. Phạm vi V21B

### Có triển khai

- 1 bộ sách `Global Success`;
- lớp 1–9;
- 13 sách học sinh;
- catalog tĩnh trong frontend;
- `/sach` và `/sach/global-success/:bookSlug`;
- iframe FlipBuilder;
- audio capability hiển thị rõ trên UI;
- fallback mở tab mới;
- SEO, sitemap, prerender và direct-route Nginx;
- bìa minh họa local;
- Zalo CTA lấy từ `publicHomeContent.contact.zaloUrl`.

### Không triển khai

- database/migration/API/Admin CRUD;
- upload PDF;
- PDF.js hoặc tự dựng page flip;
- tải/copy audio về VPS;
- giới hạn trang theo tài khoản học sinh;
- giỏ hàng, giá, đơn hàng, thanh toán;
- bộ lọc bộ sách khi chỉ có Global Success.

## 3. Catalog chuẩn

| Lớp | Tập | Slug | Mã FlipBuilder |
|---:|---:|---|---|
| 1 | – | `tieng-anh-1` | `rhkc` |
| 2 | – | `tieng-anh-2` | `swxe` |
| 3 | 1 | `tieng-anh-3-tap-1` | `jreh` |
| 3 | 2 | `tieng-anh-3-tap-2` | `boce` |
| 4 | 1 | `tieng-anh-4-tap-1` | `nhxm` |
| 4 | 2 | `tieng-anh-4-tap-2` | `hdnt` |
| 5 | 1 | `tieng-anh-5-tap-1` | `yqgr` |
| 5 | 2 | `tieng-anh-5-tap-2` | `fwzo` |
| 6 | 1 | `tieng-anh-6-tap-1` | `xyup` |
| 6 | 2 | `tieng-anh-6-tap-2` | `gupl` |
| 7 | – | `tieng-anh-7` | `izpd` |
| 8 | – | `tieng-anh-8` | `dnxb` |
| 9 | – | `tieng-anh-9` | `gqmy` |

Nguồn đầy đủ nằm tại `docs/operations/global-success-book-source-register.md`.

## 4. Luồng người dùng

```text
Homepage / menu
→ /sach
→ chọn lớp
→ chọn Tập nếu lớp có hai tập
→ /sach/global-success/:bookSlug
→ nhúng viewer FlipBuilder
→ bấm nút loa trong trang sách để nghe
```

Không tạo wizard. Bộ lọc lớp và danh sách sách nằm trên cùng một trang.

## 5. Mô hình dữ liệu

```ts
export type PublicBook = {
  id: string;
  slug: string;
  title: string;
  grade: 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9;
  volume?: 1 | 2;
  seriesSlug: "global-success";
  seriesName: "Global Success";
  bookType: "STUDENT_BOOK";
  viewerKind: "FLIPBUILDER";
  previewUrl: string;
  coverUrl: string;
  capabilities: {
    pageFlip: true;
    zoom: true;
    fullscreen: true;
    audio: true;
  };
  audioVerification: "CONFIRMED_BY_PRODUCT_OWNER";
  enabled: boolean;
  displayOrder: number;
};
```

## 6. Routing

```text
/sach
/sach/global-success/tieng-anh-1
/sach/global-success/tieng-anh-3-tap-1
/sach/global-success/tieng-anh-3-tap-2
...
/sach/global-success/tieng-anh-9
```

Không dùng `:grade` vì một lớp có thể có nhiều tập.

## 7. Viewer

Iframe tối thiểu:

```tsx
<iframe
  title={`Xem ${book.title}`}
  src={book.previewUrl}
  loading="lazy"
  referrerPolicy="strict-origin-when-cross-origin"
  allow="autoplay; fullscreen"
  allowFullScreen
/>
```

### Quy tắc

- Chỉ cho URL từ `https://online.flipbuilder.com/sdtta/`.
- Không dùng `dangerouslySetInnerHTML`.
- Không thêm `sandbox` ở V21B nếu chưa test đầy đủ; sandbox có thể làm hỏng JS/audio/fullscreen của viewer.
- Không đọc hoặc điều khiển DOM bên trong iframe do cross-origin.
- Có timer UI khoảng 8 giây; sau đó hiện thêm CTA `Mở ở tab mới`, nhưng không kết luận iframe lỗi chỉ dựa trên cross-origin.
- Parent CTA fullscreen có thể fullscreen wrapper; viewer vẫn có fullscreen riêng bên trong.

## 8. Audio

- Audio nằm trong viewer FlipBuilder, không do Teacher Hub host.
- UI ngoài iframe chỉ ghi `Có bài nghe`.
- Không tạo player audio riêng.
- Không cố map track theo trang.
- `allow="autoplay"` giúp viewer sử dụng audio; âm thanh vẫn nên bắt đầu sau thao tác người dùng.

## 9. Hiệu năng

- `/sach` không tạo 13 iframe.
- Chỉ trang chi tiết tạo một iframe.
- Cover dùng asset local, kích thước hợp lý, cache immutable.
- Lazy-load trang chi tiết.
- Không proxy viewer qua backend.

## 10. SEO

- `/sach`: indexable, canonical riêng.
- 13 route sách: indexable, title/description/canonical riêng.
- Metadata dùng catalog làm source of truth.
- Prerender `/sach` và 13 route sách.
- Sitemap tổng = homepage + learning routes + book routes.
- Không tạo Product schema, giá, rating hoặc inventory giả.

## 11. Dependency ngoài hệ thống

Các link `sdtta` có thể thay đổi hoặc bị gỡ. Release phải có:

- CTA `Mở ở tab mới`;
- trang trạng thái thân thiện khi source disabled;
- catalog `enabled` để tắt một cuốn mà không sửa UI logic;
- checklist kiểm tra link định kỳ trước deploy.
