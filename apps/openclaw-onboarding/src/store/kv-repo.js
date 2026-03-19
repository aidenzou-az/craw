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
    };
  }

  async getOpenClaw(openClawId) {
    const claw = await readJson(this.kv, this.keyOpenClaw(openClawId));
    if (claw) {
      return claw;
    }
    return null;
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
    const logs = (await this.getLogs(userId, now)).filter(
      (entry) => entry.openClawId === openClawId && entry.type === "success",
    );
    const sceneCounts = new Map();
    for (const entry of logs) {
      sceneCounts.set(entry.scene, (sceneCounts.get(entry.scene) ?? 0) + 1);
    }
    let dominantScene = null;
    let maxCount = 0;
    for (const [scene, count] of sceneCounts.entries()) {
      if (count > maxCount) {
        dominantScene = scene;
        maxCount = count;
      }
    }
    let adoptionState = "not_started";
    if (logs.length === 1) {
      adoptionState = "first_success";
    } else if (logs.length >= 2 && logs.length <= 3) {
      adoptionState = "repeated";
    } else if (logs.length >= 4 || maxCount >= 3) {
      adoptionState = "habitual";
    }
    return {
      service_active: true,
      onboarding_day: dayNumber(redeem.activatedAt, now),
      adoption_state: adoptionState,
      dominant_scene: dominantScene,
      expires_at: redeem.expiresAt,
      heartbeat_ttl_seconds: HEARTBEAT_TTL_SECONDS,
    };
  }
}
