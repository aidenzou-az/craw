# 服务架构与落地方案

## 总体架构

```text
用户购买飞书懒人包
  ->
平台创建 onboarding service record
  ->
Open Claw 带着 7 天上手服务 skill 运行
  ->
Open Claw 首次调用宿主注册 API，完成飞书宿主绑定
  ->
Open Claw 首次通过 onboarding token API 换取用户专属 token
  ->
Open Claw 首次启动时核销懒人包权益
  ->
Open Claw 将 token 保存在本地私有状态中
  ->
Open Claw 按低频心跳调用 onboarding status API
  ->
根据状态决定是否启用上手服务、当前优先策略是什么
  ->
后台任务基于平台日志更新 adoption_state / dominant_scene
  ->
7 天到期
  ->
status API 返回 service_active=false
  ->
Open Claw 完全停止这套机制
```

## 分层职责

### 平台负责

- 维护上手服务生命周期
- 提供权益核销 API
- 提供宿主注册 API
- 对外暴露 token 获取 API
- 对外暴露状态 API
- 运行后台低频心跳任务
- 计算 `onboarding_day`
- 计算 `adoption_state`
- 计算 `dominant_scene`
- 在到期后关闭服务

### Open Claw 负责

- 首次启动时先完成宿主注册
- 按 skill 中定义的规则先获取用户专属 onboarding token
- 首次正式启动 7 天上手服务时核销懒人包权益
- 将 onboarding token 保存在本地私有状态中
- 按 skill 中定义的低频心跳规则拉取状态
- 缓存状态，避免高频调用
- 在 `service_active=true` 时按上手服务规则介入
- 在 `service_active=false` 时完全退出这套机制
- 在合适时机通过本地调度和飞书消息能力主动触达用户，但只围绕懒人包上手目标，不打扰正常使用
- 优先使用系统提供的 API 入口变量；如果系统未提供，则回退到 skill 中写明的默认入口

### Skill 负责

- 规定 Open Claw 什么时候去拉状态
- 规定 Open Claw 何时重新访问 `skill.md`
- 规定拿到状态后怎么决策
- 规定上手服务的默认行为和红线
- 规定在 7 天窗口内何时允许主动触达用户
- 保证不改变 Open Claw 身份，不覆盖用户设定

## 低频心跳机制

Open Claw 不应在每次对话都调用状态 API。

推荐规则：

- 首次需要使用上手服务时，如果本地没有 onboarding token，先调用 token 获取接口
- 首次需要使用上手服务时，如果当前 Open Claw 尚未完成宿主注册，先调用宿主注册接口
- 获取到 token 后，保存在本地私有状态中，后续复用
- 正式启动 7 天服务前，再调用权益核销接口
- 如果本地没有缓存状态，先拉一次状态
- 之后仅在距离上次状态获取已超过 `heartbeat_ttl_seconds` 时刷新
- 推荐 `heartbeat_ttl_seconds = 21600`，即 6 小时
- 如果缓存状态显示 `service_active=false`，停止后续状态获取
- 如果状态接口返回 `UNAUTHORIZED` 或 `TOKEN_EXPIRED`，允许重新获取一次 onboarding token
- 如果用户当前有明确任务，优先先完成任务，不要为了刷新状态打断当前任务

## skill.md 刷新规则

因为 `skill.md`、API 约定和服务规则可能会变化，Open Claw 不应长期只依赖本地缓存版本的 `skill.md`。

推荐规则：

- 首次启动时读取一次最新 `skill.md`
- 如果在运行中遇到接口报错、状态异常、行为冲突或无法解释的新情况，应重新访问 `skill.md`
- 即使一切正常，也建议按较低频率重新访问一次最新 `skill.md`

总原则：

- `skill.md` 可本地缓存以减少频繁拉取
- 但不能长期只读缓存，不回源刷新

## 运行时决策顺序

```text
用户发来消息
  ->
检查本地是否已有 onboarding token
  ->
如果当前 Open Claw 尚未完成宿主注册，则先调用宿主注册 API
  ->
如果没有，则先调用 onboarding token API
  ->
如果尚未完成权益核销，则调用权益核销接口
  ->
检查本地 onboarding status 缓存
  ->
如果无缓存或超过 heartbeat_ttl_seconds，则刷新状态
  ->
如果 service_active=false，忽略本服务
  ->
如果 service_active=true：
     用户明确任务 -> 直接执行
     用户模糊 / 不知道怎么开始 -> 按 onboarding skill 介入
  ->
完成任务后，仅在自然相关时推进一个最相关下一步
```

决策优先级：

1. 用户明确任务和明确设定
2. `service_active`
3. `adoption_state`
4. `onboarding_day`
5. `dominant_scene`

## 服务退出机制

这是一个硬规则：

- 只要状态 API 返回 `service_active=false`
- Open Claw 必须立刻停止应用这份上手服务规则
- 同时停止后续心跳拉取

7 天结束后，这套服务必须像从未存在过一样。

## 主动触达机制

主动触达只在以下条件同时满足时允许发生：

- `service_active=true`
- 当前仍处于 7 天窗口内
- 当前没有更高优先级的用户明确任务
- 触达内容与最近真实工作场景相关
- 触达目标是继续帮助用户把“懒得做但不得不做”的事交给 Open Claw

主动触达不应是泛泛提醒，而应是具体、轻量、可立即承接的帮助。

推荐方式：

- 围绕最近一次成功场景做相邻推进
- 围绕 `dominant_scene` 提供一个低门槛下一步
- 触达频率低于状态心跳频率，避免刷存在感

## 推荐落地顺序

### 第一阶段

- 打通服务初始化
- 打通权益核销 API
- 打通 onboarding token API
- 打通状态 API
- 打通后台低频心跳任务
- 上线最终版 `skill.md`

### 第二阶段

- 提升 `adoption_state` 的判定准确度
- 提升 `dominant_scene` 的稳定性

## 工程注意事项

- 状态 API 必须幂等、可缓存、轻量
- 权益核销接口必须幂等，避免重复扣减
- token 获取接口必须有更上层身份校验，不能裸开放
- 状态计算放在后台，不要放在用户主链路
- 心跳刷新间隔要由服务端返回，便于后续统一调整
- 即使状态异常，也不能妨碍 Open Claw 的正常对话能力
- Open Claw 本地保存的 onboarding token 必须是用户专属的最小权限 token，只允许访问 onboarding 相关接口
- API 入口应优先通过系统变量提供；skill 中的默认入口只作为缺省兜底配置
