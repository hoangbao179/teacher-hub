/** Product-wide PDF job limits — single source of truth for API, Worker, Gateway and client guards. */
export const PDF_OUTPUT_MAX_BYTES = 20 * 1024 * 1024;
/** Source download bound is independent of raster output and intermediate memory. */
export const PDF_SOURCE_MAX_BYTES = 20 * 1024 * 1024;
export const PDF_MAX_PAGES = 40;
/** Encoded PNG byte bound per captured page; not a bound on decoded pixels or process RAM. */
export const PDF_INTERMEDIATE_PNG_PEAK_BYTES = 32 * 1024 * 1024;
export const PDF_VIEWER_JPEG_QUALITIES = [90, 85, 80] as const;
/** Compatibility export: initial quality, not a promise that every page uses it. */
export const PDF_VIEWER_JPEG_QUALITY = PDF_VIEWER_JPEG_QUALITIES[0];
/** Soft encoding target (decimal KB), never a per-page rejection threshold. */
export const PDF_VIEWER_TARGET_PAGE_BYTES = 500_000;
export const PDF_VIEWER_MIN_DPI = 200;
export const PDF_VIEWER_MAX_PIXELS = 12_000_000;
