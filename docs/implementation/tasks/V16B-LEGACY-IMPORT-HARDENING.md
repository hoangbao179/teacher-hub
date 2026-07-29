# V16B-LEGACY-IMPORT-HARDENING

Trạng thái: **PASS on 29/07/2026**

## Mục tiêu

Làm importer workbook lịch sử chịu được layout thực tế, gom quyết định lặp lại và
giữ nguyên member của từng cycle từ Preview tới Apply.

## Phạm vi

- Header động cho sheet quá trình học tập.
- Marker học phí `BILLABLE/FREE/ABSENT/OFF`, sửa ngày/giờ và reconciliation nhiều pha.
- Quyết định nhóm cho time mapping, learning-only, tuition-only và payment block.
- Cycle plan theo block/source row với validation trước khi insert.
- Fixture ẩn danh long-history, shifted columns, no-PAID và V/OFF/duplicate-date.
- UI mobile và API contract liên quan.

## Ngoài phạm vi

- Không sửa Excel report A:I/A:F.
- Không lưu workbook thật hoặc dữ liệu học sinh thật.
- Không đổi business rule gói 8 buổi hoặc trạng thái PAID bất biến.

## Verification

Theo các targeted command trong AGENTS.md và yêu cầu task.
