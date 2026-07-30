# COMBINED-CLASS-GROUPS Implementation

## Phạm vi

Nhóm học ghép có khoảng hiệu lực, lịch tuần riêng, resolver ghi đè lịch lớp bị
chồng giờ, UI quản lý/lịch/xác nhận và ghi nhận atomic theo từng lớp.

## Vấn đề đã sửa

- Kiến trúc cũ resolve occurrence động; `lesson_sessions` chỉ tạo khi xử lý.
- Giải pháp dùng `CombinedTeachingOccurrence` cha và một lesson con cho mỗi lớp.
  Một card/ca của giáo viên vẫn cập nhật attendance, tiến độ và học phí riêng.
- Resolver suppress đúng lịch riêng của lớp thành viên khi cùng thứ và chồng giờ;
  lịch gốc, lịch khác ngày và lịch không chồng giờ được giữ nguyên.
- Không có session tương lai tạo sẵn. Sửa cấu trúc nhóm bị chặn sau khi đã có
  occurrence lịch sử; kết thúc nhóm không xóa lịch sử.

## File chính đã đổi

- Contract: `shared/src/contracts/combined-class-groups.ts`,
  `shared/src/contracts/schedule.ts`.
- Backend: migration 0026, combined repository/service/controller, schedule
  projection/repository/service và transaction helper trong lesson service.
- Frontend: API/page quản lý nhóm, form, trang ghi nhận nhóm, card lịch tuần và
  đối soát.
- Tài liệu: ADR occurrence cha, business rule, data dictionary, logical API và
  OpenAPI.

## API/schema thay đổi

- CRUD + end-date: `/api/combined-class-groups`.
- Detail/complete atomic: `/api/combined-teaching-occurrences`.
- Schedule API nhận key `cg:{groupId}:{scheduleId}:{date}` cho create-draft,
  skip và reschedule.
- Migration tạo 4 bảng nhóm/occurrence và FK nullable từ lesson con.

## Kiểm tra đã chạy

Typecheck shared/server/client, targeted ESLint, 5 unit test, 2 MySQL integration
test, production build và targeted mobile smoke đều PASS.

## Điểm còn lại

Ảnh smoke nằm trong thư mục tạm của máy, không commit theo quy định repository.
