# Deploy

Repository build thành hai image `api` và `web`, dùng chung MySQL. Đây vẫn là một monorepo và một compose stack.

```bash
cp deploy/env.example .env
# cập nhật secret
docker compose -f docker-compose.prod.yml build
docker compose -f docker-compose.prod.yml up -d mysql
docker compose -f docker-compose.prod.yml run --rm api node dist/db/migrate.js
docker compose -f docker-compose.prod.yml run --rm api node dist/db/bootstrap-admin.js
docker compose -f docker-compose.prod.yml up -d
```

Với VPS nhỏ, giữ `DB_CONNECTION_LIMIT=5`, MySQL buffer 256MB và không thêm worker/polling nếu chưa có nhu cầu.
