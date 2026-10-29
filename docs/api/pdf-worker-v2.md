# Contract Worker PDF v2 — xử lý theo phần bền vững

## Tương thích và payload

V2 chỉ bật khi `PDF_CHUNKED_JOBS_ENABLED=true`; job đã lưu giữ worker_version,
không tự nâng phiên bản. [V1](pdf-worker-v1.md) tiếp tục áp dụng cho xác thực,
claim/result terminal, lỗi và tạo object bất biến. Nguồn guard/type:
`shared/src/pdf-pipeline.ts`, `shared/src/pdf-limits.ts`;
implementation `workers/pdf/src/chunk-processor.ts`.

POST `/jobs`, application/json, tối đa 4.096 byte, đúng các field:

```json
{"version":2,"jobId":"55b797f0-e128-4525-8df5-c3cb92163167","source":{"provider":"google_drive","fileId":"owned_fixture_12345"},"step":0}
```

Step nguyên 0..21, UUID/fileId như v1. Không nhận range/bucket/path do caller chọn.
Tên task `pdf-UUID-sN`, OIDC audience base URL Worker, dispatch 180 giây;
handler 120 giây/bước. Queue một dispatch, Worker concurrency một.

## Các bước và object

| Bước | Hành vi |
| --- | --- |
| 0 | Tải/validate direct; ≤50 trang có thể hoàn tất bằng bytes gốc. Direct dài tạo source snapshot; fallback Viewer chỉ khi lỗi phù hợp, không PDF mã hóa; discovery tổng trang/fingerprint |
| 1..ceil(totalPages/10) | Một phần tối đa 10 trang, bắt buộc checkpoint trước đó liên tục và hợp lệ |
| ceil(totalPages/10)+1 | Tải phần theo thứ tự, kiểm bytes/hash/pages, qpdf merge, validate và publish |

Viewer luôn chia phần kể cả ít trang. Mỗi discovery/part mở browser anonymous
mới; tổng trang và SHA-256 PNG native trang 1 phải khớp manifest. Anchor không
chứng minh snapshot toàn tài liệu nếu chỉ trang sau đổi. Direct snapshot immutable
mạnh hơn. Đường active Viewer không kiểm Print; xem
[khoảng cách quyền](../features/pdf-worker.md#renderer-và-khoảng-cách-về-quyền).

Fingerprint khác trả reason nội bộ `anchor-fingerprint-mismatch` (pageIndex=1),
khác với `page-total-mismatch` và các reason `ambiguous-layout-*`/
`duplicate-page-heading`/`bitmap-oversized`. Mã result công khai vẫn là
`UNSUPPORTED_SOURCE`; không đổi schema manifest/checkpoint/result.
V2 phát `pdf-stage-failed` qua logger allowlist như v1, thêm `step` nguyên 0..21;
không ghi PNG, URL, title, fileId hoặc giá trị fingerprint. Logger lỗi không đổi
retry/persistence. Chưa có định danh revision nguồn ổn định: không dung sai pixel
hoặc bỏ anchor để tiếp tục ghép. Xem
[phân tích và hướng đối chiếu nguồn](../changes/2026-10/pdf-v2-source-diagnostics.md).

Object dưới `jobs/UUID/`, mọi create `ifGenerationMatch=0`:

| Object | Schema / vai trò |
| --- | --- |
| request.json | Claim v1: sourceHash, createdAt, expiresAt đúng 24 giờ |
| source.pdf | Snapshot direct khi cần chia; checksum xác minh lại mỗi phần |
| manifest.json | version:2, jobId, sourceHash, expiresAt, totalPages, mode:direct/viewer, fingerprint SHA-256 |
| parts/N.pdf | PDF phần đã validate |
| parts/N.json | version:2, jobId, sourceHash, expiresAt, fingerprint, index, firstPage, lastPage, bytes, sha256 |
| output.pdf | Kết quả cuối, metadata sourceHash, bytes, pages, sha256 |
| result.json | **Vẫn version:1** và exact schema COMPLETED/FAILED v1 |

Manifest v2 và result COMPLETED v1 chấp nhận thêm đúng một field tùy chọn
`filename` đã chuẩn hóa theo `shared/src/pdf-filename.ts`; field khác vẫn bị từ
chối. Claim, part, task payload và result FAILED không đổi. Payload cũ không có
tên vẫn hợp lệ. Tên không tham gia sourceHash/fingerprint/idempotency và không
thay đổi state machine. Discovery Viewer đọc title trong browser đang mở sau
capture/discovery thành công; direct đọc Content-Disposition của response cuối.
Không có tên thì bỏ field, không làm job thất bại.

Tên đi theo metadata immutable của source.pdf (direct dài), manifest.json
(Viewer/direct dài), output.pdf và result.json. Recovery sau upload mất marker
hoặc mất result dùng tên của object thắng đã lưu, không lấy lại từ phiên browser.
API lưu tên khi nhận COMPLETED; không cần thêm endpoint Gateway. Gateway chuyển
tiếp JSON opaque trong giới hạn hiện tại. Cần rollout consumer trước producer;
xem [runbook](../operations/cloud-run-pdf-worker.md#rollout-metadata-tên-tài-liệu).

Range = `(N−1)×10+1 .. min(N×10,totalPages)`; checkpoint phải khớp range,
job/source/expiry/fingerprint, hash 64 hex, bytes nguyên 1..20 MiB. Mất marker
sau upload PDF phần: đọc lại winning PDF/metadata rồi tạo marker. Duplicate có
marker hợp lệ trả lại ACK. Mất result sau upload output: khôi phục từ metadata.

ACK checkpoint HTTP 200 `{version:2,jobId,step,status:"CHECKPOINTED"}` chỉ xác
nhận bước bền vững, không phải COMPLETED. API không dùng body task làm result;
đọc GCS để phát bước tiếp. Lỗi tạm thời non-2xx retry cùng step, permanent ghi
FAILED rồi ACK. Worker không có quyền tạo task.

## Progress và transport

API đọc manifest, tối đa 5 marker mới liên tục mỗi sweep với ngân sách cloud
progress 15 giây; prefix đã xác minh cache trong MySQL. Progress gồm stage
DISCOVERING/RENDERING/MERGING, processedPages, totalPages|null, percent, nextStep.
Percent tối đa 99 trước terminal; UI chỉ hiển thị 100 với COMPLETED.
Migration 0029 thêm worker_version mặc định 1 và progress_json nullable.
[Đặc tả API](../features/pdf-job-api.md) giữ state machine/quota/retry/download.

Gateway thêm GET `/v2/capabilities`, `/v2/tasks/:UUID/:step`,
`/v2/objects/:UUID/manifest.json` và `/v2/objects/:UUID/parts/:N.json`.
HMAC và nonce bền vững áp dụng cả capabilities; không expose source/part PDF.
V2 capabilities phải khớp 200 trang/150 MiB/10 trang mỗi phần. Binary output
vẫn GET `/v1/objects/:UUID/output.pdf`; API public tải native form POST ticket.

## Ngân sách tài nguyên

| Tài nguyên | Giới hạn source / mục tiêu được readiness kiểm |
| --- | --- |
| Trang / phần | 200 / 10 |
| Source / một phần | 20 MiB / 20 MiB |
| Output | 150 MiB; tổng phần chừa 2 MiB cấu trúc (≤148 MiB) |
| Bitmap | 12 MP, ≥200 DPI; PNG mã hóa ≤32 MiB/lần capture |
| Scratch | tmpfs ≤384 MiB; trước v2 cần ≥320 MiB trống |
| Merge footprint file | ≤148 MiB phần + ≤150 MiB output, còn overhead |
| qpdf validate | Address space 512 MiB, CPU 45 giây, wall 50 giây/lần; vẫn trong 120 giây/bước |
| qpdf merge | Address space 512 MiB, CPU 25 giây, wall 30 giây |
| Worker readiness | 1 vCPU/2 GiB, concurrency 1, min 0/max 1, request timeout ≥180 giây |
| Gateway readiness | 1 vCPU/256 MiB, concurrency 10, min 0/max 1, request timeout ≥180 giây |
| Queue | 5 attempts / 3.600 giây, backoff 10..300 giây, ≤1 dispatch/giây, concurrent 1 |
| Download API/Gateway | 180 giây, cap 150 MiB; Nginx idle 190 giây và buffering off |

Writer v2 giữ một JPEG và offset xref nhỏ, ghi file rồi merge; không buffer PDF
cả tài liệu trong Node. Điều này không giới hạn tổng RAM Chromium/native/qpdf.
Tmpfs cũng tính vào RAM, còn profile `/tmp`, `/dev/shm`, cache, runtime và log.
Scratch admission kiểm tmpfs loại/capacity/free; mount 32 MiB cũ bị từ chối.
Job v1 trên revision v2 vẫn chịu cap nội dung v1 nhưng được dùng mount 384 MiB.

Local directory dọn trong finally; process/instance bị kill có thể để lại tạm
trong volume hữu hạn. GCS checkpoint/source/output giữ cho recovery, không xóa
ngay; lifecycle bảy ngày phải kiểm live, TTL tải 24 giờ vẫn độc lập. Không thêm
quyền list/delete hay tự đổi retention để giảm chi phí.

## Bằng chứng và nghiệm thu

Test chunk-pipeline có fault checkpoint/result, duplicate/out-of-order, restart,
source snapshot, direct 3/35/50/51/200 và reject >200. Viewer browser fixture
kiểm range không bắt đầu trang 1, anchor và thứ tự. Gateway test stream 150 MiB
bằng chunk, API MySQL/E2E FakeCloud kiểm persisted progress/native download.
Đây là phạm vi test source; kết quả lần chạy gần nhất và production ở
[status](../implementation/status.md), số đo lịch sử ở
[ghi chú thử nghiệm](../features/pdf-quality-poc.md).
Fixture không thay authorized Viewer khác Owner, 200 trang Cloud Run, recovery
không tab, tải chậm/thiết bị thứ hai và bản in giấy thực tế.
