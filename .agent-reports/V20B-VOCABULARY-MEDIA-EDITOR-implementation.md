# V20B Vocabulary Media Editor Implementation

## Phạm vi

Pixabay/fake provider, search cache 24 giờ, secure import, persistent storage,
same-origin delivery, image picker và bulk review trong vocabulary editor.

## Vấn đề đã sửa

- Frontend không còn cần upload/hotlink thủ công; provider có thể tắt an toàn.
- Import chỉ resolve asset còn hạn trong cache và harden SSRF, redirect, timeout,
  byte, MIME, dimension, format trước khi tạo hai rendition WebP.
- Bulk suggestions giới hạn ba search đồng thời và luôn cần giáo viên chọn.

## File chính đã đổi

`shared/src/contracts/vocabulary.ts`, migration `0017`, server media
provider/service/repository/controller/storage, vocabulary editor components,
Compose/env/OpenAPI và tài liệu vận hành.

## API/schema thay đổi

- `GET /api/vocabulary/media/status`
- `GET /api/vocabulary/media/search`
- `POST /api/vocabulary/media/import`
- `GET /api/public/vocabulary-media/:mediaId`
- Cache table và metadata/status bổ sung cho `vocabulary_media`.

## Kiểm tra đã chạy

Targeted unit/integration/E2E, Docker Compose config, backup/restore smoke và
`npm run check:full`: PASS.

## Điểm còn lại

Garbage collection media không còn reference để backlog; V20C–V20E ngoài phạm vi.

## Commit

`feat(vocabulary): add media search and image editor`
