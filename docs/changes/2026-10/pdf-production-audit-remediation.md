# PDF production audit follow-up — October 2026

## Task level

Level 3: security-sensitive Cloud Run deployment readiness, cross-service PDF result contract and regression coverage.

## Problem / root cause

Final Codex audit of merged PR #8 found two production-only P2 defects and one P3 coverage gap:

1. The preflight read image/CPU/RAM/processing flags from the service's **desired** template, not the revision actually receiving traffic. A failed rollout could leave a health-only revision serving 100% while `resourcesVerified` incorrectly reported true.
2. Worker constructed immutable claim `createdAt` using `new Date()` and `expiresAt` from a later `Date.now()`, while the API validator requires an exact 86,400,000 ms difference. A 1 ms advance made valid Worker results permanently unreconcilable under that UUID.
3. Gateway's alleged oversized PDF regression only exercised a small successful response.

## Decision / changes

- Worker captures one millisecond timestamp and derives both UTC claim timestamps from it.
- Read-only preflight obtains the actual revision via a **strictly validated** revision name learned from Cloud Run's service status; independently describes it using a second fixed read-only gcloud command. It checks service/revision `Ready=True`, matching latest-created/ready revision, 100% traffic, generation, digest, runtime identity, volume, environment, resource limits and desired/live template consistency. Missing or non-matching evidence fails closed.
- Add synthetic rollout failure, digest drift and revision describe failure tests; add Worker clock-advance and Worker-to-API validator tests.
- Gateway tests now cover >10 MiB, truncated upstream, stalled/timeout stream, concurrent download rejection, and slot reuse. A busy download does not consume an unrelated rate-admission token.

## Verification

The new branch CI is the code verification source; offline synthetic fixtures cannot establish actual live Cloud Run readiness or a working Google Drive conversion. The preflight remains read-only and returns `activationAllowed=false` in all cases.

## Rollback

Revert the dedicated fix PR. No DB migration, secret, GCP IAM grant, Cloud Run update, VPS change or PDF activation is performed by this PR. Legacy immutable claims produced with inconsistent timestamps cannot be repaired in place; expiry/manual retry of a new UUID remains necessary after production activation.

## Remaining risks

- Read-only gcloud requires permission to describe the active **revision**, not only the service. Failed/missing revision read must be treated as blocking, not ignored.
- Live effective/inherited IAM, GCS nonce prefix write scoping and lifecycle, actual processing image, recovery scheduler, PDF cloud E2E, cross-device download and costs remain unverified. Production is still disabled pending approval.
