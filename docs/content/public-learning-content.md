# Biên soạn nội dung góc học tiếng Anh

Catalog runtime nằm tại `client/src/features/learning/content/`: hai Unit mầm non
được giữ trong `vocabularyCatalog.ts`, còn 140 Unit lớp 1–9 được import từ
`globalSuccessStarterUnits.ts`. Dữ liệu nguồn để rà soát nằm tại
`content-source/public-learning/global-success-starter/`.

Catalog hiện công khai đủ mầm non và lớp 1–9. Bộ Global Success starter gồm 6 từ
cơ bản cho mỗi Unit; đây là nội dung tự biên soạn theo chủ đề, không phải danh
sách từ chính thức hoặc đầy đủ của sách.

> Nội dung luyện tập được biên soạn độc lập, tham khảo chủ đề của bộ sách Global
> Success. Đây không phải học liệu chính thức của Nhà xuất bản.

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

## Tích hợp và duyệt nội dung Global Success

- Runtime catalog được ghép sau hai Unit mầm non; không sinh ID theo index vì ID
  Unit và vocabulary của gói starter phải ổn định để bảo toàn progress.
- Chỉ đặt level thành `available: true` sau khi level có ít nhất một Unit
  `PUBLISHED` hợp lệ và validator PASS.
- Cô Vy rà soát theo
  [`global-success-review-checklist.md`](global-success-review-checklist.md), gồm
  tên Unit, sáu từ cốt lõi, nghĩa, phiên âm và mức độ phù hợp. Khi thay danh sách
  từ hoặc đáp án của Unit đã public, tăng `contentVersion` của riêng Unit đó.
- Nguồn đối chiếu tên Unit được lưu trong
  [`global-success-sources.md`](global-success-sources.md); không đưa raw URL nguồn
  lên giao diện end-user.
- `drafts/globalSuccessLanguageFocus.json` chỉ là dữ liệu nháp với template chưa
  được cô Vy duyệt theo từng Unit. Language focus chưa được import vào runtime và
  chưa public trên UI.

Catalog dùng emoji và Web Speech, không gọi internet trong build/runtime, không
chứa audio hoặc hình ảnh chính thức. Không thêm nội dung sách, bài tập, hội thoại,
audio hay hình minh họa có bản quyền vào gói nguồn.

## Progress local

Storage key giữ ổn định: `covy-learning-progress:v1`, `schemaVersion: 1`.
Mỗi Unit lưu flashcard/listen cùng `quizAttempts` (tối đa 10 lượt gần nhất),
`bestScore`, `latestScore`, `wrongItemIds`, `completedAt`, `reviewCompletedAt` và
`activeQuiz` để resume. Reader luôn validate/migrate dữ liệu V18A/V18B; JSON hỏng
hoặc storage bị chặn không được làm crash trang.

Tốc độ phát âm lưu riêng tại `covy-learning-settings:v1`; không gộp setting này
vào `covy-learning-progress:v1`.
