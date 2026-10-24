export interface PdfSettings { enabled: boolean; maxLinks: number; maxActive: number; maxHourly: number; maxRetries: number }
export function pdfSettings(env: NodeJS.ProcessEnv = process.env): PdfSettings {
  const num = (key: string, fallback: number, ceiling: number) => {
    const raw = env[key] ?? String(fallback);
    return /^\d+$/.test(raw) && Number(raw) > 0 && Number(raw) <= ceiling ? Number(raw) : 0;
  };
  const result = { enabled: false, maxLinks: num('PDF_BATCH_LIMIT', 5, 5),
    maxActive: num('PDF_ACTIVE_LIMIT', 10, 20), maxHourly: num('PDF_HOURLY_LIMIT', 10, 30), maxRetries: 2 };
  result.enabled = env.PDF_API_ENABLED === 'true' && !!result.maxLinks && !!result.maxActive && !!result.maxHourly;
  return result;
}
