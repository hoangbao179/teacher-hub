# Schedule midnight guard

## Task level

Level 3 vì thay đổi production deploy gate. Không có migration, backfill hoặc thay đổi
business rule/database.

## Problem

Các màn hình vận hành lấy ngày Việt Nam lúc render/mount nhưng không có lifecycle đổi
ngày. Dashboard có thể giữ payload hôm trước; Calendar không biết người dùng đang bám
tuần hiện tại hay đã chọn tuần khác; range mặc định của Reconciliation bị cố định.
Dashboard cũng ưu tiên lesson con thay vì occurrence cha của ca học ghép đã tạo draft.
Schedule regression quan trọng chưa chặn production deploy và ứng dụng chưa có global
render/lazy-route Error Boundary.

## Root cause

Ngày hiện tại được đọc như utility đồng bộ, không phải reactive state. Request không gắn
với ngày/query nên response cũ có thể hoàn tất muộn. Calendar chỉ so sánh chuỗi đầu tuần,
làm mất ý nghĩa lựa chọn của người dùng sau rollover. CI smoke không chứa các flow schedule.

## Decision

Dùng một hook client tính one-shot timeout tới sau 00:00 `Asia/Ho_Chi_Minh`, re-check khi
visible/focus/pageshow và cleanup đầy đủ. Dashboard giữ snapshot theo ngày; Calendar giữ
cờ bám tuần hiện tại; Reconciliation dùng override nullable để phân biệt mặc định động và
ngày đã sửa. Abort/ignore request cũ khi dependency đổi hoặc unmount.

Gate bắt buộc chạy midnight mock E2E, Calendar mobile E2E và schedule operations E2E với
MySQL test. Full suite vẫn ở nightly/manual để tránh lặp toàn bộ E2E trên mỗi push.

## Changes

- Sửa rollover Dashboard, Calendar, Reconciliation và ngày trên admin shell/busy-slot list.
- Đồng bộ điều hướng ca học ghép và thêm nhãn nhận diện.
- Thêm global Error Boundary không hiển thị chi tiết kỹ thuật.
- Thêm unit/Playwright regression và schedule deploy gate.
- Cập nhật feature/current-state/deployment/release documentation.

## Verification

Unit dùng clock cố định kiểm tra biên ngày và leap day. Playwright dùng virtual clock cho
rollover ngày thường, Chủ nhật sang thứ Hai, tuần tùy chọn, range mặc định/tùy chọn,
điều hướng nhóm ghép, mobile overflow và lazy-route failure. Schedule operations tiếp tục
dùng database có hậu tố `_test` theo convention repository.

## Rollback

Revert hook và các consumer, Error Boundary, script/package entries, job
`schedule-regression` cùng tài liệu trong một revision. Không có dữ liệu cần rollback.

## Remaining risks

Không có browser API chuẩn báo mọi thay đổi system clock khi tab visible liên tục; timer
sẽ tự hiệu chỉnh nếu chạy sớm và các sự kiện focus/visibility/pageshow hoặc resume xử lý
trường hợp clock nhảy tới tương lai thông thường. JWT Web Storage là giới hạn đã được ghi
trong `docs/implementation/known-limitations.md`, không lặp lại tại report này.
