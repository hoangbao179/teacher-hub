# AGENTS.md — Teacher Class Hub

File này là hướng dẫn mặc định cho Codex/Cursor/AI agent khi làm việc trong repository.

## 1. Repository reality

Đây là npm workspaces monorepo:

- `server/`: Express + MySQL, CommonJS build.
- `client/`: React + Vite + MUI, ES modules.
- `shared/`: source of truth cho contracts/DTO/enums dùng chung.
- `docs/`: source of truth cho nghiệp vụ và kiến trúc.

Không copy DTO giữa `server` và `client`. Import từ `@teacher/shared`.

## 2. Source-of-truth priority

Khi có mâu thuẫn, dùng thứ tự:

1. Business rules trong `docs/product-spec/` và ADR đã approved trong `docs/decisions/`.
2. Acceptance criteria trong `docs/product-spec/09-acceptance-tests.md` và `docs/implementation/acceptance/`.
3. Contracts trong `shared/src/contracts/`.
4. `docs/api/openapi.yaml`.
5. Migration/schema và source hiện tại.
6. Wireframe.

Wireframe là tham chiếu UX, không phải nguồn business logic. Ảnh AI có thể chứa text/số liệu không nhất quán.

## 3. V1 business boundaries

- Chỉ một giáo viên/admin.
- Học sinh không phải user.
- Một học sinh chỉ có tối đa một enrollment `ACTIVE`.
- Lớp 1 kèm 1 và lớp nhóm dùng cùng domain model.
- Học phí theo gói 8 buổi, không theo số giờ.
- Chỉ attendance `PRESENT` và `countsForTuition=true` mới cộng chu kỳ.
- `ABSENT` không cộng; `FREE` có học nhưng không cộng.
- Học sinh `tuitionMode=FREE` không tạo chu kỳ học phí.
- Giờ thực tế chỉ để theo dõi/export, không quy đổi số buổi.
- Dữ liệu nhập muộn phải xử lý theo ngày học thực tế.
- Chu kỳ đủ 8 tự chuyển `PAYMENT_DUE`.
- Thanh toán toàn bộ; V1 không thanh toán một phần.
- Chu kỳ `PAID` bị khóa; chỉnh sửa phải có flow mở khóa rõ ràng, không âm thầm sửa.
- Đóng lớp/ngừng học là đổi trạng thái, không xóa lịch sử.
- Không triển khai notification, Zalo/Messenger API, payment gateway, CMS, nhiều giáo viên trong V1 nếu user không mở scope.

## 4. Architecture rules

Backend layering:

- Controller: parse input, auth, HTTP mapping.
- Service: business rules, transaction orchestration.
- Repository: SQL và row mapping.
- Không đặt SQL trong controller.
- Không gọi API ngoài trong DB transaction.

Frontend:

- API calls ở `client/src/api/`.
- Page không gọi `fetch` trực tiếp.
- Mobile-first 360/375/390/430px.
- Không dùng bảng rộng cho luồng thao tác mobile; dùng cards/lists.
- Bottom navigation là navigation chính cho admin mobile.

Database:

- Tiền lưu `BIGINT` VND.
- Thời lượng lưu phút nguyên.
- Ngày học lưu `DATE`, giờ lưu `TIME`.
- Hiển thị theo `Asia/Ho_Chi_Minh`.
- Không xóa cứng dữ liệu đã phát sinh học phí.

## 5. Change discipline

Trước thay đổi không nhỏ:

1. Đọc docs liên quan.
2. Đọc shared contract liên quan.
3. Đọc controller/service/repository/schema liên quan.
4. Chọn diff nhỏ nhất đúng nghiệp vụ.
5. Cập nhật docs nếu đổi rule/API/schema/deploy.
6. Chạy verification phù hợp.

Không:

- refactor rộng ngoài task;
- tự thêm dependency nặng;
- log password/JWT/secret;
- tin `studentId`, `userId` từ client nếu server có context authoritative;
- tuyên bố build/test thành công nếu chưa chạy.

## 6. Verification

Sau thay đổi shared: build shared + typecheck server/client.

Sau backend/schema:

```bash
npm -w server run typecheck
npm -w server run build
```

Sau frontend:

```bash
npm -w client run typecheck
npm -w client run lint
npm -w client run build
```

Toàn repo:

```bash
npm run verify
```

Kiểm tra UTF-8 sau khi sửa docs tiếng Việt:

```bash
rg "Ã|Ä|á»|áº|Â|�" docs AGENTS.md .cursor server shared client
```
## 7. Task lifecycle and reporting

Every non-trivial task must have a unique task ID, for example:

- M2A-lesson-domain
- M2B-lesson-api
- M2C-lesson-ui
- M3-chronological-recalculation

Before implementation:

1. Read the task document in `docs/implementation/tasks/`.
2. Read the matching acceptance document.
3. Inspect current git status and relevant migrations.
4. Record the initial repository state in the implementation report.

Required reports:

- `.agent-reports/<TASK_ID>-implementation.md`
- `.agent-reports/<TASK_ID>-verification.md`

The implementation report must include:

- scope completed;
- files changed;
- migrations added;
- API and contract changes;
- business rules affected;
- commands executed;
- test results;
- manual UI verification;
- known gaps;
- current git status.

The verification report must end with exactly one verdict:

- `PASS`
- `FAIL`

An agent must not declare PASS when:

- a required command was not run;
- a test failed;
- browser verification was skipped when required;
- documentation or OpenAPI is stale;
- a P0 acceptance item remains unresolved.

Do not automatically continue to the next checkpoint after FAIL.

Do not update `docs/implementation/status.md` to PASS until the matching
verification report is PASS.

## 8. Milestone checkpoint discipline

Large milestones must be split into reviewable checkpoints.

For every checkpoint:

1. implement only the checkpoint scope;
2. run the required fast checks;
3. run milestone-level full checks when applicable;
4. write reports;
5. stop on failure;
6. keep the diff reviewable.

Do not implement M2 through M6 as one undifferentiated change set.

The agent may execute multiple checkpoints in one session only when each
checkpoint has its own task document, report, verification gate and git
checkpoint.

## 9. Migration discipline

- Never edit an already-applied migration.
- Add a new forward-only migration.
- Never reset an unknown or production-like database.
- Backfills must be explicit and verifiable.
- Schema changes and application changes must be deployable in a safe order.
- New constraints must account for existing rows before being enabled.

## 10. Lesson-domain warning

The current lesson create/complete implementation is pre-M2 scaffold code.

It is not authoritative for:

- participant selection;
- historical enrollment eligibility;
- effective-dated tuition;
- makeup participant selection;
- chronological tuition allocation.

When implementing M2/M3, refactor or replace this flow according to the
approved ADRs. Do not preserve behavior that conflicts with those ADRs.

## 11. Visual references

- Ứng dụng chạy thật và screenshot đã approved trong
  `docs/wireframes/v2-branding/` là tham chiếu visual hiện hành.
- Wireframe P0 vẫn là tham chiếu workflow và phân cấp thông tin; không dùng text/số
  liệu trong ảnh để thay đổi business rule.
- Khi đã có V2 cho một màn hình, không hoàn nguyên styling về P0 cũ.
- Media Homepage tạm thời chỉ được thay qua cấu hình/quy trình trong
  `docs/content/replacing-public-media.md`, không làm đổi business logic.
