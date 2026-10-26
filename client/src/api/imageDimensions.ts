/**
 * Inspect encoded image headers BEFORE decoding into a canvas. Compressed files
 * can otherwise expand to hundreds of megabytes on low-memory mobile devices.
 * Only bounded PNG/JPEG/WebP headers are supported; malformed inputs fail closed.
 */
export const MAX_SOURCE_IMAGE_PIXELS = 24_000_000;
const HEADER_BYTES = 256 * 1024;

export interface ImageDimensions { width: number; height: number }
const fail = (): never => { throw new Error('Ảnh không hợp lệ hoặc không đọc được kích thước.'); };
const read16be = (b: Uint8Array, i: number) => b[i]! * 256 + b[i + 1]!;
const read16le = (b: Uint8Array, i: number) => b[i]! + b[i + 1]! * 256;
const read32be = (b: Uint8Array, i: number) =>
  ((b[i]! * 0x1000000) + (b[i+1]! << 16) + (b[i+2]! << 8) + b[i+3]!) >>> 0;
const name = (b: Uint8Array, i: number, value: string) =>
  [...value].every((ch, index) => b[i+index] === ch.charCodeAt(0));

export function encodedImageDimensions(b: Uint8Array, mime: string): ImageDimensions {
  if (mime === 'image/png') {
    if (b.length < 24 || ![137,80,78,71,13,10,26,10].every((v,i) => b[i] === v) ||
      read32be(b,8) !== 13 || !name(b,12,'IHDR')) return fail();
    return checked(read32be(b,16),read32be(b,20));
  }
  if (mime === 'image/jpeg') {
    if (b.length < 4 || b[0] !== 0xff || b[1] !== 0xd8) return fail();
    let i = 2;
    while (i + 3 < b.length) {
      if (b[i++] !== 0xff) return fail();
      while (i < b.length && b[i] === 0xff) i++;
      if (i >= b.length) return fail();
      const marker = b[i++]!;
      // SOS (compressed data), EOI and RST markers cannot provide dimensions.
      if (marker === 0xd9 || marker === 0xda) return fail();
      if (marker === 0x01 || marker === 0xd8 || (marker >= 0xd0 && marker <= 0xd7)) continue;
      if (i + 2 > b.length) return fail();
      const length = read16be(b,i);
      if (length < 2 || i + length > b.length) return fail();
      const sof = (marker >= 0xc0 && marker <= 0xcf) &&
        ![0xc4,0xc8,0xcc].includes(marker);
      if (sof) {
        if (length < 7) return fail();
        return checked(read16be(b,i+5),read16be(b,i+3));
      }
      i += length;
    }
    return fail();
  }
  if (mime === 'image/webp') {
    if (b.length < 30 || !name(b,0,'RIFF') || !name(b,8,'WEBP')) return fail();
    if (name(b,12,'VP8X')) {
      if (b.length < 30) return fail();
      const w=1+b[24]!+(b[25]!<<8)+(b[26]!<<16);
      const h=1+b[27]!+(b[28]!<<8)+(b[29]!<<16);
      return checked(w,h);
    }
    if (name(b,12,'VP8 ')) {
      if (b[23]!==0x9d || b[24]!==0x01 || b[25]!==0x2a) return fail();
      return checked(read16le(b,26)&0x3fff,read16le(b,28)&0x3fff);
    }
    if (name(b,12,'VP8L')) {
      if (b[20]!==0x2f) return fail();
      const w=1+(b[21]!|((b[22]!&0x3f)<<8));
      const h=1+((b[22]!>>6)|(b[23]!<<2)|((b[24]!&0x0f)<<10));
      return checked(w,h);
    }
    return fail();
  }
  return fail();
}

function checked(width: number, height: number): ImageDimensions {
  if (!Number.isSafeInteger(width) || !Number.isSafeInteger(height) ||
    width < 1 || height < 1 || width * height > MAX_SOURCE_IMAGE_PIXELS) {
    throw new Error('Ảnh vượt giới hạn 24 triệu điểm ảnh; hãy giảm độ phân giải trước khi chọn.');
  }
  return {width,height};
}

/** The browser File object is read only up to 256 KiB and is not uploaded. */
export async function inspectImageFile(file: Blob): Promise<ImageDimensions> {
  const type = file.type;
  if (!['image/jpeg','image/png','image/webp'].includes(type))
    throw new Error('Chỉ hỗ trợ ảnh JPG, PNG hoặc WebP.');
  const bytes = new Uint8Array(await file.slice(0,HEADER_BYTES).arrayBuffer());
  return encodedImageDimensions(bytes,type);
}
