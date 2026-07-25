# V16E-TUITION-SHEET-AND-PARENT-SHARING

Trạng thái: **PLANNED**

## Goal

Đồng bộ trình bày cycle tám buổi sang Sheet, chia sẻ parent Viewer và cung cấp
trạng thái/retry/resync an toàn cho admin.

## In scope

- Đồng bộ `Học phí` và summary từ canonical MySQL, bao gồm cycle xuyên enrollment.
- Trình bày billable count, nghỉ, tổng lịch, snapshot price, status, paid date/method.
- Restricted-by-default, share đúng parent làm Viewer; revoke/change có audit.
- Admin status, last sync, lỗi đã diễn giải, retry/resync; technical error không lộ cho parent.
- Transactional outbox cho tuition/payment/share mutation và idempotent Google worker.
- Fake provider tests, rate-limit/backoff và manual production smoke.

## Out of scope

- Không payment gateway, partial payment, parent/student account hoặc two-way sync.
- Không công khai Sheet bằng “anyone with link” mặc định.
- Không đưa payment note nội bộ/bank data không cần thiết lên Sheet.

## Required reading

- `docs/features/student-parent-tracking.md`
- `docs/features/tuition-cycles.md`
- ADR tuition snapshot, late-entry và effective-dated tuition.
- Contracts `tuition.ts`, security/deployment docs.

## Acceptance criteria

- Upsert cycle theo hidden mapping, replay không tạo dòng trùng.
- `PAID` và item đã khóa không bị resync sửa thành dữ liệu suy đoán.
- Parent chỉ xem đúng Sheet của student, quyền mặc định Viewer/Restricted.
- Google failure không rollback payment đã commit hoặc tạo payment/import lần hai.
- Admin UI responsive 360–430 px, có retry/resync thật và không lộ secret/raw error.

## Files likely affected khi triển khai

Migration/outbox, tuition service/repository/contracts, Google worker/provider,
Student Detail/admin sync UI, sharing API và tests.

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

Manual production smoke phải dùng student test, xác minh quyền Viewer bằng account
khác và thu hồi quyền sau test.
