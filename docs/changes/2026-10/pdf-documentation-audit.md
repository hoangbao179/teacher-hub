# Kiểm toán và hợp nhất tài liệu PDF

## Phân loại nhiệm vụ

Ban đầu và cuối cùng: **Level 3**, vì chuẩn hóa hướng dẫn deployment, identity,
bảo mật, recovery và rollback. Diff chỉ tài liệu và một đường dẫn trong comment
script; không đổi logic, contract thực thi, migration, cấu hình hay hạ tầng.

Nguồn phân tích: `origin/main` sau fetch, commit
`35ff0f8b5a28f91aa7720dbcead85d3f4fe7ef32` (#49). Working tree ban đầu sạch,
branch `docs/kiem-toan-pdf` tạo từ origin/main; không stash/reset/rewrite/push.
Ngày kiểm toán 28/10/2026, múi giờ Asia/Bangkok.

## Vấn đề và nguyên nhân

Tài liệu cũ trộn nhiều giai đoạn triển khai vào mô tả hiện hành: health-only,
direct-only, fallback có gate Print, rồi view-only; các giá trị 10/20/150 MiB,
22/30/120/180 giây và quota cũ cùng tồn tại mà không phân biệt phiên bản.
Report triển khai được dẫn như nguồn vận hành, gây hiểu nhầm “đã có source”,
“image đã push”, “revision đã tạo” là đã phục vụ production hoặc đã nghiệm thu.

Product spec vừa cấm bypass restriction vừa mô tả capture khi Print bị khóa;
feature/runbook còn hứa env false tắt fallback và Print được recheck. Code hiện
không làm vậy. Có runbook mô tả producer chưa nối API trong khi Gateway/outbox/
recovery đã có source; có hướng dẫn rollback tắt recovery gây mất khả năng nối
job v2. Tài liệu production còn IP quota 5/10 thay vì 60/60.

## Quyết định và thay đổi

Giữ yêu cầu sản phẩm làm chuẩn mong muốn; mô tả code như thực tế implementation,
không sửa business/logic để hợp thức hóa tài liệu. Hợp nhất 7 runbook và 25 report
PDF sau khi chuyển kiến thức vận hành, quyết định, lỗi khó và số đo còn giá trị.
Git history bảo toàn chi tiết command/test từng đợt; không giữ bản deprecated
trùng nội dung. Contract v1 vẫn giữ vì handler/API còn tương thích job v1.

### Tài liệu chính

| File | Quyết định | Vai trò sau kiểm toán |
| --- | --- | --- |
| docs/features/pdf-worker.md | VIẾT LẠI | Tổng quan, sơ đồ, giới hạn và bản đồ đọc |
| docs/product-spec/pdf-viewer-links.md | VIẾT LẠI | Mục tiêu/quyền/chất lượng/nghiệm thu, không trộn nhật ký implementation |
| docs/features/pdf-job-api.md | VIẾT LẠI | HTTP/public-private, DB, quota, state machine/recovery/ticket/UI |
| docs/api/pdf-worker-v1.md | VIẾT LẠI | Payload/result v1, bất biến/TTL, lỗi và giới hạn runtime |
| docs/api/pdf-worker-v2.md | VIẾT LẠI | Step/checkpoint/manifest/merge, progress và resource budget |
| docs/operations/cloud-run-pdf-worker.md | VIẾT LẠI | Runbook duy nhất Windows/VPS, release/readiness/cost/incident/rollback |
| docs/decisions/ADR-pdf-producer-identity.md | VIẾT LẠI | Bối cảnh/quyết định/phương án/hệ quả của Gateway, giữ hai mode |
| docs/features/pdf-quality-poc.md | VIẾT LẠI | Bằng chứng lịch sử, phương pháp đo và giới hạn suy luận |
| docs/implementation/status.md | VIẾT LẠI PHẦN PDF | Nguồn trạng thái duy nhất, ngắn và phân mức bằng chứng |
| docs/api/openapi.yaml | SỬA DIỄN GIẢI | Dịch phần PDF và sửa mô tả quyền/giới hạn/MISSING; giữ nguyên schema máy đọc |
| docs/README.md | CẬP NHẬT CHỈ MỤC | Điểm vào bộ tài liệu chuẩn |
| docs/architecture/deployment.md; docs/operations/production.md | SỬA PHẦN PDF | Bỏ mô tả chưa tích hợp/quota cũ, dẫn runbook chuẩn |
| AGENTS.md, source/test/migration/workflow/Dockerfile | GIỮ | Đối chiếu, không sửa behavior hoặc xóa; script stage chỉ đổi link comment |

### Runbook hợp nhất rồi xóa

Tên file dưới thuộc `docs/operations/`; không còn là đích tham chiếu.
Tất cả chuyển sang runbook Cloud Run chuẩn, lý do từng file:

| File | Quyết định | Kiến thức bảo toàn / lý do bỏ bản riêng |
| --- | --- | --- |
| pdf-long-documents.md | HỢP NHẤT + XÓA | Activation v2, pin, systemd, quota, chi phí, rollback trùng runbook tổng |
| pdf-vps-activation.md | HỢP NHẤT + XÓA | Private IAM/HMAC, schema, JWT/host modes và recovery; flow thủ công cũ không còn là mặc định |
| pdf-vps-hmac-public.md | HỢP NHẤT + XÓA | Public-HMAC, replay/abuse, exposure/containment; phân biệt helper legacy |
| pdf-release-audit.md | HỢP NHẤT + XÓA | Stage/smoke/audit không chứng minh promote hoặc E2E; giá trị cờ cũ sai |
| pdf-job-api.md | HỢP NHẤT + XÓA | State/recovery sang đặc tả, migration/CLI/rollback sang runbook |
| pdf-gateway.md | HỢP NHẤT + XÓA | HMAC/nonce/least privilege và các gate trùng ADR/runbook |
| pdf-cloud-rollout.md | HỢP NHẤT + XÓA | Staging private legacy, giữ cảnh báo không dùng làm deploy v2 |

### Report PDF hợp nhất rồi xóa

Tên dưới thuộc `docs/changes/2026-10/`; quyết định từng file là **HỢP NHẤT + XÓA**.
Cột đích mô tả nơi giữ kiến thức cần bảo toàn; nhật ký test/command cũ ở Git.

| File | Kiến thức giữ lại và đích |
| --- | --- |
| cloud-run-pdf-worker-foundation.md | Tách Worker khỏi VPS, IAM trước process; tổng quan/ADR/runbook |
| pdf-worker-deployment-hardening.md | Không yêu cầu IAM write từ deployer, pre/post inventory; runbook |
| pdf-environment-validator-schema.md | Schema API không chứng minh policy branch; quyết định mới strict type và bypass explicit; runbook |
| pdf-worker-single-owner-wif.md | Verifier-only, reviewer optional không thay IAM/provider boundary; runbook |
| pdf-worker-processing-v1.md | Claim/output recovery, parser launch lỗi khác PDF hỏng, await persistence trước cleanup; contract v1/ghi chú bên dưới |
| pdf-job-api-cloud-tasks.md | Outbox/lease, CLI độc lập, missing không FAILED, late result; đặc tả API |
| pdf-tools-ui.md | Public history chung, atomic link, admin loại public, proxy/client 401; đặc tả/production/ghi chú bên dưới |
| pdf-cloud-activation.md | Không biến cờ thành identity, durable nonce thay cache local; ADR/runbook |
| pdf-production-audit-remediation.md | Describe traffic revision, claim exact 24h cùng mốc, stream fault; contract/runbook |
| pdf-vps-production-integration.md | IAM token + HMAC, read-only host config, bounded timer; ADR/runbook |
| pdf-cloud-private-stage.md | Immutable no-traffic khác promote; runbook |
| pdf-release-immutable-audit.md | Offline runtime smoke và staged audit là hai loại bằng chứng; runbook |
| pdf-print-restriction-honest-error.md | Missing Print khác explicit restriction; yêu cầu/quyền và ghi nhận lịch sử bên dưới |
| pdf-worker-viewer-print-fallback.md | Browser ngoài VPS, sandbox/egress/cost, deadline đồng bộ; tổng quan/contract/runbook |
| pdf-viewer-capture-readiness.md | Lazy bitmap, CI thiếu browser, permission negative không thành success; PoC/ghi chú bên dưới |
| pdf-tools-automatic-pipeline.md | Direct → Viewer chỉ lỗi phù hợp, encrypted không fallback, bỏ checkbox; đặc tả/contract |
| pdf-worker-viewer-diagnostic-reasons.md | Layout ambiguity, propagate reason, page label / và of; contract/ghi chú bên dưới |
| pdf-worker-file-too-large-diagnostics.md | Phân loại byte budget, overhead embed; contract/ghi chú bên dưới |
| pdf-output-20mib-shared-limits.md | Single shared cap và encoded PNG khác RAM; tổng quan/contracts |
| pdf-adaptive-compression.md | Native JPEG ladder, soft target, pdf-lib memory, benchmark; PoC/contracts |
| pdf-200-page-pipeline.md | Không dùng retry làm chunk loop, file writer/merge, số đo; contract v2/PoC |
| pdf-v2-actions-activation.md | Dispatch correlation, pin và rollback khi active/unknown; runbook |
| pdf-v2-preinstalled-systemd.md | Root provision, deploy chỉ enable/start, symlink/ACL; runbook |
| pdf-v2-readiness-diagnostics.md | Safe reason theo read, không đoán IAM, legacy khác v2; runbook |
| pdf-v2-admission-limits.md | Quota owner/IP/execution riêng, override thấp hơn, retention risk; đặc tả/runbook |

Các tài liệu ngoài PDF có nhắc PDF nhưng không trùng (nguồn sách, nội dung public,
report bảo mật nhiều feature, wireframe) giữ nguyên; không mở scope dọn chúng.
Tổng Markdown tracked trước: **124**, sau: **93** (xóa 32, thêm 1).
Nhóm tài liệu PDF chuyên biệt từ **40 xuống 9**, gồm 8 tài liệu chuẩn và report này;
status/chỉ mục/chuyên mục deployment dùng chung không tính là file PDF riêng.

## Kiến thức lịch sử khó không được làm mất

- API public từng link visibility sau commit/enqueue: lỗi link có thể để intent
  không public. Hiện link cùng transaction; admin list/count phải loại public,
  public không đọc UUID private. Binary public 401 không xóa session admin.
- Caddy phải ghi đè XFF bằng client socket, Nginx giữ nguyên; Express trust đúng
  một hop. Append Caddy từng khiến tất cả người dùng dùng chung quota IP. Proxy
  regression hai hop/spoofed XFF bảo vệ, live ingress vẫn cần verify.
- Claim từng lấy hai lần đồng hồ gây TTL lệch 1 ms, API reject immutable result.
  Lấy một mốc; claim sai lịch sử không sửa tại chỗ. Parser launcher ENOENT/EACCES/
  exit 1/126/127 là infrastructure retryable, không INVALID_PDF. FAILED persistence
  phải await trước async cleanup để không mất rejection/retry.
- Capture chờ DOM/bitmap 750 ms, decode và kiểm binding page trước canvas; label
  nhận `/` và `of`, zoom combobox/select. Layout ambiguity không suy thành owner
  restriction. Nhiều heading/image/toolbar visible có reason riêng; không tự bỏ
  guard để nhận markup chưa rõ. Không dedup theo pixel hash vì hai trang giống
  nhau có thể hợp lệ. Bitmap thay sau quiet window vẫn là giới hạn chưa chứng minh.
- FILE_TOO_LARGE phải tách nguồn/PNG/JPEG/final; v1 embed ceiling chừa
  `64 KiB + 8 KiB × pages`, không nhầm cap JPEG bằng final PDF. V2 parts chừa
  2 MiB. Số byte PNG không phải decoded pixels/RSS. Adapter log chỉ allowlist.
- Lịch sử có lần nguồn Print-disabled được quan sát và dừng, có hành động capture
  bị auto-review từ chối và không thực hiện. Đây là bằng chứng **không đạt yêu
  cầu nguồn đó**, không chuyển thành positive E2E. Sửa source sau này dùng view-only
  không thay quyền hay chứng minh E2E. Không tái thực hiện capture nguồn bị khóa.
- Helper “health-only” và build-context cũ là giới hạn source thật đang còn;
  mock test không phát hiện COPY thiếu shared. Tài liệu không sửa script để che lỗi.

## Phát hiện cần xử lý riêng

1. **Quyền nguồn:** renderer active bỏ kiểm Print/canDownload, env false không
   disable. Review và sửa gate quyền qua PR code/bảo mật, không tuyên bố restricted
   capture là chức năng hợp lệ. Chưa có E2E quyền/giấy in/non-owner 200 trang.
2. **Release helper:** build context stage/one-shot không khớp Dockerfile root;
   helper deploy-health-only thực deploy processing và có thể chuyển traffic.
   Cần PR automation riêng, giữ gate v2 không nới resource/permission để PASS.
3. **Readiness pin/digest:** source vẫn ghim Worker 00017-guf/Gateway 00013-gej;
   operator báo Worker 00020-fiv no-traffic không chứng minh cần promote. Index
   digest khác platform manifest là khả năng kỹ thuật, chưa xác định nguyên nhân
   cụ thể release này. Cần registry/revision lineage trước PR pin.
4. **Vận hành:** chưa đo host API+CLI/MySQL, quota/backlog, storage/soft delete,
   IAM kế thừa, secret rotation, actual cost. Không tự tăng Worker/VPS/queue.
5. **Drain:** một cờ PDF_API_ENABLED ảnh hưởng admission/recovery/download cùng
   lúc. Không mô tả tắt cờ là drain an toàn; cần phương án incident riêng nếu
   muốn ngừng tạo nhưng giữ job/output còn hiệu lực. V2 diagnostic stage chưa
   ngang v1; thiếu log không chứng minh không có lỗi.

## Kiểm chứng

Đối chiếu source client/API/settings/repository/migrations, shared guards/limits,
Worker direct/capture/chunk/storage/parser/writer, Gateway/HMAC, Dockerfile,
CI/deploy/readiness/recovery helper và test liên quan. Không sửa runtime.

Readiness live chỉ đọc đã thử:
`node scripts/pdf-v2-readiness.mjs 35ff0f8b5a28f91aa7720dbcead85d3f4fe7ef32`
→ **FAIL kiểm tra live** tại WORKER_SERVICE, PERMISSION_DENIED exit=1; các bước
sau chưa chạy. Không tự thêm quyền, không suy IAM cụ thể bị thiếu.
Trạng thái production do đó **CHƯA XÁC MINH**, không được ghi PASS.

Kiểm tra đã thực hiện:

| Kiểm tra | Kết quả |
| --- | --- |
| npm.cmd run check:docs | PASS, 93 Markdown, không link file hỏng |
| npm.cmd run check:repo | PASS, 133 route Express khớp OpenAPI |
| node --test scripts/pdf-v2-readiness.test.mjs scripts/pdf-cloud-stage.test.mjs scripts/pdf-cloud-stage-public-hmac.test.mjs scripts/dispatch-pdf-v2-readiness.test.cjs | PASS 71/71, không skip; cloud/container đều mock |
| Kiểm thêm toàn bộ Markdown path/anchor và tham chiếu full path đã xóa | PASS, không thiếu anchor/path, không còn tham chiếu ngoài bảng inventory |
| PowerShell Parser trên 9 code block runbook | PASS, không lỗi cú pháp; không thực thi cloud mutation |
| So OpenAPI trước/sau khi loại summary/description | PASS, schema máy đọc không đổi |
| Quét credential pattern trên diff và rà thủ công mẫu JSON/lệnh | Không phát hiện secret; chỉ placeholder/fixture và resource identifier |
| git diff --check | PASS |

Launcher npm.ps1 ban đầu bị ExecutionPolicy chặn; dùng npm.cmd thành công,
không thay policy hệ thống. Lỗi đó không phải lỗi repository. Kiểm tra cú pháp
không xác minh quyền cloud hoặc tính sẵn sàng runtime của lệnh triển khai.
Không chạy E2E/Docker/MySQL/full regression, không cloud mutation; diff không đổi
logic và yêu cầu task không nâng production. Số đo lịch sử không chạy lại.

## Tài liệu cập nhật và rollback

Bộ tài liệu/đích hợp nhất được liệt kê ở trên; toàn bộ diễn giải mới bằng tiếng
Việt, thuật ngữ/identifier giữ nguyên. Liên kết và comment nguồn liên quan cập
nhật sang đích chuẩn. Artifact kiểm toán tạm nằm `.artifacts/pdf-doc-audit/`,
không commit screenshot/log/PDF, không baseline/wireframe mới.

Rollback task bằng revert commit tài liệu trên feature branch qua commit mới;
không có schema/data/hạ tầng cần đảo. Không dùng rollback tài liệu để chạy script
cũ trên production; rollback runtime phải theo runbook giữ tương thích job v2.

## Rủi ro còn lại

Quyền đọc Cloud Run bị từ chối, nên live revision/traffic/VPS/schema/timer/cost
chưa xác minh. Chất lượng in và nguồn Google thật còn gate nghiệm thu. Tài liệu
chính xác theo source nền đã ghi, nhưng không thay được PR sửa code/release helper,
review bảo mật và quyền operator. Không push, merge, deploy hoặc thay IAM/secret.
