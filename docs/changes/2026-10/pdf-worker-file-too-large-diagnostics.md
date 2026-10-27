# PDF Worker — FILE_TOO_LARGE diagnostics và embed budget

## Task level

Level 2 — Worker behavior + diagnostics, không đổi HTTP contract hay giới hạn sản phẩm.

## Problem

Job `8b7da878-eb05-4e55-ac69-534f61f7b459` (revision `00008-lzb`): `viewer-render`
`FILE_TOO_LARGE` với `reason=unclassified`, không có `pageIndex`/`usedBytes`.

## Root cause

1. Mọi nhánh `FILE_TOO_LARGE` trong assembly/download/validation không gắn `reason`
   allowlist.
2. Ngân sách JPEG nhúng dùng trực tiếp `cap.maxBytes` (10 MiB) nhưng kiểm tra cuối
   `doc.save()` cộng overhead pdf-lib → có thể fail ở `output-pdf-bytes` sau khi ghép
   hết trang, không có `pageIndex`.
3. `embeddedJpegCeiling` chưa trừ overhead cấu trúc → lệch giữa embed budget và
   output cap.

## Decision

- Reason riêng: `intermediate-png-page`, `intermediate-png-total`, `embedded-jpeg-total`,
  `output-pdf-bytes`, `direct-download-bytes`, `validated-pdf-bytes`.
- Log `usedBytes`/`limitBytes` (số đã validate) và `pageIndex` khi có.
- `embeddedJpegCeiling(output, pageCount)` = `output - (64 KiB + 8 KiB × pages)`;
  không tăng `PDF_MAX_BYTES`.

## Verification

- `npm --prefix workers/pdf run check`
- `npm --prefix workers/pdf test`
- `npm --prefix workers/pdf run test:docker`

## Remaining risks

- Job Drive thật chưa retry sau deploy; cần canary để xác nhận reason cụ thể.
- Tài liệu nặng vẫn có thể `FILE_TOO_LARGE` hợp lệ trong 10 MiB — không giảm DPI/quality.
