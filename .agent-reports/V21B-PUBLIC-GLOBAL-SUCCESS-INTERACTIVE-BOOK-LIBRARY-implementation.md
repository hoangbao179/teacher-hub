# V21B Implementation

## Phạm vi

Tủ sách public Global Success lớp 1–9 gồm 13 sách có viewer FlipBuilder tương tác.

## Vấn đề đã sửa

- Thêm `/sach`, 13 route theo `bookSlug`, trạng thái slug không hợp lệ và filter lớp.
- Catalog duy nhất giữ URL allowlist, metadata, prerender và sitemap.
- Viewer có audio/fullscreen permission, lazy iframe, cảnh báo tải chậm và fallback tab mới.
- Thêm CTA/navigation public, bìa SVG local và CSP/Nginx direct-route.

## File chính đã đổi

`client/src/features/books/`, `client/src/App.tsx`, `client/src/components/RouteMetadata.tsx`,
`client/src/entry-server.tsx`, `client/scripts/prerender-home.mjs`,
`client/src/features/learning/seo/learningSitemap.ts`, `deploy/nginx.conf` và docs V21B.
Bìa nằm tại `client/public/images/books/global-success/`.

## API/schema thay đổi

Không có. Không thay backend, database, migration hoặc Admin flow.

## Kiểm tra đã chạy

Client typecheck/lint, targeted unit, production build, repository consistency và targeted
desktop/mobile book E2E đều PASS.

## Điểm còn lại

Release cần mở FlipBuilder thật để thử hotspot audio và fullscreen trên Chrome desktop/mobile.

## Commit

Thực hiện theo yêu cầu bổ sung của chủ repository sau khi targeted verification PASS.
