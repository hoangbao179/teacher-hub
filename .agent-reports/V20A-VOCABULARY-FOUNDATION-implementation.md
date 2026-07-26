# V20A Vocabulary Foundation Implementation

## Phạm vi

Shared contract, migration/seed topic, protected vocabulary API và ba màn admin
responsive. Không triển khai V20B–V20E.

## Vấn đề đã sửa

- Thêm catalog 20 chủ đề với CORE/EXTENDED deterministic theo age band.
- Thêm bộ từ transactional: tạo, sửa, nhân bản, lưu trữ và import Public Unit snapshot.
- Thêm UI tìm/lọc chủ đề, chọn suggestion, nhập-dán, sửa item và trạng thái chưa lưu.

## File chính đã đổi

`shared/src/contracts/vocabulary.ts`, migration `0016`, backend
controller/service/repository/routes, `client/src/features/vocabulary/` và OpenAPI.

## API/schema thay đổi

Thêm 5 bảng vocabulary foundation và 10 endpoint protected dưới `/api/vocabulary`.
`teacher_user_id` chỉ lấy từ auth; set lưu trữ không sửa được.

## Kiểm tra đã chạy

Targeted unit/integration/E2E, public-learning E2E và `npm run check:full`: PASS.

## Điểm còn lại

Provider/media binary, assignment, token public và game thuộc V20B–V20E.

## Commit

Commit được tạo sau verification; hash được ghi trong final response.
