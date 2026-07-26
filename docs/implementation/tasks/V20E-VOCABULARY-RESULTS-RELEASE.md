# V20E — Vocabulary results and release

## Trạng thái

**IMPLEMENTED — RELEASE GATES PENDING**

## Phạm vi

- Aggregate kết quả theo assignment/student/word từ graded exposure.
- Mastery, responsive dashboard và review assignment draft không auto-publish.
- Hoàn thiện accessibility, child safety, rate-limit/security review và performance.
- Cập nhật Compose/config/proxy/CSP, named volume, media capacity monitoring,
  backup/restore và restore drill.
- Chạy content review, responsive evidence và full regression trước release.

## Ngoài phạm vi

- Parent/student account, notification, manual upload, multiplayer, AI speech.

## Dependency và verification

Phụ thuộc V20A–V20D. Chỉ release sau khi toàn bộ
[acceptance V20E](../acceptance/V20E-VOCABULARY-RESULTS-RELEASE.md), regression,
operator config và restore drill đạt PASS.

Implementation và full regression đã hoàn tất ngày 26/07/2026. Hai release gate
ngoài môi trường phát triển vẫn mở: operator/giáo viên duyệt Pixabay/seed content
và restore drill MySQL + media trên VPS mục tiêu.
