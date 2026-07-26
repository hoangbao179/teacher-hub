# V20E Release Checklist

## Repository release candidate

- [x] Results, mastery và review draft.
- [x] Protected APIs/OpenAPI và migration/indexes.
- [x] Accessibility, security và responsive regression.
- [x] Named media volume, startup write check và provider-disabled behavior.
- [x] Recovery-set scripts có manifest/checksum; file-level recovery smoke PASS.
- [x] `npm run check:full` PASS.

## Production enable gates

- [ ] Đo query plan/load bằng dữ liệu đại diện trên VPS mục tiêu.
- [ ] Chạy backup và restore cô lập MySQL + media trên VPS, kiểm tra ID/bytes/playback.
- [ ] Operator xác nhận Pixabay key/terms.
- [ ] Giáo viên duyệt seed meaning/alt/image.

## Verdict

FAIL — không commit hoặc enable production cho đến khi toàn bộ gate trên PASS.
