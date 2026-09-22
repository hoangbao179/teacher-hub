# 05. State machines

## Class

`ACTIVE → PAUSED → ACTIVE`; `ACTIVE|PAUSED → CLOSED`. `CLOSED` không mở lại.

## Enrollment

`ACTIVE → PAUSED → ACTIVE`; `ACTIVE|PAUSED → ENDED`. `ENDED` không mở lại.

## Lesson

`DRAFT → COMPLETED` hoặc `DRAFT → CANCELLED`. Lesson hoàn thành cho phép sửa nội
dung/attendance trong phạm vi participant snapshot; không còn payment-cycle lock.

## MonthlyTuitionPayment

Một row chưa persist được biểu diễn là `UNPAID`. Mutation tạo/upsert `PAID`.
`PAID` là terminal và bất biến; replay cùng payload trả idempotent.

## Schedule occurrence

Occurrence dự kiến là projection. Khi xử lý có thể thành `RECORDED`, `SKIPPED`
hoặc `RESCHEDULED`; thay đổi không rewrite recurring schedule.
