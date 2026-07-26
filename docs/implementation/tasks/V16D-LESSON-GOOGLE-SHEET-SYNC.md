# V16D-LESSON-GOOGLE-SHEET-SYNC

Trạng thái: **IMPLEMENTED — VERIFICATION PENDING**

## Goal

Chuẩn hóa general/student-specific comments, tối ưu điểm danh nhanh và đồng bộ
lesson một chiều sang Sheet qua transactional outbox.

## In scope

- Field/contract rõ cho `generalComment`; giữ student-specific note theo participant.
- UI mặc định có mặt, `Tất cả có mặt`, `Tất cả nghỉ`, chỉnh ngoại lệ và note riêng thu gọn.
- Action `Dùng làm nhận xét chung cho cả lớp` với confirmation và quy tắc không ghi đè.
- Student `ABSENT` vẫn nhận ngày/content/homework nhưng không mặc định nhận general comment.
- Outbox ghi cùng transaction lesson; worker sync sau commit, retry/idempotency/upsert row mapping.
- Lên lớp/chuyển class cập nhật metadata và dòng mới nhưng giữ spreadsheet ID/URL.
- Fake Google provider, failure/retry/resync tests và privacy isolation cho group lesson.

## Out of scope

- Không sync tuition hoặc chia sẻ parent.
- Không đồng bộ từ Sheet về DB.
- Không tự biến note import thành general comment.

## Required reading

- `docs/features/student-parent-tracking.md`
- `docs/features/lesson-recording.md`
- ADR participant snapshot, historical eligibility và late-entry ordering.
- Contracts `lessons.ts` và lesson service/repository hiện hành.

## Acceptance criteria

- Một mutation lesson tạo đúng outbox event trong cùng transaction; rollback không để event mồ côi.
- Retry cùng event không tạo duplicate row hoặc apply lesson lần hai.
- Sheet mỗi student chỉ nhận dữ liệu được phép của student đó.
- Promotion/transfer không tạo Sheet mới.
- UI nhanh, responsive và không dùng label “Áp dụng cho tất cả”.

## Files likely affected khi triển khai

Migration mới, lesson/shared contracts, lesson UI/API/service/repository, outbox worker,
Google provider và tests.

## Verification commands khi triển khai

```bash
npm run build:shared
npm -w server run typecheck
npm -w server run test
npm run test:integration
npm -w client run typecheck
npm -w client run lint
npm run test:e2e
npm run check:full
```

## Implementation 26/07/2026

- Migration `0014` thêm `general_comment` và outbox có logical-key/revision/lock/retry.
- Lesson mutation ghi event trong transaction; worker đọc canonical snapshot sau
  commit và chỉ cập nhật lesson row, `Tổng quan`, `_TeacherHub`.
- Student Detail có status/resync; lesson wizard có bulk attendance, Undo, nhận xét
  riêng thu gọn và action chuyển thành nhận xét chung.
- Không sync tab `Học phí`, không tự share và không đọc ngược Google.
- Chưa đổi trạng thái thành PASS: phải hoàn tất toàn bộ automated gate và manual
  Google smoke theo acceptance.
