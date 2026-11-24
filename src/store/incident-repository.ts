import { readFile } from 'node:fs/promises';
import * as z from 'zod/v4';
import { type Incident, IncidentSchema } from '../domain/incident.js';

/**
 * Read-only access to the desk's incidents, loaded from a JSON file (the
 * fixture) and kept in memory.
 */
export class IncidentRepository {
  readonly #incidents: readonly Incident[];

  /** @throws {Error} if two incidents share an ID. */
  constructor(incidents: Iterable<Incident>) {
    const list = Object.freeze([...incidents]);
    const ids = new Set<string>();
    for (const { id } of list) {
      if (ids.has(id)) throw new Error(`ID duplicado: ${id}`);
      ids.add(id);
    }
    this.#incidents = list;
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
}
