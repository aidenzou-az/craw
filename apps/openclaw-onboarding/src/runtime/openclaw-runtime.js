import {
  DEFAULT_BASE_URL,
  PROACTIVE_MIN_INTERVAL_MS,
} from "../constants.js";

export class OpenClawRuntime {
  constructor({
    userId,
    openClawId,
    apiClient,
    stateStore,
    skillLoader,
    feishuSender,
    baseUrl = DEFAULT_BASE_URL,
  }) {
    this.userId = userId;
    this.openClawId = openClawId;
    this.apiClient = apiClient;
    this.stateStore = stateStore;
    this.skillLoader = skillLoader;
    this.feishuSender = feishuSender;
    this.baseUrl = baseUrl;
  }

  async loadState() {
    const state = await this.stateStore.load();
    return { base_url: this.baseUrl, ...state };
  }

  async saveState(state) {
    await this.stateStore.save(state);
  }

  async initialize() {
    let state = await this.loadState();
    state = await this.skillLoader.refresh(state, { force: !state.skill_last_fetched_at });
    if (!state.redeemed) {
      const redeemed = await this.apiClient.redeem({
        userId: this.userId,
        openClawId: this.openClawId,
      });
      if (!redeemed.success) {
        throw new Error(`Redeem failed: ${redeemed.error.code}`);
      }
      state.redeemed = true;
      state.expires_at = redeemed.data.expires_at;
    }
    if (!state.onboarding_token || this.#tokenExpired(state)) {
      state = await this.#refreshToken(state);
    }
    if (!state.status_cache) {
      state = await this.#refreshStatus(state);
    }
    await this.saveState(state);
    return state;
  }

  async handleUserMessage({ text, sceneHint = null }) {
    let state = await this.initialize();
    state = await this.#refreshStatusIfNeeded(state);
    if (state.status_cache?.service_active === false) {
      await this.saveState(state);
      return {
        onboardingActive: false,
        action: "pass_through",
      };
    }
    const result = {
      onboardingActive: true,
      action: "direct_execute",
      suggested_scene: sceneHint ?? state.status_cache?.dominant_scene ?? "summarize",
      text,
    };
    await this.saveState(state);
    return result;
  }

  async maybeProactiveReach() {
    let state = await this.initialize();
    state = await this.#refreshStatusIfNeeded(state);
    if (!this.#shouldReach(state)) {
      await this.saveState(state);
      return { sent: false };
    }
    const scene = state.status_cache?.dominant_scene ?? "summarize";
    const content = this.#proactiveMessage(scene);
    await this.feishuSender.send({ userId: this.userId, content });
    state.last_proactive_reach_at = new Date().toISOString();
    state.last_proactive_scene = scene;
    await this.saveState(state);
    return { sent: true, scene, content };
  }

  async recoverFromStatusError() {
    let state = await this.loadState();
    state.onboarding_token = null;
    state.token_expires_at = null;
    state = await this.#refreshToken(state);
    state = await this.#refreshStatus(state);
    await this.saveState(state);
    return state;
  }

  async #refreshStatusIfNeeded(state) {
    const fetchedAt = state.status_fetched_at
      ? new Date(state.status_fetched_at).getTime()
      : 0;
    const ttlMs = (state.status_cache?.heartbeat_ttl_seconds ?? 0) * 1000;
    if (!state.status_cache || Date.now() - fetchedAt >= ttlMs) {
      return this.#refreshStatus(state);
    }
    return state;
  }

  async #refreshToken(state) {
    const response = await this.apiClient.token({
      userId: this.userId,
      openClawId: this.openClawId,
    });
    if (!response.success) {
      throw new Error(`Token fetch failed: ${response.error.code}`);
    }
    return {
      ...state,
      onboarding_token: response.data.onboarding_token,
      token_expires_at: response.data.expires_at,
      last_token_refresh_at: new Date().toISOString(),
    };
  }

  async #refreshStatus(state) {
    const response = await this.apiClient.status(state.onboarding_token);
    if (!response.success) {
      if (response.error.code === "UNAUTHORIZED" || response.error.code === "TOKEN_EXPIRED") {
        const refreshed = await this.#refreshToken(state);
        const retry = await this.apiClient.status(refreshed.onboarding_token);
        if (!retry.success) {
          throw new Error(`Status fetch failed after retry: ${retry.error.code}`);
        }
        return {
          ...refreshed,
          status_cache: retry.data,
          status_fetched_at: new Date().toISOString(),
        };
      }
      throw new Error(`Status fetch failed: ${response.error.code}`);
    }
    return {
      ...state,
      status_cache: response.data,
      status_fetched_at: new Date().toISOString(),
    };
  }

  #tokenExpired(state) {
    return !state.token_expires_at || new Date(state.token_expires_at).getTime() <= Date.now();
  }

  #shouldReach(state) {
    if (state.status_cache?.service_active !== true) {
      return false;
    }
    const last = state.last_proactive_reach_at
      ? new Date(state.last_proactive_reach_at).getTime()
      : 0;
    return Date.now() - last >= PROACTIVE_MIN_INTERVAL_MS;
  }

  #proactiveMessage(scene) {
    if (scene === "draft") {
      return "如果你现在有一条懒得写的飞书消息，直接把对象和大意发给我，我可以先帮你起草一版。";
    }
    if (scene === "organize") {
      return "如果你手头事情有点乱，直接把几件事丢给我，我可以先帮你整理成待办和优先级。";
    }
    return "如果你现在有一段懒得看的聊天、文档或会议内容，直接发给我，我可以先帮你提炼重点和下一步。";
  }
}
