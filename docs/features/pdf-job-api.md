# Đặc tả kỹ thuật API và vòng đời job PDF

## Nguồn đối chiếu

Contracts: `shared/src/contracts/pdf.ts`, `shared/src/pdf-pipeline.ts`;
HTTP: [OpenAPI](../api/openapi.yaml), `server/src/routes/index.ts` và hai PDF
controller. Điều phối: `pdf.service.ts`, `pdf.repository.ts`,
`pdf-guest.repository.ts`; transport active: `pdf-gateway-provider.ts`.
[Tổng quan](pdf-worker.md) giải thích luồng;
[runbook](../operations/cloud-run-pdf-worker.md) hướng dẫn vận hành.

## HTTP và public/private

Response JSON dùng `{data: ...}` hoặc envelope lỗi chung. Root public là
`/api/public/pdf`; root riêng tư `/api/pdf` cần Bearer, role TEACHER và user ACTIVE.

| Method/path sau root | Chức năng và điều kiện |
| --- | --- |
| GET `/capabilities` | Trả submit/downloadEnabled, unavailableReason và giới hạn có hiệu lực |
| POST `/session` (chỉ public) | Exact Origin; cấp cookie khi thiếu session hợp lệ |
| GET `/batches?page=1` | Phân trang cố định 20, page nguyên 1..10000 |
| POST `/batches` | `Idempotency-Key` UUID-v4 chữ thường; body links; public cần guest session và Origin |
| GET `/batches/:id` | Đọc chi tiết và tick tối đa 3 job đến hạn |
| POST `/jobs/:id/retry` | Key UUID-v4 mới, public exact Origin; tạo successor có giới hạn |
| POST `/jobs/:id/download-ticket` | Job COMPLETED chưa hết hạn, provider sẵn sàng |
| POST `/jobs/:id/download` | Body ticket; public exact Origin; attachment stream |

Public session `teacher_pdf_guest`: token ngẫu nhiên 32 byte base64url, chỉ hash
trong DB; HttpOnly, SameSite Strict, Secure production, path `/api/public/pdf`,
180 ngày. Chỉ submit cần cookie. Public list/detail/retry/ticket/download dùng
chung giữa các thiết bị, **không riêng cho trình duyệt tạo job**. Endpoint public
chỉ truy cập batch/job đã có liên kết public; admin list/count loại public.
Không đưa tài liệu riêng tư vào luồng public. Mọi mutation public kiểm tra Origin
bằng `PUBLIC_APP_ORIGIN`.

Link tối đa 512 ký tự, HTTPS `drive.google.com`, ID `[A-Za-z0-9_-]{10,128}`.
Chỉ nhận `/file/d/ID/view` không query hoặc `/open?id=ID` với đúng một key.
Từ chối query thừa/resourcekey, hash, credential, port khác chuẩn và ID trùng.
Body chính xác `{links:[...]}`; legacy thêm `rightsConfirmed:true` còn được nhận.
Hash request giữ `{files,rightsConfirmed:true}` để tương thích idempotency.
Timestamp `rightsConfirmedAt` không phải bằng chứng xác nhận quyền tải.

## Tiếp nhận, quota và idempotency

Settings chọn bằng `PDF_API_ENABLED`, `PDF_CHUNKED_JOBS_ENABLED`,
`PDF_BATCH_LIMIT`, `PDF_ACTIVE_LIMIT`, `PDF_HOURLY_LIMIT`. Số phải là chuỗi chữ số,
nguyên dương trong ceiling; sai → disabled. V1 defaults/ceilings lần lượt
5/5 link, 10/20 active, 10/30 hourly. V2 defaults và clamp 1/3/20; override thấp
hơn giữ nguyên. `maxRetries=2`. Capabilities còn đòi provider configured/ready và
v2 capabilities tương thích; submit/download cùng fail-closed nếu không ready.

Trong transaction: khóa owner user → kiểm tra public session → tìm key cũ, đối
chiếu request hash/visibility → kiểm quota → ghi batch/job/public link. Cùng key
và nội dung trả batch cũ trước kiểm quota; khác nội dung/visibility trả 409
`PDF_IDEMPOTENCY_CONFLICT`. Retry key cũng trả successor cũ trước quota.

Quota active đếm job chưa hết hạn ở `ENQUEUE_PENDING`, `ENQUEUE_RETRY`, `QUEUED`,
`RESULT_UNCONFIRMED`; không đếm `RETRY_EXHAUSTED`. Quota giờ đếm tất cả job tạo
trong một giờ trượt, kể cả v1, public/private, thất bại và manual retry;
ngưỡng job = maxHourly × maxLinks; tạo batch còn kiểm riêng số batch/giờ.
V2 một link nên tương ứng 20 job/giờ. Public cùng owner giáo viên duy nhất.

Public IP có hai bộ đếm độc lập: session 60 request/giờ; submit+retry dùng chung
60 request/giờ, fixed window, tính cả request sai/replay, trả `PDF_RATE_LIMITED`
và Retry-After. Bộ đếm process-local, restart sẽ reset; quota DB không reset.
Ticket còn có cap 20 row chưa hết hạn/owner, kể cả ticket đã consume. Đây cũng
có thể gây `PDF_RATE_LIMITED`. Không xóa lịch sử để cấp quota.

## Trạng thái và reconciliation

| Trạng thái MySQL | Khi ghi / cách tiến tiếp |
| --- | --- |
| ENQUEUE_PENDING | Intent mới; tick đọc result trước rồi enqueue |
| ENQUEUE_RETRY | Lỗi cloud khi intent chưa queued; thử lại cùng job/task |
| QUEUED | Task chờ/đang chạy hoặc vừa enqueue; không có enum RUNNING |
| COMPLETED | Claim/result hợp lệ, có metadata output; đủ điều kiện cấp ticket |
| FAILED | Result Worker vĩnh viễn hợp lệ; không suy ra từ timeout/mất kết nối |
| RETRY_EXHAUSTED | Có bằng chứng hết retry; tiếp tục đọc late result đến expiry; cho manual retry |
| RESULT_UNCONFIRMED | Kết quả chưa rõ; không coi FAILED; tiếp tục kiểm, không manual retry trước expiry |
| EXPIRED | expires_at đã qua, kể cả job từng COMPLETED/FAILED; không tải; có thể manual retry theo cap |

Tick lease tối đa 3 job/HTTP; CLI lease từng job tuần tự tối đa 50/45 giây, hard
exit 50 giây, systemd timeout 55 giây. Lease UUID 60 giây, `SKIP LOCKED`, save
chỉ khi token còn khớp; lịch hành động tiếp theo +15 giây. Network ngoài transaction.

Ưu tiên result bền vững: kiểm source hash, UUID, exact fields, thời gian claim
đúng 86.400.000 ms, expiresAt, bytes/pages theo `worker_version`, SHA-256 và đường
`jobs/UUID/output.pdf`. Lỗi schema giữ cloudErrorCode, không nhận thành công giả.
Claim không được trước job quá 60 giây hoặc ở tương lai quá 60 giây.
DB ban đầu hết hạn 24 giờ từ tạo job; khi nhận result dùng expiry của claim Worker.

V1: pending/retry enqueue cùng tên `pdf-UUID`, tối đa 8 lần attempt trước trạng
thái không xác nhận. Task thiếu là mơ hồ; v1 queued thiếu task hoặc quá 2 giờ
không result → RESULT_UNCONFIRMED. V2: đọc claim/manifest và tối đa 5 checkpoint
mới liên tục trong 15 giây, tính nextStep; chỉ kiểm task của step đang chờ.
Step mới enqueue tên `pdf-UUID-sN`; counter reset khi step tiến lên. Task thiếu
có thể enqueue lại cùng tên; sau 8 attempt cùng step → RESULT_UNCONFIRMED.

Gateway provider chỉ báo EXHAUSTED khi responseCount ≥5, dispatchCount bằng
responseCount, mã lỗi response 1..16, timestamp đúng thứ tự, ít nhất 60 giây sau
response cuối và 3.660 giây sau dispatch đầu; queue vẫn đúng retry policy.
Thiếu task không chứng minh hết retry hoặc Worker đã dừng. Late result hợp lệ có
thể thay trạng thái chưa rõ/hết retry trước expiry. Cloud Tasks retry non-2xx,
không dựa vào JSON `retryable`. Mất Worker/network giữ khả năng phục hồi cùng UUID.

Manual retry chỉ với FAILED/RETRY_EXHAUSTED/EXPIRED, không lease còn hiệu lực,
tối đa hai successor trong chuỗi và một con mỗi attempt. Job mới có UUID,
expiry và worker version theo cấu hình hiện tại; không sửa result cũ. Quota
tính lượt mới. TTL không hủy task/Worker đã chạy; cần điều tra stale dispatch.

## Database và vòng đời dữ liệu

| Migration | Dữ liệu |
| --- | --- |
| 0027 | pdf_batches, pdf_jobs/outbox, pdf_download_tickets; unique owner/key, FK và indexes |
| 0028 | pdf_guest_sessions và pdf_guest_batches; link public cùng transaction batch/jobs |
| 0029 | worker_version mặc định 1, progress_json nullable; job cũ không tự nâng v2 |
| 0030 | filename VARCHAR(180) utf8mb4 nullable; không backfill; phục hồi ledger sau atomic ALTER |

Timestamp DB dùng UTC DATETIME(3); UI hiển thị Asia/Ho_Chi_Minh. Job history/session
không có purge tự động trong module này. Ticket hết hạn được dọn khi cấp ticket;
không xóa nghiệp vụ. GCS lifecycle và TTL tải là hai cơ chế riêng.

## UI, polling và tải

UI lấy capabilities/list song song; chi tiết đọc tối đa 4 request cùng lúc.
Fixture browser/recovery phải đợi các controller request đã bắt đầu hoàn tất
trước khi seed result và đặt next_action_at đến hạn: đóng tab không hủy ngay
HTTP handler phía server. Nếu không, poll cũ có thể ghi lịch +15 giây hoặc còn
giữ lease làm sweep fixture không thấy job eligible. Browser regression chủ động
giữ một poll qua thời điểm đóng tab để bảo vệ việc đồng bộ này.
Polling 5 giây khi có job recoverable chưa hết hạn, còn lại 15 giây; ngừng khi tab
ẩn. Terminal cache chỉ đọc lại khi cần hoặc Làm mới. Key create/retry giữ trong
ref khi mạng lỗi, không bền qua reload. V2 progress DISCOVERING/RENDERING/MERGING,
tối đa 99%; chỉ COMPLETED hiển thị 100%.

`PdfJob.filename` là metadata tùy chọn, nhận từ result COMPLETED hợp lệ và lưu
trong cùng UPDATE có lease guard với trạng thái job. Direct lấy Content-Disposition
ở response cuối đã qua source policy; Viewer đọc title công khai sau discovery/render
thành công, chỉ nhận suffix ` - Google Drive` tại đúng URL tài liệu và loại tiêu đề
login/lỗi/chung. Không truy vấn thêm endpoint hay phiên Google. Khi thiếu tên,
UI và download dùng `Tài liệu <fileId>.pdf`; không backfill lịch sử cũ bằng truy vấn
Drive mới. Tên NFC, tối đa 180 byte UTF-8 gồm `.pdf`, loại ký tự điều khiển/format,
surrogate, separator/path traversal và tên thiết bị Windows; không lặp `.pdf`.
Header attachment có ASCII filename và filename* UTF-8. Không ghi tên vào log.

Lịch sử public vốn dùng chung giữa thiết bị; filename làm lộ thêm nội dung mô tả
tài liệu cho người đọc public. Form cảnh báo điều này trước khi gửi. Phạm vi
public/private và kiểm tra quyền API giữ nguyên; không gửi tài liệu nhạy cảm vào
luồng public. Tên nguồn không phải bằng chứng quyền tải.

Mobile/tablet dùng một cột; từ 1024 px form bên trái và lịch sử rộng hơn bên phải,
container tối đa MUI lg. Tên xuống dòng, trạng thái wrap và action có vùng bấm ≥44 px.
Phân trang/API vẫn giữ 20 batch. Native download hiển thị thông báo tại tài liệu
“Đã gửi yêu cầu tải PDF cho trình duyệt”, tự ẩn sau 6,5 giây hoặc đóng tay. Timer
được hủy khi thay thông báo/unmount; thao tác mới và chuyển trang xóa thông báo cũ.
Đây chỉ là thông báo bàn giao cho trình duyệt, không xác nhận download hoàn tất;
lỗi cấp ticket được hiển thị riêng và không tự ẩn như thông báo bàn giao.

Ticket ngẫu nhiên 32 byte, DB chỉ SHA-256, một lần, TTL min(120 giây, job expiry).
Consume trước mở upstream; đứt tải phải cấp ticket mới. V1 UI nhận Blob với abort
30 giây; v2 dùng form POST native, không giữ Blob 150 MiB. Route public nhận
urlencoded tối đa 1 KiB/một field, vẫn hỗ trợ JSON. Ticket không vào URL/storage.
API giữ một stream mỗi PdfService instance (public/admin có instance riêng);
Gateway giữ một stream/process. Không phải khóa toàn hệ thống.

Stream có backpressure, abort khi disconnect/deadline/expiry, kiểm đúng bytes đã
ghi nhận và cap theo version, trả application/pdf, attachment, nosniff, no-store.
Gateway v1 deadline 25 giây, API 30; v2 cả hai 180 giây; Nginx tắt buffering và
timeout idle 190 giây. Capabilities không chứng minh tải chậm/150 MiB thực tế.
