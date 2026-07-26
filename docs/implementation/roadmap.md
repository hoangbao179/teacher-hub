# Implementation roadmap

- M1.1: ổn định kiến trúc, auth, ràng buộc dữ liệu, audit và verification trước M2.
- M2A: PASS — participant snapshot, effective-dated tuition domain and contracts.
- M2B: PASS — transactional lesson API.
- M2C: PASS — mobile lesson wizard and Playwright flows.
- M3: PASS — late-entry recalculation theo ngày học, tôn trọng ranh giới `PAID`.
- M4A: PASS — tuition query/detail/summary, transactional payment and incomplete cycles.
- M4B: PASS — mobile tuition list/detail/full-payment management.
- M5A: PASS — deterministic projections, exceptions, busy slots, conflicts and reconciliation API.
- M5B: PASS — real dashboard, reconciliation, weekly calendar, busy and makeup mobile flows.
- M6A: PASS — public marketing Homepage, SEO, contact actions, lazy media and route splitting.
- M6B: PASS — canonical per-student Excel export, audit and browser download.
- M6C: PASS — system-wide mobile/accessibility/performance polish and UI regression.
- M6D: PASS — production readiness and release-candidate preparation.
- V1.1 (V11A–V11E): PASS — Cô Vy branding, auth/session and mobile navigation polish.
- V12A: PASS — public Homepage content, programs, verified testimonial policy and contact priority; phần hero chuyển cảnh đã được loại bỏ sau đó.
- V12B: PASS — Login/Admin visual polish with preserved server-authoritative behavior.
- V12C: PASS — centralized password policy, audited reset, configurable limiter/countdown and strict Vite port.
- V12D: PASS — synchronized documentation and real-app V2 visual references.
- V12E: PASS — full regression, responsive acceptance and controlled source-package release gate.
- V16A: PASS — preview/audit legacy Excel theo student; không ghi database.
- V16B: PASS — apply legacy atomic vào MySQL, lesson matching, attendance riêng, cycle theo student qua enrollment và idempotency/audit; không gọi Google.
- V16C: IMPLEMENTED, MANUAL SMOKE PENDING — OAuth/Drive/Sheets, template và một Google Sheet ACTIVE theo student; chưa có credential test để xác minh Google thật.
- V16D: IMPLEMENTED, VERIFICATION PENDING — quick attendance, general/private
  comments, transactional outbox, lesson sync và admin resync/status; chưa được
  PASS cho đến khi smoke Google thật hoàn tất.
- V16E: PLANNED — tuition sheet và parent Viewer sharing.
- V19A: PASS — Homepage một cơ sở, Google Maps tùy chọn với fallback, trust strip và responsive polish.
- V20A-VOCABULARY-FOUNDATION: PLANNED — schema/contracts, topic catalog,
  vocabulary set CRUD và Public Unit snapshot import.
- V20B-VOCABULARY-MEDIA-EDITOR: PLANNED — Pixabay, cache, hardened media storage
  và image picker/editor.
- V20C-VOCABULARY-ASSIGNMENTS: PLANNED — draft/publish snapshot, recipients,
  teacher wizard và link/QR.
- V20D-VOCABULARY-GAMES: PLANNED — public access, attempts, deterministic
  questions, idempotent answers và MVP games.
- V20E-VOCABULARY-RESULTS-RELEASE: PLANNED — results/review, accessibility,
  security, performance, deployment, backup và regression.

After V12E, the next separate activity is independent full-system review. Its
current status is **NOT STARTED**; do not treat RC status as production approval.

Chi tiết milestone cũ vẫn được lưu tại `milestones.md`; trạng thái hiện tại chỉ nằm trong `status.md`.
