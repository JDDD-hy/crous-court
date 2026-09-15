const MAX_BYTES = 8 * 1024 * 1024;
const MAX_PIXELS = 20_000_000;
const JPEG = "image/jpeg" as const;
const PNG = "image/png" as const;

export class ImageValidationError extends Error {
  readonly code: string;
  constructor(code: string, message: string) {
    super(message);
    this.name = "ImageValidationError";
    this.code = code;
  }
}

export type CheckedImage = {
  bytes: ArrayBuffer;
  mediaType: typeof JPEG | typeof PNG;
  width: number;
  height: number;
};

export async function checkSanitizedImage(file: File): Promise<CheckedImage> {
  if (file.size === 0) throw new ImageValidationError("IMAGE_EMPTY", "浏览器提交的图片为空，请重新选择照片");
  if (file.size > MAX_BYTES) throw new ImageValidationError("IMAGE_TOO_LARGE", "处理后的图片不能超过 8 MB");
  const bytes = await file.arrayBuffer().catch(() => { throw new ImageValidationError("IMAGE_READ_FAILED", "无法读取上传图片，请重新选择照片"); });
  const view = new DataView(bytes);
  const dimensions = isPng(view) ? readPng(view) : isJpeg(view) ? readJpeg(view) : null;
  if (!dimensions) throw new ImageValidationError("IMAGE_FORMAT", "只接受真实的 JPG 或 PNG 图片，浏览器转换后的文件格式不正确");
  if (dimensions.width * dimensions.height > MAX_PIXELS) throw new ImageValidationError("IMAGE_PIXELS", "图片像素不能超过 2000 万");
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
  let ended = false;
  while (offset + 12 <= view.byteLength) {
    const length = view.getUint32(offset);
    const type = String.fromCharCode(...new Uint8Array(view.buffer, offset + 4, 4));
    if (offset + 12 + length > view.byteLength) throw new ImageValidationError("PNG_TRUNCATED", "PNG 文件不完整，请重新选择照片");
    if (!allowed.has(type)) throw new ImageValidationError("PNG_METADATA", "浏览器处理后的 PNG 仍含附加数据，未通过隐私校验");
    if (type === "IHDR") {
      if (length !== 13 || offset !== 8) throw new ImageValidationError("PNG_TRUNCATED", "PNG 尺寸信息不完整");
      width = view.getUint32(offset + 8);
      height = view.getUint32(offset + 12);
    }
    offset += 12 + length;
    if (type === "IEND") {
      if (length !== 0 || offset !== view.byteLength) throw new ImageValidationError("PNG_TRUNCATED", "PNG 文件含无效尾部数据");
      ended = true;
      break;
    }
  }
  if (!ended || offset !== view.byteLength) throw new ImageValidationError("PNG_TRUNCATED", "PNG 文件不完整，请重新选择照片");
  if (!width || !height) throw new ImageValidationError("PNG_DIMENSIONS", "无法读取 PNG 尺寸");
  return { mediaType: PNG, width, height };
}

function isJpeg(view: DataView) {
  return view.byteLength >= 4 && view.getUint16(0) === 0xffd8;
}

function readJpeg(view: DataView) {
  const bytes = new Uint8Array(view.buffer, view.byteOffset, view.byteLength);
  const invalid = () => new ImageValidationError("JPEG_TRUNCATED", "JPEG 文件不完整，请重新选择照片");
  let offset = 2;
  let width = 0;
  let height = 0;
  while (offset < bytes.length) {
    if (bytes[offset++] !== 0xff) throw new ImageValidationError("JPEG_STRUCTURE", "浏览器处理后的 JPEG 文件结构无效");
    while (bytes[offset] === 0xff) offset++;
    const marker = bytes[offset++];
    if (marker === 0xd9) {
      if (offset !== bytes.length) throw invalid();
      if (!width || !height) throw new ImageValidationError("JPEG_DIMENSIONS", "无法读取 JPEG 尺寸");
      return { mediaType: JPEG, width, height };
    }
    if (marker === undefined || marker === 0 || marker === 0xd8 || (marker >= 0xd0 && marker <= 0xd7)) throw invalid();
    if (marker === 0x01) continue;
    if (offset + 2 > bytes.length) throw invalid();
    const length = view.getUint16(offset);
    if (length < 2 || offset + length > view.byteLength) throw new ImageValidationError("JPEG_TRUNCATED", "JPEG 文件不完整，请重新选择照片");
    if (marker === 0xe1 || marker === 0xed || marker === 0xfe) {
      throw new ImageValidationError(marker === 0xe1 ? "JPEG_APP1_METADATA" : marker === 0xed ? "JPEG_APP13_METADATA" : "JPEG_COMMENT", "浏览器处理后的图片仍含 EXIF 或注释元数据，未通过隐私校验");
    }
    if ([0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf].includes(marker)) {
      if (width || height) throw invalid();
      if (length < 8) throw new ImageValidationError("JPEG_TRUNCATED", "JPEG 尺寸信息不完整");
      height = view.getUint16(offset + 3);
      width = view.getUint16(offset + 5);
      if (!width || !height) throw new ImageValidationError("JPEG_DIMENSIONS", "无法读取 JPEG 尺寸");
    }
    offset += length;
    if (marker === 0xda) {
      // Match the Canvas sanitizer: skip escaped entropy and restart markers,
      // then inspect every subsequent segment, including progressive scans.
      while (offset < bytes.length) {
        if (bytes[offset] !== 0xff) { offset++; continue; }
        let next = offset + 1;
        while (bytes[next] === 0xff) next++;
        if (bytes[next] === 0 || (bytes[next] >= 0xd0 && bytes[next] <= 0xd7)) { offset = next + 1; continue; }
        break;
      }
    }
  }
  throw invalid();
}
