# VOCABULARY-GAME-HARDENING Acceptance

- [x] Unsupported mechanic/presentation và zero-question assignment bị chặn khi publish.
- [x] Client/backend thống nhất giới hạn 8 activity.
- [x] Shuffle false giữ display order; shuffle true deterministic theo seed.
- [x] `REMEMBERED`/`REVIEW` được phân biệt và review có weight 0.
- [x] Sai lần đầu vẫn tạo adaptive review cho select/build/match/memory.
- [x] Pair scoring và completion dùng vocabulary item; response trả passScore/passed.
- [x] Start/answer/completion recovery idempotent; client giữ session trong sessionStorage.
- [x] Topic request chống stale response; auto-title không lưu placeholder cũ.
- [x] Audio unavailable không crash và có feedback.
- [x] Vocabulary Google Sheet sync upsert incremental.
- [x] Targeted build, typecheck, lint, unit và MySQL integration PASS.
- [x] Student Playwright flow riêng xác nhận REVIEW, reload/resume, chống double-submit,
  completion retry/idempotency và passScore/passed.
- [x] Speech synthesis fallback đã triển khai và không làm game crash khi unavailable.
- [x] Approved audio asset được defer vì assignment snapshot chưa có audio source;
  đây không phải gate của hardening hiện tại.
