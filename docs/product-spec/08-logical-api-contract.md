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

Route export yêu cầu auth, lấy dữ liệu canonical từ server và hỗ trợ
`fromDate`, `toDate`, `classId`. Đây là output chuẩn hóa; generic legacy import
không thuộc V1.
