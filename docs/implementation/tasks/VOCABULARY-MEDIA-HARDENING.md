# Vocabulary Media Hardening

## Mục tiêu

Ổn định queue gợi ý ảnh khi gặp 429; phân loại lỗi import; thêm upload an toàn;
quản lý vòng đời/dung lượng media; bỏ rate limit thấp ở public media và chuẩn bị
provider registry.

## Phạm vi

- Client picker/bulk modal, query fallback và curated local assets.
- Search/import/upload API, Pixabay coordinator và secure downloader.
- Migration lifecycle, cleanup/reconciliation/metrics và public delivery.
- Chỉ chạy unit/typecheck/lint/browser flow targeted theo yêu cầu.

## Rà soát request amplification

- Bulk dùng một query mặc định và tối đa một fallback khi kết quả rỗng.
- Đổi media type reset remote state và chờ thao tác bắt đầu; tìm lại chỉ chạy một từ.
- Coordinator serialize và chờ khoảng cách nội bộ; chỉ upstream cooldown mới trả 429.
- Import upstream 429 fail-fast; timeout/502/503/504 chỉ retry một lần với backoff ngắn.
- Targeted endpoint test xác minh thumbnail WebP sau import và cùng storage root.
