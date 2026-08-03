# CI/CD disk-full rollback hardening

## Task level

Level 3 — thay đổi deployment, runtime secrets và cơ chế rollback production.

## Problem

Production Web không healthy trong lúc deploy. Khi rollback, filesystem VPS hết dung
lượng làm thao tác tạo `.env` tạm thất bại; các lần gọi Compose sau đó báo thiếu
`DB_PASSWORD`, `MYSQL_ROOT_PASSWORD` và `GHCR_OWNER`.

## Root cause

`set_image_tag` dựa vào `set -e` để dừng trước lệnh `mv` khi `awk` không ghi hết file
tạm. Nhánh rollback bật `set +e`, vì vậy lỗi `ENOSPC` bị bỏ qua và file tạm dở dang vẫn
được đổi tên đè lên `.env` active. Rollback tiếp tục gọi Compose bằng env đã hỏng.

## Decision

- Mọi bước tạo và kích hoạt env phải kiểm tra explicit, không phụ thuộc `errexit`.
- `.env.next` phải được validate trước khi kích hoạt.
- Deploy dừng trước mutation khi còn dưới 1 GiB hoặc 10.000 inode.
- Giữ snapshot đầy đủ của env trước khi đổi tag; rollback khôi phục snapshot bằng
  `mv` trước khi gọi Compose.

## Changes

- Tách thao tác đọc/validate/ghi env vào `scripts/deploy-env.sh`.
- Thêm regression test mô phỏng lệnh ghi tag thất bại và xác nhận env active không đổi.
- Cập nhật workflow để copy helper và validate `.env.next`.
- Bổ sung storage preflight, env snapshot và rollback fail-safe trong script production.

## Verification

- `bash scripts/deploy-env.test.sh` kiểm tra failure/success path của atomic tag update.
- `bash -n` kiểm tra cú pháp các deployment shell script.
- `npm run check:ci` kiểm tra source, test, build, repository guard và docs link.
- Compose config production được render bằng fixture secret cục bộ, không dùng secret thật.

## Documentation updated

- `docs/architecture/deployment.md`
- `docs/implementation/status.md`
- `docs/operations/production.md`
- `docs/operations/troubleshooting.md`

## Rollback

Revert workflow, helper và script về commit trước. Không rollback database/media. Trước
khi deploy bản cũ phải đảm bảo filesystem có đủ dung lượng và `.env` active đã validate;
nếu không, lỗi cũ có thể tái diễn.

## Remaining risks

Ngưỡng 1 GiB/10.000 inode chỉ là guard tối thiểu, không thay thế capacity monitoring hay
ước lượng kích thước image, database backup và media recovery set theo dữ liệu thực tế.
