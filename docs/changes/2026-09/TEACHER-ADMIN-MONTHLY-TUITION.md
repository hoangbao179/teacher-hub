# Teacher Admin: attendance và học phí tháng

## Task level

Level 3: thay đổi mô hình tài chính đã lưu, shared contract xuyên client/server,
migration xóa dữ liệu/schema và cleanup lớn.

## Problem

Teacher Admin cũ gắn điểm danh với cycle tám buổi, receipt, tuition policy và
Legacy Import. Mô hình này làm luồng hằng ngày phức tạp, đồng thời summary tháng
chỉ dựa trên lesson đã hoàn thành nên có thể hiển thị `3/3` dù lịch tháng có tám
buổi hợp lệ. Mutation đánh dấu đã thu còn có thể ghi payment rồi mới thất bại khi
đọc response.

## Root cause

- Attendance chứa cả trạng thái học (`PRESENT|ABSENT`) lẫn billing concern
  (`FREE` và các cờ tính học phí).
- Học phí được orchestration qua cycle/receipt/policy thay vì một trạng thái tháng.
- Tổng số buổi lấy từ lesson record, không lấy từ occurrence engine hiện có.
- Payment được insert trước khi hoàn tất validation và dựng response.
- Google Sheet append theo vị trí dòng, chưa upsert bằng lesson ID ổn định và chưa
  cập nhật metadata sau mọi lần sync.

## Decision

- Attendance runtime chỉ còn `PRESENT|ABSENT`; nhận xét học sinh vẫn tùy chọn.
- Enrollment dùng một cờ `tuitionExempt`.
- `monthly_tuition_payments` là mô hình thanh toán duy nhất: không có row là
  `UNPAID`, có row là `PAID`; `amount`, `note` tùy chọn và `paidAt` bắt buộc khi tạo.
- Summary tháng dùng occurrence từ schedule engine đang có. `present` là số
  attendance `PRESENT`; `total` là các occurrence hợp lệ trong tháng của enrollment,
  loại occurrence bị skip/cancel và bản gốc đã reschedule. Tổng không thấp hơn số
  attendance đã ghi để chịu được dữ liệu lesson ngoại lệ.
- Validation enrollment, miễn học phí và tháng chạy trước insert, được kiểm tra lại
  dưới lock trong transaction; response được dựng trước commit.
- Google Sheet upsert theo technical lesson ID ẩn, cập nhật timestamp sau mọi sync
  và copy format cho dòng append.

## Changes

- Thêm migration `0028_teacher_admin_clean_schema.sql` để drop cycle, receipt,
  policy, Legacy Import cùng FK/index/column liên quan; đơn giản hóa attendance,
  enrollment và monthly payment schema.
- Cập nhật API, shared contracts, repositories, services và UI theo monthly model;
  bỏ giá gói/cycle/policy và route Legacy Import khỏi runtime.
- Giữ nguyên schedule engine, combined class, busy slot, external schedule,
  reschedule/cancel và enrollment scheduling; bổ sung regression integration/E2E.
- Cập nhật `db:reset:dev` để xóa `monthly_tuition_payments` trước enrollment.
- Sửa Google Sheet timestamp, formatting dòng append, upsert tránh duplicate và
  giữ technical lesson ID ẩn.
- Xóa toàn bộ `docs/wireframes`, mock/test image không dùng, tài liệu và test legacy;
  cập nhật repository guard và tài liệu source of truth.

## Verification

- `npm run check:ci`: PASS — shared build, server/client typecheck, client lint,
  153 server unit tests, 95 client unit tests, build, OpenAPI, repo và docs checks.
- `npm run test:integration`: PASS — 60/60, gồm clean schema, monthly tuition,
  combined class, schedule, external schedule, busy slot, reschedule/cancel và
  Google Sheet.
- Browser smoke: PASS sau khi cập nhật assertion sang tuition exemption mới.
- Relevant E2E: PASS — lesson wizard, monthly tuition, schedule operations,
  student Google Sheet, vocabulary game disabled và vocabulary results.
- `git diff --check`: PASS.

## Documentation updated

`AGENTS.md`, README, product spec, feature docs, OpenAPI, implementation status,
architecture, operations, repository map và repository guard.

## Rollback

Migration cleanup là destructive và không có down migration. Với môi trường hiện
tại, rollback bằng cách checkout/deploy phiên bản trước rồi reset/reseed database.
Nếu áp dụng ở môi trường có dữ liệu cần giữ, phải backup trước migration; restore
backup là cách duy nhất khôi phục nội dung cycle/receipt/import đã drop.

## Remaining risks

- Chưa gọi Google Sheets API thật vì bộ kiểm thử không dùng production OAuth;
  hành vi được cover bằng unit, fake integration và browser E2E.
- Các migration `0001`–`0027` vẫn chứa DDL/tên legacy để giữ chuỗi migrate từ đầu;
  migration `0028` bảo đảm final schema sạch và runtime không tham chiếu chúng.
