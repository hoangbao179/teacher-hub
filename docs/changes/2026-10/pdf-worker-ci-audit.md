# Audit CI/CD PDF Worker

## Task level

Initial **Level 3**, final **Level 3**: deployment, WIF/environment protection và
điều phối release. Audit source `main` đã fetch tại
`7e4dbfecfe2d889f02ede8f517757a51b2aef391` (PR #56), không dựa vào mô tả PR.
Không đọc secret, không đổi IAM/flag/traffic, không deploy hoặc chạy full CI/E2E.

## Problem và kết luận

**NOT READY cho tự động promote production.** Source gốc chưa đủ an toàn để bật
auto-release: có lỗi CLI chắc chắn, thiếu đầu vào build, bỏ sót thay đổi sau run
thất bại/cancel và promote dựa trên health. Bản sửa giới hạn automation ở
build/push/stage 0%; operator vẫn phải nghiệm thu và duyệt chuyển traffic.

- Frontend/CSS/logo/API source riêng không build Worker; CI Worker tests vẫn chạy.
- `workers/pdf/` và toàn bộ `shared/` kích build. Root lock/build config bị bỏ sót
  ở source gốc; đã bổ sung. Root lock đổi chỉ vì client có thể build bảo thủ.
- Merge/squash/multiple commits giữa hai SHA hoạt động; `before` zero/invalid và
  lỗi diff gốc đều build bảo thủ. Vấn đề là chỉ so last push, không so delivery.
- Exact SHA/root Docker context đúng. Image deploy bằng digest, không `latest`.
  Bản sửa buộc digest registry bằng digest Buildx thực sự vừa push.
- API migration/API/Web trước Worker đúng qua `needs`; frontend không được tách
  sau Worker. Với filename hiện tại API mới đọc được result cũ, UI có fallback,
  nên không thấy yêu cầu phải đổi thứ tự Web cho riêng thay đổi này.
- WIF/IAM/resource/traffic thực tế **chưa xác minh**; không suy production từ code.

## Findings: root cause, tác động và resolution

Các số dòng dưới đây chỉ source audit **trước sửa**, luôn ghim SHA để tránh nhầm.

### F1 — High, xác nhận: health-only promote và rollback reader không tương thích

**Code:** [release:100](https://github.com/hoangbao179/teacher-hub/blob/7e4dbfecfe2d889f02ede8f517757a51b2aef391/.github/workflows/pdf-worker-release.yml#L100),
[release:111](https://github.com/hoangbao179/teacher-hub/blob/7e4dbfecfe2d889f02ede8f517757a51b2aef391/.github/workflows/pdf-worker-release.yml#L111),
[server health:13](../../../workers/pdf/src/server.mjs#L13),
[reader cũ](https://github.com/hoangbao179/teacher-hub/blob/35ff0f8/shared/src/pdf-pipeline.ts#L27).

**Bằng chứng/tái hiện:** `/health` trả hằng `{status:'ok'}`, không gọi Drive, qpdf,
browser, GCS, checkpoint hay download. Dù xử lý `/jobs` hỏng, health vẫn PASS và
source gốc chuyển 100%. Reader tại lineage source `35ff0f8` dùng exact manifest
keys không có filename; thêm filename khiến reader đó từ chối. Đây là bằng chứng
tương thích source, không chứng minh image production đang chạy source đó.

**Tác động:** promote lỗi chức năng; sau ghi manifest mới, rollback mù về revision
cũ có thể làm recovery fail. Queue dispatch concurrency 1 không kiểm tra drain
revision cũ. Canary smoke không gửi `/jobs`, nên chưa kiểm đường IAM của Cloud
Tasks, GCS/result, metadata filename hoặc chất lượng PDF.

**Sửa:** bỏ mọi mutation traffic khỏi workflow. Giữ staging/health/config checks,
summary nêu staging-only; operator phải kiểm đúng tagged revision, non-owner
Viewer được phép tải/in, PDF/output/filename/recovery, drain và rollback reader.
Không tự sửa renderer hoặc quyền nguồn trong audit này.

### F2 — High, xác nhận: delivery thất bại/cancel có thể mất Worker update

**Code:** [ci:12](https://github.com/hoangbao179/teacher-hub/blob/7e4dbfecfe2d889f02ede8f517757a51b2aef391/.github/workflows/ci.yml#L12),
[ci:215](https://github.com/hoangbao179/teacher-hub/blob/7e4dbfecfe2d889f02ede8f517757a51b2aef391/.github/workflows/ci.yml#L215).

**Tái hiện:** push A đổi Worker, CI/deploy A fail hoặc bị push B hủy; B chỉ sửa
CSS. B so A..B không có Worker, skip release dù Worker A chưa giao. Hai run gần
nhau còn có thể cancel lúc traffic đang đổi; `ERR` trap không bảo vệ SIGKILL.
Pending CI cũng có thể bị thay bằng run mới dù cancel-in-progress=false.

**Sửa:** main không cancel run đang chạy; so với CI main delivery success trước
run hiện tại, loại PR/fork/current/future rerun. Bắt tích lũy thay đổi qua failed
hoặc superseded run; API/history không đọc được thì build bảo thủ. Bootstrap
manual CI main `force_worker_release=true` chạy đủ gates/API, không commit giả.
Vẫn không cam kết FIFO cho Actions; operator không rerun commit cũ để rollback.

### F3 — High, xác nhận theo CLI contract: digest lookup dùng cờ không hợp lệ

**Code:** [release:75](https://github.com/hoangbao179/teacher-hub/blob/7e4dbfecfe2d889f02ede8f517757a51b2aef391/.github/workflows/pdf-worker-release.yml#L75).

**Bằng chứng/tái hiện:** `gcloud artifacts docker images describe ... --location`
không có flag này trong [command reference](https://docs.cloud.google.com/sdk/gcloud/reference/artifacts/docker/images/describe).
Location nằm trong image URL; không nhầm với `artifacts repositories describe`
vốn có `--location`. Chạy lệnh gốc sẽ bị parser từ chối theo CLI contract, làm
release dừng sau push. Không chạy gcloud thật trong audit.

**Sửa:** bỏ flag; regression kiểm command và mô phỏng digest lookup failure.

### F4 — Medium, xác nhận: bỏ sót đầu vào build và helper security gián tiếp

**Code:** [ci:221](https://github.com/hoangbao179/teacher-hub/blob/7e4dbfecfe2d889f02ede8f517757a51b2aef391/.github/workflows/ci.yml#L221),
[Dockerfile](../../../workers/pdf/Dockerfile),
[shared package](../../../shared/package.json).

**Tái hiện:** chỉ đổi root package-lock, root build:shared script, `.dockerignore`
hoặc helper policy `pdf-cloud-stage-public-hmac.mjs`: filter gốc false. Trong khi
release npm ci/build shared ở root, Docker copy shared dist và release import
policy qua readiness. Thay build/deploy behavior mà Worker không được stage lại.

**Sửa:** explicit pathspec cho root package/lock/.npmrc/.dockerignore, CI/release
và helper trực tiếp/gián tiếp. Test Git repo tổng hợp từng path, code apps-only,
multi-commit và missing history. Giữ toàn bộ shared vì image chứa toàn bộ dist;
chưa có bằng chứng dependency graph cho phép thu hẹp mà không bỏ sót.

### F5 — Medium, xác nhận: chưa ràng buộc digest registry với kết quả build

**Code:** [release:69](https://github.com/hoangbao179/teacher-hub/blob/7e4dbfecfe2d889f02ede8f517757a51b2aef391/.github/workflows/pdf-worker-release.yml#L69),
[release:75](https://github.com/hoangbao179/teacher-hub/blob/7e4dbfecfe2d889f02ede8f517757a51b2aef391/.github/workflows/pdf-worker-release.yml#L75).

**Tái hiện:** sau build, một writer khác ghi lại tag SHA trước describe. Source
gốc nhận bất kỳ digest đúng regex của tag; checkStaged chỉ so digest đó, không
chứng minh nó từ build hiện tại. Exploit cần writer khác; chưa chứng minh xảy ra.

**Sửa:** Buildx metadata-file, so containerimage.digest với registry, deploy bằng
digest. Mismatch dừng trước deploy. Provenance/SBOM đang tắt để single manifest;
không dùng tag SHA làm bằng chứng source hay lý do skip rebuild.

### F6 — High risk chưa xác minh Cloud: deploy Environment/WIF chỉ có tên

**Code:** [release:21](https://github.com/hoangbao179/teacher-hub/blob/7e4dbfecfe2d889f02ede8f517757a51b2aef391/.github/workflows/pdf-worker-release.yml#L21),
[release:53](https://github.com/hoangbao179/teacher-hub/blob/7e4dbfecfe2d889f02ede8f517757a51b2aef391/.github/workflows/pdf-worker-release.yml#L53).

**Bằng chứng/tái hiện:** source gốc kiểm main/repo/SA/provider syntax nhưng không
đọc protection metadata Environment deploy. Xóa main-only policy ngoài Git không
bị source phát hiện trước auth. Verifier đã có validation riêng; không được suy
validation đó bảo vệ Environment deploy khác. Không kết luận PR giả mạo được WIF:
còn phụ thuộc provider condition và IAM thật chưa có evidence.

**Sửa:** tái dùng protection validator cho đúng Environment deploy, main-only
branch type, no admin bypass, API errors fail-closed trước auth; verifier giữ
workflow_dispatch-only. Token health chuyển sang auth action ID-token output,
audience service base, masked output; phải kiểm quyền mint token/run.invoker thật.
Operator vẫn phải review numeric repo/owner IDs, reusable workflow/environment,
role scope/inherited policy/SA delegation. Local không chứng minh least privilege.

### F7 — Medium, xác nhận: rollback không xác minh phục hồi; cancel không được bảo vệ

**Code:** [release:119](https://github.com/hoangbao179/teacher-hub/blob/7e4dbfecfe2d889f02ede8f517757a51b2aef391/.github/workflows/pdf-worker-release.yml#L119).

**Tái hiện:** post-promote fail → rollback chỉ gọi update-traffic, không đọc routing
hay old digest/health. Rollback lệnh fail chỉ echo marker. ERR trap không xử lý
runner mất điện/SIGKILL; có thể để candidate nhận traffic sau run canceled. Source
gốc có verifyPromoted trước success (điểm tốt), nhưng không có bảo đảm rollback.

**Sửa:** không auto-mutate traffic; trạng thái promote/rollback failure không còn
reachable trong workflow staging. Runbook yêu cầu inspect live routing sau mọi
mutation/cancel và chỉ rollback reader tương thích. Không tuyên bố đã test Cloud
rollback thật hay xây controller phục hồi ngoài runner.

### F8 — Medium, xác nhận: credential WIF tạm không bị loại khỏi build context

**Code:** [auth trước build](https://github.com/hoangbao179/teacher-hub/blob/7e4dbfecfe2d889f02ede8f517757a51b2aef391/.github/workflows/pdf-worker-release.yml#L53),
[dockerignore gốc](https://github.com/hoangbao179/teacher-hub/blob/7e4dbfecfe2d889f02ede8f517757a51b2aef391/.dockerignore#L1).

Auth action mặc định tạo `gha-creds-*.json` trong workspace. Root context không
loại file này; `.gitignore` cũng thiếu. Theo [hướng dẫn auth action](https://github.com/google-github-actions/auth#prerequisites),
cần loại khỏi cả hai. Dockerfile hiện COPY chọn lọc nên **chưa có bằng chứng
credential nằm trong image**; đây là thiếu bảo vệ context và accidental commit.
Thêm ignore và regression guard. Không tạo/đọc credential thật trong audit.

## Decision và Changes

Giữ thay đổi ở CI/release/helper/tests/docs; không đổi PDF compression/resolution,
DTO, migration, API/Web behavior hay Gateway. Chọn staging-only vì thêm boolean
cho phép promote vẫn không cung cấp PDF evidence/drain/compatible rollback.
Chưa tự thêm hệ thống approval/functional canary mới hoặc quyền production.

Files sửa: `.gitignore`, `.dockerignore`, `.github/workflows/ci.yml`, `pdf-worker-release.yml`,
`scripts/validate-pdf-environment.cjs` và test, `pdf-worker-auto-release.test.mjs`;
thêm `pdf-worker-changes.cjs`, `pdf-worker-changes.test.cjs`,
`pdf-worker-workflow.test.mjs`; runbook/status và report này.

## Verification

- Node targeted release/readiness/environment/dispatch/change/workflow tests;
  **88 tests PASS** qua các targeted runs trên source liên quan cuối cùng.
  Git diff thật trên repo synthetic và Bash workflow shell với mock commands.
- Mô phỏng build/push/registry/digest mismatch/deploy/health failure dừng an toàn;
  canary không Ready, IAM/resource/scratch/traffic drift bị gate từ chối.
- Actionlint cho CI/release/manual/deploy (YAML và Actions expressions), Bash
  syntax cho 17 run blocks: **PASS**. Repo/doc guards và Git whitespace: **PASS**.
- Không chạy full CI/E2E, Docker build, MySQL, browser, gcloud hay production
  smoke theo giới hạn phiên audit. Mock không chứng minh IAM/network/runtime.
- Artifact tạm chỉ `.artifacts/pdf-worker-ci-audit/`, không commit ảnh/log/tool.

## Documentation updated

Runbook cập nhật filter/bootstrap/staging gate/cost/rollout/rollback;
status chỉ mô tả behavior source hiện hành, không khẳng định rollout production.

## Rollback

PR chỉ sửa source, không cần down-migrate. Không revert source về workflow
auto-promote cũ rồi bật flag. Khi chưa stage/promote gì, giữ opt-in OFF như operator
đã cấu hình; audit không đổi flag. Sau rollout thật phải review pin và reader trước
tắt opt-in hoặc đổi traffic. Giữ schema/GCS/job history; không xóa/backfill ngược.

## Remaining risks và việc trước production

**Codex đã làm:** source audit, targeted regression, staging guard, filter,
bootstrap path, digest binding, Environment validation và runbook.

**Cần quyền Cloud/GitHub:** đọc/provision Environment và WIF/provider IAM/role
scope thực tế, queue/service resources, runtime secret references, registry policy,
billing/retention. Không có evidence trực tiếp trong phiên này.
Phải kiểm thời lượng cold build/push và credential refresh WIF thực tế; unit
không chứng minh token còn hiệu lực sau build Chromium lâu hoặc registry outage.

**Cần test thật:** non-owner anonymous Viewer hợp lệ (owned-only không đủ),
filename Worker→GCS→API→header UTF-8, missing-name fallback, v1/v2/recovery,
permission denied, 3/35/>50/200 trang, in giấy và CPU/RAM/time/storage Cloud Run.
Source active còn khoảng cách canDownload/Print theo product contract; audit CI
không hợp thức hóa hay sửa renderer để vượt hạn chế.

**Cần operator:** review/merge PR; chuẩn bị identity; chạy bootstrap khi được duyệt;
verify tagged candidate, drain, review rollback reader, promote thủ công và đọc
traffic thực tế; xử lý cancel/cleanup tag/images. Canary min=0 không chứng minh
zero cost; repeated builds và registry retention chưa tối ưu bằng số đo.

**Quyết định cuối: NOT READY cho automatic production promotion.** Staging-only
có thể review tiếp; kích hoạt chỉ sau IAM provisioning và kiểm thử thật, không
dùng targeted checks PASS để tuyên bố production-ready.
