# Acceptance — V19A Homepage một cơ sở và Google Maps

## Nội dung

- [ ] Homepage chỉ mô tả một cơ sở.
- [ ] Tên cơ sở hiển thị `Lớp tiếng Anh cô Vy` với badge `Cơ sở duy nhất`.
- [ ] Địa chỉ hiển thị: `101 Kiệt 245 Bùi Thị Xuân, Phường Thủy Xuân, TP. Huế`.
- [ ] Dịch vụ hiển thị: `Có nhận dạy tại nhà học sinh trong khu vực Huế.`
- [ ] Ghi chú hiển thị: `Phụ huynh vui lòng liên hệ trước để trao đổi lịch học và phạm vi di chuyển phù hợp.`
- [ ] Nhận dạy tại nhà học sinh không được gọi là `Cơ sở 2`.
- [ ] Có CTA `Xem trên Google Maps`.
- [ ] Có CTA `Chỉ đường`.
- [ ] Không hiển thị điểm sao hoặc số review.
- [ ] Không có claim `1000+ học sinh` hoặc tỷ lệ tiến bộ không được kiểm chứng.

## Kỹ thuật

- [ ] Google Maps link mở tab/app mới với `noopener noreferrer`.
- [ ] Directions URL dùng Maps URL cross-platform.
- [ ] Google Maps place URL đúng URL canonical trong feature/task.
- [ ] Directions URL là `https://www.google.com/maps/dir/?api=1&destination=16.4484035%2C107.5651237`.
- [ ] Nếu iframe không có key hoặc tải lỗi, card fallback vẫn hiển thị được.
- [ ] Structured data không có `aggregateRating`.
- [ ] Structured data có địa chỉ và map URL đúng.
- [ ] Không gọi Admin API từ Homepage.

## Responsive

- [ ] 360px không horizontal overflow.
- [ ] 390px và 400px địa chỉ đọc đầy đủ.
- [ ] CTA Maps có touch target tối thiểu 44px.
- [ ] Desktop location section cân bằng, không bị quá rộng hoặc quá trống.
- [ ] Video section giữ nguyên chức năng mobile/desktop.

## Regression

- [ ] Header vẫn chỉ có `Liên hệ` và `Quản trị` theo source hiện tại.
- [ ] Góc học miễn phí vẫn dẫn `/hoc`.
- [ ] Không tạo hoặc liên kết route `/kiem-tra-trinh-do` trong V19A.
- [ ] Hai video hiện tại vẫn được giữ nguyên.
- [ ] Testimonial desktop 3 card, mobile carousel.
- [ ] Zalo và Facebook hoạt động.
- [ ] Footer giữ nguyên chính xác:

`2026 — từ người hâm mộ cô Vy, with love ❤️`
