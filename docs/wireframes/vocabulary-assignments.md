# Vocabulary assignments and games — wireframe notes

Các wireframe 22–26 mô tả feature `Vocabulary Assignments and Games` trong:

```text
docs/features/vocabulary-assignments-and-games.md
```

## Visual priority

1. Mobile 360–430 px là target bắt buộc.
2. Desktop là layout thích ứng riêng, không chỉ kéo giãn mobile.
3. Wireframe mô tả hierarchy và workflow, không phải final visual design.
4. UI production tiếp tục dùng MUI, `Be Vietnam Pro`, theme và token hiện tại.
5. Icon trong wireframe chỉ là ký hiệu; production dùng `@mui/icons-material` hoặc
   asset được duyệt.

## File map

| File | Nội dung |
|---|---|
| `22-vocabulary-assignment-teacher-mobile.*` | Wizard teacher mobile: người nhận, chủ đề, Từ cơ bản, image search, game template |
| `23-vocabulary-assignment-teacher-desktop.*` | Wizard desktop: stepper, word editor, preview và image search dialog |
| `24-vocabulary-games-student-mobile.*` | Start, nghe-chọn-hình, ghép cặp và phần thưởng trên mobile |
| `25-vocabulary-games-student-desktop.*` | Student game desktop không có Admin chrome |
| `26-vocabulary-assignment-results-responsive.*` | Dashboard kết quả mobile và desktop |

Mỗi file có bản SVG để chỉnh sửa và PNG để xem nhanh trong repository/UI review.
