# 03. Business rules

## Lớp, ghi danh và lịch

1. V1 có một giáo viên/admin; một học sinh tối đa một enrollment `ACTIVE`.
2. `ONE_TO_ONE` và `GROUP` dùng chung domain. Đóng lớp/ngừng học giữ lịch sử.
3. Recurring schedule chỉ là lịch dự kiến. `DRAFT`/`CANCELLED` không chứng minh đã dạy.
4. Học bù có thể chỉ gồm một số học sinh. Combined class lưu lesson con canonical
   cho từng lớp. Busy slot không tạo student, attendance hoặc học phí.

## Điểm danh

1. Runtime chỉ ghi `PRESENT | ABSENT`; mọi participant mặc định `PRESENT`.
2. Tuition mode `FREE` là billing concern, không phải attendance status.
3. `studentNote`, nội dung, bài tập và nhận xét chung đều nullable.
4. Dữ liệu lịch sử `FREE` được đọc như `PRESENT`; migration không rewrite lịch sử.
5. Thời lượng thực tế là phút nguyên để theo dõi, không tác động học phí.

## Học phí theo tháng

1. Kỳ theo tháng dương lịch tại `Asia/Ho_Chi_Minh` và thuộc một enrollment.
2. Summary chỉ lấy lesson `COMPLETED` trong tháng cùng participant snapshot thực tế.
3. `PRESENT` tăng present/total; `ABSENT` tăng absent/total. Draft/cancelled/skip
   không tăng; học bù chỉ tính participant tham gia; đổi lịch tính theo ngày lesson.
4. Enrollment `FREE` không có row/payment tháng.
5. Trạng thái là `UNPAID | PAID`. Row `UNPAID` có thể được suy ra dù chưa có record.
6. Mark paid lưu ngày thu, amount VND tùy chọn và note trong một transaction có audit.
   Replay cùng payload là idempotent; record `PAID` không được sửa hoặc mở lại.
7. Không suy amount tháng từ giá gói/cycle cũ và không backfill tự động.
8. Bảng cycle/receipt/policy cũ chỉ là dữ liệu lịch sử; runtime tháng không đọc/ghi.

## Google Sheet và dữ liệu

1. MySQL là nguồn chuẩn; Google API không được gọi trong transaction database.
2. Outbox có revision, retry và idempotency; sửa cùng lesson cập nhật cùng row.
3. Không hard-delete dữ liệu nghiệp vụ; tiền là integer VND, ngày là `DATE`, giờ là
   `TIME` và UI hiển thị theo `Asia/Ho_Chi_Minh`.
