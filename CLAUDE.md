# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Local MCP server (stdio transport) in TypeScript for a fictitious incident desk ("mesa de incidencias"), built with the **official MCP TypeScript SDK v2** (`@modelcontextprotocol/server`, spec 2026-07-28), not the legacy v1 package `@modelcontextprotocol/sdk`. It is the TypeScript counterpart of the Dart project in `../tickets-service-mcp/`, which can be used as a functional reference (tools, resources, prompt, data model), but not as a code reference.

Current state: skeleton. `createServer()` builds an empty `McpServer` (no tools, resources or prompts yet).

## Architecture

- `src/server.ts`: `createServer()` factory. Transports call it once per connection (`serveStdio`) or per request (`createMcpHandler`), so it must not hold shared mutable state; pass shared services in as parameters.
- Planned layout as features land: `src/domain/`, `src/store/`, `src/services/` for pure domain code with no SDK imports; `src/mcp/` for thin adapters, one module per tool/resource/prompt, registered from `createServer`.
- `src/index.ts` only wires `serveStdio(createServer)`; it is excluded from coverage, so keep logic out of it. It is exercised by `test/stdio.e2e.test.ts` against the compiled `dist/index.js`.
- Clients launch the compiled `node dist/index.js` (run `npm run build` after changes and reconnect in `/mcp`). Avoid `tsx` for clients: slower start and possible stdout noise.
- Tests use a real `Client` in-process through `createMcpHandler(createServer).fetch` (`test/helpers/harness.ts`, negotiates 2026-07-28); the e2e test spawns the stdio binary.

## Commands

```sh
npm ci
npm run lint            # biome check (format + lint)
npm run format          # biome check --write
npm run typecheck       # tsc --noEmit
npm run build           # tsc -p tsconfig.build.json -> dist/
npm test                # builds, then vitest run
npm run test:coverage   # builds, then vitest with 100% thresholds (what CI enforces)
npx vitest run test/server.test.ts      # single file (build first for the e2e test)
npx vitest run -t "reports its name"    # single test by name
npm run dev             # tsx watch src/index.ts
npm run inspector       # MCP Inspector on dist/index.js
```

## Conventions

- ESM only (`"type": "module"`, `module: nodenext`): relative imports use the `.js` extension; type-only imports use `import type` (`verbatimModuleSyntax`).
- Strict TypeScript (`noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, ...). TypeScript 7 (native compiler).
- Schemas: Zod v4 via `import * as z from 'zod/v4'`, passed as `inputSchema`/`outputSchema` to `registerTool`.
- Lint/format: Biome (`biome.json`); `npm run ci:lint` must be clean. `console.log` is forbidden: stdout carries JSON-RPC, log with `console.error`.
- Coverage: 100% statements/branches/functions/lines (`vitest.config.ts`).
- Dependencies are pinned to exact versions (`npm install -E`); `package-lock.json` is versioned. Node `>=22` (CI runs 22 and 24; `.nvmrc` is 24).
- Spell check: `.github/cspell.json` (`en,es`); add project words there. Local check: `npx -y cspell@8.19.4 --no-progress -c .github/cspell.json "**/*.md"`.
- Conventional Commits.

## Git workflow

`main` is protected by a GitHub ruleset: no direct pushes, force pushes or deletion. Every change goes through a pull request:

1. Branch off `main` and commit there.
2. Push and open a PR whose title is a Conventional Commit (`gh pr create --fill`); it becomes the squash commit title on `main`.
3. Merge only when the required checks pass: `build`, `spell-check`, `semantic-pull-request`. No approvals are needed. `dependency-review` (license and vulnerability gate) runs on PRs but is not required.
4. Squash is the only merge method (`gh pr merge --squash --delete-branch`); the remote branch is deleted automatically.

## Data

`data/tickets.json` is the fixture: array of incidents with `id` (`INC-1xx`), `title`, `status` (`abierta`/`resuelta`…), `impact` (`bajo`/`alto`), `workaround` (bool), `created` (ISO date), `detail`. Treat it as read-only input. `docs/proceso_*.md` are process documents to expose as resources.

## Agent skills and plugins

- `.claude/skills/` is managed by the `skills` CLI (state in `skills-lock.json`); don't edit by hand. Installed: `mcp-builder` (anthropics/skills: MCP server design and evaluations; see `reference/node_mcp_server_v2.md`) and `mcp-typescript-sdk-skills` (official SDK: Skills over MCP). Update with `npx skills update`; add with `npx skills add <owner/repo> --skill <name> -a claude-code`.
- `.claude/settings.json` enables the project plugins `mcp-server-dev` and `mcp-apps`.
- `.mcp.json` exposes the MCP docs server (`mcp-docs`) and this server (`mesa-incidencias-ts`).
