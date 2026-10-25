# Production deployment

Nền tảng PDF worker bên ngoài có [runbook Cloud Run riêng](cloud-run-pdf-worker.md).
Workflow đó chỉ chạy thủ công, chưa được triển khai trong task chuẩn bị; không thay
thế pipeline VPS dưới đây và không đưa Chromium hoặc PDF processing vào API.

Production chạy trên một VPS Ubuntu bằng bốn container: Caddy → Web/Nginx → API →
MySQL. GitHub Actions kiểm tra source, build hai image, đẩy lên GHCR, sinh runtime
`.env` từ GitHub Repository Secrets rồi SSH vào VPS để chạy script triển khai. VPS
không cần source, Node.js hoặc npm; mỗi lần deploy chỉ nhận `.env` mới,
`docker-compose.deploy.yml`, `Caddyfile`, `deploy-production.sh` và `deploy-env.sh`.

## Production VPS capacity and resource budget

### Host resources

Cấu hình do chủ dự án xác nhận: VPS Ubuntu/Linux, **1.5 GB RAM tổng, 1 vCPU,
15 GB SSD tổng**, chạy Docker Compose. MySQL, API, Web/Nginx và Caddy cùng dùng
tài nguyên host. Đây không phải số đo tài nguyên thực tế: chưa thể suy ra RAM
còn trống, disk còn trống hoặc swap đã bật.

### CI/CD architecture

Theo [CI workflow](../../.github/workflows/ci.yml) và
[deploy workflow](../../.github/workflows/deploy.yml), GitHub Actions chạy quality
checks trên runner rồi build API/Web bằng [Dockerfile.api](../../Dockerfile.api)
và [Dockerfile.web](../../Dockerfile.web), đẩy image lên GHCR. VPS nhận deployment
files qua SSH, pull image theo full commit SHA và chạy bằng Compose; pipeline
hiện tại không build source/frontend/backend trên VPS production.

### Trusted proxy and client IP

The public path is **Caddy → Web/Nginx → API**. Caddy explicitly replaces
`X-Forwarded-For` with `{remote_host}` (the connecting client socket), discarding
any spoofed incoming chain. Both Nginx API locations preserve this sanitized
header without appending Caddy's address. Express trusts exactly one immediate
proxy hop. Keep API and Web ports unpublished as in Compose; only Caddy exposes
80/443. Do not set `trust proxy=true`, trust arbitrary private networks, or accept
untrusted ingress directly into Web/API. Changing topology requires reviewing
this boundary and its regression tests first.

The public PDF limits remain five combined submission/retry requests and ten
session requests per client IP/hour; durable owner-wide job quotas also apply.
In-process counters reset on API restart and are not a distributed quota.
The proxy regression uses two HTTP proxy hops, independent client socket IPs and
spoofed headers; real deployed ingress still needs an operator smoke before activation.

Roll out the matching Caddyfile, Web image/Nginx config and API together through
the existing reviewed deployment process. Before PDF activation, verify two
external client IPs retain separate quotas and a forged incoming XFF cannot
change either identity. Rollback restores the matching proxy/API revision;
keep PDF disabled and preserve all PDF tables/history. No topology, port,
container resource limit or VPS size change is required by this fix.

### Container constraints

Giới hạn hiện tại trong [docker-compose.deploy.yml](../../docker-compose.deploy.yml):

| Thành phần | Giới hạn cấu hình |
| --- | --- |
| MySQL | `mem_limit: 512m` |
| API | `mem_limit: 384m` |
| Web/Nginx | `mem_limit: 96m` |
| Caddy | `mem_limit: 96m` |
| Node API heap (V8 old space) | `--max-old-space-size=256` (256 MiB) |

Container memory limit không phải RAM reservation. Không cộng các giới hạn rồi
kết luận đó là RAM đang sử dụng hoặc lấy hiệu với RAM tổng để báo RAM còn trống.
Node heap limit chỉ giới hạn V8 old space, không phải toàn bộ bộ nhớ tiến trình;
buffer, native allocations và tiến trình con vẫn phải nằm trong giới hạn container.
Phải chừa tài nguyên cho kernel, Docker daemon, filesystem cache và tiến trình
hệ thống. Swap không thay thế RAM vật lý; cần đọc trạng thái thực tế thay vì giả
định đã bật từ hướng dẫn bootstrap.

### SSD / deployment

15 GB là toàn bộ SSD, không phải dung lượng riêng cho file người dùng. Phải tính
OS, Docker images/layers, volumes, MySQL, logs, backup, temporary files và khoảng
trống cho deployment, kể cả khi image cũ và mới cùng tồn tại.

[Deploy script](../../scripts/deploy-production.sh) hiện yêu cầu tối thiểu **1 GiB
trống (1.048.576 KiB) và 10.000 inode trống** trên filesystem chứa
`/opt/teacher-hub`, sau cleanup trước deploy. Đây là điều kiện tối thiểu để tiếp
tục deploy, không chứng minh còn đủ dung lượng cho mọi workload.

Giữ nguyên image cleanup, backup, rollback và log rotation hiện hành: cleanup
trước deploy giữ SHA active; sau readiness giữ SHA mới và SHA active trước đó cho
API/Web, prune dangling images và áp dụng retention backup pre-migration 14 ngày.
Compose dùng Docker `json-file` với `max-size: "10m"`, `max-file: "3"` cho từng
service. Chính sách recovery set/backup ngoài host tiếp tục theo
[backup and restore](backup-and-restore.md).
Không tự điều chỉnh retention hoặc disk threshold; không dùng
`docker system prune --volumes` hay lệnh cleanup có nguy cơ xóa dữ liệu.

### Heavy processing policy

- Không mặc định kết quả local áp dụng được cho VPS. Không tự thêm headless
  Chromium, Playwright worker, LibreOffice, OCR hoặc tác vụ ảnh/PDF nặng vào API
  container hiện tại; không chạy xử lý vượt giới hạn bộ nhớ trong container này.
- Tác vụ CPU-bound hoặc memory-intensive đồng bộ trong request API phải được
  benchmark trên cấu hình phù hợp trước. Đo peak memory, CPU, wall time, temporary
  disk và concurrency bằng dữ liệu đại diện, xét cả MySQL/API/Web/Caddy đang hoạt
  động cùng overhead hệ thống. Ghi rõ đâu là số đo, đâu là ước tính; không báo
  production-ready khi chưa kiểm chứng.
- Đánh giá browser, streaming, chunking, queue hoặc worker bên ngoài; nếu không
  đủ tài nguyên, đề xuất cách xử lý nhẹ hơn hoặc worker bên ngoài. Không mặc định
  browser truy cập được nội dung cross-origin; phải kiểm tra quyền truy cập/CORS.
  Queue trên cùng host vẫn tiêu thụ tài nguyên; Compose hỗ trợ thêm container
  không chứng minh VPS đủ sức chạy thêm service. Tính ngân sách cả hệ thống.
- Không lưu lâu dài PDF/ảnh tạm không cần thiết; phải tính vòng đời và cleanup.
  Không đưa file khách hàng hoặc tài liệu riêng tư vào logs, artifacts hay repository.
- Không tự tăng giới hạn RAM, đổi Docker image, bật swap hoặc chỉnh VPS để một
  tính năng chạy được. Thay đổi kiến trúc, deployment hoặc nâng VPS phải báo chi
  phí, tác động và xin người dùng duyệt trước.

Với **Teacher Tools PDF**, PoC local do chủ dự án cung cấp ghi nhận
Playwright/Chromium có thể dùng khoảng **1.4 GiB RAM ở gần 300 DPI trên Windows**.
Đây là quan sát local, không phải benchmark Linux production hoặc số đo của VPS.
Không đưa browser-based PDF rendering vào API container `384m`. File PDF
**12.72 MB** không có nghĩa chỉ cần 12.72 MB RAM để tạo ra file. Phải đánh giá
chất lượng in, quyền sử dụng tài liệu, bộ nhớ, thời gian và dung lượng trước khi
chọn kiến trúc.

### Operational monitoring

Các lệnh chỉ đọc sau dành cho operator chạy trên host khi cần đo thực trạng;
task tài liệu không SSH vào production hoặc tự chạy chúng:

```bash
free -h
swapon --show
df -h
df -i
docker stats --no-stream
docker system df
```

`swapon --show` chỉ đọc trạng thái swap, không kích hoạt hay thay đổi swap. Ghi
nhận tài nguyên khi idle và dưới tải đại diện (kể cả backup/deploy), không chỉ
dựa vào một snapshot để kết luận đủ công suất. Theo dõi thêm peak memory, CPU,
wall time, temporary disk và concurrency của tác vụ nặng; dùng
[checklist đo dung lượng máy nhỏ](backup-and-restore.md#checklist-đo-dung-lượng-máy-nhỏ)
cho backup/restore. Không ghi secret hoặc nội dung tài liệu riêng tư vào kết quả đo.

## GitHub configuration

Tạo environment `production`. Tạo các Repository Secrets bắt buộc sau:

- `GHCR_OWNER`: tên owner GitHub viết thường; workflow fallback về owner của repository
  nếu secret này rỗng.
- `MYSQL_ROOT_PASSWORD`
- `DB_PASSWORD`
- `JWT_SECRET`
- `PROD_HOST`
- `PROD_PORT`
- `PROD_USER`
- `PROD_SSH_PRIVATE_KEY`
- `PROD_SSH_KNOWN_HOSTS`

Ba feature flag sau cũng bắt buộc và chỉ nhận `true` hoặc `false` (không phân biệt hoa
thường):

- `GOOGLE_DRIVE_ENABLED`
- `GOOGLE_SHEET_SYNC_ENABLED`
- `ARASAAC_ENABLED`
- `PIXABAY_ENABLED`

Khi `GOOGLE_DRIVE_ENABLED=true`, phải có thêm `GOOGLE_DRIVE_CLIENT_ID`,
`GOOGLE_DRIVE_CLIENT_SECRET`, `GOOGLE_DRIVE_REFRESH_TOKEN` và
`GOOGLE_DRIVE_ROOT_FOLDER_ID`. `GOOGLE_SHEET_SYNC_ENABLED=true` yêu cầu Google Drive
cũng được bật. `ARASAAC_ENABLED=true` không cần API key. Khi
`PIXABAY_ENABLED=true`, phải có `PIXABAY_API_KEY`.

`REPORT_VIETINBANK_ACCOUNT_NUMBER` là optional và sẽ được ghi rỗng vào runtime `.env`
nếu không khai báo. `VITE_GOOGLE_MAPS_EMBED_API_KEY` chỉ dùng làm build arg của Web
image, không được ghi vào runtime `.env`.

`PROD_SSH_KNOWN_HOSTS` phải là dòng host key đã đối chiếu fingerprint qua console hoặc
kênh tin cậy. Workflow bật `StrictHostKeyChecking=yes` và không gọi `ssh-keyscan`.

Workflow cố định `VITE_API_BASE_URL` rỗng để browser gọi cùng origin. Text Homepage, SEO,
site URL, Zalo, Facebook và đường dẫn media nằm trong `client/src/content/publicHome.ts`.
Không đưa DB password, JWT hoặc deployment secret vào GitHub Variables hay build args.
Không ghi giá trị secret thật vào tài liệu hoặc repository.

Ảnh local nằm trong `client/public/images` và được đóng gói vào Docker Web image. Muốn thay
ảnh, thay file trong thư mục này, cập nhật đường dẫn/alt/focal trong source nếu cần, commit
rồi deploy để build Web image mới.

## Bootstrap VPS

1. Tạo user deploy không dùng password SSH, thêm public key vào
   `~deploy/.ssh/authorized_keys`, rồi cấp quyền Docker. Giữ đăng nhập root hiện tại
   cho đến khi đã thử key ở một terminal khác.
2. Cài Docker Engine và Docker Compose plugin từ repository chính thức của Docker.
3. Kiểm tra swap hiện có; chỉ tạo 1 GB swap nếu chưa có và đã được chủ dự án duyệt
   theo resource policy. Bật firewall cho SSH, TCP 80/443 và UDP 443. Nếu SSH không
   dùng port 22, mở `PROD_PORT` thay cho 22 trước khi bật firewall.
4. Tạo thư mục và trao quyền cho user deploy:

   ```bash
   sudo install -d -o deploy -g deploy -m 750 /opt/teacher-hub
   ```

5. Đăng nhập GHCR trên VPS bằng classic PAT hoặc fine-grained token chỉ có quyền đọc
   package cần thiết. Không lưu token trong source hoặc `.env`:

   ```bash
   printf '%s' "$GHCR_READ_TOKEN" | docker login ghcr.io --username "$GHCR_OWNER" --password-stdin
   unset GHCR_READ_TOKEN
   ```

6. Chuyển chính xác các giá trị production hiện tại của `MYSQL_ROOT_PASSWORD`,
   `DB_PASSWORD` và `JWT_SECRET` từ VPS sang GitHub Repository Secrets. Không đổi các
   giá trị này trong lúc chuyển nguồn cấu hình, nếu không database/API hiện tại có thể
   ngừng hoạt động. Từ lần deploy tiếp theo, workflow tự sinh `/opt/teacher-hub/.env`;
   người vận hành không còn nhập hoặc sửa các biến runtime này thủ công trên VPS.

7. Tạo DNS Cloudflare: bản ghi apex trỏ tới VPS và `www` trỏ về apex. Đặt SSL/TLS mode
   `Full (strict)`. Caddy tự xin/gia hạn certificate; không copy certificate vào repo.

Hướng dẫn bootstrap bên dưới không xác nhận VPS hiện tại đã bật swap. Operator
phải kiểm tra bằng `swapon --show`; chỉ tạo swap lần đầu sau khi chủ dự án duyệt
chi phí/tác động theo resource policy ở trên:

```bash
sudo fallocate -l 1G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
```

## Server `.env`

Các biến trong `/opt/teacher-hub/.env` được giữ tối thiểu và được sinh lại từ GitHub
Repository Secrets ở mỗi lần deploy:

- Image/runtime: `GHCR_OWNER`, `IMAGE_TAG`.
- Database secrets: `MYSQL_ROOT_PASSWORD`, `DB_PASSWORD`.
- API secret: `JWT_SECRET`.
- Báo cáo Excel: `REPORT_VIETINBANK_ACCOUNT_NUMBER` chứa số tài khoản VietinBank;
  chỉ đặt trong runtime `.env`, không commit giá trị thật.
- Google runtime (khi bật V16C): `GOOGLE_DRIVE_ENABLED` và OAuth/root-folder values
  theo `docs/operations/google-drive.md`.
- Vocabulary V20 mặc định dùng `ARASAAC_ENABLED=true`; Pixabay chỉ cần
  `PIXABAY_ENABLED` và `PIXABAY_API_KEY` khi bật nguồn ảnh thật. Đường dẫn media
  `/app/data/vocabulary-media` được cố định trong Compose. Key chỉ ở runtime server;
  không đưa vào Web image.

Workflow đọc `IMAGE_TAG` cũ trên VPS và ghi tag đó vào file env mới. File `.env.next`
phải qua kiểm tra đủ key bắt buộc, giá trị bắt buộc không rỗng, boolean hợp lệ và tag
đúng định dạng trước khi được thay nguyên tử thành file active. Trước khi kiểm tra
headroom, script xóa các tag SHA API/Web cũ nhưng luôn giữ SHA đang active, rồi yêu cầu
tối thiểu 1 GiB trống và 10.000 inode trống. Script sau đó mới đổi sang full SHA mới và
giữ một snapshot env đầy đủ để rollback bằng phép `mv`. Lần bootstrap
đầu tiên có thể để tag rỗng. Database
name/user, CORS production, timezone, JWT lifetime, password policy, rate-limit và
healthcheck URL được cố định trong source hoặc Compose. Không đưa password, token, IP
hoặc JWT vào GitHub Variables, workflow log hay repository.

Server `.env` chỉ chứa runtime/deployment config và secret như image tag, CORS,
healthcheck, database và JWT. Không đặt text Homepage hoặc đường dẫn ảnh vào file này.
OAuth secret/refresh token Google chỉ nằm trong GitHub Repository Secrets và file runtime
mode `600`, không đưa vào image, build args, GitHub Variables hoặc log deploy.

## Vocabulary media V20 (IMPLEMENTED)

V20B phải cập nhật Compose bằng đúng mount sau trước khi feature được enable:

```yaml
services:
  api:
    volumes:
      - vocabulary-media:/app/data/vocabulary-media

volumes:
  vocabulary-media:
```

Đây là named volume production, không thay bằng `/tmp`, thư mục trong image hoặc
bind mount không được backup. API phải fail startup khi provider bật nhưng
`PIXABAY_API_KEY` thiếu khi Pixabay được bật, hoặc media root không writable.
ARASAAC không cần key; từng provider có thể tắt bằng config mà vocabulary set dùng
emoji/local asset vẫn hoạt động.

Theo dõi riêng dung lượng, inode và tốc độ tăng của `vocabulary-media`. Cảnh báo
trước khi filesystem đạt 80%, không tự xóa media còn được vocabulary item hoặc
assignment snapshot tham chiếu. Media ID immutable; deploy/rollback image không
được ghi đè bytes của media cũ.

Với database mới hoàn toàn, tạo admin một lần sau deploy bằng biến môi trường tạm, không
lưu `BOOTSTRAP_ADMIN_PASSWORD` trong GitHub Repository Secrets dùng cho deploy, runtime
`.env` hoặc shell history. Workflow không tự chạy bootstrap admin:

```bash
cd /opt/teacher-hub
read -r -s -p 'Admin password: ' BOOTSTRAP_ADMIN_PASSWORD
printf '\n'
export BOOTSTRAP_ADMIN_PASSWORD
docker compose --env-file .env -f docker-compose.deploy.yml run --rm \
  -e BOOTSTRAP_ADMIN_PASSWORD api node dist/db/bootstrap-admin.js
unset BOOTSTRAP_ADMIN_PASSWORD
```

## Luồng CI, deploy và rollback

Mỗi push và pull request chạy bốn job độc lập: `quality` (`check:ci`, không cần MySQL),
`integration`, `e2e-smoke` và `schedule-regression`. Smoke giữ các luồng public Homepage,
đăng nhập, API/UI cơ bản, mobile navigation và vocabulary media. Schedule regression
giữ rollover nửa đêm, Calendar mobile và một flow schedule/backend thật trên database
`teacher_hub_test`; artifact chỉ upload khi lỗi và job có timeout 20 phút. Push mới trên
cùng branch hủy CI cũ chưa hoàn tất. Full integration + toàn bộ E2E chạy qua workflow
`full-regression` khi chọn **Run workflow** trong GitHub Actions; không chạy tự động
hằng đêm. Workflow này không deploy.

Push vào `main` chỉ gọi production deploy sau khi cả bốn job bắt buộc thành công:

1. `publish-api` và `publish-web` build song song trên runner, push tag full commit SHA
   và tag tiện ích `latest`;
2. job `deploy` chờ đủ hai image;
3. đọc `IMAGE_TAG` cũ, sinh runtime env từ Repository Secrets, copy thành `.env.next`,
   xác thực nội dung, đặt mode `600` rồi `mv` nguyên tử thành `/opt/teacher-hub/.env`;
   đồng thời copy Compose, Caddyfile và hai deployment script qua SSH host key đã pin;
4. gọi script với SHA mới; script khóa deploy bằng `flock`, dọn các application SHA cũ
   nhưng giữ image active, kiểm tra disk/inode headroom, snapshot env, ghi SHA mới an
   toàn và khởi động/kiểm tra MySQL;
5. tạo và kiểm tra backup nén trước migration; sau khi V20 enable, recovery set
   bắt buộc gồm cả MySQL và `vocabulary-media` theo tài liệu backup;
6. pull đúng SHA, chạy `node dist/db/migrate.js` đúng một lần bằng one-off API container;
7. restart stack, kiểm tra health container và public `/ready`;
8. sau readiness, giữ backup pre-migration 14 ngày; với mỗi repository API/Web chỉ giữ
   SHA vừa deploy và SHA active ngay trước đó để rollback, rồi prune dangling image.

Image retention chỉ xử lý chính xác hai repository
`ghcr.io/<GHCR_OWNER>/teacher-hub-api` và `teacher-hub-web`, chỉ xóa tag full SHA và
không dùng `--force`. Tag `latest`, image hệ thống khác và image còn được container tham
chiếu không bị cưỡng chế xóa. Nếu maintenance sau readiness lỗi, workflow trả exit code
`4` nhưng không rollback ứng dụng đang healthy; operator phải xử lý cleanup rồi chạy lại.

Nếu có lỗi sau khi đổi tag, script khôi phục nguyên snapshot env rồi đưa API/Web về full
SHA trước đó và trả exit code khác 0. Nếu thao tác ghi file tạm thất bại (kể cả
`ENOSPC`), file env active không bị thay bằng nội dung dở dang. Script không tự rollback
database hoặc media. Nếu migration không tương thích ngược,
dừng ghi, restore cả recovery set vào database/volume cô lập, kiểm tra rồi mới chuyển
dịch vụ theo quy trình phục hồi. Lần deploy đầu không có image cũ nên không thể rollback
image tự động.

## Kiểm tra vận hành

```bash
cd /opt/teacher-hub
docker compose --env-file .env -f docker-compose.deploy.yml ps
docker compose --env-file .env -f docker-compose.deploy.yml logs --tail=100 api web caddy
docker image ls "ghcr.io/$(awk -F= '$1 == \"GHCR_OWNER\" { print $2; exit }' .env)/teacher-hub-api"
docker image ls "ghcr.io/$(awk -F= '$1 == \"GHCR_OWNER\" { print $2; exit }' .env)/teacher-hub-web"
curl --fail https://tienganhcovy.com/ready
```

Nếu deploy dừng vì thiếu dung lượng, không sửa hoặc tạo lại `.env` trước khi giải phóng
dung lượng. Kiểm tra `df -h /opt/teacher-hub`, `df -i /opt/teacher-hub` và
`docker system df`; chỉ xóa log/backup/image đã xác nhận không còn cần. Sau đó xác thực
`.env` còn đủ key bằng `./deploy-env.sh validate .env`, kiểm tra stack hiện tại rồi mới
chạy lại workflow. Nếu VPS đã kín đến mức không copy được deployment script mới, cần
operator xóa thủ công image SHA cũ không còn được container dùng một lần; các deploy sau
đó sẽ tự giữ tối đa hai thế hệ application image. Không in nội dung `.env` ra log hoặc
terminal chia sẻ.

Chỉ Caddy publish TCP 80/443 và UDP 443. MySQL, API và Web không publish port. Nginx
trong Web tiếp tục là điểm proxy duy nhất cho `/api`, `/health` và `/ready`; Caddy chỉ
terminate HTTPS và chuyển toàn bộ request sang Web nên không tạo vòng proxy.

## PDF VPS integration

See [private Gateway activation](pdf-vps-activation.md) for IAM + HMAC, host-owned secret configuration, outbound API networking, the one-minute systemd recovery timer and rollback. PDF stays disabled until the existing-issuer and live recovery gates pass; no new VPS container or resource increase is introduced.
