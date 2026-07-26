# V20F — Vocabulary stabilization acceptance

- [x] Wizard vẫn dùng được khi danh sách bộ từ rỗng; ba nguồn hiển thị độc lập.
- [x] Topic chọn CORE trước, không tự chọn EXTENDED quá target; tạo bộ từ một lần, refetch và tự chọn mà không reload.
- [x] Ownership `teacher_user_id`, route nội bộ và `returnTo` được giữ nguyên.
- [x] `imageSearchTerms` đi từ topic tới item/snapshot/editor/picker; provider disabled không chặn lưu và không spam request.
- [x] PRIMARY có weight 1; REVIEW/EXPOSURE có weight 0; retry tối đa một lần và queue không giữ orphan review.
- [x] SELECT_ONE, flashcard, build/missing word map một item; MATCH/MEMORY ghi kết quả riêng cho mọi item.
- [x] Memory mismatch tự úp, match giữ mở; match-pairs sửa được bằng click/keyboard; server chấm đáp án cuối.
- [x] Missing letter deterministic và chấm bằng opaque option ID; flashcard không tính điểm và chỉ lộ nghĩa sau reveal.
- [x] Feedback dùng tone đúng; bốn presentation có selected visual state và tôn trọng reduced motion.
- [x] Preview dùng nhãn tiếng Việt, nêu game/lượt/từ/ảnh/thời lượng; game cần ảnh có lý do và CTA.
- [x] Kết quả theo tuổi, chơi lại/ôn từ khó, teacher detail và review draft hoạt động.
- [x] Template Google v2 có năm tab; identified attempt enqueue idempotent, guest không enqueue và worker dùng safe cell.
- [x] Migration `0021` → `0022`, schema sạch, trigger/FK/unique/index và rollback DML transaction được integration test kiểm tra.
- [x] Unit, integration, targeted E2E và full repository gate PASS; ảnh responsive lưu ngoài docs wireframe.
- [ ] Smoke Pixabay thật: môi trường local không có key nên chưa chạy; fake-provider automation PASS.
- [ ] Smoke Google thật và restore drill VPS vẫn là operator gate của V20E, không phải local V20F gate.
