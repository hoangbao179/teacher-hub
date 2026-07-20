# M6C Acceptance

- [x] All public/admin routes and primary P0 workflows have been reviewed at 390×844.
- [x] Layouts have no page-level overflow at 360, 390, tablet or desktop widths.
- [x] Design tokens cover spacing, type, radius, elevation, status, breakpoints,
  touch targets and navigation height.
- [x] Approved reusable components exist and replace avoidable local duplication.
- [x] Visible status/attendance/type labels use consistent Vietnamese, never raw enums.
- [x] Forms have associated labels, required/error feedback and usable date/time inputs.
- [x] Loading, success and error changes are announced; focus and keyboard use remain clear.
- [x] Confirmation dialogs fit mobile viewports, trap/restore focus and prevent duplicates.
- [x] Sticky actions remain usable without overlapping the mobile bottom navigation.
- [x] Unknown public routes show a public 404; unknown admin routes stay in the protected shell.
- [x] Active navigation, logout, deep-link reload and persisted lesson drafts work.
- [x] Validation, auth, not-found, conflict, network/server, empty and stale states use
  actionable sanitized Vietnamese messages.
- [x] Route-level lazy loading remains effective with no unexplained bundle-size warning.
- [x] Playwright covers the 13 required critical flows and asserts overflow, raw enums,
  real actions, dialogs and feedback where applicable.
- [x] Representative screenshots are stored in a documented non-source artifact path.
- [x] `npm run check:fast`, `npm run test:e2e` and `npm run build` pass.
