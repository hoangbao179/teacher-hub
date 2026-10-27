import { pool } from '../db/pool';
import { loadApprovedPdfGateway } from '../services/pdf-gateway-bootstrap';
import { createPdfRuntime } from '../services/pdf-runtime';
import type { RowDataPacket } from 'mysql2/promise';

export async function verifySchema(): Promise<void> {
  const [ledger] = await pool.query<RowDataPacket[]>(
    'SELECT version FROM schema_migrations WHERE version=?', ['0029_pdf_chunk_progress.sql']);
  const [columns] = await pool.query<RowDataPacket[]>(`SELECT COLUMN_NAME AS name,
    COLUMN_TYPE AS type, IS_NULLABLE AS nullable, COLUMN_DEFAULT AS value
    FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name='pdf_jobs'
    AND column_name IN ('worker_version','progress_json')`);
  validatePdfSchema(ledger, columns);
}

export function validatePdfSchema(ledger: RowDataPacket[], columns: RowDataPacket[]): void {
  const version = columns.find(c => c.name === 'worker_version');
  const progress = columns.find(c => c.name === 'progress_json');
  if (ledger.length !== 1 || version?.type !== 'tinyint unsigned' || version.nullable !== 'NO' ||
      String(version.value) !== '1' || progress?.type !== 'json' || progress.nullable !== 'YES') {
    throw Error('PDF_V2_SCHEMA_UNVERIFIED');
  }
}

export async function verifyRuntime(): Promise<void> {
  const approved = loadApprovedPdfGateway();
  if (!approved || approved.authMode !== 'hmac_public_v1' ||
      approved.workerBaseURL !== 'https://teacher-pdf-worker-851777150171.asia-southeast1.run.app' ||
      approved.gatewayURL !== 'https://teacher-pdf-gateway-851777150171.asia-southeast1.run.app') {
    throw Error('PDF_V2_APPROVAL_UNVERIFIED');
  }
  const caps = await createPdfRuntime(approved).capabilities(AbortSignal.timeout(15000));
  if (!caps.submitEnabled || !caps.downloadEnabled || caps.maxPages !== 200) {
    throw Error('PDF_V2_GATEWAY_UNAVAILABLE');
  }
}

if (require.main === module) {
  const deadline = setTimeout(() => { console.error('PDF_V2_VERIFY_DEADLINE'); process.exit(1); }, 25000);
  void verifySchema().then(verifyRuntime).then(() => console.log('PDF_V2_SCHEMA_AND_GATEWAY_PASS'))
    .catch(() => { console.error('PDF_V2_SCHEMA_OR_APPROVED_GATEWAY_FAILED'); process.exitCode = 1; })
    .finally(async () => { await pool.end(); clearTimeout(deadline); });
}
