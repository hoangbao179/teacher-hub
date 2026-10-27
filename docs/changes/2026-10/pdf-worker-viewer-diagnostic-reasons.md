# PDF Worker — viewer diagnostic reasons và layout capture

## Task level

Initial: Level 2. Final: Level 2 — chỉ Worker offline tests, không đổi API/contract HTTP,
migration hay IAM.

## Problem

Job `60e4ad2b-a560-44fe-bc45-f2feb205d397` (revision `00005-r9d`): direct-validation
`html-response` rồi viewer-render `UNSUPPORTED_SOURCE` với `reason=unclassified`, không
xác định được công đoạn lỗi trong pipeline Viewer.

## Root cause

1. Nhiều nhánh `JobError('UNSUPPORTED_SOURCE')` trong capture/assembly không gắn
   `reason` allowlist; `diagnostics.ts` map thành `unclassified`.
2. `capture-page.ts` truyền lại `{ error }` từ `resolve()` nhưng bỏ `reason` khi
   re-check sau decode.
3. Layout capture từ chối mọi `button` trong wrapper trang (kể cả control ẩn/không
   toolbar), dễ fail sớm trên markup Drive thật.
4. Chỉ số trang chỉ nhận `n / m`, không nhận `n of m`; zoom chỉ thao tác
   `[role="combobox"]`, không hỗ trợ `<select>`.

Không có log Cloud Run đủ chi tiết cho job trên để khẳng định nhánh cụ thể trước sửa;
sửa dựa trên phân tích code và regression offline.

## Decision and changes

- Bổ sung `reason` allowlist và gắn trên toàn pipeline Viewer (page count, layout,
  bitmap, assembly).
- Sửa propagate `reason` trong `captureViewerPage`.
- Nới layout: chỉ fail khi có `[role="toolbar"]` hiển thị trong wrapper, không fail
  vì button thường.
- Parser trang dùng chung (`/` và `of`); zoom hỗ trợ `<select>`.

## Verification

- `npm --prefix workers/pdf run check`
- `npm --prefix workers/pdf test` — 87 pass, 2 skip
- `npm --prefix workers/pdf run test:docker` — PASS (image `teacher-pdf-worker:local-processing-v1`)

## Follow-up (2026-10-27)

- Tách `ambiguous-page-layout` thành `ambiguous-layout-multiple-headings`,
  `ambiguous-layout-multiple-images`, `ambiguous-layout-toolbar-visible`.
- Log an toàn thêm `pageIndex` và `ancestorLevel` khi capture layout fail.
- Đếm chỉ `h2`/`img` hiển thị trong wrapper; chờ quiet 750ms trước khi fail layout
  trong lúc zoom/lazy-load (tránh false positive từ DOM tạm).

## Remaining risks

- Job `1_ArvHdCmU5958R5Le27wjNsRiI5ynzIr` chưa được E2E lại sau sửa; giả thuyết
  chính là heading ẩn/virtualized trong cùng wrapper. Cần retry trên revision mới
  để đọc `reason` + `ancestorLevel` thực tế.
