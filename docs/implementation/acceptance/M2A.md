# M2A acceptance

- [x] Historical eligibility uses joined/ended dates, including the end date.
- [x] Regular and selected MAKEUP participant snapshots are immutable once completed.
- [x] Duplicate participants and attendance outside the snapshot are rejected.
- [x] Class-default and enrollment policies are effective-dated and non-overlapping.
- [x] Historical `CLASS_DEFAULT` price resolves from class price history.
- [x] `CUSTOM` requires positive integer VND; `FREE` has no price.
- [x] Existing class/enrollment/lesson/attendance data is backfilled without loss.
- [x] Cycle items reference one attendance, sequences are 1..8 and target is 8.
- [x] Shared contracts contain all M2 lesson DTOs/enums/errors.
- [x] Unit and native-MySQL integration tests pass.
- [x] Documentation/data model/ADR are consistent.
- [x] Implementation and verification reports exist; final verdict is `PASS`.
