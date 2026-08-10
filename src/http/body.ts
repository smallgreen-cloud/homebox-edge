import { InvalidRequestError, PayloadTooLargeError } from "../errors";

export const MAX_STANDARD_JSON_BYTES = 64 * 1024;
export const MAX_CSV_REQUEST_BYTES = 12 * 1024 * 1024;

export async function readJsonBody(
  request: Request,
  maximumBytes = MAX_STANDARD_JSON_BYTES,
): Promise<unknown> {
  const declaredLength = Number(request.headers.get("Content-Length"));
  if (Number.isFinite(declaredLength) && declaredLength > maximumBytes) {
    throw new PayloadTooLargeError("Request body is too large");
  }

  if (!request.body) throw new InvalidRequestError("Request body must be JSON");
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let totalBytes = 0;

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    totalBytes += value.byteLength;
    if (totalBytes > maximumBytes) {
      await reader.cancel();
      throw new PayloadTooLargeError("Request body is too large");
    }
    chunks.push(value);
  }

  const body = new Uint8Array(totalBytes);
  let offset = 0;
  for (const chunk of chunks) {
    body.set(chunk, offset);
    offset += chunk.byteLength;
  }

  try {
    return JSON.parse(new TextDecoder().decode(body));
  } catch {
    throw new InvalidRequestError("Request body must be valid JSON");
  }
}
