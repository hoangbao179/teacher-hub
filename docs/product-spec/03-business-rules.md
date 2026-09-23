# 03. Business rules

## Lớp, ghi danh và lịch

1. V1 có một giáo viên/admin; một học sinh tối đa một enrollment `ACTIVE`.
2. `ONE_TO_ONE` và `GROUP` dùng chung domain. Đóng lớp/ngừng học giữ lịch sử.
3. Recurring schedule chỉ là lịch dự kiến. `DRAFT`/`CANCELLED` không chứng minh đã dạy.
4. Học bù có thể chỉ gồm một số học sinh. Combined class lưu lesson con canonical
   cho từng lớp. Busy slot không tạo student, attendance hoặc học phí.

## Điểm danh

1. Runtime chỉ ghi `PRESENT | ABSENT`; mọi participant mặc định `PRESENT`.
2. Miễn học phí là cờ `tuitionExempt` trên enrollment, không phải attendance status.
3. `studentNote`, nội dung, bài tập và nhận xét chung đều nullable.
4. Thời lượng thực tế là phút nguyên để theo dõi, không tác động học phí.

## Học phí theo tháng

1. Kỳ theo tháng dương lịch tại `Asia/Ho_Chi_Minh` và thuộc một enrollment.
2. Numerator là số attendance `PRESENT`; số vắng là attendance `ABSENT`.
3. Denominator là tổng occurrence hợp lệ của enrollment trong tháng từ schedule/lesson
   projection hiện tại, không phải cycle 8 buổi và không chỉ đếm lesson đã completed.
   Skip, bản gốc rescheduled, replacement bị hủy và ngày ngoài active period không tính.
4. Học bù chỉ tính participant tham gia; đổi lịch tính theo ngày occurrence thực tế;
   combined class tiếp tục dùng lesson con canonical.
5. Enrollment có `tuitionExempt=true` không có row/payment tháng.
6. Không có payment row là `UNPAID`; có payment row là `PAID`.
7. Mark paid validate student/enrollment/month trước insert, lưu ngày thu, amount VND
   tùy chọn và note trong một transaction có audit.
   Replay cùng payload là idempotent; record `PAID` không được sửa hoặc mở lại.
8. Không suy amount tháng từ giá gói và không có cycle/receipt/policy runtime.

## Google Sheet và dữ liệu

1. MySQL là nguồn chuẩn; Google API không được gọi trong transaction database.
2. Outbox có revision, retry và idempotency; sửa cùng lesson cập nhật cùng row,
   append row mới giữ format và mỗi sync cập nhật `Cập nhật gần nhất`.
3. Không hard-delete dữ liệu nghiệp vụ; tiền là integer VND, ngày là `DATE`, giờ là
   `TIME` và UI hiển thị theo `Asia/Ho_Chi_Minh`.
