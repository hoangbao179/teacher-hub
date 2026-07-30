# OPTIONAL-CLASS-TUITION

## Phạm vi

- Cho phép bỏ trống giá gói khi tạo/sửa lớp; API nhận giá `0`.
- Giá lớp `0` không tạo phân bổ hoặc chu kỳ học phí.
- Giữ giá riêng `CUSTOM` là số dương và không đổi quy tắc gói 8 buổi.
- Giá quản trị không được hiển thị trên Homepage public.

## Rủi ro

- Thay đổi constraint database nên phải có migration mới và integration test.
- Buổi học của lớp giá `0` vẫn phải lưu `PRESENT` nhưng `counts_for_tuition=0`.
