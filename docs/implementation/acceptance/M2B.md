# M2B acceptance

- [x] Canonical lesson routes match shared contracts and OpenAPI.
- [x] REGULAR snapshots all historically eligible enrollments.
- [x] MAKEUP snapshots only selected eligible enrollments; EXTRA behavior is documented.
- [x] Draft information, participants, attendance and content persist independently.
- [x] Completion validates time, snapshot and exactly one attendance per participant.
- [x] Globally FREE policy cannot create billable attendance/cycles.
- [x] Completion is one transaction with required audit events and summary impact.
- [x] Duplicate/concurrent completion cannot duplicate attendance or cycle items.
- [x] Rollback leaves the lesson `DRAFT` on failure.
- [x] Unit and native-MySQL integration tests pass.
- [x] Implementation and verification reports exist; final verdict is `PASS`.
