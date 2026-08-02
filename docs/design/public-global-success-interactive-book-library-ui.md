# UI/UX — Tủ sách Global Success tương tác có audio

## 1. Định hướng

- Trẻ trung, sáng, dễ dùng cho học sinh lớp 1–9.
- Không biến thành trang thương mại điện tử.
- Màu chính teal/sky/mint/yellow; tím chỉ dùng rất ít để không lệch Homepage hiện tại.
- Bám MUI theme, spacing và typography đang dùng.
- Touch target tối thiểu 44 px; CTA chính mobile 48 px.

## 2. Header

Không refactor toàn bộ public header trong V21B.

- `HomePage.tsx`: thêm `Tủ sách`; trên xs có thể dùng icon + `aria-label`, trên sm+ hiển thị chữ.
- `LearningShell.tsx`: thêm shortcut Tủ sách, mobile ẩn label.
- `BookShell`: có shortcut Góc học và Trang chủ.
- Kiểm tra 360 px không tràn; không đổi flow Liên hệ/Quản trị.

## 3. Homepage CTA

Bổ sung card nhỏ cạnh hoặc ngay sau card Góc học:

```text
TỦ SÁCH TƯƠNG TÁC
Global Success lớp 1–9
Lật trang và nghe bài ngay trong sách
[Mở tủ sách]
```

Không đưa 13 card sách lên Homepage.

## 4. `/sach`

### Hero

```text
TỦ SÁCH CÔ VY
Chọn sách Global Success theo lớp
Lật trang và bấm nút loa để nghe trực tiếp trong sách.
```

### Bộ lọc

- Chỉ có `Tất cả`, `1`…`9`.
- Không hiển thị `Bộ sách`.
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

Desktop: tối đa 2 card trong một grade group. Mobile: 1 card/hàng.

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
- Có CTA ngoài iframe: fullscreen, mở tab mới, Zalo.

### Mobile action bar

Cố định dưới đáy:

```text
[Toàn màn hình] [Hỏi mua]
```

Tính `env(safe-area-inset-bottom)` và không che footer.

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
