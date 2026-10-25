import { readFileSync, statSync } from 'node:fs';
import { isAbsolute } from 'node:path';
import { PdfCloudError } from './pdf-provider';

export interface GatewayFederation {
  audience: string;
  serviceAccount: string;
  subjectTokenFile: string;
}
export type GatewayIdToken = (signal: AbortSignal) => Promise<string>;

export function validGatewayFederation(value: GatewayFederation): boolean {
  return !!value && Object.keys(value).sort().join(',') === 'audience,serviceAccount,subjectTokenFile' &&
    typeof value.audience === 'string' && value.audience.trim() === value.audience &&
    typeof value.serviceAccount === 'string' && value.serviceAccount.trim() === value.serviceAccount &&
    /^\/\/iam.googleapis.com\/projects\/851777150171\/locations\/global\/workloadIdentityPools\/[a-z0-9-]+\/providers\/[a-z0-9-]+$/.test(value.audience) &&
    /^[a-z][a-z0-9-]+@teacher-hub-pdf\.iam\.gserviceaccount\.com$/.test(value.serviceAccount) &&
    typeof value.subjectTokenFile === 'string' && isAbsolute(value.subjectTokenFile);
}

/** Explicit OIDC federation only: no ADC, personal credentials, executable or SA key discovery.
 * The operator's existing trusted issuer must atomically renew the private subject file.
 * Google STS validates its signature/issuer/subject; Cloud Run validates the minted ID token.
 */
export function gatewayIdToken(config: GatewayFederation, gatewayURL: string): GatewayIdToken {
  let cached: { token: string; until: number } | undefined;
  return async signal => {
    try {
      if (!validGatewayFederation(config) || signal.aborted) throw new Error();
      if (cached && cached.until > Date.now()) return cached.token;
      const st = statSync(config.subjectTokenFile);
      if (!st.isFile() || st.size > 16384 || st.size < 10 ||
          (process.platform !== 'win32' && (st.mode & 0o077) !== 0)) throw new Error();
      const subject = readFileSync(config.subjectTokenFile, 'utf8').trim();
      if (!/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(subject)) throw new Error();
      const request = async (url: string, body: object, token?: string) => {
        const response = await fetch(url, { method: 'POST', redirect: 'error', signal,
          headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
          body: JSON.stringify(body) });
        if (!response.ok) { await response.body?.cancel(); throw new Error(); }
        let size = 0; const chunks: Buffer[] = [];
        if (!response.body) throw new Error();
        for await (const chunk of response.body) {
          size += chunk.length;
          if (size > 32768) throw new Error();
          chunks.push(Buffer.from(chunk));
        }
        return JSON.parse(Buffer.concat(chunks).toString('utf8'));
      };
      const sts = await request('https://sts.googleapis.com/v1/token', {
        audience: config.audience, grantType: 'urn:ietf:params:oauth:grant-type:token-exchange',
        requestedTokenType: 'urn:ietf:params:oauth:token-type:access_token',
        subjectTokenType: 'urn:ietf:params:oauth:token-type:jwt', subjectToken: subject,
        scope: 'https://www.googleapis.com/auth/cloud-platform',
      });
      if (typeof sts.access_token !== 'string' || !/^[\x21-\x7e]{1,16384}$/.test(sts.access_token)) throw new Error();
      const result = await request(
        `https://iamcredentials.googleapis.com/v1/projects/-/serviceAccounts/${config.serviceAccount}:generateIdToken`,
        { audience: gatewayURL, includeEmail: true }, sts.access_token);
      if (typeof result.token !== 'string' || !/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(result.token)) throw new Error();
      const claims = JSON.parse(Buffer.from(result.token.split('.')[1]!, 'base64url').toString('utf8'));
      const now = Date.now();
      if (claims.aud !== gatewayURL || !['https://accounts.google.com', 'accounts.google.com'].includes(claims.iss) ||
          claims.email !== config.serviceAccount || !Number.isInteger(claims.exp) ||
          claims.exp * 1000 < now + 60000 || claims.exp * 1000 > now + 3660000) throw new Error();
      cached = { token: result.token, until: claims.exp * 1000 - 60000 };
      return result.token;
    } catch { throw new PdfCloudError(); }
  };
}
