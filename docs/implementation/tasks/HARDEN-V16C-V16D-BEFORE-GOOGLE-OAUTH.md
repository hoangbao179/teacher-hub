# HARDEN-V16C-V16D-BEFORE-GOOGLE-OAUTH

## Phạm vi

- Thu hẹp OAuth còn `drive.file`.
- Loại trạng thái nghỉ có tính phí và migrate dữ liệu/cycle mutable.
- Sửa snapshot progress/cycle window.
- Recovery `CREATING`, phân loại lỗi Google và regenerate an toàn.

## Ngoài phạm vi

- Không triển khai V16E.
- Không gọi Google thật, cấp OAuth hoặc push.

## Verification

Chạy toàn bộ command trong yêu cầu task; chỉ commit khi tất cả PASS.
