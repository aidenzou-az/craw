import { randomToken } from "../utils/crypto.js";
import { verifyFeishuHostToken } from "./feishu-verifier.js";

export async function registerHost({
  repo,
  userId,
  openClawId,
  ownerOpenId,
  ownerUnionId,
  feishuAppId,
  feishuHostToken,
}) {
  const benefit = await repo.getBenefit(userId);
  if (!benefit || !benefit.enabled) {
    return { error: { code: "BENEFIT_NOT_FOUND", message: "Benefit not found" } };
  }

  const expectedOwnerOpenId = benefit.ownerOpenId ?? null;
  const expectedOwnerUnionId = benefit.ownerUnionId ?? null;
  if (expectedOwnerUnionId && ownerUnionId && ownerUnionId !== expectedOwnerUnionId) {
    return {
      error: { code: "HOST_IDENTITY_MISMATCH", message: "Owner union_id mismatch" },
    };
  }
  if (!expectedOwnerUnionId && expectedOwnerOpenId && ownerOpenId !== expectedOwnerOpenId) {
    return {
      error: { code: "HOST_IDENTITY_MISMATCH", message: "Owner open_id mismatch" },
    };
  }

  const feishuVerification = await verifyFeishuHostToken({
    feishuAppId,
    feishuHostToken,
  });
  if (!feishuVerification.ok) {
    return {
      error: { code: "FEISHU_HOST_TOKEN_INVALID", message: feishuVerification.message },
    };
  }

  const openClaw = await repo.getOpenClaw(openClawId);
  if (openClaw && openClaw.userId && openClaw.userId !== userId) {
    return {
      error: { code: "OPEN_CLAW_NOT_ALLOWED", message: "Open Claw does not belong to user" },
    };
  }

  const existing = await repo.getHostByOpenClawId(openClawId);
  if (existing) {
    if (
      existing.userId === userId &&
      existing.ownerOpenId === ownerOpenId &&
      existing.feishuAppId === feishuAppId
    ) {
      return {
        data: {
          host_id: existing.hostId,
          host_registered: true,
          host_access_token: existing.hostAccessToken,
          owner_open_id: existing.ownerOpenId,
          owner_union_id: existing.ownerUnionId,
        },
      };
    }
    return {
      error: { code: "OPEN_CLAW_NOT_ALLOWED", message: "Open Claw already bound to another host" },
    };
  }

  const hostId = await randomToken("host");
  const hostAccessToken = await randomToken("hat");
  const record = await repo.registerHost({
    hostId,
    hostAccessToken,
    userId,
    openClawId,
    ownerOpenId,
    ownerUnionId,
    feishuAppId,
    feishuVerificationSource: feishuVerification.verifiedBy,
  });
  return {
    data: {
      host_id: record.hostId,
      host_registered: true,
      host_access_token: record.hostAccessToken,
      owner_open_id: record.ownerOpenId,
      owner_union_id: record.ownerUnionId,
    },
  };
}
