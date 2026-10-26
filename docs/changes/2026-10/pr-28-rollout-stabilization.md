# PR #28 — tương thích rollout PDF

## Task level

Initial và final: Level 3 — cấu hình deployment và deadline xuyên API/Gateway.
Không thay schema, IAM, secret, tài nguyên, traffic hoặc kiến trúc renderer.

## Problem / Root cause

API/Web tự triển khai sau merge, nhưng Gateway/Worker triển khai riêng. Mặc định
API gửi 180s có thể bị Gateway đang chạy chỉ nhận 30s từ chối. View-only mặc định
bật dù chưa nghiệm thu; audit chỉ loại `false`, chấp nhận flag thiếu/sai và vẫn
báo `gates: OFF`. Smoke suy diễn khả năng view-only từ cấu hình thay vì bằng chứng.

## Decision / Changes

- API chỉ gửi 180s khi flag chính xác `true`; thiếu/false giữ 30s. Gateway luôn
  nhận 30s, chỉ nhận thêm 180s khi flag chính xác `true`. Không thêm retry fallback,
  không đổi HMAC/auth, payload, idempotency hoặc quy tắc retry.
- Worker print fallback giữ mặc định bật, cho phép opt-out `false`; view-only
  chỉ bật bằng `true`. Gate thử nghiệm không cho phép vượt hạn chế owner/admin.
- Staging ghi rõ fallback=true, capture=false, long tasks=true và giữ
  `--no-traffic`. Audit yêu cầu giá trị chính xác, báo từng flag của revision.
- Smoke luôn báo view-only `NOT_VERIFIED`, restricted Viewer `NOT_SUPPORTED`;
  không chứng nhận mode thực thi hoặc Cloud E2E từ biến môi trường.

## Verification

Targeted Worker typecheck/print policy; processing và smoke dùng dependency giả;
API provider qua tsx; Gateway qua HTTP/HMAC giả upstream; stage/audit dùng CLI giả.
Bao phủ ma trận flag, không gọi Google Drive, không chạy browser, build hoặc deploy.
Hai test parser/E2E trong processing chỉ dành Linux bị SKIP trên Windows; không
tính là PASS. Server typecheck, docs links và repository guard được kiểm tra riêng.

Kết quả local: Worker check PASS (3), processing PASS (18, 2 Linux SKIP),
authorized-smoke unit PASS (4), API provider PASS (6), Gateway PASS (15),
stage/audit PASS (11), public-HMAC stage/one-shot PASS (10). Server typecheck,
`check:docs`, `check:repo` và diff whitespace đều PASS. Không chạy full monorepo
E2E, Docker build hoặc real Viewer smoke theo phạm vi task.

## Documentation updated

Product contract, Worker feature, current status, Cloud Run runbook và release
audit phân biệt cấu hình source/staging với trạng thái live chưa xác minh.

## Rollback

Chưa thay đổi cloud nên không cần rollback traffic cho sửa source này. Khi operator
triển khai sau đó: tắt producer long tasks trước, chờ task 180s đang chạy hoàn tất,
tắt Worker fallback rồi khôi phục revision/flag Gateway đã biết tốt. Giữ GCS
results/outbox. Không revert riêng về mặc định API 180s của PR cũ khi Gateway cũ
còn phục vụ. Không tự động promote hoặc rollback tài nguyên bên ngoài.

## Remaining risks

Trước activation: CI của HEAD mới phải xanh; operator xác minh revision/flag live,
IAM/HMAC, sandbox/egress, RAM/CPU/chi phí và E2E Viewer khác Owner được phép xuất/in,
đủ trang/thứ tự/chất lượng qua Tasks/GCS/ticket. Promote Worker/Gateway tương thích
trước khi bật producer 180s. View-only giữ tắt; nguồn bị owner/admin hạn chế vẫn
không được nghiệm thu. Local checks không chứng minh production-ready.
