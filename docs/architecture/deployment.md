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

Mỗi deploy tạo backup trước khi chạy forward-only migration. Migration chạy đúng một lần
trong one-off API container. Rollback tự động chỉ đưa image về SHA trước, không rollback
database. Chi tiết vận hành ở `docs/deployment/production.md` và
`docs/deployment/backup-and-restore.md`.
