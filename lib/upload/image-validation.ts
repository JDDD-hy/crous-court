const MAX_BYTES = 8 * 1024 * 1024;
const MAX_PIXELS = 20_000_000;
const JPEG = "image/jpeg";
const PNG = "image/png";

export type CheckedImage = {
  bytes: ArrayBuffer;
  mediaType: typeof JPEG | typeof PNG;
  width: number;
  height: number;
};

export async function checkSanitizedImage(file: File): Promise<CheckedImage> {
  if (file.size === 0 || file.size > MAX_BYTES) throw new Error("图片必须小于 8 MB");
  const bytes = await file.arrayBuffer();
  const view = new DataView(bytes);
  const dimensions = isPng(view) ? readPng(view) : isJpeg(view) ? readJpeg(view) : null;
  if (!dimensions) throw new Error("只接受真实的 JPG 或 PNG 图片");
  if (dimensions.width * dimensions.height > MAX_PIXELS) throw new Error("图片像素不能超过 2000 万");
  return { bytes, ...dimensions };
}

function isPng(view: DataView) {
  return view.byteLength >= 24 && view.getUint32(0) === 0x89504e47 && view.getUint32(4) === 0x0d0a1a0a;
}

function readPng(view: DataView) {
  const allowed = new Set(["IHDR", "IDAT", "IEND"]);
  let offset = 8;
  let width = 0;
  let height = 0;
  while (offset + 12 <= view.byteLength) {
    const length = view.getUint32(offset);
    const type = String.fromCharCode(...new Uint8Array(view.buffer, offset + 4, 4));
    if (offset + 12 + length > view.byteLength) throw new Error("PNG 文件不完整");
    if (!allowed.has(type)) throw new Error("图片仍含元数据，请重新选择后再试");
    if (type === "IHDR") {
      width = view.getUint32(offset + 8);
      height = view.getUint32(offset + 12);
    }
    offset += 12 + length;
  }
  if (!width || !height) throw new Error("无法读取 PNG 尺寸");
  return { mediaType: PNG as const, width, height };
}

function isJpeg(view: DataView) {
  return view.byteLength >= 4 && view.getUint16(0) === 0xffd8;
}

function readJpeg(view: DataView) {
  let offset = 2;
  while (offset + 4 <= view.byteLength) {
    if (view.getUint8(offset) !== 0xff) throw new Error("JPEG 文件结构无效");
    const marker = view.getUint8(offset + 1);
    offset += 2;
    if (marker === 0xd9 || marker === 0xda) break;
    const length = view.getUint16(offset);
    if (length < 2 || offset + length > view.byteLength) throw new Error("JPEG 文件不完整");
    if ((marker >= 0xe1 && marker <= 0xef) || marker === 0xfe) {
      throw new Error("图片仍含 EXIF 或注释元数据，请重新选择后再试");
    }
    if ([0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf].includes(marker)) {
      const height = view.getUint16(offset + 3);
      const width = view.getUint16(offset + 5);
      if (!width || !height) throw new Error("无法读取 JPEG 尺寸");
      return { mediaType: JPEG as const, width, height };
    }
    offset += length;
  }
  throw new Error("无法读取 JPEG 尺寸");
}
