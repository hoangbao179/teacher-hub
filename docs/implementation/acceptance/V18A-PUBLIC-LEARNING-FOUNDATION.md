# V18A-PUBLIC-LEARNING-FOUNDATION Acceptance

> Verified: **PASS — 24/07/2026**

## Public access và isolation

- Người dùng chưa đăng nhập mở `/hoc` bình thường.
- `/hoc` không redirect sang `/admin/login`.
- Learning shell không nằm trong `AdminLayout`.
- Không có request tới API auth, class, student, lesson, schedule hoặc tuition.
- Không đọc hoặc hiển thị dữ liệu Admin.

## Level và nội dung

- Có đúng các level `mam-non`, `lop-1` đến `lop-9`.
- Không có lớp 10–12.
- Level có ít nhất một Unit published có thể mở.
- Level chưa có nội dung hiển thị `Sắp có` và không điều hướng.
- Catalog validator từ chối level slug sai, Unit thiếu từ hoặc ID/slug trùng.
- Có tối thiểu 2 Unit published để nghiệm thu.

## Navigation

- Homepage có CTA gọn tới `/hoc`.
- Homepage không bị thiết kế lại và không xuất hiện slide/carousel mới.
- Direct refresh `/hoc` trên production build thành công.
- Route learning không hợp lệ hiển thị public not-found thân thiện.
- Internal navigation dùng React Router.

## Local storage

- Level gần nhất được phục hồi trên cùng thiết bị khi storage khả dụng.
- JSON hỏng không làm crash trang.
- Schema không hỗ trợ reset về store hợp lệ.
- Write failure không chặn người dùng tiếp tục sử dụng learning hub.
- Không lưu token, số điện thoại, dữ liệu phụ huynh hoặc Admin.

## UI và accessibility

- UI dùng lavender/purple cùng pastel sky, mint, yellow, coral và pink.
- Có visual cute phù hợp giáo dục nhưng không quá trẻ con với lớp 6–9.
- Decoration không nhận focus, không bắt pointer và không che nội dung.
- Focus-visible rõ và touch target tối thiểu 44 x 44 px.
- Text/interactive state đạt contrast hợp lý; trạng thái không chỉ dựa vào màu.
- `prefers-reduced-motion` được tôn trọng.
- Không có animation liên tục.

## Responsive

Tại 360, 375, 390, 393, 400, 412 và 430 px:

- không page-level horizontal overflow;
- level cards đọc rõ và không bị cắt;
- CTA chính không bị che bởi safe area;
- heading không rơi một từ đơn lẻ gây xấu;
- không sử dụng bảng rộng.

Tại 768 và 1440 px:

- grid tận dụng chiều ngang nhưng không kéo nội dung quá rộng;
- visual hierarchy rõ;
- không có khoảng trắng rỗng bất thường.

## Regression

- Footer Homepage giữ nguyên chính xác:

```text
2026 — từ người hâm mộ cô Vy, with love ❤️
```

- Contact, metadata, public 404 và Admin không regression.
- Bottom navigation Admin vẫn có đúng 5 mục và label không wrap.

## Verification

- Client typecheck PASS.
- Client lint PASS.
- Unit/component tests liên quan PASS.
- Targeted E2E PASS.
- `npm run check:full` PASS.
- `npm run check:repo` PASS.
- `git diff --check` PASS.
- Visual review mobile và desktop PASS.

## Verdict

```text
PASS
```
