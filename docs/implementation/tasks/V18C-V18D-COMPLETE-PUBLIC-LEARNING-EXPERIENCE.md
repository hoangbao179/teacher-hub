# V18C-V18D-COMPLETE-PUBLIC-LEARNING-EXPERIENCE

## Mục tiêu

Hoàn thiện luồng quiz, kết quả, ôn từ và release quality cho góc học tiếng Anh
công khai trên nền V18A–V18B.

## Phạm vi

- Route `quiz`, `result`, `review` có validation level/Unit.
- Câu hỏi deterministic, chấm điểm, resume sau refresh và lịch sử tối đa 10 lượt.
- Kết quả khích lệ, ôn từ sai/cần ôn, reset đúng một Unit.
- Migration progress V18A/V18B, fallback storage/audio/media an toàn.
- Canonical, Open Graph, noindex route tạm, sitemap và prerender route ổn định.
- Accessibility, responsive và Playwright tại toàn bộ viewport yêu cầu.

## Ngoài phạm vi

Backend/API/database, tài khoản học sinh, CMS, leaderboard, chia sẻ kết quả,
quảng cáo, analytics theo trẻ em, Admin và thay đổi Homepage.

## Verification

Typecheck, lint, unit, production build, public learning E2E, `check:full`,
`check:repo` và `git diff --check`.

## Commit sau PASS

`feat(learning): hoàn thiện góc học tiếng Anh miễn phí`
