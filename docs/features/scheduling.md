# Scheduling and reconciliation

Recurring schedule chỉ là lịch dự kiến. Không tự tính là đã học.

`ScheduleRepository.listUnrecorded` sinh occurrence từ lịch lặp trong khoảng ngày, bỏ occurrence đã có lesson hoặc exception.

Đổi lịch chỉ áp dụng một occurrence, không sửa lịch lặp. Lịch dạy ở trường là `teacher_busy_slots`, không có học sinh/học phí.
