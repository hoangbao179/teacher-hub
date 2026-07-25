# V19A — Homepage một cơ sở và Google Maps

## Mục tiêu

Điều chỉnh Homepage theo wireframe mới, bám source hiện tại và làm rõ chỉ có một cơ sở tại Huế.

## Nội dung canonical

- Tên: `Lớp tiếng Anh cô Vy`.
- Badge: `Cơ sở duy nhất`.
- Địa chỉ: `101 Kiệt 245 Bùi Thị Xuân, Phường Thủy Xuân, TP. Huế`.
- Dịch vụ: `Có nhận dạy tại nhà học sinh trong khu vực Huế.`
- Ghi chú: `Phụ huynh vui lòng liên hệ trước để trao đổi lịch học và phạm vi di chuyển phù hợp.`
- Google Maps place URL: `https://www.google.com/maps/place/L%E1%BB%9Bp+ti%E1%BA%BFng+Anh+c%C3%B4+Vy/@16.4485604,107.5651109,693m/data=!3m1!1e3!4m14!1m7!3m6!1s0x3141a6afd96e3cb5:0xe354465f8ab597f0!2zMTAxIEtp4buHdCAyNDUgQsO5aSBUaOG7iyBYdcOibiwgVGjhu6d5IFh1w6JuLCBIdeG6vywgVmnhu4d0IE5hbQ!3b1!8m2!3d16.4484853!4d107.5649369!3m5!1s0x236f2c65f8d9d355:0x4759212f0d82a749!8m2!3d16.4484035!4d107.5651237!16s%2Fg%2F11zh28qgsd?entry=ttu&g_ep=EgoyMDI2MDcyMi4wIKXMDSoASAFQAw%3D%3D`.
- Directions URL: `https://www.google.com/maps/dir/?api=1&destination=16.4484035%2C107.5651237`.

## Công việc

1. Cập nhật `client/src/content/publicHome.ts`:
   - đổi model `locations` từ hai mục ngang hàng thành một location chính;
   - thêm Google Maps place URL;
   - thêm directions URL;
   - giữ thông tin nhận dạy tại nhà học sinh ở field dịch vụ;
   - cập nhật structured data mà không thêm rating giả.
2. Cập nhật Hero:
   - giữ heading/description;
   - thêm CTA `Trao đổi về lớp học` dẫn `#contact`;
   - CTA thứ hai chỉ dùng route đang tồn tại, ưu tiên `/hoc` với nhãn `Góc học miễn phí`;
   - không tạo link chết tới kiểm tra trình độ.
3. Thêm trust strip sau Hero.
4. Giữ nguyên phần Giới thiệu, Chương trình, Phương pháp và Góc học miễn phí; chỉ cân chỉnh spacing theo wireframe.
5. Thiết kế lại section địa điểm:
   - một cơ sở duy nhất;
   - map/link CTA;
   - fallback khi không cấu hình embed.
6. Giữ và cân chỉnh section Video.
7. Không regression Phụ huynh chia sẻ, Contact và Footer.
8. Cập nhật E2E cho desktop/mobile.

Giữ nguyên hai video hiện tại, header chỉ có `Liên hệ` và `Quản trị`, cùng footer
`2026 — từ người hâm mộ cô Vy, with love ❤️`. Không public lịch chi tiết, không
thêm review/rating giả hoặc claim `1000+ học sinh`. CTA phụ dùng route `/hoc`;
không tạo route `/kiem-tra-trinh-do` trong V19A.

## Cấu hình Maps Embed tùy chọn

Nếu source chưa có Maps Embed API key, release vẫn phải hoạt động bằng card fallback và link Google Maps.

Nếu dùng key:

```text
VITE_GOOGLE_MAPS_EMBED_API_KEY
```

- thêm vào `.env.example`;
- không commit giá trị thật;
- key phải giới hạn HTTP referrer;
- iframe dùng `referrerPolicy="strict-origin-when-cross-origin"`.
