# V18A-PUBLIC-LEARNING-FOUNDATION

## Mục tiêu

Tạo nền tảng đầu tiên cho **Góc học tiếng Anh miễn phí cùng cô Vy** tại `/hoc`,
không yêu cầu đăng nhập, dành cho mầm non đến lớp 9 và không phụ thuộc dữ liệu
Admin.

Feature source of truth:

```text
docs/features/public-english-learning-corner.md
```

Wireframe tham chiếu:

```text
docs/wireframes/19-public-english-learning-corner.png
```

## Phạm vi

### Content foundation

- Tạo `LearningLevelSlug` cho `mam-non`, `lop-1` đến `lop-9`.
- Tạo type `VocabularyWord`, `VocabularyUnit` và catalog.
- Tạo validator cho catalog published.
- Seed tối thiểu 2 Unit published thuộc ít nhất 1 level.
- Mỗi Unit có 10–15 từ và tối thiểu 1 từ thiếu image/audio để test fallback.
- Không dùng nội dung có bản quyền không được phép.

### Public learning shell

- Thêm route `/hoc` ngoài `AdminLayout`.
- Tạo learning header/shell riêng, mobile-first.
- Hiển thị hero và ba nhóm level: Mầm non, Tiểu học, THCS.
- Level có nội dung published điều hướng được.
- Level chưa có nội dung hiển thị `Sắp có` và không điều hướng.
- Thêm public not-found thân thiện cho route learning không hợp lệ.
- Direct refresh `/hoc` và route learning đã có phải hoạt động trên production build.

### Homepage integration

- Thêm CTA gọn dẫn tới `/hoc`.
- Không thiết kế lại Homepage.
- Không khôi phục slide/carousel.
- Không thay contact hoặc footer.

Footer phải giữ nguyên:

```text
2026 — từ người hâm mộ cô Vy, with love ❤️
```

### Local progress foundation

- Tạo storage adapter với key `covy:english-learning-progress:v1`.
- Lưu level gần nhất.
- JSON hỏng, schema cũ hoặc write failure không làm crash trang.
- Chưa cần hoàn thiện progress của flashcard/quiz trong V18A.

### Visual foundation

- Dùng lavender/purple làm màu chính.
- Accent sky blue, mint, warm yellow, coral và soft pink.
- Card bo góc 20–24 px, pastel border, shadow mềm.
- Decoration cute: sao, mây, trăng, sách, bút chì, sparkle.
- Decoration `aria-hidden`, `pointer-events: none`.
- Không animation liên tục; tôn trọng `prefers-reduced-motion`.
- Giao diện không quá trẻ con đối với học sinh THCS.
- Không làm thay đổi visual Admin.

## Ranh giới

- Không thêm API hoặc migration.
- Không thêm auth học sinh/phụ huynh.
- Không dùng admin token hoặc admin API.
- Không thêm CMS/import Excel.
- Không bắt buộc flashcard/quiz hoàn chỉnh trong V18A.
- Không sửa business rule lớp học/học phí/lịch học.
- Không cập nhật `docs/implementation/status.md` thành implemented trước verification.

## Cấu trúc gợi ý

```text
client/src/features/learning/
  content/
  components/
  pages/
  storage/
  quiz/
  types.ts
```

Public page không gọi `fetch` trực tiếp. Nếu V18A không có backend call thì không
được tạo API giả chỉ để giữ cấu trúc.

## Kiểm tra bắt buộc

### Targeted

```bash
npm run build:shared
npm -w client run typecheck
npm -w client run lint
```

- unit test catalog validator;
- unit test storage corrupt/schema/write failure;
- component test level available/`Sắp có`;
- E2E Homepage -> `/hoc`;
- E2E direct navigation `/hoc`;
- kiểm tra không có admin API call trong learning flow.

### Responsive/visual

Kiểm tra:

```text
360x800
375x812
390x844
393x852
400x930
412x915
430x932
768x1024
1440x900
```

Xác nhận:

- không page-level horizontal scroll;
- CTA và level card không bị che;
- safe area mobile hợp lệ;
- màu sắc cute nhưng text dễ đọc;
- Admin và Homepage không regression.

### Gate cuối

```bash
npm run check:full
npm run check:repo
git diff --check
```

## Commit sau PASS

```text
feat(learning): tạo nền tảng góc học tiếng Anh miễn phí
```

Không push.
