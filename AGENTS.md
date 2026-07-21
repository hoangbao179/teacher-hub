# AGENTS.md — Lớp học cô Vy

Hướng dẫn mặc định cho Codex, Cursor và các AI agent khi làm việc trong repository.

Mục tiêu: sửa đúng phạm vi, dùng ít context, kiểm tra đủ và giữ lịch sử Git dễ hiểu.

---

## 1. Repository

Đây là npm workspaces monorepo:

- `client/`: React, Vite, MUI.
- `server/`: Express, MySQL.
- `shared/`: contracts, DTO và enum dùng chung.
- `docs/`: nghiệp vụ, kiến trúc và hướng dẫn vận hành.

Không copy DTO giữa client và server.

Luôn import contract từ:

```text
@teacher/shared
```

Runtime chuẩn:

```text
Node.js 24
npm 12
```

---

## 2. Source of truth

### Business và API

Khi có mâu thuẫn, ưu tiên:

1. Business rules đã được duyệt trong `docs/product-spec/`.
2. ADR trong `docs/decisions/`.
3. Acceptance criteria liên quan trực tiếp.
4. Contracts trong `shared/src/`.
5. `docs/api/openapi.yaml`.
6. Migration và source đang chạy.

### Giao diện

Ưu tiên:

1. Ứng dụng đang chạy và đã được user duyệt.
2. Screenshot V2 trong `docs/wireframes/v2-branding/`.
3. Hướng dẫn trong `docs/design/ui-guidelines.md`.
4. Wireframe P0.

Wireframe P0 chỉ mô tả luồng và phân cấp thông tin.

Không dùng text hoặc số liệu trong ảnh wireframe để thay đổi business rule.

---

## 3. Business rules cố định của V1

- Chỉ có một giáo viên/admin.
- Học sinh và phụ huynh không có tài khoản.
- Một học sinh chỉ có tối đa một enrollment `ACTIVE`.
- Lớp 1 kèm 1 và lớp nhóm dùng chung domain model.
- Học phí tính theo gói đúng 8 buổi.
- Thời lượng buổi học không làm tăng số buổi học phí.
- `PRESENT` mới có thể được tính học phí.
- `ABSENT` không tính học phí.
- `FREE` có lịch sử học nhưng không tính học phí.
- Enrollment `FREE` không tạo chu kỳ học phí.
- Dữ liệu nhập muộn xử lý theo ngày học thực tế.
- Chu kỳ đủ 8 buổi chuyển thành `PAYMENT_DUE`.
- V1 không hỗ trợ thanh toán một phần.
- Chu kỳ `PAID` và các item của nó bất biến.
- Lịch lặp chỉ là lịch dự kiến, không chứng minh đã dạy.
- Buổi học bù có thể chỉ gồm một số học sinh.
- Đóng lớp và ngừng học phải giữ lịch sử.
- Không tự thêm CMS, payment gateway, notification, nhiều giáo viên hoặc tài
  khoản phụ huynh/học sinh khi user chưa mở scope.

Không thay đổi các rule trên trong task UI hoặc maintenance.

---

## 4. Architecture rules

### Backend

- Controller: HTTP input/output, auth và status mapping.
- Service: business rule và transaction orchestration.
- Repository: SQL và row mapping.
- Không đặt SQL trong controller.
- Không gọi external API bên trong database transaction.
- Mutation liên quan nhiều bảng phải có transaction.
- Không sửa migration đã được áp dụng; luôn tạo migration mới.

### Frontend

- API call đặt trong `client/src/api/`.
- Page không gọi `fetch` trực tiếp.
- Internal navigation dùng React Router.
- Mobile-first trong dải 360–430 px.
- Không dùng bảng rộng cho luồng mobile.
- Không hiển thị raw enum cho end user.
- Không để nút trông như có thể bấm nhưng không có hành động.

### Database

- Tiền lưu bằng số nguyên VND.
- Thời lượng lưu bằng phút nguyên.
- Ngày học dùng `DATE`.
- Giờ học dùng `TIME`.
- Hiển thị theo `Asia/Ho_Chi_Minh`.
- Không hard-delete dữ liệu đã phát sinh nghiệp vụ.

---

## 5. Brand và UI cố định

Brand chính:

```text
Lớp học cô Vy
Tiếng Anh lớp 1–9
Huế
```

Phong cách:

- thân thiện;
- có màu sắc giáo dục;
- phù hợp học sinh lớp 1–9;
- không quá trẻ con;
- Homepage sinh động hơn Admin;
- Admin ưu tiên rõ ràng và thao tác nhanh.

Mobile:

- ưu tiên 360, 375, 390, 393, 400, 412 và 430 px;
- bottom navigation có 5 mục;
- label bottom navigation không được xuống dòng;
- sticky action không che bottom navigation;
- tôn trọng safe area của iPhone và Android;
- không có page-level horizontal scroll.

Footer sau là chủ ý của chủ repository và phải được giữ nguyên:

```text
2026 — từ người hâm mộ cô Vy, with love ❤️
```

Không thay đổi, “chuyên nghiệp hóa” hoặc xóa footer này trừ khi user yêu cầu
trực tiếp.

Media Homepage hiện có thể là ảnh/video tạm.

Chỉ thay media qua cấu hình và hướng dẫn trong:

```text
docs/content/replacing-public-media.md
```

Không thay đổi business logic khi đổi ảnh/video.

---

## 6. Chế độ làm việc mặc định: Lean workflow

Mặc định chỉ đọc những gì liên quan trực tiếp đến task.

Trước khi sửa:

1. Đọc `AGENTS.md`.
2. Đọc feature document hoặc ADR liên quan trực tiếp.
3. Đọc contract, source và test liên quan.
4. Kiểm tra `git status --short`.
5. Xác định rõ file thuộc phạm vi task.

Không mặc định đọc:

- toàn bộ `docs/`;
- toàn bộ source;
- toàn bộ report milestone cũ;
- toàn bộ wireframe;
- toàn bộ Git history.

Chỉ đọc report cũ khi:

- điều tra regression;
- kiểm tra một quyết định trước đây;
- user yêu cầu review milestone;
- task phụ thuộc trực tiếp vào kết quả đó.

Không lặp lại business rule dài trong prompt hoặc report khi chỉ cần dẫn tới tài
liệu nguồn.

---

## 7. Mức độ task và tài liệu cần tạo

### Task nhỏ

Ví dụ:

- sửa text;
- spacing;
- màu sắc;
- một lỗi UI;
- một validation nhỏ;
- dead code.

Không cần tạo task document, acceptance document hoặc report file trừ khi user
yêu cầu.

Chỉ cần:

- sửa code;
- chạy targeted checks;
- tóm tắt trong final response;
- commit sau PASS.

### Task vừa

Ví dụ:

- sửa nhiều màn có liên quan;
- thêm search/filter;
- thay đổi một luồng UX;
- sửa auth hoặc vận hành local.

Tạo tối đa:

```text
docs/implementation/tasks/<TASK_ID>.md
docs/implementation/acceptance/<TASK_ID>.md
.agent-reports/<TASK_ID>-implementation.md
.agent-reports/<TASK_ID>-verification.md
```

Không chia task vừa thành nhiều checkpoint nhỏ nếu không có dependency hoặc rủi
ro riêng biệt.

### Task lớn hoặc rủi ro cao

Chỉ chia checkpoint khi có một trong các yếu tố:

- migration;
- thay đổi business rule;
- auth/security quan trọng;
- nhiều transaction;
- thay đổi API lớn;
- deployment;
- scope nhiều module độc lập.

Mỗi checkpoint phải có lý do rõ ràng.

Không chia checkpoint chỉ để tạo thêm report.

---

## 8. Reporting

Report phải ngắn, chỉ ghi thông tin có giá trị.

Implementation report tối đa gồm:

```md
# <TASK_ID> Implementation

## Phạm vi
## Vấn đề đã sửa
## File chính đã đổi
## API/schema thay đổi
## Kiểm tra đã chạy
## Điểm còn lại
## Commit
```

Verification report tối đa gồm:

```md
# <TASK_ID> Verification

## Acceptance
## Typecheck/lint
## Unit/integration/E2E
## Kiểm tra UI thủ công
## Tài liệu
## Final verdict
```

Verdict cuối phải là một trong hai:

```text
PASS
FAIL
```

Không copy toàn bộ log command vào report.

Chỉ ghi:

- command;
- kết quả;
- lỗi quan trọng nếu có.

Không commit screenshot tạm, video test hoặc log lớn vào `.agent-reports/`.

Screenshot đã được user duyệt mới được đưa vào:

```text
docs/wireframes/v2-branding/
```

---

## 9. Verification tiết kiệm thời gian

Trong lúc phát triển, chạy kiểm tra theo phạm vi.

### Shared/contracts

```bash
npm run build:shared
npm run typecheck
```

### Backend

```bash
npm -w server run typecheck
npm -w server run test
```

Chạy integration khi thay đổi:

- SQL;
- repository;
- transaction;
- auth;
- migration;
- business rule.

```bash
npm run test:integration
```

### Frontend

```bash
npm -w client run typecheck
npm -w client run lint
```

Chạy E2E targeted khi thay đổi luồng UI.

### Gate cuối task

Chỉ chạy một lần ở cuối:

```bash
npm run check:full
```

Khi thay đổi package/release:

```bash
npm run package:source
npm run check:package
```

Không chạy `check:full` sau từng thay đổi nhỏ.

Không tuyên bố PASS khi command bắt buộc chưa chạy hoặc bị lỗi.

---

## 10. Documentation discipline

Chỉ cập nhật tài liệu khi thay đổi:

- business rule;
- API;
- contract;
- schema;
- auth behavior;
- deployment;
- UI convention đã được duyệt;
- user guide.

Không tạo thêm tài liệu trùng nội dung.

Nguồn trạng thái chính:

```text
docs/implementation/status.md
```

Không duy trì nhiều file status mâu thuẫn.

Không sinh lại toàn bộ wireframe khi chỉ thay đổi một vài màn.

Dùng screenshot của ứng dụng chạy thật cho visual reference V2.

---

## 11. Git và tự commit sau PASS

Sau khi task hoặc checkpoint đạt PASS:

1. Chạy:

```bash
git status --short
git diff --stat
git diff --check
```

2. Stage chỉ file thuộc task.

3. Không stage:

- `.env`;
- `.git`;
- `node_modules`;
- local `dist`;
- `.private-data`;
- workbook cá nhân;
- database dump;
- secret;
- log;
- screenshot tạm;
- thay đổi có sẵn của user không thuộc task.

4. Kiểm tra:

```bash
git diff --cached --stat
git diff --cached --check
```

5. Tự tạo commit bằng tiếng Việt.

Format:

```text
<type>(<scope>): <mô tả tiếng Việt>
```

Ví dụ:

```text
feat(home): hoàn thiện giao diện trang chủ cô Vy
fix(auth): sửa đổi mật khẩu và giới hạn đăng nhập
style(admin): tối ưu bộ lọc và bố cục mobile
docs: cập nhật tài liệu và ảnh tham chiếu V2
test: bổ sung kiểm thử tìm kiếm học sinh
chore(release): hoàn tất kiểm tra gói phát hành
```

6. Ghi commit hash vào report hoặc final response.

Không commit khi:

- verdict là FAIL;
- test bắt buộc chưa chạy;
- có secret/private data trong staged diff;
- diff trộn thay đổi ngoài task;
- không xác định rõ phạm vi.

Không:

- `git reset --hard`;
- `git commit --amend`;
- squash hoặc rewrite history;
- force commit code lỗi;
- tự push remote.

---

## 12. Security và private data

Không log hoặc commit:

- password;
- password hash;
- JWT;
- database credentials;
- `.env`;
- dữ liệu học sinh thật;
- workbook riêng tư.

Ứng dụng không được lưu raw password trong:

- localStorage;
- sessionStorage;
- IndexedDB;
- client-readable cookie.

Khi chia sẻ source, chỉ dùng:

```bash
npm run package:source
npm run check:package
```

Không ZIP nguyên working directory.

---

## 13. Final response

Final response phải ngắn và có:

1. Đã sửa gì.
2. Kiểm tra nào đã chạy.
3. Kết quả PASS hoặc FAIL.
4. Commit hash và commit message nếu đã commit.
5. Điểm còn tồn tại thực sự.

Không lặp lại toàn bộ report trong final response.
