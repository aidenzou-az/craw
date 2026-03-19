import { fail, ok, parseJsonBody } from "../utils/http.js";
import { verifyHostRequest } from "../services/auth.js";
import { issueOnboardingToken } from "../services/onboarding-service.js";
import { db } from "../store/mock-db.js";

export async function handleOnboardingToken(req) {
  if (req.method !== "POST") {
    return fail(405, "METHOD_NOT_ALLOWED", "Expected POST");
  }
  const body = parseJsonBody(req);
  const auth = verifyHostRequest({
    req,
    body,
    db,
    expectedPath: "/api/open-claw/onboarding-token",
  });
  if (!auth.ok) {
    return fail(401, auth.code, auth.message);
  }
  const result = issueOnboardingToken({
    userId: body.user_id,
    openClawId: body.open_claw_id,
  });
  if (result.error) {
    return fail(403, result.error.code, result.error.message);
  }
  return ok(result.data);
}
