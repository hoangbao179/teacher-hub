# V18A-PUBLIC-LEARNING-FOUNDATION Implementation

## Phạm vi

Public `/hoc`, level/Unit foundation, static catalog, local progress và Homepage CTA.

## Vấn đề đã sửa

- Thêm shell/404/metadata public độc lập Admin và SPA fallback production có giới hạn.
- Seed 2 level, 4 Unit, 40 từ; validator chặn catalog lỗi trong build/test.
- Tách AuthProvider khỏi route public; thêm storage `covy-learning-progress:v1` an toàn.

## File chính đã đổi

`client/src/features/learning/`, `client/src/App.tsx`, Homepage, prerender và Nginx.

## API/schema thay đổi

Không có.

## Kiểm tra đã chạy

Targeted typecheck/lint/unit/build/E2E và `npm run check:full`: PASS.

## Điểm còn lại

Flashcard, audio và quiz thuộc V18B/V18C.

## Commit

`feat(learning): bổ sung nền tảng góc học tiếng Anh`
