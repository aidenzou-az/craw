# API 规范草案

## API 入口约定

优先级如下：

1. 如果系统提供了 `OPEN_CLAW_ONBOARDING_API_BASE_URL`，则使用该值作为 API 基础地址
2. 如果系统没有提供该变量，则使用 skill 中写明的默认基础地址

其中：

- `OPEN_CLAW_ONBOARDING_API_BASE_URL` 可以由系统提供，也可以在 skill 中提供默认值
- onboarding token 不由 skill 内置，也不要求系统预注入
- Open Claw 应通过 token 获取接口换取用户专属 token，并保存在本地私有状态中

以下文档中的路径均相对于：

- `{OPEN_CLAW_ONBOARDING_API_BASE_URL}`

## 1. 核销懒人包权益

### 接口

`POST {OPEN_CLAW_ONBOARDING_API_BASE_URL}/api/open-claw/onboarding-redeem`

### 用途

供 Open Claw 在已确认资格并拿到 onboarding token 之后，正式核销懒人包权益并启动 7 天上手服务。

### 认证

该接口应使用宿主平台身份校验，与 token 获取接口保持一致。

### 请求体示例

```json
{
  "user_id": "u_123",
  "open_claw_id": "oc_123",
  "benefit_code": "feishu_lazy_pack_onboarding"
}
```

### 成功响应

```json
{
  "success": true,
  "data": {
    "redeemed": true,
    "service_active": true,
    "expires_at": "2026-03-26T10:00:00Z"
  }
}
```

### 约束

- 必须幂等
- 同一用户同一 Open Claw 重复请求不应重复扣减权益
- 如果权益不存在、已失效或已被核销，应返回明确错误码
- 核销成功后才开始计算 `activated_at / expires_at`

### 推荐错误码

- `BENEFIT_NOT_FOUND`
- `BENEFIT_ALREADY_REDEEMED`
- `BENEFIT_EXPIRED`

## 2. 获取 onboarding token

### 接口

`POST {OPEN_CLAW_ONBOARDING_API_BASE_URL}/api/open-claw/onboarding-token`

### 用途

供 Open Claw 在首次使用 7 天上手服务时，为当前用户换取一个用户专属 onboarding token。

### 认证

这个接口不能裸开放，必须依赖更上层的宿主身份校验。

推荐使用飞书宿主身份作为一级认证来源。

可选方式包括：

- 飞书宿主 access token 或 session token
- 安装实例签名
- 飞书侧可验证的用户身份凭证

该接口的核心目标是：只为当前真实用户和当前 Open Claw 实例签发用户专属 token，并确认其具备启动 onboarding 服务的资格，但不在此接口消耗权益。

### 请求体示例

```json
{
  "user_id": "u_123",
  "open_claw_id": "oc_123"
}
```

### 成功响应

```json
{
  "success": true,
  "data": {
    "onboarding_token": "otk_xxx",
    "expires_at": "2026-03-26T10:00:00Z",
    "token_ttl_seconds": 604800
  }
}
```

### 约束

- token 必须是用户专属的，不能多个用户共用
- 推荐按 `user_id + open_claw_id` 绑定
- token 只允许访问 onboarding 相关接口
- token 必须支持失效和轮换
- Open Claw 获取到 token 后应保存在本地私有状态中，后续复用，不要每轮重复换取

## 3. 获取上手服务状态

### 接口

`GET {OPEN_CLAW_ONBOARDING_API_BASE_URL}/api/open-claw/onboarding-status`

### 用途

供 Open Claw 按低频心跳拉取当前 7 天上手服务状态。

### 认证

请求头：

```http
Authorization: Bearer <onboarding_token>
```

其中 `<onboarding_token>` 必须来自 onboarding token 获取接口返回，并由 Open Claw 保存在本地私有状态中。

该 token 必须满足：

- 每个用户不同
- 推荐进一步绑定 `open_claw_id`
- 仅允许访问 onboarding 相关接口
- 支持失效和轮换

### 成功响应

```json
{
  "success": true,
  "data": {
    "service_active": true,
    "onboarding_day": 3,
    "adoption_state": "first_success",
    "dominant_scene": "summarize",
    "expires_at": "2026-03-25T10:00:00Z",
    "heartbeat_ttl_seconds": 21600
  }
}
```

### 字段定义

- `service_active`
  当前 7 天服务是否仍生效

- `onboarding_day`
  当前是启用后的第几天，仅作默认节奏参考

- `adoption_state`
  用户当前实际采用状态，可选值：
  - `not_started`
  - `first_success`
  - `repeated`
  - `habitual`

- `dominant_scene`
  当前建议优先强化的高频场景，可选值：
  - `summarize`
  - `draft`
  - `organize`
  - `null`

- `expires_at`
  服务结束时间

- `heartbeat_ttl_seconds`
  下一次状态刷新前建议至少等待多久。推荐值为 `21600`

### 服务结束响应

```json
{
  "success": true,
  "data": {
    "service_active": false,
    "onboarding_day": null,
    "adoption_state": null,
    "dominant_scene": null,
    "expires_at": "2026-03-25T10:00:00Z",
    "heartbeat_ttl_seconds": 0
  }
}
```

### 错误响应建议

```json
{
  "success": false,
  "error": {
    "code": "UNAUTHORIZED",
    "message": "Invalid token"
  }
}
```

推荐错误码：

- `UNAUTHORIZED`
- `FORBIDDEN`
- `NOT_FOUND`
- `RATE_LIMITED`
- `INVALID_SIGNATURE`
- `INVALID_NONCE`
- `TOKEN_EXPIRED`
- `INTERNAL_ERROR`

## 鉴权与防刷建议

平台 API 必须同时考虑鉴权和防机刷。

推荐采用以下组合：

### 1. 专用最小权限 token

- 为 onboarding 服务单独签发 token
- token 必须是用户专属的，不能多个用户共用
- 推荐按 `user_id` 绑定，最好进一步按 `user_id + open_claw_id` 绑定
- 该 token 只允许访问：
  - `GET /api/open-claw/onboarding-status`
- 不复用用户其他高权限 token
- token 必须支持失效和轮换

### 2. 时间戳与 nonce

每次请求建议额外带上：

- `X-Onboarding-Timestamp`
- `X-Onboarding-Nonce`

服务端校验：

- 时间戳在允许窗口内，例如 5 分钟
- nonce 不可重复使用

这样可以降低重放请求风险。

### 3. 请求签名

如果宿主环境支持，建议增加签名头，例如：

- `X-Onboarding-Signature`

签名内容可基于以下字段计算：

- HTTP 方法
- 请求路径
- 时间戳
- nonce
- 请求体摘要

服务端校验签名正确后再放行。

### 4. 频率限制

对 onboarding API 做独立限频。

建议：

- `POST /onboarding-redeem`：按宿主身份 + user_id + open_claw_id 幂等控制和限频
- `POST /onboarding-token`：按宿主身份 + user_id + open_claw_id 限频
- `GET /onboarding-status`：按 token + user_id 限频，结合 `heartbeat_ttl_seconds` 使用

如果触发限频，返回：

- `429 RATE_LIMITED`
- 并附带 `retry_after_seconds`

### 5. 异常行为拦截

如果检测到以下异常，可直接拒绝或冻结 token：

- 重复异常核销
- 高频重复换取 onboarding token
- 高频重复拉状态
- 重复 nonce
- 无效签名
- 单个 token 在异常多 user_id 上使用
- token 对应的 user_id 与实际资源归属不一致

### 6. 失效策略

一旦服务结束或 token 被吊销：

- `service_active=false`
- token 可以继续返回只读的结束状态
或
- token 直接失效，返回 `UNAUTHORIZED`

推荐优先返回结束状态，便于 Open Claw 平滑退出。

## 4. 内部初始化接口

### 接口

`POST /internal/onboarding-services/activate`

### 用途

在用户购买飞书懒人包或启用该服务时初始化上手服务记录。

### 请求体

```json
{
  "user_id": "u_123"
}
```

### 服务端初始化逻辑

- `service_active = true`
- `activated_at = now`
- `expires_at = now + 7 days`
- `onboarding_day = 1`
- `adoption_state = not_started`
- `dominant_scene = null`
