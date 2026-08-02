# UI/UX — Official English Book Library

## Tủ sách

Giao diện giữ phong cách trẻ trung, sáng, mobile-first và không giống màn quản lý
tài liệu. Hero giới thiệu sách học sinh và tài liệu giáo viên từ nguồn NXBGD,
không quảng bá audio cho toàn thư viện.

Bộ lọc theo thứ tự:

1. `Sách học sinh` / `Tài liệu giáo viên` qua query `type`;
2. bộ sách qua query `series` khi có nhiều series;
3. lớp 1–9 qua query `grade`.

Mặc định là `Sách học sinh`. Các query kết hợp được với nhau. Không hiển thị raw
enum.

## Card

- SGK: badge bộ sách, lớp, tập, `Sách học sinh`; CTA chính `Đọc sách`; CTA phụ
  `Nghe bài tương tác` chỉ khi catalog có `interactiveAudioUrl`.
- SGV: badge bộ sách, lớp, `Tài liệu giáo viên`; chỉ có CTA `Đọc tài liệu`.
- Card giữ layout ngang compact, touch target tối thiểu 44 px và không overflow
  ở 360–430 px.

## Trang đọc NXBGD

Trang có breadcrumb, tên, lớp/tập/loại và badge `Nguồn chính thức NXBGD`. Copy mô
tả đúng khả năng đọc sách; không hiển thị audio badge hay hướng dẫn nhấn loa.
Viewer là flipbook responsive: mobile/tablet hẹp hiển thị một trang, desktop đủ
rộng hiển thị bìa đơn và spread hai trang có gáy/shadow nhẹ. Toolbar có trang
trước/sau, nhập số trang, zoom 100–250% và `Vừa trang`; desktop dùng nhãn spread
như `10–11 / 78`, còn URL vẫn dùng manifest page đại diện.

Ở 100% không có horizontal overflow; swipe/kéo góc và nút điều hướng đều lật
trang. Trên 100%, gesture lật bị khóa và lớp zoom dùng native scroll; đổi trang
hoặc `Vừa trang` reset zoom/vị trí cuộn. Reader chỉ tải ảnh trang hiện tại và lân
cận, có skeleton, fallback ảnh đơn khi engine lỗi và action `Mở trên trang
NXBGD`. Manifest thiếu/lỗi hoặc mode `EXTERNAL` cũng không render iframe.

## Trang nghe phụ

Route `/nghe` nói rõ đây là bản nghe tương tác từ viewer bên ngoài và có thể nhấn
biểu tượng loa trong sách. Trải nghiệm này là luồng phụ; không dùng orientation
lock, fullscreen wrapper hoặc kỹ thuật can thiệp DOM cross-origin.

## Responsive review

Kiểm tra 360×800, 390×844, 768×1024 và 1440×900: header/filter/card không tràn,
CTA đọc được ưu tiên, SGV không có CTA nghe, mobile một trang, desktop hai trang,
swipe/animation/zoom/reset/resize giữ đúng manifest page và không tạo page-level
horizontal overflow ở 100%.
