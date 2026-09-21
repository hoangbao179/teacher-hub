# Teacher Admin Monthly Tuition Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the runtime eight-session tuition cycle with a minimal calendar-month payment board while simplifying attendance, preserving schedule behavior, retaining reliable Google Sheet sync, and removing Legacy Import runtime code.

**Architecture:** Add a new monthly payment aggregate and derive attendance summaries from completed canonical lessons plus participant snapshots. Preserve historical cycle/import tables without runtime reads or writes, keep the Google outbox boundary, and switch client/server/shared contracts together.

**Tech Stack:** Node.js 24, npm 12 workspaces, TypeScript, Express 5, MySQL 8, React 19, Vite 8, MUI 9, Node test runner.

**Spec:** `docs/superpowers/specs/2026-09-21-simplify-teacher-admin-monthly-tuition-design.md`

## Global Constraints

- Branch: `feat/simplify-teacher-admin-monthly-tuition`, forked from `main`.
- Do not modify existing migrations; add a new numbered migration only.
- Do not drop or rewrite historical cycle, receipt, import, or attendance data.
- Runtime attendance writes accept only `PRESENT` and `ABSENT`; historical `FREE` remains readable as present.
- Monthly summaries use completed canonical lessons and actual participant snapshots; never infer sessions from recurring schedules.
- `PAID` is immutable and idempotent replay is allowed.
- Google API calls remain outside database transactions; retain outbox retry/idempotency.
- Do not change combined classes, external schedules, busy slots, reschedule, cancellation, homepage, auth, `/hoc`, books, vocabulary, assignments, or learning features.
- Do not delete `docs/wireframes/**`.
- Level 3 requires a consolidated change report, rollback notes, targeted integration, and `npm run check:full`.

## Review Focus

- An enrollment joining or ending mid-month counts only lesson participant snapshots for that enrollment; covered by Task 1 integration cases.
- Historical `FREE` attendance appears as present without becoming a runtime-write option; covered by Tasks 1 and 2.
- Combined child lessons, makeup subsets, rescheduled dates, cancelled and skipped occurrences do not corrupt monthly totals; covered by Tasks 1 and 7.
- Replaying mark-paid cannot duplicate payment/audit state, and a different mutation cannot alter PAID; covered by Task 1.
- Editing the same lesson updates one Sheet row after retry rather than appending; covered by Task 4.

---

### Task 1: Monthly tuition domain, migration, repository, and service

**Files:**
- Create: `server/src/db/migrations/0027_monthly_tuition_payments.sql`
- Create: `server/src/domain/monthly-tuition.ts`
- Create: `server/src/domain/monthly-tuition.test.ts`
- Create: `server/src/services/monthly-tuition.integration.test.ts`
- Modify: `shared/src/contracts/tuition.ts`
- Replace: `server/src/repositories/tuition.repository.ts`
- Replace: `server/src/services/tuition.service.ts`

**Interfaces:**
- Produces: `MonthlyTuitionQuery`, `MonthlyTuitionBoard`, `MonthlyTuitionRow`, `MarkMonthlyTuitionPaidRequest`, `MarkMonthlyTuitionPaidResult` from `@teacher/shared`.
- Produces: `TuitionRepository.monthlyBoard(year, month)` and `markMonthlyPaid(connection, enrollmentId, year, month, input)`.
- Produces: `TuitionService.monthlyBoard(query)` and `markMonthlyPaid(enrollmentId, year, month, input, actorUserId)`.

- [ ] **Step 1: Write failing domain tests**

```ts
test("validates a calendar month", () => {
  assert.deepEqual(validateTuitionMonth(2026, 9), { year: 2026, month: 9 });
  assert.throws(() => validateTuitionMonth(2026, 13), /tháng/i);
});

test("maps historical FREE attendance to present summary", () => {
  assert.deepEqual(summarizeMonthlyAttendance(["PRESENT", "ABSENT", "FREE"]), {
    present: 2, absent: 1, total: 3,
  });
});
```

- [ ] **Step 2: Run domain tests and verify RED**

Run: `npm -w server exec -- tsx --test src/domain/monthly-tuition.test.ts`
Expected: FAIL because `monthly-tuition.ts` does not exist.

- [ ] **Step 3: Implement domain validation and summary**

```ts
export function validateTuitionMonth(year: number, month: number) {
  if (!Number.isInteger(year) || year < 2000 || year > 2100) throw new AppError(400, "INVALID_TUITION_YEAR", "Năm học phí không hợp lệ.");
  if (!Number.isInteger(month) || month < 1 || month > 12) throw new AppError(400, "INVALID_TUITION_MONTH", "Tháng học phí không hợp lệ.");
  return { year, month };
}
```

- [ ] **Step 4: Run domain tests and verify GREEN**

Run: `npm -w server exec -- tsx --test src/domain/monthly-tuition.test.ts`
Expected: PASS.

- [ ] **Step 5: Write failing monthly integration tests**

Create fixtures that assert literal results for `6/8`, `7/9`, month boundary, draft/cancelled exclusion, historical FREE normalization, optional-class exclusion, PAID idempotency, and immutable PAID.

- [ ] **Step 6: Run integration tests and verify RED**

Run: `npm -w server run test:integration -- src/services/monthly-tuition.integration.test.ts`
Expected: FAIL because migration/table and monthly repository/service methods do not exist.

- [ ] **Step 7: Add migration and minimal monthly implementation**

```sql
CREATE TABLE monthly_tuition_payments (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  enrollment_id BIGINT UNSIGNED NOT NULL,
  tuition_year SMALLINT UNSIGNED NOT NULL,
  tuition_month TINYINT UNSIGNED NOT NULL,
  status ENUM('UNPAID','PAID') NOT NULL DEFAULT 'UNPAID',
  amount BIGINT UNSIGNED NULL,
  paid_at DATETIME NULL,
  note VARCHAR(1000) NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  CONSTRAINT fk_monthly_tuition_enrollment FOREIGN KEY (enrollment_id) REFERENCES class_enrollments(id),
  CONSTRAINT chk_monthly_tuition_month CHECK (tuition_month BETWEEN 1 AND 12),
  CONSTRAINT chk_monthly_tuition_paid CHECK (status='UNPAID' OR paid_at IS NOT NULL),
  UNIQUE KEY uq_monthly_tuition_enrollment_month (enrollment_id,tuition_year,tuition_month)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

Repository summary SQL must join `lesson_sessions`, `lesson_session_participants`, `class_enrollments`, `students`, `classes`, and left join attendance/payment. Count only completed lessons in the requested month. Preserve inactive enrollments when they participated in that month.

- [ ] **Step 8: Run monthly integration tests and verify GREEN**

Run: `npm -w server run test:integration -- src/services/monthly-tuition.integration.test.ts`
Expected: PASS.

- [ ] **Step 9: Commit Task 1**

```bash
git add shared/src/contracts/tuition.ts server/src/db/migrations/0027_monthly_tuition_payments.sql server/src/domain/monthly-tuition.ts server/src/domain/monthly-tuition.test.ts server/src/repositories/tuition.repository.ts server/src/services/tuition.service.ts server/src/services/monthly-tuition.integration.test.ts
git commit -m "feat(hoc-phi): chuyển sang theo dõi theo tháng"
```

### Task 2: Decouple lessons from tuition cycles and restrict attendance writes

**Files:**
- Modify: `shared/src/contracts/lessons.ts`
- Modify: `server/src/domain/lesson-domain.ts`
- Modify: `server/src/domain/lesson-domain.test.ts`
- Modify: `server/src/services/lesson.service.ts`
- Modify: `server/src/repositories/lesson.repository.ts`
- Modify: `server/src/domain/lesson-api.test.ts`
- Modify: `server/src/services/optional-class-tuition.integration.test.ts`
- Modify: `client/src/pages/LessonWizardPage.tsx`

**Interfaces:**
- Consumes: monthly tuition no longer receives recalculation calls from lesson completion.
- Produces: lesson complete/update returns attendance counts without cycle IDs/progress impact.

- [ ] **Step 1: Add failing tests for PRESENT defaults, ABSENT edit, nullable comments, and FREE rejection**

Tests must call real lesson domain/service methods and assert stored attendance/comment results, not source text.

- [ ] **Step 2: Run focused tests and verify RED**

Run: `npm -w server exec -- tsx --test src/domain/lesson-domain.test.ts src/domain/lesson-api.test.ts`
Expected: FAIL because FREE is still accepted and cycle-shaped result fields still exist.

- [ ] **Step 3: Remove runtime cycle orchestration and narrow attendance contracts**

Change `AttendanceStatus` to `PRESENT | ABSENT`. Remove tuition impact, newly-due and free-count response fields. Persist `counts_for_tuition = status === 'PRESENT' && tuitionMode !== 'FREE'` only as legacy compatibility; do not allocate cycle sessions.

- [ ] **Step 4: Simplify lesson UI**

Remove FREE toggle, `x/8` chip and cycle result copy. Keep one-screen Simple Mode as Dashboard default and optional per-student notes/content/homework. Keep technical full flow only for manual/makeup/edit metadata.

- [ ] **Step 5: Run lesson tests and targeted client checks**

Run: `npm -w server exec -- tsx --test src/domain/lesson-domain.test.ts src/domain/lesson-api.test.ts`
Expected: PASS.

Run: `npm -w client run typecheck`
Expected: PASS.

- [ ] **Step 6: Commit Task 2**

```bash
git add shared/src/contracts/lessons.ts server/src/domain/lesson-domain.ts server/src/domain/lesson-domain.test.ts server/src/domain/lesson-api.test.ts server/src/services/lesson.service.ts server/src/repositories/lesson.repository.ts server/src/services/optional-class-tuition.integration.test.ts client/src/pages/LessonWizardPage.tsx
git commit -m "refactor(diem-danh): tách trạng thái miễn phí khỏi điểm danh"
```

### Task 3: Monthly tuition HTTP API and responsive board UI

**Files:**
- Modify: `server/src/controllers/tuition.controller.ts`
- Modify: `server/src/routes/index.ts`
- Modify: `client/src/api/tuition.ts`
- Replace: `client/src/pages/TuitionBoardPage.tsx`
- Delete: `client/src/pages/TuitionPage.tsx`
- Delete: `client/src/pages/TuitionDetailPage.tsx`
- Delete: `client/src/pages/MarkTuitionPaidPage.tsx`
- Modify: `client/src/App.tsx`
- Modify: `client/src/pages/StudentDetailPage.tsx`
- Replace: `client/src/features/tuition-board.ts`
- Modify: `client/scripts/tuition-board.unit.mjs`
- Modify: `client/scripts/tuition-management.e2e.mjs`

**Interfaces:**
- Consumes: Task 1 monthly service/contracts.
- Produces: `GET /api/tuition/monthly` and `PUT /api/tuition/monthly/:enrollmentId/:year/:month/paid`.

- [ ] **Step 1: Update unit/E2E assertions first**

Assert current-month default, previous/next month navigation, `6/8`, absent count, mobile card layout, optional amount, and PAID action. Remove cycle-history/advance-payment expectations.

- [ ] **Step 2: Run tuition board unit test and verify RED**

Run: `npm -w client run test:tuition-board`
Expected: FAIL because monthly UI model/API is missing.

- [ ] **Step 3: Implement controller/routes/client API/UI**

Controller validates integer route/query values and forwards actor ID. Board uses mobile cards and desktop compact rows without page-level horizontal scrolling. Default year/month comes from Ho Chi Minh date utilities.

- [ ] **Step 4: Remove cycle/receipt UI entry points**

Remove history/detail/mark-paid routes and Student Detail advance-payment action. Keep enrollment tuition mode only to represent tracked/custom/free eligibility until a later schema cleanup.

- [ ] **Step 5: Run client unit, typecheck and lint**

Run: `npm -w client run test:tuition-board`
Expected: PASS.

Run: `npm -w client run typecheck`
Expected: PASS.

Run: `npm -w client run lint`
Expected: PASS.

- [ ] **Step 6: Commit Task 3**

```bash
git add server/src/controllers/tuition.controller.ts server/src/routes/index.ts client/src/api/tuition.ts client/src/pages client/src/App.tsx client/src/features/tuition-board.ts client/scripts/tuition-board.unit.mjs client/scripts/tuition-management.e2e.mjs
git commit -m "feat(admin): thay bảng học phí theo tháng"
```

### Task 4: Improve Google Sheet projection without replacing the outbox

**Files:**
- Modify: `server/src/integrations/google/google-sheet-template.service.ts`
- Modify: `server/src/integrations/google/google-sheet-template.test.ts`
- Modify: `server/src/integrations/google/google-sheets.client.ts`
- Modify: `server/src/integrations/google/google-integration.types.ts`
- Modify: `server/src/services/student-google-sheet.service.ts`
- Modify: `server/src/services/student-google-sheet.integration.test.ts`
- Modify: `server/src/workers/google-sheet-sync.worker.test.ts`
- Modify: `shared/src/contracts/google-sheets.ts`
- Modify: `client/src/pages/StudentDetailPage.tsx`

**Interfaces:**
- Keeps: existing outbox logical event/revision and worker retry contract.
- Produces: readable status mapping and styled learning-log template with hidden technical metadata.

- [ ] **Step 1: Add failing template and retry/upsert tests**

Assert exact visible headers, date number format, wrap, frozen row, PRESENT/ABSENT conditional formatting, hidden technical column/sheet, and same-lesson update behavior.

- [ ] **Step 2: Run Google tests and verify RED**

Run: `npm -w server exec -- tsx --test src/integrations/google/google-sheet-template.test.ts src/workers/google-sheet-sync.worker.test.ts`
Expected: FAIL on the old raw-export template/status mapping.

- [ ] **Step 3: Implement new projection and simple UI statuses**

Keep provider and outbox APIs stable where possible. Map sync summary to `SYNCED | PENDING | FAILED`; retain technical fields server-side. Do not call Google inside lesson transactions.

- [ ] **Step 4: Run focused Google tests**

Run: `npm -w server exec -- tsx --test src/integrations/google/google-sheet-template.test.ts src/workers/google-sheet-sync.worker.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit Task 4**

```bash
git add shared/src/contracts/google-sheets.ts server/src/integrations/google server/src/services/student-google-sheet.service.ts server/src/services/student-google-sheet.integration.test.ts server/src/workers/google-sheet-sync.worker.test.ts client/src/pages/StudentDetailPage.tsx
git commit -m "refactor(google-sheet): trình bày sổ theo dõi dễ đọc"
```

### Task 5: Remove Legacy Import runtime code and tests

**Files:**
- Delete: `shared/src/contracts/legacy-import.ts`
- Modify: `shared/src/index.ts`
- Delete: `client/src/pages/LegacyImportPage.tsx`
- Delete: `client/src/features/legacy-import-review.ts`
- Delete: `client/scripts/legacy-import-review.unit.mjs`
- Delete: `client/scripts/legacy-import.e2e.mjs`
- Modify: `client/package.json`
- Modify: `client/src/App.tsx`
- Modify: `client/src/pages/StudentDetailPage.tsx`
- Delete: `server/src/controllers/legacy-import.controller.ts`
- Delete: `server/src/services/legacy-import.service.ts`
- Delete: `server/src/services/legacy-import.integration.test.ts`
- Delete: `server/src/repositories/legacy-import.repository.ts`
- Delete: `server/src/middleware/legacy-import-upload.ts`
- Delete: `server/src/domain/legacy-*`
- Modify: `server/src/container.ts`
- Modify: `server/src/routes/index.ts`
- Modify: `server/package.json` only if `multer` or another dependency has no other consumer.

**Interfaces:**
- Produces: no Legacy Import route, navigation, shared export, container binding, or test command.

- [ ] **Step 1: Add a failing runtime route test**

Add/extend a real router test that authenticates and verifies both legacy preview/apply URLs return 404 while valid student routes remain registered.

- [ ] **Step 2: Run route test and verify RED**

Run: `npm -w server exec -- tsx --test src/routes/index.test.ts`
Expected: FAIL because legacy routes still exist.

- [ ] **Step 3: Remove runtime code and references**

Delete only import-specific files. Confirm `exceljs` stays because student report export uses it and `multer` stays if vocabulary upload uses it.

- [ ] **Step 4: Run route test and workspace reference scan**

Run: `npm -w server exec -- tsx --test src/routes/index.test.ts`
Expected: PASS.

Run: `rg -n "LegacyImport|legacy-import|legacyImports|legacy-imports" client/src server/src shared/src client/package.json server/package.json`
Expected: no runtime matches; historical migrations are outside this scan.

- [ ] **Step 5: Run workspace typechecks**

Run: `npm run build:shared && npm -w server run typecheck && npm -w client run typecheck`
Expected: PASS.

- [ ] **Step 6: Commit Task 5**

```bash
git add shared client server
git commit -m "refactor(import): loại bỏ Legacy Import khỏi runtime"
```

### Task 6: Update source-of-truth documentation and Level 3 change report

**Files:**
- Modify: `AGENTS.md`
- Modify: `README.md`
- Modify: `docs/implementation/status.md`
- Modify: `docs/product-spec/03-business-rules.md`
- Modify: `docs/product-spec/05-state-machines.md`
- Modify: `docs/product-spec/07-domain-model-data-dictionary.md`
- Modify: `docs/product-spec/08-logical-api-contract.md`
- Modify: `docs/product-spec/09-acceptance-tests.md`
- Replace: `docs/features/tuition-cycles.md` with monthly tuition current-state documentation or rename it to `docs/features/monthly-tuition.md` and update links.
- Modify: `docs/features/lesson-recording.md`
- Modify: `docs/features/student-parent-tracking.md`
- Modify: `docs/api/openapi.yaml`
- Modify: `docs/user-guide/teacher-guide.md`
- Delete: current Legacy Import documentation that claims runtime availability; preserve historical change reports.
- Create: `docs/changes/2026-09/TEACHER-ADMIN-MONTHLY-TUITION.md`

**Interfaces:**
- Consumes: final implemented behavior from Tasks 1–5.
- Produces: one current source of truth and one consolidated Level 3 report with rollback/risks.

- [ ] **Step 1: Update current-state docs and OpenAPI**

Document monthly summary semantics, PAID immutability, optional amount, historical-cycle retention, attendance FREE cutover, Google outbox retention, Legacy Import removal and wireframe retention.

- [ ] **Step 2: Add consolidated report**

Use sections: Task level, Problem, Root cause, Decision, Changes, Verification, Documentation updated, Rollback, Remaining risks. Do not create implementation/verification report pairs.

- [ ] **Step 3: Run documentation/repository guards**

Run: `npm run check:docs`
Expected: PASS.

Run: `npm run check:repo`
Expected: PASS.

- [ ] **Step 4: Commit Task 6**

```bash
git add AGENTS.md README.md docs shared/src server/src client/src client/package.json server/package.json
git commit -m "docs(admin): cập nhật nghiệp vụ học phí theo tháng"
```

### Task 7: Schedule regression, cleanup verification, and full Level 3 gate

**Files:**
- Modify only failing tests/source directly tied to the approved scope.
- Do not create or commit screenshots, traces, logs, or Playwright reports.

**Interfaces:**
- Consumes: all previous tasks.
- Produces: verified branch ready for review.

- [ ] **Step 1: Run targeted server unit tests**

Run: `npm -w server run test`
Expected: PASS.

- [ ] **Step 2: Run targeted integration tests**

Run: `npm -w server run test:integration -- src/services/monthly-tuition.integration.test.ts src/services/combined-class-group.integration.test.ts src/services/student-google-sheet.integration.test.ts`
Expected: PASS.

- [ ] **Step 3: Run schedule E2E without retaining PASS artifacts**

Run: `$env:SCREENSHOT_MODE='failure'; npm -w client run test:e2e:schedule`
Expected: PASS; combined/external/busy/reschedule/cancellation remain functional.

- [ ] **Step 4: Run full Level 3 verification**

Run: `$env:SCREENSHOT_MODE='failure'; npm run check:full`
Expected: PASS.

- [ ] **Step 5: Inspect final diff and repository state**

Run: `git status --short`
Expected: only intended task files.

Run: `git diff --stat main...HEAD`
Expected: no homepage/auth/learning implementation changes and no wireframe deletion.

Run: `git diff --check main...HEAD`
Expected: PASS.

- [ ] **Step 6: Commit verification-driven fixes when present**

For each failure, add a regression test first, watch it fail, apply the minimal fix,
rerun the owning task command, then stage the exact test/source pair named by
`git status --short` and commit with `test(admin): hoàn tất regression học phí theo tháng`.
If verification changes no file, do not create an empty commit.
