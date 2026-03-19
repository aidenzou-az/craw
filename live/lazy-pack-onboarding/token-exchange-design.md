# Token Exchange 设计

## 目标

为 `POST /api/open-claw/onboarding-token` 提供一个可工程落地的认证与签发方案，使 Open Claw 能为当前真实用户换取一个用户专属 onboarding token，并将其本地保存，用于后续状态获取。

## 设计原则

- onboarding token 不能裸开放换取
- onboarding token 必须用户专属
- 最好进一步绑定 `open_claw_id`
- onboarding token 只允许访问 onboarding 相关接口
- token 必须支持过期、轮换、吊销
- token 获取接口本身也要防刷、防重放

## 建议的认证来源

`POST /api/open-claw/onboarding-token` 不应依赖普通用户手填信息，而应依赖宿主平台身份。

推荐使用已注册宿主的身份作为一级认证来源。

宿主需先通过 `POST /api/open-claw/host-register` 完成一次性绑定，之后 token 获取接口只接受宿主 access token 请求。

推荐使用以下组合：

### 必选

- `user_id`
- `open_claw_id`
- `X-Host-Id`
- `Authorization: Bearer <host_access_token>`

### 推荐

- `X-Host-Timestamp`
- `X-Host-Nonce`

## 推荐请求格式

### 请求头

```http
Authorization: Bearer <host_access_token>
X-Host-Id: host_xxx
X-Host-Timestamp: 1742366400
X-Host-Nonce: 7b3de9b2-4b9a-4a8d-bbf8-7c3b7a6d1d9f
Content-Type: application/json
```

### 请求体

```json
{
  "user_id": "u_123",
  "open_claw_id": "oc_123"
}
```

## 服务端校验逻辑

服务端收到请求后，按以下顺序校验：

1. 校验 `host_id` 是否存在且状态可用
2. 校验 `open_claw_id` 是否确实归属于该宿主
3. 校验 `user_id` 对应权益绑定的 owner 身份是否与宿主 owner 一致
4. 校验 `host_access_token` 是否与该宿主绑定且未失效
5. 校验时间戳是否在允许窗口内，例如 5 分钟
6. 校验 nonce 是否未被使用
7. 校验该 `user_id + open_claw_id` 是否已存在有效 onboarding token

如果已存在有效 token，可以：

- 直接返回原 token
或
- 轮换后返回新 token

推荐第一期直接返回当前有效 token，避免重复签发。

## onboarding token claims 设计

推荐把 onboarding token 设计成带 claims 的短期凭证，例如 JWT 或服务端 session token。

推荐包含：

- `iss`
- `sub`
- `user_id`
- `open_claw_id`
- `scope = onboarding`
- `allowed_endpoints`
- `iat`
- `exp`
- `jti`

其中：

- `user_id`：绑定用户
- `open_claw_id`：绑定具体 Open Claw 实例
- `scope`：限制用途
- `allowed_endpoints`：限制访问范围
- `jti`：便于吊销和追踪

## token TTL 建议

推荐让 onboarding token 的有效期不超过服务窗口。

建议：

- `token_exp = min(service_expires_at, now + 7 days)`

如果用户服务只剩 2 天，token 最多也只签 2 天。

## token 返回格式

```json
{
  "success": true,
  "data": {
    "onboarding_token": "otk_xxx",
    "expires_at": "2026-03-26T10:00:00Z",
    "token_ttl_seconds": 604800,
    "scope": "onboarding"
  }
}
```

## 吊销策略

以下情况可吊销 token：

- 服务窗口结束
- 用户取消懒人包服务
- 检测到异常频率或异常 user_id 使用
- 检测到签名异常或重放攻击
- 同一 `open_claw_id` 被替换或重建

建议维护一张 `revoked_token_jti` 表或服务端 token 状态表。

## 轮换策略

推荐支持两种轮换方式：

### 被动轮换

当状态接口返回：

- `UNAUTHORIZED`
或
- `TOKEN_EXPIRED`

Open Claw 可重新调用 token 获取接口换取新 token。

### 主动轮换

当服务端判断当前 token 临近过期时，允许 token 获取接口直接返回新 token。

## 限频建议

`POST /api/open-claw/onboarding-token` 应独立限频。

建议按：

- `host_id + user_id + open_claw_id`

限频，例如：

- 5 分钟内最多 3 次

超过后返回：

- `429 RATE_LIMITED`
- `retry_after_seconds`

## 异常拦截建议

如出现以下情况，直接拒绝：

- `host_id` 无效或已停用
- `open_claw_id` 不属于该用户
- 重复 nonce
- 无效签名
- 高频重复换 token
- 已结束服务仍尝试换 token

## 第一版实现建议

第一期建议采用较稳妥的实现：

- `host_id` 识别宿主实例
- 服务端校验 `user_id` 和 `open_claw_id`
- 增加 `host_access_token` + 时间戳 + nonce
- token 绑定 `user_id + open_claw_id`
- token 只允许访问 onboarding 相关接口

这套方案已经足够进入工程实现。

## 与权益核销的关系

推荐先换 token，再核销。

顺序如下：

1. 调用 `POST /api/open-claw/onboarding-token`
2. token 获取成功后，再调用 `POST /api/open-claw/onboarding-redeem`

服务端在 token 获取接口也应再次校验：

- 当前用户是否具备懒人包权益
- 当前 Open Claw 是否归属于该用户
