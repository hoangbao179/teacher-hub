# V15 Acceptance

## Gate A

- Replacement occurrence có thể nghỉ nhưng original vẫn là `RESCHEDULED`.
- Cancel replacement draft quy về canonical key và mở entitlement.
- Entitlement đi qua `OPEN → RESERVED → FULFILLED`, được release khi draft hủy
  hoặc bỏ participant; `ABSENT → OPEN`, `PRESENT/FREE → FULFILLED`.
- Một request đổi được subset 1–7 recurring schedules, tối đa 45 ngày/30
  occurrences, preview conflict nội bộ và apply all-or-nothing.
- Calendar giải thích toàn bộ conflict; `/admin/busy-slots` quản lý lịch bận.
- Có danh sách “Buổi cần học bù” không giới hạn lookback 60 ngày.

## Gate B

- Thu trước đúng giá snapshot, không chuyển cycle sang `PAID` trước 8 buổi;
  đủ 8 buổi tự allocate và thanh toán.
- Cycle `INCOMPLETE` giữ nguyên status và có settlement `OPEN/SETTLED/WAIVED`.
- Chuyển lớp atomic: enrollment cũ kết thúc, enrollment mới bắt đầu 0/8, xử lý
  settlement/receipt theo lựa chọn và không đổi lesson/cycle lịch sử.
- Ngừng học dùng dialog rõ settlement và khoản thu trước.

## Gate C

- Contact copy đúng nội dung được duyệt; footer giữ nguyên tuyệt đối.
- Contracts, OpenAPI, route checks, tài liệu và tests đồng bộ.
- Integration và E2E có combined scenario; full/repo/package gates đều PASS.
