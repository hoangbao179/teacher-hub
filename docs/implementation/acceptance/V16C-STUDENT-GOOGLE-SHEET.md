# V16C-STUDENT-GOOGLE-SHEET Acceptance

Trạng thái: **AUTOMATED PASS — MANUAL GOOGLE SMOKE PENDING**. Hai tiêu chí dùng
tài khoản Google thật để trống vì môi trường chưa có credential test.

## Functional acceptance

- [ ] OAuth server-side kết nối đúng tài khoản Google của cô Vy.
- [x] Tạo đủ bốn sheet/template và hidden/protected mapping đúng schema version.
- [x] Mỗi student có tối đa một Sheet `ACTIVE`; Sheet gắn student, không gắn class/enrollment.
- [x] Student Detail hiển thị status và có action tạo/mở/copy link hoạt động thật.
- [x] Chuyển/lên lớp không tạo Sheet mới; archive/replace là action explicit có audit.
- [x] V16C chưa tự động sync lesson hoặc tuition và chưa share parent.

## Transaction/idempotency

- [x] Concurrent/repeated create trả cùng resource hoặc hoàn tất an toàn, không tạo hai ACTIVE records.
- [x] DB transaction không chứa external API call; kết quả provider được finalize bằng state machine/idempotency key rõ.
- [x] Retry sau timeout kiểm tra lại spreadsheet đã tạo trước khi tạo file khác.

## Privacy/isolation

- [x] Sheet mới Restricted và chỉ chứa student đang chọn.
- [x] Token/secret không vào Sheet, API client, log, audit hoặc client-readable storage.
- [x] Technical IDs chỉ ở vùng ẩn/protected; internal note không được render cho parent.

## Responsive admin UI

- [x] Student Detail không overflow tại 360–430 px; open/copy/create có accessible name và feedback.
- [x] Trạng thái lỗi/loading không để action lặp hoặc nút giả.

## Google failure behavior

- [x] Timeout/429/5xx tạo trạng thái retryable, không làm hỏng student data.
- [x] Auth/permission failure yêu cầu admin reconnect và không retry vô hạn.
- [x] Raw provider error/token không hiển thị cho admin hoặc ghi log không an toàn.

## Native MySQL integration

- [x] Migration/resource mapping chạy trên MySQL native; unique invariant một ACTIVE Sheet chịu được concurrent requests.
- [x] Integration test kiểm tra create/finalize/archive/replace và rollback DB.

## Fake Google provider tests

- [x] Fake provider kiểm tra success, existing resource, timeout-after-create, network/auth classification và malformed template guard.
- [x] Test xác minh đúng request template, ownership và không truyền dữ liệu student khác.

## Manual production smoke test

- [ ] Với student test, kết nối account cô Vy, tạo Sheet, mở/copy link và kiểm tra owner/restricted/template/protection.
- [ ] Archive hoặc xóa resource test theo quy trình được duyệt; không dùng dữ liệu học sinh thật.

## Hardening evidence 26/07/2026

- [x] OAuth config test xác minh chỉ có `drive.file`.
- [x] Recovery process chết trước/sau create, trước finalize và concurrent retry.
- [x] Stale `CREATING` hiển thị retry; regenerate giữ user formatting/protection.
