# HARDEN-V16C-V16D-BEFORE-GOOGLE-OAUTH Acceptance

- [x] OAuth chỉ còn `drive.file`.
- [x] Runtime/contract/UI/OpenAPI không còn trạng thái nghỉ có tính phí; migration
  đổi dữ liệu cũ, recalculation cycle chưa `PAID` và giữ cycle `PAID`.
- [x] Snapshot hiển thị 5/8, `PAYMENT_DUE` 8/8 và cycle `PAID` gần nhất.
- [x] ABSENT/FREE thuộc đúng cycle window, không đếm trùng và không reset khi lên lớp.
- [x] `CREATING` mới không bị reclaim; stale sau 10 phút retry/reuse resource an toàn.
- [x] 404 folder và spreadsheet được phân loại riêng.
- [x] Regenerate giữ URL/ID và không xóa rule/protection của người dùng.
- [x] Toàn bộ final verification gate PASS.
