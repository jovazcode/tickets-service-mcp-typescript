import { readFile } from 'node:fs/promises';
import * as z from 'zod/v4';
import { DomainError } from '../domain/domain-error.js';
import { type Incident, IncidentSchema } from '../domain/incident.js';

/**
 * Read-only access to the desk's incidents, loaded from a JSON file (the
 * fixture) and kept in memory.
 */
export class IncidentRepository {
  readonly #incidents: readonly Incident[];
  readonly #byId: ReadonlyMap<string, Incident>;

  /** @throws {Error} if two incidents share an ID. */
  constructor(incidents: Iterable<Incident>) {
    const list = Object.freeze([...incidents]);
    const byId = new Map<string, Incident>();
    for (const incident of list) {
      if (byId.has(incident.id)) throw new Error(`ID duplicado: ${incident.id}`);
      byId.set(incident.id, incident);
    }
    this.#incidents = list;
    this.#byId = byId;
  }

  /**
   * Loads the incidents from the JSON array in `path`.
   *
   * @throws {Error} if the file can't be read or its content is not a valid
   * array of incidents.
   */
  static async load(path: string): Promise<IncidentRepository> {
    const raw: unknown = JSON.parse(await readFile(path, 'utf8'));
    const parsed = z.array(IncidentSchema).safeParse(raw);
    if (!parsed.success) {
      throw new Error(`Incidencias no válidas en ${path}: ${z.prettifyError(parsed.error)}`);
    }
    return new IncidentRepository(parsed.data);
  }

  /** All incidents, in file order. */
  all(): readonly Incident[] {
    return this.#incidents;
  }

  /**
   * Returns the incident with `id`.
   *
   * @throws {DomainError} `NOT_FOUND` if there is none.
   */
  getById(id: string): Incident {
    const incident = this.#byId.get(id);
    if (!incident) {
      throw new DomainError(
        'NOT_FOUND',
        `No existe la incidencia ${id}. Usa buscar_incidencias para localizar su ID.`,
      );
    }
    return incident;
  }
}
