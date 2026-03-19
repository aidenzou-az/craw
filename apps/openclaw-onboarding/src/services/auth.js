function normalizeAuthHeader(headers) {
  return headers.authorization ?? headers.Authorization ?? "";
}

export async function verifyHostRequest({ req, body, repo }) {
  const hostId = req.headers["x-host-id"];
  if (!hostId) {
    return { ok: false, code: "UNAUTHORIZED", message: "Missing host id" };
  }

  const auth = normalizeAuthHeader(req.headers ?? {});
  if (!auth.startsWith("Bearer ")) {
    return { ok: false, code: "UNAUTHORIZED", message: "Missing host access token" };
  }
  const hostAccessToken = auth.slice("Bearer ".length);

  const timestamp = req.headers["x-host-timestamp"];
  const nonce = req.headers["x-host-nonce"];
  if (!timestamp || !nonce) {
    return { ok: false, code: "INVALID_REQUEST", message: "Missing host timestamp or nonce" };
  }

  const now = Date.now();
  if (Math.abs(now - Number(timestamp) * 1000) > 5 * 60 * 1000) {
    return { ok: false, code: "FORBIDDEN", message: "Timestamp out of window" };
  }

  if (!(await repo.consumeNonce(`host:${nonce}`))) {
    return { ok: false, code: "INVALID_NONCE", message: "Nonce already used" };
  }

  const host = await repo.getHostById(hostId);
  if (!host || host.status !== "active") {
    return { ok: false, code: "HOST_NOT_REGISTERED", message: "Host is not registered" };
  }
  if (hostAccessToken !== host.hostAccessToken) {
    return { ok: false, code: "UNAUTHORIZED", message: "Invalid host access token" };
  }

  if (body.open_claw_id !== host.openClawId) {
    return { ok: false, code: "FORBIDDEN", message: "Open Claw does not match host binding" };
  }

  const benefit = await repo.getBenefit(body.user_id);
  if (!benefit || !benefit.enabled) {
    return { ok: false, code: "BENEFIT_NOT_FOUND", message: "Benefit not found" };
  }
  if (benefit.ownerUnionId && host.ownerUnionId && benefit.ownerUnionId !== host.ownerUnionId) {
    return { ok: false, code: "HOST_IDENTITY_MISMATCH", message: "Host owner union_id mismatch" };
  }
  if (!benefit.ownerUnionId && benefit.ownerOpenId && benefit.ownerOpenId !== host.ownerOpenId) {
    return { ok: false, code: "HOST_IDENTITY_MISMATCH", message: "Host owner open_id mismatch" };
  }

  return { ok: true, userId: body.user_id, hostId };
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
