/** Browser-only PDF assembly from page images supplied by the user. No network uploads. */
export const MAX_IMAGE_PAGES = 40;
export const MAX_IMAGE_PDF_BYTES = 20 * 1024 * 1024;
const MAX_FILE_BYTES = 15 * 1024 * 1024;
const MAX_PIXELS = 12_000_000;
const ALLOWED = new Set(['image/jpeg', 'image/png', 'image/webp']);
const encoder = new TextEncoder();

export interface JpegPage { bytes: Uint8Array<ArrayBuffer>; width: number; height: number }

export function sortImagePages<T extends { name: string }>(files: readonly T[]): T[] {
  const collator = new Intl.Collator('vi', { numeric: true, sensitivity: 'base' });
  return [...files].sort((a, b) => collator.compare(a.name, b.name));
}

export function validateImageFiles(files: readonly Pick<File, 'type'|'size'|'name'>[]): void {
  if (!files.length || files.length > MAX_IMAGE_PAGES) throw new Error('Chỉ nhận từ 1 đến 40 ảnh trang.');
  for (const file of files) {
    if (!ALLOWED.has(file.type)) throw new Error('Chỉ hỗ trợ ảnh JPG, PNG hoặc WebP.');
    if (!file.size || file.size > MAX_FILE_BYTES) throw new Error('Mỗi ảnh phải lớn hơn 0 và không quá 15 MB.');
  }
}

function pagePlacement(w: number, h: number) {
  if (!Number.isSafeInteger(w) || !Number.isSafeInteger(h) || w < 1 || h < 1 || w*h > MAX_PIXELS)
    throw new Error('Kích thước trang ảnh không hợp lệ.');
  const landscape = w > h;
  const paperW = landscape ? 841.89 : 595.28;
  const paperH = landscape ? 595.28 : 841.89;
  const margin = 12;
  const scale = Math.min((paperW - margin * 2) / w, (paperH - margin * 2) / h);
  const drawW = w * scale, drawH = h * scale;
  return { paperW, paperH, x: (paperW - drawW) / 2, y: (paperH - drawH) / 2, drawW, drawH };
}

/** Build a standards-compliant, unencrypted PDF without adding a client dependency. */
export function pdfFromJpegPages(pages: readonly JpegPage[]): Blob {
  if (!pages.length || pages.length > MAX_IMAGE_PAGES) throw new Error('Chỉ nhận từ 1 đến 40 ảnh trang.');
  const parts: Uint8Array<ArrayBuffer>[] = [];
  let length = 0;
  const offsets = [0];
  const emit = (bytes: Uint8Array<ArrayBuffer>) => { parts.push(bytes); length += bytes.length; };
  const line = (value: string) => emit(encoder.encode(value));
  const begin = (id: number) => { offsets[id] = length; line(`${id} 0 obj\n`); };
  const end = () => line('endobj\n');
  line('%PDF-1.4\n%PDF-IMAGE\n');
  begin(1); line('<< /Type /Catalog /Pages 2 0 R >>\n'); end();
  begin(2);
  line(`<< /Type /Pages /Count ${pages.length} /Kids [${pages.map((_, i) => `${5 + i * 3} 0 R`).join(' ')}] >>\n`);
  end();
  for (const [index, page] of pages.entries()) {
    const { bytes, width, height } = page;
    if (!(bytes instanceof Uint8Array) || bytes.length < 4 || bytes[0] !== 0xff || bytes[1] !== 0xd8 ||
      bytes[bytes.length - 2] !== 0xff || bytes[bytes.length - 1] !== 0xd9)
      throw new Error('Ảnh JPEG không hợp lệ.');
    const p = pagePlacement(width, height);
    const imageId = 3 + index * 3, contentsId = imageId + 1, pageId = imageId + 2;
    begin(imageId);
    line(`<< /Type /XObject /Subtype /Image /Width ${width} /Height ${height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${bytes.length} >>\nstream\n`);
    emit(bytes); line('\nendstream\n'); end();
    const stream = `q\n${p.drawW.toFixed(3)} 0 0 ${p.drawH.toFixed(3)} ${p.x.toFixed(3)} ${p.y.toFixed(3)} cm\n/Im0 Do\nQ\n`;
    begin(contentsId); line(`<< /Length ${encoder.encode(stream).length} >>\nstream\n${stream}endstream\n`); end();
    begin(pageId);
    line(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${p.paperW} ${p.paperH}] /Resources << /XObject << /Im0 ${imageId} 0 R >> >> /Contents ${contentsId} 0 R >>\n`);
    end();
    if (length > MAX_IMAGE_PDF_BYTES) throw new Error('PDF vượt quá giới hạn 20 MB. Hãy sử dụng ảnh nhỏ hơn.');
  }
  const xref = length;
  line(`xref\n0 ${offsets.length}\n0000000000 65535 f \n`);
  for (let id = 1; id < offsets.length; id++) line(`${String(offsets[id]).padStart(10, '0')} 00000 n \n`);
  line(`trailer\n<< /Size ${offsets.length} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`);
  if (length > MAX_IMAGE_PDF_BYTES) throw new Error('PDF vượt quá giới hạn 20 MB. Hãy sử dụng ảnh nhỏ hơn.');
  return new Blob(parts, { type: 'application/pdf' });
}

async function canvasJpeg(canvas: HTMLCanvasElement, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('Không thể mã hóa ảnh trang.')), 'image/jpeg', quality));
}

async function compressPage(file: File, budget: number): Promise<JpegPage> {
  const image = await createImageBitmap(file, { imageOrientation: 'from-image' });
  try {
    const sourceW = image.width, sourceH = image.height;
    if (!sourceW || !sourceH) throw new Error('Ảnh trang bị lỗi.');
    let scale = Math.min(1, Math.sqrt(MAX_PIXELS / (sourceW * sourceH)), 2800 / Math.max(sourceW, sourceH));
    for (let attempt = 0; attempt < 6; attempt++) {
      const width = Math.max(1, Math.round(sourceW * scale));
      const height = Math.max(1, Math.round(sourceH * scale));
      const canvas = document.createElement('canvas');
      canvas.width = width; canvas.height = height;
      const ctx = canvas.getContext('2d', { alpha: false });
      if (!ctx) throw new Error('Trình duyệt không hỗ trợ xử lý ảnh.');
      ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, width, height);
      ctx.drawImage(image, 0, 0, width, height);
      try {
        for (const quality of [0.91, 0.84, 0.76]) {
          const jpeg = await canvasJpeg(canvas, quality);
          if (jpeg.size <= budget) return { bytes: new Uint8Array(await jpeg.arrayBuffer()), width, height };
        }
      } finally { canvas.width = canvas.height = 1; }
      scale *= 0.82;
    }
    throw new Error('Không thể giảm ảnh xuống giới hạn dung lượng mà vẫn giữ chất lượng.');
  } finally { image.close(); }
}

/** Files stay on-device; each page is converted sequentially to bound memory use. */
export async function createPdfFromImages(files: readonly File[]): Promise<Blob> {
  validateImageFiles(files);
  const sorted = sortImagePages(files);
  const perPageBudget = Math.floor((MAX_IMAGE_PDF_BYTES - 8192 * (sorted.length + 1)) / sorted.length);
  const pages: JpegPage[] = [];
  for (const file of sorted) pages.push(await compressPage(file, perPageBudget));
  return pdfFromJpegPages(pages);
}
