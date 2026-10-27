# Repnote · 训练手记

个人训练管理站点，支持计划、逐组训练日志、日历、容量与身体指标分析，以及仅本人授权的 MCP 读写和完整数据导出。

应用源码位于 [`sites/fitness-log/`](sites/fitness-log/)。安装、开发、测试、数据库迁移和 AI 连接说明见[应用 README](sites/fitness-log/README.md)。已确认的产品范围见[设计说明](docs/fitness-design.md)。

站点入口：[Repnote · 训练手记](https://repnote-training-journal.tukututata.chatgpt.site)。页面和数据仅所有者登录后可用；OAuth 发现、注册与令牌交换路由公开可达。

通用 MCP：`https://repnote-training-journal.tukututata.chatgpt.site/agent/mcp`。使用 OAuth 授权，支持独立读取/写入权限与逐连接撤销。原生 Sites 插件继续使用 `/mcp`。见[连接说明](docs/agent-connection-matrix.md)与[授权设计](docs/mcp-authorization-design.md)。
