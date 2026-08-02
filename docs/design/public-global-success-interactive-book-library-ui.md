# UI/UX — Tủ sách tiếng Anh tương tác có audio

## 1. Định hướng

- Trẻ trung, sáng, dễ dùng cho học sinh lớp 1–9.
- Không biến thành trang thương mại điện tử.
- Màu chính teal/sky/mint/yellow; tím chỉ dùng rất ít để không lệch Homepage hiện tại.
- Bám MUI theme, spacing và typography đang dùng.
- Touch target tối thiểu 44 px; CTA chính mobile 48 px.

## 2. Header

Header công khai dùng chung trên Homepage, Góc học và Tủ sách.

- Desktop giữ logo, thương hiệu và label điều hướng rõ ràng.
- Mobile ẩn tên thương hiệu dài; logo link về Trang chủ, `Góc học` và `Tủ sách`
  luôn có label, touch target tối thiểu 44 px và active state rõ.
- `Liên hệ` và `Quản trị` giữ cơ chế Homepage hiện tại, không chen vào mobile nav chính.

## 3. Homepage CTA

Bổ sung card nhỏ cạnh hoặc ngay sau card Góc học:

```text
TỦ SÁCH TƯƠNG TÁC
Tủ sách Tiếng Anh theo lớp
Lật trang và nghe bài ngay trong sách
[Mở tủ sách]
```

Không đưa 13 card sách lên Homepage.

## 4. `/sach`

### Hero

```text
TỦ SÁCH TIẾNG ANH
Tủ sách Tiếng Anh theo lớp
Chọn lớp, mở sách và bấm biểu tượng loa để nghe bài trực tiếp.
```

### Bộ lọc

- Bộ lọc lớp có `Tất cả`, `1`…`9`.
- Danh sách bộ sách sinh động từ catalog enabled. Chỉ hiển thị bộ lọc bộ sách
  khi có ít nhất hai series; khi chỉ có một series thì tự ẩn.
- Bộ lọc `grade` và `series` kết hợp qua query parameter.
- Query `?grade=3` được hỗ trợ để chia sẻ.
- Khi chọn lớp 3–6, hiển thị hai card Tập 1/Tập 2.

### Danh sách

Ưu tiên **group theo lớp** thay vì 13 card phẳng:

```text
Lớp 3 · 2 cuốn
[ Tập 1 ] [ Tập 2 ]
```

Card gồm:

- bìa local;
- lớp, tập;
- badge `Có bài nghe`;
- `Lật trang`, `Nghe`, `Zoom`;
- CTA `Mở sách`;
- icon Zalo nhỏ.

Khi chọn `Tất cả`, desktop rộng dùng grid hai panel lớp trên một hàng; tablet/mobile
dùng một panel trên một hàng. Panel cao theo nội dung, không stretch. Khi chọn riêng
một lớp, panel dùng toàn bộ chiều rộng phù hợp; lớp có hai tập hiển thị hai card cạnh
nhau trên desktop và một cột trên mobile.

Card dùng layout ngang gọn, ảnh bìa `object-fit: contain` và chỉ có một CTA chính
`Mở sách`. Không lặp CTA Zalo hoặc icon mở ngoài trên từng card.

## 5. Trang xem sách

### Header nội dung

- Breadcrumb `Tủ sách → Lớp N → Tập N`.
- H1 theo tên sách.
- Badge `Có bài nghe tương tác`.
- Mô tả ngắn cách bấm biểu tượng loa.

### Viewer

- Desktop cao khoảng 72–80vh.
- Mobile cao khoảng 70–76dvh.
- Nền viewer tối để trang sách nổi bật.
- Iframe không bị card padding quá dày trên mobile.
- Không đặt CTA thường bên dưới iframe; dùng các điều khiển có sẵn của FlipBuilder.
- Nút mở tab mới chỉ xuất hiện như phương án dự phòng trong cảnh báo tải chậm.

### Mobile actions

Không dùng action bar fixed hoặc CTA riêng dưới iframe trên mobile để tránh lặp
điều khiển của FlipBuilder và không che nội dung/footer.

## 6. Trạng thái

### Source chưa bật

```text
Sách đang được cô Vy cập nhật.
[Quay lại tủ sách] [Hỏi cô Vy]
```

### Viewer chậm

Sau khoảng 8 giây:

```text
Sách có thể đang tải chậm.
[Mở ở tab mới] [Tiếp tục chờ]
```

Không hiển thị thông báo “lỗi” chắc chắn nếu chưa có tín hiệu đáng tin cậy.

## 7. Accessibility

- H1 duy nhất.
- iframe có title theo sách.
- Bìa có alt; decorative illustration có `alt=""`.
- Badge audio không chỉ dùng màu, luôn có icon và text.
- Focus ring rõ.
- Nút icon có `aria-label` đầy đủ.

## 8. Responsive review

Bắt buộc chụp và kiểm tra:

- 360×800
- 390×844
- 400×930
- 430×932
- 768×1024
- 1440×900

Đặc biệt kiểm tra:

- header không tràn;
- chip lớp không bị cắt;
- card Tập 1/Tập 2 không gây nhầm;
- viewer không quá thấp;
- sticky action không che viewer;
- không horizontal overflow.
