# Repository Guidelines

## Project Structure & Module Organization

The application lives in `sites/fitness-log/`; run application commands there. `app/fitness-app.tsx` contains the Chinese training UI, and `app/globals.css` defines its responsive themes. Route handlers live in `app/api/data/` and `app/mcp/`. Shared validation, analytics, export, and user-scoped persistence are under `lib/`. D1 schema and generated migrations live in `db/` and `drizzle/`. Tests are in `tests/`; product decisions are documented in root `docs/`.

## Build, Test, and Development Commands

Use Node.js 22.13.0 or later.

- `npm run install:ci`: install the starter's locked dependencies.
- `npm run dev`: start the local Vinext preview with development sign-in.
- `npm run build`: build the Cloudflare Worker and browser assets.
- `npm run typecheck`: validate TypeScript without emitting files.
- `npm test`: run deterministic domain tests using Node's test runner.
- `npm start -- --port 5174`: preview the built Worker.
- `REPNOTE_TEST_ORIGIN=http://127.0.0.1:5174 npm run test:api`: verify CRUD, authorization, and MCP with disposable local fixtures.

Follow the application README for local migrations. Publish through the Sites workflow; preserve private access and the existing project ID.

## Coding Style & Naming Conventions

Use TypeScript and descriptive camelCase functions, PascalCase React components, and explicit domain types. Validate mutations with the shared Zod schemas. Keep calculations in `lib/analytics.ts` so UI, exports, and MCP share definitions. Reuse CSS variables and existing components. No formatter is configured; preserve surrounding style.

## Testing Guidelines

Add regression tests for meaningful calculation, validation, persistence, or authorization changes. Domain tests use `*.test.ts`; API checks must remain local-only and remove their fixtures. Never add synthetic records to production. Verify mobile and desktop interaction after UI changes. State exactly which checks ran.

## Commit & Pull Request Guidelines

No established commit convention exists. Use concise imperative subjects. PRs should explain behavior, validation, and relevant limitations, link issues when applicable, and show screenshots for visible changes.

## Security & Agent Instructions

Every data operation must scope by authenticated Site user ID. MCP remains read-only. Preserve null for unknown health values and distinguish estimates from measurements. Never commit credentials or ignored runtime state. Trace affected consumers, fix root causes, and prefer the smallest sufficient change.
