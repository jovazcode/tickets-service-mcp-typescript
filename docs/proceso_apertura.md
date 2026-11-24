# Proceso de apertura de incidencias

Datos ficticios. Este documento describe cómo se registra una incidencia nueva en la mesa.

## 1. Comprobar antes de abrir

1. Busca si ya existe una incidencia parecida (`buscar_duplicadas` con el síntoma y la descripción; para búsquedas concretas, `buscar_incidencias`).
2. Si existe y sigue activa (`abierta` o `en_progreso`), no abras otra: aporta la información a la existente.
3. Si existe pero está `resuelta` y el problema ha vuelto, abre una nueva y menciona el ID anterior en el detalle.

## 2. Datos obligatorios

| Campo        | Qué poner                                                                                           |
| ------------ | --------------------------------------------------------------------------------------------------- |
| `title`      | Una frase corta que describa el síntoma, no la causa supuesta. Ej.: "La exportación se interrumpe". |
| `detail`     | A quién afecta, desde cuándo, cómo reproducirlo y qué se ha intentado.                              |
| `impact`     | `alto` o `bajo`, según el [proceso de triaje](docs://proceso_triaje).                               |
| `workaround` | `true` si existe una forma alternativa de seguir trabajando; descríbela en el detalle.              |

El servidor asigna el `id` (`INC-` seguido de un número), la fecha `created` y el estado inicial `abierta`.

## 3. Redacción

- Hechos observables, sin juicios ni nombres de personas.
- Sin datos personales, contraseñas ni credenciales.
- Si falta información imprescindible, pídela antes de abrir la incidencia en lugar de inventarla.
