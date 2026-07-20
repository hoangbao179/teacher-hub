# 05. State Machines

## Class
`ACTIVE -> PAUSED -> ACTIVE`; `ACTIVE/PAUSED -> CLOSED`.

## ClassEnrollment
`ACTIVE -> PAUSED -> ACTIVE`; `ACTIVE/PAUSED -> ENDED`.

## LessonSession
`DRAFT -> COMPLETED`; `DRAFT -> CANCELLED`; `COMPLETED -> DRAFT` chỉ khi không bị khóa bởi chu kỳ PAID.

## TuitionCycle
`ACCUMULATING -> PAYMENT_DUE -> PAID`.
`ACCUMULATING -> INCOMPLETE` khi ghi danh kết thúc trước 8 buổi.
`PAYMENT_DUE -> CANCELLED` chỉ khi hủy/tái tính có chủ đích.

## Schedule occurrence ảo
`EXPECTED -> RECORDED | SKIPPED | RESCHEDULED`.
Occurrence ảo được suy ra từ lịch lặp và exception, không tự tạo LessonSession hoàn thành.
