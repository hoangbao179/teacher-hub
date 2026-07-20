# 09. Acceptance Tests

## AT-01 Có mặt hoàn thành chu kỳ
Given học sinh đang 7/8, When hoàn thành buổi với Có mặt, Then chu kỳ thành 8/8 và PAYMENT_DUE.

## AT-02 Buổi kéo dài
Given lịch 20:00-21:30, When thực tế 20:30-22:30, Then duration=120 phút nhưng chỉ cộng 1 buổi.

## AT-03 Nghỉ
When chọn Nghỉ, Then không cộng tiến độ, không tạo cycle item.

## AT-04 Miễn phí một buổi
When chọn Miễn phí, Then có lịch sử học nhưng không cộng cycle.

## AT-05 Học sinh miễn phí hoàn toàn
Then không tạo tuition cycle, vẫn ghi nhận attendance và nội dung.

## AT-06 Giá riêng
Given giá lớp 2.400.000 và giá riêng 2.000.000, When bắt đầu cycle mới, Then snapshot=2.000.000.

## AT-07 Đổi giá giữa chu kỳ
Then cycle hiện tại giữ snapshot cũ, cycle sau dùng giá mới.

## AT-08 Nhập muộn
Given đang 7/8, nhập ba buổi quá khứ theo thứ tự Có mặt, Nghỉ, Có mặt; Then chu kỳ cũ 8/8, buổi Nghỉ bỏ qua, chu kỳ mới 1/8.

## AT-09 Chu kỳ trước chưa trả
Given cycle #1 PAYMENT_DUE, When học thêm một buổi billable, Then cycle #2 = 1/8.

## AT-10 Học bù một số học sinh
Then chỉ học sinh được chọn có attendance và tác động cycle.

## AT-11 Đổi occurrence
Then lịch lặp các tuần sau không thay đổi.

## AT-12 Hủy occurrence
Then occurrence không xuất hiện là chưa ghi nhận và không tính phí.

## AT-13 Đóng lớp
Then không sinh occurrence mới; lịch sử và khoản cần thu giữ nguyên.

## AT-14 Ngừng học ở 5/8
Then enrollment ENDED, cycle INCOMPLETE, không tự tạo PAYMENT_DUE.

## AT-15 Ngừng học có khoản 8/8 chưa thu
Then khoản PAYMENT_DUE vẫn tồn tại.

## AT-16 Chu kỳ đã thu
Then không sửa attendance liên quan nếu chưa unlock.

## AT-17 Unlock chu kỳ đã thu
Then bắt buộc nhập reason và hệ thống ghi audit.

## AT-18 Một học sinh hai lớp
Then từ chối tạo enrollment ACTIVE thứ hai.

## AT-19 Trùng lịch
Then cảnh báo giáo viên; không tự đổi lịch.

## AT-20 Dashboard
Then hiển thị đúng số học sinh cần thu, số occurrence chưa ghi nhận và lớp hôm nay.

## AT-21 Excel tương lai
Then dữ liệu đủ để xuất ngày học, giờ dự kiến, giờ thực tế, thời lượng, nội dung, bài tập, trạng thái và học phí.
