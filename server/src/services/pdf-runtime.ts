import { pdfSettings } from '../config/pdf-settings';
import { PdfRepository } from '../repositories/pdf.repository';
import { DisabledPdfProvider, RestPdfProvider, type VerifiedPdfIdentity } from './pdf-provider';
import { PdfService } from './pdf.service';
import { GatewayPdfProvider } from './pdf-gateway-provider';
import { gatewayIdToken, type GatewayFederation } from './pdf-gateway-identity';

export interface ApprovedGatewayRuntime {
  gatewayURL: string;
  workerBaseURL: string;
  hmacKeyHex: string;
  federation: GatewayFederation;
  activationApproved: true;
  recoveryVerified: true;
}

export interface ApprovedPdfRuntime {
  identity: VerifiedPdfIdentity;
  workerBaseURL: string;
  activationApproved: true;
  recoveryVerified: true;
}

// Shared HTTP/CLI boundary. No credential discovery or environment-only activation.
// A reviewed identity loader must supply this explicitly after production approval.
export function createPdfRuntime(approved?: ApprovedPdfRuntime | ApprovedGatewayRuntime): PdfService {
  const permitted = approved?.activationApproved === true && approved.recoveryVerified === true;
  const provider = permitted && approved && 'gatewayURL' in approved
    ? new GatewayPdfProvider(approved.gatewayURL, approved.workerBaseURL, approved.hmacKeyHex, true,
      gatewayIdToken(approved.federation, approved.gatewayURL))
    : permitted && approved && 'identity' in approved
      ? new RestPdfProvider(approved.identity, approved.workerBaseURL, true)
      : new DisabledPdfProvider();
  return new PdfService(new PdfRepository(), provider, pdfSettings());
}
