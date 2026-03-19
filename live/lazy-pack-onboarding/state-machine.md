# 采用状态机与心跳更新规则

## 核心原则

- 测试阶段不接平台日志
- 测试阶段 `adoption_state` 采用时间驱动默认阶段
- `onboarding_day` 直接决定测试期默认阶段
- 7 天到期是硬边界
- 超过 7 天后，无论状态如何，服务都必须结束
- 主动触达只能服务于 onboarding 目标，不能脱离真实任务场景

## 状态定义

### `not_started`

含义：

- 还没有明确成功记录

此时 Open Claw 应优先：

- 帮用户获得第一次“省事成功”
- 如需主动触达，优先给出一个最低门槛、最具体的代办入口

### `first_success`

含义：

- 已有 1 次明确成功
- 但还没有形成复用

此时 Open Claw 应优先：

- 推动第二次类似成功
- 可围绕上一次成功场景轻量主动触达一次

### `habitual`

含义：

- 某一类场景已出现稳定重复

此时 Open Claw 应优先：

- 轻量强化高频场景
- 不要过度打扰

## dominant_scene 判定

测试阶段固定：

- `dominant_scene = summarize`

## onboarding_day 计算

```text
onboarding_day = floor((now - activated_at) / 1 day) + 1
```

约束：

- 最小为 `1`
- 最大为 `7`
- 超过 `expires_at` 后不再计算，直接清空

## 后台低频心跳任务

建议每 6 小时或 12 小时运行一次。

每次处理 `service_active=true` 的用户：

1. 检查 `now > expires_at`
2. 如果已过期：
   - `service_active = false`
   - `onboarding_day = null`
   - `adoption_state = null`
   - `dominant_scene = null`
3. 如果未过期：
   - 更新 `onboarding_day`
   - 按时间段更新 `adoption_state`
   - 固定 `dominant_scene=summarize`

## 推荐判定逻辑

### adoption_state

- 第 1-2 天：`not_started`
- 第 3-4 天：`first_success`
- 第 5-7 天：`habitual`

### dominant_scene

- 测试阶段固定为 `summarize`

## 决策优先级

Open Claw 的运行优先级应始终是：

1. 用户明确任务和明确设定
2. `service_active`
3. `adoption_state`
4. `onboarding_day`
5. `dominant_scene`
6. 是否适合主动触达

这意味着：

- 用户明确时直接执行
- 服务未生效时完全忽略上手规则
- 有服务时，以测试期默认 `adoption_state` 决定当前最优策略
- 测试阶段 `adoption_state` 由 `onboarding_day` 直接推导
