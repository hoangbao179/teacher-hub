import { PdfService } from '../services/pdf.service';
import { PdfRepository } from '../repositories/pdf.repository';
import { DisabledPdfProvider } from '../services/pdf-provider';
import { pdfSettings } from '../config/pdf-settings';
import { pool } from '../db/pool';

// One-shot recovery hook. No credential fallback; production identity remains unapproved.
const service = new PdfService(new PdfRepository(),new DisabledPdfProvider(),pdfSettings());
void (async () => {
  try { console.log(JSON.stringify({ processed:await service.tick(),submitEnabled:false })); }
  finally { await pool.end(); }
})().catch(() => { console.error('PDF_RECOVERY_UNAVAILABLE'); process.exitCode=1; });
