# SUPPORT-MULTIPLE-EXTERNAL-CLASS-SCHEDULES

## Phạm vi

Cho phép một TeacherBusySlot tuần chứa nhiều ngày/khung giờ, backfill dữ liệu đã
có và làm gọn hierarchy hành động Calendar mà không đổi nghiệp vụ lớp/học phí.

## Thay đổi chính

- Thêm bảng lịch con và transaction create/update parent–children.
- Dùng `schedules[]` trong contract/API, conflict và calendar projection.
- Form quản lý nhiều buổi trong một lần lưu; Calendar dùng menu “Thêm lịch”.
