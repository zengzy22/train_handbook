# Repnote 通用 MCP 授权实现

## 决策

Repnote 保留 Sites 原生用户登录和现有 D1。`/mcp` 使用 Sites 原生插件认证；`/agent/mcp` 使用 Repnote 下游 OAuth 委托令牌。两个入口复用同一工具与数据服务，均仅能访问通过平台登录确认的所有者数据。

站点保持原有 public 路由可达性，使远程客户端能发现 OAuth、注册客户端、交换令牌。网页、数据、导入与授权管理仍检查 `REPNOTE_OWNER_ID`。公开路由不等于公开训练数据。不得把 Sites 的账号管理 ID 当作 Site-scoped user ID；本轮配置取自现有数据所属的 Site 用户 ID。

本轮读取的 Sites 资源元数据指向 `https://auth.openai.com`，其 OIDC 发现支持 code、PKCE S256、刷新与撤销，但未发布第三方客户端注册入口及 Repnote read/write scopes。因此增加委托授权层，而不更换或模拟平台用户登录。

## 接口

| 接口 | 认证与用途 |
| --- | --- |
| `GET /.well-known/oauth-protected-resource/agent/mcp` | 公开 RFC9728 资源发现 |
| `GET /.well-known/oauth-authorization-server` | 公开 RFC8414 授权服务器发现 |
| `POST /oauth/register` | RFC7591 公共客户端注册，`token_endpoint_auth_method=none` |
| `GET /oauth/authorize` | Sites 登录后，仅 owner 可预览并批准权限 |
| `POST /oauth/consent` | 同源 owner 表单与一次性 pending ID；批准或拒绝 |
| `POST /oauth/token` | code + PKCE S256，或轮换 refresh token |
| `POST /oauth/revoke` | 持有令牌及对应 client ID，可撤销整条授权 |
| `GET/DELETE /api/agent-grants` | owner 在网页查看与断开各条授权 |
| `POST /agent/mcp` | Bearer 访问令牌，按授权 scope 暴露并执行工具 |
| `POST /mcp` | Sites 原生身份 + owner 校验，原生连接具备完整工具权限 |

`repnote:read` 与 `repnote:write` 独立，不隐式升级。授权页面显示客户端名称、精确回调地址和权限；只有明确批准后才创建 grant。读写工具没有删除能力。修改或删除本人 profile 仍使用网页。

## 凭据与隔离

- Code、access、refresh 是 256 位随机 opaque 字符串，D1 仅存 SHA-256 摘要。
- Code 五分钟过期，只能兑换一次；访问令牌一小时过期；刷新令牌三十天过期。
- 每次刷新使原 refresh token 失效。重放会撤销该授权，包括新旧访问令牌。
- 每次 MCP 调用均检查 grant 是否撤销，网页断开连接立即生效；其他 grant 不受影响。
- 资源地址来自 `REPNOTE_ORIGIN`，严格匹配 `/agent/mcp`；回调精确匹配注册列表。仅接受 HTTPS 或 HTTP loopback 回调，不跟随注册 URL 发起服务端抓取。
- 公共客户端不使用 shared client secret；授权码保护依赖强制 S256 PKCE。当前不实现 client credentials 或 CIMD。
- 浏览器 MCP Origin 必须是站点自身或已注册回调的 origin；服务端客户端可以不发 Origin。预检只声明允许的方法和头，不代表调用授权。
- 用户主体来自 Sites 的受信身份头；Agent 主体来自已批准 grant。`/agent/mcp` 不把网页身份头当作 token。业务参数不能指定 userId。
- 所有者配置缺失时拒绝请求，绝不自动把首个访问者设为 owner。开发模拟身份仅使用 starter 的本地机制。
- 注册与令牌操作按平台 IP 每分钟限流；授权表通过 Drizzle 迁移创建，不在请求时创建表。

## 数据一致性

网页和 MCP 复用严格 Zod schema、资料归属校验与同一 D1 数据访问层。创建的 `requestId` 按 owner 唯一，保存原始规范化请求指纹；记录被编辑或移到别的资料后，原请求重试仍返回同一记录。更新要求读取时的 `expectedUpdatedAt`，只对匹配版本执行原子更新；冲突返回明确错误。

## 验证边界

本地集成覆盖授权发现、owner-only、拒绝授权、回调/PKCE/resource 检查、scope、过期、轮换与重放、单授权撤销，以及通过 bearer 写入后的网页读取一致性。第三方产品的 UI/账户许可不由服务端保证；产品兼容性应如实记录，不能把协议测试当作各产品已实测。

官方标准：[MCP 授权](https://modelcontextprotocol.io/specification/2025-11-25/basic/authorization)、[Streamable HTTP](https://modelcontextprotocol.io/specification/2025-11-25/basic/transports)。
