import { pdfSettings } from '../config/pdf-settings';
import { PdfRepository } from '../repositories/pdf.repository';
import { DisabledPdfProvider, RestPdfProvider, type VerifiedPdfIdentity } from './pdf-provider';
import { PdfService } from './pdf.service';

export interface ApprovedPdfRuntime {
  identity: VerifiedPdfIdentity;
  workerBaseURL: string;
  activationApproved: true;
  recoveryVerified: true;
}

// Shared HTTP/CLI boundary. No credential discovery or environment-only activation.
// A reviewed identity loader must supply this explicitly after production approval.
export function createPdfRuntime(approved?: ApprovedPdfRuntime): PdfService {
  const provider = approved?.activationApproved === true && approved.recoveryVerified === true
    ? new RestPdfProvider(approved.identity, approved.workerBaseURL, true)
    : new DisabledPdfProvider();
  return new PdfService(new PdfRepository(), provider, pdfSettings());
}
