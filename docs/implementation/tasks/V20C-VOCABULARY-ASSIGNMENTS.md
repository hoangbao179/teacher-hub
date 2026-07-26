# V20C — Vocabulary assignments

## Trạng thái

**PLANNED**

## Phạm vi

- Tạo assignment `DRAFT -> PUBLISHED -> CLOSED`, item/activity/recipient snapshot
  và state guard.
- Publish trong một transaction; media phải sẵn sàng trước transaction.
- Implement audience CLASS, SELECTED_STUDENTS và OPEN_LINK đúng snapshot rule.
- Sinh publicCode, recipient token hash, revoke/duplicate/close/due-date behavior.
- Xây teacher wizard responsive, preview, link/QR và draft review boundary.
- Snapshot illustration: emoji/none copy; public asset được materialize thành
  stored media; published snapshot không phụ thuộc release sau.

## Ngoài phạm vi

- Public attempt/gameplay, aggregation và review-assignment generation.

## Dependency và verification

Phụ thuộc V20A–V20B. Chạy concurrency/integration/state-machine tests, wizard E2E
targeted và full gate theo
[acceptance V20C](../acceptance/V20C-VOCABULARY-ASSIGNMENTS.md).
