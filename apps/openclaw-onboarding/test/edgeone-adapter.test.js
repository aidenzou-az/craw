import test from "node:test";
import assert from "node:assert/strict";
import { dispatchEdgeOne } from "../src/edgeone/adapter.js";
import { MemoryKvBinding } from "../src/store/memory-kv.js";

const FEISHU_APP_ID = "cli_test_app";
const FEISHU_HOST_TOKEN = "tenant_access_token_test_123";

async function registerHost(kv) {
  const response = await dispatchEdgeOne(
    {
      request: new Request("https://example.com/api/open-claw/host-register", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          user_id: "u_123",
          open_claw_id: "oc_123",
          owner_open_id: "ou_123",
          owner_union_id: "un_123",
          feishu_app_id: FEISHU_APP_ID,
          feishu_host_token: FEISHU_HOST_TOKEN,
        }),
      }),
      env: { ONBOARDING_KV: kv },
    },
    "/api/open-claw/host-register",
  );
  const payload = await response.json();
  return {
    hostId: payload.data.host_id,
    hostAccessToken: payload.data.host_access_token,
  };
}

test("edgeone adapter converts request to onboarding redeem response", async () => {
  const kv = new MemoryKvBinding();
  const { hostId, hostAccessToken } = await registerHost(kv);
  const body = JSON.stringify({
    user_id: "u_123",
    open_claw_id: "oc_123",
    benefit_code: "feishu_lazy_pack_onboarding",
  });
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const nonce = `nonce_${Math.random().toString(16).slice(2)}`;

  const response = await dispatchEdgeOne(
    {
      request: new Request("https://example.com/api/open-claw/onboarding-redeem", {
        method: "POST",
        headers: {
          authorization: `Bearer ${hostAccessToken}`,
          "x-host-id": hostId,
          "x-host-timestamp": timestamp,
          "x-host-nonce": nonce,
          "content-type": "application/json",
        },
        body,
      }),
      env: { ONBOARDING_KV: kv },
    },
    "/api/open-claw/onboarding-redeem",
  );

  assert.equal(response.status, 200);
  const payload = await response.json();
  assert.equal(payload.success, true);
  assert.equal(payload.data.redeemed, true);
});

test("edgeone adapter returns structured 503 when KV binding is missing", async () => {
  const response = await dispatchEdgeOne(
    {
      request: new Request("https://example.com/api/open-claw/onboarding-status", {
        method: "GET",
      }),
      env: {},
    },
    "/api/open-claw/onboarding-status",
  );

  assert.equal(response.status, 503);
  const payload = await response.json();
  assert.equal(payload.success, false);
  assert.equal(payload.error.code, "SERVICE_MISCONFIGURED");
});

test("edgeone adapter can read KV binding from global scope fallback", async () => {
  const kv = new MemoryKvBinding();
  globalThis.ONBOARDING_KV = kv;
  const { hostId, hostAccessToken } = await registerHost(kv);

  const body = JSON.stringify({
    user_id: "u_123",
    open_claw_id: "oc_123",
    benefit_code: "feishu_lazy_pack_onboarding",
  });
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const nonce = `nonce_${Math.random().toString(16).slice(2)}`;

  try {
    const response = await dispatchEdgeOne(
      {
        request: new Request("https://example.com/api/open-claw/onboarding-redeem", {
          method: "POST",
          headers: {
            authorization: `Bearer ${hostAccessToken}`,
            "x-host-id": hostId,
            "x-host-timestamp": timestamp,
            "x-host-nonce": nonce,
            "content-type": "application/json",
          },
          body,
        }),
      },
      "/api/open-claw/onboarding-redeem",
    );

    assert.equal(response.status, 200);
    const payload = await response.json();
    assert.equal(payload.success, true);
  } finally {
    delete globalThis.ONBOARDING_KV;
  }
});

test("edgeone adapter serves debug console route", async () => {
  const kv = new MemoryKvBinding();
  await registerHost(kv);

  const response = await dispatchEdgeOne(
    {
      request: new Request(
        "https://example.com/api/open-claw/debug-console?open_claw_id=oc_123",
        {
          method: "GET",
        },
      ),
      env: { ONBOARDING_KV: kv },
    },
    "/api/open-claw/debug-console",
  );

  assert.equal(response.status, 200);
  const payload = await response.json();
  assert.equal(payload.success, true);
  assert.equal(payload.data.snapshot.open_claw_id, "oc_123");
});
