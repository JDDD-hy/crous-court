import test from "node:test";
import assert from "node:assert/strict";
import { BodyTooLargeError, readLimitedText } from "../lib/http/read-limited-body.ts";

test("stops oversized streamed request bodies before fully buffering them", async () => {
  const request = new Request("https://example.test", { method: "POST", body: new ReadableStream({ start(controller) { controller.enqueue(new TextEncoder().encode("x".repeat(2049))); controller.close(); } }), duplex: "half" } as RequestInit);
  await assert.rejects(readLimitedText(request, 2048), BodyTooLargeError);
});

test("accepts a JSON body within the byte limit", async () => {
  const request = new Request("https://example.test", { method: "POST", body: '{"email":"a@example.com"}' });
  assert.equal(await readLimitedText(request, 2048), '{"email":"a@example.com"}');
});
