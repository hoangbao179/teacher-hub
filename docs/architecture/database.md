# Database architecture

Schema nguồn: `server/src/db/migrations/0001_init_schema.sql`.

Quan hệ lõi:

```text
classes ─ recurring_schedules
classes ─ class_enrollments ─ students
classes ─ lesson_sessions ─ lesson_attendances ─ class_enrollments
class_enrollments ─ tuition_cycles ─ tuition_cycle_sessions ─ lesson_attendances
```

## Dữ liệu tiền/thời gian

- VND: `BIGINT`.
- Duration: phút nguyên.
- Ngày: `DATE`.
- Giờ: `TIME`.
- Timezone UI: `Asia/Ho_Chi_Minh`.

## Integrity do service enforce

MySQL không có partial unique index thuận tiện; rule một enrollment ACTIVE/học sinh phải được kiểm tra trong transaction khi thêm/chuyển lớp.
