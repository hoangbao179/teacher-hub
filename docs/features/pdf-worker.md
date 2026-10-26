# PDF processing worker v1

> **Lưu ý bắt buộc:** đây là **hành vi v1 hiện tại**, không phải mục tiêu
> sản phẩm. [PDF Viewer product contract](../product-spec/pdf-viewer-links.md)
> yêu cầu tiếp nhận link có quyền Viewer và xuất PDF khi được phép; v1 chỉ
> hoạt động nếu Google Drive cho phép tải trực tiếp. Viewer nhưng bị tắt
> tải/copy/print không được đi vòng bằng chụp/scrape. Tính năng đầy đủ
> chưa được chứng minh bằng E2E trên fixture Viewer khác Owner.

The standalone `workers/pdf` service copies an authorized, anonymously downloadable
Google Drive PDF into private result storage. It retains the original PDF bytes,
vector text and embedded image quality. It does not run the browser research
pipeline or change Teacher Tools, the VPS, MySQL, client or Teacher Hub API.
See the [v1 integration contract](../api/pdf-worker-v1.md) for Task 2 and the
[operator runbook](../operations/cloud-run-pdf-worker.md) for activation gates.

## Print-locked viewer — product gap, not a finished feature

Ngày 26/10/2026, chủ dự án làm rõ tình huống chính cần xử lý là một file
Viewer có nút Print bị chủ sở hữu khóa. **Image-only PDF** là định dạng
mong muốn, nhưng định dạng đầu ra không cấp quyền vượt khóa sao chép/in.
Worker hiện chưa giải quyết được link đó; việc staging no-traffic và
`PDF_BROWSER_OK` chỉ xác nhận image build/runtime. Không tự tắt gate,
đánh tráo preview hoặc báo COMPLETED đối với nguồn bị chặn; cần sự cho
phép của chủ file hoặc bản nguồn được cấp quyền.

Nếu không thấy nút Print, `PRINT_UNAVAILABLE` thể hiện giao diện thiếu
điều khiển, không chứng minh người sở hữu đã cấm in. Nếu nút có mặt nhưng
vô hiệu hóa, `ACCESS_DENIED` là giới hạn rõ ràng. Hai trường hợp được
phân loại riêng trong Worker và phản ánh trong thông báo giao diện.

## Experimental anonymous print fallback (code, not production-active)

The Worker now contains an opt-in `PDF_PRINT_FALLBACK_ENABLED=true` mode.
It is **disabled by default**. If direct source retrieval fails with
`ACCESS_DENIED` or `UNSUPPORTED_SOURCE`, and only with this explicit flag,
the Worker can attempt to open a **public/anonymous Google Drive viewer whose
Print button is enabled**, capture each rendered page, fit onto an A4 image-only
PDF, validate with qpdf and persist to the existing job output in GCS.
No OCR/searchable text is required. Owner-disabled Print and Google-login-only
files are unsupported, not targets for bypass.

The renderer uses Playwright + pdf-lib + sharp in the **Cloud Run worker image
only**, not in the VPS API. Limits include: <=40 pages, 12 MP/page, total
captured PNG <=32 MiB, output <=10 MiB, bounded requests/observed wire bytes,
only Google Drive/Docs/static domains and no arbitrary navigation. This code
does not prove print quality or readiness for all Drive viewer variants.
Capture waits for at least 200 effective DPI at the fitted A4 size, rather than
accepting the first complete blob after zoom. It captures a unique page bitmap
without toolbar content, keeps blank pages and orientation, rejects oversized
canvases/base64 before transfer to Node, and bounds cumulative embedded JPEG bytes
before final serialization. Print permission is rechecked during capture and before
output; a changed viewer page total fails the job. A local anonymous-browser
fixture covers lazy bitmap replacement, page identity, blank/landscape pages and
capture bounds. It is not evidence of real third-party Viewer or Cloud Run E2E.
The browser lifecycle/Google network boundary stays in `renderer.ts`; the
permission-gated page-to-PDF stage is in `viewer-pdf.ts`. An owned, offline Viewer
fixture exercises that stage through an actual browser into one PDF, including
embedded page-image identity, blank/landscape pages, byte/page limits, cancellation
and a revoked Print action. It never requests a third-party document.
The previous 22s Worker job deadline is still the default; explicitly enabling
the flag allows up to 120s. The Gateway and API producer now support an
explicit `PDF_LONG_PRINT_TASKS_ENABLED=true` gate for **180s** Cloud Tasks
dispatch deadlines. Both gates are **off** by default; the staged Worker
template uses a 180s Cloud Run request timeout, while Gateway remains 30s
because it only enqueues tasks. Current live production traffic and task
deadlines are unchanged. Rendering requires a **coordinated review and activation
of Worker + producer + Gateway flags**; enabling the Worker flag alone
will not work with live 30s tasks.

**Before release:** keep flag OFF, perform authorized real-viewer E2E in an
isolated revision, review Chromium sandbox/egress, cost, image size,
RAM/CPU, 150dpi rejection threshold, existing Cloud Tasks and Gateway
allowlist constraints, partial-job cleanup, and rollback. Prefer direct PDF
bytes when Google makes those available. No production traffic/IAM/flag changed
by this PR.

## Processing architecture

1. Cloud Run IAM authenticates invocation; the process keeps GET/HEAD /health.
2. POST /jobs is disabled by default. Enabled handlers enforce strict bounded
   input and per-instance concurrency 1.
3. Production validates a bounded writable tmpfs and uses the runtime metadata
   identity to preflight object get/create permissions on the fixed bucket.
4. Create/read the immutable job/source claim; return an existing result or
   recover an output uploaded by an earlier attempt.
5. Stream a direct public Drive download through a byte bound into a private
   temporary directory. Resolve/pin public IPv4 on each allowlisted redirect.
6. Validate magic bytes and strict qpdf structure, reject encryption and excessive
   page counts. Parser resource limits run in a separate Linux subprocess.
7. Stream the unchanged PDF plus source/checksum metadata to GCS using a generation
   precondition. Persist the immutable terminal result before acknowledging.
8. Remove the temporary directory on success, failure, cancellation or deadline.

Permanent source/validation errors persist FAILED. Transport, deadline and storage
errors leave the task retryable. The claim is not a distributed lease: concurrent
attempts may duplicate bounded download work but cannot overwrite objects. First
terminal result wins. Native Docs, login-only sources, print-only/download-disabled
sources and confirmation pages have no fallback route.

## Acceptance and limits

The local synthetic PDF must pass HTTP job submission, controlled source HTTP,
real qpdf validation and fake GCS creation, with byte-identical output and empty
temporary job folders afterward. Fault tests cover invalid requests/sources/PDFs,
timeouts, size/page bounds, permissions, SSRF, generation conflicts, duplicate
delivery and a successful upload followed by failed result persistence.

Node 24 strips erasable TypeScript at runtime. `.mjs` is limited to the HTTP
lifecycle and test/automation adapters. There are no runtime npm dependencies;
qpdf and existing util-linux supply the isolated parser. `tsc --noEmit` and pinned
Node types are dev-only dependencies in the worker's separate lockfile.

The current limits (10 MiB, 40 pages, 22 seconds, 32 MiB tmpfs) are conservative
rejection thresholds, not a validated capacity/SLA promise. Synthetic blank-page
fixtures do not benchmark complex textbooks, compressed streams, scanned pages or
100–300-page files. PDF validation is not antivirus or sanitization. A killed
instance loses its temporary filesystem; if a process survives a hard kill of a
job, residual data stays inside the capped volume and may require instance restart.
No production processing is approved until Tasks 2/3, reviewed IAM/mount/config,
authorized real Drive fixtures and private cloud E2E are complete.
