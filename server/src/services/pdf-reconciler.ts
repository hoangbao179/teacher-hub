import { performance } from 'node:perf_hooks';
import type { PdfService } from './pdf.service';

export interface PdfReconcileOptions { maxJobs?: number; budgetMs?: number }
export interface PdfReconcileSummary {
  processed: number;
  stopped: 'idle_or_unavailable' | 'job_limit' | 'deadline';
}

/** Sequential one-shot sweep; durable leases/next-action times supply pagination. */
export async function reconcilePdf(
  service: Pick<PdfService, 'tick'>,
  options: PdfReconcileOptions = {},
  now: () => number = () => performance.now(),
): Promise<PdfReconcileSummary> {
  const maxJobs = options.maxJobs ?? 50;
  const budgetMs = options.budgetMs ?? 45000;
  if (!Number.isInteger(maxJobs) || maxJobs < 1 || maxJobs > 50 ||
    !Number.isInteger(budgetMs) || budgetMs < 1 || budgetMs > 45000) {
    throw new Error('PDF_RECONCILE_INVALID_LIMITS');
  }
  const deadline = now() + budgetMs;
  const signal = AbortSignal.timeout(budgetMs);
  let processed = 0;
  while (processed < maxJobs) {
    if (signal.aborted || now() >= deadline) return { processed, stopped: 'deadline' };
    const count = await service.tick(undefined, undefined, 1, signal);
    processed += count;
    if (signal.aborted || now() >= deadline) return { processed, stopped: 'deadline' };
    if (!count) return { processed, stopped: 'idle_or_unavailable' };
  }
  return { processed, stopped: 'job_limit' };
}
