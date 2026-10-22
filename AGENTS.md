# AGENTS.md — Lớp học cô Vy

Quy tắc bắt buộc cho Codex, Cursor và các AI agent làm việc trong repository.
Mục tiêu là sửa đúng phạm vi, kiểm tra theo rủi ro và chỉ giữ kiến thức có giá trị
lâu dài trong Git.

---

## 1. Repository và runtime

Đây là npm workspaces monorepo:

- `client/`: React, Vite, MUI;
- `server/`: Express, MySQL;
- `shared/`: contracts, DTO và enum dùng chung;
- `docs/`: nghiệp vụ, kiến trúc, quyết định và vận hành.

Không copy DTO giữa client và server. Luôn import contract từ `@teacher/shared`.

Runtime chuẩn:

```text
Node.js 24
npm 12
```

## 2. Source of truth

Khi có mâu thuẫn về business hoặc API, ưu tiên:

1. business rules đã duyệt trong `docs/product-spec/`;
2. ADR có trạng thái accepted trong `docs/decisions/`;
3. acceptance conditions trong product spec hoặc feature doc liên quan;
4. contracts trong `shared/src/`;
5. `docs/api/openapi.yaml`;
6. migration và source đang chạy.

Khi có mâu thuẫn về giao diện, ưu tiên:

1. ứng dụng đang chạy và đã được user duyệt;
2. baseline đã duyệt trong `docs/ui-baselines/`, nếu có;
3. screenshot V2 trong `docs/wireframes/v2-branding/`;
4. `docs/design/ui-guidelines.md`;
5. wireframe P0.

Wireframe P0 chỉ mô tả luồng và phân cấp thông tin. Không dùng text hoặc số liệu
trong ảnh wireframe để thay đổi business rule.

`docs/implementation/status.md` là nguồn duy nhất mô tả trạng thái hiện hành.
Lịch sử thay đổi nằm trong Git, không ghi nhật ký task vào status.

## 3. Business, architecture và UI bắt buộc

### Business V1

- Chỉ có một giáo viên/admin; học sinh và phụ huynh không có tài khoản.
- Một học sinh chỉ có tối đa một enrollment `ACTIVE`.
- Lớp 1 kèm 1 và lớp nhóm dùng chung domain model.
- Học phí tính theo gói đúng 8 buổi; thời lượng không làm tăng số buổi học phí.
- Chỉ `PRESENT` có thể tính học phí; `ABSENT` và `FREE` không tính học phí.
- Enrollment `FREE` không tạo chu kỳ học phí.
- Dữ liệu nhập muộn xử lý theo ngày học thực tế.
- Chu kỳ đủ 8 buổi chuyển thành `PAYMENT_DUE`; V1 không thanh toán một phần.
- Chu kỳ `PAID` và item của nó bất biến.
- Lịch lặp chỉ là lịch dự kiến, không chứng minh đã dạy.
- Buổi học bù có thể chỉ gồm một số học sinh.
- Đóng lớp và ngừng học phải giữ lịch sử.
- Không tự thêm CMS, payment gateway, notification, nhiều giáo viên hoặc tài
  khoản phụ huynh/học sinh khi user chưa mở scope.

Không thay đổi các rule trên trong task UI hoặc maintenance.

### Backend và database

- Controller xử lý HTTP input/output, auth và status mapping.
- Service giữ business rule và transaction orchestration.
- Repository giữ SQL và row mapping; không đặt SQL trong controller.
- Không gọi external API trong database transaction.
- Mutation nhiều bảng phải có transaction.
- Không sửa migration đã áp dụng; luôn tạo migration mới.
- Tiền là số nguyên VND; thời lượng là phút nguyên; ngày học dùng `DATE`; giờ học
  dùng `TIME`; hiển thị theo `Asia/Ho_Chi_Minh`.
- Không hard-delete dữ liệu đã phát sinh nghiệp vụ.

### Frontend và brand

- API call đặt trong `client/src/api/`; page không gọi `fetch` trực tiếp.
- Internal navigation dùng React Router.
- Mobile-first ở 360–430 px; không có page-level horizontal scroll.
- Teacher Tools tại `/admin/tools` là giao diện giáo viên mặc định: đơn giản,
  một cột khi thích hợp, nút dễ chạm. Không tự thêm dashboard, sidebar hoặc bottom
  navigation vào Teacher Tools.
- Không dùng bảng rộng cho luồng mobile, không hiện raw enum, không để action giả.
- Chỉ giao diện legacy khi `LEGACY_ADMIN_ENABLED = true` áp dụng bottom navigation
  5 mục, label không xuống dòng. Sticky action không che navigation hiện có và
  phải tôn trọng safe area.
- Website public `/`, `/hoc`, `/sach` tiếp tục hoạt động bình thường. Không tự xóa
  code quản trị cũ hoặc sửa nghiệp vụ lớp, học phí hay dữ liệu ngoài phạm vi task.
- Tạm ẩn frontend không đồng nghĩa vô hiệu hóa các API phía server.
- Brand: `Lớp học cô Vy`, `Tiếng Anh lớp 1–9`, `Huế`.
- Homepage sinh động hơn Admin; Admin ưu tiên rõ ràng và thao tác nhanh.

Giữ nguyên footer này trừ khi user yêu cầu trực tiếp:

```text
2026 — từ người hâm mộ cô Vy, with love ❤️
```

Chỉ thay media Homepage qua cấu hình và hướng dẫn trong
`docs/content/replacing-public-media.md`; không đổi business logic khi đổi media.

## 4. Lean workflow

Trước khi sửa:

1. đọc `AGENTS.md`;
2. phân loại task ban đầu theo mục 5;
3. đọc feature doc, ADR, contract, source và test liên quan trực tiếp;
4. chạy `git status --short`;
5. xác định file thuộc phạm vi task.

Không mặc định đọc toàn bộ docs, source, wireframe hoặc Git history. Chỉ đọc report
cũ khi điều tra regression hay quyết định cũ có liên quan trực tiếp.

Sau khi triển khai và xem final diff, phải phân loại task lần hai. Nếu final diff
có trigger cao hơn đánh giá ban đầu, nâng task level và hoàn thành tài liệu cùng
verification tương ứng trước khi PASS.

## 5. Task classification

Áp dụng theo thứ tự:

1. có bất kỳ trigger Level 3 → toàn task là Level 3;
2. không có Level 3 nhưng có bất kỳ trigger Level 2 → Level 2;
3. còn lại → Level 1.

Số file không tự quyết định level; rủi ro và behavior của final diff mới quyết định.

### Level 1 — thay đổi nhỏ, rủi ro thấp

Ví dụ: màu, spacing, icon, label, responsive nhỏ, typo, documentation correction,
test cleanup hoặc refactor nội bộ một module không đổi behavior/dữ liệu.

Không được là Level 1 nếu chạm database, API contract, auth, deployment, secret,
persisted-data behavior hoặc business rule.

Yêu cầu:

- không tạo task report Markdown;
- final response/PR ghi summary, changed files, checks và kết quả;
- không commit screenshot, log hoặc test artifacts;
- chỉ cập nhật tài liệu khi tài liệu hiện tại sai.

### Level 2 — thay đổi behavior hoặc bug đáng lưu ý

Trigger:

- đổi user-visible behavior hoặc làm rõ business rule;
- bug có root cause đáng ghi nhớ;
- thay đổi cả frontend và backend;
- API non-breaking;
- import/export mapping hoặc external API;
- thay đổi persisted field không thuộc migration rủi ro cao;
- cần regression test mới;
- có khả năng agent sau này hiểu nhầm và sửa ngược.

Yêu cầu:

- cập nhật feature doc, product spec hoặc current-state doc liên quan;
- thêm regression coverage phù hợp;
- chỉ tạo tối đa một change report khi root cause, decision hoặc risk có giá trị
  lâu dài;
- không tạo cặp implementation/verification report;
- không commit screenshot kiểm thử.

### Level 3 — thay đổi rủi ro cao

Trigger:

- database migration, data backfill, data deletion hoặc thao tác khó hoàn tác;
- import hàng loạt ảnh hưởng dữ liệu đã lưu;
- authentication, authorization, OAuth, secrets hoặc `.env`;
- deployment, backup/restore;
- breaking API hoặc cross-service contract;
- thay đổi học phí, số buổi hoặc dữ liệu tài chính;
- thay đổi kiến trúc hoặc security-sensitive change.

Yêu cầu:

- tạo đúng một consolidated change report;
- cập nhật đầy đủ spec/architecture/operations liên quan;
- có migration/data verification và rollback plan khi phù hợp;
- thêm automated regression khi khả thi;
- ghi rõ remaining risks;
- không commit screenshot hoặc log tạm.

## 6. Loại tài liệu

- `AGENTS.md`: workflow, mandatory rules, classification, verification matrix,
  artifact policy, source-of-truth policy và link tới tài liệu chi tiết. Không ghi
  lịch sử task.
- `docs/implementation/status.md`: hệ thống hiện tại hoạt động thế nào; không ghi
  chuỗi “ngày X sửa A”.
- `docs/product-spec/`, `docs/features/`: business rules, expected behavior,
  acceptance conditions và luồng nghiệp vụ.
- `docs/decisions/`: ADR cho quyết định kỹ thuật/kiến trúc cần giữ lâu dài. ADR
  phải có context, decision, alternatives, consequences và status.
- `docs/bug-notes/`: chỉ dành cho bug khó, tái diễn, nhiều module hoặc root cause
  không hiển nhiên. Mẫu: Symptom, Root cause, Resolution, Regression coverage,
  Related files, Remaining risks.
- `docs/operations/`: local/production deployment, secrets, environment,
  backup/restore, OAuth, monitoring, rollback và incident recovery.
- `docs/changes/YYYY-MM/<TASK-ID>.md`: tối đa một report cho Level 2 khi thật sự
  cần giữ kiến thức; bắt buộc cho Level 3. Dùng các mục Task level, Problem, Root
  cause, Decision, Changes, Verification, Documentation updated, Rollback và
  Remaining risks; bỏ mục không cần thay vì tạo nội dung hình thức.

Không tạo tài liệu trùng nội dung. Không dùng report để chỉ liệt kê changed files,
command và PASS/FAIL. Git history đã giữ lịch sử triển khai.

## 7. Verification matrix

Luôn chạy targeted checks trước; không chạy lại command đã PASS nếu source liên
quan không đổi. Không khởi động MySQL, Chrome hoặc hạ tầng ngoài phạm vi.

### Kiểm thử theo feature availability

Đối chiếu `client/src/config/featureAvailability.ts` và
`docs/implementation/status.md` trước khi chọn suite. Hiện tại
`LEGACY_ADMIN_ENABLED = false` và `VOCABULARY_GAMES_ENABLED = false`.

- Ưu tiên regression liên quan của tính năng active: website công khai, Góc học,
  Tủ sách, Teacher Tools, authentication/session/routing liên quan và backend/API
  còn được các luồng active sử dụng.
- Phân biệt **Disabled UI** (giao diện không cho truy cập), **Retained business
  logic** (backend và nghiệp vụ còn tồn tại, cần bảo vệ) và **Active regression**
  (kiểm tra hành vi đang phục vụ người dùng).
- Không tự xóa source, unit test, integration test hoặc E2E chỉ vì module tạm ẩn.
  Unit/integration bảo vệ nghiệp vụ và dữ liệu cũ vẫn có giá trị; chạy khi thay
  đổi liên quan tác động tới chúng.
- Không tự chạy toàn bộ E2E quản trị cũ cho mỗi thay đổi Teacher Tools. E2E màn
  bị ẩn nên thuộc nhóm legacy regression hoặc chạy có điều kiện theo feature flag.
- E2E mặc định không được yêu cầu truy cập màn mà routing chủ động chuyển hướng,
  trừ khi có cơ chế test riêng hợp lệ. Test SKIP không chứng minh chức năng PASS.
- Nếu test hoặc CI gate không còn phù hợp, báo rõ nguyên nhân và đề xuất thay đổi
  nhỏ nhất. Không tự bỏ gate để đạt PASS; điều chỉnh pipeline phải giữ coverage
  tương đương cho tính năng active.

Chỉ mở rộng kiểm thử theo rủi ro và quy định Level 1/2/3 bên dưới.

### Level 1

Tối đa 2–3 command trực tiếp. Frontend nhỏ thường dùng:

```bash
npm -w client run typecheck
npm -w client run lint
```

### Level 2

Chạy typecheck/lint workspace liên quan và unit test đúng file/feature. Chạy
targeted integration/E2E khi behavior đi qua database hoặc browser flow.

### Level 3

Chạy targeted checks, integration liên quan và smoke/full regression khi rủi ro
thực sự yêu cầu. Migration, auth, shared contract xuyên client/server, deployment
runtime lớn hoặc refactor nhiều module có thể cần `check:ci`/`check:full`.

Các command nặng gồm `npm run check`, `check:ci`, `check:full`, toàn bộ integration,
toàn bộ E2E, Docker build cả API/Web và `package:source`. Ngoài Level 3, chỉ mở rộng
khi targeted evidence cho thấy cần thiết và phải nêu lý do, phạm vi rủi ro, xin user
xác nhận trước. Targeted integration/E2E của một feature không thuộc hạn chế này.

Chỉ chạy `check:full` khi user yêu cầu rà toàn bộ, chuẩn bị release/package, hoặc
diff có migration/schema, auth/security, shared contract xuyên workspace,
deployment/CI runtime lớn, refactor nhiều module hay targeted tests không cô lập
được rủi ro.

Không nói “all tests passed” khi chỉ chạy targeted tests; dùng “targeted checks
passed”. Không tuyên bố PASS khi mandatory checks theo final level chưa đạt.

## 8. Screenshot và artifact

Được commit chỉ khi reviewer/user đã duyệt:

- `docs/wireframes/`;
- `docs/ui-baselines/`.

Không xóa wireframe hiện có. UI baseline chỉ giữ số ảnh tối thiểu đại diện cho các
layout thực sự khác nhau.

Không commit Playwright screenshot, ảnh PASS/FAIL, before/after tạm, ảnh agent tự
kiểm tra, trace, video, HTML report, browser log hoặc test result. Lưu chúng tại:

```text
.artifacts/<task-id>/<run-id>/
```

`.agent-reports/` là tên tương thích cho artifact tạm và bị ignore toàn bộ; script
mới phải dùng `.artifacts/`. Trước khi chạy lại cùng task, dọn artifact cũ của task.

`SCREENSHOT_MODE` nhận:

- `off`: không chụp;
- `failure`: chỉ giữ ảnh khi test lỗi;
- `review`: chụp các checkpoint phục vụ review UI.

Mặc định local targeted test và CI là `failure`; manual UI review là `review`.
Không chụp screenshot khi test PASS ở hai mode đầu. CI artifact chỉ upload khi lỗi
và giữ 7 ngày.

## 9. Repository guard và private data

`npm run check:repo` phải chặn file tracked/staged thuộc các nhóm:

- `.agent-reports/`, `.artifacts/`, `playwright-report/`, `test-results/`;
- screenshot ngoài `docs/wireframes/`, `docs/ui-baselines/` và production asset
  source được cho phép;
- log, archive không được phép, build output, binary quá ngưỡng ngoài allowlist;
- `.env`, private data, workbook thật, dump hoặc secret;
- cặp report `implementation.md`/`verification.md` theo quy trình cũ.

Guard không chặn wireframe/baseline đã duyệt, production asset được source dùng,
migration hay fixture cần thiết. Khi chưa xác định chính xác asset có được dùng,
chỉ cảnh báo; không tự xóa.

Không log hoặc commit password/hash, JWT, database credentials, `.env`, dữ liệu học
sinh thật, workbook riêng hoặc database dump. Client không lưu raw password trong
localStorage, sessionStorage, IndexedDB hoặc client-readable cookie.

Khi chia sẻ source, chỉ dùng:

```bash
npm run package:source
npm run check:package
```

Không ZIP nguyên working directory.

## 10. Git và commit sau PASS

### Nguyên tắc commit

- Ưu tiên ít commit, mỗi commit có ý nghĩa; không commit theo từng file hoặc từng
  chỉnh sửa nhỏ. Không trộn thay đổi không liên quan vào cùng commit.
- Hoàn thành implementation và targeted checks trước khi tạo commit cuối cùng.
- Task nhỏ ưu tiên 1 commit; task vừa 1–2 commit; task lớn 2–4 commit, chia theo
  chức năng hoặc thay đổi độc lập. Đây là hướng dẫn, không phải giới hạn cứng.
- Commit message dùng tiếng Việt theo convention hiện tại.

### Kiểm tra và tạo commit

Sau khi final classification và mandatory checks đạt PASS:

1. chạy `git status --short`, `git diff --stat`, `git diff --check`;
2. stage chỉ file thuộc task;
3. không stage env, private data, dependency/build output, dump, log, artifact hoặc
   thay đổi có sẵn của user ngoài task;
4. chạy `git diff --cached --stat` và `git diff --cached --check`;
5. tự commit bằng tiếng Việt: `<type>(<scope>): <mô tả tiếng Việt>`;
6. ghi hash và message trong final response.

Không commit khi verdict FAIL, mandatory check chưa chạy, staged diff có secret,
diff trộn ngoài task hoặc phạm vi chưa rõ. Không reset hard hoặc force commit code lỗi.

### Squash và bàn giao audit

- Sau khi task hoàn thành và đạt mandatory checks, ưu tiên lịch sử gọn trước khi
  bàn giao user chạy Codex audit local. Nếu chưa commit, tạo trực tiếp 1–3 commit
  sạch thay vì nhiều commit WIP/fix rồi squash; vẫn ưu tiên 1 commit cho task nhỏ.
- Không bắt buộc squash khi các commit đã có ranh giới chức năng rõ ràng. Việc gom
  WIP/fix phải tuân thủ quyền rewrite bên dưới, không tự động thực hiện.
- Tuyệt đối không rewrite lịch sử `main` hoặc commit đã merge.
- Không tự amend/rebase/squash trên branch đã chia sẻ hoặc đã push khi chưa được
  user cho phép. Với feature branch riêng chưa chia sẻ, chỉ rewrite commit thuộc
  task khi user cho phép rõ ràng và đã xác minh không có thay đổi của người khác.
- Không làm mất thay đổi hoặc commit của user. Không force-push mặc định; nếu
  squash cần force-push để cập nhật remote, báo rõ và xin phép riêng.
- Không tự push, merge hoặc deploy khi chưa được yêu cầu.

## 11. Final response/PR

Level 1 không tạo report file cho nội dung này. Level 2/3 chỉ tạo change report theo
mục 6.

```md
## Task classification

Initial level:
Final level:
Reason:

## Changes

- ...

## Verification

- command: result
- Not run: ... — reason

## Documentation

- Updated:
- Not required because:

## Artifacts

- Temporary artifacts:
- Committed baselines/wireframes:

## Remaining risks

- ...

## Result

PASS or FAIL
Commit: <hash> — <message>
```
