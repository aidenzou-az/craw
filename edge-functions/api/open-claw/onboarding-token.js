import { dispatchEdgeOne } from "../../../apps/openclaw-onboarding/src/edgeone/adapter.js";

export default function onRequestPost(context) {
  return dispatchEdgeOne(context, "/api/open-claw/onboarding-token");
}
