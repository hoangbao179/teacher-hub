# Teacher Class Hub

Monorepo mobile-first cho website giới thiệu giáo viên và hệ thống quản lý lớp học, buổi học, học sinh, lịch học và chu kỳ học phí 8 buổi.

## Cấu trúc

- `client/`: React + Vite + MUI, gồm trang public và trang quản trị.
- `server/`: Express + MySQL, kiến trúc controller → service → repository.
- `shared/`: contracts, enums và DTO dùng chung giữa frontend/backend.
- `docs/`: nguồn tài liệu chuẩn cho người phát triển, Cursor và Codex.
- `.cursor/rules/` và `AGENTS.md`: guardrail bắt buộc cho AI coding agent.

Đây là **một repository**, không phải hai project độc lập. Production vẫn có thể build thành hai image `web` và `api` để deploy an toàn, nhưng code, contracts, tài liệu và CI nằm chung một nơi.

## Khởi động nhanh

Yêu cầu local: Node.js 24.18.0 LTS, npm 12.0.1 và MySQL 8 native đang chạy.
Docker Compose chỉ là lựa chọn deploy/isolated environment, không phải dependency
của test runner local.

```bash
npm install -g npm@12.0.1
cp server/.env.example server/.env
cp client/.env.example client/.env
npm ci
npm run db:migrate
npm run db:bootstrap-admin
npm run db:seed:dev
npm run dev
```

Mặc định:

- Web: `http://localhost:5173`
- API: `http://localhost:4000`
- Health: `http://localhost:4000/health`
- MySQL native: `localhost:3306` (theo `server/.env`)

Thông tin admin ban đầu lấy từ `server/.env`:

```env
BOOTSTRAP_ADMIN_USERNAME=covy
BOOTSTRAP_ADMIN_PASSWORD=change-me-now
```

Hãy đổi password trước khi dùng thật.
Sau bootstrap, có thể đổi riêng mật khẩu của admin hiện hữu bằng
`npm run admin:reset-password`; sửa `.env` hoặc chạy `npm run dev` không tự cập
nhật credential trong database.

`npm run db:seed:dev` tạo idempotent dữ liệu giả `DEV_*` gồm lớp nhóm, lớp 1 kèm
1, năm học sinh, ba tuition mode, schedules và trạng thái paused/closed.
`npm run db:reset:dev` xóa toàn bộ business data trên MySQL cục bộ nhưng giữ
`users` và `schema_migrations`; không chạy lệnh này với dữ liệu cần giữ.

## Cấu hình nội dung công khai của cô Vy

`client/src/content/publicHome.ts` là nguồn duy nhất cho branding, chương trình
Tiếng Anh lớp 1–9, phương pháp, media, video, phản hồi, liên hệ và SEO. Các giá trị
theo deployment được khai báo bằng `VITE_PUBLIC_*` theo `client/.env.example`.

Các giá trị liên hệ/domain trong file example là placeholder phát triển; action
không hợp lệ sẽ bị ẩn khỏi Homepage. Trước khi build production, cung cấp Zalo và domain
thật; Facebook dùng URL mặc định đã duyệt. Đồng bộ domain đó vào `client/public/sitemap.xml`
và `client/public/robots.txt`, sau đó chạy:

```bash
npm -w client run validate:public
npm -w client run build:production
```

Validator production từ chối domain/liên hệ mẫu và nội dung phản
hồi “minh họa”. Không đặt secret vào biến `VITE_*` vì mọi giá trị này được nhúng
vào trình duyệt.

## Trước khi code tính năng

1. Đọc `AGENTS.md`.
2. Đọc `docs/README.md`.
3. Đọc tài liệu nghiệp vụ liên quan trong `docs/product-spec/` và `docs/features/`.
4. Không suy diễn nghiệp vụ từ wireframe nếu tài liệu chữ đã quy định khác.
5. Cập nhật docs cùng lúc khi thay đổi business rule, schema, API hoặc deploy.

## Lệnh kiểm tra và vận hành

```bash
npm run check:fast       # typecheck, lint, unit, build
npm run check:full       # thêm integration, E2E, consistency
npm run package:source   # tạo controlled source snapshot + SHA-256 trong release/
npm run check:package    # kiểm tra checksum và nội dung cấm trong archive
npm run db:backup -- ./backups/pre-deploy.sql
npm run db:restore -- ./backups/pre-deploy.sql --confirm
```

Hướng dẫn đầy đủ: `docs/deployment/local-development.md`,
`docs/deployment/production.md` và `docs/deployment/backup-and-restore.md`.
Source package loại `.git`, env thật, dependency/build local, report/screenshot,
dump/backup và workbook riêng tư. Manifest trong archive ghi base commit và cho biết
snapshot có chứa working-tree changes hay không.

## Trạng thái codebase

Base đã có:

- workspace và build pipeline;
- auth một tài khoản giáo viên;
- schema MySQL đầy đủ cho V1;
- API nền cho lớp, học sinh, buổi học, học phí, lịch và dashboard;
- business service hoàn thành buổi học và tự phân bổ chu kỳ 8 buổi;
- frontend shell mobile-first và các route chính;
- Docker/CI/docs/rules cho Cursor và Codex.

Repository đang ở giai đoạn release candidate V1, chưa phải phê duyệt production.
Xem `docs/implementation/release-checklist.md` và báo cáo M6.
