import { signHostPayload } from "../utils/crypto.js";

function normalizeAuthHeader(headers) {
  return headers.authorization ?? headers.Authorization ?? "";
}

export async function signHostRequest({ method, path, timestamp, nonce, body }) {
  return signHostPayload({ method, path, timestamp, nonce, body });
}

export async function verifyHostRequest({ req, body, repo, expectedPath }) {
  const auth = normalizeAuthHeader(req.headers ?? {});
  if (!auth.startsWith("Bearer ")) {
    return { ok: false, code: "UNAUTHORIZED", message: "Missing host token" };
  }
  const hostToken = auth.slice("Bearer ".length);
  const [prefix, userId] = hostToken.split(":");
  if (prefix !== "feishu-user" || !userId) {
    return { ok: false, code: "UNAUTHORIZED", message: "Invalid host token" };
  }

  const timestamp = req.headers["x-host-timestamp"];
  const nonce = req.headers["x-host-nonce"];
  const signature = req.headers["x-host-signature"];

  if (!timestamp || !nonce || !signature) {
    return { ok: false, code: "INVALID_SIGNATURE", message: "Missing host signature headers" };
  }

  const now = Date.now();
  if (Math.abs(now - Number(timestamp) * 1000) > 5 * 60 * 1000) {
    return { ok: false, code: "FORBIDDEN", message: "Timestamp out of window" };
  }

  if (!(await repo.consumeNonce(`host:${nonce}`))) {
    return { ok: false, code: "INVALID_NONCE", message: "Nonce already used" };
  }

  const expectedSignature = await signHostRequest({
    method: req.method,
    path: expectedPath,
    timestamp,
    nonce,
    body,
  });
  if (signature !== expectedSignature) {
    return { ok: false, code: "INVALID_SIGNATURE", message: "Signature mismatch" };
  }

  if (body.user_id !== userId) {
    return { ok: false, code: "FORBIDDEN", message: "Host token user mismatch" };
  }

  return { ok: true, userId };
}

export async function verifyOnboardingToken({ req, repo }) {
  const auth = normalizeAuthHeader(req.headers ?? {});
  if (!auth.startsWith("Bearer ")) {
    return { ok: false, code: "UNAUTHORIZED", message: "Missing onboarding token" };
  }
  const token = auth.slice("Bearer ".length);
  const record = await repo.getToken(token);
  if (!record || record.revoked) {
    return { ok: false, code: "UNAUTHORIZED", message: "Invalid token" };
  }
  if (new Date(record.expiresAt).getTime() <= Date.now()) {
    return { ok: false, code: "TOKEN_EXPIRED", message: "Token expired" };
  }
  return { ok: true, token, record };
}
