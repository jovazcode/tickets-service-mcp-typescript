# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

Local MCP server (stdio transport) in TypeScript for a fictitious incident desk ("mesa de incidencias"), built with the **official MCP TypeScript SDK v2** (`@modelcontextprotocol/server`, spec 2026-07-28), not the legacy v1 package `@modelcontextprotocol/sdk`. It is the TypeScript counterpart of the Dart project in `../tickets-service-mcp/`, which can be used as a functional reference (tools, resources, prompt, data model), but not as a code reference.

Current state (phase 1): read-only tools `obtener_incidencia` (`src/mcp/tools/get-incident.ts`, `{incident}`; unknown ID → `NOT_FOUND` via `IncidentRepository.getById`) and `buscar_incidencias` (`src/mcp/tools/search-incidents.ts` over `searchIncidents` in `src/services/incident-search.ts`: free text `q` in ID/title/detail ignoring case and accents, filters `status`/`impact`/`workaround`, paging `limit` (1-100, default 20)/`offset`, output `{items, total}`). Data comes from `IncidentRepository` (`src/store/`), loaded once at startup from `data/tickets.json` (overridable with `MESA_INCIDENCIAS_DATA`) and validated with the Zod schemas in `src/domain/incident.ts`. Static resources `docs://proceso_apertura` and `docs://proceso_triaje` (`src/mcp/resources/process-documents.ts`, `PROCESS_DOCUMENTS`): Markdown read from `docs/` (overridable with `MESA_INCIDENCIAS_DOCS`) on every request; an unreadable file → `ProtocolError(InternalError)` with a generic message, details logged to stderr. Phase 1 (read-only) is complete. Next, following the Dart project: writes (`crear_incidencia` behind `MESA_INCIDENCIAS_WRITE_ENABLED=1`, with a local working store; the fixture is never written).

## Architecture

- `src/server.ts`: `createServer(deps: ServerDependencies)` factory. Transports call it once per connection (`serveStdio`) or per request (`createMcpHandler`), so it holds no shared mutable state; shared services (the repository, the docs folder) come in through `deps`.
- `src/domain/` (Zod schemas and inferred types), `src/store/`, `src/services/`: pure domain code, no SDK imports. `src/mcp/`: thin adapters, one `registerXxx(server, ...deps)` module per tool/resource/prompt under `src/mcp/tools|resources|prompts/`, called from `createServer`; shared tool annotations in `src/mcp/annotations.ts`. Tool schemas reuse the domain schemas, and handlers delegate to services.
- `src/config.ts`: `configFromEnvironment(env)` resolves paths against `PROJECT_ROOT` (derived from `import.meta.url`, the parent of `src/` and `dist/`), never `process.cwd()`: hosts may launch stdio servers from `/`.
- `src/index.ts` only reads config, loads the repository (exits 1 with a stderr message if that fails) and calls `serveStdio`; it is excluded from coverage, so keep logic out of it. It is exercised by `test/stdio.e2e.test.ts` against the compiled `dist/index.js`.
- Clients launch the compiled `node dist/index.js` (run `npm run build` after changes and reconnect in `/mcp`). Avoid `tsx` for clients: slower start and possible stdout noise.
- Tests mirror `src/` under `test/`. MCP-level tests use a real `Client` in-process through `createMcpHandler(...).fetch` (`startHarness({ incidents?, docsDirectory? })` in `test/helpers/harness.ts`, fixture by default, negotiates 2026-07-28); `test/fixtures.ts` builds incidents; the e2e test spawns the stdio binary.

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
- Schemas: Zod v4 via `import * as z from 'zod/v4'`, passed as `inputSchema`/`outputSchema` to `registerTool`; `.describe()` texts (in Spanish) are what the model reads.
- Tool results: return `structuredContent` (validated at runtime against `outputSchema`) plus a `content` text block with its JSON. SDK 2.4 types still require `content`, although the docs say it can be omitted. Type `structuredContent` values with `type` aliases, not `interface`s, so they fit the SDK's index-signature object type. Invalid arguments come back as `isError: true` results, not thrown errors.
- Business failures: throw `DomainError(code, detail)` (`src/domain/domain-error.ts`) from the domain/store; its message is `CODE: detail`, and the SDK turns anything a tool handler throws into an `isError: true` result with that text, so handlers don't catch it. Put a recovery hint in the detail (the model only sees the text). Add new codes to `DomainErrorCode`. Resources and prompts have no `isError` channel: there, map to `ProtocolError`.
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

`data/tickets.json` is the fixture: array of incidents with `id` (`INC-1xx`), `title`, `status` (`abierta`/`resuelta`…), `impact` (`bajo`/`alto`), `workaround` (bool), `created` (ISO date), `detail`. Treat it as read-only input; the server never writes it. `docs/proceso_*.md` are process documents to expose as resources.

## Agent skills and plugins

- `.claude/skills/` is managed by the `skills` CLI (state in `skills-lock.json`); don't edit by hand. Installed: `mcp-builder` (anthropics/skills: MCP server design and evaluations; see `reference/node_mcp_server_v2.md`) and `mcp-typescript-sdk-skills` (official SDK: Skills over MCP). Update with `npx skills update`; add with `npx skills add <owner/repo> --skill <name> -a claude-code`.
- `.claude/settings.json` enables the project plugins `mcp-server-dev` and `mcp-apps`.
- `.mcp.json` exposes the MCP docs server (`mcp-docs`) and this server (`mesa-incidencias-ts`).
