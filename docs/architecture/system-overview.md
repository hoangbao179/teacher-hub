# System overview

## Mục tiêu

Một monorepo nhỏ, dễ giao cho Cursor/Codex, chạy tốt trên VPS hạn chế tài nguyên.

## Runtime

```text
Browser
  ├─ Public Home (/)
  └─ Admin SPA (/admin/*)
          │ /api
          ▼
Express API
  ├─ controller
  ├─ service (business/transaction)
  ├─ repository (SQL)
  └─ MySQL 8
```

## Workspace boundary

- `shared`: contract compile-time; không chứa DB/UI.
- `server`: authoritative business logic.
- `client`: UX; không tự tính học phí authoritative.
- `docs`: specification authoritative.

## Deployment

Một repo nhưng hai image:

- Nginx static web, proxy `/api`.
- Node API.
- MySQL.

Không cần tách git repository, không cần microservice.
