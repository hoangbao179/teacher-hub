# Contract Worker PDF v1

## Phạm vi và request

V1 vẫn cần để xử lý job đã lưu và khi v2 chưa bật. Đọc
[yêu cầu quyền](../product-spec/pdf-viewer-links.md),
[đặc tả API/job](../features/pdf-job-api.md) và [v2](pdf-worker-v2.md).
Contract không tuyên bố production đã kích hoạt.

Cloud Tasks gửi POST `/jobs`, Content-Type application/json, tối đa 4.096 byte:

```json
{"version":1,"jobId":"55b797f0-e128-4525-8df5-c3cb92163167","source":{"provider":"google_drive","fileId":"owned_fixture_12345"}}
```

Chỉ đúng các field ở cả hai cấp. UUID-v4 chữ thường, RFC variant;
fileId `[A-Za-z0-9_-]{10,128}`. Không nhận URL, resourcekey, cookie, credential,
bucket, output path hay tùy chọn export. Guard: `workers/pdf/src/contract.ts`.
Cloud Run IAM xác thực OIDC trước process: invoker
`teacher-pdf-invoker@teacher-hub-pdf.iam.gserviceaccount.com`, audience bằng base
URL Worker, không `/jobs`. Header X-CloudTasks không cấp quyền.

## Response và lỗi

| HTTP | Ý nghĩa |
| --- | --- |
| 200 | Đã lưu result COMPLETED hoặc FAILED; ACK cả lỗi nguồn vĩnh viễn |
| 400 | Request sai, ví dụ INVALID_REQUEST; không phải result PDF |
| 413 | BODY_TOO_LARGE |
| 409 | JOB_CONFLICT: UUID đã gắn nguồn khác |
| 404 | Processing tắt hoặc route/method không hỗ trợ |
| 503 | Lỗi tạm thời, retry cùng UUID/nguồn |

Lỗi HTTP dùng `{error:CODE,retryable:boolean}`, trừ 404 `{error:"not_found"}`.
Cloud Tasks retry mọi non-2xx bất kể `retryable`; producer phải validate và giới
hạn queue. Permanent result codes: ACCESS_DENIED, PRINT_UNAVAILABLE,
UNSUPPORTED_SOURCE, INVALID_PDF, FILE_TOO_LARGE, PAGE_LIMIT_EXCEEDED, JOB_EXPIRED.
PRINT_UNAVAILABLE còn trong schema/nhánh legacy; renderer active không kiểm Print.
Không quy ACCESS_DENIED đơn lẻ thành bằng chứng owner cấm in.

Lỗi tạm thời: SERVICE_UNAVAILABLE (config/IAM/parser launcher), SOURCE_UNAVAILABLE
(Drive 429/5xx, Viewer chưa sẵn sàng), STORAGE_UNAVAILABLE, TIMEOUT, INTERNAL_ERROR.
Không persist timeout thành FAILED. Thiếu qpdf/prlimit không phải INVALID_PDF.

## Claim, output và kết quả bất biến

Bucket cố định `teacher-hub-pdf-results-2026`, prefix `jobs/<jobId>/`:

- `request.json`: `{version:1,sourceHash,createdAt,expiresAt}`. SHA-256 của JSON
  `{provider,fileId}` đúng thứ tự; không raw ID/URL trong claim. Hai thời điểm
  lấy từ cùng một mốc, chênh đúng 24 giờ; UTC ISO có mili giây.
- `output.pdf`: bytes và custom metadata sourceHash, bytes/pages dạng chuỗi,
  sha256, completedAt. V1 direct giữ nguyên bytes; Viewer là PDF ảnh đã validate.
- `result.json`: schema terminal dưới đây; không signed/public URL.

Result COMPLETED có thể thêm `filename` tùy chọn đã chuẩn hóa (NFC, ≤180 byte
UTF-8, đuôi `.pdf`), cùng tên trong custom metadata output.pdf để phục hồi sau
mất result. Result FAILED không có field này; claim/request không đổi. API mới
nhận cả schema cũ không tên và schema có đúng field tùy chọn; field lạ vẫn từ chối.
Xem [quy tắc tên và fallback](../features/pdf-job-api.md#ui-polling-và-tải).

```json
{
  "version": 1,
  "jobId": "55b797f0-e128-4525-8df5-c3cb92163167",
  "status": "COMPLETED",
  "objectName": "jobs/55b797f0-e128-4525-8df5-c3cb92163167/output.pdf",
  "bytes": 12345,
  "sha256": "aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
  "pages": 2,
  "completedAt": "2026-10-24T08:00:00.000Z",
  "expiresAt": "2026-10-25T08:00:00.000Z"
}
```

Ví dụ tổng hợp, không phải checksum đã đo. FAILED chỉ có version, jobId, status,
errorCode, completedAt, expiresAt. API kiểm exact fields, bytes/pages nguyên dương,
SHA-256 64 hex và đường output đúng UUID.

Mọi create GCS có `ifGenerationMatch=0`. Claim gắn UUID với nguồn; không phải
lease phân tán. Duplicate có thể lặp công việc nhưng không overwrite. Result
terminal đầu tiên thắng. Output đã upload nhưng result chưa ghi được sẽ được
khôi phục từ metadata; đọc winner khi thua race. Nếu FAILED thắng trước output,
PDF mồ côi không được cấp tải, chờ lifecycle. Retry thủ công dùng UUID mới.
Không xóa claim/result khi task còn khả năng redelivery.

TTL ứng dụng 24 giờ; lifecycle bảy ngày là chính sách vận hành cần kiểm live,
không tự xóa ở mốc 24 giờ và không thay quyền tải. Job hết hạn không tải được
kể cả object còn tồn tại. Kiểm result trước expiry/new work bảo toàn result cũ.

## Xử lý và giới hạn runtime

`PDF_PROCESSING_ENABLED=true`, runtime Cloud Run, `PDF_WORKER_IAM_READY=true`,
`PDF_TEMP_ROOT=/tmp/pdf-worker` và Storage get/create preflight là điều kiện
production handler. `/health` chỉ liveness. Handler busy trả 503.

| Giới hạn | Hành vi source |
| --- | --- |
| PDF nguồn/output | Mỗi loại 20 MiB; PDF_SOURCE_MAX_BYTES/PDF_MAX_BYTES chỉ hạ ceiling |
| Trang | PDF_MAX_PAGES mặc định/tối đa 40 |
| Handler | PDF_DEADLINE_MS mặc định/tối đa 120.000 ms vì fallback luôn bật |
| Direct redirect | Tối đa 3; HTTPS drive.google.com/uc hoặc drive.usercontent.google.com/download |
| DNS direct | Chỉ IPv4 public, resolve 2 giây/một try, pin IP vào TLS; không IPv6 |
| qpdf validate v1 | Address space 512 MiB, CPU 5 giây, wall 6 giây/lần, output 16 KiB |
| Storage JSON | 16 KiB; fetch có abort, không SDK retry ngầm |
| Scratch | tmpfs tối đa 32 MiB trên revision chỉ v1; revision v2 cho job v1 dùng mount 384 MiB |
| Thực thi | Một request/handler instance; queue mục tiêu một dispatch |

Direct stream bắt đầu `uc?export=download&id=ID`, không theo form HTML. Kiểm magic,
qpdf encryption/structure/page count/SHA-256; warning cũng bị từ chối. Lỗi direct
ACCESS_DENIED/UNSUPPORTED_SOURCE phù hợp (HTML hoặc lỗi download) mới fallback.
PDF mã hóa không fallback. Byte/page overflow không phải lý do chụp lại.

Renderer anonymous active luôn dùng view-only, không xác minh Print/canDownload;
[rủi ro quyền và giới hạn ảnh](../features/pdf-worker.md#renderer-và-khoảng-cách-về-quyền)
phải được giải quyết riêng. Browser giới hạn 500 request, 64 MiB response-body
quan sát được, allowlist Google; đây không phải firewall hay trần RAM.
Chromium sandbox đang tắt. qpdf không phải antivirus; direct PDF giữ cả tính năng
nhúng, không được chứng nhận đã làm sạch.

## Chẩn đoán an toàn

Processor v1 emit `pdf-stage-failed`: jobId, sourceHash, stage, fallbackEnabled,
code/reason/retryable trong allowlist; có thể thêm pageIndex, ancestorLevel,
usedBytes/limitBytes đã kiểm. Stage: direct-download, direct-validation,
viewer-render, viewer-validation, storage. Không raw source ID/URL, cookie,
token, body, parser stderr hay stack. Unknown được chuẩn hóa, logging lỗi không
chặn persistence. Processor v2 không có cùng lời gọi diagnostic này; không hứa
log stage đầy đủ cho mọi job. Ý nghĩa lỗi và cách điều tra ở runbook.
