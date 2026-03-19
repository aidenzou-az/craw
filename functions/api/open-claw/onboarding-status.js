import { dispatchEdgeOne } from "../../../apps/openclaw-onboarding/src/edgeone/adapter.js";

export default function onRequest(context) {
  return dispatchEdgeOne(context, "/api/open-claw/onboarding-status");
}
