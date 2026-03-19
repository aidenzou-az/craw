import { fail, ok } from "../utils/http.js";
import { verifyOnboardingToken } from "../services/auth.js";
import { getOnboardingStatus } from "../services/onboarding-service.js";

export async function handleOnboardingStatus(req) {
  if (req.method !== "GET") {
    return fail(405, "METHOD_NOT_ALLOWED", "Expected GET");
  }
  const auth = verifyOnboardingToken({ req, db: (await import("../store/mock-db.js")).db });
  if (!auth.ok) {
    return fail(401, auth.code, auth.message);
  }
  const result = getOnboardingStatus({
    userId: auth.record.userId,
    openClawId: auth.record.openClawId,
  });
  return ok(result.data);
}
