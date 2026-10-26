# PDF staged release audit — evidence before activation

## Purpose and current release state

The operator successfully staged Worker and Gateway images from SHA
`f93c25d84d83cdc1cb5cfd70649f2ff582735ea0` with `--no-traffic`;
a local Chromium launch with 1 CPU and 2 GiB reported `PDF_BROWSER_OK`.
This is **not proof** that a Google Drive Viewer with disabled Print can be
reconstructed. The product requirement remains unmet for such documents.
The staged images have their Print/long-task feature gates OFF, and no
production traffic was changed. A separate explicit authorization and
real-cloud E2E would be required for promotion of supported documents.

## One-time operator audit — no production modifications

From Windows PowerShell (operator workstation with gcloud and Docker):

```powershell
cd D:\Code\teacher-hub
git switch main
git pull --ff-only
$env:PDF_STAGED_SHA = "f93c25d84d83cdc1cb5cfd70649f2ff582735ea0"
node scripts/pdf-release-audit.mjs --check
node scripts/pdf-local-runtime-audit.mjs --smoke
```

`PDF_STAGED_SHA` refers to the **already staged image** and does not have
to equal the latest source `main` SHA after follow-up documentation changes.
For any new image revision, set it to the exact newly built/staged full SHA.

The read-only audit checks both services independently, the existing
private Worker/public-HMAC Gateway IAM modes, immutable Artifact Registry
digests matched to Cloud Run's latest created Ready revision, correct
runtime service accounts, source-only feature flags, bounded 1 CPU / 2 GiB
Worker and Gateway limits, temporary volume, and that staged revisions
receive **zero production traffic**. It **does not** get secret values,
update IAM, publish new images, call Cloud Tasks, submit jobs, or activate PDF.
Missing evidence and configuration drift fail closed.

The local smoke runs the tagged Worker image **offline** (no network)
with 1 CPU, 2 GiB RAM, limited PIDs, read-only filesystem and bounded
temporary directory. It checks Chromium startup, Sharp/JPEG, pdf-lib
two-page portrait/landscape image-only PDF, and `qpdf --check`. It does
not read or copy any third-party document and **does not** establish
Google Drive Viewer quality or permissions.

Expected success markers: `"audit":"PASS"` and
`"status":"PDF_IMAGE_RUNTIME_OK"`. If the image is not available in local
Docker, the smoke fails without an implicit pull; use the already staged
image from the operator's successful build/push. These are **verification
only**, not deployment commands.

## Remaining activation blockers

- Authorized print/export-enabled Viewer E2E, including number and order
  of pages, image readability and a rendered PDF through actual Cloud Run
  Worker/OIDC/Cloud Tasks/GCS/website ticket path
- Chromium/browser sandbox and egress isolation review for untrusted files
- Explicit Cloud Run long-task / Worker fallback / VPS producer activation
  and rollback under owner review
- The originally requested owner's **Print-disabled** Viewer link is
  unsupported; do not attempt to bypass owner's copying/printing settings.

Never interpret an image build, health response or green local smoke as
permission to switch production traffic.
