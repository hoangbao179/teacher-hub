# 08. Logical API Contract

Đây là contract mức tài nguyên để Codex không tự thêm nghiệp vụ. Tên endpoint có thể điều chỉnh theo framework.

## Auth
- POST `/api/auth/login`
- POST `/api/auth/logout`
- GET `/api/auth/me`

## Classes
- GET/POST `/api/classes`
- GET/PATCH `/api/classes/{id}`
- POST `/api/classes/{id}/pause`
- POST `/api/classes/{id}/resume`
- POST `/api/classes/{id}/close`
- GET/POST `/api/classes/{id}/schedules`

## Nhóm học ghép
- GET/POST `/api/combined-class-groups`
- GET/PATCH `/api/combined-class-groups/{id}`
- POST `/api/combined-class-groups/{id}/end`
- GET `/api/combined-teaching-occurrences/{id}`
- POST `/api/combined-teaching-occurrences/{id}/complete`

`/api/schedule/occurrences` và `/api/schedule/week` trả occurrence nhóm đã
resolve cùng các occurrence lớp. Các lịch lớp thành viên bị lịch nhóm chồng giờ
thay thế không xuất hiện trong kết quả. `create-draft`, `skip`, `reschedule` dùng
chung route schedule và nhận cả key nhóm `cg:{groupId}:{scheduleId}:{date}`.

## Students and enrollments
- GET/POST `/api/students`
- GET/PATCH `/api/students/{id}`
- POST `/api/classes/{id}/enrollments`
- PATCH `/api/enrollments/{id}`
- POST `/api/enrollments/{id}/pause|resume|end`
- PATCH `/api/enrollments/{id}/tuition-mode`

## Lessons
- GET/POST `/api/lessons`
- GET/PATCH `/api/lessons/{id}`
- POST `/api/lessons/{id}/complete`
- POST `/api/lessons/{id}/cancel`
- GET `/api/schedule/unrecorded?days=` (compatibility view)

## Schedule reconciliation
- GET `/api/schedule/occurrences?from=&to=&classId=&state=&lookbackDays=`
- POST `/api/schedule/occurrences/{key}/create-draft`
- POST `/api/schedule/occurrences/{key}/skip`
- POST `/api/schedule/occurrences/{key}/reschedule`
- POST `/api/schedule/occurrences/bulk-create-drafts`
- POST `/api/schedule/occurrences/bulk-skip`
- GET `/api/schedule/week?from=`

## Tuition
- GET `/api/tuition-cycles`
- GET `/api/tuition-cycles/{id}`
- POST `/api/tuition-cycles/{id}/mark-paid`
- POST `/api/tuition-cycles/{id}/unlock` (có reason)

## Calendar
- GET/POST `/api/teacher-busy-slots`
- GET/PATCH/DELETE `/api/teacher-busy-slots/{id}`

## Export
- GET `/api/students/{id}/export.xlsx`
- POST `/api/students/{id}/legacy-imports/preview` (multipart `.xlsx`, preview/audit only)
- POST `/api/students/{id}/legacy-imports/apply` (multipart `.xlsx` + preview SHA + structured decisions; atomic/idempotent)
- GET/POST `/api/students/{id}/google-sheet`
- POST `/api/students/{id}/google-sheet/retry`
- POST `/api/students/{id}/google-sheet/regenerate`
- POST `/api/students/{id}/google-sheet/archive`

Route export yêu cầu auth, lấy dữ liệu canonical từ server và hỗ trợ
`fromDate`, `toDate`, `classId`. Đây là output chuẩn hóa; generic legacy import
không thuộc V1.

Legacy preview chỉ đọc workbook, tính SHA-256, xóa file tạm và không ghi lesson,
class, enrollment hoặc tuition. Apply đọc và reconcile lại file, từ chối SHA khác hoặc
dòng chưa resolve rồi mới ghi business data/audit trong một transaction.
