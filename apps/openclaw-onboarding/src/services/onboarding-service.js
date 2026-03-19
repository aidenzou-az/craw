import { randomToken } from "../utils/crypto.js";

export async function redeemBenefit({ repo, userId, openClawId, benefitCode }) {
  const benefit = await repo.getBenefit(userId);
  if (!benefit || !benefit.enabled || benefit.benefitCode !== benefitCode) {
    return { error: { code: "BENEFIT_NOT_FOUND", message: "Benefit not found" } };
  }
  const claw = await repo.getOpenClaw(openClawId);
  if (claw && claw.userId !== userId) {
    return { error: { code: "FORBIDDEN", message: "Open Claw does not belong to user" } };
  }
  const record = await repo.redeem({ userId, openClawId, benefitCode });
  return {
    data: {
      redeemed: true,
      redeem_id: record.redeemId,
      service_active: true,
      expires_at: record.expiresAt,
    },
  };
}

export async function issueOnboardingToken({ repo, userId, openClawId }) {
  const benefit = await repo.getBenefit(userId);
  if (!benefit || !benefit.enabled) {
    return { error: { code: "BENEFIT_NOT_FOUND", message: "Benefit not found" } };
  }

  const claw = await repo.getOpenClaw(openClawId);
  if (claw && claw.userId !== userId) {
    return { error: { code: "FORBIDDEN", message: "Open Claw does not belong to user" } };
  }

  const active = await repo.findActiveToken(userId, openClawId);
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

  const redeem = await repo.getRedeem(userId, openClawId);
  const expiresAt = redeem?.expiresAt ?? new Date(Date.now() + 7 * 86400000).toISOString();
  const record = await repo.issueToken(
    { userId, openClawId },
    await randomToken("otk"),
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

export async function getOnboardingStatus({ repo, userId, openClawId }) {
  return { data: await repo.resolveStatus(userId, openClawId) };
}

export async function addMockSuccessLog({ repo, userId, openClawId, scene }) {
  await repo.addLog({ type: "success", userId, openClawId, scene });
}
