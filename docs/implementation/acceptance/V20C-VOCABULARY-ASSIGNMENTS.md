# V20C — Vocabulary assignments acceptance

- [x] Assignment bắt buộc ageBand do giáo viên xác nhận; Public Unit chỉ preselect.
- [x] Publish khóa draft và snapshot items, activities, recipients atomically.
- [x] CLASS snapshot active students; SELECTED snapshot đúng danh sách; OPEN_LINK
  không tạo recipient hoặc student mapping.
- [x] Published content/activity/recipient immutable; chỉ đổi dueAt, close, revoke
  token hoặc duplicate.
- [x] Không có PUBLISHED→DRAFT; duplicate/review boundary luôn tạo draft mới và
  không tự publish.
- [x] Public code là mã dễ nhập, không thay access token cá nhân.
- [x] Recipient token dùng >=32 random bytes, chỉ SHA-256 hash trong DB, không chứa
  studentId và revoke/close hoạt động.
- [x] Public asset được materialize trước publish; network/filesystem import không
  nằm trong DB transaction.
- [x] Wizard hoạt động ở 360–430 px, sticky action không che bottom nav, link/QR
  không log token.
- [x] State/concurrency/integration/E2E targeted và `npm run check:full` PASS.
