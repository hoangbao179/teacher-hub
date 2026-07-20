# ADR: Lesson participant snapshot

Status: Approved for Milestone 2 design; not implemented in M1.1.

## Decision

Mỗi `lesson_session` lưu participant snapshot. Buổi `REGULAR` snapshot toàn bộ
enrollment đủ điều kiện tại ngày học; buổi `MAKEUP` có thể snapshot riêng các
học sinh được chọn. Attendance chỉ được ghi cho participant có trong snapshot.
Thay đổi enrollment về sau không sửa danh sách participant lịch sử.

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
