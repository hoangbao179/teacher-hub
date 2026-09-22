# 01. Product overview

`Lớp học cô Vy` gồm website công khai Tiếng Anh lớp 1–9 tại Huế và Teacher Admin
mobile-first cho một giáo viên. Admin tập trung vào lớp/học sinh, lịch, ghi buổi,
điểm danh, nhận xét, học phí theo tháng và sổ theo dõi phụ huynh.

Luồng chính: **Hôm nay → Ghi buổi → đánh dấu em nghỉ → nhận xét nếu có → Lưu**.
Học phí được theo dõi theo tháng dương lịch bằng trạng thái `UNPAID | PAID`, không
phụ thuộc số buổi hay thời lượng. Google Sheet là projection; MySQL là nguồn chuẩn.
