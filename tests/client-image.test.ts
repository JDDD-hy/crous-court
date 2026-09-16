import assert from "node:assert/strict";
import test from "node:test";
import { isHeicCandidate } from "../lib/upload/client-image.ts";

test("detects iPhone HEIC and HEIF uploads by MIME type or extension", () => {
  assert.equal(isHeicCandidate({ name: "IMG_0042.HEIC", type: "" }), true);
  assert.equal(isHeicCandidate({ name: "photo", type: "image/heif" }), true);
  assert.equal(isHeicCandidate({ name: "photo.jpg", type: "image/jpeg" }), false);
});
