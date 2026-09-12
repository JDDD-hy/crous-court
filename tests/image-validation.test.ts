import assert from "node:assert/strict";
import test from "node:test";
import { checkSanitizedImage } from "../lib/upload/image-validation.ts";

test("accepts a metadata-free JPEG and reads dimensions", async () => {
  const bytes = Uint8Array.from([0xff,0xd8,0xff,0xc0,0x00,0x0b,0x08,0x00,0x64,0x00,0xc8,0x01,0x01,0x11,0x00,0xff,0xd9]);
  const result = await checkSanitizedImage(new File([bytes], "meal.jpg", { type: "image/jpeg" }));
  assert.deepEqual({ mediaType: result.mediaType, width: result.width, height: result.height }, { mediaType: "image/jpeg", width: 200, height: 100 });
});

test("accepts a browser-encoded JPEG with an APP14 color marker", async () => {
  const bytes = Uint8Array.from([0xff,0xd8,0xff,0xee,0x00,0x02,0xff,0xc0,0x00,0x0b,0x08,0x00,0x64,0x00,0xc8,0x01,0x01,0x11,0x00,0xff,0xd9]);
  const result = await checkSanitizedImage(new File([bytes], "canvas.jpg", { type: "image/jpeg" }));
  assert.equal(result.width, 200);
});

test("rejects JPEG EXIF even when the claimed MIME looks safe", async () => {
  const bytes = Uint8Array.from([0xff,0xd8,0xff,0xe1,0x00,0x02,0xff,0xd9]);
  await assert.rejects(checkSanitizedImage(new File([bytes], "meal.jpg", { type: "image/jpeg" })), /EXIF/);
});

test("rejects a non-image payload", async () => {
  await assert.rejects(checkSanitizedImage(new File(["not an image"], "meal.jpg", { type: "image/jpeg" })), /真实的 JPG/);
});
