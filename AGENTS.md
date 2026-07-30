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

## 7. Mức độ task, kiểm thử và tài liệu

Phân loại task theo diff thực tế và rủi ro, không theo số file đơn thuần.

### Mức 1 — thay đổi rất nhỏ

Ví dụ:

- text, label, icon;
- spacing, màu, border hoặc responsive CSS nhỏ;
- dead code;
- config không ảnh hưởng runtime logic.

Chỉ chạy tối đa 2–3 command liên quan trực tiếp. Với thay đổi frontend, thường là:

```bash
npm -w client run typecheck
npm -w client run lint
```

Nếu CSS/JSX rất nhỏ và hai command trên PASS thì không chạy build, unit toàn
repo, integration, E2E hoặc `check:full`. Có thể kiểm tra trực quan đúng một route
và viewport bằng Playwright khi task là lỗi UI thực tế.

Không cần tạo task document, acceptance document hoặc report file trừ khi user
yêu cầu.

### Mức 2 — logic cục bộ

Ví dụ:

- một component;
- validation nhỏ;
- utility;
- state management trong một feature;
- service thuần không đụng database.

Chạy typecheck/lint của workspace liên quan và unit test đúng file hoặc feature.
Không chạy integration/E2E nếu logic không đi qua database hoặc browser flow.

Task Mức 2 chỉ cần tài liệu triển khai khi thay đổi convention đã được duyệt hoặc
khi user yêu cầu.

### Mức 3 — thay đổi một luồng

Ví dụ:

- search → select → save;
- form submit hoặc API gọi từ UI;
- mobile navigation;
- upload/import ảnh;
- một endpoint và màn hình tương ứng.

Chạy typecheck/lint workspace liên quan, targeted unit tests và đúng một hoặc vài
targeted integration/E2E liên quan trực tiếp. Không chạy toàn bộ E2E.

Task Mức 3 có thể tạo tối đa:

```text
docs/implementation/tasks/<TASK_ID>.md
docs/implementation/acceptance/<TASK_ID>.md
.agent-reports/<TASK_ID>-implementation.md
.agent-reports/<TASK_ID>-verification.md
```

Không chia thành nhiều checkpoint nhỏ nếu không có dependency hoặc rủi ro riêng
biệt.

### Mức 4 — thay đổi lớn hoặc rủi ro cao

Ví dụ:

- migration/schema hoặc transaction nhiều bảng;
- auth/security quan trọng;
- contract shared ảnh hưởng cả client và server;
- refactor nhiều module;
- deployment, workflow CI hoặc Docker runtime phạm vi lớn;
- thay đổi xuyên client/server/database.

Chạy targeted checks trước, sau đó integration liên quan và E2E smoke hoặc full
khi rủi ro thực sự yêu cầu. Chỉ Mức 4 mới mặc định được cân nhắc `check:ci` hoặc
`check:full`.

Chỉ chia checkpoint khi có một trong các rủi ro trên hoặc scope gồm nhiều module
độc lập. Mỗi checkpoint phải có lý do rõ ràng; không chia chỉ để tạo thêm report.

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

`PASS` nghĩa là acceptance criteria đạt, các targeted mandatory checks đúng với
mức task đã PASS và không còn lỗi trong phạm vi sửa. `PASS` không bắt buộc phải
có `check:full`.

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

## 9. Verification local theo phạm vi

### Nguyên tắc

- Không mặc định chạy `npm run check:full` hoặc `npm run check:ci` ở local.
- Không mặc định chạy toàn bộ integration hoặc toàn bộ E2E.
- CI/CD là gate rộng cho mỗi push; full regression là gate nightly/manual.
- Agent local chỉ chạy kiểm tra đủ để chứng minh phần vừa sửa hoạt động.
- Không chạy lại cùng một command đã PASS nếu source liên quan không đổi.
- Không chạy build shared khi không đụng `shared/`.
- Không chạy server checks cho thay đổi chỉ ở client và ngược lại.
- Không khởi động MySQL, Chrome hoặc E2E infrastructure nếu không cần.
- Không chạy test ngoài phạm vi chỉ để “cho chắc”.

Các shortcut workspace:

```bash
npm run check:client
npm run check:server
npm run check:shared
```

Ưu tiên command chi tiết hoặc test file/feature cụ thể khi shortcut vẫn rộng hơn
phạm vi cần chứng minh.

### Test budget

Với Mức 1, tối đa 2–3 command verification liên quan trực tiếp.

Với Mức 2, chạy test file/feature liên quan trước. Chỉ mở rộng khi targeted test
thất bại hoặc cho thấy ảnh hưởng lan rộng.

Với Mức 3, dùng targeted integration/E2E đúng luồng; không chạy toàn bộ suite.
Targeted E2E cụ thể của feature không cần user xác nhận.

### Escalation

Chỉ mở rộng phạm vi kiểm thử khi:

- targeted test thất bại;
- type error xuất hiện ở module khác;
- contract thay đổi gây ảnh hưởng nhiều workspace;
- lỗi chỉ tái hiện qua integration/E2E;
- diff thực tế lớn hơn dự kiến;
- phát hiện thay đổi database, auth hoặc security.

Trước khi mở rộng, ghi một câu ngắn:

```text
Targeted check cho thấy ảnh hưởng sang X, nên mở rộng sang Y.
```

Không âm thầm chuyển từ task CSS sang full regression.

### Command nặng

Các command sau được xem là nặng:

```text
npm run check
npm run check:ci
npm run check:full
npm run test:integration
npm run test:e2e
npm run test:e2e:full
docker build cả API và Web
npm run package:source
```

Nếu task không phải Mức 4, agent không tự chạy các command này. Nếu targeted
evidence cho thấy cần mở rộng, phải nêu lý do cụ thể, phạm vi rủi ro và xin user
xác nhận trước khi chạy command nặng. Targeted integration hoặc targeted E2E của
một feature không thuộc hạn chế này.

### Khi nào được chạy `check:full`

Chỉ chạy `check:full` khi có ít nhất một điều kiện:

1. User yêu cầu rõ “test full”, “rà soát toàn bộ” hoặc tương đương.
2. Chuẩn bị release/package source.
3. Thay đổi migration/schema.
4. Thay đổi auth/security quan trọng.
5. Thay đổi contract shared ảnh hưởng cả client và server.
6. Refactor xuyên nhiều module.
7. Thay đổi workflow CI/CD hoặc Docker runtime có phạm vi lớn.
8. Targeted tests không đủ cô lập rủi ro và agent đã ghi rõ lý do.

Nếu không thuộc các trường hợp trên thì không chạy `check:full`.

Khi thay đổi package/release và đã xác định thuộc Mức 4:

```bash
npm run package:source
npm run check:package
```

### Ví dụ quyết định

- Sửa khoảng cách button: client typecheck, client lint, screenshot đúng route
  nếu cần; không full E2E.
- Sửa bottom navigation nháy: client typecheck, client lint,
  mobile-navigation targeted E2E; không integration hoặc full E2E.
- Sửa bulk chọn ảnh: client/server typecheck liên quan, unit test
  scheduler/provider, vocabulary-media targeted E2E; không chạy lesson, tuition
  hoặc Google Sheet E2E.
- Sửa repository SQL: server typecheck, targeted server unit/integration; không
  chạy toàn bộ client E2E.
- Sửa migration/auth/contract shared: kiểm tra rộng hơn; có thể chạy `check:ci`
  hoặc `check:full` tùy phạm vi.

Không tuyên bố “all tests passed” khi chỉ chạy targeted tests; dùng “targeted
checks passed”. Không tuyên bố PASS khi targeted mandatory check chưa chạy hoặc
bị lỗi.

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
- targeted mandatory checks theo mức task chưa chạy;
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
2. Task level.
3. Command đã chạy và command không chạy.
4. Lý do không chạy full regression nếu không chạy.
5. Kết quả PASS hoặc FAIL.
6. Commit hash và commit message nếu đã commit.
7. Điểm còn tồn tại thực sự.

Không lặp lại toàn bộ report trong final response.
