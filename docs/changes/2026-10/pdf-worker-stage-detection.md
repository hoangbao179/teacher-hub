# CI/CD PDF Worker: tránh bỏ sót stage và build thừa

## Task level

Initial và final **Level 3**: sửa điều kiện deployment và bằng chứng staging.
Base `main` đã fetch: `97bc4cf4c9a3c3aad4fc280da88d59d15d4d9680` sau PR #57.
Giữ staging-only, không sửa renderer, business, IAM/WIF/secret/Environment hoặc
bật opt-in; không build/push/deploy thật trong phiên này.

## Problem và Root cause

1. `ci.yml` cho manual invocation chạy deploy-production dù force mặc định false.
   `deploy.yml` chỉ là reusable workflow, không có trigger manual riêng; caller
   CI là nơi cần chặn, không cần sửa pipeline build/push API/Web.
2. `pdf-worker-changes.cjs` dùng CI main success làm baseline. CI A có Worker
   update nhưng flag OFF vẫn xanh; bật flag rồi push CSS B khiến A..B rỗng và
   Worker A bị bỏ sót. Failure/cancel/skip không đồng nghĩa đã stage.
3. Pathspec gồm `ci.yml` và helper không tạo image, khiến chỉ sửa test/gate cũng
   build/push Chromium image. Docker thực sự copy Worker source/package/lock và
   shared package/dist; shared build phụ thuộc root package/lock/npm config.
4. Smoke PDF có cửa sổ race riêng trong fixture: drain Set handler không chặn
   poll đến muộn sau khi Set rỗng. Poll có thể lease/read result cũ rồi dời due
   time, khiến sweep một lần giữ QUEUED thay vì COMPLETED. Job smoke PR #58
   123259983320 lỗi tại assertion này; quality/integration/schedule đều success.
   Fixture nay đóng admission create/detail/retry trước khi đóng tab, thả poll
   đã giữ và drain, rồi seed result/due, chạy recovery và mới mở admission lại.
   Không đổi production lease/recovery, không sleep hoặc bỏ assertion. Unit test
   cố ý gửi request cả trong lúc drain và sau drain để bảo vệ cửa sổ này.

## Decision và Changes

- Chặn manual force=false ở caller; manual force=true cần chính repository,
  main và opt-in bật. Push main giữ deploy API/Web như trước. Các quality,
  integration, smoke, schedule và API delivery dependencies vẫn giữ nguyên.
- Giữ bootstrap qua VPS: readiness hiện chỉ kiểm Cloud, không chứng minh schema
  và API production tương thích. Tách thêm một cơ chế xác minh VPS chưa đơn giản
  hơn hoặc có bằng chứng an toàn hơn luồng hiện hành.
- Dùng GitHub job/step metadata sẵn có, không thêm artifact/state service. Chỉ
  chấp nhận đúng job release, source SHA khớp, completed/success và đủ bước digest,
  canary, health, kiểm lại traffic, summary. CI success đơn lẻ không đủ. Rerun
  cùng source có thể dùng stage success attempt trước; force luôn build lại.
  [GitHub Jobs API](https://docs.github.com/en/rest/actions/workflow-jobs#list-jobs-for-a-workflow-run)
  cung cấp source SHA và kết quả job/step để kiểm tra, không cần đoán từ tag.
- Phân trang lịch sử main run, dừng khi tìm được stage proof. Bỏ PR/fork/branch
  khác/workflow khác/current hoặc future run không hợp lệ. CI fail sau một stage
  thực sự thành công không xóa bằng chứng stage đó. API/history lỗi thì build
  bảo thủ; không tin Docker tag hoặc SHA đơn lẻ.
- Bỏ `ci.yml` và các helper không tạo image khỏi pathspec. Giữ toàn bộ
  `workers/pdf/`, `shared/`, root package/lock/.npmrc/.dockerignore và release
  workflow vì nó điều khiển build/runtime/config stage. Chưa thu hẹp shared/root
  lock do shared dist/compiler là input thật; root lock đổi bởi client vẫn có thể
  build bảo thủ. Không thêm dependency graph engine hoặc cache.

`CI_SUCCESS` ≠ `WORKER_STAGE_SUCCESS` ≠ `PRODUCTION_PROMOTED`. Stage proof là lịch
sử, không chứng minh canary tag còn tồn tại hoặc production đã đổi. Không đổi
immutable digest/source SHA/readiness/security gates hoặc production traffic.

## Khi nào build/push

| Tình huống | Worker Docker build/push |
| --- | --- |
| CSS/logo/frontend/API-only; inputs khớp stage đã xác minh | Skip |
| Chỉ sửa CI tests/helper không tạo image; inputs không đổi | Skip |
| Worker/shared/dependency/build config/release workflow đổi | Có, sau CI + API + preflight, nếu opt-in bật |
| CI A xanh nhưng stage skip vì flag OFF; B chỉ CSS sau bật flag | So với stage thật cũ; build nếu còn thay đổi hoặc chưa có evidence |
| Stage failed/cancelled/skipped | Không ghi nhận stage; push sau không làm mất thay đổi tồn đọng |
| Không stage history, API lỗi, Git object/diff lỗi | Build bảo thủ, ghi lý do trong log |
| Rerun cùng source đã có stage proof, inputs không đổi | Skip; explicit force vẫn build |
| Manual force=false | CI only; không publish/deploy API/Web hoặc Worker |
| Manual force=true, trusted main, opt-in=true | Đủ CI/API delivery, sau đó force build/stage |
| PR/fork/branch khác, hoặc opt-in OFF | Không release Worker |

Buildx dùng `--push`: push diễn ra trong build command nếu build tiến tới export;
failure có thể để image/layer đã push mà chưa stage. Chưa skip/reuse image từ một
lần push không có stage success. Không tuyên bố tiết kiệm bytes/layers cụ thể.
Loại test-only trigger và dùng stage proof giúp bỏ cả build lẫn push của source
đã xử lý; force, mất history hoặc stage failure vẫn có thể build cùng SHA lại.

## Verification

**Targeted checks PASS:**

- `node --test scripts/pdf-worker-changes.test.cjs`: 15 tests PASS.
- `node --test scripts/pdf-worker-workflow.test.mjs`: 8 tests PASS, gồm matrix
  manual/push/PR/ref/repository/flag và mock shell build/push/deploy/health failure.
- `node --test client/scripts/pdf-polling.unit.mjs`: 2 tests PASS, gồm handoff
  barrier; syntax checks cho E2E/helper và client typecheck/lint PASS.
  Smoke thực tế cần CI MySQL/Chrome xác nhận.
- Actionlint CI/release/deploy/manual workflows: PASS; Bash `-n` cho 17 multiline
  workflow run blocks: PASS. `node --check scripts/pdf-worker-changes.cjs`: PASS.
- `node scripts/check-doc-links.mjs`, `node scripts/check-repo.mjs` và Git diff
  whitespace checks: PASS. Không commit artifact kiểm thử; dùng lại actionlint
  đã có trong `.artifacts/pdf-worker-ci-audit/`, test fixtures temp tự dọn.

Regression có CSS-only, API-only,
Worker/shared/lock/build inputs, manual true/false, CI xanh stage skip, stage
fail/cancel, no history/API/Git errors, pagination, multiple commits/squash và
CI-only changes.

Không chạy full CI/E2E, MySQL/browser, Docker build/push hoặc Cloud Run thật theo
giới hạn task. Mock metadata và shell không chứng minh quyền Cloud/runtime thật.

## Documentation updated

Runbook giải thích stage evidence, build/skip, manual/bootstrap/retry, chi phí và
operator gates; status mô tả behavior hiện hành, không ghi lịch sử task.

## Rollback

Chỉ source CI/helper/docs, không migration hay data mutation. Revert commit qua
review nếu cần; revert sẽ khôi phục lỗi manual gate/baseline cũ nên không dùng làm
lý do bật automation. Giữ opt-in và traffic do operator quản lý; không thay flag
hoặc quay Worker về reader cũ. Muốn dựng lại canary đã bị xóa/đổi, force trên main
sau gates; không dùng rerun commit cũ để quản lý rollout/rollback production.

## Remaining risks và operator

- GitHub metadata/history bị xóa, API lỗi/rate limit hoặc đổi tên job/step chứng
  minh stage sẽ gây build bảo thủ; tests giữ đồng bộ tên gate hiện tại. History
  không xác minh Cloud drift hiện tại. Operator kiểm baseline run ID/SHA và job
  steps trong log; dùng force khi cần dựng lại canary.
- Chromium/Playwright/Linux runtime tests vẫn tải/cài deps mọi CI để giữ coverage.
  Không thêm BuildKit/browser cache khi chưa có số đo bytes/time và coverage gate
  tương đương. Không sửa Web/API Docker build/push.
- Trước staging: operator review CI PR và main-only opt-in/WIF/Environment/IAM
  provisioning có sẵn, rồi bootstrap khi được duyệt. Phiên này không đọc/sửa các
  cấu hình production đó.
- Trước promote: nghiệm thu non-owner anonymous Viewer có quyền, filename,
  output/download/recovery, drain và rollback reader tương thích. Health hoặc
  staging success không thay nghiệm thu, không tự chuyển 100% traffic.
