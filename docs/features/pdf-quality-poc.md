# PDF quality PoC — local experiment

This is a standalone research tool, not a Teacher Tools feature or a deployed worker.
It reuses the owned five-page synthetic PDF prepared by the earlier PoC. Input/output
PDFs, screenshots, private documents and measurements remain under `.artifacts/`.
No Drive downloader, network endpoint, authentication or production dependency is added.

## Reproduce

Requires Node 24/npm 12. Install the separate tool dependencies (not root workspaces):

```text
npm ci --prefix scripts/pdf-poc
npm --prefix scripts/pdf-poc test
npm --prefix scripts/pdf-poc run check
node --expose-gc scripts/pdf-poc/benchmark.mjs run .artifacts/print-quality-pdf/20261022/owned-synthetic-original.pdf .artifacts/print-quality-pdf/NEW-RUN
```

Supply an owned/authorized local PDF. The reference file is deliberately not in Git.
The output directory must be new; the tool refuses to overwrite existing artifacts.
Clean obsolete run directories manually only after checking their resolved paths.
Keep the original fixture and prior evidence needed for comparison. Delete temporary
page images/results when review is finished; this CLI is not a retention service.

On Windows, optional whole-tree measurement (CIM access required):

```text
powershell -NoProfile -ExecutionPolicy Bypass -File scripts/pdf-poc/measure-windows.ps1 -InputPdf .artifacts/print-quality-pdf/20261022/owned-synthetic-original.pdf -OutputDirectory .artifacts/print-quality-pdf/NEW-MEASURED-RUN
```

## Method and acceptance boundaries

- Rasterize the original PDF at 300 dpi with PDF.js; never upscale an existing image
  and call that extra detail. Embedded raster pictures retain their original detail.
- Preserve each page's original point dimensions, orientation and index. The fixture
  has Vietnamese text at 6–12 pt, 0.25–1 pt table strokes, a blank third page, a synthetic
  color image, and a landscape fifth page.
- Compare RGB PNG, indexed PNG at 128/256 colors (no dithering), and JPEG quality
  85/92/97 with 4:4:4 chroma. Dimensions are checked after encoding.
- `pdf-lib` may expand palette PNGs when embedding: these are measurements of the
  resulting PDFs, not a claim that the PDF preserves an indexed color space.
- Render each output back at the same resolution. Compare all pixels and ink-region
  pixels (reference channel minimum <240), check original page sizes, and find the
  nearest reference page at thumbnail scale to detect order/content mistakes.
  The ink metric is not a true edge detector or perceptual print-quality score.
- A mismatch, missing page, decode failure or child timeout marks the run INCOMPLETE.
  Pixel comparison is same-renderer raster fidelity, not preservation of vector/text,
  accessibility, searchable text, original PDF structure, or actual paper quality.
- Content matching assumes distinguishable fixture pages. Repeated identical pages
  in arbitrary PDFs require a separate identity strategy; this is not a generic tool.
- Run one child at a time. Render/encode one page at a time; release canvases and
  PDF.js page resources, disable Sharp cache, and flush pdf-lib embedders. Compressed
  PDF objects still accumulate until save: memory is not constant with document length.
- Each compression method runs in a fresh process. `peakRssMiB` is OS-reported process
  high-water RSS for encoding/assembly; `maxCompressionRssDeltaMiB` is a before/after
  RSS delta, **not** a transient compression peak. Report verification memory separately.
- Windows monitor sums working sets of the root and recursive children; monitor itself
  is excluded. Sampling may miss short peaks and shared pages may be counted twice.
  It includes preparation/verification, not just PDF construction. Native threads are
  included in process memory. This local pipeline launches no Chromium.

## Observations on the five-page reference

Windows Node 24.18.0, one job, 300 dpi, original portrait pages approximately
594.960 × 841.920 pt and the landscape page reversed; raster sizes 2479 × 3508
and 3508 × 2479. All six methods preserved five pages, blank page, orientation,
dimensions, and nearest-reference content order.

| Encoding | PDF bytes | Encode + assemble seconds | Compression seconds | Encode peak RSS MiB | Maximum page RMSE (0–255) |
| --- | ---: | ---: | ---: | ---: | ---: |
| RGB PNG | 1190763 | 2.20 | <0.001 | 200.5 | 0 |
| Indexed 128 | 469777 | 2.63 | 0.99 | 171.8 | 1.636 |
| Indexed 256 | 924118 | 2.84 | 1.09 | 176.2 | 0.262 |
| JPEG 85 | 1230930 | 0.28 | 0.25 | 209.6 | 0.922 |
| JPEG 92 | 1392005 | 0.28 | 0.25 | 209.6 | 0.549 |
| JPEG 97 | 1804712 | 0.28 | 0.25 | 210.2 | 0.388 |

These are single local runs, not throughput/SLA estimates. Pixel errors compare against
the original rasterized with PDF.js. The zero-error RGB case is the control. For indexed
256, pages 1/2/3/5 have zero error; only the color illustration changes (ink RMSE 0.527).
Review of crops shows readable Vietnamese at 6 pt and retained thin table strokes.
Indexed 128 produces visible gradient banding; JPEG 85 adds noise near glyphs.

A second run with the corrected Windows process-tree monitor completed with exit 0:
73 samples over approximately 23.8 seconds, at most three processes, sampled total peak
535.7 MiB. Indexed 256 used 176.5 MiB peak RSS while encoding/assembling (2.81 s wall,
3.20 s CPU); its separate verification process reached 470.2 MiB. Its largest RSS
before/after compression delta was 1.48 MiB, which excludes transient allocation peaks.
The first monitor attempt captured memory but lost the process exit code; it is not
used as evidence of successful monitor execution. CPU times can exceed wall time due
to native runtime threads; Sharp concurrency 1 is not a whole-process CPU quota.

Provisional choice: **indexed 256** for this classroom fixture (22.4% smaller than RGB).
Keep RGB as the lossless fallback for color-sensitive material. This does not justify
an automatic policy for photographs or other documents; 128 colors is not chosen merely
because its file is smallest. No physical printing has been performed.

## Linux experiment decision

GO for a separate, bounded **Linux benchmark**, not production or a public render service.
Docker CLI/WSL exist locally but Docker Desktop's Linux daemon is unavailable; no Linux
container measurements were obtained and no production infrastructure was started.
The local raster/encode/verify run needs substantially more RAM than its sub-1 MB PDF.
Start a future isolated Node-only experiment at 1 vCPU / 2 GiB RAM, concurrency 1, with a
five-minute deadline and explicit input/page/output/disk limits. This is a conservative
test allocation based on Windows measurements, not a proven Linux requirement.
Measure cgroup memory peak, CPU, wall time, temporary disk, image/layer size and cleanup
before reducing that allocation or planning a service. No image size or Linux disk
headroom has been measured here.

Drive rendering of this owned fixture remains NOT TESTED (it has not been uploaded).
The prior 17-page viewer's roughly 1.4 GiB Chromium result is a different workload;
this compression-only experiment does not prove browser memory has been reduced.
If Chromium is required, benchmark it separately together with compression before sizing
the worker. NO-GO for the existing 1.5 GB shared VPS/API container 384 MB; see
[production resource budget](../operations/production.md#production-vps-capacity-and-resource-budget).
Any future service needs authorized sources, bounded egress, no cookies/credentials,
concurrency/deadlines/quotas, cancellation and cleanup; none is deployed by this PoC.
