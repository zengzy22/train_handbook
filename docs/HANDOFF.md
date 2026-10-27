# Repnote Handoff

## 2026-10-27 导入面板与常驻训练操作（版本 26）

已发布至原站点，部署 `appgdep_6ae07ea1c9788191991ab33da2bda577` succeeded，环境 revision 3，MCP 保持可用。

源提交 `ac0b236f294d89d092ae3ff7a82e76228534b8da`。按用户 frontend-design 要求沿用黑白 iOS 风格：导入面板白色底与边框，居中 ImagePlus 上传入口，上传与粘贴共用浅灰输入容器；移除指定的隐私和保存前说明文案，识别预览仅保留动作、组数、实际警告和应用按钮。文件选择、内容拆分、解析服务沿用，抽出共享 `app/import-panel.tsx`；未配置图片识别时仅在已选图片后显示可操作的替代提示。

“全部标记完成”使用可识别的胶囊按钮，完成后显示禁用的“已全部完成”。移除正文尾部结束训练复选框；常驻 footer 并排提供“保存草稿”和“结束训练”，完成记录编辑时显示“改为草稿”和“保存训练”。saveEditor 显式接收状态并在同次保存中验证，避免 setState 后读取旧状态；结束训练不会自动改动逐组完成状态。

34 项测试、typecheck、Sites 构建、diff check 通过。浏览器验证文字文件选择→识别 2 动作/7 组→应用→全部完成→结束训练→重新打开→改为草稿；UI 与本地 API 核实组数据、完成标记和状态均已持久化，并删除唯一一条本地测试记录。直接粘贴识别得到 1 动作/3 组。320、375、393、440、1334px 与手机深色预览无横向溢出，上传入口居中、底栏始终可见，手机按钮高 52px。没有写入生产训练记录，没有真实 iPhone 或外部图片模型识别复测。截图 `docs/qa/2026-10-27-import-*.png`。

## 2026-10-27 iOS 日期控件尺寸（版本 25）

已发布至原站点，部署 `appgdep_6ae077587394819199a24d0124f60600` succeeded，环境 revision 3，MCP 保持可用。

源提交 `c0fc3dca1a1544c06ad227f35cf3ac5e4339b5f8`。`app/date-field.tsx` 包装原生 date input，训练日期、身体指标日期和出生日期共用。外层负责内边距、圆角和边框，原生输入 padding 为 0，规避 iOS 的日期输入 width:100% 与 padding 计算问题（WebKit 301648）；保留原生日期选择、事件和日期字符串。输入使用 inline-flex，并约束 WebKit 内部值的最小高度与单行显示。删除训练标签 overflow:hidden 的裁切；共享表单控件手机端 50px、桌面 44px，日期与相邻输入和选择框对齐。

typecheck、Sites 构建和 diff check 通过。浏览器检查 320、375、393、440、1334px：日期外框没有越过标签，与来源/时长高度一致，页面无横向溢出；两个表单修改到 2026-12-31 后值保持正确。仅使用未保存的本地表单，没有写入训练数据；没有真实 iPhone 复测，桌面预览无法复现 iOS 专有缺陷。截图：`docs/qa/2026-10-27-date-{metric,workout}-mobile.png`。

## 2026-10-27 逐组编辑与手机交互（版本 24）

已发布至原站点，部署 `appgdep_6ae0753b0f008191819ba60cb5bf5e16` succeeded，环境 revision 3，MCP 保持可用。源提交 `e848a48d2461dd4b129f7c1c200a0c6640603ddb`。

共享的 `app/set-editor.tsx` 同时服务训练记录和计划。每组右侧固定“…”打开四个可反选项：热身、说明、时间范围、休息范围；热身用左侧“热”标记替代组号。当前编辑中反选再选会恢复刚才填写的说明和上限。菜单通过 portal 避免被横向滚动容器裁切，支持外部点击、Escape 和方向键。单个/组合切换保留组数据；组合转单个按用户要求仅保留第一个子动作。组间用间距替代分割线，触控操作使用更大的点击区域。

RPE 使用共享 `rpeSchema`，允许未知 null 或 0–10 的 0.5 刻度；输入框、加减按钮、Web/MCP 写入、导入校验和导入提示一致。新增规则与转换回归，API 测试验证 RPE 0 持久化以及 Web/MCP 拒绝非法刻度。

34 项测试、typecheck、构建、diff check、本地 CRUD/MCP 与 OAuth 集成通过；测试夹具均已清理。浏览器检查 320×740、375×812、1334×815 的参数横滑、菜单边界、反选恢复、组合切换、RPE 0/10 边界、深色计划和保存后重新打开。仅创建并清理了一条本地 UI 记录，未写入生产训练数据。此为浏览器视口验证，未使用真实 iPhone。截图：`docs/qa/2026-10-27-set-editor-*.png`。

## 2026-10-27 近半圆连续胶囊（版本 23）

已发布至原站点，部署 `appgdep_6ae06f773cd48191a903a581b5daab74` succeeded，环境 revision 3，MCP 保持可用。

根据手机端反馈，进一步把导航两端调整为接近半圆、并在直线连接处保持曲率平顺的轮廓。导航及选中项共用同一 SVG 遮罩；按钮、筛选项、搜索框、状态标签、分段控件、日期和编辑器操作等胶囊也使用同一轮廓，ResizeObserver 按实际宽高确定端部尺寸。支持 WebKit 遮罩的手机浏览器使用曲线，不支持的浏览器保留普通圆角胶囊作为回退。

验证 375×812、440×956、1334×815 的浏览器预览与深浅色，页面无横向溢出；导航 6px 内距、搜索、筛选、页面切换和编辑器动态按钮正常。31 项测试、类型检查、构建和 diff check 通过，仅使用并清理了一条本地 UI 测试记录。手机截图：`docs/qa/2026-10-27-continuous-capsule-mobile.png`。源提交 `d47d2f4437a8c5f7bd2e9fd026f21a65fba0b9f3`。

## 2026-10-27 导航大圆角（版本 22）

调整导航外框和选中项的连续曲率 SVG 轮廓，使两者呈现大圆角胶囊形；保留 6px 等距内边距。桌面 1334×815 与手机 375×812 预览已检查，手机端切换至末项时上下和右侧均为 6px，页面没有横向溢出。typecheck、Sites 构建与 diff check 通过。源提交 `a0383f24c6fd132893d9588fa11fbde9c66283e6`，截图在 `docs/qa/2026-10-27-dock-pill-*.png`。

## 2026-10-27 单行动作标签与连续曲率导航（版本 21）

已发布至原站点，部署 `appgdep_6ae0640f6aac8191867699d627db0f1f` succeeded，环境 revision 3，MCP 保持可用。

训练首页、日历列表、计划卡片和首页计划摘要使用共享 `app/exercise-chips.tsx`。按动作名去重、按肌群着色，ResizeObserver 根据实际宽度保留一行，溢出显示准确的 `+n`；单个过长动作截短，辅助说明保留完整名称。列表不再渲染训练备注，编辑器仍保留原始备注。未修改数据模型或生产记录。

导航四边统一 6px 内距，移除手机端横向 3px / 纵向 7px 的不一致；外容器和选中项使用连续曲率 SVG 九切片轮廓，兼容未实现 CSS corner-shape 的浏览器。已检查 375×812、440×956、578×827 和 1280×900 的布局、深浅色、首页/日历/计划切换、长名称截断、`+n` 随宽度变化和编辑器备注保留。页面无横向溢出，标签行高 26px，导航选中项上下及起始侧均为 6px。31 项测试、typecheck、Sites build 和 diff check 通过。仅创建并清理了 4 条本地 UI 测试记录；截图在 `docs/qa/2026-10-27-exercise-tags-*.png`。源提交 `8334e4e3c7bcb1d60750c023b0f2bc00c3b5b5df`。

## 2026-10-27 OAuth 浏览器表单修复

真实浏览器提交授权表单报“不允许跨站授权操作”。根因：`/oauth/*` 的 `Referrer-Policy: no-referrer` 会让原生 form POST 携带 `Origin: null`；早先集成测试手工提供 Origin，漏掉了浏览器策略影响。本轮将该策略改为 `same-origin`，保留服务端严格同源检查和离站 referrer 隐藏。浏览器最小复现由 null/拒绝变为真实 origin/通过；OAuth 集成增加响应头断言，以及跨站、null、缺失来源均拒绝的回归。31 项测试、类型检查、构建与完整本地 OAuth 集成通过；一次本地 Worker 短暂 503 后逐项请求正常，整套重跑通过。未改动生产训练记录。修复源提交 `e0d796d76f49489a195b55b53ab4fc9ad13664c1`，版本 20，部署 `appgdep_6ae0466717808191b3d69250184d4be5` 成功、环境 revision 3。

## 2026-10-27 iOS 风格界面（版本 19）

已发布源提交 `7bd8c783cef23490c3acba20494a2a89a3a0d236`，部署 `appgdep_6ae019c3fe58819180fe83c249a8f165` 成功。版本 19 同时修复了桌面顶部导航被 sticky 页头遮挡的问题：导航层级高于页头，低于编辑弹窗。

- `app/feeling-rating.tsx`：整体体感改为黑白递进高度的五级选择，支持键盘方向键和清除。沿用 `feeling: 1–5 | null`，1 很疲惫、5 状态很好；没有把既有体感重新解释为实际耗能。
- `app/fitness-app.tsx`：每组重量、次数、时间、休息、MCV、RPE 与完成状态在同一行；范围上限作为同一行额外字段。组合子动作也按单行参数排列。
- `app/globals.css`：单位置于输入格左上角，统一参数行样式。仅给关键数值着色：训练次数绿、容量/RPE 紫、时长/MCV 青、热量橙，深色模式使用对应的较亮色。

验收覆盖生产页面的 440×956、375×812、1280×900 视口与深浅色。440px 下六项常用参数和完成按钮同时可见，轨道 clientWidth/scrollWidth 均为 370px；窄屏、组合动作和范围上限只在动作卡片内横滑，页面没有横向溢出。核对了数值输入、复制一组、组合动作、时间上限、等级选择与键盘切换。所有生产 UI 验收均为未保存草稿；前后生产记录 ID 一致，共 5 条。

验证命令：`npm test`（31/31）、`npm run typecheck`、Sites 生产构建、本地 `npm run test:api` 与 `node tests/oauth.integration.mjs` 均通过，本地测试记录和授权均已清理。本地预览服务器已关闭。截图保存在 `docs/qa/2026-10-27-set-row.png`、`docs/qa/2026-10-27-rating.png`、`docs/qa/2026-10-27-metric-colors.png`。

## 2026-10-27 MCP 读写升级（已发布）

应用有独立 Git 仓库；原“根仓库无提交”不代表应用缺少版本历史。实现分支为 `codex/repnote-mcp-write`，基线 `10efb97`。新增通用 `/agent/mcp` 与 owner 批准的 OAuth code/PKCE 授权、独立读写 scope、刷新轮换与逐授权撤销；原生 `/mcp` 共用 12 个读写工具。所有数据入口强制 owner，保留原有 public 路由可达性以供公开 OAuth 元数据与令牌交换使用。

快照 v4 增加 createdVia/updatedVia，D1 迁移 `0001` 增加来源与幂等信息，`0002` 增加 OAuth 表。网页/API/MCP 共享严格校验；创建 requestId 幂等，更新 expectedUpdatedAt 乐观并发。不得在生产重复手工执行迁移，Sites 发布应用尚未执行的迁移。

生产已设置 `REPNOTE_OWNER_ID`（实际 Site-scoped 所有者 ID，作为 secret）和 `REPNOTE_ORIGIN`（正式 HTTPS origin），环境 revision 3。本轮部署版本 17 成功；随后并发 UI 更新为版本 18，源提交 `5ee02bbb1e606be13e457cd5efc804ea44a649ba`，部署 `appgdep_6ae01841bb708191ae83ec7259f66b32` 成功且 has_mcp=true、环境 revision 3。

验证：31 项测试、typecheck/build、本地 API/OAuth 集成通过；生产公开元数据 200，匿名数据/MCP 401，站主登录可读现有记录及加载连接管理页。所有写测试仅使用本地 D1。ChatGPT 自定义连接、Muse、OpenClaw 客户端 UI 未逐个实测。连接说明见 `docs/agent-connection-matrix.md`，授权设计见 `docs/mcp-authorization-design.md`。

以下为此前 UI 交接历史；其中只读 MCP 和 owner/private 状态描述由本节及最新部署记录取代。

## 当前状态

Repnote 是一个自适应的中文训练日志，已发布到 [生产站点](https://repnote-training-journal.tukututata.chatgpt.site/)。当前 Sites 项目为 `appgprj_6ad8339aa95481918164182d67dc4d37`，版本 16，部署 `appgdep_6adf03646b448191b910c9982e79dc04`，平台源版本 `10efb97942f71d5583343cbb86bda4f901ed8499`。发布 audience 实际为 `public`；页面可访问，但数据 API、导入接口和 MCP 都要求 Sites 身份，并按站点用户 ID 隔离。

手机端训练编辑器已完成重排。验收视口为 440×956，补测 375×812：普通组字段可读，组合动作按两列分三行显示，触控按钮至少 44px，长表单可滚动且底部保存按钮持续可见。版本 16 进一步修复了 iOS 原生日期控件撑开网格导致日期与时长重叠、高度不一致的问题，并将导入入口改为带上传图标的灰底大卡片。生产环境的 DeepSeek 识别入口显示为已配置状态。

## 代码与数据流

应用目录为 `sites/fitness-log/`。主要入口：

- `app/fitness-app.tsx`：训练、计划、日历、分析、数据页及全部编辑器。
- `app/globals.css`：桌面、深色和移动端样式；本轮移动端规则位于文件末尾的 `max-width: 640px` / `380px` 区域。
- `app/api/data/route.ts`：资料、训练、计划、身体指标 CRUD。
- `app/api/import-plan/route.ts`：图片/长文本经 DeepSeek 结构化，失败时文字走本地解析。
- `app/mcp/route.ts`：只读 MCP，提供资料、训练、计划、身体指标和区间摘要。
- `lib/model.ts`：Zod 数据契约；`lib/repository.ts`：D1 持久化和用户隔离；`lib/analytics.ts`：统计口径；`lib/import-plan.ts`：本地文本解析。

一次训练包含多个动作，每个动作包含多个组；组合动作把多个子动作保存在同一组的 `components` 中。组可记录重量、次数、时间、休息、MCV、RPE、热身与完成状态。未知值保持 `null`，不要转换成 0；重量输入的空值在单动作界面暂存为 0 kg。

## 本地运行与验证

需要 Node.js 22.13.0 或更高版本：

```sh
cd sites/fitness-log
npm run install:ci
npm run dev
npm test
npm run typecheck
npm run build
```

API 集成测试必须只对本地构建运行：

```sh
npm start -- --port 5174
REPNOTE_TEST_ORIGIN=http://127.0.0.1:5174 npm run test:api
```

本轮结果：领域测试 17/17 通过，TypeScript 校验通过，生产构建通过；生产页面已用 440×956 复验新增训练、组合动作、导入入口和固定保存操作。

## 部署、密钥与 AI 接入

发布必须继续使用 Sites source workflow，并保留现有 project ID。`DEEPSEEK_API_KEY` 只能配置为 Sites 运行时密钥，不能写入代码、文档或 Git；前端会把用户选中的图片或文字发送给 DeepSeek，原始文件不落库。当前模型名在 `app/api/import-plan/route.ts` 中为 `deepseek-flash`。

MCP 地址为生产域名加 `/mcp`，只读工具包括 `get_all_fitness_data`、`list_profiles`、`list_workouts`、`list_training_plans`、`list_body_metrics` 和 `get_training_summary`。外部 AI 不能只靠 URL 读取私有数据，仍需平台认证和用户授权；不支持的平台使用“数据”页导出的 JSON/CSV 快照。

## 后续重点与风险

1. 当前根 Git 仓库没有提交，文件全部显示为未跟踪；先建立可恢复的本地 Git 基线。上面的提交号属于 Sites 平台源版本，不是本地 Git 历史。
2. audience 为 `public` 与早期“私有站点”表述不一致。数据端已有身份隔离；若目标是连页面也不可公开访问，应在 Sites 发布设置中改为私有并重新验证插件/MCP。
3. DeepSeek 是否能稳定解析真实长截图仍依赖外部模型和密钥。下一轮应以脱敏样例覆盖：长图分片、3 组 3 次、时间范围、休息范围、MCV、相对负荷、组合动作以及摘要行去重。
4. 不要用生产数据做验收写入。任何模型、校验或统计变更，都要同时检查 UI、JSON/CSV、MCP 和分析口径。

## 完成标准

改动交付前至少通过 `npm test`、`npm run typecheck`、`npm run build`，并在 440px 与 375px 宽度下检查训练列表、新增/编辑表单、组合动作、导入预览和五个底部页面。可见改动需在生产版本复验；数据变更需确认所有查询都带站点用户 ID 与资料 ID。
