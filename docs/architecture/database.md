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
students ─ legacy_imports ─ legacy_import_row_audits
legacy_imports ─ legacy_import_lesson_links ─ lesson_sessions/lesson_attendances
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
- `classes.default_package_price >= 0`; giá `0` là chưa cấu hình và không sinh
  phân bổ học phí. Tuition-mode/custom-price combinations
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
- V16B dùng `enrollment_id` trên cycle làm anchor tương thích nhưng recalculation khóa
  toàn bộ enrollment/cycle/attendance của student, giữ `PAID` và nhóm phần mutable
  xuyên enrollment. Chỉ `PRESENT` billable; `ABSENT`/`FREE` không billable.
- `legacy_imports` unique `(student_id,sha256)` là idempotency boundary. Row audit unique
  theo import/sheet/row/issue; lesson link giữ nguồn sheet/row mà không lưu binary workbook.
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
- `teacher_busy_slots` stores only shared teacher-availability metadata and actor;
  weekly time patterns live in `teacher_busy_slot_schedules` with cascade delete.
  Neither table has an enrollment, attendance or tuition foreign key.
## V16C Google Sheet theo học sinh

`student_google_sheets` lưu mapping và state generation, không lưu OAuth credential.
Generated column `active_guard` chỉ có giá trị với `CREATING`/`ACTIVE`; unique key
`(student_id, active_guard)` cho phép nhiều bản `ARCHIVED` nhưng chặn hai resource
đang tạo/hoạt động kể cả khi request concurrent. `legacy_import_id` chỉ dùng audit;
mọi nội dung Sheet được query lại từ canonical lesson/attendance/tuition tables.

External Google call nằm ngoài transaction. Transaction ngắn chỉ claim `CREATING`,
finalize `ACTIVE`, ghi lỗi an toàn hoặc archive/audit.

## V16D lesson Google Sheet outbox

`lesson_sessions.general_comment` là nhận xét chung được phép trình bày cho phụ
huynh; `note` vẫn là ghi chú nội bộ. `google_sheet_sync_outbox` giữ metadata tối
thiểu `student_id`, `lesson_id`, `event_type`, `revision` và trạng thái xử lý,
không giữ token, URL hay bản sao nội dung lesson.

Unique `(student_id, lesson_id, event_type)` gộp các lần sửa vào một logical event.
Event có FK không cascade tới student/lesson để tránh mất dấu ngoài ý muốn. Các
index `(status,next_attempt_at)`, `locked_at`, `student_id`, `lesson_id` phục vụ
claim, stale-lock recovery và màn trạng thái.
