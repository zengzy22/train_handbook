# Repnote · 训练手记

私人健身训练管理站点，包含计划、逐组训练日志、训练日历、容量和身体指标分析、只读 MCP 与 JSON/CSV 导出。

应用源码位于 [`sites/fitness-log/`](sites/fitness-log/)，产品范围见[设计说明](docs/fitness-design.md)。站点可从根目录查看：<https://repnote-training-journal.tukututata.chatgpt.site>（私有，需使用授权的 ChatGPT 账户登录）。

## 本地运行

要求 Node.js 22.13.0 或更新版本。所有应用命令均从应用目录执行：

```sh
cd sites/fitness-log
npm run install:ci
npm run build
node --import ./scripts/sites-env.mjs ./node_modules/wrangler/bin/wrangler.js d1 execute DB --local --config dist/server/wrangler.json --persist-to .wrangler/state --file drizzle/0000_shocking_dust.sql
npm run dev
```

开发地址以终端输出为准，通常为 `http://127.0.0.1:5173`。本地迁移只作用于 `.wrangler/state` 中的本地 D1 数据库，不会触碰生产数据。

## 验证与本地 Worker 启动

```sh
cd sites/fitness-log
npm test
npm run typecheck
npm run build
npm start -- --port 5174
REPNOTE_TEST_ORIGIN=http://127.0.0.1:5174 npm run test:api
```

`test:api` 仅接受 `localhost` 或 `127.0.0.1`，会使用独立测试用户并清理测试数据。

## 配置与安全

图片和复杂文本导入在部署环境中需要服务器端密钥 `DEEPSEEK_API_KEY`。将其在 Sites 部署设置中配置为密钥；不要提交真实值。[`sites/fitness-log/.env.example`](sites/fitness-log/.env.example) 只说明变量名称，项目的 `.gitignore` 会排除环境文件、密钥、依赖、构建产物和本地数据库状态。
