# OPTIONAL-CLASS-TUITION Verification

## Acceptance

PASS: bỏ trống lưu `0`; `PRESENT` không billable và không tạo cycle.

## Typecheck/lint

`npm run check:full`: PASS.

## Unit/integration/E2E

Unit PASS; 78 integration tests PASS; browser smoke tạo lớp không nhập học phí
và xác nhận chi tiết `0đ`; toàn bộ E2E PASS. Một lượt đầu của lesson-wizard bị
timeout không liên quan, chạy riêng PASS và lượt full cuối PASS mã 0.

## Kiểm tra UI thủ công

Form không còn dấu bắt buộc và có helper text giải thích hành vi giá `0`.

## Tài liệu

Business rule, ADR, data dictionary, screen spec và kiến trúc database đã cập nhật.

## Final verdict

PASS
