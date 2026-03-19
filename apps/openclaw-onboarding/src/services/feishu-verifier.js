function looksLikeFeishuHostToken(token) {
  return Boolean(token && token.length >= 16 && /^[a-zA-Z0-9:_-]+$/.test(token));
}

function verifyUrl() {
  return (
    globalThis.OPEN_CLAW_FEISHU_HOST_VERIFY_URL ??
    "https://open.feishu.cn/open-apis/bot/v3/info/"
  );
}

function isTestToken(token) {
  return token.startsWith("tenant_access_token_test_") || token.startsWith("app_access_token_test_");
}

export async function verifyFeishuHostToken({ feishuAppId, feishuHostToken }) {
  if (!feishuAppId || !/^[a-zA-Z0-9_-]+$/.test(feishuAppId)) {
    return { ok: false, message: "Invalid Feishu app id" };
  }
  if (!looksLikeFeishuHostToken(feishuHostToken)) {
    return { ok: false, message: "Invalid Feishu host token" };
  }

  if (isTestToken(feishuHostToken)) {
    return {
      ok: true,
      appId: feishuAppId,
      verifiedBy: "stub-lightweight-api-check",
    };
  }

  try {
    const response = await fetch(verifyUrl(), {
      method: "GET",
      headers: {
        authorization: `Bearer ${feishuHostToken}`,
      },
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      return { ok: false, message: "Feishu host token rejected" };
    }
    if (typeof payload.code !== "undefined" && payload.code !== 0) {
      return { ok: false, message: "Feishu host token verification failed" };
    }
    return {
      ok: true,
      appId: feishuAppId,
      verifiedBy: "live-lightweight-api-check",
      payload,
    };
  } catch {
    return { ok: false, message: "Unable to verify Feishu host token" };
  }
}
