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

Yêu cầu: Node.js 24.18.0 LTS, npm 12.0.1, Docker và Docker Compose.

```bash
npm install -g npm@12.0.1
cp server/.env.example server/.env
cp client/.env.example client/.env
npm ci
docker compose up -d mysql
npm run db:migrate
npm run db:bootstrap-admin
npm run dev
```

Mặc định:

- Web: `http://localhost:5173`
- API: `http://localhost:4000`
- Health: `http://localhost:4000/health`
- MySQL: `localhost:3306`

Thông tin admin ban đầu lấy từ `server/.env`:

```env
BOOTSTRAP_ADMIN_EMAIL=teacher@example.com
BOOTSTRAP_ADMIN_PASSWORD=change-me-now
```

Hãy đổi password trước khi dùng thật.

## Trước khi code tính năng

1. Đọc `AGENTS.md`.
2. Đọc `docs/README.md`.
3. Đọc tài liệu nghiệp vụ liên quan trong `docs/product-spec/` và `docs/features/`.
4. Không suy diễn nghiệp vụ từ wireframe nếu tài liệu chữ đã quy định khác.
5. Cập nhật docs cùng lúc khi thay đổi business rule, schema, API hoặc deploy.

## Trạng thái codebase

Base đã có:

- workspace và build pipeline;
- auth một tài khoản giáo viên;
- schema MySQL đầy đủ cho V1;
- API nền cho lớp, học sinh, buổi học, học phí, lịch và dashboard;
- business service hoàn thành buổi học và tự phân bổ chu kỳ 8 buổi;
- frontend shell mobile-first và các route chính;
- Docker/CI/docs/rules cho Cursor và Codex.

Đây chưa phải sản phẩm hoàn thiện. Xem `docs/implementation/milestones.md` để triển khai theo từng milestone.
