# Theo dõi học sinh và chia sẻ với phụ huynh

Teacher Hub/MySQL là nguồn chuẩn. Mỗi học sinh có tối đa một Google Sheet đang tạo
hoặc active; lên lớp/chuyển lớp không đổi URL. File mặc định Restricted và giáo viên
cấp Viewer thủ công.

Template hiện hành `v6` có một tab hiển thị **Sổ theo dõi học tập** với ngày học,
điểm danh, nhận xét của cô và nội dung. `PRESENT` dùng nhãn Có mặt/nền xanh nhạt;
`ABSENT` dùng Vắng/nền đỏ nhạt. Header được freeze, text wrap, ngày `dd/MM/yyyy`,
phù hợp màn hình mobile. ID/revision nằm trong metadata ẩn.

Lesson transaction chỉ enqueue logical event. Worker claim theo revision, retry lỗi
retryable và cập nhật row theo stable lesson ID, nên sửa cùng lesson không append
duplicate. Google lỗi không rollback lesson. UI chỉ ưu tiên **Đã đồng bộ**, **Đang
chờ đồng bộ**, **Đồng bộ lỗi** và action thử lại; chi tiết kỹ thuật nằm trong Công
cụ nâng cao/log.

Google Sheet không còn tab học phí. Học phí tháng được quản lý trong Teacher Admin.
Legacy Import không còn runtime; bảng/migration cũ vẫn được giữ để bảo toàn lịch sử.
