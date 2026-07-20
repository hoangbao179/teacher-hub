# Verification report

The upgraded dependency tree was installed from a clean state and passed:

```bash
npm run typecheck
npm run lint
npm run build
```

This includes:

- shared ESM/CJS build;
- server typecheck and production build;
- client typecheck;
- ESLint 10;
- Vite 8 production build.

The artifact-generation environment exposed Node.js 22.16 rather than the target Node.js 24.18.0, so the exact runtime binary was not available for execution there. The repository prevents accidental use of the wrong runtime through:

- `.nvmrc` and `.node-version`;
- Volta pins;
- `engines` plus `engine-strict=true`;
- GitHub Actions Node 24.18.0;
- Docker images based on Node 24.18.0.

Before feature development on a local machine, run:

```bash
node -v
npm -v
npm ci
npm run verify
```

Expected versions:

```text
Node.js v24.18.0
npm 12.0.1
```

MySQL native smoke-test local:

```bash
cp server/.env.example server/.env
npm run db:migrate
npm run db:bootstrap-admin
npm run dev
```

Integration/E2E tạo schema tách biệt bằng hậu tố `_test` trên cùng MySQL native;
runner từ chối prepare database không kết thúc bằng `_test` và không reset schema
ứng dụng. Docker không được dùng cho các test này.

## Repository consistency

`npm run check:repo` đối chiếu method/path giữa Express và OpenAPI, kiểm tra bộ
tài liệu implementation bắt buộc, manifest thủ công, generated artifacts đã
track, empty click handlers và việc status khai `PASS` khi chưa có verification
report. Check có chủ đích giới hạn ở các dấu hiệu ổn định, không parse JSX/YAML
toàn phần để tránh brittle false positive.

`npm run check` chạy typecheck, lint, production build, unit tests, MySQL
integration tests, browser smoke test và consistency check.
