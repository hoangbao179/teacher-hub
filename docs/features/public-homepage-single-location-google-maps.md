# Homepage một cơ sở và Google Maps

## 1. Mục tiêu

Nâng cấp Homepage marketing hiện tại mà không viết lại toàn trang:

- thể hiện rõ lớp học chỉ có **một cơ sở**;
- giúp phụ huynh xác định đúng vị trí và mở chỉ đường bằng Google Maps;
- tiếp tục giới thiệu hình thức nhận dạy tại nhà học sinh như một dịch vụ, không mô tả đó là cơ sở thứ hai;
- giữ phần video học tập, chương trình, phương pháp, phản hồi và liên hệ;
- bổ sung trust strip ngắn, trung thực, không dùng số liệu phóng đại;
- duy trì thiết kế pastel, thân thiện và mobile-first.

## 2. Phạm vi source hiện tại

Source đã có:

- Hero và ảnh cô Vy responsive;
- Giới thiệu, kinh nghiệm và chứng chỉ;
- Góc học miễn phí;
- Ba chương trình học;
- Phương pháp giảng dạy;
- Section địa điểm nhưng đang trình bày `Học tại địa chỉ lớp` và `Học tại nhà học sinh` như hai cột ngang nhau;
- Hai video YouTube;
- Ba phản hồi phụ huynh;
- Contact Zalo/Facebook;
- Footer cố định.

Task này điều chỉnh cấu trúc hiển thị, không thay đổi domain Admin hoặc backend.

## 3. Nội dung địa điểm chốt

### Cơ sở duy nhất

**Lớp tiếng Anh cô Vy**
**101 Kiệt 245 Bùi Thị Xuân, Phường Thủy Xuân, TP. Huế**

Badge: `Cơ sở duy nhất`.

### Dịch vụ bổ sung

- Có nhận dạy tại nhà học sinh trong khu vực Huế.
- Phụ huynh vui lòng liên hệ trước để trao đổi lịch học và phạm vi di chuyển phù hợp.

Dạy tại nhà học sinh không được gọi là `Cơ sở 2`.

### Liên kết bản đồ canonical

- Google Maps place URL: `https://www.google.com/maps/place/L%E1%BB%9Bp+ti%E1%BA%BFng+Anh+c%C3%B4+Vy/@16.4485604,107.5651109,693m/data=!3m1!1e3!4m14!1m7!3m6!1s0x3141a6afd96e3cb5:0xe354465f8ab597f0!2zMTAxIEtp4buHdCAyNDUgQsO5aSBUaOG7iyBYdcOibiwgVGjhu6d5IFh1w6JuLCBIdeG6vywgVmnhu4d0IE5hbQ!3b1!8m2!3d16.4484853!4d107.5649369!3m5!1s0x236f2c65f8d9d355:0x4759212f0d82a749!8m2!3d16.4484035!4d107.5651237!16s%2Fg%2F11zh28qgsd?entry=ttu&g_ep=EgoyMDI2MDcyMi4wIKXMDSoASAFQAw%3D%3D`
- Directions URL: `https://www.google.com/maps/dir/?api=1&destination=16.4484035%2C107.5651237`

## 4. Google Business Profile

Việc liên kết Google Maps được dùng để:

- xác minh đúng địa điểm;
- mở ứng dụng Google Maps trên Android/iOS;
- xem vị trí;
- lấy chỉ đường.

Hồ sơ mới chưa có review vẫn được hiển thị bình thường. Homepage không được dựng dữ liệu đánh giá giả.

Không hiển thị:

- `5 sao`;
- `0 đánh giá`;
- điểm rating;
- số review;
- logo Google lớn gây hiểu nhầm là được Google chứng nhận.

Nhãn CTA:

- `Xem trên Google Maps`
- `Chỉ đường`

## 5. Visual direction

### Desktop

Section địa điểm gồm hai vùng:

1. Card thông tin:
   - badge `Cơ sở duy nhất`;
   - tên lớp;
   - địa chỉ;
   - thông tin nhận dạy tại nhà học sinh;
   - ghi chú liên hệ trước;
   - hai CTA Google Maps.
2. Map panel:
   - ưu tiên iframe Maps Embed API nếu có cấu hình;
   - fallback là card pastel có icon bản đồ, địa chỉ và CTA mở Google Maps;
   - không sử dụng ảnh chụp Google Maps không rõ quyền sử dụng.

### Mobile

- card địa điểm một cột;
- địa chỉ không bị cắt;
- hai CTA cùng hàng ở 390–430px, có thể xuống hai hàng tại 360px nếu không đủ chỗ;
- touch target tối thiểu 44px;
- map panel nằm dưới thông tin;
- không horizontal overflow.

## 6. Trust strip

Dùng nội dung trung thực:

- `5 năm đồng hành cùng học sinh`
- `VSTEP 8.5/10 · C1`
- `TESOL quốc tế 120h`
- `Học 1–1 hoặc nhóm nhỏ`

Không dùng `1000+ học sinh`, `90% tiến bộ`, hoặc số lượng học sinh chưa có dữ liệu kiểm chứng.

## 7. Video

Giữ đúng hai video hiện có trong `publicHome.ts`.

- desktop: hai card cùng hàng;
- mobile: horizontal scroll hoặc một card mỗi màn như source hiện tại;
- lazy-load iframe;
- thumbnail lỗi phải có fallback;
- không autoplay khi mới tải trang.

## 8. Icon production

Chỉ dùng Material Icons đã có trong project. Không tải icon từ website lạ và không copy icon trong ảnh wireframe.

## 9. SEO và structured data

Cập nhật `LocalBusiness`:

- địa chỉ đầy đủ;
- `hasMap` trỏ tới Google Maps place URL;
- thêm Google Maps place URL vào `sameAs` nếu phù hợp với schema hiện tại;
- không thêm `aggregateRating` khi chưa có dữ liệu review thật.

## 10. Ngoài phạm vi

- Không public lịch chi tiết.
- Không tạo cơ sở thứ hai.
- Không xây form lead/backend trong task này.
- Không triển khai kiểm tra trình độ nếu route chưa tồn tại.
- Không thay Admin.
- Không sửa footer.
- Không thêm Google review widget.
