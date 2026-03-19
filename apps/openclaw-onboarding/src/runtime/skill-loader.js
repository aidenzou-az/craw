import fs from "node:fs/promises";
import { SKILL_REFRESH_INTERVAL_MS } from "../constants.js";
import { DEFAULT_SKILL_PATH } from "../runtime-config.js";

export class SkillLoader {
  constructor({ skillPath = DEFAULT_SKILL_PATH } = {}) {
    this.skillPath = skillPath;
  }

  async refresh(state, { force = false } = {}) {
    const now = Date.now();
    const lastFetched = state.skill_last_fetched_at
      ? new Date(state.skill_last_fetched_at).getTime()
      : 0;
    if (!force && now - lastFetched < SKILL_REFRESH_INTERVAL_MS) {
      return state;
    }
    const content = await fs.readFile(this.skillPath, "utf8");
    return {
      ...state,
      skill_last_fetched_at: new Date(now).toISOString(),
      skill_etag: `${content.length}:${content.slice(0, 16)}`,
    };
  }
}
