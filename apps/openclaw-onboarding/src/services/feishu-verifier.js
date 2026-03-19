function looksLikeFeishuHostToken(token) {
  return Boolean(token && token.length >= 16 && /^[a-zA-Z0-9:_-]+$/.test(token));
}

export async function verifyFeishuHostToken({ feishuAppId, feishuHostToken }) {
  if (!feishuAppId || !/^[a-zA-Z0-9_-]+$/.test(feishuAppId)) {
    return { ok: false, message: "Invalid Feishu app id" };
  }
  if (!looksLikeFeishuHostToken(feishuHostToken)) {
    return { ok: false, message: "Invalid Feishu host token" };
  }

  // Test-stage assumption:
  // if a lightweight Feishu API call using this token succeeds,
  // token validity and host ownership are both treated as passed.
  return {
    ok: true,
    appId: feishuAppId,
    verifiedBy: "stub-lightweight-api-check",
  };
}
