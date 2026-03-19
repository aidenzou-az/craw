# craw

`craw` 是一个面向飞书 Open Craw 相关专项的知识库与工程原型仓库。

这个仓库同时承载两类内容：

- 专项知识沉淀、方案协作、过程记录和决策留痕
- 可运行的 Node.js 原型与后续工程实现

## 仓库定位

- 根目录用于维护跨专项的公共说明和协作规范。
- 一级子目录用于不同子专项。
- 每个子专项内部使用统一结构，方便横向对齐。

当前已初始化的子专项：

- [`live/`](./live/)：飞书 Open Craw 中与直播相关的专项知识库。
- [`apps/openclaw-onboarding/`](./apps/openclaw-onboarding/)：飞书懒人包 Open Claw 7 天上手服务的 Node.js 原型实现。

## 推荐用法

新增一个子专项时，直接新建同级目录，并尽量复用 `live/` 的结构：

- `README.md`：说明专项范围和当前状态。
- `overview.md`：记录背景、目标、边界。
- `todos.md`：维护待办和推进项。
- `decisions/`：沉淀关键方案和取舍。
- `notes/`：记录调研、会议、过程笔记。
- `references/`：沉淀外部资料和内部链接。

## 根目录结构

- [`apps/`](./apps/)：可运行原型与后续工程实现。
- [`shared/`](./shared/)：跨专项共享信息。
- [`templates/`](./templates/)：新专项初始化模板。
- [`live/`](./live/)：直播专项。

## 快速开始

运行懒人包 onboarding 原型测试：

```bash
npm run test:onboarding
```

## 部署到 EdgeOne Pages

当前仓库已经按 EdgeOne Pages 的约定整理：

- 静态首页：[`index.html`](./index.html)
- Edge Functions：[`functions/`](./functions/)
- Node.js 原型实现：[`apps/openclaw-onboarding/`](./apps/openclaw-onboarding/)
- EdgeOne 配置：[`edgeone.json`](./edgeone.json)

部署时建议：

- GitHub 仓库根目录作为 Project Root
- 安装命令使用 `npm install`
- 输出目录保持仓库根目录
- 在 EdgeOne 项目中绑定 KV：`ONBOARDING_KV`

[![Use EdgeOne Pages to deploy](https://cdnstatic.tencentcs.com/edgeone/pages/deploy.svg)](https://edgeone.ai/pages/new?repository-url=https%3A%2F%2Fgithub.com%2Faidenzou-az%2Fcraw)
