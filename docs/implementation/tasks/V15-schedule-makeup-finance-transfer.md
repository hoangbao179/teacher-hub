# V15 Schedule, makeup, finance and transfer

## Mục tiêu

Hoàn thiện chuỗi đổi lịch tạm thời → nghỉ lịch thay thế → học bù, hỗ trợ đổi
nhiều lịch tuần, quản lý entitlement học bù, cảnh báo/lịch bận, thu trước, chốt
đợt dở dang và chuyển lớp mà không viết lại lịch sử.

## Phạm vi

- Gate A: replacement cancellation, makeup entitlement, bulk temporary
  reschedule, conflict detail và busy-slot management.
- Gate B: advance receipt, incomplete-cycle settlement, end/transfer enrollment.
- Gate C: contact copy Homepage, OpenAPI, hướng dẫn, regression và đóng gói.

## Ràng buộc

Tuân thủ các ADR snapshot, eligibility lịch sử, tuition effective-dated và các
business rule cố định trong `AGENTS.md`. Chỉ tạo migration mới; cycle `PAID`,
lesson/participant snapshot và footer Homepage là bất biến.
