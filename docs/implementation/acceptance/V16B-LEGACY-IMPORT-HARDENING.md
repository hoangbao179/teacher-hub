# V16B-LEGACY-IMPORT-HARDENING Acceptance

Trạng thái: **PASS on 29/07/2026**

- [x] Layout chuẩn và layout lệch được parse bằng header discovery.
- [x] FREE/V/OFF không vào paid candidate hoặc cycle.
- [x] Exact match được reserve trước near match; duplicate tuition date không đổi lesson date đúng.
- [x] Time, learning-only và tuition-only được gom thành quyết định nhóm.
- [x] Full block thiếu PAID và incomplete PAID block chỉ hiện lựa chọn backend hỗ trợ.
- [x] Tuition full-date ngược năm tạo structured correction.
- [x] Preview cycle plan được Apply đúng block và đúng source rows.
- [x] Bốn fixture regression không chứa dữ liệu thật.
- [x] Learning-only lesson không tạo `ATTENDANCE_AMBIGUOUS`, giữ attendance workbook
  nhưng không tạo nghĩa vụ học phí.
- [x] Workbook Grade 3 qua 01/06 vẫn có một context Grade 3.
- [x] `20h-21h35)` parse thành `20:00-21:35`; time mapping đếm lesson không trùng.
- [x] Bulk theo equivalence riêng của issue, confirmation chạy trước state mutation,
  suggested resolution và bộ lọc row/time mapping hoạt động đúng.
- [x] Toàn bộ targeted checks PASS.
