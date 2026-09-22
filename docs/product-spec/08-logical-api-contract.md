# 08. Logical API contract

Mọi route admin yêu cầu auth, trả envelope thống nhất và dùng contract từ
`@teacher/shared`.

## Core resources

- Auth: `POST /api/auth/login`, `POST /api/auth/logout`, `GET /api/auth/me`.
- Classes/students/enrollments: CRUD hiện hành, pause/resume/close/end/transfer theo
  ngày hiệu lực và `PATCH /api/enrollments/{id}/tuition-mode`.
- Lessons: create/read/update participant, attendance, content, complete và cancel.
- Schedule: occurrence query, create draft, skip, reschedule, bulk actions, week,
  teacher busy slots và combined-class endpoints.

## Monthly tuition

- `GET /api/tuition/monthly?year=YYYY&month=M&classId=&search=`
- `PUT /api/tuition/monthly/{enrollmentId}/{year}/{month}/paid`

Query year/month phải hợp lệ. Mark-paid nhận `paidAt`, `amount?`, `note?`; enrollment
miễn phí hoặc không hợp lệ trả conflict/not found phù hợp. API cycle/receipt cũ không
còn được đăng ký.

## Reports and Google Sheet

- `GET /api/students/{id}/export.xlsx?fromDate=&toDate=&classId=` trả duy nhất lịch
  sử học tập canonical.
- `GET|POST /api/students/{id}/google-sheet` cùng retry, regenerate, resync, archive.
- Legacy Import preview/apply không còn route; request xác thực tới URL cũ nhận 404.
