# SUPPORT-EXTERNAL-TEACHING-SCHEDULES

## Phạm vi

Mở rộng `TeacherBusySlot` để lưu lịch dạy tại trường/trung tâm như lịch làm việc,
hiển thị trên Calendar/Dashboard và tham gia cảnh báo trùng mà không tạo Class hay
dữ liệu học sinh, buổi học và học phí.

## Thay đổi chính

- Phân loại `EXTERNAL_CLASS`, `PERSONAL`, `OTHER`; backfill dữ liệu cũ thành `OTHER`.
- Lưu loại/tên đơn vị cho lịch dạy ngoài một lần hoặc hằng tuần.
- Bổ sung hai hành động tạo lịch và badge nhận diện trên Calendar/Dashboard.
- Giữ nguyên projection buổi chưa ghi nhận và toàn bộ nghiệp vụ Class/Tuition.
