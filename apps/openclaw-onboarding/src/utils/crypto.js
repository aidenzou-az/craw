import { HOST_SIGNATURE_SECRET } from "../constants.js";

const encoder = new TextEncoder();

async function sha256Hex(input) {
  const bytes = encoder.encode(input);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(digest)]
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

export async function signHostPayload({
  method,
  path,
  timestamp,
  nonce,
  body,
}) {
  const normalizedBody =
    typeof body === "string" ? body : JSON.stringify(body ?? {});
  const bodyHash = await sha256Hex(normalizedBody);
  return sha256Hex(
    [
      method.toUpperCase(),
      path,
      String(timestamp),
      nonce,
      bodyHash,
      HOST_SIGNATURE_SECRET,
    ].join(":"),
  );
}

export async function randomToken(prefix = "otk") {
  const seed = `${prefix}:${Date.now()}:${crypto.randomUUID()}`;
  const hash = await sha256Hex(seed);
  return `${prefix}_${hash.slice(0, 24)}`;
}
