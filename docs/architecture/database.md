# Database architecture

Schema nguồn: `server/src/db/migrations/0001_init_schema.sql`.

Quan hệ lõi:

```text
classes ─ recurring_schedules
recurring_schedules ─ schedule_exceptions
classes ─ class_enrollments ─ students
classes ─ lesson_sessions ─ lesson_attendances ─ class_enrollments
classes ─ class_tuition_policies
class_enrollments ─ enrollment_tuition_policies
lesson_sessions ─ lesson_session_participants ─ lesson_attendances
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
- Participant snapshot dùng unique `(lesson_session_id,enrollment_id)`; attendance
  tham chiếu composite identity của participant nên không thể ghi attendance ngoài snapshot.
- `class_tuition_policies` và `enrollment_tuition_policies` là lịch sử theo khoảng
  ngày inclusive. Repository khóa toàn bộ policy của owner khi chèn/split range để
  không tạo overlap.
- `CLASS_DEFAULT` tại một ngày được resolve từ enrollment policy rồi class price
  policy cùng ngày; các cột price mutable chỉ là compatibility projection.
- Tuition cycle có target cố định 8, snapshot giá dương và item sequence 1..8.
- MySQL pool uses `dateStrings: true` so calendar `DATE` values remain exact and
  are never shifted by runtime timezone conversion.
- M3 rebuild locks enrollment, cycles and completed attendance; it preserves
  `PAID`, removes only mutable cycle/items, then groups deterministic attendance
  into 8 plus one optional partial cycle.
- M4A payment locks the cycle row and all stored item rows before validation;
  the `PAID` update and `TUITION_CYCLE_MARKED_PAID` audit insert commit together.
- Ending an enrollment locks its cycle rows and changes only `ACCUMULATING` to
  `INCOMPLETE`; it never rewrites `PAYMENT_DUE` or `PAID` rows.
- M5A adds a deterministic nullable `lesson_sessions.source_occurrence_key` with
  a unique index. Draft creation reuses this key for idempotency; legacy/manual
  lessons remain valid with `NULL`.
- `schedule_exceptions` identifies one original occurrence by recurring schedule
  and date, snapshots its original time, and stores reason/note/actor. A reschedule
  stores replacement date/time without mutating the recurring definition.
- `teacher_busy_slots` stores only teacher availability metadata and actor. It has
  no enrollment, attendance or tuition foreign key.
