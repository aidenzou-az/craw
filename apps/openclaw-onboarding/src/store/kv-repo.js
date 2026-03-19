import { HEARTBEAT_TTL_SECONDS } from "../constants.js";

function nowIso(now = Date.now()) {
  return new Date(now).toISOString();
}

function dayNumber(activatedAt, now = Date.now()) {
  const diff = now - new Date(activatedAt).getTime();
  return Math.max(1, Math.min(7, Math.floor(diff / 86400000) + 1));
}

async function readJson(kv, key) {
  const raw = await kv.get(key);
  return raw ? JSON.parse(raw) : null;
}

async function writeJson(kv, key, value) {
  await kv.put(key, JSON.stringify(value));
}

export class KvRepository {
  constructor(kv) {
    if (!kv) {
      throw new Error("Missing ONBOARDING_KV binding");
    }
    this.kv = kv;
  }

  keyBenefit(userId) {
    return `benefit:${userId}`;
  }

  keyOpenClaw(openClawId) {
    return `openclaw:${openClawId}`;
  }

  keyHost(hostId) {
    return `host:${hostId}`;
  }

  keyHostByOpenClaw(openClawId) {
    return `openclaw-host:${openClawId}`;
  }

  keyRedeem(userId, openClawId) {
    return `redeem:${userId}:${openClawId}`;
  }

  keyToken(token) {
    return `token:${token}`;
  }

  keyActiveToken(userId, openClawId) {
    return `active-token:${userId}:${openClawId}`;
  }

  keyNonce(nonce) {
    return `nonce:${nonce}`;
  }

  keyLogs(userId) {
    return `logs:${userId}`;
  }

  async getBenefit(userId) {
    const benefit = await readJson(this.kv, this.keyBenefit(userId));
    if (benefit) {
      return benefit;
    }
    return {
      userId,
      benefitCode: "feishu_lazy_pack_onboarding",
      enabled: true,
      ownerOpenId: "ou_123",
      ownerUnionId: "un_123",
    };
  }

  async getOpenClaw(openClawId) {
    const claw = await readJson(this.kv, this.keyOpenClaw(openClawId));
    if (claw) {
      return claw;
    }
    return null;
  }

  async registerHost(host) {
    const record = {
      ...host,
      status: "active",
      registeredAt: nowIso(),
    };
    await writeJson(this.kv, this.keyHost(host.hostId), record);
    await this.kv.put(this.keyHostByOpenClaw(host.openClawId), host.hostId);
    const claw = (await this.getOpenClaw(host.openClawId)) ?? { openClawId: host.openClawId };
    await writeJson(this.kv, this.keyOpenClaw(host.openClawId), {
      ...claw,
      userId: host.userId,
      hostId: host.hostId,
    });
    return record;
  }

  async getHostById(hostId) {
    return readJson(this.kv, this.keyHost(hostId));
  }

  async getHostByOpenClawId(openClawId) {
    const hostId = await this.kv.get(this.keyHostByOpenClaw(openClawId));
    if (!hostId) {
      return null;
    }
    return this.getHostById(hostId);
  }

  async redeem({ userId, openClawId, benefitCode }, now = Date.now()) {
    const key = this.keyRedeem(userId, openClawId);
    const existing = await readJson(this.kv, key);
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
    await writeJson(this.kv, key, record);
    return record;
  }

  async getRedeem(userId, openClawId) {
    return readJson(this.kv, this.keyRedeem(userId, openClawId));
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
    await writeJson(this.kv, this.keyToken(token), tokenRecord);
    await this.kv.put(this.keyActiveToken(userId, openClawId), token);
    return tokenRecord;
  }

  async findActiveToken(userId, openClawId, now = Date.now()) {
    const token = await this.kv.get(this.keyActiveToken(userId, openClawId));
    if (!token) {
      return null;
    }
    const record = await this.getToken(token);
    if (
      !record ||
      record.revoked ||
      new Date(record.expiresAt).getTime() <= now
    ) {
      return null;
    }
    return record;
  }

  async getToken(token) {
    return readJson(this.kv, this.keyToken(token));
  }

  async revokeToken(token) {
    const record = await this.getToken(token);
    if (record) {
      record.revoked = true;
      await writeJson(this.kv, this.keyToken(token), record);
    }
  }

  async consumeNonce(nonce) {
    const key = this.keyNonce(nonce);
    const exists = await this.kv.get(key);
    if (exists) {
      return false;
    }
    await this.kv.put(key, "1");
    return true;
  }

  async addLog(entry) {
    const key = this.keyLogs(entry.userId);
    const logs = (await readJson(this.kv, key)) ?? [];
    logs.push({ timestamp: nowIso(), ...entry });
    await writeJson(this.kv, key, logs);
  }

  async getLogs(userId, now = Date.now()) {
    const cutoff = now - 7 * 86400000;
    const logs = (await readJson(this.kv, this.keyLogs(userId))) ?? [];
    return logs.filter(
      (entry) => new Date(entry.timestamp).getTime() >= cutoff,
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
