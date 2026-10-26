# Repnote · 训练手记

个人训练日志：逐组重量、次数、时间、休息、RPE、热身/完成标记；支持同一组内依次完成多个动作。独立计划模板、训练日历与趋势分析。一个登录账号可管理多位用户的独立资料与训练数据。支持私有 Sites 云端数据、只读 MCP 和 JSON/CSV 导出。

## 本地开发

要求 Node.js ≥22.13.0。安装锁定依赖并生成本地 Worker 配置：

```sh
npm run install:ci
npm run build
node --import ./scripts/sites-env.mjs ./node_modules/wrangler/bin/wrangler.js d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0000_shocking_dust.sql
npm run dev
```

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
- `app/mcp/route.ts`：只读 JSON-RPC MCP。
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

`POST /mcp` 支持 `server/discover`（2026-07-28）、`tools/list`、`tools/call`，并兼容传统 initialize。平台为原生插件认证，工具继续检查站点用户身份，不提供 AI 写入。

「AI 与数据」可导出全部 JSON，以及用户、训练、每组、计划、身体指标五类 CSV。JSON 包含 schemaVersion、导出时间、资料关联 ID、单位定义和来源；CSV 保留原始行与 ID，并转义表格公式。其他 AI 可以读取这些导出文件。私有 MCP 地址本身不是访问凭据；实时外部集成需要额外的平台服务认证与用户授权，不声称支持任意客户端免配置连接。

## 部署与安全

遵循 Sites 技能，经 source helper 同步、打包后私有发布。平台提供登录与访问边界；所有个人记录仍按站点用户 ID 隔离。不要提交 `.wrangler/`、`.sites-runtime/`、环境文件或凭据，不向生产库写入演示/验收数据。
