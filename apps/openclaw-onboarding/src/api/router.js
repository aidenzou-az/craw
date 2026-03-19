import { handleOnboardingRedeem } from "./onboarding-redeem.js";
import { handleOnboardingToken } from "./onboarding-token.js";
import { handleOnboardingStatus } from "./onboarding-status.js";
import { fail } from "../utils/http.js";

export async function dispatch(req) {
  const path = req.path;
  if (path === "/api/open-claw/onboarding-redeem") {
    return handleOnboardingRedeem(req);
  }
  if (path === "/api/open-claw/onboarding-token") {
    return handleOnboardingToken(req);
  }
  if (path === "/api/open-claw/onboarding-status") {
    return handleOnboardingStatus(req);
  }
  return fail(404, "NOT_FOUND", "Route not found");
}
