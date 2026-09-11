export async function sanitizePhoto(file: File) {
  if (!(["image/jpeg", "image/png"].includes(file.type))) throw new Error("请选择 JPG 或 PNG 图片");
  if (file.size > 12 * 1024 * 1024) throw new Error("原图不能超过 12 MB");
  const bitmap = await createImageBitmap(file);
  try {
    return {
      canonical: await resize(bitmap, 1800, 0.86),
      thumbnail: await resize(bitmap, 480, 0.8),
    };
  } finally {
    bitmap.close();
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
  return new File([blob], "photo.jpg", { type: "image/jpeg" });
}
