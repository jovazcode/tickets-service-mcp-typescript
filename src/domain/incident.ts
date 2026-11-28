import * as z from 'zod/v4';

/** Lifecycle states of an incident, as serialized in JSON. */
export const INCIDENT_STATUSES = ['abierta', 'en_progreso', 'resuelta'] as const;

/** Operational impact levels, as serialized in JSON. */
export const IMPACTS = ['alto', 'bajo'] as const;

/** Incident lifecycle state. */
export const IncidentStatusSchema = z.enum(INCIDENT_STATUSES);

/** Operational impact of an incident. */
export const ImpactSchema = z.enum(IMPACTS);

/** Incident identifier: `INC-` followed by at least three digits. */
export const IncidentIdSchema = z
  .string()
  .regex(/^INC-\d{3,}$/)
  .describe('ID de la incidencia, por ejemplo INC-104');

/** An incident of the desk, with the same field names as the fixture. */
export const IncidentSchema = z.object({
  id: IncidentIdSchema,
  title: z.string().describe('Resumen breve del problema'),
  status: IncidentStatusSchema,
  impact: ImpactSchema,
  workaround: z.boolean().describe('Si existe una alternativa temporal para seguir trabajando'),
  created: z.iso.date().describe('Fecha de apertura, ISO YYYY-MM-DD'),
  detail: z.string().describe('Descripción completa'),
  revision: z
    .int()
    .positive()
    .default(1)
    .describe(
      'Revisión: empieza en 1 y sube con cada cambio; se exige como expectedRevision al editar',
    ),
});

/** Incident lifecycle state. */
export type IncidentStatus = z.infer<typeof IncidentStatusSchema>;

/** Operational impact of an incident. */
export type Impact = z.infer<typeof ImpactSchema>;

/** An incident of the desk. */
export type Incident = z.infer<typeof IncidentSchema>;
