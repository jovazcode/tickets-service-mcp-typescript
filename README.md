# Tickets Service MCP (TypeScript)

[![ci][ci_badge]][ci_link]
[![TypeScript][typescript_badge]][typescript_link]
[![Checked with Biome][biome_badge]][biome_link]
[![License: MIT][license_badge]][license_link]

Servidor [Model Context Protocol (MCP)][mcp_link] local, escrito en TypeScript con el [SDK oficial][sdk_link], que expone una mesa de incidencias ficticia a clientes MCP (Claude Code, Claude Desktop, MCP Inspector…) a través de **stdio**.

Es la versión en TypeScript de [`tickets-service-mcp`][dart_project_link], hecha en Dart.

> [!NOTE]
> Fase 2 (en curso): creación, edición y cambio de estado de incidencias (`crear_incidencia`, `actualizar_incidencia`, `cambiar_estado`) con permiso de escritura y el prompt `abrir_incidencia`, además de la búsqueda, la consulta y los documentos de proceso de la fase 1.

## Índice

- [Características](#características-)
- [Requisitos](#requisitos-)
- [Instalación](#instalación-)
- [Herramientas, recursos y prompts](#herramientas-recursos-y-prompts-)
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

## Herramientas, recursos y prompts 🧰

### Herramientas

| Herramienta             | Qué hace                                                                                                                                                                                                                                                                                                     |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `buscar_incidencias`    | Busca por texto libre (`q`, en ID, título y detalle, sin distinguir mayúsculas ni tildes) y filtra por `status`, `impact` y `workaround`. Pagina con `limit` (1-100, 20 por defecto) y `offset`. Devuelve `{ items, total }`.                                                                                |
| `obtener_incidencia`    | Devuelve la ficha completa de una incidencia por su `id` (`INC-123`) como `{ incident }`, incluida su `revision`. Si no existe, responde con un error de herramienta `NOT_FOUND`.                                                                                                                            |
| `crear_incidencia`      | Abre una incidencia con `title`, `detail`, `impact` y `workaround` (opcional, `false` por defecto). El servidor asigna el siguiente ID (`INC-105`…), el estado `abierta` y la fecha de hoy. Requiere escritura habilitada; si no, responde `WRITE_DISABLED`.                                                 |
| `actualizar_incidencia` | Cambia uno o varios de `title`, `detail`, `impact` y `workaround` de la incidencia `id`; el resto no cambia. Exige `expectedRevision`, la revisión leída con `obtener_incidencia`: si la incidencia ha cambiado desde entonces responde `REVISION_CONFLICT` y no aplica nada. Requiere escritura habilitada. |
| `cambiar_estado`        | Mueve la incidencia `id` a `status` según las transiciones permitidas: `abierta` → `en_progreso` o `resuelta`; `en_progreso` → `resuelta` o `abierta`; `resuelta` → `abierta` (reabrir, exige `reason`). Exige `expectedRevision`. Devuelve `{ incident, previousStatus }`. Requiere escritura habilitada.   |

Todas son de solo lectura (`readOnlyHint`) salvo `crear_incidencia`, `actualizar_incidencia` y `cambiar_estado` (`actualizar_incidencia`, además, marcada como destructiva porque sobrescribe los valores anteriores), y devuelven el resultado estructurado (`structuredContent`) validado contra su `outputSchema`. Los errores de negocio llegan como resultado con `isError: true` y un texto que empieza por su código (por ejemplo `NOT_FOUND: …`), para que el modelo pueda leerlos y corregirse: `NOT_FOUND`, `VALIDATION_ERROR`, `WRITE_DISABLED`, `REVISION_CONFLICT`, `INVALID_TRANSITION`, `REASON_REQUIRED` y `PERSISTENCE_ERROR`.

### Recursos

| URI                       | Contenido                                                                          |
| ------------------------- | ---------------------------------------------------------------------------------- |
| `docs://proceso_apertura` | Cómo abrir una incidencia: datos obligatorios, redacción y comprobaciones previas. |
| `docs://proceso_triaje`   | Cómo clasificar el impacto y en qué orden atender las incidencias activas.         |

Son documentos Markdown (`text/markdown`) que se leen de `docs/` en cada petición, así que los cambios se ven sin reiniciar el servidor.

### Prompts

| Prompt             | Argumentos                         | Qué hace                                                                                                                                                                                                                      |
| ------------------ | ---------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `abrir_incidencia` | `problema` (opcional, texto libre) | Incrusta `docs://proceso_apertura` y guía al modelo: buscar duplicados con `buscar_incidencias`, completar los datos sin inventarlos, mostrar la propuesta, esperar confirmación y solo entonces llamar a `crear_incidencia`. |

Sin `problema`, el modelo empieza preguntándolo. En modo solo lectura, el prompt le pide que deje la propuesta preparada y no intente crearla.

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

- `data/tickets.json`: incidencias de ejemplo (fixture de solo lectura). El servidor nunca la modifica.
- `data/tickets.local.json`: almacén de trabajo (`{ nextId, incidents }`, ignorado por git). Se crea con la primera escritura a partir de la fixture y, si existe, se carga al arrancar en lugar de ella, también en modo solo lectura. Se guarda de forma atómica (fichero temporal y `rename`). Bórralo para volver a los datos de ejemplo.
- Cada incidencia tiene una `revision` que empieza en 1 y sube con cada cambio; las de la fixture, que no la llevan, empiezan en 1.
- `docs/proceso_apertura.md` y `docs/proceso_triaje.md`: documentos de proceso de la mesa, publicados como recursos `docs://`.

Variables de entorno (las rutas relativas se resuelven desde la raíz del proyecto, no desde el directorio de trabajo):

| Variable                         | Por defecto               | Uso                                                               |
| -------------------------------- | ------------------------- | ----------------------------------------------------------------- |
| `MESA_INCIDENCIAS_WRITE_ENABLED` | desactivada               | `1`, `true`, `yes` u `on` habilitan las herramientas de escritura |
| `MESA_INCIDENCIAS_DATA`          | `data/tickets.json`       | Fixture de incidencias                                            |
| `MESA_INCIDENCIAS_STORE`         | `data/tickets.local.json` | Almacén de trabajo                                                |
| `MESA_INCIDENCIAS_DOCS`          | `docs`                    | Carpeta de documentos de proceso                                  |

El `.mcp.json` del proyecto pasa `MESA_INCIDENCIAS_WRITE_ENABLED` desde tu entorno (`0` por defecto): arranca Claude Code con `MESA_INCIDENCIAS_WRITE_ENABLED=1 claude` para permitir escrituras.

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
  index.ts       # punto de entrada stdio: configuración, carga de datos (sin lógica)
  server.ts      # factory createServer(deps): registra herramientas, recursos y prompts
  config.ts      # configuración desde variables de entorno
  domain/        # modelo y esquemas Zod (sin dependencias del SDK)
  store/         # acceso a los datos
  services/      # lógica de negocio pura (búsqueda…)
  mcp/tools/     # un módulo por herramienta MCP
  mcp/resources/ # un módulo por recurso MCP
  mcp/prompts/   # un módulo por prompt MCP
test/            # refleja src/; helpers/harness.ts conecta un cliente MCP en el mismo proceso
  stdio.e2e.test.ts  # lanza dist/index.js por stdio
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
