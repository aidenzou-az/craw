import { fail, ok, parseJsonBody } from "../utils/http.js";
import { registerHost } from "../services/host-service.js";

export async function handleHostRegister(req, repo) {
  if (req.method !== "POST") {
    return fail(405, "METHOD_NOT_ALLOWED", "Expected POST");
  }
  const body = parseJsonBody(req);
  const result = await registerHost({
    repo,
    userId: body.user_id,
    openClawId: body.open_claw_id,
    ownerOpenId: body.owner_open_id,
    ownerUnionId: body.owner_union_id ?? null,
    feishuAppId: body.feishu_app_id,
    feishuHostToken: body.feishu_host_token,
  });
  if (result.error) {
    await repo.addLog({
      type: "api",
      action: "host_register",
      outcome: "failed",
      userId: body.user_id,
      openClawId: body.open_claw_id,
      errorCode: result.error.code,
    });
    return fail(403, result.error.code, result.error.message);
  }
  await repo.addLog({
    type: "api",
    action: "host_register",
    outcome: "success",
    userId: body.user_id,
    openClawId: body.open_claw_id,
  });
  return ok(result.data);
}
