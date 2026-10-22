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

## Linux Node-only benchmark

The isolated benchmark image is [Dockerfile.benchmark](../../scripts/pdf-poc/Dockerfile.benchmark),
separate from production Dockerfiles. It reuses the existing preparation, compression
and verification code. Run on a local Linux Docker engine (including Docker Desktop):

```text
node scripts/pdf-poc/linux-benchmark.mjs .artifacts/print-quality-pdf/20261022/owned-synthetic-original.pdf .artifacts/linux-pdf-benchmark/NEW-RUN
```

The harness refuses SSH/TCP Docker endpoints and pins the inspected local context,
builds a dedicated image, runs regression tests in that image, and starts fresh
containers for RGB and indexed 256 at each RAM limit. Each container has a one-CPU
quota (`cpu.max = 100000 100000`), concurrency 1, no swap, no network, read-only root
and fixture, a 64 MiB `/tmp` limit, 128 PID limit and a 120-second pipeline deadline.
Results go to bind-mounted `.artifacts`; no fixture is copied into the image/build context.

Supervisor measurements cover prepare + encode + verify. CPU is the cgroup usage
delta, wall time excludes image build/container startup, memory peak is cgroup v2
`memory.peak` (including charged cache/kernel allocations), and tree RSS is the sum
from `/proc` sampled every 100 ms. Shared pages can be counted twice in RSS or charged
to another cgroup; these figures need not match. Temporary disk is the sampled peak
logical bytes in the job directory, not physical host filesystem allocation. Image,
VM/OS overhead and build cache are additional; the host itself was not RAM-constrained.

Measured on Docker Desktop Linux x86_64, kernel `6.6.87.2-microsoft-standard-WSL2`,
Node 24.18.0, Debian bookworm image. Same five-page owned original, 300 dpi. Each row
is one run, with shared filesystem caches potentially warm, not a cold-boot guarantee.

| RAM cap | Encoding | cgroup peak MiB | Sampled tree RSS MiB | CPU seconds | Wall seconds | Temporary MiB | PDF bytes |
| --- | --- | ---: | ---: | ---: | ---: | ---: | ---: |
| 1 GiB | RGB | 470.4 | 572.1 | 9.54 | 9.56 | 2.87 | 1190760 |
| 1 GiB | Indexed 256 | 436.5 | 537.0 | 12.59 | 12.62 | 2.59 | 924118 |
| 1.5 GiB | RGB | 471.5 | 575.1 | 9.38 | 9.42 | 2.87 | 1190763 |
| 1.5 GiB | Indexed 256 | 480.2 | 557.7 | 12.07 | 12.08 | 2.59 | 924118 |
| 2 GiB | RGB | 468.3 | 560.9 | 9.56 | 9.60 | 2.87 | 1190761 |
| 2 GiB | Indexed 256 | 472.9 | 556.6 | 12.61 | 12.65 | 2.59 | 924116 |

All six rows completed without OOM/timeout: five pages, correct order, original page
point dimensions, blank page 3 and landscape page 5. RGB roundtrip RMSE is zero on
every page. Indexed 256 is zero on pages 1/2/3/5; illustration page 4 RMSE is 0.26154.
Crops of 6 pt Vietnamese and thin table strokes were visually reviewed. No paper was
printed. PDF byte totals vary by a few bytes across runs while the verified rendered
pixels and dimensions agree; byte identity is not an acceptance condition. Image size reported by Docker inspect was 131165034
bytes for the matrix image; Docker storage/backend representation and build cache
are separate from this number. Image remains local for reproducibility; no image is pushed.

OOM control at 64 MiB reported `oom_kill = 1` and INCOMPLETE; timeout was deliberately
forced at two seconds after 1483480 temporary bytes had been observed. Both controls
exited 1, removed their failed job folders, and passed the host cleanup assertions.
Failed job folders are removed
while metric/log files are retained; the host also performs cleanup if the supervisor
is killed. Every benchmark container is removed in a finally block. Failure controls
can be repeated without rerunning successful rows:

```text
node scripts/pdf-poc/linux-benchmark.mjs .artifacts/print-quality-pdf/20261022/owned-synthetic-original.pdf .artifacts/linux-pdf-benchmark/NEW-FAULT-RUN --faults-only
```

## Decision and remaining limits

**GO for further isolated Node-only worker experiments.** The smallest tested successful
allocation among the requested sizes is **1 CPU / 1 GiB RAM / concurrency 1**, for this
five-page fixture and this full preparation/compression/verification pipeline. This
does not establish an absolute minimum or capacity for larger PDFs, repeated requests,
other CPU hardware, cold caches or a complete worker service. Indexed 256 remains the
fixture-specific choice; keep RGB for lossless/color-sensitive cases.

The Node-only image contains no Chromium binary. Browser measurements use the separate
image and viewer described below; they do not establish Google Drive feasibility.

**NO-GO for the existing shared production VPS/API container 384 MB**; see
[production resource budget](../operations/production.md#production-vps-capacity-and-resource-budget).
The 1 GiB result is a container budget, not an entire host budget. This work changes
no production Dockerfiles, deployment workflows, APIs, authentication or database.

## Linux browser + Node benchmark (owned local viewer)

The [browser image](../../scripts/pdf-poc/Dockerfile.browser-benchmark) contains pinned
Playwright 1.61.1, Chromium headless shell 149.0.7827.55 and PDF.js 6.4.299. The viewer
is a small local PDF.js/Canvas test surface, **not Google Drive or Chromium's built-in
PDF viewer**. Playwright routes supply only the fixture and installed library assets
at a synthetic origin; Docker networking is disabled. No HTTP server/public endpoint,
cookies, passwords, stored login state, screenshots of third-party documents or production
infrastructure are used. Chromium sandbox is disabled inside the disposable container;
this is suitable only for this trusted fixture, not an untrusted public renderer.

Run sequentially, reviewing the baseline before the memory descent:

```text
node scripts/pdf-poc/browser-linux-benchmark.mjs .artifacts/print-quality-pdf/20261022/owned-synthetic-original.pdf .artifacts/browser-linux-pdf/NEW-BASELINE --baseline-only
node scripts/pdf-poc/browser-linux-benchmark.mjs .artifacts/print-quality-pdf/20261022/owned-synthetic-original.pdf .artifacts/browser-linux-pdf/NEW-MATRIX --matrix
node scripts/pdf-poc/browser-linux-benchmark.mjs .artifacts/print-quality-pdf/20261022/owned-synthetic-original.pdf .artifacts/browser-linux-pdf/NEW-FAULTS --faults-only
node scripts/pdf-poc/browser-linux-benchmark.mjs .artifacts/print-quality-pdf/20261022/owned-synthetic-original.pdf .artifacts/browser-linux-pdf/NEW-STABILITY --stability
```

The matrix starts at 4 GiB and descends to 3/2/1.5/1 GiB, 768 and 512 MiB, stopping
on the first unsuccessful workload. A detected OOM boundary is a successful research
observation, **never** a successful PDF job; each row retains its actual exit/status.
Stability probes repeat the same low RAM cap and may record both completions and OOMs.

### Limits and pipeline

- One CPU quota, concurrency 1, no swap, 256 PIDs, 120-second whole-job deadline.
- Owned input at most 10 MiB, exactly five pages, at most 12 million pixels/page and
  60 million pixels total. Page metadata is checked before rasterization.
- Native canvas resolution 300 dpi (portrait 2479 × 3508, landscape reversed); never
  upscale captured images. An originally raster picture still has its original detail.
- Captured PNG total at most 32 MiB; job directory soft cap 64 MiB sampled every 100 ms;
  hard `/tmp` tmpfs cap 256 MiB and `/dev/shm` cap 128 MiB. Sampled caps may overshoot
  between samples, so these are not substitutes for filesystem quotas in a service.
- Reference: Node rasterizes the original. Browser renders the original independently
  and exports PNGs. Node uses existing indexed-256 encoding/assembly, existing roundtrip
  verification, then a second comparison against the original Node-rendered reference.
- Baseline retains five browser canvases until export. Optimized mode renders, exports
  and clears one canvas/page at a time, cleans PDF.js page resources and explicitly
  collects browser garbage. Browser closes before Node compression/verification; no
  browser reuse/pooling is measured. This ordering is part of the measured design.
- Cgroup peak includes all stages and browser temporary tmpfs pages. Browser tree and
  Node RSS are separately sampled; their peaks may occur at different times. Summed
  RSS includes shared pages and must not be interpreted as physical RAM or added to
  cgroup memory. Node 24 Linux is named `MainThread`; the sampler identifies Node by
  executable, covered by regression. Earlier name-based Node RSS results are discarded.

### Measured results

Same Linux/WSL2 Docker host and owned original as pipeline A, with an unconstrained
approximately 16 GB host VM. Container CPU/RAM limits were inspected. Each main row is
one run, not a throughput estimate or a cold-cache/dedicated-host guarantee.

| Mode | RAM cap | Cgroup peak MiB | Browser tree RSS MiB | Node RSS MiB | CPU seconds | Wall seconds |
| --- | --- | ---: | ---: | ---: | ---: | ---: |
| Retained baseline | 4 GiB | 644.8 | 774.8 | 550.1 | 17.89 | 17.93 |
| Sequential | 4 GiB | 493.7 | 547.1 | 563.8 | 18.13 | 18.20 |
| Sequential | 3 GiB | 491.8 | 544.6 | 565.0 | 17.95 | 18.02 |
| Sequential | 2 GiB | 485.4 | 544.1 | 559.3 | 18.05 | 18.12 |
| Sequential | 1.5 GiB | 489.3 | 544.0 | 591.4 | 18.27 | 18.35 |
| Sequential | 1 GiB | 456.5 | 548.9 | 559.7 | 18.03 | 18.12 |
| Sequential | 768 MiB | 481.1 | 546.4 | 559.9 | 18.38 | 18.43 |
| Sequential | 512 MiB | 469.5 | 548.3 | 570.6 | 18.87 | 18.95 |

At the same 4 GiB cap, sequential processing reduced whole-job cgroup peak about 23.4%.
Sampled browser-phase charged memory decreased from about 636 to 384 MiB; afterwards
verification, not Chromium, dominates the optimized peak. No quality setting was reduced.

All completed jobs reconstructed five pages in the correct order, original point sizes,
blank third page and landscape fifth page. PDF approximately 763414–763417 bytes;
job disk peak approximately 5.16 MiB plus browser `/tmp` peak 33.22 MiB. These are
separate sampled logical peaks, not an exact simultaneous physical disk total. Temporary
profiles live only in tmpfs and disappear with container removal. Docker inspect reported
376525258 bytes for the matrix image (as reported by Docker, not physical host usage); build
cache, unpacked layers and VM/OS storage are additional and were not capacity-tested.

Reconstructed PDF versus captured browser pages: RMSE zero on pages 1/2/3/5 and about
0.269 on the illustration page. Versus the original rendered using Node Canvas, raw
RMSE is 6.639, 9.556, 0, 2.550 and 3.631 by page, with larger ink-region differences.
The two renderers differ in text rasterization/placement; this is **not pixel-identical
reproduction of the original**. Crops of Vietnamese 6 pt text and 0.25 pt rules and the
five-page contact sheet were visually reviewed; no missing page/blank/orientation issue
was observed. Actual paper print quality remains unverified.

At 512 MiB, an earlier descent hit OOM during verification despite a later successful
matrix run at the same cap. Do not treat one passing row as reliable capacity. The
smallest cap ever completing the fixture is 512 MiB; 768 MiB also completed both the
exploratory and final descents, while 1 GiB provides more margin for further experiments.
Three additional sequential 512 MiB probes completed in 18.47/18.64/18.62 seconds,
with cgroup peaks 471.3/466.6/466.3 MiB. Thus four completions and one OOM were observed
across the sequential 512 MiB attempts (not an estimated failure probability). The
initial name-based Node RSS bug did not invalidate the cgroup OOM event, but those
early per-Node RSS values are excluded from the table.

### Failure behavior and conclusion

Retained mode at 512 MiB triggers cgroup `oom_kill = 1` during browser rendering. The
first control exposed a renderer wait that lasted until the global deadline after OOM.
The supervisor now watches `memory.events` and fails fast: measured 3.77 seconds,
INCOMPLETE, no final PDF, failed job directory removed. A forced three-second deadline
while Chromium was active measured 3.03 seconds, TIMEOUT, with about 1.48 MB of partial
job data removed. Host finally removes the container (including browser processes and
tmpfs/profile); retained metric/log files are intentional local evidence. This is not
a durable service cleanup/retention mechanism.

**Conditional GO for an external prototype handling this owned local viewer**, using
1 CPU / 1 GiB container RAM / concurrency 1 as a starting experimental budget, not a
proven host minimum. Do not choose 512 MiB for a worker based on a lucky completion.
Larger documents, job repetition, cold caches, browser reuse and arbitrary viewers need
separate testing. For an already available local PDF, pipeline A remains simpler.

**NO-GO for claiming a Google Drive/view-only downloader or deploying a production
worker.** The owned fixture has not been tested through Drive, and authorization,
viewer-specific behavior and real-device/print review remain unresolved. This result
does not establish any right or ability to copy restricted third-party documents.

Windows's earlier approximately 1.4 GiB browser observation used 17 pages in Google
Drive; these Linux figures use five pages in a local PDF.js viewer with different
flags/renderer/measurement. They are not an OS performance comparison and no percentage
Linux-versus-Windows saving is claimed.

For budgeting only, a separate 2 GiB/1 vCPU VM is listed at about USD 12/month on
[DigitalOcean's pricing page](https://www.digitalocean.com/pricing/droplets) (checked
2026-10-22), excluding tax, backups and operation. That is a prospective experiment
budget based on measured container peaks, not a benchmark of a whole 2 GiB VM or a
purchase/deployment recommendation. The existing 1.5 GB shared production host and
384 MB API container remain out of scope and unsuitable for this measured pipeline.
