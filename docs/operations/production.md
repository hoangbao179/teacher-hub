# Production deployment

Production chạy trên một VPS Ubuntu bằng bốn container: Caddy → Web/Nginx → API →
MySQL. GitHub Actions kiểm tra source, build hai image, đẩy lên GHCR, sinh runtime
`.env` từ GitHub Repository Secrets rồi SSH vào VPS để chạy script triển khai. VPS
không cần source, Node.js hoặc npm; mỗi lần deploy chỉ nhận `.env` mới,
`docker-compose.deploy.yml`, `Caddyfile` và `deploy-production.sh`.

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
3. Tạo 1 GB swap, bật firewall cho SSH, TCP 80/443 và UDP 443. Nếu SSH không dùng port
   22, mở `PROD_PORT` thay cho 22 trước khi bật firewall.
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

Ví dụ tạo swap lần đầu:

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

Workflow đọc `IMAGE_TAG` cũ trên VPS và ghi tag đó vào file env mới trước khi thay file
theo kiểu nguyên tử. Script deploy sau đó mới đổi sang full SHA mới; nếu deploy lỗi, tag
cũ vẫn sẵn sàng để rollback. Lần bootstrap đầu tiên có thể để tag rỗng. Database
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

Mỗi push và pull request chạy ba job độc lập: `quality` (`check:ci`, không cần MySQL),
`integration` và `e2e-smoke`. Smoke giữ các luồng public Homepage, đăng nhập, API/UI cơ
bản, mobile navigation và vocabulary media. Push mới trên cùng branch hủy CI cũ chưa
hoàn tất. Full integration + toàn bộ E2E vẫn chạy qua workflow `full-regression` lúc
02:30 hằng ngày theo giờ Việt Nam hoặc khi chạy thủ công; workflow này không deploy.

Push vào `main` chỉ gọi production deploy sau khi cả ba job bắt buộc thành công:

1. `publish-api` và `publish-web` build song song trên runner, push tag full commit SHA
   và tag tiện ích `latest`;
2. job `deploy` chờ đủ hai image;
3. đọc `IMAGE_TAG` cũ, sinh runtime env từ Repository Secrets, copy thành `.env.next`,
   đặt mode `600` rồi `mv` nguyên tử thành `/opt/teacher-hub/.env`; đồng thời copy ba
   deployment file qua SSH host key đã pin;
4. gọi script với SHA mới; script khóa deploy bằng `flock`, ghi SHA mới an toàn và khởi
   động/kiểm tra MySQL;
5. tạo và kiểm tra backup nén trước migration; sau khi V20 enable, recovery set
   bắt buộc gồm cả MySQL và `vocabulary-media` theo tài liệu backup;
6. pull đúng SHA, chạy `node dist/db/migrate.js` đúng một lần bằng one-off API container;
7. restart stack, kiểm tra health container và public `/ready`;
8. giữ backup pre-migration 14 ngày và prune dangling image sau khi thành công.

Nếu có lỗi sau khi đổi tag, script đưa API/Web về full SHA trước đó và trả exit code khác
0. Script không tự rollback database hoặc media. Nếu migration không tương thích ngược,
dừng ghi, restore cả recovery set vào database/volume cô lập, kiểm tra rồi mới chuyển
dịch vụ theo quy trình phục hồi. Lần deploy đầu không có image cũ nên không thể rollback
image tự động.

## Kiểm tra vận hành

```bash
cd /opt/teacher-hub
docker compose --env-file .env -f docker-compose.deploy.yml ps
docker compose --env-file .env -f docker-compose.deploy.yml logs --tail=100 api web caddy
curl --fail https://tienganhcovy.com/ready
```

Chỉ Caddy publish TCP 80/443 và UDP 443. MySQL, API và Web không publish port. Nginx
trong Web tiếp tục là điểm proxy duy nhất cho `/api`, `/health` và `/ready`; Caddy chỉ
terminate HTTPS và chuyển toàn bộ request sang Web nên không tạo vòng proxy.
