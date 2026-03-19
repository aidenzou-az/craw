function authHeaders(token) {
  return token ? { authorization: `Bearer ${token}` } : {};
}

export class LocalApiClient {
  constructor({
    dispatch,
    hostId = null,
    hostAccessToken = null,
    ownerOpenId = null,
    ownerUnionId = null,
    feishuAppId = null,
    feishuHostToken = null,
    baseUrl,
  }) {
    this.dispatch = dispatch;
    this.hostId = hostId;
    this.hostAccessToken = hostAccessToken;
    this.ownerOpenId = ownerOpenId;
    this.ownerUnionId = ownerUnionId;
    this.feishuAppId = feishuAppId;
    this.feishuHostToken = feishuHostToken;
    this.baseUrl = baseUrl;
  }

  async registerHost({ userId, openClawId }) {
    const body = {
      user_id: userId,
      open_claw_id: openClawId,
      owner_open_id: this.ownerOpenId,
      owner_union_id: this.ownerUnionId,
      feishu_app_id: this.feishuAppId,
      feishu_host_token: this.feishuHostToken,
    };
    const response = await this.dispatch({
      method: "POST",
      path: "/api/open-claw/host-register",
      headers: {
        "content-type": "application/json",
      },
      body,
      baseUrl: this.baseUrl,
    });
    const decoded = this.#decode(response);
    if (decoded.success) {
      this.hostId = decoded.data.host_id;
      this.hostAccessToken = decoded.data.host_access_token;
    }
    return decoded;
  }

  async redeem({ userId, openClawId }) {
    const body = {
      user_id: userId,
      open_claw_id: openClawId,
      benefit_code: "feishu_lazy_pack_onboarding",
    };
    return this.#callHostAuthenticated("POST", "/api/open-claw/onboarding-redeem", body);
  }

  async token({ userId, openClawId }) {
    const body = {
      user_id: userId,
      open_claw_id: openClawId,
    };
    return this.#callHostAuthenticated("POST", "/api/open-claw/onboarding-token", body);
  }

  async status(token) {
    const response = await this.dispatch({
      method: "GET",
      path: "/api/open-claw/onboarding-status",
      headers: authHeaders(token),
      body: null,
      baseUrl: this.baseUrl,
    });
    return this.#decode(response);
  }

  async #callHostAuthenticated(method, path, body) {
    if (!this.hostId || !this.hostAccessToken) {
      throw new Error("Missing host registration or host access token");
    }
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const nonce = `nonce_${Date.now()}_${Math.random().toString(16).slice(2, 10)}`;
    const response = await this.dispatch({
      method,
      path,
      headers: {
        authorization: `Bearer ${this.hostAccessToken}`,
        "x-host-id": this.hostId,
        "x-host-timestamp": timestamp,
        "x-host-nonce": nonce,
      },
      body,
      baseUrl: this.baseUrl,
    });
    return this.#decode(response);
  }

  #decode(response) {
    const payload = JSON.parse(response.body);
    return {
      status: response.status,
      ...payload,
    };
  }
}
