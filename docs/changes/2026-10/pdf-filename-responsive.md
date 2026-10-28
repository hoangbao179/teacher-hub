# Tên tài liệu PDF và giao diện responsive

## Task level

Initial/final: **Level 3** — migration nullable và metadata xuyên Worker/API/shared.

## Problem và root cause

Worker chưa truyền tên nguồn; UI tự đặt tên từ Drive ID, API attachment dùng job
ID. Thông báo native download nằm trong notice chung không có timeout/close nên
tồn tại sau thao tác. Container sm và stack một cột giới hạn cả desktop.

## Decision và changes

- Dùng metadata tùy chọn `filename`, không đưa tên vào claim/source hash/task/part
  hay khóa idempotency. Direct đọc Content-Disposition cuối sau source policy;
  Viewer đọc title sau discovery/render thành công ở đúng URL anonymous hiện có.
  Không thêm endpoint Google, browser session hay dependency.
- Shared chuẩn hóa NFC, giới hạn 180 byte UTF-8, loại path/control/format/surrogate
  và reserved names, giữ một đuôi PDF. Thiếu tên dùng Drive ID; không làm job lỗi.
- Manifest và result COMPLETED nhận đúng field mới tùy chọn; schema cũ vẫn hợp
  lệ và field lạ vẫn bị từ chối. Giữ tên trong immutable source/manifest/output
  và result, dùng metadata object thắng khi phục hồi upload/result bị gián đoạn.
- Migration 0030 thêm cột nullable, không backfill; UPDATE có lease guard lưu tên
  cùng kết quả. Tên đến shared DTO/UI/header UTF-8 và download native POST.
- Thông báo tải tại từng tài liệu tự ẩn 6,5 giây, có close và cleanup timer;
  không suy download completion. Lỗi cấp ticket có role alert riêng.
- Public Tools giữ pastel, một cột dưới 1024 px, form/lịch sử hai cột từ 1024 px,
  lịch sử rộng hơn, action ≥44 px, tên wrap. Header/footer/SEO/quota/resource không đổi.
- Public history đã dùng chung nhiều thiết bị; tên gốc bổ sung thông tin có thể
  nhạy cảm. Form nói rõ tính công khai; phạm vi quyền/public-private giữ nguyên.

## Verification

- `npm run check:ci`: PASS (typecheck/lint/unit/build/guards, Gateway regression).
- `node server/scripts/run-integration.cjs src/services/pdf.integration.test.ts`:
  PASS 8 test MySQL, gồm nullable/Unicode/lease/recovery ledger và luồng hiện có.
- Public PDF browser E2E chạy qua `node --import tsx` và dotenv local (không log
  credentials): PASS. MySQL/FakeCloud, reload/thiết bị khác, attachment filename,
  ticket replay/private isolation, native POST, lỗi thật, auto-dismiss/close và
  thao tác liên tiếp. Layout tại 320×720, 390×844, 768×1024, 1024×768, 1440×900,
  1920×1080 cho lịch sử trống, nhiều tên dài, processing/completed/failed và tải.
- Worker check và filename regression: PASS. Direct header/Viewer title/missing
  title/Unicode/unsafe names, v1 output recovery và v2 discovery/result recovery.
- Linux targeted regression: PASS **42/42, không SKIP**, qua image local
  `teacher-pdf-worker:chunks-local`, source/test/shared dist mới mount read-only,
  network none, 1 CPU/2 GiB, tmpfs 384 MiB. Gồm filename, chunk-pipeline,
  processing, server, storage, viewer-chunk; qpdf 51/200 trang, restart/lost
  checkpoint/result và Chromium fixture. Không build/deploy image production;
  fontconfig cảnh báo cache read-only không làm test lỗi, không phải benchmark RAM.
- API filename validator regression: PASS cho payload cũ, payload mới và reject
  metadata sai/field lạ. Repository/docs guard và diff whitespace được kiểm cuối task.
- Lần chạy browser đầu thiếu DB_PASSWORD; đã dùng cấu hình local sẵn có, không
  thay `.env`. Worker shutdown test gọi từ root sai cwd bị lỗi module; chạy lại
  từ `workers/pdf` PASS. Đây là lỗi invocation, không đổi test để bỏ gate.

## Documentation updated

Product spec PDF, đặc tả API/job, OpenAPI, Worker contracts v1/v2, status và runbook
rollout/rollback được cập nhật tại nguồn chuẩn; không tạo thêm tài liệu trùng lặp.

Các file triển khai và regression thuộc phạm vi:

- Shared: `shared/src/pdf-filename.ts`, `shared/src/pdf-pipeline.ts`,
  `shared/src/contracts/pdf.ts`, `shared/src/index.ts`.
- Worker: `workers/pdf/src/filename.ts`, `download.ts`, `renderer.ts`,
  `processor.ts`, `chunk-processor.ts`, `contract.ts` trong cùng thư mục src;
  `workers/pdf/test/filename.test.mjs`.
- API/DB: `server/src/controllers/pdf.controller.ts`,
  `server/src/repositories/pdf.repository.ts`, `server/src/services/pdf.service.ts`,
  `pdf-validation.ts`, `pdf-filename.test.ts`, `pdf.integration.test.ts` trong cùng
  thư mục services; `server/src/db/migration-recovery.ts`,
  `server/src/db/migrations/0030_pdf_filename.sql`.
- UI/browser: `client/src/components/PublicPdfTool.tsx`,
  `client/src/pages/PublicToolsPage.tsx`, `client/scripts/public-pdf.e2e.mjs`.
- Tài liệu: `docs/api/openapi.yaml`, `docs/api/pdf-worker-v1.md`,
  `docs/api/pdf-worker-v2.md`, `docs/features/pdf-job-api.md`,
  `docs/implementation/status.md`, `docs/operations/cloud-run-pdf-worker.md`,
  `docs/product-spec/pdf-viewer-links.md` và báo cáo này.

## Rollback

Thứ tự rollout: migration → API/recovery/shared reader → Worker → frontend.
Gateway không cần đổi code/resource. Tránh traffic cũ/mới trộn khi bắt đầu ghi
metadata; đợi dispatch cũ hoàn tất. Rollback frontend độc lập; giữ reader tương
thích khi còn manifest/result có tên. Giữ cột nullable, không drop/backfill hay
chỉnh object bất biến. Chi tiết tại runbook PDF.

## Remaining risks

- Fixture không chứng minh Google Drive thật luôn có tên hoặc authorized Viewer
  khác Owner hoạt động E2E. Chưa chạy Cloud Run/Google Drive thật hay actual print.
- Khoảng cách quyền Print/canDownload đã ghi trong product spec vẫn tồn tại, không
  được coi là đã khắc phục bởi task metadata/UI này.
- Không đổi VPS/Worker/Gateway resources, queue dispatch, 200 trang/150 MiB output,
  20 MiB source, 20 lượt/giờ, 3 active jobs, ticket một lần và recovery/cleanup.
- Chưa push/merge/deploy/chuyển traffic; test local không chứng minh production-ready.
