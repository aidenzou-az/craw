import test from "node:test";
import assert from "node:assert/strict";
import { dispatch } from "../src/api/router.js";
import { signHostRequest } from "../src/services/auth.js";
import { db } from "../src/store/memory-repo.js";

function hostReq(path, body, userId = "u_123") {
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const nonce = `nonce_${Math.random().toString(16).slice(2)}`;
  return signHostRequest({
    method: "POST",
    path,
    timestamp,
    nonce,
    body,
  }).then((signature) => ({
    method: "POST",
    path,
    headers: {
      authorization: `Bearer feishu-user:${userId}`,
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
  const body = {
    user_id: "u_123",
    open_claw_id: "oc_123",
    benefit_code: "feishu_lazy_pack_onboarding",
  };
  const first = await dispatch(await hostReq("/api/open-claw/onboarding-redeem", body));
  const second = await dispatch(await hostReq("/api/open-claw/onboarding-redeem", body));
  const firstPayload = JSON.parse(first.body);
  const secondPayload = JSON.parse(second.body);
  assert.equal(first.status, 200);
  assert.equal(second.status, 200);
  assert.equal(firstPayload.data.redeem_id, secondPayload.data.redeem_id);
});

test("token requires redeemed benefit", async () => {
  const body = {
    user_id: "u_123",
    open_claw_id: "oc_123",
  };
  const response = await dispatch(await hostReq("/api/open-claw/onboarding-token", body));
  assert.equal(response.status, 403);
  assert.equal(JSON.parse(response.body).error.code, "FORBIDDEN");
});

test("status returns repeated when logs indicate reuse", async () => {
  await dispatch(
    await hostReq("/api/open-claw/onboarding-redeem", {
      user_id: "u_123",
      open_claw_id: "oc_123",
      benefit_code: "feishu_lazy_pack_onboarding",
    }),
  );
  const tokenResp = await dispatch(
    await hostReq("/api/open-claw/onboarding-token", {
      user_id: "u_123",
      open_claw_id: "oc_123",
    }),
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
