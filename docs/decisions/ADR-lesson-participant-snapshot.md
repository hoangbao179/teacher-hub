# ADR: Lesson participant snapshot

Status: Implemented; extended by V14.

## Decision

Mỗi `lesson_session` lưu participant snapshot. Buổi `REGULAR` snapshot toàn bộ
enrollment đủ điều kiện tại ngày học; buổi `MAKEUP` có thể snapshot riêng các
học sinh được chọn. Attendance chỉ được ghi cho participant có trong snapshot.
Thay đổi enrollment về sau không sửa danh sách participant lịch sử.

V14 snapshot thêm `student_name_snapshot` và `student_nickname_snapshot`; lesson
snapshot `class_name_snapshot`, `class_type_snapshot` và `subject_snapshot`.
Các màn lịch sử và báo cáo ưu tiên snapshot, nên đổi tên hiện tại không rewrite
buổi cũ.

Schema dự kiến:

```text
lesson_session_participants
- lesson_session_id
- enrollment_id
- created_at
```

Khóa duy nhất là `(lesson_session_id, enrollment_id)`. Migration chỉ được thêm
cùng implementation M2 sau khi có chiến lược backfill cho lesson hiện hữu; M1.1
không tạo bảng hoặc lesson workflow mới.
