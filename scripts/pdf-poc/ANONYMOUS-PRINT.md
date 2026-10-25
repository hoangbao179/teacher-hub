# Anonymous Drive Viewer → printable image PDF (experimental)

This is an executable **local proof of concept**, not the deployed Cloud Run
worker. The live Worker still supports direct PDF download only. The website
UI/API change is separate; it does not connect this renderer to the job queue.

## Usage (Node 24/npm 12, Chromium required)

```bash
npm ci --prefix scripts/pdf-poc
cd scripts/pdf-poc && npx playwright install chromium && cd ../..
node scripts/pdf-poc/anonymous-print.mjs \
  'https://drive.google.com/file/d/FILE_ID/view' \
  ./print-preview.pdf
```

The link must open in a **fresh anonymous browser** with Google Drive's
**Print** action enabled. No login/OAuth/cookies or Google Drive API credentials
are requested; no screenshot of a source with disabled Print is attempted.
Do not use this tool to bypass owner/administrator restrictions on exporting,
printing or copying.

The script captures one rendered blob image per page from ordinary viewer APIs
and embeds JPEG 93 4:4:4 images into an image-only A4 portrait/landscape PDF;
no searchable text or vector content. It refuses previews below 150 effective
DPI rather than silently reporting 300 DPI after upscaling. It restricts
navigation, request count, response size, 40 pages, 12M pixels per page,
captured PNG total 32 MiB, output 10 MiB, and closes a job after two minutes.
These are PoC-level soft controls, NOT a production resource/security boundary.
Existing printed-file page geometry is approximated to A4 with margins.
There is no support for authenticated-only Google Drive links.

The renderer depends on Drive's current DOM headings, viewer Print control,
zoom combobox and per-page blob images. These may change without notice, and
this code has **not** been tested against the user's linked document. See
`docs/product-spec/pdf-viewer-links.md` for feature acceptance requirements
and `docs/features/pdf-quality-poc.md` for earlier owned-fixture measurements.

Before integrating into Cloud Run, run an authorized end-to-end fixture with
real page order, print-readability and byte limits; review egress sandbox,
CPU/memory/concurrency, timeout, worker packaging, billing and rollback.
