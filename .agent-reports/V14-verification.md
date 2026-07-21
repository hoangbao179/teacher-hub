# V14 Verification

## Acceptance

PASS — các outcome trong acceptance V14 đã được kiểm tra bằng unit, integration
và E2E; không thay đổi business rule học phí/PAID boundary.

## Migration/backfill

PASS — migration `0008` được áp dụng trên MySQL; schema snapshot, active-period,
cancellation và makeup constraints tồn tại; dữ liệu cũ được backfill không xóa
lesson/attendance/tuition.

## Historical snapshots

PASS — lesson/participant cũ giữ tên snapshot sau rename; lesson mới nhận tên mới.

## Class schedule integrity

PASS — metadata-only giữ schedule ID; PATCH tạo version, DELETE end-date;
SKIPPED/RESCHEDULED/source draft cũ giữ liên kết và không duplicate occurrence.

## Pause/resume

PASS — class/enrollment project theo active period, không sinh lịch trong pause,
late entry trước pause vẫn đúng; pause ngay ngày bắt đầu cũng được kiểm tra.

## Cancel and makeup

PASS — cancellation metadata/audit + SKIPPED atomic; subset nhiều lesson hợp lệ,
duplicate enrollment bị chặn; PRESENT/ABSENT/FREE và generic makeup đúng.

## Temporary reschedule

PASS — preview không ghi DB; apply atomic bằng exceptions, xác nhận conflict,
từ chối occurrence đã ghi nhận và tự trở lại pattern sau range.

## Conflict warnings

PASS — preflight dùng chung và warning được kiểm tra ở manual lesson, occurrence,
busy slot, reschedule và Calendar.

## UI

PASS — E2E 360/390/430 px, flow nghỉ → makeup subset, temporary reschedule,
pause/resume, login helper, teacher intro và footer nguyên văn.

## Typecheck/lint

- `npm -w server run typecheck` — PASS.
- `npm -w client run typecheck` — PASS.
- `npm -w client run lint` — PASS.

## Unit/integration/E2E

- `npm -w server run test` — PASS, 45 passed/24 integration skipped.
- `npm run test:integration` — PASS, 24/24.
- `npm run check:full` — PASS trên lần chạy cuối, gồm build, unit, integration và toàn bộ E2E.

## OpenAPI consistency

`npm run check:repo` — PASS, 56 Express routes khớp OpenAPI.

## Package hygiene

- `npm run package:source` — PASS, SHA-256 `18b2fdaef279d2a98316e548c8aa4979c103239ccfb3058250440e935b9ec96e`.
- `npm run check:package` — PASS, 411 entries.
- `docker compose build` — không chạy vì Docker CLI/Desktop không khả dụng.

## Final verdict

PASS
