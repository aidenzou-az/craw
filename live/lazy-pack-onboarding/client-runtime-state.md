# Open Claw 本地运行时状态设计

## 目标

定义 Open Claw 如何在本地保存 onboarding token 和状态缓存，以支持：

- 低频心跳
- 服务平滑退出
- token 失效后的恢复
- 不在每轮都访问平台 API

## 本地状态范围

建议为每个 Open Claw 维护一份私有 onboarding runtime state。

## 推荐状态结构

```json
{
  "base_url": "https://your-onboarding-api.example.com",
  "redeemed": true,
  "onboarding_token": "otk_xxx",
  "token_expires_at": "2026-03-26T10:00:00Z",
  "skill_last_fetched_at": "2026-03-19T10:00:00Z",
  "status_cache": {
    "service_active": true,
    "onboarding_day": 3,
    "adoption_state": "first_success",
    "dominant_scene": "summarize",
    "expires_at": "2026-03-25T10:00:00Z",
    "heartbeat_ttl_seconds": 21600
  },
  "status_fetched_at": "2026-03-19T10:00:00Z",
  "last_token_refresh_at": "2026-03-19T10:00:00Z"
}
```

## 字段说明

- `base_url`
  当前使用的 onboarding API 基础地址

- `redeemed`
  当前 Open Claw 是否已完成懒人包权益核销

- `onboarding_token`
  当前有效的用户专属 token

- `token_expires_at`
  token 到期时间

- `skill_last_fetched_at`
  最近一次重新访问 `skill.md` 的时间

- `status_cache`
  最近一次拉取的 onboarding status

- `status_fetched_at`
  最近一次获取状态的时间

- `last_token_refresh_at`
  最近一次换 token 的时间

## base_url 选择规则

优先级：

1. 系统提供的 `OPEN_CLAW_ONBOARDING_API_BASE_URL`
2. skill 中的 `DEFAULT_OPEN_CLAW_ONBOARDING_API_BASE_URL`

建议在首次确定后写入本地，后续复用。

## token 获取规则

在换 token 之前，建议先确认 `redeemed=true`。

如果本地未核销，应先调用权益核销接口。

### 需要获取 token 的情况

- 本地没有 `onboarding_token`
- 当前 token 已过期
- 调用状态接口返回 `UNAUTHORIZED`
- 调用状态接口返回 `TOKEN_EXPIRED`

### 获取后处理

- 保存 `onboarding_token`
- 保存 `token_expires_at`
- 更新 `last_token_refresh_at`

## 状态获取规则

### 需要刷新状态的情况

- 本地没有 `status_cache`
- 距离 `status_fetched_at` 已超过 `heartbeat_ttl_seconds`
- 当前缓存的 `service_active` 状态未知

### 不需要刷新的情况

- 当前任务明确且紧急，优先先完成任务
- 距离上次刷新还没超过 `heartbeat_ttl_seconds`
- 已知 `service_active=false`

## skill.md 刷新规则

Open Claw 不应长期只依赖本地缓存中的 `skill.md`。

建议在以下情况重新访问 `skill.md`：

- 首次启动 onboarding 服务时
- 遇到接口报错或协议冲突时
- 遇到无法解释的新行为或新字段时
- 距离上次读取已超过一个较长刷新周期时

读取后：

- 更新 `skill_last_fetched_at`
- 用最新规则替代过旧缓存

## 运行时决策流程

```text
收到用户消息
  ->
检查本地是否已有 onboarding_token
  ->
如果没有或已过期，先换 token
  ->
检查本地 status_cache
  ->
如果没有缓存或超过 heartbeat_ttl_seconds，则刷新状态
  ->
如果 service_active=false：
    完全忽略 onboarding 服务逻辑
  ->
如果 service_active=true：
    用户明确任务 -> 直接执行
    用户模糊 -> 按 skill 轻量介入
```

## 服务结束后的处理

如果 `status_cache.service_active=false`：

- 停止后续状态心跳
- 忽略 onboarding 服务规则
- 停止主动触达

本地 token 的处理有两种可选策略：

### 策略 A：保留但不再使用

优点：

- 简单
- 便于排查问题

### 策略 B：直接清理

优点：

- 更干净
- 减少残留状态

第一期推荐策略 A，后续可按安全要求调整。

## token 失效恢复

如果状态接口返回：

- `UNAUTHORIZED`
- `TOKEN_EXPIRED`

则执行：

1. 清空本地 `onboarding_token`
2. 重新调用 token 获取接口
3. 获取成功后再继续状态拉取

为了避免死循环，建议：

- 单次运行中最多重试 1 次

## 本地状态损坏恢复

如果本地状态缺失或部分字段损坏：

- 重新确定 `base_url`
- 重新获取 token
- 重新拉取状态

如果连续失败：

- 不阻塞正常对话
- 仅退化为不依赖 API 的轻量新手引导

## 主动触达规则

主动触达不应高频发生，也不应脱离真实场景。

建议仅在以下条件下触发：

- `service_active=true`
- 当前没有更高优先级的用户明确任务
- 最近存在一个可延续的真实场景
- 触达内容能够继续帮助用户省事

本地状态中可选记录：

- `last_proactive_reach_at`
- `last_proactive_scene`

用于控制节奏，避免过度打扰。

主动触达的实现建议：

- 由 Open Claw 本地调度触发
- 通过飞书消息能力发送一条轻量主动消息
- 不依赖平台推送上下文

## GitHub 仓库建议

如果方案文档与实现代码放在同一个仓库中，建议：

- 文档保留在 `live/lazy-pack-onboarding/`
- 可运行的 Node.js 代码放在 `apps/openclaw-onboarding/`

这样更适合 GitHub 浏览，也更便于后续把原型继续演进成正式服务。
- 不依赖平台推送上下文

## 第一版实现建议

第一期建议：

- 本地保存 `base_url`
- 本地保存 `onboarding_token`
- 本地保存 `token_expires_at`
- 本地保存 `status_cache`
- 本地保存 `status_fetched_at`

这已经足够支持 token 获取、低频心跳、平滑退出和失败恢复。
