# Biên soạn nội dung góc học tiếng Anh

Nguồn nội dung tĩnh nằm tại
`client/src/features/learning/content/vocabularyCatalog.ts`.

## Thêm level hoặc Unit

- Level dùng đúng slug `mam-non` hoặc `lop-1` đến `lop-9`.
- Đặt `available: true` chỉ khi level có ít nhất một Unit `PUBLISHED` hợp lệ.
- Unit cần `id` và `slug` duy nhất, đúng `levelSlug`, `contentVersion` nguyên dương.
- Khi thay đổi danh sách từ hoặc đáp án của Unit đã phát hành, tăng
  `contentVersion`; chỉ progress của Unit đó sẽ được tạo lại.
- Unit published hiện cần ít nhất 6 từ có nghĩa phân biệt để tạo 4 lựa chọn.

## Thêm từ

Mỗi từ cần `id` duy nhất, từ tiếng Anh, phiên âm, nghĩa tiếng Việt, minh họa và
`speechText` hoặc audio. Ví dụ ngắn là tùy chọn. Không dùng nội dung hoặc media
không có quyền sử dụng.

## Asset

- Asset local đặt dưới `client/public/learning/` và tham chiếu bằng đường dẫn bắt
  đầu `/learning/`.
- URL ngoài phải là HTTPS đã được duyệt.
- Ảnh cần gọn, rõ ở mobile; lỗi tải ảnh phải có fallback.
- Audio ưu tiên asset đã duyệt; nếu thiếu, ứng dụng dùng Web Speech `en-US`.
- Cả audio asset và Web Speech phát ở 0.88x (bình thường) hoặc 0.6x (chậm)
  theo lựa chọn đã lưu của người học.
- Không autoplay, không thêm file dung lượng lớn nếu chưa có phê duyệt.

Chạy validator và test sau khi sửa catalog:

```bash
node client/scripts/validate-learning-catalog.mjs
npm -w client run test
```

## Progress local

Storage key giữ ổn định: `covy-learning-progress:v1`, `schemaVersion: 1`.
Mỗi Unit lưu flashcard/listen cùng `quizAttempts` (tối đa 10 lượt gần nhất),
`bestScore`, `latestScore`, `wrongItemIds`, `completedAt`, `reviewCompletedAt` và
`activeQuiz` để resume. Reader luôn validate/migrate dữ liệu V18A/V18B; JSON hỏng
hoặc storage bị chặn không được làm crash trang.

Tốc độ phát âm lưu riêng tại `covy-learning-settings:v1`; không gộp setting này
vào `covy-learning-progress:v1`.
