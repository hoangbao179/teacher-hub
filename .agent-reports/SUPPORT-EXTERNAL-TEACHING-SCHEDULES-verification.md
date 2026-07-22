# SUPPORT-EXTERNAL-TEACHING-SCHEDULES Verification

## Acceptance

Đạt toàn bộ acceptance: lịch trường lặp, trung tâm một lần, lịch cá nhân, Calendar/Dashboard, conflict và không phát sinh dữ liệu lớp/học phí.

## Typecheck/lint

`npm run check:full` — typecheck và lint PASS.

## Unit/integration/E2E

- Server unit và 31 integration tests PASS; case mới đối chiếu trực tiếp số row student/enrollment/lesson/attendance/tuition.
- Toàn bộ E2E PASS; schedule UI được kiểm tra ở mobile/desktop và badge Dashboard không có lesson action.

## Kiểm tra UI thủ công

Playwright kiểm tra không horizontal scroll tại các viewport 360–430 px, tablet và desktop.

## Tài liệu

Product spec, domain dictionary, scheduling docs, OpenAPI và status đã đồng bộ.

## Final verdict

PASS
