# V16C-STUDENT-GOOGLE-SHEET Acceptance

Trạng thái: **PLANNED**. Không checkbox nào được đánh dấu trước implementation.

## Functional acceptance

- [ ] OAuth server-side kết nối đúng tài khoản Google của cô Vy.
- [ ] Tạo đủ bốn sheet/template và hidden/protected mapping đúng schema version.
- [ ] Mỗi student có tối đa một Sheet `ACTIVE`; Sheet gắn student, không gắn class/enrollment.
- [ ] Student Detail hiển thị status và có action tạo/mở/copy link hoạt động thật.
- [ ] Chuyển/lên lớp không tạo Sheet mới; archive/replace là action explicit có audit.
- [ ] V16C chưa tự động sync lesson hoặc tuition và chưa share parent.

## Transaction/idempotency

- [ ] Concurrent/repeated create trả cùng resource hoặc hoàn tất an toàn, không tạo hai ACTIVE records.
- [ ] DB transaction không chứa external API call; kết quả provider được finalize bằng state machine/idempotency key rõ.
- [ ] Retry sau timeout kiểm tra lại spreadsheet đã tạo trước khi tạo file khác.

## Privacy/isolation

- [ ] Sheet mới Restricted và chỉ chứa student đang chọn.
- [ ] Token/secret không vào Sheet, API client, log, audit hoặc client-readable storage.
- [ ] Technical IDs chỉ ở vùng ẩn/protected; internal note không được render cho parent.

## Responsive admin UI

- [ ] Student Detail không overflow tại 360–430 px; open/copy/create có accessible name và feedback.
- [ ] Trạng thái lỗi/loading không để action lặp hoặc nút giả.

## Google failure behavior

- [ ] Timeout/429/5xx tạo trạng thái retryable, không làm hỏng student data.
- [ ] Auth/permission failure yêu cầu admin reconnect và không retry vô hạn.
- [ ] Raw provider error/token không hiển thị cho admin hoặc ghi log không an toàn.

## Native MySQL integration

- [ ] Migration/resource mapping chạy trên MySQL native; unique invariant một ACTIVE Sheet chịu được concurrent requests.
- [ ] Integration test kiểm tra create/finalize/archive/replace và rollback DB.

## Fake Google provider tests

- [ ] Fake provider kiểm tra success, existing resource, timeout-after-create, 429, auth failure và malformed response.
- [ ] Test xác minh đúng request template, ownership và không truyền dữ liệu student khác.

## Manual production smoke test

- [ ] Với student test, kết nối account cô Vy, tạo Sheet, mở/copy link và kiểm tra owner/restricted/template/protection.
- [ ] Archive hoặc xóa resource test theo quy trình được duyệt; không dùng dữ liệu học sinh thật.
