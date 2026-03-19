import { signHostRequest } from "../services/auth.js";

function authHeaders(token) {
  return token ? { authorization: `Bearer ${token}` } : {};
}

export class LocalApiClient {
  constructor({ dispatch, hostToken, baseUrl }) {
    this.dispatch = dispatch;
    this.hostToken = hostToken;
    this.baseUrl = baseUrl;
  }

  async redeem({ userId, openClawId }) {
    const body = {
      user_id: userId,
      open_claw_id: openClawId,
      benefit_code: "feishu_lazy_pack_onboarding",
    };
    return this.#callHostSigned("POST", "/api/open-claw/onboarding-redeem", body);
  }

  async token({ userId, openClawId }) {
    const body = {
      user_id: userId,
      open_claw_id: openClawId,
    };
    return this.#callHostSigned("POST", "/api/open-claw/onboarding-token", body);
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

  async #callHostSigned(method, path, body) {
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const nonce = `nonce_${Date.now()}_${Math.random().toString(16).slice(2, 10)}`;
    const signature = signHostRequest({ method, path, timestamp, nonce, body });
    const response = await this.dispatch({
      method,
      path,
      headers: {
        authorization: `Bearer ${this.hostToken}`,
        "x-host-timestamp": timestamp,
        "x-host-nonce": nonce,
        "x-host-signature": signature,
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
