function maskToken(token) {
  if (!token) {
    return null;
  }
  if (token.length <= 10) {
    return `${token.slice(0, 3)}***`;
  }
  return `${token.slice(0, 6)}...${token.slice(-4)}`;
}

function buildExpectation(snapshot) {
  if (!snapshot.host_registered) {
    return {
      status: "pending",
      message: "等待 host-register",
      next_action: "让 Open Claw 先完成宿主注册",
    };
  }
  if (!snapshot.host_access_token_present) {
    return {
      status: "abnormal",
      message: "已注册宿主，但缺少 host_access_token",
      next_action: "重新执行 host-register，触发旧数据自愈",
    };
  }
  if (!snapshot.onboarding_token_active) {
    return {
      status: "pending",
      message: "等待 onboarding-token",
      next_action: "让 Open Claw 获取 onboarding token",
    };
  }
  if (!snapshot.redeemed) {
    return {
      status: "pending",
      message: "等待 onboarding-redeem",
      next_action: "让 Open Claw 核销懒人包权益并启动 7 天服务",
    };
  }
  if (!snapshot.service_active) {
    return {
      status: "completed",
      message: "7 天服务未生效或已结束",
      next_action: "无需继续 onboarding，按 Open Claw 原有行为运行",
    };
  }
  return {
    status: "healthy",
    message: "链路已跑通，状态符合当前测试期规则",
    next_action: "继续观察 Open Claw 是否按当前阶段执行预期行为",
  };
}

export async function getDebugConsoleSnapshot({ repo, openClawId, now = Date.now() }) {
  const openClaw = await repo.getOpenClaw(openClawId);
  const host = await repo.getHostByOpenClawId(openClawId);
  const userId = openClaw?.userId ?? host?.userId ?? null;
  if (!host && !openClaw) {
    return {
      error: {
        code: "OPEN_CLAW_NOT_FOUND",
        message: "No onboarding records found for this open_claw_id",
      },
    };
  }

  const activeToken =
    userId ? await repo.findActiveToken(userId, openClawId, now) : null;
  const redeem = userId ? await repo.getRedeem(userId, openClawId) : null;
  const status = userId
    ? await repo.resolveStatus(userId, openClawId, now)
    : {
        service_active: false,
        onboarding_day: null,
        adoption_state: null,
        dominant_scene: null,
        expires_at: null,
        heartbeat_ttl_seconds: 0,
      };
  const logs = userId
    ? await repo.getLogs(userId, now)
    : [];
  const events = logs
    .filter((entry) => entry.openClawId === openClawId)
    .slice(-20)
    .reverse();

  const snapshot = {
    open_claw_id: openClawId,
    user_id: userId,
    host_id: host?.hostId ?? null,
    host_registered: Boolean(host),
    host_access_token_present: Boolean(host?.hostAccessToken),
    host_access_token_preview: maskToken(host?.hostAccessToken),
    feishu_app_id: host?.feishuAppId ?? null,
    owner_open_id: host?.ownerOpenId ?? null,
    owner_union_id: host?.ownerUnionId ?? null,
    host_registered_at: host?.registeredAt ?? null,
    redeemed: Boolean(redeem),
    redeem_id: redeem?.redeemId ?? null,
    activated_at: redeem?.activatedAt ?? null,
    onboarding_token_active: Boolean(activeToken),
    onboarding_token_preview: maskToken(activeToken?.token),
    onboarding_token_expires_at: activeToken?.expiresAt ?? null,
    service_active: status.service_active,
    onboarding_day: status.onboarding_day,
    adoption_state: status.adoption_state,
    dominant_scene: status.dominant_scene,
    expires_at: status.expires_at,
    heartbeat_ttl_seconds: status.heartbeat_ttl_seconds,
  };

  return {
    data: {
      snapshot,
      expectation: buildExpectation(snapshot),
      recent_events: events,
    },
  };
}
