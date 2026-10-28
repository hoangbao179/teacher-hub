# ADR: định danh producer PDF và Gateway ngoài VPS

## Trạng thái

Quyết định kiến trúc source đã được chấp nhận: Gateway HMAC, outbox MySQL và
Worker Cloud Run riêng tư. Hai chế độ xác thực dưới đây có trong code; việc
chấp nhận source không cấp quyền công khai Gateway hoặc kích hoạt production.
Trạng thái vận hành chỉ theo [status](../implementation/status.md).

## Bối cảnh

VPS ngoài Google Cloud không tự có workload identity được chứng thực. Một cờ
boolean không tạo identity. VPS 1,5 GB RAM/1 vCPU/15 GB SSD dùng chung với MySQL,
API/Web/Caddy; renderer phải tách ngoài. GitHub verifier WIF không đại diện VPS.
Cần producer có giới hạn quyền, retry bền vững và tải không giữ cả PDF trong RAM.

## Quyết định

Dùng Cloud Run Gateway nhỏ, chỉ cho phép queue/bucket/Worker cố định; runtime
identity Gateway lấy token ngắn hạn từ metadata. API và recovery CLI dùng chung
approval-file loader, mặc định DisabledPdfProvider khi thiếu cấu hình hợp lệ.

- Chế độ riêng tư mặc định `iam_hmac_v1`: issuer độc lập chứng thực VPS → STS →
  IAM Credentials ID token audience Gateway; gửi cả IAM và HMAC. Cần issuer đã
  được duyệt và cơ chế renew JWT; chưa có bằng chứng issuer VPS hiện hành.
- Chế độ public có chủ đích `hmac_public_v1`: approval schema riêng thay federation
  bằng authMode; chỉ Gateway bỏ IAM invocation check sau review độc lập. HMAC là
  credential producer duy nhất, không tự chọn khi IAM token lỗi/thiếu. Worker
  vẫn riêng tư, Cloud Tasks gọi bằng OIDC.

GCS nonce create-only bảo vệ replay qua restart/instance. Job MySQL là outbox;
lease có hạn và task tên xác định. Network nằm ngoài transaction. Reconciler
độc lập chạy one-shot qua systemd mỗi phút, không thêm daemon/container.
Result thiếu là không xác nhận, không giả định FAILED. Download dùng ticket một
lần và streaming qua API, không signed URL hay signBlob.

## Phương án đã cân nhắc

| Phương án | Đánh giá |
| --- | --- |
| VPS federation với issuer có sẵn | Giữ Gateway IAM; cần chứng thực máy độc lập, renew/revoke và review audience/subject |
| Gateway public HMAC | Ít phụ thuộc issuer; tăng bề mặt lạm dụng và chi phí request chưa xác thực |
| Tự dựng CA/X.509/OIDC hoặc mTLS broker | Thêm vận hành certificate/key, hosting, rotation/revoke và chi phí; không mặc định làm |
| Chuyển producer vào cloud | Có attested identity nhưng thay deployment/chi phí, cần duyệt riêng |
| SA JSON key, ADC cá nhân, GitHub token giao định kỳ cho VPS | Không chấp nhận làm identity runtime |
| Worker public hoặc ký URL bằng quyền rộng | Không chọn; không cần mở Worker hay signBlob |

REST producer cũ chỉ còn là adapter được inject rõ ràng trong source/test;
không phải runtime Gateway mặc định. Pool WIF VPS từng được đề cập trong tài liệu
cũ không chứng minh đang sử dụng hoặc có issuer hợp lệ.

## Hệ quả và ranh giới quyền

Gateway cần tasks.create/get, queues.get trên queue cố định, actAs invoker SA,
objects.get bucket kết quả, objects.create chỉ prefix gateway-nonces/; secret
accessor đúng phiên bản. Worker chỉ objects.get/create, không Tasks/list/delete.
Invoker chỉ run.invoker Worker. Caller riêng tư chỉ run.invoker Gateway và
subject-scoped federation, không Tasks/GCS. Verifier GitHub chỉ đọc tài nguyên
cần readiness, không deploy/push/IAM write; không giữ đường impersonate deployer.
Phải kiểm cả IAM kế thừa/custom role/delegation, không suy least privilege từ
một lần describe thành công.

Secret bị lộ cho phép giả producer với mọi thao tác allowlist đến khi thu hồi.
CORS, UUID khó đoán, token bucket từng instance và maxScale không phải giới hạn
chi tiêu toàn cục. Nonce thêm GCS writes/retention; public Gateway chịu cả request
không chữ ký. CPU/RAM, Tasks, Storage, polling, download egress, registry/log và
backup đều có chi phí. Các gate bảo mật/tài nguyên/recovery/E2E và rollback nằm
trong [runbook](../operations/cloud-run-pdf-worker.md); không tự cấp IAM hay
thay kiến trúc để vượt một gate đang lỗi.
