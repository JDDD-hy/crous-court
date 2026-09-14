import { checkSanitizedImage, ImageValidationError } from "./image-validation.ts";

// Only use after Canvas has decoded orientation and re-encoded the pixels.
// Safari's encoder can add APP1 again; re-encoding alone is not metadata removal.
export async function cleanCanvasJpeg(blob: Blob): Promise<File> {
  if (!blob.size || blob.size > 8 * 1024 * 1024) throw new ImageValidationError("IMAGE_TOO_LARGE", "图片清理失败：编码结果为空或超过 8 MB");
  const bytes = new Uint8Array(await blob.arrayBuffer());
  const view = new DataView(bytes.buffer);
  const invalid = () => new ImageValidationError("JPEG_TRUNCATED", "浏览器输出的 JPEG 文件不完整，请重新选择照片");
  if (bytes.length < 4 || view.getUint16(0) !== 0xffd8) throw new ImageValidationError("IMAGE_FORMAT", "浏览器未能将照片转换为 JPEG");
  const parts: BlobPart[] = [];
  let offset = 2;
  let keepFrom = 0;
  while (offset < bytes.length) {
    const start = offset;
    if (bytes[offset++] !== 0xff) throw invalid();
    while (bytes[offset] === 0xff) offset++;
    const marker = bytes[offset++];
    if (marker === 0xd9) {
      parts.push(bytes.slice(keepFrom, offset));
      const file = new File(parts, "photo.jpg", { type: "image/jpeg" });
      await checkSanitizedImage(file);
      return file;
    }
    if (marker === undefined || marker === 0 || marker === 0xd8 || (marker >= 0xd0 && marker <= 0xd7)) throw invalid();
    if (marker === 0x01) continue;
    if (offset + 2 > bytes.length) throw invalid();
    const length = view.getUint16(offset);
    if (length < 2 || offset + length > bytes.length) throw invalid();
    offset += length;
    if (marker === 0xe1 || marker === 0xed || marker === 0xfe) {
      parts.push(bytes.slice(keepFrom, start));
      keepFrom = offset;
    }
    if (marker === 0xda) {
      // Entropy bytes use FF00 escaping and may contain restart markers.
      // Continue parsing at the next real marker, including progressive scans.
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
