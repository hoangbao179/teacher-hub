import { open, rm, type FileHandle } from 'node:fs/promises';
import { JobError } from './contract.ts';
import { printPageSize } from './print-policy.ts';

/** Minimal image-only PDF: sequential file writes, one JPEG buffer, O(pages) xref offsets. */
export class ImagePdfWriter {
  private offsets = [0]; private position = 0; private pages = 0;
  private file: FileHandle; private path: string; private maxBytes: number; private signal: AbortSignal;
  private constructor(file: FileHandle, path: string, maxBytes: number, signal: AbortSignal) {
    this.file=file; this.path=path; this.maxBytes=maxBytes; this.signal=signal;
  }
  static async create(path: string, maxBytes: number, signal: AbortSignal) {
    signal.throwIfAborted();
    const writer = new ImagePdfWriter(await open(path, 'wx', 0o600), path, maxBytes, signal);
    try { await writer.write(Buffer.from('%PDF-1.7\n%\xff\xff\xff\xff\n', 'latin1')); return writer; }
    catch (e) { await writer.abort(); throw e; }
  }
  private async write(value: string | Buffer) {
    this.signal.throwIfAborted();
    const data = typeof value === 'string' ? Buffer.from(value) : value;
    if (this.position + data.length > this.maxBytes) throw new JobError('FILE_TOO_LARGE', false, 'output-pdf-bytes');
    let offset = 0;
    while (offset < data.length) { this.signal.throwIfAborted(); const n = await this.file.write(data, offset, data.length - offset); offset += n.bytesWritten; }
    this.position += data.length;
  }
  private async object(id: number, value: string) { this.offsets[id] = this.position; await this.write(`${id} 0 obj\n${value}\nendobj\n`); }
  async page(jpeg: Buffer, width: number, height: number) {
    const p = printPageSize(width, height), id = 3 + this.pages * 3;
    await this.object(id, `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${p.pageWidth} ${p.pageHeight}] /Resources << /XObject << /I ${id + 1} 0 R >> >> /Contents ${id + 2} 0 R >>`);
    this.offsets[id + 1] = this.position;
    await this.write(`${id + 1} 0 obj\n<< /Type /XObject /Subtype /Image /Width ${width} /Height ${height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${jpeg.length} >>\nstream\n`);
    await this.write(jpeg); await this.write('\nendstream\nendobj\n');
    const content = `q ${p.width} 0 0 ${p.height} ${p.x} ${p.y} cm /I Do Q\n`;
    await this.object(id + 2, `<< /Length ${Buffer.byteLength(content)} >>\nstream\n${content}endstream`);
    this.pages++;
  }
  async finish() {
    if (!this.pages) throw new JobError('INVALID_PDF');
    await this.object(1, '<< /Type /Catalog /Pages 2 0 R >>');
    await this.object(2, `<< /Type /Pages /Count ${this.pages} /Kids [${Array.from({length:this.pages}, (_,i)=>`${3+i*3} 0 R`).join(' ')}] >>`);
    const xref = this.position;
    await this.write(`xref\n0 ${this.offsets.length}\n0000000000 65535 f \n${this.offsets.slice(1).map(n=>`${String(n).padStart(10,'0')} 00000 n \n`).join('')}trailer\n<< /Size ${this.offsets.length} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`);
    await this.file.close(); this.signal.throwIfAborted();
  }
  async abort() { await this.file.close().catch(()=>{}); await rm(this.path, {force:true}); }
}
