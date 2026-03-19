import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const DEFAULT_SKILL_PATH = path.resolve(
  __dirname,
  "../../../live/lazy-pack-onboarding/skill.md",
);
