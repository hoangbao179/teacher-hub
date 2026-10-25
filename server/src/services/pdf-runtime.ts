import { pdfSettings } from '../config/pdf-settings';
import { PdfRepository } from '../repositories/pdf.repository';
import { DisabledPdfProvider, RestPdfProvider, type VerifiedPdfIdentity } from './pdf-provider';
import { PdfService } from './pdf.service';
import { GatewayPdfProvider } from './pdf-gateway-provider';
import { gatewayIdToken, type GatewayFederation } from './pdf-gateway-identity';

export type ApprovedGatewayRuntime = {
  gatewayURL: string;
  workerBaseURL: string;
  hmacKeyHex: string;
  activationApproved: true;
  recoveryVerified: true;
} & (
  | { federation: GatewayFederation; authMode?: never }
  | { authMode: 'hmac_public_v1'; federation?: never }
);

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
      approved.authMode === 'hmac_public_v1' ? undefined :
        gatewayIdToken(approved.federation!, approved.gatewayURL),
      approved.authMode === 'hmac_public_v1' ? 'hmac_public_v1' : 'iam_hmac_v1')
    : permitted && approved && 'identity' in approved
      ? new RestPdfProvider(approved.identity, approved.workerBaseURL, true)
      : new DisabledPdfProvider();
  return new PdfService(new PdfRepository(), provider, pdfSettings());
}
