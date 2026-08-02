# V21B — Tủ sách Global Success tương tác có audio

## Mục tiêu

Triển khai public book library dựa trên 13 link FlipBuilder đã chốt, giữ nguyên chức năng lật trang và audio, không thay đổi logic Admin.

## Source hiện tại cần chạm

- `client/src/App.tsx`
- `client/src/components/RouteMetadata.tsx`
- `client/src/entry-server.tsx`
- `client/scripts/prerender-home.mjs`
- `client/src/features/learning/seo/learningSitemap.ts` hoặc tách thành public sitemap chung
- `client/src/pages/HomePage.tsx`
- `client/src/content/publicHome.ts`
- `client/src/features/learning/components/LearningShell.tsx`
- `deploy/nginx.conf`
- test scripts liên quan public routes/prerender/sitemap

## Công việc

1. Tạo `client/src/features/books/`:
   - `content/publicBookCatalog.ts`;
   - `types.ts`;
   - `seo/bookMetadata.ts`;
   - `components/BookShell.tsx`, `BookCard.tsx`, `BookViewer.tsx`;
   - `pages/BookLibraryPage.tsx`, `BookPreviewPage.tsx`, `BookNotFoundPage.tsx`.
2. Tạo 13 catalog record đúng source register.
3. Bundle 13 bìa minh họa local hoặc asset khác đã được duyệt.
4. Thêm lazy routes:
   - `/sach`;
   - `/sach/global-success/:bookSlug`;
   - `/sach/*` not found.
5. Trang `/sach`:
   - hero;
   - filter lớp;
   - group theo lớp;
   - hai card ở lớp 3–6;
   - badge audio;
   - Zalo CTA.
6. Trang preview:
   - lookup theo slug;
   - lazy iframe;
   - `allow="autoplay; fullscreen"`, `allowFullScreen`;
   - fullscreen wrapper;
   - open external fallback;
   - Zalo CTA;
   - chậm-load message, không spinner vô hạn.
7. Chỉ allowlist `online.flipbuilder.com` và path account `sdtta`.
8. Cập nhật metadata/canonical/OG cho `/sach` và 13 books.
9. Cập nhật SSR/prerender cho 14 route sách.
10. Cập nhật sitemap; sửa các test đang hard-code tổng URL `154` thành catalog-derived expectation.
11. Cập nhật `deploy/nginx.conf`:
    - thêm FlipBuilder vào public `frame-src`;
    - thêm `location = /sach` và `location ^~ /sach/`;
    - giữ nguyên CSP Admin/Play nếu không cần thay.
12. Thêm shortcut Tủ sách vào Homepage/LearningShell, thêm homepage CTA.
13. Test:
    - catalog uniqueness và 13 records;
    - filter lớp 3 trả hai sách;
    - invalid slug;
    - iframe attributes;
    - URL allowlist;
    - metadata/prerender/sitemap;
    - direct navigation `/sach/...`;
    - visual mobile/desktop.
14. Tạo agent reports implementation + verification theo convention repository.

## Guardrails

- Không thêm backend/database/migration.
- Không thêm PDF.js/react-pageflip.
- Không download hoặc commit PDF/audio.
- Không dùng `dangerouslySetInnerHTML`.
- Không thêm iframe sandbox nếu chưa chứng minh viewer vẫn chạy audio/fullscreen.
- Không refactor toàn bộ public shell ngoài phạm vi cần thiết.
- Không sửa logic Admin, Vocabulary, Student, Tuition, Schedule.
- Không dùng bìa gốc chưa được duyệt; bìa minh họa local là phương án hợp lệ.
- Không tuyên bố nguồn `sdtta` là nhà xuất bản chính thức trong UI.
