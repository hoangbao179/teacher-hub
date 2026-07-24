# V18B-PUBLIC-LEARNING-FLASHCARDS Acceptance

> Verified: **PASS — 24/07/2026**

## Routes và Unit

- Unit đúng level mở overview; Unit sai/không tồn tại hiển thị public 404.
- Overview có số từ, progress, CTA flashcard/listen và quay lại danh sách.
- Không hiển thị quiz tổng hợp như chức năng đã hoạt động.

## Flashcard và audio

- Card có hình, từ, phiên âm, nghĩa, ví dụ tùy chọn, audio và vị trí.
- Previous/next, swipe, Left/Right, remembered/review và reload hoạt động.
- Audio ưu tiên asset, fallback Web Speech `en-US`, không autoplay/overlap.
- Khi audio không khả dụng có message rõ và trang không crash.

## Listen và progress

- Từ bị ẩn trước khi trả lời; 4 nghĩa duy nhất lấy cùng Unit và deterministic.
- Feedback đúng/sai có text/icon/aria-live; no-audio không tính điểm.
- Progress V18A migrate an toàn; fields V18B persist; reset chỉ xóa một Unit.

## Quality

- A11y keyboard/focus/audio labels/progress: PASS.
- Responsive 360, 390, 400, 430, 768, 1440 và không overflow: PASS.
- Homepage/Admin/API isolation regression: PASS.
- Typecheck, lint, unit, E2E, production build, `check:full`, `check:repo`: PASS.

## Verdict

PASS
