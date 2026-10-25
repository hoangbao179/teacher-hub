import { readFileSync, statSync } from 'node:fs';
import { isAbsolute } from 'node:path';
import type { ApprovedGatewayRuntime } from './pdf-runtime';
import { validGatewayFederation, type GatewayFederation } from './pdf-gateway-identity';

type Config = {
  kind: 'pdf_gateway_v1';
  gatewayURL: string;
  workerBaseURL: string;
  hmacKeyHex: string;
  federation?: GatewayFederation;
  authMode?: 'hmac_public_v1';
  activationApproved: true;
  recoveryVerified: true;
};

/** Both API and independent recovery CLI use this same file-only approval boundary.
 * Without a separately provisioned private file the default provider is disabled.
 * No production credentials or boolean approval are accepted from environment alone.
 */
export function loadApprovedPdfGateway(env: NodeJS.ProcessEnv = process.env): ApprovedGatewayRuntime | undefined {
  const path = env.PDF_GATEWAY_APPROVAL_FILE;
  if (!path || !isAbsolute(path)) return undefined;
  try {
    const st = statSync(path);
    // Prevent accidental sharing with other local users, e.g. world readable.
    if (!st.isFile() || st.size < 50 || st.size > 4096 ||
      (process.platform !== 'win32' && (st.mode & 0o077) !== 0)) return undefined;
    const config: Config = JSON.parse(readFileSync(path, 'utf8'));
    const keys = Object.keys(config).sort().join(',');
    // Distinct exact-file contracts: old private IAM + HMAC is preserved.
    // Public HMAC is never inferred from absent/expired federation credentials.
    const privateIAM = keys ===
      'activationApproved,federation,gatewayURL,hmacKeyHex,kind,recoveryVerified,workerBaseURL' &&
      validGatewayFederation(config.federation!);
    const publicHmac = keys ===
      'activationApproved,authMode,gatewayURL,hmacKeyHex,kind,recoveryVerified,workerBaseURL' &&
      config.authMode === 'hmac_public_v1';
    if (config.kind !== 'pdf_gateway_v1' ||
      !(privateIAM || publicHmac) ||
      config.activationApproved !== true || config.recoveryVerified !== true ||
      typeof config.gatewayURL !== 'string' || config.gatewayURL.trim() !== config.gatewayURL ||
      typeof config.workerBaseURL !== 'string' || config.workerBaseURL.trim() !== config.workerBaseURL ||
      typeof config.hmacKeyHex !== 'string' || config.hmacKeyHex.length !== 64 ||
      !/^https:\/\/teacher-pdf-gateway-[a-z0-9-]+\.[a-z0-9-]+\.run\.app$/.test(config.gatewayURL) ||
      !/^https:\/\/teacher-pdf-worker-[a-z0-9-]+\.[a-z0-9-]+\.run\.app$/.test(config.workerBaseURL) ||
      !/^[a-f0-9]{64}$/.test(config.hmacKeyHex)) return undefined;
    return {
      gatewayURL: config.gatewayURL, workerBaseURL: config.workerBaseURL,
      hmacKeyHex: config.hmacKeyHex, activationApproved: true, recoveryVerified: true,
      ...(publicHmac ? {authMode: 'hmac_public_v1' as const} : {federation: config.federation!}),
    };
  } catch { return undefined; }
}
