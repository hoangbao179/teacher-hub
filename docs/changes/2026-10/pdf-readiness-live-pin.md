# Đồng bộ readiness pin và recovery smoke fixture

## Task level

Initial/final: **Level 3** — sửa pin trong deployment gate. Không đổi logic kiểm
tra, workflow, identity, IAM, tài nguyên, queue hay Cloud Run traffic.

## Problem và root cause

PR #51 đã merge thành `d1a961270f8a0e685c26c8b693c960667b4bb7d1`.
Quality/integration/smoke E2E của cả PR và main PASS. Pipeline main
[40697504237](https://github.com/hoangbao179/teacher-hub/actions/runs/40697504237)
dừng trước bước copy/deploy VPS vì readiness
[40698457875](https://github.com/hoangbao179/teacher-hub/actions/runs/40698457875)
báo `PDF_V2_WORKER_VALIDATION_FAILED: PDF_V2_TRAFFIC_MISMATCH`.

Source còn ghim `teacher-pdf-worker-00017-guf`, trong khi inventory chỉ đọc cho
thấy `teacher-pdf-worker-00020-fiv` đang nhận 100% traffic. Revision 00017 vẫn có
tag nhưng không nhận traffic phần trăm. Gateway 00013-gej khớp pin hiện có.
Gate chặn đúng điều kiện, không phải lỗi test hoặc quyền WIF.

Khi kiểm tra PR sửa pin, [smoke 40700037443](https://github.com/hoangbao179/teacher-hub/actions/runs/40700037443)
lộ race độc lập trong PDF fixture: assertion recovery nhận QUEUED/cloudErrorCode
null. Đóng tab không đồng nghĩa controller detail/poll đã hoàn tất phía server.
Một poll đã đọc result=null có thể còn giữ lease hoặc ghi lại next_action_at sau
khi fixture đặt job đến hạn; sweep một lần không còn job eligible để nhận result.
Đây là race điều phối fixture; không đổi production state machine/lease/recovery.

## Decision và changes

Cập nhật đúng một Worker revision/digest trong `RELEASE`, giữ strict checks và
Gateway pin. Không lấy latest tự động, không bỏ gate hoặc dùng index digest thay
platform digest. Thêm regression pin và reject traffic cũ/index digest.

`client/scripts/public-pdf.e2e.mjs` theo dõi promise controller create/detail/retry
trong fixture, chờ các HTTP handler trước lúc đặt result/due cho sweep độc lập.
Test cố ý giữ một poll tại FakeCloud.task sau khi đọc result thiếu, đóng tab,
thả poll và drain handler, rồi mới seed result/chạy recovery thật. Không dùng
sleep để đoán trạng thái, không bỏ assertion hoặc tăng timeout của production.
Barrier có timeout và được release trong finally để tránh treo test khi lỗi.

Mapping đã đọc từ Cloud Run/Artifact Registry/OCI index:

| Thành phần | Giá trị |
| --- | --- |
| Worker 100% traffic | `teacher-pdf-worker-00020-fiv` |
| spec image và status imageDigest | `sha256:7b0e5d6bcd5ce4aa449939ddf3e31d8f93fd4b6e88c20922850810c06009f5cb` |
| Registry source tag | `35ff0f8b5a28f91aa7720dbcead85d3f4fe7ef32` |
| OCI index của tag | `sha256:75357d6f5062ccb3a120e21271a0a9367616dbd2365d4d2df256ce6e7e520b9b` |
| Index linux/amd64 descriptor | Đúng platform digest Worker ở trên |
| Gateway 100% traffic | `teacher-pdf-gateway-00013-gej`, pin không đổi |

Tag/index/manifest lineage không chứng nhận build provenance. Image Worker này
chưa gồm filename metadata của PR #51; API mới vẫn tương thích result không tên.
Việc rollout Worker có metadata là thao tác riêng theo runbook sau API.

## Verification

- PASS: `node --test scripts/pdf-v2-readiness.test.mjs scripts/dispatch-pdf-v2-readiness.test.cjs`
  — 58 test, không SKIP; vẫn reject split traffic/digest drift/IAM/resources/queue.
- PASS: `node --check scripts/pdf-v2-readiness.mjs`.
- PASS: `node --test scripts/pdf-vps-config.test.mjs scripts/validate-pdf-environment.test.cjs`
  — 8 test cấu hình VPS và bảo vệ WIF; `check:repo`, `check:docs`, `git diff --check`.
- PASS live read-only: `node scripts/pdf-v2-readiness.mjs d1a961270f8a0e685c26c8b693c960667b4bb7d1`,
  checkedAt `2026-10-28T13:47:47.713Z`. Đủ bảy reads, kiểm cả Worker/Gateway
  revision/digest/IAM, resources/gates/scratch/scaling và queue.
- Không ghi token/env/policy đầy đủ/log tạm vào repository. Không dispatch lại
  deployment đã lỗi vì rerun đó có thể triển khai production.
- PASS targeted browser MySQL/FakeCloud E2E với poll đang giữ lease lúc đóng tab;
  lint client và guards. Không chạy full regression local vì không đổi business
  logic; PR CI chạy quality/integration/smoke đầy đủ.

## Documentation updated

`docs/implementation/status.md` cập nhật inventory và giới hạn Worker/API rollout;
`docs/operations/cloud-run-pdf-worker.md` ghi mapping index/platform digest.

## Rollback

Revert commit pin chỉ đổi kỳ vọng gate, không đổi live deployment. Pin cũ sẽ tiếp
tục chặn khi Worker 00020-fiv nhận traffic. Nếu operator quyết định rollback Cloud
Run, phải review tương thích job/checkpoint và cập nhật pin theo inventory đã xác
minh; không tự đổi traffic để làm gate xanh.

## Remaining risks

Inventory có thể thay đổi sau thời điểm kiểm tra. Chỉ công nhận CI WIF readiness
khi workflow thật chạy lại trên source có pin mới; local PASS không thay quyền
verifier hoặc deploy VPS. Chưa xác minh flags/schema/timer VPS, actual print,
authorized non-owner Viewer hay build provenance. Không tự deploy, merge, chuyển
traffic, tăng resource hoặc quota.
