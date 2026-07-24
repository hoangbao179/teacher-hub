# V18C-V18D-COMPLETE-PUBLIC-LEARNING-EXPERIENCE Acceptance

> Verified: **PASS — 24/07/2026**

## Quiz, kết quả và review

- Quiz tối đa 10 câu, deterministic trong test, 3–4 lựa chọn duy nhất và đúng một đáp án.
- Chấm một lần mỗi câu, feedback text/icon/màu, resume sau refresh và kết quả đúng.
- Result trực tiếp khi chưa có attempt có empty state an toàn.
- Review chỉ gồm từ sai/cần ôn; đánh dấu đã nhớ không xóa lịch sử quiz.

## Progress và fallback

- Dữ liệu V18A/V18B migrate không mất tiến độ; input hỏng được validate an toàn.
- Lưu tối đa 10 attempts, best/latest/wrong/completion và active quiz theo Unit.
- Reset có confirm, xóa đúng một Unit; storage/audio/image failure không crash.

## SEO, accessibility và responsive

- Hub/level/Unit có title, description, canonical, OG và prerender/sitemap ổn định.
- Quiz/result/review `noindex`; route sai về public learning 404.
- aria-live, progress semantics, labels, focus/keyboard và reduced motion: PASS.
- 360×800, 375×812, 390×844, 400×930, 430×932, 768×1024 và 1440×900 không overflow.
- Ảnh hub/level/flashcard/quiz/result/review đã duyệt ở toàn bộ viewport, không commit artifact.

## Regression và verification

- Public flow không login, không gọi Admin API; Homepage/Admin/footer không regression.
- Typecheck, lint, 18 learning unit tests, production build, public E2E, integration,
  `check:full`, `check:repo` và diff checks: PASS.

## Verdict

PASS
