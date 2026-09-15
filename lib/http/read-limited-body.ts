export class BodyTooLargeError extends Error {}
export class InvalidBodyError extends Error {
  status: number;
  constructor(message: string, status = 400) { super(message); this.status = status; }
}

export async function readLimitedText(request: Request, maxBytes: number) {
  return new TextDecoder().decode(await readLimitedBytes(request, maxBytes));
}

export async function readLimitedBytes(request: Request, maxBytes: number) {
  const declared = request.headers.get("content-length");
  if (declared && (!/^\d+$/.test(declared) || Number(declared) > maxBytes)) throw new BodyTooLargeError();
  if (!request.body) return new Uint8Array();
  const reader = request.body.getReader();
  let size = 0;
  const chunks: Uint8Array[] = [];
  while (true) {
    const { done, value } = await reader.read();
    if (done) {
      const bytes = new Uint8Array(size);
      let offset = 0;
      for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
      return bytes;
    }
    size += value.byteLength;
    if (size > maxBytes) {
      await reader.cancel();
      throw new BodyTooLargeError();
    }
    chunks.push(value);
  }
}

export async function parseLimitedFormData(request: Request, maxBytes: number) {
  const contentType = request.headers.get("content-type") ?? "";
  const declared = request.headers.get("content-length");
  if (declared && (!/^\d+$/.test(declared) || Number(declared) > maxBytes)) throw new BodyTooLargeError();
  const boundaryMatch = contentType.match(/(?:^|;)\s*boundary=("[^"]+"|[^;\s]+)/i);
  if (!/^multipart\/form-data\s*;/i.test(contentType) || !boundaryMatch) {
    await discardLimitedBytes(request, maxBytes);
    throw new InvalidBodyError("请求必须使用 multipart/form-data", 415);
  }
  const boundary = boundaryMatch[1].replace(/^"|"$/g, "");
  if (!boundary || boundary.length > 70) {
    await discardLimitedBytes(request, maxBytes);
    throw new InvalidBodyError("multipart boundary 无效");
  }
  let form: FormData;
  // Count actual bytes before invoking the multipart parser, even without Content-Length.
  const bytes = await readLimitedBytes(request, maxBytes);
  try { form = await new Response(bytes, { headers: { "content-type": contentType } }).formData(); }
  catch { throw new InvalidBodyError("multipart 请求格式无效"); }
  let parts = 0;
  let contentBytes = 0;
  for (const [, value] of form) {
    if (++parts > 32) throw new InvalidBodyError("multipart 分段过多", 413);
    contentBytes += typeof value === "string" ? new TextEncoder().encode(value).byteLength : value.size;
    if (contentBytes > maxBytes) throw new BodyTooLargeError();
  }
  return form;
}

async function discardLimitedBytes(request: Request, maxBytes: number) {
  if (!request.body) return;
  const reader = request.body.getReader();
  let size = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) return;
    size += value.byteLength;
    if (size > maxBytes) { await reader.cancel(); throw new BodyTooLargeError(); }
  }
}
