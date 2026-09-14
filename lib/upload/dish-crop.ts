type Region = { x: number; y: number; width: number; height: number };

export function drawDishCrop(canvas: HTMLCanvasElement, image: HTMLImageElement, region: Region) {
  const { naturalWidth: width, naturalHeight: height } = image;
  if (![width, height, region.x, region.y, region.width, region.height].every(Number.isFinite)
    || width <= 0 || height <= 0 || region.x < 0 || region.y < 0
    || region.width <= 0 || region.height <= 0
    || region.x + region.width > 1 || region.y + region.height > 1) {
    throw new Error("无法生成菜品局部图：区域坐标无效");
  }
  const cropWidth = width * region.width;
  const cropHeight = height * region.height;
  const scale = Math.min(1, 576 / Math.max(cropWidth, cropHeight));
  canvas.width = Math.max(1, Math.round(cropWidth * scale));
  canvas.height = Math.max(1, Math.round(cropHeight * scale));
  const context = canvas.getContext("2d");
  if (!context) throw new Error("浏览器无法生成菜品局部图");
  context.drawImage(image, width * region.x, height * region.y, cropWidth, cropHeight,
    0, 0, canvas.width, canvas.height);
}
