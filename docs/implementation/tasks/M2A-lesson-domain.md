# M2A — Lesson domain, migrations and contracts

## Goal

Establish historically correct lesson participants, effective-dated tuition
policies, attendance integrity and shared lesson contracts.

## Scope

- Add forward-only schema and verified backfills for participant snapshots and
  class/enrollment tuition-policy history.
- Resolve participant eligibility and tuition policy by `session_date`.
- Define lesson, participant, attendance, completion and domain-error contracts
  in `@teacher/shared`.
- Preserve existing lesson, attendance and tuition-cycle data.
- Add unit and native-MySQL integration coverage for the domain invariants.

## Out of scope

Lesson HTTP workflow, mobile wizard, chronological mutable-cycle rebuilding,
payment UI and paid-cycle unlock.

## Required verification

`npm run check:fast` and `npm run test:integration`.
