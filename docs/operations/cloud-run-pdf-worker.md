# Triển khai và vận hành hệ thống PDF

## Cách sử dụng và ranh giới bằng chứng

Đây là runbook chuẩn cho Worker, Gateway, VPS và recovery; thay các runbook PDF
rời trước đây. Đọc [tổng quan](../features/pdf-worker.md),
[đặc tả API/job](../features/pdf-job-api.md), [v1](../api/pdf-worker-v1.md),
[v2](../api/pdf-worker-v2.md) và [quyền nguồn](../product-spec/pdf-viewer-links.md).
Trạng thái hiện hành chỉ tại [status](../implementation/status.md).

**Mọi khối có nhãn TÁC ĐỘNG đều là hướng dẫn cho đợt đã được duyệt riêng, không
phải lệnh cần chạy khi đọc/kiểm toán tài liệu.** Không tự deploy, promote, sửa
IAM/secret/queue/tài nguyên hay xóa dữ liệu. Thiếu quyền đọc nghĩa là CHƯA XÁC MINH,
không chứng minh tài nguyên không tồn tại. Không đặt review flag khi chưa review.

Phân biệt: code xác nhận thiết kế; test fixture xác nhận tình huống giả lập;
operator báo cáo là quan sát được cung cấp; production đã xác minh cần thời điểm,
revision/digest/traffic và kết quả thực. Health/capabilities không chứng minh PDF
đủ trang hoặc nét in. Một file owned/direct không thay Viewer khác Owner.

## Đích cố định và kiểm tra chỉ đọc

Project `teacher-hub-pdf`, region `asia-southeast1`, registry repository
`teacher-pdf`, queue `teacher-pdf-queue`, bucket `teacher-hub-pdf-results-2026`.
Worker/Gateway là `teacher-pdf-worker`/`teacher-pdf-gateway`, runtime SA cùng tên
`@teacher-hub-pdf.iam.gserviceaccount.com`; invoker là `teacher-pdf-invoker`.
Không lấy revision từ tên trong báo cáo cũ để suy traffic hiện tại.

PowerShell dùng `gcloud.cmd`/`npm.cmd` để tránh ExecutionPolicy của launcher .ps1;
không đổi policy hệ thống. Chỉ đọc trên máy operator đã có quyền:

```powershell
$project = 'teacher-hub-pdf'
$region = 'asia-southeast1'
foreach ($name in @('teacher-pdf-worker', 'teacher-pdf-gateway')) {
  gcloud.cmd run services describe $name --project=$project --region=$region --format='yaml(metadata.name,status.url,status.traffic,status.latestCreatedRevisionName,status.latestReadyRevisionName)'
  gcloud.cmd run services get-iam-policy $name --project=$project --region=$region --format='table(bindings.role,bindings.members)'
}
gcloud.cmd tasks queues describe teacher-pdf-queue --project=$project --location=$region --format='yaml(state,rateLimits,retryConfig,httpTarget)'
gcloud.cmd storage buckets describe gs://teacher-hub-pdf-results-2026 --format='yaml(lifecycle_config,soft_delete_policy,retention_policy,public_access_prevention,uniform_bucket_level_access)'
```

Chỉ xem IAM trên máy tin cậy, không dán policy đầy đủ vào issue. `status.traffic`
cho biết revision thực nhận request và URL tag. Latest created/ready có thể là
revision **0% traffic**. Đọc đúng mỗi revision nhận traffic và canary cần kiểm:

```powershell
$revision = '<REVISION_CAN_KIEM_TRA>'
gcloud.cmd run revisions describe $revision --project=$project --region=$region --format='yaml(metadata.name,spec.containers[0].image,status.imageDigest,status.conditions,spec.serviceAccountName,spec.timeoutSeconds,spec.containerConcurrency,spec.containers[0].resources,spec.volumes,spec.containers[0].volumeMounts)'
$sha = (git rev-parse HEAD).Trim()
node scripts/pdf-v2-readiness.mjs $sha
Invoke-RestMethod 'https://tienganhcovy.com/api/public/pdf/capabilities'
```

Không dump env/secret. Muốn xem cờ runtime chỉ lọc tên đã biết trong process tin
cậy hoặc dùng readiness; không in approval JSON, `docker inspect` env, subject
JWT, `docker compose config` đầy đủ hay gcloud secret access. Readiness dùng bảy
cloud reads, không sửa gì; cần quyền services.get/getIamPolicy, revisions.get,
queues.get. Thất bại in reason an toàn, stdout không có PASS JSON.

V2 mong muốn: capabilities 1 link, 3 active, 20 hourly, maxPages 200,
maxSourceBytes 20971520, maxBytes 157286400 và submit/downloadEnabled true.
Override quota thấp hơn là hợp lệ; đừng tự đổi runtime.env để khớp quảng bá.


## Tự động build và stage Worker sau CI (opt-in)

Workflow `.github/workflows/pdf-worker-release.yml` được gọi từ `ci.yml` **sau**
`deploy-production` thành công, khi delivery `main` thay đổi đầu vào Worker.
Workflow chỉ **build/push và stage canary 0%**, không tự promote/rollback traffic.
Repository variable
`PDF_WORKER_AUTO_DEPLOY_ENABLED=true` là công tắc **opt-in**; thiếu hoặc khác
`true` thì toàn bộ Cloud release job bị bỏ qua và readiness giữ pin Worker cũ.

Luồng phát hành: CI chất lượng/integration/browser → migration và API/Web trên VPS
→ preflight Cloud read-only → build Docker `linux/amd64` từ đúng source SHA,
`--provenance=false --sbom=false` để tạo single-platform manifest → push Artifact
Registry → so digest Buildx với Artifact Registry → deploy Worker với
`--no-traffic --tag=pdf-ci` → kiểm IAM/volume/tài nguyên, đúng
digest và traffic cũ vẫn 100% → GET `/health` có xác thực tại canary → kiểm lại
traffic/cấu hình → summary ghi source SHA, digest, candidate và revision cũ.
Identity token được mint qua auth action, audience là service base URL, không phải
tagged URL. **Workflow success chỉ chứng minh staging**, không chứng minh PDF
hoạt động. API/Web hiện deploy cùng nhau trước Worker; không cam kết frontend
sau Worker. Gateway không được build/deploy hoặc sửa IAM.

### Bộ lọc, bootstrap và chi phí

CI vẫn chạy Worker unit/runtime tests cho push/PR kể cả CSS/API. Test không build
Docker. `CI_SUCCESS` **khác** `WORKER_STAGE_SUCCESS`; cả hai đều không chứng minh
`PRODUCTION_PROMOTED`. `scripts/pdf-worker-changes.cjs` dùng metadata GitHub Actions:
tìm main run gần nhất theo run number có đúng job release hoàn tất thành công,
head SHA khớp, và các bước digest, staged revision, authenticated canary health,
post-smoke traffic check, summary đều completed/success. CI xanh khi flag OFF,
job release skipped/failed/cancelled hoặc thiếu step evidence không làm mốc.
Không cần database, service mới hoặc tải log/artifact để lưu trạng thái stage.

API lịch sử được phân trang và dừng khi có bằng chứng. Nếu rerun cùng source,
job stage thành công từ attempt trước cũng được chấp nhận; force vẫn build lại.
Nếu run cũ stage đã thành công nhưng CI lỗi ở phần khác, stage evidence vẫn có
giá trị. Main workflow không cancel run đang chạy; PR vẫn cancel như trước.
Không có stage history, metadata/API không đọc được, thiếu Git object hoặc diff
lỗi thì build bảo thủ; không âm thầm kết luận đã stage. History chỉ chứng minh
stage từng thành công, không chứng minh tag canary còn tồn tại hay traffic live;
operator đã đổi/xóa canary thì dùng force để stage lại khi cần.

Đầu vào gồm toàn bộ `workers/pdf/`, `shared/`, root package/lock/npm config,
`.dockerignore` và workflow release (chứa build command/runtime/config staging).
Root lock có thể đổi vì client nhưng vẫn là đầu vào build shared: chấp nhận build
bảo thủ. Chưa lọc nhỏ `shared/` vì Docker copy toàn bộ dist và public exports liên
kết nhiều module. Khi đã có stage evidence và không còn Worker update tồn đọng,
merge frontend/CSS/logo/API source riêng không build/push Worker. Chỉ sửa test
trong `ci.yml`, helper change detection/readiness/policy không tạo image cũng
không tự build Chromium image; tests vẫn chạy. Muốn áp dụng lại cấu hình bằng
source không đổi thì dùng force. Toàn bộ `workers/pdf/` vẫn kích hoạt, kể cả test.

Manual Actions **ci**, `force_worker_release=false` (mặc định): chỉ kiểm thử,
không build/push/deploy API/Web hoặc Worker. Manual force=true chỉ mở bootstrap
trên đúng repository/main và khi repository opt-in=true; vẫn chờ quality,
integration, smoke, schedule gates, migration/API/Web thành công rồi mới stage.
Push main thông thường giữ nguyên deploy API/Web; Worker chỉ build/stage khi
opt-in bật và filter báo cần. PR/fork/branch/tag khác không mở đường deploy.

Sau provisioning/review, operator bật opt-in rồi chạy Actions **ci**, branch
**main**, `force_worker_release=true` để bootstrap hoặc retry có chủ đích, không
cần commit giả. Giữ API delivery trước Worker: Cloud readiness hiện không chứng
minh schema/API trên VPS tương thích, nên chưa tách bootstrap bỏ qua VPS.
Nếu Worker release thất bại, rerun failed jobs hoặc dispatch force=true; nếu chưa
có stage thành công, push sau vẫn so với mốc stage cũ (không so riêng last push).
Xem log `Detect PDF Worker changes`: baseline run ID/SHA, lý do build/skip; mở job
release trong baseline để kiểm các bước success. Job release skipped không phải
Worker đã cập nhật. Bootstrap không được thực hiện trong phiên sửa source này.

Mỗi qualifying delivery hoặc explicit force chạy một lệnh Buildx `--push` sau
preflight; lỗi build có thể chưa push, push lỗi có thể đã gửi một phần layers.
Không đổi image inputs so với stage đã xác minh thì skip cả Docker build/push.
Cùng source vẫn build lại khi force, mất evidence/history hoặc lần trước chưa
stage thành công, dù image có thể đã push. Không tái sử dụng tag SHA để suy image
đã stage; digest Buildx phải khớp registry. Base image/apt/browser chưa pin digest
nên không giả định reproducible; muốn refresh base/runtime không đổi source cần
force có chủ đích. Chưa thêm BuildKit cache vì chưa đo cold/warm time và bytes
upload/download; tránh chuyển một lượng cache lớn cho hệ thống nhỏ.

Chromium/Playwright deps vẫn cài trên CI quality mọi lần chạy; suite có browser
và Linux runtime checks. Không cắt coverage hoặc thêm cache khi chưa đo/thiết kế
gate tương đương. Tối ưu hiện tại giảm image build/push, không tuyên bố đã giảm
browser-test download hoặc số MB cụ thể. Artifact Registry/revision/tag có thể tích lũy; operator review
cleanup policy, giữ image live/rollback hợp lệ. Canary min=0 nhưng tag còn truy
cập được với IAM và có thể còn instance ấm khi scale-down. Cleanup tag sau review;
workflow không xóa artifact Cloud và không đổi VPS/container budget.

**Phải hoàn thành provisioning IAM ngoài workflow trước khi bật flag:**

- Tạo GitHub Environment `pdf-worker-deploy`, custom branch policy chỉ `main`,
  type branch, admin bypass false. Workflow kiểm metadata qua API trước WIF;
  token phải đọc được Environment, API từ chối thì dừng. Reviewer theo chính sách
  vận hành. Không dùng lại danh tính verifier.
- Tạo service account `teacher-pdf-deployer@teacher-hub-pdf.iam.gserviceaccount.com`.
  Cấu hình WIF giới hạn repository numeric identity, branch `main`,
  `job_workflow_ref` của `pdf-worker-release.yml` và environment
  `pdf-worker-deploy`. Tạo repository/environment variables
  `PDF_DEPLOY_WIF_PROVIDER`, `PDF_DEPLOYER_SA`, không lưu JSON key lâu dài.
- Review và cấp quyền tối thiểu đủ đọc IAM/revision/queue, ghi Artifact Registry
  `teacher-pdf`, cập nhật riêng Cloud Run service `teacher-pdf-worker`,
  `iam.serviceAccounts.actAs` với **Worker SA** và `run.invoker` cho endpoint
  canary/prod và mint ID token cho deployer qua WIF. Không cấp IAM write hoặc quyền
  deploy Gateway. Kiểm provider trust, quyền kế thừa, SA delegation, custom role
  và resource condition thật trên Cloud trước bật flag; tên SA không chứng minh
  least privilege. Source không chứng minh policy Cloud hiện hành.
- Bật `PDF_WORKER_AUTO_DEPLOY_ENABLED=true` tại repository variables **sau khi**
  dry-run từng bước và đã nghiệm thu fixture PDF công khai được phép tải/in.
  Không bật chỉ để thử việc xác thực quyền. Không thay `GCP_VERIFIER_SA` hiện hành.

Khi bật flag, readiness cũ trong `pdf-worker.yml` chuyển sang kiểm live Worker
revision và *platform digest bất biến* thuộc registry cố định, cùng IAM, tài
nguyên, queue, Gateway pinned; staged gate kiểm **đúng candidate revision +
digest** từ build run. Cách này bỏ pin Worker cố định khỏi mỗi lần commit nhưng
không tự chứng minh source SHA của image cũ; kiểm chuỗi build/provenance và WIF
là bắt buộc. Gateway vẫn pin cũ và **không được deploy bởi workflow này**.

Tắt opt-in sau rollout mới sẽ quay về pin Worker cũ và chặn readiness; phải review
pin trước khi tắt. Không suy từ opt-in rằng đã bật feature PDF trên VPS.

### Gate promote và rollback do operator

Không tự promote từ health. Phải review đúng candidate trong summary, chạy job
non-owner Viewer mở ẩn danh được phép tải/in, kiểm PDF/GCS/filename Unicode,
download/recovery theo contract. Gọi qua Gateway production không chứng minh đã
test canary: phải xác minh request đến đúng tagged revision, vẫn giữ base URL làm
OIDC audience. Dùng fixture/job/prefix riêng; canary ghi storage thật có thể tạo
checkpoint không tương thích reader cũ. Không coi health là bằng chứng in giấy.

Trước đổi traffic, chờ dispatch cũ hoàn tất theo quy trình operator; queue
concurrency 1 không tự chứng minh revision cũ đã drain. Review API/schema 0030 và
reader từng source. API mới nhận result cũ không tên; job cũ không backfill, dùng
fallback Drive ID. Worker trước filename từ chối manifest có field mới: **không
tự rollback về revision preflight** sau khi Worker mới đã ghi dữ liệu. Nếu chưa
chứng minh reader cũ tương thích, giữ API/recovery và fix forward; không xóa/sửa
object bất biến.

Promote thủ công theo phần canary/traffic, rồi chạy
`pdf-worker-auto-release.mjs promoted SHA DIGEST REVISION`, authenticated live
health và kiểm job/download. Traffic update lỗi giữa chừng phải đọc routing thực
tế. Rollback chỉ sau review tương thích, rồi đọc lại routing 100% và kiểm job;
exit code của lệnh rollback không đủ. Cancel/runner mất kết nối cần operator đọc
traffic/tag/revision thực tế. Staging không đổi traffic nên không cần rollback
traffic tự động, nhưng revision/tag đã tạo có thể còn lại. Audit không cam kết
zero downtime.

## Chuỗi CI/CD thực tế

`ci.yml` kiểm quality, integration, browser smoke và schedule regression trước
pipeline VPS; full regression thủ công không tự deploy. Build API/Web dùng
Dockerfile.api/web, push GHCR theo full SHA. `deploy.yml` dispatch
`pdf-worker.yml` trên main với exact SHA và correlation run/attempt, đợi thành
công, lấy đúng artifact readiness. Workflow `pdf-worker.yml` vẫn chỉ kiểm tra read-only. Nhánh `verify-wif`
không có activation_request kiểm WIF/registry, còn `v2-readiness` đọc Cloud
Run/queue. Workflow `pdf-worker-release.yml` riêng chỉ build/deploy/promote
Worker sau khi bật opt-in và đã provision WIF deployer.

Artifact readiness không secret, giữ 1 ngày; VPS chỉ nhận version 1, PASS,
sourceSha khớp candidate, checkedAt không quá 30 phút, tương lai không quá 60 giây.
Readiness ghim `RELEASE` trong `scripts/pdf-v2-readiness.mjs`, không lấy latest.
Source SHA evidence là SHA API/Web sắp deploy, không tự chứng minh Cloud image
được build từ SHA đó. Cần giữ chuỗi build SHA → registry digest → revision riêng.

Pin hiện hành: Worker `teacher-pdf-worker-00020-fiv` với platform digest
`sha256:7b0e5d6bcd5ce4aa449939ddf3e31d8f93fd4b6e88c20922850810c06009f5cb`;
Gateway vẫn `teacher-pdf-gateway-00013-gej` với digest trong `RELEASE`.
Registry tag Worker `35ff0f8b5a28f91aa7720dbcead85d3f4fe7ef32` trỏ OCI index
`sha256:75357d6f5062ccb3a120e21271a0a9367616dbd2365d4d2df256ce6e7e520b9b`,
có descriptor linux/amd64 đúng digest Worker trên. Không dùng index digest thay
platform digest trong gate này. Mapping tag/index/manifest không phải chứng nhận
build provenance; kiểm lại live inventory khi rollout tiếp hoặc rollback.

GitHub Environment `pdf-worker`: main duy nhất, policy type branch rõ ràng,
custom_branch_policies true/protected_branches false, can_admins_bypass false;
reviewer optional cho verifier chỉ đọc. Validator chạy trước auth; thiếu trường/
API lỗi phải chặn. WIF provider còn cần điều kiện numeric repository/owner ID,
ref main, event workflow_dispatch, workflow/environment/audience/subject đúng.
Không dùng validator hay marker shell làm thay IAM; loại đường GitHub impersonate
deployer và kiểm quyền kế thừa/delegation độc lập. Verifier cần quyền đọc readiness
nhưng không Run deploy, Artifact Registry push hoặc IAM write.

Trên VPS, deployment lock bảo vệ env snapshot/validation/migration. Backup trước
migration, kiểm disk/inode và giữ image rollback. Root phải provision/reload unit
trước; deploy xác minh User=deploy, loaded, không NeedDaemonReload, fragment/
drop-in và đường cha (cả symlink resolved) root-owned, deploy không ghi được.
Không cài unit/daemon-reload từ deploy và không cấp sudo ALL.

Candidate chạy `verify-pdf-v2` kiểm ledger/schema 0029, worker_version default 1,
progress nullable và Gateway queue/capabilities qua approval hiện có. Sau health
Web/API, deploy enable timer đã cài, cập nhật nguyên tử đúng ba key
PDF_API_ENABLED/PDF_CHUNKED_JOBS_ENABLED/PDF_LONG_PRINT_TASKS_ENABLED, recreate API,
kiểm live schema/Gateway, recovery chạy thành công, timer active và public tools.
Các lần deploy sau lặp gate; copy unit template không đồng nghĩa đã cài unit.

## Build, stage và các helper không được dùng nhầm

| Công cụ | Hành vi thực tế / giới hạn |
| --- | --- |
| pdf-cloud-stage.mjs --plan/--inspect | Plan/inventory legacy, chỉ đọc; inspect đòi cả hai service private |
| pdf-cloud-stage.mjs --stage | Build/push/deploy no-traffic legacy; Worker max 3/scratch 32 MiB, Gateway 30 giây, thiếu chunk gate |
| pdf-cloud-stage-public-hmac.mjs --preflight | Đọc Git/IAM/Docker daemon/secret metadata; Worker private, Gateway đã public-HMAC, không đọc secret payload |
| pdf-cloud-stage-public-hmac.mjs --stage | Cùng template legacy, giữ traffic; cần review IAM/HMAC và marker public-hmac-no-traffic |
| pdf-release-one-shot.mjs --stage-and-verify | Gọi public stage → local offline smoke → staged audit; không promote hoặc E2E cloud |
| pdf-release-audit.mjs --check | Đọc staged revision/digest/0% traffic theo PDF_STAGED_SHA; contract legacy, không thay readiness v2 |
| pdf-local-runtime-audit.mjs --smoke | Chạy Docker offline đã có, kiểm browser/ảnh/qpdf; không tự pull, không Drive/cloud |
| deploy-pdf-worker.sh | Tên/marker health-only nhưng thực tế deploy processing=true, không --no-traffic; max 3, scratch 32 MiB; không dùng cho v2 hoặc staging an toàn |
| pdf-cloud-readiness.mjs --gcloud | Inventory v1 cũ, không phải release gate v2 |

**Phát hiện cần PR code riêng:** hai stage helper và one-shot hiện build với
context `workers/pdf`/`workers/pdf-gateway`, trong khi Dockerfile cần root context
(`COPY shared/dist`, `COPY workers/...`). Mock orchestration không chứng minh
build thật. Không chạy lại các helper như một giải pháp deploy v2. Không sửa gate
cho dễ PASS. Lệnh build đúng context nằm dưới; task tài liệu không sửa scripts.

Sau review source/lock/dependency, Docker Linux amd64, Node 24/npm 12 và quyền
operator, TÁC ĐỘNG LOCAL (build image, không production):

```powershell
$sha = (git rev-parse HEAD).Trim()
$registry = 'asia-southeast1-docker.pkg.dev/teacher-hub-pdf/teacher-pdf'
$workerImage = "$registry/teacher-pdf-worker:$sha"
$gatewayImage = "$registry/teacher-pdf-gateway:$sha"
npm.cmd ci
npm.cmd run build:shared
docker build --pull --platform linux/amd64 -f workers/pdf/Dockerfile -t $workerImage .
docker build --pull --platform linux/amd64 -f workers/pdf-gateway/Dockerfile -t $gatewayImage .
```

Working tree phải sạch, SHA đã review/CI đạt, không credential trong context.
Worker image có browser, qpdf/util-linux, npm runtime dependencies; không còn
health-only dependency-free. Kiểm image size/layers/cache, non-root, browser
sandbox/egress, qpdf và tmpfs. Smoke offline chỉ chứng minh image chạy fixture.

TÁC ĐỘNG REGISTRY (chỉ sau duyệt push):

```powershell
gcloud.cmd auth configure-docker asia-southeast1-docker.pkg.dev --quiet
docker push $workerImage
docker push $gatewayImage
$workerDigest = (gcloud.cmd artifacts docker images describe $workerImage --project=teacher-hub-pdf --format='value(image_summary.digest)').Trim()
$gatewayDigest = (gcloud.cmd artifacts docker images describe $gatewayImage --project=teacher-hub-pdf --format='value(image_summary.digest)').Trim()
```

Push image **không cập nhật production**. Dùng immutable digest, ghi mapping SHA
và digest trong evidence riêng. Index digest có thể khác manifest linux/amd64 do
image index chứa cả manifest platform và attestation. Không tự thay pin bằng một
digest bất kỳ thấy trong log. Chỉ đọc để đối chiếu cấu trúc:

```powershell
docker buildx imagetools inspect "$registry/teacher-pdf-worker@$workerDigest" --raw
```

Đọc `mediaType`, descriptors platform và digest con; so `spec.containers.image`
với digest deploy và `status.imageDigest` revision. Readiness hiện so nghiêm ngặt
cả hai với một pin; nếu index/manifest khác, gate có thể fail dù cùng lineage.
Cần review bằng chứng registry/revision và PR pin/logic phù hợp; không bỏ check.
[Docker giải thích cấu trúc index/attestation](https://docs.docker.com/build/metadata/attestations/attestation-storage/).

## Tạo revision v2 không chuyển traffic

TÁC ĐỘNG CLOUD: chỉ khi đã duyệt đầy đủ cấu hình v2/IAM/secret/cost. Chụp inventory
traffic/config trước; giữ cả image và revision rollback. Các command này giữ env/secret khác bằng update; phải đối chiếu override hiện có
với cấu hình đã duyệt. Không cấp IAM, không tạo secret. Secret reference phải là phiên bản số đã được duyệt.
`--no-traffic` giữ route cũ; tag canary thêm đường truy cập riêng. Cập nhật service
scaling có thể ảnh hưởng service dù revision mới 0%, phải review diff trước.

```powershell
$secretRef = '<TEN_SECRET>:<PHIEN_BAN_SO>'
gcloud.cmd run deploy teacher-pdf-worker --project=teacher-hub-pdf --region=asia-southeast1 --image="$registry/teacher-pdf-worker@$workerDigest" --service-account=teacher-pdf-worker@teacher-hub-pdf.iam.gserviceaccount.com --no-traffic --tag=pdf-canary --cpu=1 --memory=2Gi --concurrency=1 --min=0 --max=1 --min-instances=0 --max-instances=1 --timeout=180 --no-cpu-boost --cpu-throttling --port=8080 --ingress=all --update-env-vars=PDF_PROCESSING_ENABLED=true,PDF_WORKER_IAM_READY=true,PDF_TEMP_ROOT=/tmp/pdf-worker,PDF_PRINT_FALLBACK_ENABLED=true,PDF_VIEWER_SCREEN_CAPTURE_ENABLED=true,PDF_CHUNKED_JOBS_ENABLED=true --add-volume=name=pdf-temp,type=in-memory,size-limit=384Mi,mount-path=/tmp/pdf-worker
gcloud.cmd run deploy teacher-pdf-gateway --project=teacher-hub-pdf --region=asia-southeast1 --image="$registry/teacher-pdf-gateway@$gatewayDigest" --service-account=teacher-pdf-gateway@teacher-hub-pdf.iam.gserviceaccount.com --no-traffic --tag=pdf-canary --cpu=1 --memory=256Mi --concurrency=10 --min=0 --max=1 --min-instances=0 --max-instances=1 --timeout=180 --no-cpu-boost --cpu-throttling --port=8080 --ingress=all --update-env-vars=PDF_GATEWAY_ENABLED=true,PDF_LONG_PRINT_TASKS_ENABLED=true,PDF_CHUNKED_JOBS_ENABLED=true,PDF_GATEWAY_WORKER_URL=https://teacher-pdf-worker-851777150171.asia-southeast1.run.app --update-secrets="PDF_GATEWAY_HMAC_KEY=$secretRef"
```

Re-inventory đúng revision vừa tạo, Ready, SA, digest, mount/env, private Worker,
Gateway đúng mode đã duyệt và traffic cũ không đổi. Không suy từ latest template.
Nếu mount name đã tồn tại cần so cấu hình/CLI đang dùng trước, không thêm volume
thứ hai để vượt guard. Stage lỗi có thể để lại một revision 0%, không tự xóa.

## Canary chứng minh revision thật xử lý

Không coi `/health`, browser launch hoặc staged audit là canary PDF. Cần fixture
Viewer khác Owner **được phép tải/in**, mở ẩn danh; kiểm quyền ngoài Worker vì
source hiện không có gate quyền đầy đủ. Không dùng file khóa Print/Copy.

Canary phải có: URL tag → revision name → request log có revision đó → job UUID
riêng → claim/checkpoint/result/output → pages/bytes/hash/chất lượng. Task vào
base URL vẫn chạy revision nhận production traffic, không tự chạy canary.
Gateway provider/allowlist hiện chỉ dùng canonical Worker URL; **không có helper
E2E tự động route cả pipeline vào tag**. Không trỏ production queue sang tag.

Với operator đã có quyền mint ID token invoker, có thể gọi trực tiếp tagged
Worker để kiểm runtime và từng step trên UUID fixture mới. TÁC ĐỘNG DỮ LIỆU THỬ
GCS (không chuyển traffic), PowerShell, không bật transcript/debug/header logging:

```powershell
$workerBase = 'https://teacher-pdf-worker-851777150171.asia-southeast1.run.app'
$canaryURL = '<URL_TAG_WORKER_TU_STATUS_TRAFFIC>'
$jobId = [guid]::NewGuid().ToString()
$fileId = '<ID_FIXTURE_VIEWER_DUOC_PHEP>'
$idToken = (gcloud.cmd auth print-identity-token --impersonate-service-account=teacher-pdf-invoker@teacher-hub-pdf.iam.gserviceaccount.com --audiences=$workerBase).Trim()
$body = @{version=2;jobId=$jobId;source=@{provider='google_drive';fileId=$fileId};step=0} | ConvertTo-Json -Compress
Invoke-RestMethod "$canaryURL/jobs" -Method Post -ContentType 'application/json' -Headers @{Authorization="Bearer $idToken"} -Body $body
Remove-Variable idToken
```

Token audience canonical base, không URL tag hay `/jobs`. Không in token, không
copy secret sang browser. Với ACK CHECKPOINTED, đọc manifest/marker và gọi tiếp
step 1..ceil(totalPages/10)+1 cùng job/source, token mới khi cần, không bỏ bước.
Direct ≤50 có thể COMPLETED ngay, do đó không chứng minh renderer hay chunk chạy.
Đối chiếu GCS metadata/result chỉ trên fixture, log đúng revision; download fixture
được phép, kiểm qpdf/pages/hash và xem mọi trang. Đừng xóa checkpoint để thử lại;
dùng UUID mới. Thử v1 payload riêng để bảo vệ tương thích.

Gateway canary cần signed HMAC server-side + nonce mới, queue/capabilities/read
và lỗi chữ ký/replay, secret lấy qua cơ chế operator hiện có; không đưa secret
vào CLI/history. Allowlist Worker vẫn canonical nên canary Gateway tạo task không
chứng minh canary Worker. E2E thật qua website/queue phải thực hiện trong môi
trường cô lập được duyệt hoặc sau promotion có kiểm soát và rollback sẵn sàng.
Ghi riêng phần chưa chạy, không gộp direct-tag smoke thành E2E toàn hệ thống.

## Promote, readiness pin và API/Web

TÁC ĐỘNG PRODUCTION: sau canary/quyền/tài nguyên/cost review và duyệt traffic,
chọn revision đã kiểm chứng, không lấy latest mù. Promoting Gateway tương thích
trước Worker giúp giữ đọc v1/v2; phải bảo đảm route phục vụ job đang có.

```powershell
$gatewayRevision = '<REVISION_GATEWAY_DA_DUYET>'
$workerRevision = '<REVISION_WORKER_DA_DUYET>'
gcloud.cmd run services update-traffic teacher-pdf-gateway --project=teacher-hub-pdf --region=asia-southeast1 --to-revisions="$gatewayRevision=100"
gcloud.cmd run services update-traffic teacher-pdf-worker --project=teacher-hub-pdf --region=asia-southeast1 --to-revisions="$workerRevision=100"
```

Đây mới là chuyển 100% traffic; tạo revision không làm bước này.
[Cloud Run mô tả riêng deploy revision và traffic](https://docs.cloud.google.com/run/docs/deploying).
Sau promotion đọc lại traffic/revision/IAM/queue. Cập nhật `RELEASE` readiness
bằng PR riêng có mapping digest/revision đã xác minh và tests pin; không đổi pin
trong task chuẩn hóa tài liệu này. Chuẩn bị PR pin trước, chỉ công nhận live
readiness sau traffic đã khớp. Chuyển traffic nhưng giữ pin cũ gây
`TRAFFIC_MISMATCH`/`REVISION_DIGEST_MISMATCH`, pipeline API/Web bị chặn; không tự
rollback Cloud Run hoặc tự đổi traffic. Hệ thống đang chạy không tự ngừng chỉ
vì script readiness chạy thất bại. Cần phối hợp cửa sổ phát hành để tránh chặn
các deployment khác; không bỏ gate.

API/Web deploy là luồng riêng qua CI/GHCR/VPS, không được coi đã cập nhật chỉ vì
push Worker. Sau deploy kiểm capabilities thực, một job được phép qua
website → Gateway → Tasks → đúng Worker → GCS → ticket/download trên thiết bị
khác; kiểm đóng tab/recovery, lỗi quyền, retry/expiry và progress 10 trang. E2E
200 trang/giấy in và số đo CPU/RAM/cost vẫn là nghiệm thu riêng.

## Cấu hình VPS và hai chế độ xác thực

Compose ≥2.24 cho optional env_file. Host `/opt/teacher-hub/pdf-runtime/` mount
read-only tại `/run/teacher-pdf`; API có mạng pdf-egress, MySQL vẫn internal,
không publish API/Web port. `PDF_GATEWAY_APPROVAL_FILE=/run/teacher-pdf/approval.json`.
Directory root-owned 0755, secret JSON/JWT 0600 owner UID node 1000 (kiểm image
thật trước provision), parent không cho người không tin cậy ghi. Renew JWT bằng
file tạm + chmod/chown + rename nguyên tử. Windows không chứng minh Linux modes.
Không để credential trong Git/image/GitHub Actions/browser, shell history hay log.

Loader chỉ nhận file absolute 50..4096 byte, file thường, Linux không có quyền
group/other, exact keys, URL/key là string không whitespace. Schema public-HMAC
bên dưới chỉ là **mẫu không dùng được**, không phải secret cần copy:

```json
{
  "kind": "pdf_gateway_v1",
  "gatewayURL": "https://teacher-pdf-gateway-851777150171.asia-southeast1.run.app",
  "workerBaseURL": "https://teacher-pdf-worker-851777150171.asia-southeast1.run.app",
  "hmacKeyHex": "<64_KY_TU_HEX_THUONG_QUA_KENH_BAO_MAT>",
  "authMode": "hmac_public_v1",
  "activationApproved": true,
  "recoveryVerified": true
}
```

Chế độ IAM+HMAC bỏ authMode, thay bằng đúng object:

```json
{"federation":{"audience":"//iam.googleapis.com/projects/851777150171/locations/global/workloadIdentityPools/<POOL>/providers/<PROVIDER>","serviceAccount":"<CALLER>@teacher-hub-pdf.iam.gserviceaccount.com","subjectTokenFile":"/run/teacher-pdf/subject.jwt"}}
```

Phải kiểm thêm guard `validGatewayFederation` về pool/provider/caller trước cấp
cấu hình thực. Không nhận cả hai chế độ trong cùng file. Private mode cần issuer
độc lập chứng thực VPS; token renew trước expiry, ID token cache refresh trước
một phút. Không ADC, key JSON, token GitHub, cookie Drive hoặc downgrade khi IAM
lỗi. Hai approval boolean là xác nhận operator, không tự chứng minh recovery.
Rehearsal dùng file riêng và DB synthetic cô lập, không bật production để thử.

`runtime.env` chỉ giữ cờ/quota không secret. Mẫu chuẩn bị v2 chưa bật:

```dotenv
PDF_API_ENABLED=false
PDF_CHUNKED_JOBS_ENABLED=false
PDF_BATCH_LIMIT=1
PDF_ACTIVE_LIMIT=3
PDF_HOURLY_LIMIT=20
```

Deployment được duyệt mới bật cờ theo helper hiện có. Override hourly=10 cũ vẫn
cho 10. Legacy PDF_LONG_PRINT_TASKS_ENABLED có thể được ghi true nhưng code
Gateway luôn gửi 180s. Các env PDF_PRINT_FALLBACK_ENABLED=false và
PDF_VIEWER_SCREEN_CAPTURE_ENABLED=false không tắt renderer; rollback phải chọn
revision/code tương thích, không dựa vào các cờ này.

### HMAC, nonce và IAM

HMAC-SHA256 ký chuỗi nối newline:
`v1`, method, path, timestamp giây, nonce, SHA-256 raw body. Header
X-PDF-Timestamp (±60 giây), X-PDF-Nonce (32 hex), X-PDF-Signature (64 hex).
Sai signature/timestamp/schema từ chối trước thao tác Google. Nonce hợp lệ được
reserve create-only `gateway-nonces/SHA256(nonce)` trước upstream; replay 412 →
401. Giữ reservation hơn 120 giây từ lần nhận đầu cộng margin clock skew; không
xóa sớm. Body Gateway ≤8192 byte, JSON upstream ≤16 KiB. Token bucket local:
enqueue burst 5/20 mỗi phút, read 10/120, download 2/10; một download/process.
Không phải global quota hoặc DDoS/spending cap.

Gateway chỉ tasks.create/get và queues.get đúng queue, actAs invoker, object.get
đúng bucket, create chỉ gateway-nonces/, secret accessor đúng secret; Worker chỉ
object.get/create. Tasks invoker chỉ run.invoker Worker; service agent Tasks cần
quyền mint OIDC chuẩn. Private caller chỉ run.invoker Gateway và WIF subject
đúng; không quyền data/deploy. Review quyền kế thừa, prefix condition, secret
rotation và revocation. Không cấp Admin/list/delete để sửa lỗi readiness.

Public-HMAC là lựa chọn bảo mật riêng: Gateway bỏ IAM invocation check, không
allUsers/allAuthenticatedUsers binding; Worker vẫn IAM-private. Unsigned
Gateway `/v1/queue` phải 401 application, unsigned Worker bị Cloud Run 401/403.
IAM-private Gateway phải kiểm cả IAM lẫn HMAC. Không đổi mode từ một lỗi 403.

### Systemd và kiểm chứng dữ liệu

Root/operator provision unit template đã review trước deploy, TÁC ĐỘNG HOST:

```bash
cd /opt/teacher-hub
sudo install -m 644 teacher-pdf-recovery.service teacher-pdf-recovery.timer /etc/systemd/system/
sudo systemctl daemon-reload
```

Sudoers cho deploy chỉ cần đúng `systemctl enable --now teacher-pdf-recovery.timer`
và `systemctl start teacher-pdf-recovery.service` bằng `sudo -n`. Không quyền
install/reload/ALL. Service User=deploy, OnCalendar mỗi phút, Persistent=true,
host flock, CLI `node --max-old-space-size=64 dist/scripts/reconcile-pdf.js`
trong container API đang chạy, không thêm container lâu dài. Heap 64 MiB không
phải total RSS; đo API+CLI+MySQL trong host 1,5 GB trước tăng tải.

Chỉ đọc trên VPS Linux:

```bash
cd /opt/teacher-hub
systemctl show teacher-pdf-recovery.service --property=User,Result,LoadState,NeedDaemonReload,FragmentPath,DropInPaths
systemctl is-enabled teacher-pdf-recovery.timer
systemctl is-active teacher-pdf-recovery.timer
systemctl list-timers teacher-pdf-recovery.timer
journalctl -u teacher-pdf-recovery.service -n 30 --no-pager
```

Result success và processed=0 lúc disabled/idle không chứng minh recovery xử lý.
Cần job synthetic pending, đóng tab, quan sát qua nhiều timer tick và outage/
restart. Candidate/live `verify-pdf-v2` kiểm ledger 0029 và type/default thật;
ledger một mình không đủ. Migrations 0027/0028/0029 forward-only, không sửa SQL
đã áp dụng. 0029 có recovery khi ALTER xong nhưng ledger chưa ghi. Kiểm bằng
runner/verifier hiện có, không tự chạy SQL lại hoặc restore dump thật để thử.

## Chẩn đoán theo tầng

Bắt đầu bằng job UUID, workerVersion, status, errorCode, cloudErrorCode,
createdAt/updatedAt/expiresAt, enqueueAttempts, progress.nextStep. Dùng bản đọc
DB được cấp quyền, không dump source/ticket/secret. HTTP detail có thể tick và
cập nhật trạng thái; không coi đó là truy vấn thuần read-only vào DB.

| Triệu chứng | Cách kiểm và ý nghĩa |
| --- | --- |
| PDF_RATE_LIMITED | Xác định endpoint: session hoặc submit/retry IP (60/h), owner active/hour, hoặc ticket 20 row chưa hết hạn. So effective capabilities và SQL count chỉ đọc; Retry-After thuộc IP fixed-window, không hứa DB quota cùng mốc |
| Không submit/download | Kiểm PDF_API_ENABLED, approval loader/mode, provider ready, queue policy và v2 capabilities; disabled không chứng minh IAM bị thiếu cụ thể |
| ENQUEUE_PENDING/RETRY không tiến | Kiểm recovery timer, next_action_at/lease và cloudErrorCode; lease hết 60s có thể reclaim; không reset row hoặc cấp UUID mới tự động |
| QUEUED lâu / progress đứng | Kiểm đúng task step, queue RUNNING, retry, Worker request log đúng revision; gap do scheduler phút hoặc browser/source chậm. Không có RUNNING riêng |
| FAILED | Chỉ dùng result.errorCode đã validate; source error khác outage cloud. Không kết luận Worker vẫn chạy hay đã hủy từ lời UI |
| EXPIRED | Quyền tải hết dù object còn; TTL không hủy task đang chạy. Điều tra stale dispatch rồi manual retry theo cap |
| RESULT_UNCONFIRMED | Task/result thiếu hoặc enqueue không xác nhận; tiếp tục recovery đến expiry; không biến thành FAILED hoặc retry UUID mới trước hạn |
| RETRY_EXHAUSTED | Kiểm bằng chứng attempts/thời gian/queue, vẫn nhận late result; manual successor có thể được tạo theo cap |
| PDF_RESULT_SCHEMA_MISMATCH | Đối chiếu claim exact 24h, source hash, result fields/version/expiry/bytes/pages. Claim cũ sai TTL không sửa immutable; cần attempt mới sau điều kiện hợp lệ |
| FILE_TOO_LARGE | Phân biệt nguồn, PNG, JPEG embed, final PDF qua stage/reason/bytes; 150 MiB output không cho nguồn >20 MiB; không giảm DPI/nới cap để che lỗi |
| Tải đứt/busy | Ticket consume trước upstream; lấy ticket mới. Kiểm Gateway slot, deadline 180s, Nginx buffering/190s, exact bytes và disconnect; không retry ticket cũ |
| Readiness FAIL | Xem bước WORKER/GATEWAY SERVICE/REVISION/IAM hoặc QUEUE và reason; không tự grant IAM/đổi pin/traffic |

Readiness reason PERMISSION_DENIED, UNAUTHENTICATED, NOT_FOUND, API_DISABLED,
DEADLINE_EXCEEDED, UNAVAILABLE, GCLOUD_NOT_FOUND, COMMAND_TIMEOUT,
OUTPUT_LIMIT_EXCEEDED, INVALID_JSON hoặc COMMAND_FAILED là phân loại riêng.
Validation có TRAFFIC_MISMATCH, REVISION_DIGEST_MISMATCH, RESOURCE_DRIFT,
SCRATCH_DRIFT, CHUNKS_DISABLED… Không suy nguyên nhân từ log cũ chung chung
PDF_V2_CLOUD_READ_BLOCKED; auth action lỗi xảy ra trước script.

V1 log `pdf-stage-failed` phân biệt direct-download/validation,
viewer-render/validation và storage. `html-response` không chứng minh cấm tải;
`login-redirect` khác encrypted-pdf, ambiguous layout, low DPI hoặc byte bound.
Legacy reason print-disabled chỉ có ý nghĩa với revision/nhánh thực kiểm Print;
source active hiện không kiểm. Source v2 phát cùng diagnostic event, có thêm
`step` 0..21 và stage `chunk-merge`. `anchor-fingerprint-mismatch` khác
`page-total-mismatch` và lỗi bố cục `ambiguous-layout-*`; không log fingerprint
hay ảnh. Revision lineage 35ff0f8 chưa phát event v2: phải đối chiếu
checkpoint/result/task và request log; thiếu event không chứng minh nguồn ổn định.

Chỉ đọc log đúng revision/UUID bằng PowerShell (v2 cần revision có logger mới):

```powershell
$filter = 'resource.type="cloud_run_revision" AND resource.labels.service_name="teacher-pdf-worker" AND resource.labels.revision_name="' + $revision + '" AND jsonPayload.event="pdf-stage-failed" AND jsonPayload.jobId="' + $jobId + '"'
gcloud.cmd logging read $filter --project=teacher-hub-pdf --limit=20 --format='table(timestamp,resource.labels.revision_name,jsonPayload.step,jsonPayload.stage,jsonPayload.code,jsonPayload.reason,jsonPayload.pageIndex,jsonPayload.usedBytes,jsonPayload.limitBytes)'
```

Drive lỗi ở source/renderer; Worker 503 retryable có thể parser/storage/timeout;
Cloud Tasks 401/403 Worker là OIDC/IAM; Gateway 401 là HMAC/replay hoặc IAM tùy
mode; API cloudErrorCode là lỗi transport/validation đã chuẩn hóa. Gateway chỉ
ACK duplicate khi Google 409 ALREADY_EXISTS đúng schema, trả TASK_ALREADY_EXISTS;
nonce replay 401 không được coi enqueue thành công. Unknown cần bằng chứng thêm.

## Chi phí, dung lượng và giám sát

Không có số đo bill/production capacity trong đợt tài liệu này. Lấy đơn giá theo
region/billing mode hiện tại từ [Cloud Run](https://cloud.google.com/run/pricing),
[Cloud Tasks](https://cloud.google.com/tasks/pricing),
[Cloud Storage](https://cloud.google.com/storage/pricing) và network SKU đích VPS.
Chi phí gồm Worker CPU/RAM thời gian active/cold start/retry, Gateway CPU/RAM
cho polling/nonce/stream, request, Tasks create/delivery/read, GCS bytes/ops,
network Gateway→VPS, VPS→browser, registry layers/cache, log, MySQL history/backup.
Không tính chồng cùng bytes thành cả GCS internet egress và Gateway internet egress.
Cloud Run cùng region và internet outbound có cách tính riêng; kiểm bảng giá.

Công thức ước tính: Worker activeSeconds × (vCPU × CPU rate + GiB × RAM rate)
+ request; cộng Gateway active **instance** time (không cộng thời gian request
chồng nhau), Tasks/GCS/egress. Với 200 trang có thể 22 bước, mỗi bước tối đa 5
attempt; envelope 22×5×120 giây chỉ là mô hình, không trần hóa đơn hay SLA.
20 lượt nhận/giờ không bảo đảm 20 hoàn thành: nếu 600 giây Worker/job thì một
Worker tối đa lý thuyết 6 job/giờ trước scheduling gap/retry/cold start.

Giả định planning 320 MiB/job giữ 7 ngày ở 20 job/giờ → khoảng 1.050 GiB dữ liệu
sống cho một owner; còn lifecycle lag, soft delete, nonces, metadata. Một Worker
có thể không đạt intake này. MySQL history không tự purge; tính index/binlog/
backup/log trên SSD chung 15 GB. Không lưu PDF/ảnh tạm lâu dài ở API.

Giữ min 0/max 1 và queue concurrency 1 theo target. Thu ít nhất một tuần arrival,
p50/p95 queue/completion, active instance time, CPU/RAM peak, 429 theo tầng,
retry/error, storage bytes/ops, traffic download và daily spend. Chỉ đề xuất tăng
3/5 Worker khi có backlog vượt mục tiêu đã duyệt và biết bottleneck thật; với
3 active chung không tận dụng được 5 Worker. Scaling cần duyệt chi phí/queue/
quota/Gateway/VPS/security riêng. Budget alert và max instances không phải hard
spend cap. Không tự tăng VPS RAM/swap/container limits hoặc đổi retention.

## Rollback giữ job, checkpoint và output

### Hồi phục lỗi phát hành thông thường

Trước thay đổi giữ mapping image SHA/digest, revisions/traffic, mount/scaling/
timeout/IAM và snapshot runtime.env/Compose/helper qua kênh riêng. Phân biệt:

- **Chỉ tài liệu:** revert commit tài liệu; không có dữ liệu/hạ tầng cần đảo.
- **No-traffic canary lỗi:** giữ traffic cũ; không xóa job/object để làm sạch.
- **API activation lỗi:** helper tự restore runtime/env/images chỉ nếu không có
  job v2 chưa hết hạn ngoài FAILED/EXPIRED. Có job/output còn hiệu lực hoặc DB
  không đọc được → giữ API/v2 flags/recovery tương thích, báo lỗi để fix-forward.
- **Cloud revision lỗi:** chỉ route về revision hỗ trợ mọi v1/v2 đang tồn tại;
  chưa drain không quay về v1-only. Traffic rollback không khôi phục service
  scaling/IAM/env/mount, cần so snapshot và duyệt phần cần khôi phục.

TÁC ĐỘNG PRODUCTION, sau khi chọn revision rollback tương thích và được duyệt:

```bash
gcloud run services update-traffic teacher-pdf-worker --project=teacher-hub-pdf --region=asia-southeast1 --to-revisions="$PREVIOUS_WORKER_REVISION=100"
gcloud run services update-traffic teacher-pdf-gateway --project=teacher-hub-pdf --region=asia-southeast1 --to-revisions="$PREVIOUS_GATEWAY_REVISION=100"
```

Định nghĩa hai biến từ inventory đã lưu trước khi chạy. Re-inventory traffic,
readiness pin tương ứng và verify download/recovery. Không down-migrate 0027–29,
không đổi worker_version job cũ, không xóa claim/marker/result, không restore DB
đè job mới chỉ để rollback code. Nếu cần ngừng nhận mới nhưng giữ phục hồi/tải,
source chưa có cờ riêng cho admission: PDF_API_ENABLED=false còn chặn cả tick/
download. Cần phương án incident được duyệt, không mô tả cờ này là drain an toàn.
Hạ quota hợp lệ có thể giảm intake mà không sửa dữ liệu.

### Sự cố credential/lạm dụng

Ưu tiên chặn credential bị lộ, chấp nhận gián đoạn có kiểm soát thay vì hứa
recovery vẫn chạy. Với public Gateway, TÁC ĐỘNG BẢO MẬT sau duyệt incident:

```bash
gcloud run services update teacher-pdf-gateway --project=teacher-hub-pdf --region=asia-southeast1 --invoker-iam-check
```

Kiểm không còn public IAM binding kế thừa/trực tiếp, unauthenticated request bị
Cloud Run chặn. Chỉ tắt website không chặn gọi Gateway trực tiếp. Rotate/revoke
HMAC qua quy trình secret hiện có; private mode thu hồi caller/token liên quan.
Nếu cần dừng PDF: operator đặt PDF_API_ENABLED=false trong host runtime.env,
recreate API, stop timer và service. TÁC ĐỘNG HOST, làm với nhận thức download/
recovery sẽ dừng, giữ dữ liệu để nối lại sau sửa:

```bash
cd /opt/teacher-hub
docker compose --env-file .env -f docker-compose.deploy.yml up -d --no-deps api
sudo systemctl disable --now teacher-pdf-recovery.timer
sudo systemctl stop teacher-pdf-recovery.service
```

Không chạy script deploy cũ chỉ với SHA cũ mà chưa xét gate/compatibility và
helper đi kèm. Khi incident đã xử lý, xác minh source/identity/schema/queue,
khôi phục recovery rồi đối chiếu job/output còn hiệu lực trước mở lại.

## Rollout metadata tên tài liệu

Metadata tên là mở rộng tùy chọn của manifest v2/result COMPLETED v1, không đổi
capabilities hay request schema. Không chạy các bước dưới đây tự động trong task code:

1. Backup theo runbook hiện có, áp dụng migration cộng thêm `0030_pdf_filename.sql`
   trước API mới. Cột nullable, không backfill; atomic ALTER có ledger recovery.
   Kiểm cột utf8mb4 nullable và job cũ vẫn NULL. DDL có thể giữ metadata lock ngắn;
   chọn thời điểm phù hợp với tải MySQL, không suy downtime từ test local.
2. Triển khai API và recovery CLI cùng shared mới trước khi Worker ghi tên;
   consumer cũ sẽ từ chối manifest/result có field mới. Gateway không đổi code,
   endpoint, IAM, HMAC hay resource: chuyển tiếp JSON opaque đã đủ khả năng.
3. Khi được duyệt rollout Worker, tránh chia traffic giữa reader cũ/mới. Cho
   dispatch đang chạy ở revision cũ hoàn tất trước khi revision mới bắt đầu ghi
   manifest có tên. Reader mới đọc checkpoint cũ không tên bình thường; giữ queue
   tuần tự, concurrency/max instance và mọi quota hiện có.
4. Triển khai frontend sau API. Kiểm direct/Viewer hợp lệ, tên Unicode, tên thiếu,
   reload/thiết bị khác, recovery mất result và native POST download thực tế.

Rollback UI độc lập được; giữ API/Worker reader tương thích với field mới khi còn
job/checkpoint/result có tên. Không đưa Worker cũ vào xử lý manifest có filename;
đợi job liên quan hoàn tất/hết TTL theo quy trình vận hành và đánh giá result còn
cần đọc trước khi rollback consumer. Không xóa/sửa object bất biến, không drop cột
hay backfill ngược; cột nullable có thể giữ lại khi rollback application. Nếu cần
dừng dịch vụ, dùng quy trình incident ở trên và giữ dữ liệu để phục hồi.

Tên tài liệu được công khai cùng lịch sử public hiện có; không áp dụng cho tài liệu
nhạy cảm. Title Drive có thể thay đổi/không có; fallback không phải lỗi xử lý.
Fixture tên không thay kiểm chứng Viewer khác Owner có quyền trên Cloud Run thật.

## Verification phù hợp từng rủi ro

Docs-only: check:docs, check:repo, diff/check, kiểm anchor/reference và đối chiếu
source. Không cần Docker/MySQL/browser hoặc cloud mutation.

Code Worker cần check/test và Linux có qpdf/util-linux + Playwright headless shell
đúng package lock; npm install package không cài browser. CI quality đã provision
các dependency này. Test Docker cần root context/shared build, không dùng lệnh
build context cũ trong báo cáo. API/recovery cần unit, MySQL synthetic `_test` và
browser FakeCloud khi liên quan; runner có thể reset/drop test DB, phải kiểm đích.
Không chạy vào DB lớp học. Không dùng test SKIP làm bằng chứng PASS.

Nghiệm thu production cần nguồn có quyền, non-owner Viewer, v1/v2, recovery không
browser, outage/duplicate/checkpoint/merge, expiry/ticket replay, tải thiết bị
khác, streaming chậm, 200 trang, actual print và số đo host/cloud. Test synthetic
và số đo lịch sử chỉ hỗ trợ thiết kế, không cấp phép rollout.
