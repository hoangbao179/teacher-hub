# V12A — Homepage content carousel

## Goal

Hoàn thiện Homepage công khai nhiều màu sắc vừa phải, phù hợp học sinh lớp 1–9 tại Huế, không thay đổi nghiệp vụ quản trị.

## Scope

- Hero carousel ba slide, chiều cao mobile cân đối, điều khiển chuột/bàn phím/swipe và reduced motion.
- Program cards, trang trí giáo dục, testimonial draft/publication safety, fallback topics.
- Contact ưu tiên Zalo, link hợp lệ mới hiển thị, footer chuyên nghiệp.
- Centralize temporary media and document replacement.
- Extend production validation and Homepage E2E at the approved viewports.

## Out of scope

CMS, public tuition pricing, real testimonial claims, Zalo/Facebook API and all lesson/tuition/schedule business changes.

## Verification gate

`npm run check:fast`, `npm run test:e2e`, `npm run build`, screenshots under `.agent-reports/v1-2-homepage/`, then V12A verification report ending in `PASS` or `FAIL`.
