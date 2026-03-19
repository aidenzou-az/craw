import crypto from "node:crypto";
import { db } from "../store/mock-db.js";

function tokenValue(userId, openClawId) {
  const seed = `${userId}:${openClawId}:${Date.now()}:${Math.random()}`;
  return `otk_${crypto.createHash("sha256").update(seed).digest("hex").slice(0, 24)}`;
}

export function redeemBenefit({ userId, openClawId, benefitCode }) {
  const benefit = db.getBenefit(userId);
  if (!benefit || !benefit.enabled || benefit.benefitCode !== benefitCode) {
    return { error: { code: "BENEFIT_NOT_FOUND", message: "Benefit not found" } };
  }
  const claw = db.getOpenClaw(openClawId);
  if (!claw || claw.userId !== userId) {
    return { error: { code: "FORBIDDEN", message: "Open Claw does not belong to user" } };
  }
  const record = db.redeem({ userId, openClawId, benefitCode });
  return {
    data: {
      redeemed: true,
      redeem_id: record.redeemId,
      service_active: true,
      expires_at: record.expiresAt,
    },
  };
}

export function issueOnboardingToken({ userId, openClawId }) {
  const redeem = db.getRedeem(userId, openClawId);
  if (!redeem || !redeem.serviceActive) {
    return { error: { code: "FORBIDDEN", message: "Onboarding service is not active" } };
  }

  const active = db.findActiveToken(userId, openClawId);
  if (active) {
    return {
      data: {
        onboarding_token: active.token,
        expires_at: active.expiresAt,
        token_ttl_seconds: Math.max(
          0,
          Math.floor((new Date(active.expiresAt).getTime() - Date.now()) / 1000),
        ),
      },
    };
  }

  const expiresAt = redeem.expiresAt;
  const record = db.issueToken(
    { userId, openClawId },
    tokenValue(userId, openClawId),
    expiresAt,
  );
  return {
    data: {
      onboarding_token: record.token,
      expires_at: record.expiresAt,
      token_ttl_seconds: Math.max(
        0,
        Math.floor((new Date(record.expiresAt).getTime() - Date.now()) / 1000),
      ),
    },
  };
}

export function getOnboardingStatus({ userId, openClawId }) {
  return { data: db.resolveStatus(userId, openClawId) };
}

export function addMockSuccessLog({ userId, openClawId, scene }) {
  db.addLog({ type: "success", userId, openClawId, scene });
}
