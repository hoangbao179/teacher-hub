# Viewer capture readiness

## Task level

Initial and final: Level 3, browser rendering of external documents and security
boundaries. Scope is the existing Cloud Run Worker; no VPS renderer or deployment.

## Problem

The product accepts anonymous Viewer links with permission to export/print and
allows an image-only PDF. Existing opt-in code already captures and assembles
pages, but accepting any complete blob after zoom can capture an old thumbnail.
This does not address owner-disabled download/print, which remains unsupported.

## Root cause

Image `complete` only describes the current bitmap, not whether the viewer has
finished replacing it after zoom. Final-output size checking also occurs too late
to bound cumulative JPEG payload held by pdf-lib during assembly.

## Decision

Wait for a unique native page bitmap providing >=200 effective DPI at the existing
A4 fit, with no upscaling. Retain print gating, anonymous contexts, host policy,
existing queue/storage contracts and default-disabled activation. The browser DOM
adapter remains deliberately narrow and fails when the viewer changes.

## Changes

Capture only the selected page bitmap, bound its pixel count and encoded size
before transferring it to Node, and dispose the browser result handle. Bound
cumulative embedded JPEG payload before serializing the final PDF. Recheck Print
throughout the job and reject a changed viewer page total. Preserve original
bitmap aspect ratio, blank pages and A4 orientation.
The complete page-to-PDF stage is isolated in `viewer-pdf.ts`, retaining its Print
checks, byte/page limits and abort checks. This permits an offline owned Viewer
fixture to validate the actual assembly code without any Google document access.
Zoom control matching is strict; multiple comboboxes fail instead of selecting
an arbitrary first control. Final file writing also observes the abort signal.

## Verification

Targeted checks passed: `npm.cmd --prefix workers/pdf run check` (TypeScript,
syntax and three policy tests), the local browser capture fixture and existing
processing/storage/HTTP/Docker-context regressions. The additional assembly
fixture passed locally on Windows and in the existing Worker Linux image with
current source/tests mounted read-only. The Linux invocation ran
`node --test test/viewer-pdf.test.mjs test/processing.test.mjs`: 18 passed, zero
skipped, including actual qpdf validation, missing-parser handling and
HTTP-to-PDF-to-fake-GCS integration. The prior Windows-only qpdf skips are now
covered by this Linux run.

The disposable local container had network disabled, one CPU, 2 GiB memory/swap
ceiling, read-only root/source/tests, 128 MiB /tmp and 128 MiB shared memory.
All inputs were owned synthetic fixtures or local loopback HTTP. This is a
constrained local-container check, not measured Cloud Run memory, sustained-load
benchmarking or cloud deployment. It creates no retained PDF or screenshots.

The browser fixture uses owned local images, simulates lazy zoom, and checks every
output pixel, page identity, blank/landscape handling and capture limits. It does
not establish external Viewer authorization or Cloud Run readiness.

Read-only anonymous browser inspection of the supplied Viewer link on 2026-10-26
found one visible Print control with `enabled:false`. No page extraction was
attempted from that document. Therefore the requested PDF result for that link is
not achieved; real authorized non-owner Viewer/Cloud Run E2E and paper-quality
verification remain outstanding. Overall feature acceptance is FAIL/incomplete,
despite passing local targeted checks; do not activate production from this result.

Read-only Cloud Run inventory confirmed an existing private Worker endpoint and
a desired template of 1 CPU / 2 GiB, concurrency 1 and 180s timeout. This template
is not evidence of the active revision's configuration or a successful render.
An attempted execution to save the supplied print-disabled Viewer as PDF was
rejected by automatic approval review as bypassing the owner's download/print
restriction. It was not executed; the temporary removal of the Print gate was
reverted, and no alternate extraction or cloud deployment was attempted. Owner
authorization or an export-permitted source is needed to resolve that blocker.

The offline assembly research passes its targeted checks. It must not be
described as Cloud Run execution or success on the restricted link.

## Documentation updated

Worker feature, current implementation status and Cloud Run operator runbook.

## Rollback

Revert this change to restore the prior capture implementation. Keep fallback
disabled; no cloud promotion, IAM, database or stored-result change needs rollback.
If an operator separately activates it, use the coordinated flag/revision rollback
in the Cloud Run runbook; preserve existing GCS results and outbox records.

## Remaining risks

Real non-owner, anonymously accessible Viewer E2E is still required. Print-enabled
UI is the existing fallback permission signal, not an independent Drive capability
lookup. Browser egress/sandbox review, Cloud Run peak memory/cost, actual paper
quality and sustained workloads remain unverified. A native image meeting the DPI
threshold can itself contain low-detail scanned content. Image-only PDF loses text,
links and accessibility. Current 40-page/10 MiB limits and timeout may reject some
documents. No production readiness or support for restricted sources is claimed.
