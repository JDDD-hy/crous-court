import assert from "node:assert/strict";
import test from "node:test";
import { drawDishCrop } from "../lib/upload/dish-crop.ts";

test("draws only the selected source rectangle, not the whole tray", () => {
  const calls: unknown[][] = [];
  const canvas = { width: 0, height: 0, getContext: () => ({ drawImage: (...args: unknown[]) => calls.push(args) }) };
  const image = { naturalWidth: 1800, naturalHeight: 1200 };
  drawDishCrop(canvas as unknown as HTMLCanvasElement, image as HTMLImageElement,
    { x: 0.25, y: 0.5, width: 0.5, height: 0.25 });
  assert.deepEqual(calls, [[image, 450, 600, 900, 300, 0, 0, 576, 192]]);
  assert.equal(canvas.width, 576);
  assert.equal(canvas.height, 192);
});

test("rejects out-of-image coordinates rather than showing a misleading whole tray", () => {
  const image = { naturalWidth: 1200, naturalHeight: 1800 } as HTMLImageElement;
  assert.throws(() => drawDishCrop({} as HTMLCanvasElement, image,
    { x: 0.8, y: 0, width: 0.5, height: 1 }), /坐标无效/);
});
