import { handleOnboardingRedeem } from "./onboarding-redeem.js";
import { handleHostRegister } from "./host-register.js";
import { handleOnboardingToken } from "./onboarding-token.js";
import { handleOnboardingStatus } from "./onboarding-status.js";
import { fail } from "../utils/http.js";
import { db } from "../store/memory-repo.js";

export async function dispatch(req, { repo = db } = {}) {
  const path = req.path;
  if (path === "/api/open-claw/host-register") {
    return handleHostRegister(req, repo);
  }
  if (path === "/api/open-claw/onboarding-redeem") {
    return handleOnboardingRedeem(req, repo);
  }
  if (path === "/api/open-claw/onboarding-token") {
    return handleOnboardingToken(req, repo);
  }
  if (path === "/api/open-claw/onboarding-status") {
    return handleOnboardingStatus(req, repo);
  }
  return fail(404, "NOT_FOUND", "Route not found");
}
