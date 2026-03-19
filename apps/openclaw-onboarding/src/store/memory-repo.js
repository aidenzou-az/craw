import { HEARTBEAT_TTL_SECONDS } from "../constants.js";

function nowIso(now = Date.now()) {
  return new Date(now).toISOString();
}

function dayNumber(activatedAt, now = Date.now()) {
  const diff = now - new Date(activatedAt).getTime();
  return Math.max(1, Math.min(7, Math.floor(diff / 86400000) + 1));
}

export class MemoryRepository {
  constructor() {
    this.reset();
  }

  reset() {
    this.hosts = new Map();
    this.redeems = new Map();
    this.tokens = new Map();
    this.nonces = new Set();
    this.logs = [];
    this.userBenefits = new Map([
      [
        "u_123",
        {
          userId: "u_123",
          benefitCode: "feishu_lazy_pack_onboarding",
          enabled: true,
          ownerOpenId: "ou_123",
          ownerUnionId: "un_123",
        },
      ],
    ]);
    this.openClaws = new Map([["oc_123", { openClawId: "oc_123", userId: "u_123" }]]);
  }

  async getBenefit(userId) {
    return this.userBenefits.get(userId) ?? null;
  }

  async getOpenClaw(openClawId) {
    return this.openClaws.get(openClawId) ?? null;
  }

  async registerHost(host) {
    const record = {
      ...host,
      status: "active",
      registeredAt: nowIso(),
    };
    this.hosts.set(host.hostId, record);
    const claw = this.openClaws.get(host.openClawId) ?? { openClawId: host.openClawId };
    this.openClaws.set(host.openClawId, { ...claw, userId: host.userId, hostId: host.hostId });
    return record;
  }

  async getHostById(hostId) {
    return this.hosts.get(hostId) ?? null;
  }

  async getHostByOpenClawId(openClawId) {
    for (const host of this.hosts.values()) {
      if (host.openClawId === openClawId) {
        return host;
      }
    }
    return null;
  }

  getRedeemKey(userId, openClawId) {
    return `${userId}:${openClawId}`;
  }

  async redeem({ userId, openClawId, benefitCode }, now = Date.now()) {
    const key = this.getRedeemKey(userId, openClawId);
    const existing = this.redeems.get(key);
    if (existing) {
      return existing;
    }
    const activatedAt = nowIso(now);
    const expiresAt = nowIso(now + 7 * 86400000);
    const record = {
      redeemId: `redeem_${userId}_${openClawId}`,
      userId,
      openClawId,
      benefitCode,
      activatedAt,
      expiresAt,
      serviceActive: true,
    };
    this.redeems.set(key, record);
    return record;
  }

  async getRedeem(userId, openClawId) {
    return this.redeems.get(this.getRedeemKey(userId, openClawId)) ?? null;
  }

  async issueToken({ userId, openClawId }, token, expiresAt) {
    const tokenRecord = {
      token,
      userId,
      openClawId,
      expiresAt,
      scope: "onboarding",
      revoked: false,
    };
    this.tokens.set(token, tokenRecord);
    return tokenRecord;
  }

  async findActiveToken(userId, openClawId, now = Date.now()) {
    for (const record of this.tokens.values()) {
      if (
        record.userId === userId &&
        record.openClawId === openClawId &&
        !record.revoked &&
        new Date(record.expiresAt).getTime() > now
      ) {
        return record;
      }
    }
    return null;
  }

  async getToken(token) {
    return this.tokens.get(token) ?? null;
  }

  async revokeToken(token) {
    const record = this.tokens.get(token);
    if (record) {
      record.revoked = true;
    }
  }

  async consumeNonce(nonce) {
    if (this.nonces.has(nonce)) {
      return false;
    }
    this.nonces.add(nonce);
    return true;
  }

  async addLog(entry) {
    this.logs.push({ timestamp: nowIso(), ...entry });
  }

  async getLogs(userId, now = Date.now()) {
    const cutoff = now - 7 * 86400000;
    return this.logs.filter(
      (entry) =>
        entry.userId === userId &&
        new Date(entry.timestamp).getTime() >= cutoff,
    );
  }

  async resolveStatus(userId, openClawId, now = Date.now()) {
    const redeem = await this.getRedeem(userId, openClawId);
    if (!redeem) {
      return {
        service_active: false,
        onboarding_day: null,
        adoption_state: null,
        dominant_scene: null,
        expires_at: null,
        heartbeat_ttl_seconds: 0,
      };
    }

    const expiresAtMs = new Date(redeem.expiresAt).getTime();
    if (now > expiresAtMs) {
      redeem.serviceActive = false;
      return {
        service_active: false,
        onboarding_day: null,
        adoption_state: null,
        dominant_scene: null,
        expires_at: redeem.expiresAt,
        heartbeat_ttl_seconds: 0,
      };
    }

    const onboardingDay = dayNumber(redeem.activatedAt, now);
    let adoptionState = "not_started";
    if (onboardingDay >= 3 && onboardingDay <= 4) {
      adoptionState = "first_success";
    } else if (onboardingDay >= 5) {
      adoptionState = "habitual";
    }

    return {
      service_active: true,
      onboarding_day: onboardingDay,
      adoption_state: adoptionState,
      dominant_scene: "summarize",
      expires_at: redeem.expiresAt,
      heartbeat_ttl_seconds: HEARTBEAT_TTL_SECONDS,
    };
  }
}

export const db = new MemoryRepository();
