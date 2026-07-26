# Deployment architecture

Production mục tiêu là một VPS 1 core, 1.5 GB RAM, 15 GB SSD. GitHub Actions build API
và Web, lưu image trong GHCR rồi triển khai full commit SHA; VPS chỉ chạy Docker Engine
và Compose.

- `caddy`: edge TLS/HTTP3, publish 80/443, khoảng 96 MB.
- `web`: Nginx static và proxy `/api`, `/health`, `/ready`, khoảng 96 MB.
- `api`: một Node process, heap 256 MB, container khoảng 384 MB, DB pool 5.
- `mysql`: MySQL 8, buffer pool 192 MB, tối đa 30 connection, khoảng 512 MB.

MySQL/API/Web dùng network backend nội bộ; Web/Caddy dùng network edge. Chỉ Caddy có
host ports. Volume có tên giữ dữ liệu MySQL và trạng thái certificate/config Caddy. Không
thêm Redis, queue, worker hoặc API replica trong V1.

Vocabulary Media Editor V20B dùng named volume
`vocabulary-media:/app/data/vocabulary-media` gắn vào API. Binary ảnh đã chọn
không lưu trong MySQL hoặc writable layer tạm của container. Media được phục vụ
same-origin qua `/api/public/vocabulary-media/:mediaId`; volume phải được đưa vào
capacity monitoring, backup/restore và restore drill. Nếu Pixabay tắt hoặc thiếu
key thì API vẫn khởi động, còn editor tiếp tục dùng emoji/public asset.

Mỗi deploy tạo backup trước khi chạy forward-only migration. Khi V20 media được
enable, backup pre-deploy phải tạo một recovery set nhất quán gồm MySQL dump,
archive media volume và manifest/checksum trong lúc khóa mutation media ngắn.
Migration chạy đúng một lần trong one-off API container. Rollback tự động chỉ đưa
image về SHA trước, không rollback database/media. Chi tiết vận hành ở
`docs/deployment/production.md` và `docs/deployment/backup-and-restore.md`.

V20E bổ sung `npm run backup:recovery-set -- <new-directory>` để khóa mutation,
tạo SQL dump + `vocabulary-media.tar` và manifest SHA-256; dùng
`npm run verify:recovery-set -- <directory>` trước restore. API kiểm tra quyền
read/write của media root lúc startup và provider có thể tắt mà không làm hỏng
emoji/public asset. Các result route là protected `/api`; `/play/*` và
`/api/public/*` giữ nguyên proxy/noindex/no-referrer đã harden.
