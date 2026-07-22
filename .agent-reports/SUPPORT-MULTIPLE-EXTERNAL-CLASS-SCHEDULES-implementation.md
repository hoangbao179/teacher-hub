# SUPPORT-MULTIPLE-EXTERNAL-CLASS-SCHEDULES Implementation

## Phạm vi

Thêm nhiều khung giờ tuần cho một TeacherBusySlot và làm gọn action hierarchy Calendar.

## Vấn đề đã sửa

- WEEKLY dùng danh sách lịch con thay cho một khung giờ ở parent.
- Create/update parent–children atomic; projection và conflict chạy từng lịch con.
- Form thêm/xóa nhiều buổi; Calendar dùng menu “Thêm lịch” và hierarchy responsive.

## API/schema thay đổi

Contract thêm `BusySlotWeeklyScheduleInput` và `schedules[]`; migration `0011` tạo `teacher_busy_slot_schedules`, backfill dữ liệu cũ và giữ cột legacy nullable.

## Kiểm tra đã chạy

`npm run check:full` — PASS.

## Điểm còn lại

Không có trong phạm vi task.
