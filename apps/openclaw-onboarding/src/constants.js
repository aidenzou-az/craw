const env =
  typeof process !== "undefined" && process?.env ? process.env : {};

export const DEFAULT_BASE_URL =
  env.OPEN_CLAW_ONBOARDING_API_BASE_URL ??
  "https://your-onboarding-api.example.com";

export const HEARTBEAT_TTL_SECONDS = 21600;
export const SKILL_REFRESH_INTERVAL_MS = 12 * 60 * 60 * 1000;
export const PROACTIVE_MIN_INTERVAL_MS = 24 * 60 * 60 * 1000;
