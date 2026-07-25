# Global Success starter content — lớp 1 đến lớp 9

Gói dữ liệu nháp để tích hợp vào **Góc học tiếng Anh miễn phí cùng cô Vy**.

## Phạm vi

- 9 khối lớp: lớp 1 đến lớp 9.
- 140 Unit theo tên mục lục đã đối chiếu.
- 840 mục từ cơ bản: 6 từ/Unit.
- `languageFocus` được giữ riêng làm bản nháp cho một task sau, chưa public.
- Dùng emoji và Web Speech; không chứa hình/audio chính thức của sách.

## Mức độ chính xác

- **Tên Unit:** đã đối chiếu từ các mục lục công khai, nhưng vẫn cần cô Vy kiểm tra đúng ấn bản đang dạy.
- **Từ vựng:** nội dung khởi đầu do hệ thống tự biên soạn theo chủ đề, không phải danh sách từ chính thức hoặc đầy đủ của sách.
- **Ngữ pháp/mẫu câu:** gợi ý cơ bản, chưa khẳng định là điểm ngữ pháp chính thức của từng Unit.
- Trạng thái toàn package là `DRAFT_REVIEW`; chỉ chuyển sang published sau khi giáo viên duyệt.

## Cấu trúc

```text
manifest.json
grades/lop-1.json ... grades/lop-9.json
drafts/globalSuccessLanguageFocus.json
unit-summary.csv
```

Runtime đã tích hợp nằm tại:

```text
client/src/features/learning/content/globalSuccessStarterUnits.ts
```

Quy trình tích hợp và review được duy trì tại
`docs/content/public-learning-content.md` và
`docs/content/global-success-review-checklist.md`.
