# V17-PRODUCTION-CICD

## Mục tiêu

Hoàn thiện CI/CD production cho `tienganhcovy.com`: kiểm tra source, build API/Web trên
GitHub runner, push GHCR theo full commit SHA, triển khai qua SSH đã pin host key, backup
MySQL, migrate một lần, health check và rollback image khi lỗi.

## Phạm vi

- Sửa CI MySQL/Node/npm và giữ deploy khỏi pull request.
- Thêm workflow production, Compose chỉ dùng image, Caddy và deploy script.
- Đồng bộ đúng health endpoint, migration command và public Vite build variables.
- Loại bỏ public phone variables cũ; giữ Facebook mặc định đã duyệt.
- Tài liệu hóa GitHub configuration, VPS bootstrap, server env và vận hành rollback.

## Ranh giới

- Không push remote, không ghi secret/IP cụ thể và không tự rollback database.
- Không thay đổi API, schema hoặc business rule.
- VPS không build source và không cài Node.js/npm.

## Kiểm tra bắt buộc

```bash
docker build -f Dockerfile.api .
docker build -f Dockerfile.web .
docker compose -f docker-compose.deploy.yml config
bash -n scripts/deploy-production.sh
npm run check:full
npm run check:repo
```
