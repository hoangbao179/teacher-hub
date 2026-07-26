# V16B-LEGACY-IMPORT-APPLY

Trạng thái: **PASS on 26/07/2026**

## Goal

Mở rộng preview V16A thành apply có xác nhận vào MySQL: lesson matching,
participant/attendance riêng, cycle tám buổi theo student, idempotency và audit.

## In scope

- Contract preview → confirmation → apply và lưu metadata filename/size/SHA-256/status/applied time.
- Row-resolution lifecycle `VALID`, `NEEDS_REVIEW`, `BLOCKED`, `RESOLVED`, `SKIPPED`;
  Apply chỉ mở khi không còn dòng unresolved/blocked.
- Structured decision cho sửa ngày, map period/class, attendance, exact/near lesson,
  conflict content và skip; không có force-import raw invalid row.
- Bulk decision chỉ cho cùng issue code + raw normalized value, hiển thị affected
  row count và yêu cầu confirmation.
- Xác minh workbook khớp student đang chọn; xử lý nhiều năm học/grade/class.
- Exact match theo class/date/scheduled time; near duplicate và conflict content/homework cần user decision.
- Import note từng file thành student-specific note; chỉ gợi ý general comment.
- Apply `PRESENT`, `ABSENT`, `FREE`; chỉ `PRESENT` tính học phí.
- Transaction MySQL nhiều bảng, audit và unique idempotency student + SHA-256.
- Audit mọi decision; skipped row giữ source sheet/row, raw hoặc sanitized snapshot,
  issue code, skip reason, actor và timestamp nhưng không ghi business table.
- Thiết kế/migration cần thiết để cycle dở tiếp tục theo student qua enrollment, đồng thời bảo toàn `PAID`.

## Out of scope

- Không OAuth, Drive, Sheets, Google client, external API hoặc outbox gọi Google.
- Không tạo/chia sẻ Google Sheet.
- Không giữ binary workbook lâu dài theo mặc định.
- Không cho skip row để vượt file-level error.

## Required reading

- `docs/features/student-parent-tracking.md`
- `docs/implementation/tasks/V16A-LEGACY-EXCEL-PREVIEW.md`
- `docs/features/class-and-student-management.md`
- `docs/features/lesson-recording.md`
- `docs/features/tuition-cycles.md`
- ADR participant, historical eligibility, late-entry và effective-dated tuition.
- Contracts `students.ts`, `lessons.ts`, `tuition.ts`, `legacy-import.ts`.

## Acceptance criteria

- Tất cả case import trong feature spec có kết quả explicit và được test.
- `VALID` được accepted tự động; `NEEDS_REVIEW`/`BLOCKED` chặn Apply cho tới khi
  thành `RESOLVED` hoặc `SKIPPED` bằng decision hợp lệ.
- Một row-level error có thể được skip hợp lệ mà không hủy cả file; file-level error
  vẫn chặn toàn file.
- Apply atomic; cùng student + SHA replay không tạo record/audit lần hai.
- Exact lesson reuse participant riêng; near match không tự merge.
- Duplicate/near-match và content conflict có structured decision; bulk decision
  không được áp dụng cho các dòng khác issue/value.
- Không tự biến note riêng thành general comment hoặc ghi đè conflict.
- Cycle dùng billable attendance, không nhóm mỗi tám dòng; `PAID` bất biến.
- Skipped row không ảnh hưởng cycle/progress và không tạo dữ liệu để sync Google.
- Mọi decision có audit đầy đủ; database mutation/audit lỗi rollback toàn bộ Apply.
- Không có network call Google trong service/transaction V16B.

## Files likely affected khi triển khai

`shared/src/contracts/legacy-import.ts`, migration mới, import/decision/audit tables,
legacy controller/service/repository/domain, tuition allocation, client preview/
resolution/apply UI và test tương ứng.

## Verification commands khi triển khai

```bash
npm run build:shared
npm -w server run typecheck
npm -w server run test
npm run test:integration
npm -w client run typecheck
npm -w client run lint
npm -w client run test:e2e:legacy-import
npm run check:full
```

## Documentation updates khi triển khai

Cập nhật source-of-truth, API/schema, user guide, status và migration notes; chỉ
đổi trạng thái sau khi acceptance thực sự PASS.
