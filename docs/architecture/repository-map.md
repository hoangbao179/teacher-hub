# Repository map

```text
teacher-class-hub/
├── AGENTS.md                 # Codex/AI guardrail
├── .cursor/rules/            # Cursor project rules
├── client/                   # React/Vite/MUI
│   └── src/
│       ├── api/              # tất cả API calls
│       ├── auth/             # auth context
│       ├── components/       # shared UI
│       ├── layout/           # admin mobile shell
│       └── pages/            # route pages
├── server/                   # Express/MySQL
│   └── src/
│       ├── controllers/
│       ├── services/
│       ├── repositories/
│       ├── db/migrations/
│       ├── middleware/
│       └── container.ts
├── shared/                   # DTO/contracts/enums
├── docs/
│   ├── product-spec/
│   ├── features/
│   ├── architecture/
│   ├── decisions/
│   ├── implementation/
│   ├── api/
│   └── wireframes/
└── deploy/
```

Khi thêm feature, ưu tiên vertical slice nhưng vẫn giữ boundary controller/service/repository và shared contract.
