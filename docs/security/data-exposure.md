# Data exposure and parent-facing exports

- Public Homepage không gọi API quản trị và không hiển thị dữ liệu học sinh.
- Student Excel export chỉ nằm sau Bearer authentication và chỉ xuất một học sinh
  được chọn; V1 có đúng một teacher/admin nên không có tenant selector từ client.
- Export có thể chứa parent contact, lesson content, homework, student note và
  payment note. Giáo viên phải gửi file qua kênh phù hợp và tránh chuyển nhầm.
- Workbook không chứa password hash, JWT, database credential, internal audit log,
  student khác, macro hoặc external workbook link.
- Server không lưu workbook; audit chỉ lưu actor, student ID và filters.
- Formula-like user text được neutralize trước khi ghi cell.
