import { fail, ok, parseJsonBody } from "../utils/http.js";
import { verifyHostRequest } from "../services/auth.js";
import { redeemBenefit } from "../services/onboarding-service.js";

export async function handleOnboardingRedeem(req, repo) {
  if (req.method !== "POST") {
    return fail(405, "METHOD_NOT_ALLOWED", "Expected POST");
  }
  const body = parseJsonBody(req);
  const auth = await verifyHostRequest({
    req,
    body,
    repo,
  });
  if (!auth.ok) {
    await repo.addLog({
      type: "api",
      action: "onboarding_redeem",
      outcome: "failed",
      userId: body.user_id,
      openClawId: body.open_claw_id,
      errorCode: auth.code,
    });
    return fail(401, auth.code, auth.message);
  }
  const result = await redeemBenefit({
    repo,
    userId: body.user_id,
    openClawId: body.open_claw_id,
    benefitCode: body.benefit_code,
  });
  if (result.error) {
    await repo.addLog({
      type: "api",
      action: "onboarding_redeem",
      outcome: "failed",
      userId: body.user_id,
      openClawId: body.open_claw_id,
      errorCode: result.error.code,
    });
    return fail(403, result.error.code, result.error.message);
  }
  await repo.addLog({
    type: "api",
    action: "onboarding_redeem",
    outcome: "success",
    userId: body.user_id,
    openClawId: body.open_claw_id,
  });
  return ok(result.data);
}
