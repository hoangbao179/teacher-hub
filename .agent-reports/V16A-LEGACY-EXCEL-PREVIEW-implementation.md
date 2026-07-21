# V16A-LEGACY-EXCEL-PREVIEW Implementation

## Phạm vi

Parser + preview/audit workbook lịch sử theo học sinh; không có apply hoặc migration.

## Vấn đề đã sửa

Đọc đủ block học tập, suy năm từ sheet học phí, đối soát bảy trạng thái, mô phỏng
chu kỳ 8 buổi/payment event và chia academic period có mapping lớp dự kiến.

## File chính đã đổi

Contracts shared, bốn domain component legacy, multipart API/service, màn
`LegacyImportPage`, unit/integration/E2E và tài liệu API.

## API/schema thay đổi

Thêm `POST /api/students/{studentId}/legacy-imports/preview`; không đổi schema DB.

## Kiểm tra đã chạy

Shared/server/client targeted checks, integration, targeted E2E, `check:full` và
`check:repo` đều PASS.

## Điểm còn lại

Apply dữ liệu là phạm vi V16B; V16A không tạo lesson/class/enrollment/tuition.

## Commit

Commit hash được ghi trong final response sau khi tạo commit cuối.
