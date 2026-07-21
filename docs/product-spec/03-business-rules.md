# 03. Business Rules

## BR-01. Lớp và học sinh
1. Hệ thống chỉ có một giáo viên trong V1.
2. Lớp có loại `ONE_TO_ONE` hoặc `GROUP`, nhưng dùng chung một mô hình nghiệp vụ.
3. Một học sinh chỉ có tối đa một `ClassEnrollment` trạng thái `ACTIVE` tại một thời điểm.
4. Không xóa cứng lớp, học sinh hoặc ghi danh đã phát sinh buổi học/học phí.

## BR-02. Lịch học
1. `RecurringSchedule` là lịch dự kiến, không tự động được coi là đã học.
2. Đổi lịch chỉ áp dụng cho một occurrence cụ thể, không thay đổi lịch lặp của lớp.
3. Nghỉ/hủy occurrence không tính buổi và không tính phí.
4. Lịch dạy ở trường chỉ là `TeacherBusySlot`, dùng để hiển thị và cảnh báo trùng lịch; không có học sinh, điểm danh hoặc học phí.

## BR-03. Buổi học và thời gian
1. Lưu riêng giờ dự kiến và giờ thực tế.
2. Giờ thực tế có thể muộn hơn, sớm hơn hoặc kéo dài hơn lịch dự kiến.
3. Thời lượng thực tế chỉ để theo dõi và xuất Excel, không đổi số buổi.
4. Một buổi hoàn thành chỉ tính tối đa một buổi cho mỗi học sinh.
5. Loại buổi: `REGULAR`, `MAKEUP`, `EXTRA`.
6. Trạng thái: `DRAFT`, `COMPLETED`, `CANCELLED`.

## BR-04. Điểm danh và tính phí
UI hiển thị ba lựa chọn:
- **Có mặt:** học sinh có học và buổi được tính vào gói 8 buổi.
- **Nghỉ:** không tính buổi, không tính phí.
- **Miễn phí:** có học nhưng không cộng vào gói và không tính phí.

Ở dữ liệu nên tách:
- `attendanceStatus`: `PRESENT` hoặc `ABSENT`.
- `billingType`: `BILLABLE`, `FREE`, hoặc `NONE`.

## BR-05. Giá học phí
1. Lớp có `defaultPackagePrice` cho 8 buổi.
2. Mỗi ghi danh có `tuitionMode`: `CLASS_DEFAULT`, `CUSTOM`, hoặc `FREE`.
3. `CUSTOM` có giá riêng; `FREE` không tạo chu kỳ học phí.
4. Giá được snapshot khi buổi tính phí đầu tiên của chu kỳ được ghi nhận.
5. Thay đổi giá chỉ áp dụng từ chu kỳ tiếp theo, không đổi chu kỳ đã tồn tại.
6. Tiền lưu số nguyên VND.

## BR-06. Chu kỳ 8 buổi
1. Chu kỳ thuộc từng học sinh trong từng ghi danh, không thuộc chung cả lớp.
2. Chỉ attendance `PRESENT + BILLABLE` mới được phân bổ vào chu kỳ.
3. Mỗi chu kỳ có đúng 8 buổi tính phí khi hoàn thành.
4. Khi thêm buổi thứ 8, hệ thống tự chuyển chu kỳ sang `PAYMENT_DUE`.
5. Buổi tính phí tiếp theo tạo/đưa vào chu kỳ mới, kể cả chu kỳ trước chưa thanh toán.
6. Không có thanh toán một phần trong V1.
7. Sau khi đánh dấu `PAID`, chu kỳ và tám attendance liên quan bị khóa nghiệp vụ.
8. Nếu học sinh ngừng học khi chu kỳ mới có dưới 8 buổi, chu kỳ chuyển `INCOMPLETE` và mặc định không phát sinh khoản thu.

## BR-07. Nhập dữ liệu muộn và tái phân bổ
1. Hệ thống xử lý theo `lessonDate + actualStartTime`, không theo thời điểm tạo/cập nhật record.
2. Khi sửa hoặc thêm attendance trong quá khứ, tái tính các chu kỳ chưa thanh toán từ ngày bị ảnh hưởng.
3. Chu kỳ đã `PAID` là ranh giới khóa; không tự động tái phân bổ qua ranh giới này.
4. Muốn sửa attendance thuộc chu kỳ đã thu, giáo viên phải mở khóa/hủy trạng thái thu và ghi lý do.
5. Sắp xếp ổn định khi trùng ngày/giờ bằng ID hoặc sequence nội bộ.

## BR-08. Trạng thái lớp và ghi danh
- Lớp: `ACTIVE`, `PAUSED`, `CLOSED`.
- Ghi danh: `ACTIVE`, `PAUSED`, `ENDED`.
- Đóng lớp/ngừng học không xóa lịch sử và không xóa công nợ đã phát sinh.
- Lớp đóng không sinh occurrence dự kiến mới.

## BR-09. Trang public
- Nội dung do developer sửa, không có CMS V1.
- Hero là carousel ba slide responsive; tự chuyển sau 5–6 giây, có điều khiển
  chuột/bàn phím/swipe và dừng animation/autoplay khi người dùng chọn reduced motion.
- Video dài nhúng YouTube và chỉ tải player khi người dùng tương tác.
- Không hiển thị học phí công khai.
- CTA ưu tiên Zalo, sau đó điện thoại và Facebook.
- Chỉ phản hồi có xác nhận đồng ý công khai mới được hiển thị như testimonial thật.
