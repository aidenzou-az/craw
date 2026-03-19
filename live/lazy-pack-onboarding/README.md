# Lazy Pack Onboarding

这里沉淀飞书懒人包用户的 Open Claw 7 天上手服务方案。

目标是帮助刚安装 Open Claw 的小白用户，在前 7 天里尽快把那些“懒得做、但又不得不做”的事情交给 Open Claw，并逐步形成使用习惯。

## 文档入口

- [`product-plan.md`](./product-plan.md)：产品目标、用户洞察、核心机制和成功标准。
- [`service-architecture.md`](./service-architecture.md)：服务架构、职责分层、低频心跳机制和运行流程。
- [`api-spec.md`](./api-spec.md)：平台 API 设计、字段定义、请求响应和错误处理建议。
- [`state-machine.md`](./state-machine.md)：采用状态机、心跳更新逻辑和状态判定规则。
- [`token-exchange-design.md`](./token-exchange-design.md)：token 获取接口的认证来源、claims 设计、校验、轮换和吊销规则。
- [`client-runtime-state.md`](./client-runtime-state.md)：Open Claw 本地私有状态结构、缓存刷新、失效恢复和心跳调度规则。
- [`skill.md`](./skill.md)：最终可上线的 Open Claw 上手服务技能文档。
- [`../../apps/openclaw-onboarding/`](../../apps/openclaw-onboarding/)：Node.js 原型实现，包含 serverless handlers、runtime mock 和测试。

## 当前实现形态

当前工程原型已经按 EdgeOne Pages 的 Edge Functions 形态整理，并为 KV 持久化预留了接入点。

## 核心原则

- 不改变 Open Claw 原有身份。
- 不覆盖用户已有设定。
- 只在前 7 天内提供轻量上手服务。
- 7 天后完全退出，像从未存在过一样。
- 优先帮助用户把“懒得做但不得不做”的事交给 Open Claw。
