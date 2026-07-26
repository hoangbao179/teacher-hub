# V20E Implementation

## Phạm vi

Results theo assignment/recipient/từ, mastery, review draft, release hardening,
recovery-set và observability.

## Vấn đề đã sửa

- Tách aggregate authoritative recipient khỏi OPEN_LINK guest; chỉ graded exposure
  tham gia mastery.
- Thêm dashboard responsive, recipient detail và review assignment DRAFT.
- Harden accessibility, public/security boundary, media storage và safe logs.
- Thêm recovery-set MySQL + media kèm manifest/checksum và hướng dẫn restore.

## File chính đã đổi

`shared/src/contracts/vocabulary-results.ts`, migration `0020`,
`vocabulary-results.repository.ts`, `vocabulary-results.service.ts`,
`AssignmentResultsPage.tsx`, recovery scripts và tài liệu V20E.

## API/schema thay đổi

Thêm năm results/review API được bảo vệ, source review assignment và index phục vụ
attempt/question result aggregation.

## Kiểm tra đã chạy

Typecheck, lint, build, unit, integration, E2E, OpenAPI route check, responsive,
security, media recovery smoke và Docker Compose config đều đạt.

## Điểm còn lại

Operator/giáo viên cần duyệt Pixabay/seed content; cần chạy load/query-plan và
restore drill MySQL + media trên VPS mục tiêu.

## Commit

Chưa commit vì release acceptance chưa PASS đầy đủ.
