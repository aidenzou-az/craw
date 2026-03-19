export function jsonResponse(status, payload) {
  return {
    status,
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
  };
}

export function ok(data) {
  return jsonResponse(200, { success: true, data });
}

export function fail(status, code, message, extra = {}) {
  return jsonResponse(status, {
    success: false,
    error: { code, message, ...extra },
  });
}

export function parseJsonBody(req) {
  if (!req.body) {
    return {};
  }
  if (typeof req.body === "object") {
    return req.body;
  }
  return JSON.parse(req.body);
}
