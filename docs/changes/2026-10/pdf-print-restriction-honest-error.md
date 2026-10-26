# PDF Viewer — print-restricted requirement and truthful error classification

## Task classification
Level 3: the Worker terminal error code expands, with corresponding API validation,
client-facing error reason, product specification and worker documentation.

## Reported operator evidence (26 October 2026)
- Latest original staged SHA: `f93c25d84d83cdc1cb5cfd70649f2ff582735ea0`.
- Both Cloud Run images built, pushed and deployed with `--no-traffic`. No
  production traffic changes; the feature flag remains disabled.
- Local Chromium, Sharp and pdf-lib launch succeeded within Docker's 1 CPU /
  2 GiB limits (`PDF_BROWSER_OK`).
- Anonymous Drive link `1_ArvHdCmU5958R5Le27wjNsRiI5ynzIr` returned
  `PDF_RENDER_ERROR: ACCESS_DENIED`. The owner is reported to have disabled
  printing. This does **not** prove renderer print success on a permitted file.

## Correct product distinction
The owner clarified that the desired product outcome is a NEW image-only PDF
from a viewable link **even when the owner has disabled Print**. That desired
outcome was incorrectly represented as solved by a Print-enabled-only
implementation. It is a material unfulfilled requirement. Rendering visible
content to circumvent a file owner's disabled print/copy capability is not a
supported flow; the application must request an authorized source or export
permission instead. Do not silently relabel the user's original request as
"Print enabled" and mark it done.

## Narrow code correction
- A missing/not-yet-visible Print control is **not definitive proof of access
  denial**; report terminal `PRINT_UNAVAILABLE`, which can mean restriction,
  incomplete page, or a changed Viewer UI.
- A **present but disabled** Print control continues to be denied, with no
  capture attempts.
- Unexpected browser crashes remain transient errors rather than being
  relabeled a permanent policy denial.
- Align API result-schema allowlist and Vietnamese UI copy with that distinction.
  Add policy and API-contract unit tests.

The normal direct-download fast path, HMAC, OIDC, Cloud Tasks queue, GCS object
layout, 10 MiB/40-page limits, no-traffic revision handling, and disabled flags
remain unchanged. No new scraping, hidden endpoints, cookies, unauthorized
content extraction, IAM or service configuration are introduced.

## Verification and release gates
- Run Worker `npm --prefix workers/pdf test`, API unit and full CI checks.
- CI tests **do not** constitute a real Google Drive print-permitted E2E or
  Cloud Run revision promotion.
- No GCP/VPS actions in this change. Before promotion, complete authorized
  end-to-end print fidelity, Worker security/egress review, Cloud Tasks
  180-second policy, and owner approval. The print-restricted user scenario is
  **not complete** and must not be advertised as supported.

## Rollback
Keep production traffic pinned to previously selected revisions. Revert this
PR if the expanded failure code interferes with result reconciliation; do not
modify existing immutable completed/failed GCS results.
