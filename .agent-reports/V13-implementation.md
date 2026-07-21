# V13 Implementation

## Phạm vi

Homepage, UX quản trị mobile, auth/local operations, tài liệu và visual reference.

## Vấn đề đã sửa

- Baseline sạch và typecheck/lint/server test PASS; xác nhận hero cao 470–620 px,
  hai slide dùng chung ảnh, testimonial có nhãn mẫu, local contact có thể rỗng.
- Dashboard còn Stack wrap lệch; tuition/student filter chiếm chỗ hoặc còn thiếu;
  class price mặc định 1; thuật ngữ chu kỳ/đối soát còn lộ cho end user.
- Password 6, reset-password, limiter, Retry-After và strict port đã có sẵn; giữ nguyên
  implementation và bổ sung verification/tài liệu thay vì viết lại.

## File chính đã đổi

`client/src/pages/*`, `client/src/content/publicHome.ts`, E2E scripts, tài liệu V13 và
ảnh public/V2 liên quan.

## API/schema thay đổi

Không có.

## Kiểm tra đã chạy

Được tổng hợp trong `V13-verification.md`.

## Điểm còn lại

Contact/media production thật vẫn phải được chủ repository cấu hình và duyệt.

## Commit

`7e04997` — `feat(ui): hoàn thiện trang chủ và trải nghiệm quản lý mobile`.
