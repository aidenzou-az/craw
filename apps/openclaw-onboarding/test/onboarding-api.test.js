import test from "node:test";
import assert from "node:assert/strict";
import { dispatch } from "../src/api/router.js";
import { db } from "../src/store/memory-repo.js";

const FEISHU_APP_ID = "cli_test_app";
const FEISHU_HOST_TOKEN = "tenant_access_token_test_123";
const OWNER_OPEN_ID = "ou_123";
const OWNER_UNION_ID = "un_123";

async function registerHost(userId = "u_123", openClawId = "oc_123") {
  const response = await dispatch({
    method: "POST",
    path: "/api/open-claw/host-register",
    headers: { "content-type": "application/json" },
    body: {
      user_id: userId,
      open_claw_id: openClawId,
      owner_open_id: OWNER_OPEN_ID,
      owner_union_id: OWNER_UNION_ID,
      feishu_app_id: FEISHU_APP_ID,
      feishu_host_token: FEISHU_HOST_TOKEN,
    },
  });
  const payload = JSON.parse(response.body).data;
  return {
    hostId: payload.host_id,
    hostAccessToken: payload.host_access_token,
  };
}

function hostReq(path, body, hostId, hostAccessToken) {
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const nonce = `nonce_${Math.random().toString(16).slice(2)}`;
  return {
    method: "POST",
    path,
    headers: {
      authorization: `Bearer ${hostAccessToken}`,
      "x-host-id": hostId,
      "x-host-timestamp": timestamp,
      "x-host-nonce": nonce,
    },
    body,
  };
}

test.beforeEach(() => {
  db.reset();
});

test("redeem is idempotent", async () => {
  const { hostId, hostAccessToken } = await registerHost();
  const body = {
    user_id: "u_123",
    open_claw_id: "oc_123",
    benefit_code: "feishu_lazy_pack_onboarding",
  };
  const first = await dispatch(hostReq("/api/open-claw/onboarding-redeem", body, hostId, hostAccessToken));
  const second = await dispatch(hostReq("/api/open-claw/onboarding-redeem", body, hostId, hostAccessToken));
  const firstPayload = JSON.parse(first.body);
  const secondPayload = JSON.parse(second.body);
  assert.equal(first.status, 200);
  assert.equal(second.status, 200);
  assert.equal(firstPayload.data.redeem_id, secondPayload.data.redeem_id);
});

test("token requires valid benefit but does not require prior redeem", async () => {
  const { hostId, hostAccessToken } = await registerHost();
  const body = {
    user_id: "u_123",
    open_claw_id: "oc_123",
  };
  const response = await dispatch(hostReq("/api/open-claw/onboarding-token", body, hostId, hostAccessToken));
  assert.equal(response.status, 200);
  assert.ok(JSON.parse(response.body).data.onboarding_token);
});

test("status uses time-driven default state in test mode", async () => {
  const { hostId, hostAccessToken } = await registerHost();
  await dispatch(
    hostReq(
      "/api/open-claw/onboarding-redeem",
      {
        user_id: "u_123",
        open_claw_id: "oc_123",
        benefit_code: "feishu_lazy_pack_onboarding",
      },
      hostId,
      hostAccessToken,
    ),
  );
  const tokenResp = await dispatch(
    hostReq(
      "/api/open-claw/onboarding-token",
      {
        user_id: "u_123",
        open_claw_id: "oc_123",
      },
      hostId,
      hostAccessToken,
    ),
  );
  const token = JSON.parse(tokenResp.body).data.onboarding_token;
  const statusResp = await dispatch({
    method: "GET",
    path: "/api/open-claw/onboarding-status",
    headers: { authorization: `Bearer ${token}` },
    body: null,
  });
  const payload = JSON.parse(statusResp.body);
  assert.equal(statusResp.status, 200);
  assert.equal(payload.data.adoption_state, "not_started");
  assert.equal(payload.data.dominant_scene, "summarize");
});

test("host register is idempotent for same Open Claw binding", async () => {
  const first = await registerHost();
  const second = await registerHost();
  assert.equal(first.hostId, second.hostId);
  assert.equal(first.hostAccessToken, second.hostAccessToken);
});

test("debug console returns current snapshot and recent events", async () => {
  const { hostId, hostAccessToken } = await registerHost();
  await dispatch(
    hostReq(
      "/api/open-claw/onboarding-token",
      {
        user_id: "u_123",
        open_claw_id: "oc_123",
      },
      hostId,
      hostAccessToken,
    ),
  );
  await dispatch(
    hostReq(
      "/api/open-claw/onboarding-redeem",
      {
        user_id: "u_123",
        open_claw_id: "oc_123",
        benefit_code: "feishu_lazy_pack_onboarding",
      },
      hostId,
      hostAccessToken,
    ),
  );

  const response = await dispatch({
    method: "GET",
    path: "/api/open-claw/debug-console",
    query: { open_claw_id: "oc_123" },
    headers: {},
    body: null,
  });

  assert.equal(response.status, 200);
  const payload = JSON.parse(response.body);
  assert.equal(payload.data.snapshot.open_claw_id, "oc_123");
  assert.equal(payload.data.snapshot.host_registered, true);
  assert.equal(payload.data.snapshot.redeemed, true);
  assert.equal(payload.data.expectation.status, "healthy");
  assert.equal(payload.data.recent_events[0].action, "onboarding_redeem");
  assert.equal(payload.data.snapshot.heartbeat_count, 0);
});

test("debug console counts onboarding-status requests as heartbeats", async () => {
  const { hostId, hostAccessToken } = await registerHost();
  await dispatch(
    hostReq(
      "/api/open-claw/onboarding-token",
      {
        user_id: "u_123",
        open_claw_id: "oc_123",
      },
      hostId,
      hostAccessToken,
    ),
  );
  await dispatch(
    hostReq(
      "/api/open-claw/onboarding-redeem",
      {
        user_id: "u_123",
        open_claw_id: "oc_123",
        benefit_code: "feishu_lazy_pack_onboarding",
      },
      hostId,
      hostAccessToken,
    ),
  );
  const tokenResp = await dispatch(
    hostReq(
      "/api/open-claw/onboarding-token",
      {
        user_id: "u_123",
        open_claw_id: "oc_123",
      },
      hostId,
      hostAccessToken,
    ),
  );
  const token = JSON.parse(tokenResp.body).data.onboarding_token;

  await dispatch({
    method: "GET",
    path: "/api/open-claw/onboarding-status",
    headers: { authorization: `Bearer ${token}` },
    body: null,
  });

  const response = await dispatch({
    method: "GET",
    path: "/api/open-claw/debug-console",
    query: { open_claw_id: "oc_123" },
    headers: {},
    body: null,
  });
  const payload = JSON.parse(response.body);
  assert.equal(payload.data.snapshot.heartbeat_count, 1);
  assert.ok(payload.data.snapshot.last_heartbeat_at);
});

test("debug console can list known open claws", async () => {
  await registerHost();
  const response = await dispatch({
    method: "GET",
    path: "/api/open-claw/debug-console",
    query: { list: "1" },
    headers: {},
    body: null,
  });

  assert.equal(response.status, 200);
  const payload = JSON.parse(response.body);
  assert.equal(payload.data.items.length, 1);
  assert.equal(payload.data.items[0].open_claw_id, "oc_123");
  assert.ok(payload.data.items[0].first_seen_at);
  assert.equal(payload.data.items[0].heartbeat_count, 0);
});
