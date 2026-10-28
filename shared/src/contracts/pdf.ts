export type PdfJobStatus = 'ENQUEUE_PENDING' | 'ENQUEUE_RETRY' | 'QUEUED' | 'COMPLETED' |
  'FAILED' | 'RETRY_EXHAUSTED' | 'RESULT_UNCONFIRMED' | 'EXPIRED';
export interface CreatePdfBatchRequest { links: string[] }
export interface PdfCapabilities {
  maxSourceBytes?: number;
  submitEnabled: boolean; downloadEnabled: boolean; unavailableReason: string | null;
  maxLinksPerBatch: number; maxActiveJobs: number; maxBatchesPerHour: number;
  maxRetries: number; maxBytes: number; maxPages: number; ticketTtlSeconds: number;
}
export interface PdfJob {
  workerVersion?: 1 | 2; progress?: import('../pdf-pipeline.js').PdfProgress | null;
  filename?: string | null;
  id: string; batchId: string; fileId: string; status: PdfJobStatus;
  createdAt: string; enqueuedAt: string | null; updatedAt: string;
  completedAt: string | null; expiresAt: string; errorCode: string | null;
  cloudErrorCode: string | null; bytes: number | null; pages: number | null;
  retryOf: string | null; retryAttempts: number; enqueueAttempts: number;
}
export interface PdfBatch { id: string; createdAt: string; rightsConfirmedAt: string; jobs: PdfJob[] }
export interface PdfBatchList { items: Omit<PdfBatch, 'jobs'>[]; page: number; pageSize: number; total: number }
export interface PdfDownloadTicket { ticket: string; downloadPath: string; expiresAt: string }
export interface PdfDownloadRequest { ticket: string }
