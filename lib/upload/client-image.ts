import { cleanCanvasJpeg } from "./canvas-jpeg.ts";

export async function sanitizePhoto(file: File) {
  if (file.size > 12 * 1024 * 1024) throw new Error("原图不能超过 12 MB");
  const source = await normalizePhoto(file);
  const bitmap = await createImageBitmap(source);
  try {
    return {
      canonical: await resize(bitmap, 1800, 0.86),
      thumbnail: await resize(bitmap, 480, 0.8),
    };
  } finally {
    bitmap.close();
  }
}

export function isHeicCandidate(file: Pick<File, "name" | "type">) {
  return ["image/heic", "image/heif"].includes(file.type.toLowerCase()) || /\.(heic|heif)$/i.test(file.name);
}

async function normalizePhoto(file: File) {
  if (["image/jpeg", "image/png"].includes(file.type)) return file;
  if (!isHeicCandidate(file)) throw new Error("请选择 JPG、PNG、HEIC 或 HEIF 图片");
  try {
    const { heicTo } = await import("heic-to/csp");
    return await heicTo({ blob: file, type: "image/jpeg", quality: 0.92 });
  } catch {
    throw new Error("这张 HEIC/HEIF 照片无法转换，请换一张或在 iPhone 上导出为 JPEG");
  }
}

async function resize(source: ImageBitmap, maxEdge: number, quality: number) {
  const scale = Math.min(1, maxEdge / Math.max(source.width, source.height));
  const width = Math.max(1, Math.round(source.width * scale));
  const height = Math.max(1, Math.round(source.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("浏览器无法处理这张图片");
  context.drawImage(source, 0, 0, width, height);
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", quality));
  if (!blob) throw new Error("图片清理失败");
  return cleanCanvasJpeg(blob);
}
