# PDF output 20 MiB và shared limits

## Task level

Level 3 — contract/API cap, shared source of truth, Worker/Gateway/Backend/Frontend, Docker build context.

## Problem

Cap 10 MiB khiến tài liệu viewer nhiều trang (ví dụ 17 trang) fail `FILE_TOO_LARGE` dù vẫn trong phạm vi sản phẩm; giới hạn bị hardcode rải rác.

## Decision

- `shared/src/pdf-limits.ts`: `PDF_OUTPUT_MAX_BYTES` 20 MiB, `PDF_MAX_PAGES`, `PDF_INTERMEDIATE_PNG_PEAK_BYTES` 32 MiB (peak, không cộng dồn PNG), `PDF_VIEWER_JPEG_QUALITY` 88.
- Worker Docker build từ repo root; copy `shared/dist` + `file:../../shared`; `.dockerignore` ngoại lệ `!shared/dist/**`.
- PNG assembly: chỉ kiểm tra peak per page; bỏ cumulative `intermediate-png-total`.

## Verification

- `npm run build:shared`
- `npm run typecheck`
- `npm --prefix workers/pdf run check && npm --prefix workers/pdf test && npm --prefix workers/pdf run test:docker`

## Remaining risks

- Chưa E2E Drive 17 trang trên Cloud Run sau deploy; cần canary xác nhận ≤20 MiB và chất lượng chữ.
