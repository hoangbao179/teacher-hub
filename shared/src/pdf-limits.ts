/** Product-wide PDF job limits — single source of truth for API, Worker, Gateway and client guards. */
export const PDF_OUTPUT_MAX_BYTES = 20 * 1024 * 1024;
export const PDF_MAX_PAGES = 40;
/** Peak decoded PNG bytes held at once during viewer capture (working set, not cumulative across pages). */
export const PDF_INTERMEDIATE_PNG_PEAK_BYTES = 32 * 1024 * 1024;
export const PDF_VIEWER_JPEG_QUALITY = 88;
export const PDF_VIEWER_MIN_DPI = 200;
