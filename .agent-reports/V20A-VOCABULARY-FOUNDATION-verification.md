# V20A Vocabulary Foundation Verification

## Acceptance

Đủ shared DTO, migration `0016`, 20 topic, protected API, audit/rollback và UI
list/new/detail. Không có runtime V20B–V20E.

## Typecheck/lint

- `npm run typecheck`: PASS.
- `npm run lint`: PASS.

## Unit/integration/E2E

- `npm run test`: PASS (server 73 pass, 58 integration skip; client 30 pass).
- `npm run test:integration`: PASS (58/58).
- `npm -w client run test:e2e:vocabulary`: PASS.
- `npm -w client run test:e2e:learning`: PASS.
- `npm run check:full`: PASS, gồm full repository E2E.

## Kiểm tra UI thủ công

Đã xem list/new/detail ở 390×844 và 1440×900; không tràn ngang, sticky action
không che bottom nav, mobile giữ đúng 5 mục.

## Tài liệu

OpenAPI đánh dấu V20A runtime và giữ V20B–V20E là `PLANNED`; status/task/acceptance
đã đồng bộ.

## Final verdict

PASS
