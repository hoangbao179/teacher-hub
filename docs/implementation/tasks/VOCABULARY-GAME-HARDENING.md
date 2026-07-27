# VOCABULARY-GAME-HARDENING

## Phạm vi

Rà soát và sửa compatibility/publish, queue/review/scoring, session recovery,
wizard/result/audio và incremental Google Sheet sync của Vocabulary Assignment/Game.

## Quyết định

- Compatibility matrix thuộc `@teacher/shared`; backend dry-run generator trước publish.
- Tối đa 8 activity; question order chỉ shuffle khi assignment yêu cầu.
- Scoring và adaptive review dùng vocabulary item làm đơn vị; review có weight 0.
- Self-assessment được persist bằng migration `0023`.
- Vocabulary outbox chỉ upsert row attempt, không full-render workbook.

## Verification

Chỉ chạy shared build, typecheck/lint, targeted unit/MySQL integration và student
Playwright flow chuyên biệt; không chạy full repository gate hoặc full Playwright suite
theo yêu cầu task.
