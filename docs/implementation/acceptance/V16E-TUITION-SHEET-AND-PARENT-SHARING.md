# V16E-TUITION-SHEET-AND-PARENT-SHARING Acceptance

Trạng thái: **PLANNED**. Không checkbox nào là PASS khi chưa có evidence.

## Functional acceptance

- [ ] `Học phí` và `Tổng quan` hiển thị cycle tám billable sessions từ canonical DB.
- [ ] ABSENT/FREE có trong lịch sử/tổng lịch nhưng không có billable sequence.
- [ ] Cycle dở xuyên promotion/transfer giữ tiến độ và cùng Sheet.
- [ ] Giá/status/ngày thu/phương thức dùng dữ liệu snapshot/persisted, không suy từ config hiện tại.
- [ ] Parent được share đúng Sheet làm Viewer; Sheet vẫn Restricted.
- [ ] Admin có status, last sync, retry/resync và revoke/change share hoạt động thật.

## Transaction/idempotency

- [ ] Tuition/payment/share mutation và outbox event commit/rollback đúng ranh giới.
- [ ] Replay/upsert cycle mapping không tạo dòng hoặc share permission trùng.
- [ ] Google retry không mark paid, import DB hoặc ghi payment audit lần hai.
- [ ] Cycle/item `PAID` bất biến qua resync.

## Privacy/isolation

- [ ] Parent chỉ xem Sheet của đúng student; group data không rò chéo.
- [ ] Không hiển thị bank data không cần thiết, payment/internal note, outbox error hoặc DB ID.
- [ ] Không public “anyone with link” mặc định; revoke được audit.

## Responsive admin UI

- [ ] Sync/share status và action dùng được tại 360–430 px, không overflow hoặc che bottom nav.
- [ ] Lỗi được diễn giải, không lộ raw enum/provider payload/secret.

## Google failure behavior

- [ ] Timeout/429/5xx giữ payment/tuition DB đã commit và retry với backoff.
- [ ] Auth/quota/permission failure phân loại đúng; reconnect/retry/resync không mất dữ liệu.
- [ ] Partial provider success được reconcile trước khi tạo permission/row mới.

## Native MySQL integration

- [ ] Outbox/share/mapping migration chạy trên MySQL native với unique constraints phù hợp.
- [ ] Integration test bao phủ accumulating/due/paid, cycle xuyên enrollment, concurrent payment/share và rollback.

## Fake Google provider tests

- [ ] Fake provider xác minh payload cycle, hidden mapping, Viewer permission và Restricted setting.
- [ ] Test success/replay/timeout-after-success/429/auth failure/revoke/resync không tạo duplicate.

## Manual production smoke test

- [ ] Với student/account test, sync cycle, share Viewer và xác minh không có quyền edit hoặc dữ liệu student khác.
- [ ] Mark paid, retry/resync, revoke permission và xác minh DB/Sheet/audit nhất quán; dọn resource test an toàn.
