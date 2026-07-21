# Legacy Excel

Không lưu workbook học sinh thật trong cây source này. Các workbook local phục vụ
đối chiếu thủ công phải đặt tại `.private-data/legacy-excel/` (đã bị Git, Docker và
source package loại trừ). Không đưa tên, số điện thoại hay lịch sử học thật vào fixture.

Các file này chỉ là dữ liệu tham khảo cho migration sau. V1 base không import tự động.

M6B chỉ triển khai canonical normalized export. Generic import, tự nhận diện cột
và parsing arbitrary workbook vẫn là một controlled migration task sau V1.

Trước khi import phải có preview, xác nhận năm, làm sạch ngày/giờ và không tin trực tiếp cột HOURS do Excel có thể tự chuyển thành serial date.
