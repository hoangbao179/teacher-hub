# V16B-LEGACY-IMPORT-HARDENING Implementation

## Phạm vi

Parser, reconciliation, decisions, Apply cycle plan, UI và regression fixtures của legacy import.

## Vấn đề đã sửa

38 unresolved của long-history không phải 38 quyết định nghiệp vụ độc lập. Chúng bị
fan-out theo từng dòng do parser cố định cột, near matching đánh dấu used quá sớm,
và mỗi learning-only thiếu giờ/tuition-only tạo một review riêng. Header discovery,
exact reservation và grouped decisions loại bỏ ba nguồn fan-out này.

Header được tìm theo label `DATE`, `CONTENT`, `STT`, tên học viên, `ABSENCE`, `BTVN`,
`BÀI TẠI LỚP`, `GHI CHÚ`; value content là ô non-empty đầu tiên bên phải label.

Reconciliation reserve toàn bộ exact match trước, sau đó mới ghép near theo thứ tự
workbook và khoảng cách ngày. Duplicate tuition date giữ ngày learning và đưa hướng
sửa sang tuition.

Tuition-only billable được gom một nhóm, tạo lesson `COMPLETED`, attendance `PRESENT`,
nội dung rỗng và note nội bộ khôi phục lịch sử. Không tạo card cho từng dòng.

Apply nhận `tuitionCyclePlans`, ánh xạ từng source row sang attendance, validate PAID
đủ 8, member không trùng và loại FREE/ABSENT/OFF trước insert. Không regroup global.

## File chính đã đổi

Contracts legacy import, parser/reconciliation/preview/decisions, repository Apply,
LegacyImportPage và tests ẩn danh.

## API/schema thay đổi

Preview thêm cycle plans, minimal lesson groups và grouped decision actions. Không có migration.

## Kiểm tra đã chạy

Build/typecheck/lint, server unit, MySQL integration và targeted legacy-import E2E đều PASS.

## Điểm còn lại

Không có workbook thật trong source; không thay Excel report.

## Commit

Sẽ ghi hash sau khi commit.
