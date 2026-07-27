# VOCABULARY-MEDIA-HARDENING Implementation

## Phạm vi

Toàn bộ Vocabulary Media client/server/storage/public delivery trong yêu cầu.

## Vấn đề đã sửa

Queue 429 làm mất trạng thái; import generic 422; tải ảnh thiếu retry; chưa có upload;
media orphan và public limiter thấp.

## File chính đã đổi

Bulk/picker/strategy client; provider/coordinator/downloader/media service/repository;
migration `0024`; routes/contracts/OpenAPI.

## API/schema thay đổi

Thêm upload, metrics, reconcile; provider `USER_UPLOAD`; trạng thái `TEMPORARY` và
`thumbnail_byte_size`; thêm error code import cụ thể.

## Kiểm tra đã chạy

Targeted server/client unit, typecheck, related lint và targeted browser flow.

## Điểm còn lại

Coordinator in-memory chỉ dành cho một instance; registry chưa tích hợp Pexels.

## Commit

Xem commit hash trong final response.
