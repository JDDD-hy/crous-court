import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import { cleanCanvasJpeg } from "../lib/upload/canvas-jpeg.ts";
import { checkSanitizedImage, ImageValidationError } from "../lib/upload/image-validation.ts";

test("removes the APP1 metadata rejected by Safari uploads without changing encoded pixels", async () => {
  const jpeg = await readFile(new URL("../public/meals/couscous.jpg", import.meta.url));
  const metadata = Uint8Array.from([255,225,0,8,69,120,105,102,0,0,255,237,0,2,255,254,0,2]);
  const encoded = new Blob([jpeg.subarray(0, 2), metadata, jpeg.subarray(2)], { type: "image/jpeg" });
  await assert.rejects(checkSanitizedImage(new File([encoded], "photo.jpg")),
    (error: unknown) => error instanceof ImageValidationError && error.code === "JPEG_APP1_METADATA");
  const cleaned = await cleanCanvasJpeg(encoded);
  assert.deepEqual(new Uint8Array(await cleaned.arrayBuffer()), new Uint8Array(jpeg));
  await checkSanitizedImage(cleaned);
});

test("rejects a truncated encoder output", async () => {
  await assert.rejects(cleanCanvasJpeg(new Blob([Uint8Array.from([255,216,255,225,0,20])])), /不完整/);
});

test("removes metadata after scan data while retaining color markers and encoded pixels", async () => {
  const jpeg = await readFile(new URL("../public/meals/couscous.jpg", import.meta.url));
  const color = Uint8Array.from([255,238,0,2]);
  const metadata = Uint8Array.from([255,225,0,8,69,120,105,102,0,0]);
  const encoded = new Blob([jpeg.subarray(0, 2), color, jpeg.subarray(2, -2), metadata, jpeg.subarray(-2)]);
  const cleaned = await cleanCanvasJpeg(encoded);
  const expected = new Blob([jpeg.subarray(0, 2), color, jpeg.subarray(2)]);
  assert.deepEqual(new Uint8Array(await cleaned.arrayBuffer()), new Uint8Array(await expected.arrayBuffer()));
  await assert.rejects(cleanCanvasJpeg(new Blob([jpeg.subarray(0, -2)])), /不完整/);
});
