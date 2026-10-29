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
/** v2 is opt-in until an operator provisions/reviews Worker scratch and transport. */
export const PDF_LONG_MAX_PAGES = 200;
export const PDF_NORMAL_MAX_PAGES = 50;
export const PDF_LONG_OUTPUT_MAX_BYTES = 150 * 1024 * 1024;
export const PDF_CHUNK_PAGES = 10;
export const PDF_CHUNK_MAX_BYTES = 20 * 1024 * 1024;
export const PDF_LONG_TEMP_BYTES = 384 * 1024 * 1024;
export const PDF_LONG_DOWNLOAD_MS = 180_000;
/** 165s budget remains below the 180s Cloud Tasks and Cloud Run request deadlines. */
export const PDF_CHUNK_DEADLINE_MS = 165_000;
export const PDF_CHUNK_DISPATCH_SECONDS = 180;
export const PDF_MAX_STEPS = Math.ceil(PDF_LONG_MAX_PAGES / PDF_CHUNK_PAGES) + 1;
export const PDF_LONG_MAX_LINKS = 1;
/** API admission only; Cloud Tasks dispatch and Worker instance limits remain independent. */
export const PDF_LONG_MAX_ACTIVE = 3;
export const PDF_LONG_MAX_HOURLY = 20;
export const PDF_LONG_PARSER_CPU_SECONDS = 45;
export const PDF_LONG_PARSER_WALL_MS = 50_000;
/** Final, already-assembled v2 PDFs receive one larger bounded qpdf integrity pass.
 * The request still has an overall 165s deadline (Cloud Tasks/Run: 180s).
 * Other parser passes and every chunk retain their existing smaller budgets.
 */
export const PDF_FINAL_PARSER_CPU_SECONDS = 110;
export const PDF_FINAL_PARSER_WALL_MS = 125_000;
export const PDF_FINAL_PARSER_AS_BYTES = 1024 * 1024 * 1024;
