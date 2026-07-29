# V16B-LEGACY-IMPORT-HARDENING Verification

## Acceptance

Bốn fixture A–D đã có regression tương ứng; long-history đạt 7 PAID, 2 FREE, current 3/8 và một nhóm 6 tuition-only.

## Typecheck/lint

`npm run build:shared`, server/client typecheck và client lint: PASS.

## Unit/integration/E2E

- `npm -w server run test`: PASS.
- `npm run test:integration`: PASS, gồm đối chiếu preview member với database member.
- `npm -w client run test:e2e:legacy-import`: PASS tại 360–430 px.

## Kiểm tra UI thủ công

Raw JSON nằm trong “Xem chi tiết”; badge dùng tiếng Việt; decision được gom theo nhóm.

## Tài liệu

Task, acceptance, OpenAPI và status được cập nhật trong task này.

## Final verdict

PASS
