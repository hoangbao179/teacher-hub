# UIC — Code and correctness cleanup

## Goal

Remove confirmed obsolete paths and correct known metadata inconsistencies while
preserving all approved M1–M6 business behavior.

## Scope

- Return the persisted lesson completion timestamp for both first completion and
  idempotent replay, with matching contract/OpenAPI coverage.
- Remove confirmed unused lesson placeholders and incremental tuition paths.
- Review large lesson, tuition, schedule and wizard files; refactor only where a
  safer boundary clearly justifies the change.
- Audit client request handling and enabled UI actions for stale responses,
  placeholders and misleading behavior.
- Extend deterministic repository consistency checks and regression tests.

## Exclusions

- Tuition allocation changes, schema changes without a confirmed bug, broad file
  splitting, new query frameworks and new product functionality.

## Required verification

```bash
npm run check:fast
npm run test:integration
npm run test:e2e
npm run build
```

The checkpoint may proceed to UID only after its verification report ends in
`PASS`.
