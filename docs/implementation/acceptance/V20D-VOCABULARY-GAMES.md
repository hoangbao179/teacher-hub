# V20D — Vocabulary games acceptance

- [ ] Public routes đứng trước `router.use("/api", requireAuth)` và không trả roster.
- [ ] Session token >=32 random bytes, chỉ lưu hash, hết hạn sau 24 giờ inactivity
  và vô hiệu ngay khi assignment CLOSED.
- [ ] OPEN_LINK guest name optional, không map student và không enforce maxAttempts;
  recipient xác định được enforce đúng.
- [ ] Attempt creation snapshot seed/queue/prompt/options/answer; reload không đổi.
- [ ] Option không trùng sau normalization, meaning không trùng; minimum option
  2/3/4/4 theo age band và fallback thiếu ảnh/distractor có reason rõ.
- [ ] Replay cùng clientAnswerId trả kết quả cũ; transaction derive
  firstAttemptCorrect/finalCorrect/retryCount đúng và không double-count.
- [ ] Từ sai lặp sau 2–3 câu bằng mechanic/presentation khác.
- [ ] Flashcard không được tính graded mastery.
- [ ] Màn nghe-chọn-hình không hiện chữ đáp án trước khi trả lời.
- [ ] `/play/*` và result có noindex/nofollow/noarchive/no-referrer; limiter trả
  429 + Retry-After.
- [ ] Viewport 360–430 px không overflow, touch target >=56 px, keyboard/a11y
  targeted và full gate PASS.
