# V17-PRODUCTION-CICD Implementation

## Phạm vi

CI GitHub, build/publish GHCR, deploy SSH tới VPS, Compose production, Caddy, backup,
migration, readiness, image rollback và tài liệu vận hành.

## Vấn đề đã sửa

- Đồng bộ database test của CI và giữ đúng Node/npm từ package root.
- Build API/Web trên runner, cache Buildx, publish full SHA + `latest`, deploy chỉ full SHA.
- VPS chỉ pull image; chỉ Caddy publish 80/443; MySQL/API/Web nằm sau Docker network.
- Backup trước migration, migrate một lần, health check và rollback image có `flock`.
- Loại public phone variables cũ, đồng bộ đủ public media args và Facebook mặc định.

## File chính đã đổi

`.github/workflows/`, Dockerfiles/Compose, `Caddyfile`, `scripts/deploy-production.sh`,
env example và tài liệu deployment/V17.

## API/schema thay đổi

Không.

## Kiểm tra đã chạy

YAML parser, actionlint, shellcheck, Compose assertions, hai Docker image build,
`npm run check:full`, `npm run check:repo`, diff/repository audit.

## Điểm còn lại

GitHub Secrets/Variables, DNS, GHCR login và `/opt/teacher-hub/.env` phải được operator
cấu hình trên hạ tầng thật trước lần deploy đầu.

## Commit

Commit V17 được ghi trong final response.
