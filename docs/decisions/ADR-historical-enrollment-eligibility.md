# ADR: Historical enrollment eligibility

Status: Approved for Milestone 2 participant selection.

## Decision

Eligibility tại ngày lesson được xác định bằng:

```text
joined_at <= session_date
AND (ended_at IS NULL OR ended_at >= session_date)
```

Không dùng riêng current `ACTIVE` status để dựng participant lịch sử. Sau khi
snapshot được tạo, thay đổi enrollment không làm thay đổi participant của lesson
đó. Semantics `ended_at >= session_date` nghĩa là ngày kết thúc vẫn đủ điều kiện.
