# V14 Schedule History Makeup Integrity

## Mục tiêu

Bảo toàn dữ liệu lesson và lịch lặp theo thời điểm nghiệp vụ; hỗ trợ pause/resume
theo ngày, cancel/skip/makeup có liên kết nguồn, đổi lịch tạm thời và cảnh báo
conflict nhất quán.

## Phạm vi

- Migration snapshot tên hiển thị, active periods, cancellation và makeup mapping.
- Versioning recurring schedule và projection theo lịch sử hoạt động.
- Luồng nghỉ/hủy/học bù subset, temporary reschedule và conflict preflight.
- UI Calendar, lesson wizard, class/student status, login và giới thiệu cô Vy.
- Contracts, OpenAPI, tài liệu, unit/integration/E2E liên quan.

## Checkpoint

1. Phase A: schema, snapshot và active periods — là nền cho eligibility lịch sử.
2. Phase B: schedule identity/versioning/projection — phụ thuộc active periods.
3. Phase C: cancel/makeup/reschedule/conflict/UI — phụ thuộc projection ổn định.
