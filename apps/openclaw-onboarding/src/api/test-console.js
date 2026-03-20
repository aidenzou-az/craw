import { fail, ok } from "../utils/http.js";
import { getDebugConsoleSnapshot } from "../services/debug-console-service.js";

export async function handleDebugConsole(req, repo) {
  if (req.method !== "GET") {
    return fail(405, "METHOD_NOT_ALLOWED", "Expected GET");
  }
  const openClawId = req.query?.open_claw_id;
  if (!openClawId) {
    return fail(400, "MISSING_OPEN_CLAW_ID", "Query parameter open_claw_id is required");
  }
  const result = await getDebugConsoleSnapshot({ repo, openClawId });
  if (result.error) {
    return fail(404, result.error.code, result.error.message);
  }
  return ok(result.data);
}
