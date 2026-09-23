# Monthly tuition

`GET /api/tuition/monthly` dựng board theo tháng dương lịch. Enrollment có
`tuitionExempt=false` xuất hiện khi có occurrence hợp lệ từ schedule/lesson projection
trong tháng; left join payment khiến row chưa persist có trạng thái `UNPAID`.

Numerator là số attendance `PRESENT`. `ABSENT` được hiển thị riêng. Denominator là
tổng occurrence hợp lệ của enrollment trong tháng, gồm cả buổi tương lai đã được
project từ lịch; occurrence `SKIPPED`, bản gốc đã `RESCHEDULED`, replacement bị hủy và
ngày ngoài active period bị loại. Lesson completed ngoài lịch vẫn được giữ bằng cách
lấy giá trị lớn hơn giữa projection và tổng attendance thực tế. Combined class, học
bù và reschedule tiếp tục dùng schedule/lesson engine hiện tại.

`PUT /api/tuition/monthly/{enrollmentId}/{year}/{month}/paid` upsert payment trong
transaction, ghi audit và trả `idempotent`. Student, enrollment và month được validate
trước khi insert; trong transaction enrollment được lock và kiểm tra lại. `amount` và
`note` tùy chọn; `paidAt` bắt buộc. Có payment row nghĩa là `PAID`; payment không có
status column và không được sửa hoặc đổi ngược.

Các bảng cycle/receipt/policy và legacy import đã bị drop bởi cleanup migration; runtime
không giữ nhánh compatibility với dữ liệu cũ.
