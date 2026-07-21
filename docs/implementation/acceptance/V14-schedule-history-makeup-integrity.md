# V14 Schedule History Makeup Integrity Acceptance

- Lesson/participant cũ giữ tên snapshot sau khi đổi metadata hiện tại.
- Pause/resume lớp và enrollment dùng ngày hiệu lực; khoảng pause không sinh lịch
  hoặc participant nhưng lịch sử trước pause vẫn truy cập được.
- Sửa metadata lớp không đổi schedule ID; thay lịch tạo version mới và không
  rewrite occurrence quá khứ; delete chỉ end-date.
- Cancel draft gắn occurrence lưu metadata/audit và làm occurrence thành SKIPPED.
- Makeup có thể chọn subset; một enrollment chỉ thay thế một lần trên mỗi source;
  generic makeup vẫn hoạt động; tuition chỉ đổi khi completion + attendance.
- Temporary reschedule preview không ghi DB; apply atomic bằng exceptions và tự
  trở về pattern gốc sau khoảng chọn.
- Conflict warning dùng chung và hiển thị ở busy slot, occurrence draft, manual
  lesson, reschedule và calendar.
- UI mobile 360–430 px không overflow; login helper, giới thiệu cô Vy và footer
  đúng yêu cầu.
- Full gate, integration, E2E, repo/package checks đều PASS trước commit.
