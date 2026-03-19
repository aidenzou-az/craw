import test from "node:test";
import assert from "node:assert/strict";
import { dispatchEdgeOne } from "../src/edgeone/adapter.js";
import { signHostRequest } from "../src/services/auth.js";
import { db } from "../src/store/mock-db.js";

test.beforeEach(() => {
  db.reset();
});

test("edgeone adapter converts request to onboarding redeem response", async () => {
  const body = JSON.stringify({
    user_id: "u_123",
    open_claw_id: "oc_123",
    benefit_code: "feishu_lazy_pack_onboarding",
  });
  const timestamp = Math.floor(Date.now() / 1000).toString();
  const nonce = `nonce_${Math.random().toString(16).slice(2)}`;
  const signature = signHostRequest({
    method: "POST",
    path: "/api/open-claw/onboarding-redeem",
    timestamp,
    nonce,
    body,
  });

  const response = await dispatchEdgeOne(
    {
      request: new Request("https://example.com/api/open-claw/onboarding-redeem", {
        method: "POST",
        headers: {
          authorization: "Bearer feishu-user:u_123",
          "x-host-timestamp": timestamp,
          "x-host-nonce": nonce,
          "x-host-signature": signature,
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
  assert.equal(payload.data.redeemed, true);
});
