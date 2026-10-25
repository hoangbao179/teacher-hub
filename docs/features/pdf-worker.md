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
