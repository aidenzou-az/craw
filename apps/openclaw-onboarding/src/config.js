import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const DEFAULT_BASE_URL =
  process.env.OPEN_CLAW_ONBOARDING_API_BASE_URL ??
  "https://your-onboarding-api.example.com";

export const DEFAULT_SKILL_PATH = path.resolve(
  __dirname,
  "../../../live/lazy-pack-onboarding/skill.md",
);

export const HEARTBEAT_TTL_SECONDS = 21600;
export const SKILL_REFRESH_INTERVAL_MS = 12 * 60 * 60 * 1000;
export const PROACTIVE_MIN_INTERVAL_MS = 24 * 60 * 60 * 1000;
export const HOST_SIGNATURE_SECRET =
  process.env.OPEN_CLAW_HOST_SIGNATURE_SECRET ?? "dev-host-secret";
