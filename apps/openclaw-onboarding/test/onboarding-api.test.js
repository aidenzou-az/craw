import test from "node:test";
import assert from "node:assert/strict";
import { dispatch } from "../src/api/router.js";
import { signHostRequest } from "../src/services/auth.js";
import { db } from "../src/store/memory-repo.js";

const FEISHU_APP_ID = "cli_test_app";
const FEISHU_APP_SECRET = "secret_test_123";
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
      feishu_app_secret: FEISHU_APP_SECRET,
    },
  });
  return JSON.parse(response.body).data.host_id;
}

function hostReq(path, body, hostId) {
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const nonce = `nonce_${Math.random().toString(16).slice(2)}`;
  return signHostRequest({
    method: "POST",
    path,
    timestamp,
    nonce,
    body,
    secret: FEISHU_APP_SECRET,
  }).then((signature) => ({
    method: "POST",
    path,
    headers: {
      "x-host-id": hostId,
      "x-host-timestamp": timestamp,
      "x-host-nonce": nonce,
      "x-host-signature": signature,
    },
    body,
  }));
}

test.beforeEach(() => {
  db.reset();
});

test("redeem is idempotent", async () => {
  const hostId = await registerHost();
  const body = {
    user_id: "u_123",
    open_claw_id: "oc_123",
    benefit_code: "feishu_lazy_pack_onboarding",
  };
  const first = await dispatch(await hostReq("/api/open-claw/onboarding-redeem", body, hostId));
  const second = await dispatch(await hostReq("/api/open-claw/onboarding-redeem", body, hostId));
  const firstPayload = JSON.parse(first.body);
  const secondPayload = JSON.parse(second.body);
  assert.equal(first.status, 200);
  assert.equal(second.status, 200);
  assert.equal(firstPayload.data.redeem_id, secondPayload.data.redeem_id);
});

test("token requires valid benefit but does not require prior redeem", async () => {
  const hostId = await registerHost();
  const body = {
    user_id: "u_123",
    open_claw_id: "oc_123",
  };
  const response = await dispatch(await hostReq("/api/open-claw/onboarding-token", body, hostId));
  assert.equal(response.status, 200);
  assert.ok(JSON.parse(response.body).data.onboarding_token);
});

test("status returns repeated when logs indicate reuse", async () => {
  const hostId = await registerHost();
  await dispatch(
    await hostReq("/api/open-claw/onboarding-redeem", {
      user_id: "u_123",
      open_claw_id: "oc_123",
      benefit_code: "feishu_lazy_pack_onboarding",
    }, hostId),
  );
  const tokenResp = await dispatch(
    await hostReq("/api/open-claw/onboarding-token", {
      user_id: "u_123",
      open_claw_id: "oc_123",
    }, hostId),
  );
  const token = JSON.parse(tokenResp.body).data.onboarding_token;
  await db.addLog({ type: "success", userId: "u_123", openClawId: "oc_123", scene: "summarize" });
  await db.addLog({ type: "success", userId: "u_123", openClawId: "oc_123", scene: "summarize" });
  const statusResp = await dispatch({
    method: "GET",
    path: "/api/open-claw/onboarding-status",
    headers: { authorization: `Bearer ${token}` },
    body: null,
  });
  const payload = JSON.parse(statusResp.body);
  assert.equal(statusResp.status, 200);
  assert.equal(payload.data.adoption_state, "repeated");
  assert.equal(payload.data.dominant_scene, "summarize");
});

test("host register is idempotent for same Open Claw binding", async () => {
  const first = await registerHost();
  const second = await registerHost();
  assert.equal(first, second);
});
