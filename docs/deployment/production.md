# Production deployment

Production chạy trên một VPS Ubuntu bằng bốn container: Caddy → Web/Nginx → API →
MySQL. GitHub Actions kiểm tra source, build hai image, đẩy lên GHCR và SSH vào VPS để
chạy script triển khai. VPS không cần source, Node.js hoặc npm; chỉ nhận
`docker-compose.deploy.yml`, `Caddyfile` và `deploy-production.sh`.

## GitHub configuration

Tạo environment `production`. Tạo đúng các repository/environment secrets sau:

- `PROD_HOST`
- `PROD_PORT`
- `PROD_USER`
- `PROD_SSH_PRIVATE_KEY`
- `PROD_SSH_KNOWN_HOSTS`

`PROD_SSH_KNOWN_HOSTS` phải là dòng host key đã đối chiếu fingerprint qua console hoặc
kênh tin cậy. Workflow bật `StrictHostKeyChecking=yes` và không gọi `ssh-keyscan`.

Tạo repository variable `GHCR_OWNER` bằng tên owner GitHub viết thường và các biến
public sau. Đây là dữ liệu được nhúng vào bundle trình duyệt, tuyệt đối không đặt secret:

- `VITE_PUBLIC_SITE_URL`
- `VITE_PUBLIC_TEACHER_NAME`
- `VITE_PUBLIC_BRAND_NAME`
- `VITE_PUBLIC_HERO_HEADING`
- `VITE_PUBLIC_DESCRIPTION`
- `VITE_PUBLIC_INTRODUCTION`
- `VITE_PUBLIC_ZALO_URL`
- `VITE_PUBLIC_HERO_MOBILE_URL`
- `VITE_PUBLIC_HERO_DESKTOP_URL`
- `VITE_PUBLIC_HERO_ALT_MOBILE_URL`
- `VITE_PUBLIC_HERO_ALT_DESKTOP_URL`
- `VITE_PUBLIC_HERO_SECONDARY_MOBILE_URL`
- `VITE_PUBLIC_HERO_SECONDARY_DESKTOP_URL`
- `VITE_PUBLIC_TEACHER_PHOTO_URL`
- `VITE_PUBLIC_TEACHER_PHOTO_ALT`
- `VITE_PUBLIC_TEACHER_PHOTO_FOCAL_POSITION`
- `VITE_PUBLIC_OG_IMAGE_URL`
- `VITE_PUBLIC_VIDEOS_JSON`
- `VITE_PUBLIC_TESTIMONIALS_JSON`
- `VITE_PUBLIC_SEO_TITLE`
- `VITE_PUBLIC_SEO_DESCRIPTION`

Workflow cố định `VITE_API_BASE_URL` rỗng để browser gọi cùng origin và cố định
`VITE_PUBLIC_CONTENT_MODE=production`. Facebook mặc định là
`https://www.facebook.com/uyenvy.le.12`; không có biến phone hoặc Facebook cũ.

## Bootstrap VPS

1. Tạo user deploy không dùng password SSH, thêm public key vào
   `/home/deploy/.ssh/authorized_keys`, rồi cấp quyền Docker. Giữ đăng nhập root hiện tại
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

6. Copy `.env.deploy.example` thành `/opt/teacher-hub/.env`, đặt mode `600` và điền cấu
   hình thật. File này chỉ tồn tại trên VPS:

   ```bash
   install -m 600 .env.deploy.example /opt/teacher-hub/.env
   ```

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

Các biến trong `/opt/teacher-hub/.env`:

- Image/runtime: `GHCR_OWNER`, `IMAGE_TAG`, `CORS_ORIGIN`, `HEALTHCHECK_URL`.
- Database: `MYSQL_ROOT_PASSWORD`, `DB_NAME`, `DB_USER`, `DB_PASSWORD`.
- API: `JWT_SECRET`, `JWT_EXPIRES_IN`, `ADMIN_PASSWORD_MIN_LENGTH`,
  `LOGIN_RATE_LIMIT_WINDOW_SECONDS`, `LOGIN_RATE_LIMIT_MAX_FAILURES`.

`CORS_ORIGIN` phải là `https://tienganhcovy.com`. `IMAGE_TAG` để rỗng ở bootstrap đầu
tiên; workflow sẽ ghi full commit SHA trước khi Compose chạy. `HEALTHCHECK_URL` có thể để
rỗng để dùng `https://tienganhcovy.com/ready`. Không đưa password, token, IP hoặc JWT vào
GitHub Variables, workflow log hay repository.

Với database mới hoàn toàn, tạo admin một lần sau deploy bằng biến môi trường tạm, không
lưu password bootstrap trong `.env` hoặc shell history:

```bash
cd /opt/teacher-hub
read -r -p 'Admin username: ' BOOTSTRAP_ADMIN_USERNAME
read -r -s -p 'Admin password: ' BOOTSTRAP_ADMIN_PASSWORD
printf '\n'
export BOOTSTRAP_ADMIN_USERNAME BOOTSTRAP_ADMIN_PASSWORD
export BOOTSTRAP_ADMIN_DISPLAY_NAME='Cô Vy'
docker compose --env-file .env -f docker-compose.deploy.yml run --rm \
  -e BOOTSTRAP_ADMIN_USERNAME -e BOOTSTRAP_ADMIN_PASSWORD \
  -e BOOTSTRAP_ADMIN_DISPLAY_NAME api node dist/db/bootstrap-admin.js
unset BOOTSTRAP_ADMIN_USERNAME BOOTSTRAP_ADMIN_PASSWORD BOOTSTRAP_ADMIN_DISPLAY_NAME
```

## Luồng deploy và rollback

Push vào `main` hoặc chạy `workflow_dispatch` sẽ:

1. chạy `npm ci` và `npm run check:full` với MySQL test có tên thống nhất;
2. build API/Web trên runner, push tag full commit SHA và tag tiện ích `latest`;
3. copy ba deployment file vào `/opt/teacher-hub` qua SSH host key đã pin;
4. khóa deploy bằng `flock`, ghi SHA mới an toàn, khởi động/kiểm tra MySQL;
5. tạo và kiểm tra backup nén trước migration;
6. pull đúng SHA, chạy `node dist/db/migrate.js` đúng một lần bằng one-off API container;
7. restart stack, kiểm tra health container và public `/ready`;
8. giữ backup pre-migration 14 ngày và prune dangling image sau khi thành công.

Nếu có lỗi sau khi đổi tag, script đưa API/Web về full SHA trước đó và trả exit code khác
0. Script không tự rollback database. Nếu migration không tương thích ngược, dừng ghi,
restore backup vào database cô lập, kiểm tra rồi mới chuyển dịch vụ theo quy trình phục
hồi. Lần deploy đầu không có image cũ nên không thể rollback image tự động.

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
