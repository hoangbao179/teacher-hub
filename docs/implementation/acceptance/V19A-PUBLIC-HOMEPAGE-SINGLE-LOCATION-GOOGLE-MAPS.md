# Acceptance — V19A Homepage một cơ sở và Google Maps

## Nội dung

- [x] Homepage chỉ mô tả một cơ sở.
- [x] Tên cơ sở hiển thị `Lớp tiếng Anh cô Vy` với badge `Cơ sở duy nhất`.
- [x] Địa chỉ hiển thị: `101 Kiệt 245 Bùi Thị Xuân, Phường Thủy Xuân, TP. Huế`.
- [x] Dịch vụ hiển thị: `Có nhận dạy tại nhà học sinh trong khu vực Huế.`
- [x] Ghi chú hiển thị: `Phụ huynh vui lòng liên hệ trước để trao đổi lịch học và phạm vi di chuyển phù hợp.`
- [x] Nhận dạy tại nhà học sinh không được gọi là `Cơ sở 2`.
- [x] Có CTA `Xem trên Google Maps`.
- [x] Có CTA `Chỉ đường`.
- [x] Không hiển thị điểm sao hoặc số review.
- [x] Không có claim `1000+ học sinh` hoặc tỷ lệ tiến bộ không được kiểm chứng.

## Kỹ thuật

- [x] Google Maps link mở tab/app mới với `noopener noreferrer`.
- [x] Directions URL dùng Maps URL cross-platform.
- [x] Google Maps place URL đúng URL canonical trong feature/task.
- [x] Directions URL là `https://www.google.com/maps/dir/?api=1&destination=16.4484035%2C107.5651237`.
- [x] Nếu iframe không có key hoặc tải lỗi, card fallback vẫn hiển thị được.
- [x] Structured data không có `aggregateRating`.
- [x] Structured data có địa chỉ và map URL đúng.
- [x] Không gọi Admin API từ Homepage.

## Responsive

- [x] 360px không horizontal overflow.
- [x] 390px và 400px địa chỉ đọc đầy đủ.
- [x] CTA Maps có touch target tối thiểu 44px.
- [x] Desktop location section cân bằng, không bị quá rộng hoặc quá trống.
- [x] Video section giữ nguyên chức năng mobile/desktop.

## Regression

- [x] Header vẫn chỉ có `Liên hệ` và `Quản trị` theo source hiện tại.
- [x] Góc học miễn phí vẫn dẫn `/hoc`.
- [x] Không tạo hoặc liên kết route `/kiem-tra-trinh-do` trong V19A.
- [x] Hai video hiện tại vẫn được giữ nguyên.
- [x] Testimonial desktop 3 card, mobile carousel.
- [x] Zalo và Facebook hoạt động.
- [x] Footer giữ nguyên chính xác:

`2026 — từ người hâm mộ cô Vy, with love ❤️`
