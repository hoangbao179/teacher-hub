# OPTIONAL-CLASS-TUITION Implementation

## Phạm vi

Cho phép lớp chưa cấu hình học phí bằng giá `0` mà không ảnh hưởng lịch sử học.

## Vấn đề đã sửa

Form, service và database không còn bắt giá lớp phải dương. Tái tính học phí
không biến attendance của lớp giá `0` thành billable.

## File chính đã đổi

`ClassFormPage.tsx`, class/lesson/tuition service-repository và migration `0025`.

## API/schema thay đổi

`defaultPackagePrice` nhận integer không âm; constraint class và class policy
đổi từ `> 0` thành `>= 0`.

## Kiểm tra đã chạy

Typecheck, lint, unit, integration và `npm run check:full`.

## Điểm còn lại

Không.

## Commit

Ghi trong final response sau khi commit.
