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

## Integrity

- Service kiểm tra state để trả domain error rõ ràng.
- MySQL là consistency boundary cuối: generated `active_student_key` chỉ có giá
  trị khi enrollment `ACTIVE`, unique index ngăn hai active enrollment cho cùng
  student kể cả khi có race.
- `classes.default_package_price > 0` và tuition-mode/custom-price combinations
  được bảo vệ bằng check constraints.
- ONE_TO_ONE capacity vẫn được khóa/kiểm tra trong transaction ở service/repository;
  constraint cross-table này không thể biểu diễn bằng MySQL `CHECK` thuần túy.
