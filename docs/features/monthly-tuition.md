# Monthly tuition

`GET /api/tuition/monthly` dựng board theo tháng dương lịch từ lesson completed và
participant snapshot. Một enrollment có tuition mode khác `FREE` xuất hiện khi có
lesson hợp lệ trong tháng; left join payment khiến row chưa persist có trạng thái
`UNPAID`.

Summary đếm `PRESENT` (kể cả lịch sử `FREE` đã normalize) và `ABSENT`; draft,
cancelled, skip và học sinh không thuộc snapshot bị loại. Combined class, học bù và
reschedule dùng chính lesson canonical nên không có nhánh tính riêng.

`PUT /api/tuition/monthly/{enrollmentId}/{year}/{month}/paid` upsert payment trong
transaction, ghi audit và trả `idempotent`. `amount` và `note` tùy chọn; `paidAt` bắt
buộc. `PAID` không được sửa hoặc đổi ngược.

Các bảng cycle/receipt/policy trước đây được giữ nguyên như lịch sử nhưng không có
repository/service/router/UI runtime. Không tự map cycle qua tháng vì cycle có thể
đi qua ranh giới tháng và tạo kết quả tài chính sai.
