import test from "node:test";
import assert from "node:assert/strict";
import { BodyTooLargeError, InvalidBodyError, parseLimitedFormData, readLimitedText } from "../lib/http/read-limited-body.ts";

test("stops oversized streamed request bodies before fully buffering them", async () => {
  const request = new Request("https://example.test", { method: "POST", body: new ReadableStream({ start(controller) { controller.enqueue(new TextEncoder().encode("x".repeat(2049))); controller.close(); } }), duplex: "half" } as RequestInit);
  await assert.rejects(readLimitedText(request, 2048), BodyTooLargeError);
});

test("accepts a JSON body within the byte limit", async () => {
  const request = new Request("https://example.test", { method: "POST", body: '{"email":"a@example.com"}' });
  assert.equal(await readLimitedText(request, 2048), '{"email":"a@example.com"}');
});

test("rejects a declared oversized multipart body before parsing", async () => {
  const request = new Request("https://example.test", { method: "POST", headers: { "content-type": "multipart/form-data; boundary=test", "content-length": "101" }, body: "--test--\r\n" });
  await assert.rejects(parseLimitedFormData(request, 100), BodyTooLargeError);
});

test("rejects and cancels a lengthless multipart stream before parsing its malformed body", async () => {
  let cancelled = false;
  let chunks = 0;
  const body = new ReadableStream({ pull(controller) { chunks++; controller.enqueue(new Uint8Array(32)); }, cancel() { cancelled = true; } });
  const request = new Request("https://example.test", { method: "POST", headers: { "content-type": "multipart/form-data; boundary=test" }, body, duplex: "half" } as RequestInit);
  assert.equal(request.headers.has("content-length"), false);
  await assert.rejects(parseLimitedFormData(request, 64), BodyTooLargeError);
  assert.equal(cancelled, true);
  assert.ok(chunks <= 4, "Stop reading immediately after the byte budget is exceeded");
});

test("rejects multipart content larger than a false small length", async () => {
  const source = new FormData();
  source.set("value", "x".repeat(101));
  const original = new Request("https://example.test", { method: "POST", body: source });
  const request = new Request(original, { headers: { "content-type": original.headers.get("content-type")!, "content-length": "1" } });
  await assert.rejects(parseLimitedFormData(request, 100), BodyTooLargeError);
});

test("requires a valid multipart content type", async () => {
  const request = new Request("https://example.test", { method: "POST", headers: { "content-type": "application/json" }, body: "{}" });
  await assert.rejects(parseLimitedFormData(request, 100), InvalidBodyError);
});

test("parses a legitimate bounded multipart body", async () => {
  const source = new FormData();
  source.set("name", "couscous");
  const original = new Request("https://example.test", { method: "POST", body: source });
  const body = await original.arrayBuffer();
  const request = new Request("https://example.test", { method: "POST", headers: { "content-type": original.headers.get("content-type")!, "content-length": String(body.byteLength) }, body });
  const parsed = await parseLimitedFormData(request, 1024);
  assert.equal(parsed.get("name"), "couscous");
});

test("rejects excessive multipart parts", async () => {
  const boundary = "many";
  const fields = Array.from({ length: 33 }, (_, index) => `--${boundary}\r\nContent-Disposition: form-data; name="f${index}"\r\n\r\nx\r\n`).join("");
  const body = `${fields}--${boundary}--\r\n`;
  const request = new Request("https://example.test", { method: "POST", headers: { "content-type": `multipart/form-data; boundary=${boundary}`, "content-length": String(Buffer.byteLength(body)) }, body });
  await assert.rejects(parseLimitedFormData(request, 8192), (error: unknown) => error instanceof InvalidBodyError && error.status === 413);
});
