# 10. Non-functional Requirements

## Mobile-first
- Thiết kế từ viewport 360-390px.
- Không scroll ngang trong luồng chính.
- Target tap tối thiểu 44px.
- Nút lưu/tiếp tục cố định cuối màn hình khi form dài.
- Không dùng bảng nhiều cột trên mobile; dùng card/list.

## Hiệu năng
- Homepage ưu tiên LCP nhanh trên 4G.
- Ảnh WebP/AVIF, lazy-load.
- Ảnh giới thiệu dùng kích thước responsive tối ưu và lazy-load. YouTube iframe chỉ
  khởi tạo khi bấm.
- API danh sách hỗ trợ pagination/filter nếu dữ liệu tăng.

## Bảo mật
- Mật khẩu hash chuẩn mạnh; cookie/token bảo mật.
- Admin routes cần authentication.
- Rate limit login; audit thao tác khóa/mở khóa và thanh toán.
- Không public dữ liệu học sinh.

## Độ tin cậy
- Backup database định kỳ.
- Soft delete/archive dữ liệu nghiệp vụ.
- Transaction khi hoàn thành lesson và phân bổ tuition cycle.
- Idempotency cho thao tác hoàn thành buổi và đánh dấu đã thu.

## Khả dụng
- Form hỗ trợ nhập dữ liệu quá khứ.
- Thông báo lỗi rõ, không làm mất dữ liệu đã nhập.
- Empty/loading/error states cho mọi danh sách chính.
