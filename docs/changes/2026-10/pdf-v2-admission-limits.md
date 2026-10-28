# PDF v2: hạn mức tiếp nhận 20 lượt/giờ, 3 active jobs

## Task level

Initial: Level 3. Final: Level 3 vì điều chỉnh giới hạn chống lạm dụng của API
public. Không đổi authentication/authorization, schema, payload xuyên service,
deployment hoặc tài nguyên cloud/VPS. Base `main`: `21f2372d69ee36b284063d6304246fd871a09e17`.

## Problem và root cause

V2 clamp mặc định xuống 2 active/2 lượt mỗi giờ. Chỉ nâng shared constant chưa đủ:
fallback hourly của API là 10; middleware public còn chặn 5 request submit/retry
và 10 request session mỗi IP/giờ, bao gồm request gửi lại. Vì vậy người dùng có
thể gặp `PDF_RATE_LIMITED` trước hạn mức được quảng bá.

## Decision và changes

- V2 mặc định và ceiling: 1 link/batch, 3 active, 20 lượt tạo job/giờ. Giữ v1
  5 links/10 active/10 batch mỗi giờ. Override hợp lệ thấp hơn vẫn được giữ;
  không tự ghi env. 200 trang/150 MiB output và source 20 MiB giữ nguyên.
- Session: 60 request/IP/giờ. Submit + retry: dùng chung 60 request/IP/giờ.
  Đây là headroom chống lạm dụng cho refresh/idempotent replay, không tăng quota
  job thực. Giữ middleware fixed-window, proxy trust và `Retry-After` hiện tại.
- Repository không cần đổi SQL: owner lock đã tuần tự hóa admission, các trạng
  thái active đã gồm job chờ/đang xử lý/chờ xác nhận; lịch sử job và manual retry
  đã được đếm theo giờ. Thêm chú thích và regression cho các ranh giới này.
  Idempotency vẫn kiểm tra trước quota. Không reset/xóa lịch sử để cấp lượt.
- 3 active là admission ở API. Queue dispatch/concurrency/max instances Worker
  vẫn 1; không sửa IAM, Cloud Run, queue, RAM/CPU hoặc VPS.

## Verification

- `npm.cmd run build:shared`: PASS.
- `npm.cmd -w server run typecheck`: PASS sau sửa kiểu return của HTTP test stub.
- `npm.cmd -w client run typecheck`: PASS; consumer shared không đổi API shape.
- `node --import tsx --test server/src/config/pdf-settings.test.ts server/src/routes/pdf-limits.test.ts server/src/services/pdf.service.test.ts server/src/services/pdf-validation.print.test.ts server/src/middleware/fixed-window-rate-limit.test.ts`:
  17 PASS. HTTP route test được chạy lại sau sửa stub trong nhóm Gateway dưới đây.
- `npm.cmd -w server run test:integration -- src/services/pdf.integration.test.ts`:
  7 PASS, không skip, dùng MySQL test database và fixture tổng hợp; không chạm
  lịch sử production. Chứng minh 3 active hỗn hợp, chặn job thứ 4, 20 lượt gồm
  retry, chặn lượt 21, quota theo giờ, idempotency, conflict và giữ lịch sử v1/v2.
  Coverage hiện có kiểm tra outbox/recovery, ownership và download ticket.
- `node --import tsx --test server/src/routes/pdf-limits.test.ts server/src/services/pdf-gateway-provider.test.ts server/src/services/pdf-gateway-transport.test.ts`:
  9 PASS; capabilities 20/3/1/200/150 MiB, IP quota dùng chung submit/retry,
  headroom refresh/replay, HMAC, checkpoint và task xác định không đổi.
- `node --test scripts/pdf-v2-readiness.test.mjs`: 55 PASS; vẫn từ chối scaling
  drift, không gọi Cloud thật.
- `npm.cmd run check:repo`, `npm.cmd run check:docs`, `git diff --check`: PASS.
- Không chạy full E2E, build Docker hay benchmark rendering: không sửa renderer,
  protocol hoặc resource budget. Không có lint script cho server/shared; client
  source không đổi. Không chạy/deploy Cloud thật hoặc nghiệm thu Drive/giấy in.

## Documentation updated

Product contract, contract v2, current status và hai runbook PDF được cập nhật.
[Runbook vận hành](../../operations/pdf-long-documents.md#cost-review-estimate-not-measured-billing)
giữ phép tính chi phí, giả định vùng Singapore, storage/Tasks/Gateway/egress,
điều kiện đánh giá 3/5 Workers và checklist rollout. Đây là ước tính theo đơn giá
công khai, không phải bill thật hoặc kết quả benchmark production.

## Rollback

Ưu tiên giảm admission bằng quy trình cấu hình hiện có về
`PDF_ACTIVE_LIMIT=2`, `PDF_HOURLY_LIMIT=2` nếu cần khôi phục quota cũ.
Job đang có vẫn được tiếp tục/tải; hạ quota chỉ chặn job mới cho tới khi usage
giảm, không sửa hoặc xóa row/checkpoint. Có thể revert commit ứng dụng khi chủ
dự án duyệt; không tắt chunk gate/Worker/recovery khi còn job v2. Không có
migration hoặc tài nguyên mới cần đảo ngược. Giữ transport tải 150 MiB.

## Remaining risks

- Production override hourly=10 sẽ vẫn cho 10. Chủ dự án cần duyệt rollout và
  cấu hình 1/3/20 nếu override cũ tồn tại; kiểm tra capabilities/readiness sau deploy.
- Mọi thiết bị public dùng chung owner giáo viên; quota job không phải quota riêng
  từng người. IP limiter process-local vẫn có thể bị reset khi restart; DB quota
  không reset. Hơn 60 request/IP/giờ vẫn có thể bị chặn trước 20 job thành công
  khi refresh/error/replay quá nhiều; đây là giới hạn chống lạm dụng có chủ đích.
- 20 lượt nhận không đảm bảo 20 lượt hoàn thành mỗi giờ. Một Worker có thể tạo
  backlog; cần số đo queue wait, active time, retry, storage và actual spend trước
  khi cân nhắc tăng. Với 3 active dùng chung, 5 Worker chưa có tải để sử dụng hết.
- Intake ceiling tăng 10 lần; storage bảy ngày có thể ~1050 GiB cho một owner
  theo giả định 320 MiB/job, chưa kể soft delete/lifecycle lag. Cần duyệt ngân sách,
  theo dõi lưu lượng download và retention hiện hữu; không tự đổi lifecycle.
- Không xác minh production capabilities, cloud state/billing hoặc Drive thật.
  Test fixture không chứng minh mọi Viewer hoặc chất lượng in 200 trang đạt.
