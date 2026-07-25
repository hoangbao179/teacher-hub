# V18C-V18D-COMPLETE-PUBLIC-LEARNING-EXPERIENCE Acceptance

> Verified: **PASS — 25/07/2026**

## Quiz, kết quả và review

- Quiz tối đa 10 câu, deterministic trong test, 3–4 lựa chọn duy nhất và đúng một đáp án.
- Chấm một lần mỗi câu, feedback text/icon/màu, resume sau refresh và kết quả đúng.
- Result trực tiếp khi chưa có attempt có empty state an toàn.
- Review chỉ gồm từ sai/cần ôn; đánh dấu đã nhớ không xóa lịch sử quiz.
- Quiz dùng `questions.length`: Unit mầm non giữ 10 câu, Global Success tạo đúng 6 câu.

## Progress và fallback

- Dữ liệu V18A/V18B migrate không mất tiến độ; input hỏng được validate an toàn.
- Lưu tối đa 10 attempts, best/latest/wrong/completion và active quiz theo Unit.
- Reset có confirm, xóa đúng một Unit; storage/audio/image failure không crash.

## SEO, accessibility và responsive

- Hub mở đủ mầm non và lớp 1–9; catalog có 2 Unit mầm non và 140 Global Success Unit.
- Danh sách Unit dùng grid 1/2/3 cột trên mobile/tablet/desktop; title dài không overflow.
- Hub/level/Unit có title, description, canonical, OG và prerender ổn định cho 154 trang public.
- Sitemap production có 154 URL duy nhất, sinh từ catalog; action/Admin/route demo cũ bị loại.
- Flashcard/listen/quiz/result/review `noindex`; route sai và Unit cross-level về public learning 404.
- aria-live, progress semantics, labels, focus/keyboard và reduced motion: PASS.
- 360×800, 375×812, 390×844, 400×930, 430×932, 768×1024 và 1440×900 không overflow.
- Ảnh hub/level/flashcard/quiz/result/review đã duyệt ở toàn bộ viewport, không commit artifact.

## Regression và verification

- Public flow không login, không gọi Admin API; Homepage/Admin/footer không regression.
- Typecheck, lint, 20 learning unit tests, production build, public E2E, integration,
  `check:full`, `check:repo` và diff checks: PASS.

## Nội dung

- Global Success starter có 6 từ cơ bản/Unit, tự biên soạn theo chủ đề và không
  phải học liệu chính thức của Nhà xuất bản.
- Nội dung cần cô Vy tiếp tục review và tăng `contentVersion` khi điều chỉnh.
- Language focus/ngữ pháp vẫn là draft, chưa triển khai hoặc đánh dấu completed.

## Verdict

PASS
