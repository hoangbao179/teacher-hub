import { readFile } from 'node:fs/promises';
import { JobError } from '../src/contract.ts';

export const job = { version: 1, jobId: '55b797f0-e128-4525-8df5-c3cb92163167',
  source: { provider: 'google_drive', fileId: 'owned_fixture_12345' } };
export function syntheticPDF(pages = 2) {
  const objects = ['<< /Type /Catalog /Pages 2 0 R >>',
    `<< /Type /Pages /Kids [${Array.from({ length: pages }, (_, i) => `${i + 3} 0 R`).join(' ')}] /Count ${pages} >>`,
    ...Array.from({ length: pages }, () => '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 300 400] /Resources << >> >>')];
  let body = '%PDF-1.7\n';
  const offsets = [0];
  objects.forEach((object, index) => { offsets.push(Buffer.byteLength(body)); body += `${index + 1} 0 obj\n${object}\nendobj\n`; });
  const xref = Buffer.byteLength(body);
  body += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  body += offsets.slice(1).map(offset => `${String(offset).padStart(10, '0')} 00000 n \n`).join('');
  body += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return Buffer.from(body);
}
export class MemoryStore {
  objects = new Map();
  failResult = 0;
  denied = false;
  async ready() { if (this.denied) throw new JobError('SERVICE_UNAVAILABLE', true); }
  async json(name) { return this.objects.get(name)?.json ?? null; }
  async head(name) { const v = this.objects.get(name); return v ? { metadata: v.metadata, generation: '1' } : null; }
  async create(name, body, signal) {
    signal.throwIfAborted();
    if (name.endsWith('result.json') && this.failResult-- > 0) throw new JobError('STORAGE_UNAVAILABLE', true);
    if (this.objects.has(name)) return false;
    const value = 'json' in body ? structuredClone(body) : { bytes: await readFile(body.path), metadata: body.metadata };
    // Check after await too: models GCS's atomic ifGenerationMatch=0.
    if (this.objects.has(name)) return false;
    this.objects.set(name, value);
    return true;
  }
}
