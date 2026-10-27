# Repnote · 训练手记

个人训练日志：逐组重量、次数、时间、休息、RPE、热身/完成标记；支持同一组内依次完成多个动作。独立计划模板、训练日历与趋势分析。仅所有者登录访问，可管理多位对象的独立资料。支持 Sites 云端数据、OAuth MCP 读写和 JSON/CSV 导出。

## 本地开发

要求 Node.js ≥22.13.0。安装锁定依赖并生成本地 Worker 配置：

```sh
npm run install:ci
npm run build
node --import ./scripts/sites-env.mjs ./node_modules/wrangler/bin/wrangler.js d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0000_shocking_dust.sql
npm run dev
```

运行预览前，按 `dev.vars.example` 创建忽略的 `.dev.vars`。本地 owner 为 `local_seedy`，使用构建后预览时 `REPNOTE_ORIGIN=http://127.0.0.1:5174`；开发服务器则改为其实际 origin。构建后运行：`npm start -- --port 5174 --env-file /你的绝对路径/sites/fitness-log/.dev.vars`。环境文件参数使用绝对路径。生产的 `REPNOTE_OWNER_ID` 必须配置为现有数据所属的 Site-scoped ID，不能使用平台账号管理 ID；`REPNOTE_ORIGIN` 是正式 HTTPS origin。缺少 owner 配置时服务拒绝放行。

开发地址以终端输出为准，默认 `http://127.0.0.1:5173`。开发预览模拟本地用户；不包含真实生产身份或数据。生产数据库与 `.wrangler/state` 本地数据库相互独立。迁移仅对尚未应用的本地数据库执行一次，后续迁移按顺序应用。

```sh
npm test                       # 领域行为测试
npm run typecheck              # TypeScript 校验
npm run build                  # 完整生产构建
npm start -- --port 5174        # 运行构建后的 Worker
REPNOTE_TEST_ORIGIN=http://127.0.0.1:5174 npm run test:api
```

API 集成测试只能对 localhost/127.0.0.1 执行，生成独立测试用户，验证 CRUD、隔离、输入校验和 MCP，并清理所创建的数据。测试应指向构建后的 Worker；开发服务器会移除手工提供的身份头。

## 项目结构

- `app/fitness-app.tsx`：五个页面、右上角用户切换与资料、训练、计划、身体指标编辑器。
- `app/globals.css`：暖白/石墨/橙色主题、移动端布局与深色偏好。
- `app/api/data/route.ts`：带身份、来源检查和输入验证的 CRUD。
- `app/mcp/route.ts`：Sites 原生 MCP；`app/agent/mcp/route.ts`：通用 OAuth MCP。
- `app/oauth/`、`lib/oauth-*`：基于已有 Sites 登录的下游 OAuth 委托授权；`app/api/agent-grants/`：owner 管理授权。
- `lib/model.ts`：输入契约、单位与日期；`lib/analytics.ts`：统一统计与 CSV。
- `lib/repository.ts`：每次操作都限定用户 ID；`db/schema.ts`、`drizzle/`：D1 表与迁移。

## 数据定义

右上角「用户」可切换、新增和编辑资料。姓名必填，生日、生理性别、身高和健康备注选填；体重、体脂和心率按日期记录在身体指标中。原有记录自动归于默认资料 `self`，无需迁移数据库。切换资料后，训练、计划、日历和分析只显示该资料的数据。资料属于同一个登录账号，不提供跨账号共享。

时间窗口使用 Asia/Shanghai 日期，包含起止两天。容量是**已结束训练中已完成非热身组**的 `重量 kg × 次数` 总和；自重训练填写 0 kg 不会凭空增加外部负重。不同动作容量不能直接代表相同刺激。草稿、未完成组和热身组不计入容量、工作组数或 RPE 均值。

估算 1RM 使用 Epley，只对 1–10 次的负重工作组计算，单次直接采用实际重量；它不等于实测最大力量。热量来自手动或设备读数，不作自动估计，缺失为 null。设备来源表示手动录入设备数据；尚未集成 Apple Health 或自动读取 ChatGPT 健康数据。

每组可填次数、时间（秒）或两者；时间范围保留下限和上限。组间休息同样按秒记录。组合动作在一个组内按顺序保存多个子动作，每项分别有次数、时间和重量；整组只有一个完成状态与休息目标。组合动作的容量逐项按已知重量和次数计算，不估算 1RM。旧的单动作记录无需迁移。

## AI 读取与导出

训练或计划编辑器中的「从图片或文件导入」接受 PNG/JPEG/WebP/GIF 图片、TXT/MD/CSV/JSON 文字文件或直接粘贴文本。识别结果先预览，再替换编辑器中的动作与组；此时仍是未保存草稿。每个动作有独立的组 ID，同名动作也可以分开记录。识别次数、计时范围、休息范围和“深蹲10次＋半蹲跳8次”之类的组合；相对负荷（例如 30% 体重）保存在说明里，不误当作 kg。未识别重量以 0 kg 暂存并提示检查，导入组默认未完成。常见文字格式有无密钥回退。

图片和复杂文字识别需要在 Sites 运行环境中将 `DEEPSEEK_API_KEY` 配置为**密钥**，然后重新部署。服务端使用 DeepSeek `deepseek-flash`；密钥不会下发到浏览器或写入仓库。识别时内容会发送到 DeepSeek，但原始文件不会保存在站点。图片识别未配置时，界面会明确提示；文字仍可按常见格式导入。导入请求仅允许已登录用户及同源页面，限制文件大小，识别结果经过服务端校验。

`.openai/hosting.json` 声明 `mcp` 能力。发布后 Sites 创建专属插件，在 ChatGPT/Codex 的「插件 → 个人 → 由你创建」安装/连接后，可在新任务使用：

- `get_all_fitness_data`：当前账号全部资料和记录的完整快照。
- `list_profiles`：可选资料及基本健康信息。
- `list_workouts`、`list_body_metrics`：可选 `profileId`、`from`、`to`（YYYY-MM-DD）。
- `list_training_plans`：可选 `profileId`。
- `get_training_summary`：可选 `profileId` 与日期范围，统计及计算口径。上述按资料查询默认 `self`。

新增 `create_workout`、`update_workout`、`create_training_plan`、`update_training_plan`、`create_body_metric`、`update_body_metric` 六个写工具。创建要求 UUID `requestId` 和完整 `workout`/`plan`/`metric`；重试复用同一 requestId，不重复创建。更新要求记录 ID、读取时的 `expectedUpdatedAt` 和完整领域对象；版本冲突后重新读取。没有删除或资料管理工具。网页与 MCP 使用同一验证/持久化服务。

`/mcp` 支持 Sites `server/discover`（2026-07-28）及标准 initialize；`/agent/mcp` 提供标准 Streamable HTTP，JSON 响应，无 SSE，GET 返回405。原生入口检查 Sites 身份及 owner；通用入口检查独立 bearer token 和 scope。

通用客户端填写正式 origin 加 `/agent/mcp`，通过 OAuth 发现与动态注册开始连接。只有所有者可登录并批准授权；`repnote:read` 和 `repnote:write` 独立。授权码采用 PKCE S256，令牌仅存摘要；access 一小时，refresh 三十天，刷新轮换并检测重放。数据页可逐条断开外部授权，原生插件在产品插件设置中管理。客户端支持 OAuth/远程 MCP 才能使用；具体产品实测状态见根目录 `docs/agent-connection-matrix.md`。

快照为 schemaVersion 4，记录包含 `createdVia` 和 `updatedVia`，值为 `web` 或 `mcp`。CSV 保留来源。所有网页更新也参与版本检查，冲突保留当前编辑并刷新快照。

「AI 与数据」可导出全部 JSON，以及用户、训练、每组、计划、身体指标五类 CSV。JSON 包含 schemaVersion、导出时间、资料关联 ID、单位定义和来源；CSV 保留原始行与 ID，并转义表格公式。其他 AI 可以读取这些导出文件。私有 MCP 地址本身不是访问凭据；实时外部集成需要额外的平台服务认证与用户授权，不声称支持任意客户端免配置连接。

## 部署与安全

遵循 Sites 工作流，经 source helper 同步、打包后发布，保留 project ID 和 D1。保持现有 public 路由可达性以提供公开 OAuth 发现/交换入口；网页、数据、导入及授权操作仍由应用强制仅 owner 访问，通用 MCP 必须持有 owner 批准的 token。不要提交 `.wrangler/`、`.sites-runtime/`、`.dev.vars`、环境文件或凭据，不向生产库写入演示/验收数据。

本地数据库需依次执行 `drizzle/` 下尚未应用的迁移，既有 SQL 不可重复执行。领域与协议测试：`npm test`；类型检查：`npm run typecheck`；生产构建：`npm run build`；本地 API：`npm run test:api`；OAuth 全流程：`node tests/oauth.integration.mjs`。OAuth 测试同样仅允许 localhost，会清理本轮数据、客户端和 grant 夹具。
