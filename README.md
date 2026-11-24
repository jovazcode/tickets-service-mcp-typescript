# Tickets Service MCP (TypeScript)

[![ci][ci_badge]][ci_link]
[![TypeScript][typescript_badge]][typescript_link]
[![Checked with Biome][biome_badge]][biome_link]
[![License: MIT][license_badge]][license_link]

Servidor [Model Context Protocol (MCP)][mcp_link] local, escrito en TypeScript con el [SDK oficial][sdk_link], que expone una mesa de incidencias ficticia a clientes MCP (Claude Code, Claude Desktop, MCP Inspector…) a través de **stdio**.

Es la versión en TypeScript de [`tickets-service-mcp`][dart_project_link], hecha en Dart.

> [!NOTE]
> Fase 0: esqueleto del proyecto. El servidor arranca y negocia el protocolo, pero aún no expone herramientas, recursos ni prompts.

## Índice

- [Características](#características-)
- [Requisitos](#requisitos-)
- [Instalación](#instalación-)
- [Uso](#uso-)
- [Datos](#datos-)
- [Desarrollo](#desarrollo-)
- [Integración continua](#integración-continua-)
- [Contribuir](#contribuir-)
- [Licencia](#licencia-)

## Características ✨

- Transporte **stdio**: sin servidor web ni puertos abiertos.
- SDK oficial **v2** (`@modelcontextprotocol/server`), especificación MCP 2026-07-28, esquemas con [Zod][zod_link] v4.
- TypeScript estricto y solo ESM, lint y formato con [Biome][biome_link], tests con [Vitest][vitest_link] y un 100 % de cobertura.
- Tests de extremo a extremo: un cliente MCP real en el mismo proceso y otro que lanza el binario por stdio.

## Requisitos 📋

- [Node.js][node_link] `>= 22` (recomendado 24, ver `.nvmrc`) y npm.

## Instalación 💻

```sh
git clone https://github.com/jovazcode/tickets-service-mcp-typescript.git
cd tickets-service-mcp-typescript
npm ci
npm run build
```

El servidor compilado queda en `dist/index.js`.

## Uso 🚀

> [!TIP]
> Lanza siempre el JavaScript compilado (`node dist/index.js`). Con `tsx` el arranque es más lento y la salida por stdout podría corromper el canal JSON-RPC. Recompila con `npm run build` después de cada cambio.

### Claude Code

El proyecto incluye un `.mcp.json` con el servidor `mesa-incidencias-ts`, que Claude Code detecta al abrir la carpeta. Para registrarlo a mano:

```sh
claude mcp add tickets-service-mcp-typescript -- node /ruta/absoluta/tickets-service-mcp-typescript/dist/index.js
```

### Otros clientes (configuración JSON)

```json
{
  "mcpServers": {
    "tickets-service-mcp-typescript": {
      "command": "node",
      "args": ["/ruta/absoluta/tickets-service-mcp-typescript/dist/index.js"]
    }
  }
}
```

### MCP Inspector

```sh
npm run inspector
```

Abre el inspector en el navegador y conecta con el servidor por stdio.

## Datos 🗂️

- `data/tickets.json`: incidencias de ejemplo (fixture de solo lectura).
- `docs/proceso_apertura.md` y `docs/proceso_triaje.md`: documentos de proceso de la mesa.

## Desarrollo 🛠️

| Comando                 | Qué hace                                             |
| ----------------------- | ---------------------------------------------------- |
| `npm run lint`          | Formato y lint con Biome                             |
| `npm run format`        | Aplica formato y arreglos seguros                    |
| `npm run typecheck`     | Comprobación de tipos (`tsc --noEmit`)               |
| `npm run build`         | Compila `src/` a `dist/`                             |
| `npm test`              | Compila y ejecuta los tests                          |
| `npm run test:coverage` | Tests con umbral de cobertura del 100 % (como en CI) |
| `npm run dev`           | Ejecuta `src/index.ts` con recarga (`tsx watch`)     |
| `npm run inspector`     | Abre MCP Inspector sobre `dist/index.js`             |

Estructura:

```text
src/
  index.ts     # punto de entrada stdio (sin lógica)
  server.ts    # factory createServer(): registra herramientas, recursos y prompts
test/
  helpers/harness.ts   # cliente MCP en el mismo proceso
  server.test.ts
  stdio.e2e.test.ts    # lanza dist/index.js por stdio
```

El proyecto incluye agent skills para Claude Code en `.claude/skills/` (`mcp-builder` y `mcp-typescript-sdk-skills`) y activa los plugins `mcp-server-dev` y `mcp-apps`.

## Integración continua ⚙️

GitHub Actions (`.github/workflows/`) ejecuta en cada push y pull request a `main`:

- `build`: lint (Biome), comprobación de tipos, compilación y tests con cobertura en Node 22 y 24.
- `spell-check`: ortografía de los Markdown en inglés y español ([CSpell][cspell_link]).
- `semantic-pull-request`: el título del PR debe seguir [Conventional Commits][conventional_commits_link].
- `dependency-review`: bloquea dependencias con vulnerabilidades o licencias no permitidas.

Dependabot mantiene al día las dependencias de npm y las actions.

## Contribuir 🤝

1. Crea una rama desde `main`.
2. Haz commits con [Conventional Commits][conventional_commits_link].
3. Abre un pull request; se integra con _squash_ cuando los checks están en verde.

## Licencia 📄

[MIT](LICENSE) © jovazcode

[ci_badge]: https://github.com/jovazcode/tickets-service-mcp-typescript/actions/workflows/ci.yaml/badge.svg
[ci_link]: https://github.com/jovazcode/tickets-service-mcp-typescript/actions/workflows/ci.yaml
[typescript_badge]: https://img.shields.io/badge/TypeScript-strict-3178c6?logo=typescript&logoColor=white
[typescript_link]: https://www.typescriptlang.org/
[biome_badge]: https://img.shields.io/badge/Checked_with-Biome-60a5fa?logo=biome
[biome_link]: https://biomejs.dev
[license_badge]: https://img.shields.io/badge/license-MIT-blue.svg
[license_link]: https://opensource.org/licenses/MIT
[mcp_link]: https://modelcontextprotocol.io
[sdk_link]: https://github.com/modelcontextprotocol/typescript-sdk
[dart_project_link]: https://github.com/jovazcode/tickets-service-mcp
[zod_link]: https://zod.dev
[vitest_link]: https://vitest.dev
[node_link]: https://nodejs.org
[cspell_link]: https://cspell.org
[conventional_commits_link]: https://www.conventionalcommits.org/es/v1.0.0/
