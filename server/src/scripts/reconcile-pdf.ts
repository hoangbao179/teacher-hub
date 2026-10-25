import { loadApprovedPdfGateway } from '../services/pdf-gateway-bootstrap';
import { createPdfRuntime } from '../services/pdf-runtime';
import { reconcilePdf, type PdfReconcileOptions } from '../services/pdf-reconciler';
import { pool } from '../db/pool';

export function runPdfRecovery(options: PdfReconcileOptions = {}, service = createPdfRuntime(loadApprovedPdfGateway())) {
  return reconcilePdf(service, options);
}

if (require.main === module) {
  const options = {
    maxJobs: Number(process.env.PDF_RECONCILE_MAX_JOBS ?? 50),
    budgetMs: Number(process.env.PDF_RECONCILE_BUDGET_MS ?? 45000),
  };
  // Hard process bound also covers an unavailable DB/driver ignoring cancellation.
  // A forced exit leaves committed outbox rows and reclaimable 60-second leases.
  const hardStop = setTimeout(() => {
    console.error('PDF_RECOVERY_DEADLINE'); process.exit(1);
  }, 50000);
  const service = createPdfRuntime(loadApprovedPdfGateway());
  void runPdfRecovery(options, service).then(async summary => {
    const submitEnabled = (await service.capabilities()).submitEnabled;
    if (process.env.PDF_API_ENABLED === 'true' && !submitEnabled) throw new Error('PDF_RECOVERY_UNAVAILABLE');
    console.log(JSON.stringify({ ...summary, submitEnabled }));
  })
    .catch(() => { console.error('PDF_RECOVERY_UNAVAILABLE'); process.exitCode=1; })
    .finally(async () => { await pool.end(); clearTimeout(hardStop); });
}
