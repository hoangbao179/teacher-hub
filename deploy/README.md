# Deploy

Production dùng image GHCR và các file ở root:

- `docker-compose.deploy.yml`
- `Caddyfile`
- `.env.deploy.example`
- `scripts/deploy-production.sh`
- `.github/workflows/deploy.yml`

VPS không build source và không cài Node.js/npm. Hướng dẫn bootstrap, GitHub
Secrets/Variables, server `.env`, backup, health check và rollback nằm tại
`docs/deployment/production.md`.

`docker-compose.prod.yml` và `deploy/env.example` được giữ cho quy trình build production
cục bộ cũ; không phải source of truth của VPS/GitHub Actions.
