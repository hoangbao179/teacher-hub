# UI-POLISH-BEFORE-FULL-TEST Verification

## Acceptance

- PASS: Reconciliation dùng ngôn ngữ ghi nhận; nhãn mở buổi theo DRAFT/COMPLETED/CANCELLED.
- PASS: Classes mặc định chỉ ACTIVE/PAUSED; search và đủ năm filter client-side, CLOSED vẫn truy cập được.
- PASS: Homepage bỏ phone, dùng đúng Facebook URL; Zalo/Facebook cùng hàng và bằng chiều rộng.
- PASS: Testimonial/contact pastel, smooth scroll có reduced-motion fallback, footer giữ nguyên nội dung.
- PASS: Không horizontal overflow tại 360×800, 390×844, 430×932 và 1440×900.

## Typecheck/lint

- `npm -w client run typecheck`: PASS.
- `npm -w client run lint`: PASS.
- `npm -w client run validate:public:self-test`: PASS.

## Unit/integration/E2E

- `node client/scripts/public-homepage.e2e.mjs`: PASS.
- `node client/scripts/schedule-operations.e2e.mjs`: PASS cho Classes/Reconciliation.
- `npm run check:full`: PASS, gồm build, unit, integration, toàn bộ E2E và repository consistency.

## Kiểm tra UI thủ công

- PASS tại bốn viewport yêu cầu; CTA không wrap, màu pastel hài hòa, contact/footer gọn.

## Tài liệu

- Đã cập nhật Homepage, Admin UI và UI guidelines liên quan.

## Final verdict

PASS
