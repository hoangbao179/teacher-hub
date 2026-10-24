# Public PDF Tool — shared history and audit fixes

## Task level
Initial and final: Level 3. Public authorization, persisted outbox behavior and
trusted proxy configuration. PR adds migration 0028; the audit fixes require no
new migration and do not edit applied migrations.

## Problem
Everyone must be able to submit authorized documents without login and view,
download or retry public documents on another device. Teacher PDFs remain private.
The independent audit found proxy-wide IP quotas, a non-atomic public link, public
rows in admin history, binary 401 clearing admin auth, and contradictory docs.

## Root cause
Nginx appended Caddy to XFF while Express trusted one hop. The controller attached
public visibility after batch/job commit and enqueue. Guests share the teacher
producer owner, but admin list/count filtered only by owner. The new binary helper
omitted the public 401 exception. Earlier docs still described browser-private history.

## Decision
Use `/api/public/pdf/*` with shared public history. The opaque HttpOnly,
SameSite=Strict submission cookie scopes idempotency only; list/detail/retry/ticket/
download do not need it. Every public mutation checks exact Origin. Public
visibility is committed with batch/jobs; private admin list and count exclude the
public join table. Public endpoints reject private UUIDs. Preserve owner-wide
capacity limits and IP quotas, with Caddy overwriting untrusted XFF and Nginx
preserving the resulting client IP. Express continues to trust exactly one hop;
API/Web remain unpublished. Production factory remains disabled.

## Changes
- Public batch, jobs and session linkage use one transaction. Replay validates
  body and visibility before returning the original batch; dispatch is after commit.
- Streaming receives the checked owner explicitly instead of fabricating `req.auth`.
- Public binary 401 preserves both remembered/session-only admin tokens and does
  not call the global unauthorized handler; private 401 still expires the session.
- Automatic detail polling only reads unknown/recoverable unexpired batches,
  including late-result states. Initial/manual reads have concurrency four;
  terminal details refresh on demand, with pending manual refresh retained.
- Existing pastel UI, five-link form and background recovery are preserved.
  Names remain explicitly labeled Drive-ID fallbacks. A reviewed metadata/result
  contract change is a separate follow-up in the feature doc.
- No Drive archive, new VPS PDF dependency, cloud activation or resource change.

## Verification
Regression covers two proxy hops with distinct client sockets and spoofed XFF;
MySQL link-insert failure rollback/no enqueue, idempotent replay and restart
recovery; private/public list/count isolation and public access after cookie expiry.
The smoke suite includes two browser contexts with a newly created synthetic
MySQL database/FakeCloud, closed submitter, ticket replay, FAILED/EXPIRED retry,
private UUID rejection, 360/390/430/1440 layout, public/private binary 401 and
selective/manual polling. No real user PDF or cloud identity is used.

Local gate results and the four required CI jobs on the final HEAD are reported
in PR #7. CI smoke uses fixtures, not Google Cloud. Real cloud E2E remains an
activation gate regardless of local/CI success.

Local verification for the audit fixes:

| Check | Result |
| --- | --- |
| Root typecheck / application typechecks, client lint | PASS |
| Server unit command | PASS: 211; 89 MySQL cases skipped in this unit invocation and run separately below |
| Client unit command | PASS: 110 |
| Targeted PDF MySQL integration | PASS: 4 |
| Full server MySQL integration and migration recovery | PASS: 89, no skips |
| Tools browser, public PDF browser, Homepage and auth-session E2E | PASS |
| Production client build/prerender and server build | PASS: 177 public pages prerendered |
| Repository/OpenAPI consistency and documentation links | PASS |
| Real cloud E2E, deployed ingress smoke, VPS benchmark | NOT RUN; operator activation gates |

## Documentation updated
Feature doc and current status describe shared public history. OpenAPI clarifies
cookie-free public operations and atomic submission. Production/API operations
document the proxy trust boundary, test database lifecycle and coordinated rollback.

## Rollback
Keep processing disabled. Restore matching API/Web/Caddy revisions together.
Preserve migrations 0027/0028, guest links, job history and private result storage.
No schema rollback or data backfill is required by the fixes. Re-enabling older
non-atomic public submission requires a new review, not blind activation.

## Remaining risks
REAL PDF PROCESSING NOT READY: production identity/wiring, approved queue/OIDC,
Worker processing/GCS permissions, independent scheduler/recovery and private
cloud E2E remain unverified. Proxy behavior needs a smoke on the actual deployed
ingress. No VPS benchmark was performed; do not infer an upgrade need or capacity
from local tests. Counters are per-process; durable owner caps remain authoritative
across guests. Sessions/history need an approved retention/cleanup policy that
preserves public linkage; tickets are bounded and expired ticket records are
cleaned on issuance. Downloads expire after 24 hours; durable storage and real
original filenames remain separate follow-ups. Public terminal batches can gain
retries from another device; use manual refresh/reload to refresh cached details.
