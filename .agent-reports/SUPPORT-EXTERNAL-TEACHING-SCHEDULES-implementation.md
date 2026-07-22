# SUPPORT-EXTERNAL-TEACHING-SCHEDULES Implementation

## Phạm vi

Mở rộng TeacherBusySlot, API, Calendar và Dashboard cho lịch dạy trường/trung tâm.

## Vấn đề đã sửa

- Phân loại lịch dạy ngoài, cá nhân và khác; dữ liệu cũ mặc định thành `OTHER`.
- Lưu thông tin đơn vị và hiển thị badge/màu riêng mà không tạo Class hay dữ liệu học phí.
- Giữ lịch dạy ngoài trong conflict/calendar projection, ngoài unrecorded projection.

## API/schema thay đổi

`TeacherBusySlot` thêm `slotType`, `organizationType`, `organizationName`; migration `0010` thêm ba cột tương ứng.

## Kiểm tra đã chạy

`npm run check:full` — PASS.

## Điểm còn lại

Không có trong phạm vi task.
