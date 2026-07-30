# COMBINED-CLASS-GROUPS Verification

## Acceptance

- Trước/trong/sau hiệu lực lần lượt có 3 lịch riêng / 1 occurrence nhóm / 3 lịch
  riêng: PASS.
- Lịch khác ngày/không chồng giờ được giữ: PASS.
- Retry không tạo occurrence, lesson hoặc tiến độ lặp: PASS.
- Ghi nhận nhiều lesson con atomic, học phí tách theo enrollment: PASS.
- Lịch tuần và xác nhận chỉ có một card nhóm; học sinh chia theo lớp: PASS.
- Mobile 390 px không tràn ngang, action cuối không bị bottom navigation che:
  PASS.

## Typecheck/lint

- Shared build, server/client typecheck: PASS.
- ESLint các file client đã đổi: PASS.
- Full client lint còn lỗi `URL is not defined` có sẵn tại
  `client/scripts/calendar-mobile-ui.e2e.mjs`; không thuộc diff task.

## Unit/integration/E2E

- 5 targeted unit tests resolver/validation: PASS.
- 2 targeted MySQL integration tests completion/idempotency/rollback: PASS.
- `npm run test:e2e:combined-groups`: PASS.
- `npm run build`: PASS.

## Kiểm tra UI thủ công

Đã xem 5 screenshot ứng dụng thật: danh sách nhóm, form tạo, lịch tuần, xác nhận
lịch dạy và danh sách học sinh chia theo lớp. Ảnh lưu tạm tại
`%LOCALAPPDATA%\Temp\teacher-hub-combined-groups`.

## Tài liệu

ADR, product spec, data dictionary, logical API và OpenAPI đã cập nhật.

## Final verdict

PASS
