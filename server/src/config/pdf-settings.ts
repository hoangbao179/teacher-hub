import { PDF_LONG_MAX_LINKS, PDF_LONG_MAX_ACTIVE, PDF_LONG_MAX_HOURLY } from '@teacher/shared';
export interface PdfSettings { enabled: boolean; maxLinks: number; maxActive: number; maxHourly: number; maxRetries: number; chunked?: boolean }
export function pdfSettings(env: NodeJS.ProcessEnv = process.env): PdfSettings {
  const num = (key: string, fallback: number, ceiling: number) => {
    const raw = env[key] ?? String(fallback);
    return /^\d+$/.test(raw) && Number(raw) > 0 && Number(raw) <= ceiling ? Number(raw) : 0;
  };
  const chunked = env.PDF_CHUNKED_JOBS_ENABLED === 'true';
  const result = { enabled: false, maxLinks: num('PDF_BATCH_LIMIT', chunked ? PDF_LONG_MAX_LINKS : 5, 5),
    maxActive: num('PDF_ACTIVE_LIMIT', chunked ? PDF_LONG_MAX_ACTIVE : 10, 20),
    maxHourly: num('PDF_HOURLY_LIMIT', chunked ? PDF_LONG_MAX_HOURLY : 10, 30), maxRetries: 2,
    chunked };
  result.enabled = env.PDF_API_ENABLED === 'true' && !!result.maxLinks && !!result.maxActive && !!result.maxHourly;
  if(result.chunked){result.maxLinks=Math.min(result.maxLinks,PDF_LONG_MAX_LINKS);result.maxActive=Math.min(result.maxActive,PDF_LONG_MAX_ACTIVE);result.maxHourly=Math.min(result.maxHourly,PDF_LONG_MAX_HOURLY);}
  return result;
}
