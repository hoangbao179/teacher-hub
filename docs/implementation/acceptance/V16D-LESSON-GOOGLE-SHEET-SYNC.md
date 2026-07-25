# V16D-LESSON-GOOGLE-SHEET-SYNC Acceptance

Trạng thái: **PLANNED**. Không đánh dấu PASS trước khi có implementation/evidence.

## Functional acceptance

- [ ] Lesson có content, homework, general comment một lần; attendance/billable/student note riêng từng participant.
- [ ] UI mặc định có mặt, có `Tất cả có mặt`, `Tất cả nghỉ`, chỉnh ngoại lệ và note riêng thu gọn.
- [ ] Action `Dùng làm nhận xét chung cho cả lớp` sao chép/xóa trùng đúng quy tắc, không ghi đè note khác.
- [ ] `ABSENT` vẫn thấy ngày/content/homework nhưng không mặc định nhận general performance comment.
- [ ] Import note không tự thành general comment.
- [ ] Lesson create/update/correct/cancel và promotion cập nhật đúng Sheet, không đổi spreadsheet ID/URL.
- [ ] Tuition chưa được sync trong V16D.

## Transaction/idempotency

- [ ] Lesson mutation và outbox event commit/rollback cùng transaction MySQL.
- [ ] Worker chạy sau commit; replay event/upsert mapping không tạo duplicate row.
- [ ] Retry Google không complete/correct lesson hoặc recalculate tuition lần hai.
- [ ] Out-of-order event được version/order guard xử lý deterministic.

## Privacy/isolation

- [ ] Mỗi student Sheet chỉ có attendance/note riêng của student đó.
- [ ] Group lesson không rò tên, attendance, note hoặc technical error của student khác.
- [ ] Internal lesson note không được nhầm với general comment chia sẻ.

## Responsive admin UI

- [ ] Quick attendance và comment UI dùng được tại 360–430 px, sticky action không che bottom nav.
- [ ] Label rõ nghĩa, không raw enum và không có page-level horizontal scroll.

## Google failure behavior

- [ ] Timeout/429/5xx giữ lesson đã commit, outbox retry với backoff.
- [ ] Auth/permission failure chuyển trạng thái cần can thiệp, không mất event.
- [ ] Admin retry/resync không sửa canonical DB hoặc tạo lesson lần hai.

## Native MySQL integration

- [ ] Migration general comment/outbox/mapping chạy trên MySQL native.
- [ ] Integration test bao phủ transaction rollback, concurrent mutation, PAID conflict và promotion/transfer.

## Fake Google provider tests

- [ ] Fake provider xác minh row payload cho PRESENT/ABSENT/FREE, general/private comment và promotion.
- [ ] Test success/replay/timeout/429/auth failure/out-of-order không tạo row trùng.

## Manual production smoke test

- [ ] Với lớp test có ít nhất hai student, complete lesson rồi xác minh mỗi Sheet chỉ có dữ liệu đúng student.
- [ ] Mô phỏng lỗi quyền, retry và promotion; xác minh URL giữ nguyên và tuition sheet chưa đổi.
