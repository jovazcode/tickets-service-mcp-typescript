# Proceso de triaje

Datos ficticios. Este documento describe cómo se clasifica una incidencia y en qué orden se atienden.

## 1. Clasificar el impacto

- **`alto`**: impide completar una tarea importante a varias personas, o afecta a un proceso crítico (acceso general, guardado de datos, informes obligatorios).
- **`bajo`**: afecta a pocas personas, es un defecto visual o existe una forma razonable de seguir trabajando.

El impacto lo evalúa el equipo con el detalle completo. No se deduce solo del título.

## 2. Estados

| Estado        | Significado                       |
| ------------- | --------------------------------- |
| `abierta`     | Registrada, pendiente de atender. |
| `en_progreso` | Alguien está trabajando en ella.  |
| `resuelta`    | Solucionada.                      |

Se consideran **activas** las incidencias `abierta` y `en_progreso`.

Transiciones permitidas:

| Desde         | Hacia                                          |
| ------------- | ---------------------------------------------- |
| `abierta`     | `en_progreso`, `resuelta`                      |
| `en_progreso` | `resuelta`, `abierta` (devolver a la cola)     |
| `resuelta`    | `abierta` (reabrir; hay que indicar el motivo) |

## 3. Orden de atención

Entre las incidencias activas:

1. Primero impacto `alto`, después `bajo`.
2. A igual impacto, primero las que **no** tienen alternativa temporal (`workaround: false`).
3. Si persiste el empate, la más antigua (`created`).
4. Como último desempate, el ID más bajo.

Las incidencias `resuelta` no entran en la cola de atención, pero sí aparecen en las búsquedas.
