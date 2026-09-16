import assert from "node:assert/strict";
import test from "node:test";
import { checkSanitizedImage, ImageValidationError } from "../lib/upload/image-validation.ts";

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

test("image diagnostics distinguish empty, format, metadata and truncated inputs", async () => {
  for (const [bytes, code] of [
    [[], "IMAGE_EMPTY"],
    [[1,2,3,4], "IMAGE_FORMAT"],
    [[255,216,255,225,0,2,255,217], "JPEG_APP1_METADATA"],
    [[255,216,255,237,0,2,255,217], "JPEG_APP13_METADATA"],
    [[255,216,255,254,0,2,255,217], "JPEG_COMMENT"],
    [[255,216,255,192,0,2,255,217], "JPEG_TRUNCATED"],
  ] as const) {
    await assert.rejects(checkSanitizedImage(new File([Uint8Array.from(bytes)], "photo.jpg")),
      (error: unknown) => error instanceof ImageValidationError && error.code === code);
  }
});

test("JPEG checks metadata after dimensions and between progressive scans", async () => {
  const header = [255,216,255,194,0,11,8,0,100,0,200,1,1,17,0];
  const scan = [255,218,0,2,7,255,0,8,255,208,9];
  for (const middle of [[], scan]) {
    for (const marker of [225,237,254]) {
      const bytes = Uint8Array.from([...header,...middle,255,marker,0,2,255,217]);
      await assert.rejects(checkSanitizedImage(new File([bytes], "metadata.jpg")), /EXIF/);
    }
  }
  const clean = Uint8Array.from([...header,...scan,...scan,255,217]);
  assert.equal((await checkSanitizedImage(new File([clean], "progressive.jpg"))).width, 200);
  for (const bytes of [clean.slice(0,-2), Uint8Array.from([...clean,1]), Uint8Array.from([...header,255])]) {
    await assert.rejects(checkSanitizedImage(new File([bytes], "truncated.jpg")), /不完整/);
  }
});

test("PNG requires IEND and rejects trailing or incomplete chunks", async () => {
  const signature = [137,80,78,71,13,10,26,10];
  const chunk = (name: string, data: number[]) => [0,0,0,data.length,...Array.from(name, c => c.charCodeAt(0)),...data,0,0,0,0];
  const header = [...signature,...chunk("IHDR", [0,0,0,1,0,0,0,1,8,2,0,0,0])];
  const complete = [...header,...chunk("IDAT", []),...chunk("IEND", [])];
  assert.equal((await checkSanitizedImage(new File([Uint8Array.from(complete)], "clean.png"))).width, 1);
  for (const bytes of [header, [...header,0], [...complete,1], complete.slice(0,-1)]) {
    await assert.rejects(checkSanitizedImage(new File([Uint8Array.from(bytes)], "bad.png")),
      (error: unknown) => error instanceof ImageValidationError && error.code === "PNG_TRUNCATED");
  }
});
