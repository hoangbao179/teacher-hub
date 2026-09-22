# Teacher Admin monthly tuition

## Task level

Level 3: thay đổi persisted financial model, shared contract xuyên client/server và
thêm migration.

## Problem

Admin cũ buộc công việc hằng ngày vào cycle tám buổi, receipt và Legacy Import,
trong khi nhu cầu thực tế là điểm danh nhanh, nhận xét tùy chọn và theo dõi đã thu
theo từng tháng.

## Root cause

Lesson completion, tuition cycle, export và Google Sheet dùng chung orchestration
tài chính. Attendance `FREE` đồng thời biểu diễn trạng thái học và billing concern,
làm UI/phân loại dữ liệu phức tạp hơn nhu cầu.

## Decision

- Runtime attendance chỉ `PRESENT|ABSENT`; enrollment `FREE` xử lý riêng ở billing.
- Tạo `monthly_tuition_payments`, unique theo enrollment/year/month. Summary lấy từ
  completed canonical lesson và participant snapshot.
- `PAID` bất biến, replay cùng payload idempotent; amount tùy chọn, không suy từ cycle.
- Giữ bảng/migration cycle, receipt, policy và import cũ nhưng loại khỏi runtime.
- Giữ Google outbox, thay projection bằng một sổ học tập dễ đọc.

## Changes

- Thay API/UI tuition bằng board tháng và mark-paid.
- Tách lesson khỏi cycle allocation, dọn dashboard, student/class UI và report Excel.
- Loại Legacy Import route/client/shared contract; URL cũ trả 404.
- Google Sheet template v6 có một tab hiển thị và metadata ẩn.
- Cập nhật spec, OpenAPI, status, architecture, operations và user guide.

## Verification

- `npm run check:ci`: PASS (build, typecheck, lint, 155 server unit, 95 client
  unit, repository guard và documentation links).
- `npm run test:integration`: PASS, 57/57 integration tests; gồm migrate mới từ
  database sạch, monthly board, payment bất biến/idempotent và Google Sheet v6.
- Full E2E suite: PASS sau khi chạy lại đúng các kịch bản bị dừng bởi assertion cũ;
  gồm responsive Admin, lesson, monthly tuition, schedule, Google Sheet và
  vocabulary regressions.
- Targeted `test:e2e:schedule`, `test:e2e:tuition`, lesson wizard và Google Sheet:
  PASS.

## Documentation updated

`AGENTS.md`, README, product spec, feature docs, OpenAPI, implementation status,
architecture, operations và teacher guide.

## Rollback

1. Deploy lại runtime trước thay đổi; runtime cũ bỏ qua bảng mới.
2. Không drop `monthly_tuition_payments` nếu đã có dữ liệu cần giữ. Export/backup
   dữ liệu trước khi rollback vật lý.
3. Chỉ drop bảng mới bằng migration riêng sau khi xác nhận chưa có payment cần giữ.
4. Không restore hoặc sửa các bảng cycle/import lịch sử trong rollback ứng dụng.

## Remaining risks

- Payment cycle lịch sử không hiển thị trong board tháng vì không có mapping an toàn
  qua ranh giới tháng.
- Schema lịch sử vẫn chiếm dung lượng đến khi có cleanup database riêng.
- Wireframe cũ được giữ theo repository policy và có thể không phản ánh UI mới.
