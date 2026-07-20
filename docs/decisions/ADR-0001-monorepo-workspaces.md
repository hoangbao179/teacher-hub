# ADR-0001: npm workspaces monorepo

## Decision

Dùng một repository gồm `client`, `server`, `shared`.

## Rationale

Dễ giao cho Cursor/Codex, contract không bị drift, một CI và một bộ docs. Runtime vẫn tách web/api container để deploy gọn.
