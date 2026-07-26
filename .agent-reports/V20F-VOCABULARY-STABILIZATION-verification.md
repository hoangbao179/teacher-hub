# V20F Verification

## Acceptance

Local acceptance về wizard, media fallback, game/scoring, per-item analytics, kết quả và fake Google sync đã đạt.
Working tree tiếp quản ban đầu có 46 modified + 2 migration untracked; không có file
public-learning/V18A cảnh báo trong diff thực tế. Bốn shared contract mixed-EOL đã được
đưa về LF mà không đổi semantic.

## Typecheck/lint

- `npm run typecheck`: PASS
- `npm run lint`: PASS

## Unit/integration/E2E

- `npm run test`: PASS — server 106 pass/69 skip; client và media recovery smoke PASS.
- 69 test bị skip trong server unit gồm integration DB/auth; cùng các test đó chạy với
  `RUN_MYSQL_INTEGRATION=1` qua command integration bên dưới.
- `npm run test:integration`: PASS 69/69, skipped 0.
- Targeted assignment/game/media/results E2E: PASS.
- `npm run build`: PASS.
- `npm run check:repo`: PASS, 107 routes khớp OpenAPI.
- `npm run test:e2e`: PASS sau 416 giây.
- `npm run check:full`: PASS.

## Kiểm tra UI thủ công

Ảnh tại `.agent-reports/V20F-VOCABULARY-STABILIZATION/` bao phủ 360, 390 và 1440 px,
gồm wizard, picker/bulk, các mechanic, result, teacher detail và Google sync status.
Pixabay fake-enabled/disabled đều PASS; live smoke không chạy vì local `.env` không có key.
Fake Google integration xác nhận một vocabulary row idempotent; Google thật không chạy
vì không có credential test.

## Tài liệu

Task, acceptance, feature, OpenAPI, security, deployment, backup/restore, status và roadmap đã cập nhật.

## Final verdict

PASS
