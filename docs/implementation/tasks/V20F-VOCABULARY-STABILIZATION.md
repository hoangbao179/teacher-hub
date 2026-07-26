# V20F — Ổn định vocabulary assignment, game, media và sheet sync

## Trạng thái

**IMPLEMENTED — LOCAL VERIFICATION COMPLETE**

## Phạm vi

- Hoàn thiện wizard khi giáo viên chưa có bộ từ, tạo bộ từ từ topic và quay lại từ editor.
- Giữ `imageSearchTerms` xuyên suốt catalog, bộ từ và assignment snapshot; làm rõ trạng thái Pixabay tắt.
- Chuẩn hóa queue PRIMARY/REVIEW/EXPOSURE, retry một lần và analytics theo từng item cho game đơn/cặp.
- Hoàn thiện flashcard, memory, missing letter, bốn presentation vui nhộn và kết quả theo tuổi.
- Đồng bộ attempt của học sinh vào tab `Ôn từ vựng` bằng transactional outbox.
- Bổ sung migration `0021`/`0022`, regression, E2E responsive và bằng chứng ảnh.

## Ngoài phạm vi

- Provider ảnh khác Pixabay, tài khoản học sinh/phụ huynh, multiplayer, payment hoặc thay đổi nghiệp vụ học phí.
- Duyệt nội dung production, smoke Pixabay/Google thật khi môi trường không có credential, restore drill trên VPS.

## Dependency và verification

Tiếp quản trực tiếp working tree sau V20A–V20E; không sửa ngược migration đã áp dụng.
Acceptance chi tiết nằm tại
[V20F acceptance](../acceptance/V20F-VOCABULARY-STABILIZATION.md).
