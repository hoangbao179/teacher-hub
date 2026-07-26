# V20D — Vocabulary games acceptance

- [x] Public routes đứng trước `router.use("/api", requireAuth)` và không trả roster.
- [x] Session token >=32 random bytes, chỉ lưu hash, hết hạn sau 24 giờ inactivity
  và vô hiệu ngay khi assignment CLOSED.
- [x] OPEN_LINK guest name optional, không map student và không enforce maxAttempts;
  recipient xác định được enforce đúng.
- [x] Attempt creation snapshot seed/queue/prompt/options/answer; reload không đổi.
- [x] Option không trùng sau normalization, meaning không trùng; minimum option
  2/3/4/4 theo age band và fallback thiếu ảnh/distractor có reason rõ.
- [x] Replay cùng clientAnswerId trả kết quả cũ; transaction derive
  firstAttemptCorrect/finalCorrect/retryCount đúng và không double-count.
- [x] Từ sai lặp sau 2–3 câu bằng mechanic/presentation khác.
- [x] Flashcard không được tính graded mastery.
- [x] Màn nghe-chọn-hình không hiện chữ đáp án trước khi trả lời.
- [x] `/play/*` và result có noindex/nofollow/noarchive/no-referrer; limiter trả
  429 + Retry-After.
- [x] Viewport 360–430 px không overflow, touch target >=56 px, keyboard/a11y
  targeted và full gate PASS.
