# V20E — Vocabulary results and release acceptance

- [x] Aggregate chỉ dùng graded exposure; OPEN_LINK được tách khỏi authoritative
  student results.
- [x] Dashboard theo recipient/word đúng first/final result và mobile dùng card,
  desktop dùng layout thích ứng.
- [x] Review CTA tạo DRAFT mới chứa từ cần ôn, không copy attempt và không publish.
- [x] WCAG AA, keyboard, reduced motion, text/icon feedback và touch target đạt.
- [x] Token/raw answer/student roster không vào logs/analytics; public enumeration,
  limiter, CSP/referrer/robots và media response được security test.
- [ ] Query plan/load test đạt budget đã ghi bằng dữ liệu đại diện trên VPS mục tiêu;
  game lazy-load và không tải toàn catalog/media.
- [x] Compose có `vocabulary-media:/app/data/vocabulary-media`; binary không ở
  writable layer hoặc MySQL.
- [ ] Backup tạo manifest/checksum nhất quán cho MySQL + media; restore cô lập và
  kiểm tra media ID/bytes/assignment/playback thành công.
- [ ] Pixabay key/terms và seed meaning/alt/image được operator/giáo viên duyệt.
- [x] Responsive regression tại 360, 375, 390, 393, 400, 412, 430, 768, 1440 px;
  `npm run check:full` PASS và status chỉ đổi sau verification.
