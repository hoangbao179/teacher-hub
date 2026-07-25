# V19A-PUBLIC-HOMEPAGE-SINGLE-LOCATION-GOOGLE-MAPS Implementation

## Phạm vi

Homepage một cơ sở, Hero CTA, trust strip, Google Maps tùy chọn/fallback và SEO.

## Vấn đề đã sửa

Thay mô hình hai địa điểm bằng một cơ sở canonical; nhận dạy tại nhà là dịch vụ.
Maps Embed chỉ tải khi có key, mặc định hiển thị card local và link an toàn.

## File chính đã đổi

`publicHome.ts`, `HomePage.tsx`, `RouteMetadata.tsx`, `index.html`, E2E và tài liệu V19A.

## API/schema thay đổi

Không có API/database. Thêm env tùy chọn `VITE_GOOGLE_MAPS_EMBED_API_KEY`.

## Kiểm tra đã chạy

Typecheck, lint, unit/static, Homepage E2E, production build và full repository gates.

## Điểm còn lại

Embed thật cần API key hợp lệ trong môi trường triển khai; fallback không cần key.

## Commit

Commit hash được ghi trong final response sau khi toàn bộ gate PASS.
