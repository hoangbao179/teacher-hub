# ARASAAC-VOCABULARY-MEDIA Implementation

## Phạm vi

ARASAAC provider, provider selection/config, import lifecycle, stored-media validation,
picker/bulk UI, deployment examples/CSP và tài liệu API/vận hành.

## Vấn đề đã sửa

- Service/registry/status ghim Pixabay và giả định provider luôn tồn tại.
- Import thất bại khi asset hợp lệ nằm ngoài 100 cache record gần nhất.
- Lưu set chỉ kiểm tra media ID là số dương, có thể để FK/status lỗi muộn.
- Thumbnail `cover` có thể crop pictogram; UI/message/filter hardcode Pixabay.
- Request import đồng thời có thể cùng tải và ghi file trước khi unique key phân xử.

## File chính đã đổi

- `server/src/integrations/images/arasaac-image-search.provider.ts`
- `server/src/services/vocabulary-media.service.ts`
- `server/src/repositories/vocabulary.repository.ts`
- `server/src/services/secure-image-downloader.ts`
- `client/src/features/vocabulary/components/VocabularyImagePicker.tsx`
- `client/src/features/vocabulary/components/VocabularyBulkImageSuggestions.tsx`
- `shared/src/contracts/vocabulary.ts`

## API/schema thay đổi

Thêm provider `ARASAAC`; status trả primary provider và danh sách ARASAAC/Pixabay.
Không đổi route. Không cần migration vì `provider` là `VARCHAR(50)` và unique key hiện
tại đã áp dụng được.

## Kiểm tra đã chạy

Unit server/client, typecheck, lint, build, MySQL integration và targeted vocabulary
media E2E. Chi tiết nằm trong verification report.

## Điểm còn lại

Pixabay live bị 429 sau truy vấn đầu nên chưa có head-to-head đầy đủ cho cả chín từ.
Screenshot test nằm trong `test-results/` và không commit theo quy ước repository.

## Commit

Hash và message được ghi trong final response sau khi commit.
