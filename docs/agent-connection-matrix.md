# Agent 连接说明

通用连接地址：`https://repnote-training-journal.tukututata.chatgpt.site/agent/mcp`

在客户端新增远程 MCP，选择 OAuth（公共客户端，无 client secret）。支持动态客户端注册的客户端可自动读取发现元数据。完成浏览器中的 ChatGPT 登录，核对客户端名称、回调地址与权限，再批准。分析使用 `repnote:read`，创建/修改使用 `repnote:write`，需要同时读写时请求两项。

授权后调用 `list_profiles` 确认连接，再读训练数据。写入前核对 profileId、日期、单位和完成状态。创建时为一次逻辑操作生成一个 UUID requestId，重试必须复用；更新前读取最新记录并携带 expectedUpdatedAt。遇到冲突重新读取，不盲目覆盖。

| 客户端 | 接入方式 | 验证状态 |
| --- | --- | --- |
| 标准 HTTP 测试客户端 | 发现 → 动态注册 → owner 授权 → code/PKCE → bearer MCP | 本地集成通过，包含读写、scope、过期、刷新重放、撤销；线上发现与匿名拒绝已验证 |
| ChatGPT / Codex 原生 Repnote 插件 | Sites 自动创建的个人插件，原 `/mcp` | 已有连接配置；本轮刷新工具列表 |
| ChatGPT 自定义远程连接 | 通用地址 + OAuth，取决于账号的自定义连接功能 | 未在真实账号界面实测 |
| Muse | 通用地址 + OAuth；需客户端实现 Streamable HTTP 与 OAuth | 未实测 |
| OpenClaw | 通用地址 + OAuth；需其 MCP 适配器支持相应标准 | 未实测 |

若客户端要求预先填写 client ID，可使用公开 `/oauth/register` 按其实际 callback 注册，复制返回的 client_id；无需 client secret。若客户端不支持 OAuth 或远程 MCP，不能仅靠安装说明文件获得访问能力，也不提供无鉴权降级接口。

外部授权在训练手记「数据 → 已授权的连接」中逐条断开，访问和刷新令牌随即失效。Sites 原生插件连接仍在 ChatGPT/Codex 的插件设置中管理。令牌由客户端安全保存，不写入 Skill、提示词或代码仓库。
