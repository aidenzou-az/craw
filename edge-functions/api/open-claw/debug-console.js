import { dispatchEdgeOne } from "../../../apps/openclaw-onboarding/src/edgeone/adapter.js";

export async function onRequest(context) {
  return dispatchEdgeOne(context, "/api/open-claw/debug-console");
}
