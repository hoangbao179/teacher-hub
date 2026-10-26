# PDF Cloud Run immutable staging audit and local image-PDF smoke

**Classification:** Level 3 (release/operations audit code, but no cloud
deployment or IAM mutation).

**Reason:** A Worker and public-HMAC Gateway were built and staged from
`f93c25d84d83cdc1cb5cfd70649f2ff582735ea0`. Prior `--stage`
reported no traffic change but did not independently reconcile actual Ready
revision manifests against Artifact Registry's immutable digests or produce a
local image-only PDF using exactly the staged container.

**Changes:**
- Read-only `scripts/pdf-release-audit.mjs --check` verifies both staged
  revisions and their security/resource/feature-gate invariants.
- `scripts/pdf-local-runtime-audit.mjs --smoke` runs a bounded, offline,
  two-page JPEG/PDF/qpdf/Chromium test using the existing local Worker image.
- Deterministic negative/fail-closed audit tests wired into CI. No GCP
  credentials, HMAC plaintext or job payloads appear in code/tests.

**Evidence not yet available:** Current code was tested against fake
GCP revision snapshots and needs a real authorized workstation audit.
The browser smoke must be executed by the operator on local Docker.
No true Google Drive Viewer print-enabled E2E, disabled-Print export, or
Cloud Run/VPS activation is claimed.

**Rollback:** Remove the audit command and CI additions if necessary;
services, IAM, GCS data, queue, VPS and traffic are unchanged.
