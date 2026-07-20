# M2B — Transactional lesson API

## Goal

Replace the pre-M2 scaffold with one canonical `/api/lessons` workflow backed
by the M2A participant and tuition-policy domain.

## Scope

- Create/read/update/cancel draft lessons.
- Explicit participant, attendance and content updates.
- Transactional, audited and concurrency-safe completion.
- Typed validation/conflict responses and complete OpenAPI documentation.
- Unit and native-MySQL integration coverage.

## Out of scope

Mobile UI, chronological rebuild after historical edits, payment UI and unlock.

## Required verification

`npm run check:fast` and `npm run test:integration`.
