# V17-PRODUCTION-CICD Acceptance

- CI chạy push/PR bằng Node 24.18.0, npm 12.0.1, `npm ci`, `check:full`; DB test dùng
  cùng tên và PR không deploy.
- Production workflow chạy trên main/manual, serialize production, verify trước publish,
  dùng Buildx cache và push API/Web bằng full SHA cùng `latest`.
- Deploy luôn nhận full SHA, dùng năm SSH secrets, host key đã pin và không log secret.
- Compose deploy không có `build`, chỉ Caddy publish 80/443, có resource limits,
  healthchecks, internal network, named volumes, timezone và log rotation.
- Caddy redirect `www`, tự quản lý HTTPS và proxy một chiều tới Web/Nginx.
- Script khóa deploy, backup hợp lệ trước migration, migrate một lần, health check,
  retention/prune khi thành công và rollback image (không rollback DB) khi lỗi.
- Server env example không chứa secret thật; production `.env` chỉ nằm trên VPS.
- Public Vite variables khớp validator/source; không còn phone variables; Facebook dùng
  `https://www.facebook.com/uyenvy.le.12`.
- Tài liệu liệt kê chính xác GitHub Secrets, Variables, server env và bootstrap VPS.
- Docker/YAML/shell/full/repo gates đạt PASS trước commit.
