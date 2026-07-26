# V20A — Vocabulary foundation

## Trạng thái

**PLANNED**

## Phạm vi

- Tạo migration forward-only cho topic catalog, vocabulary set/item và integrity
  cần thiết; migration mới phải sau `0015_harden_google_before_oauth.sql`.
- Khai báo `VocabularyAgeBand`, media/source/tier enum, DTO và validation trong
  `@teacher/shared`.
- Seed topic catalog có core/extended priority và age bands.
- Xây API topic suggestion, vocabulary set CRUD/duplicate và import Public Unit.
- Client authenticated gửi full Public Unit snapshot; server validate toàn bộ và
  ghi atomic, không đọc file runtime của client.

## Ngoài phạm vi

- Pixabay/media binary, assignment, public game, result.
- Thay đổi class để thêm grade hoặc suy age band từ tên lớp.

## Dependency và verification

Không phụ thuộc V20B–V20E. Chạy build shared, typecheck, backend unit/integration,
frontend targeted check và gate `npm run check:full`; chỉ PASS khi
[acceptance V20A](../acceptance/V20A-VOCABULARY-FOUNDATION.md) đạt đủ.
