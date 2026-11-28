import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import * as z from 'zod/v4';
import { DomainError } from '../domain/domain-error.js';
import { type Incident, IncidentSchema, type IncidentStatus } from '../domain/incident.js';
import { applyChanges, type IncidentPatch, validatePatch } from '../domain/incident-patch.js';
import { type NewIncident, validateNewIncident } from '../domain/new-incident.js';
import { transition, validateReason } from '../domain/status-transition.js';

/** Content of the working store file. */
const StoreSchema = z.object({
  nextId: z.int().positive(),
  incidents: z.array(IncidentSchema),
});

/** Options of {@link IncidentRepository}. */
export interface RepositoryOptions {
  /** Number of the next ID to assign; defaults to the highest existing one + 1. */
  nextId?: number | undefined;
  /** Working store file that writes go to. Required when `writeEnabled`. */
  storePath?: string | undefined;
  /** Whether writes are allowed (default false). */
  writeEnabled?: boolean | undefined;
  /** Source of the current time, for the creation date (default `new Date()`). */
  clock?: (() => Date) | undefined;
}

/** Where {@link IncidentRepository.open} loads from and writes to. */
export interface OpenOptions {
  /** Read-only fixture: a JSON array of incidents, used while there is no store. */
  fixturePath: string;
  /** Working store: `{ nextId, incidents }`, loaded if it exists. */
  storePath: string;
  writeEnabled?: boolean | undefined;
  clock?: (() => Date) | undefined;
}

/** Result of {@link IncidentRepository.changeStatus}. */
export type StatusChange = { incident: Incident; previousStatus: IncidentStatus };

const idNumber = (id: string): number => Number(id.slice('INC-'.length));

/** Local calendar date of `date` as ISO `YYYY-MM-DD`. */
export function localIsoDate(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

async function readJson<T>(path: string, schema: z.ZodType<T>): Promise<T> {
  const parsed = schema.safeParse(JSON.parse(await readFile(path, 'utf8')));
  if (!parsed.success) {
    throw new Error(`Incidencias no válidas en ${path}: ${z.prettifyError(parsed.error)}`);
  }
  return parsed.data;
}

/**
 * The desk's incidents, kept in memory.
 *
 * Reads come from the working store if it exists, else from the fixture,
 * which is never written. Writes (only when enabled) go to the working store
 * atomically (temporary file + rename) and one at a time, so concurrent
 * calls never reuse an ID or lose an update.
 */
export class IncidentRepository {
  #incidents: readonly Incident[];
  #byId: ReadonlyMap<string, Incident>;
  #nextId: number;
  readonly #storePath: string | undefined;
  readonly #writeEnabled: boolean;
  readonly #clock: () => Date;
  #writeQueue: Promise<unknown> = Promise.resolve();

  /** @throws {Error} if two incidents share an ID or `nextId` is not above every ID. */
  constructor(incidents: Iterable<Incident>, options: RepositoryOptions = {}) {
    const { nextId, storePath, writeEnabled = false, clock = () => new Date() } = options;
    if (writeEnabled && storePath === undefined) {
      throw new Error('storePath es obligatorio con la escritura habilitada');
    }
    const list = Object.freeze([...incidents]);
    this.#byId = IncidentRepository.#index(list);
    const maxNumber = Math.max(0, ...list.map(({ id }) => idNumber(id)));
    if (nextId !== undefined && nextId <= maxNumber) {
      throw new Error(`nextId (${nextId}) debe ser mayor que ${maxNumber}`);
    }
    this.#incidents = list;
    this.#nextId = nextId ?? maxNumber + 1;
    this.#storePath = storePath;
    this.#writeEnabled = writeEnabled;
    this.#clock = clock;
  }

  static #index(incidents: readonly Incident[]): Map<string, Incident> {
    const byId = new Map<string, Incident>();
    for (const incident of incidents) {
      if (byId.has(incident.id)) throw new Error(`ID duplicado: ${incident.id}`);
      byId.set(incident.id, incident);
    }
    return byId;
  }

  /**
   * Loads the incidents from the JSON array in `path` (read-only).
   *
   * @throws {Error} if the file can't be read or its content is not valid.
   */
  static async load(path: string): Promise<IncidentRepository> {
    return new IncidentRepository(await readJson(path, z.array(IncidentSchema)));
  }

  /**
   * Opens the working store at `storePath` if it exists, else starts from
   * the fixture at `fixturePath`.
   *
   * @throws {Error} if the file to load can't be read or is not valid.
   */
  static async open(options: OpenOptions): Promise<IncidentRepository> {
    const { fixturePath, storePath, writeEnabled, clock } = options;
    let store: z.infer<typeof StoreSchema> | undefined;
    try {
      store = await readJson(storePath, StoreSchema);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
    }
    const incidents = store?.incidents ?? (await readJson(fixturePath, z.array(IncidentSchema)));
    return new IncidentRepository(incidents, {
      nextId: store?.nextId,
      storePath,
      writeEnabled,
      clock,
    });
  }

  /** All incidents, in creation order. */
  all(): readonly Incident[] {
    return this.#incidents;
  }

  /** Whether writes are allowed. */
  get writeEnabled(): boolean {
    return this.#writeEnabled;
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

  /**
   * Opens a new incident in status `abierta`, dated today, with the next ID,
   * and saves it to the working store.
   *
   * @throws {DomainError} `WRITE_DISABLED`, `VALIDATION_ERROR` or
   * `PERSISTENCE_ERROR` (nothing changes in that case).
   */
  async create(draft: NewIncident): Promise<Incident> {
    this.#ensureWritable();
    const valid = validateNewIncident(draft);
    return this.#serialized(async () => {
      const incident: Incident = {
        id: `INC-${String(this.#nextId).padStart(3, '0')}`,
        title: valid.title,
        status: 'abierta',
        impact: valid.impact,
        workaround: valid.workaround,
        created: localIsoDate(this.#clock()),
        detail: valid.detail,
        revision: 1,
      };
      await this.#commit([...this.#incidents, incident], this.#nextId + 1);
      return incident;
    });
  }

  /**
   * Changes the given fields of incident `id` and saves it with the next
   * revision. `expectedRevision` is the revision read before editing: if the
   * incident has changed since then, nothing is applied.
   *
   * @throws {DomainError} `WRITE_DISABLED`, `VALIDATION_ERROR`, `NOT_FOUND`,
   * `REVISION_CONFLICT` or `PERSISTENCE_ERROR` (nothing changes in those cases).
   */
  async update(id: string, expectedRevision: number, patch: IncidentPatch): Promise<Incident> {
    this.#ensureWritable();
    const changes = validatePatch(patch);
    const { incident } = await this.#mutate(id, expectedRevision, (current) =>
      applyChanges(current, changes),
    );
    return incident;
  }

  /**
   * Moves incident `id` to `status`, following the allowed transitions, and
   * saves it with the next revision. Reopening a resolved incident needs a
   * `reason`. Returns the incident and the status it had before.
   *
   * @throws {DomainError} `WRITE_DISABLED`, `VALIDATION_ERROR`, `NOT_FOUND`,
   * `REVISION_CONFLICT`, `INVALID_TRANSITION`, `REASON_REQUIRED` or
   * `PERSISTENCE_ERROR` (nothing changes in those cases).
   */
  async changeStatus(
    id: string,
    expectedRevision: number,
    status: IncidentStatus,
    reason?: string,
  ): Promise<StatusChange> {
    this.#ensureWritable();
    const validReason = validateReason(reason);
    return this.#mutate(id, expectedRevision, (current) =>
      transition(current, status, validReason),
    );
  }

  /**
   * In the write queue: applies `change` to incident `id` if its revision is
   * still `expectedRevision`, and saves the result.
   */
  #mutate(
    id: string,
    expectedRevision: number,
    change: (current: Incident) => Incident,
  ): Promise<StatusChange> {
    return this.#serialized(async () => {
      const current = this.getById(id);
      if (current.revision !== expectedRevision) {
        throw new DomainError(
          'REVISION_CONFLICT',
          `${id} ha cambiado: su revisión actual es ${current.revision}, no ` +
            `${expectedRevision}. Vuelve a consultarla con obtener_incidencia y confirma ` +
            'los cambios con el usuario antes de reintentar.',
        );
      }
      const updated = change(current);
      await this.#commit(
        this.#incidents.map((incident) => (incident.id === id ? updated : incident)),
        this.#nextId,
      );
      return { incident: updated, previousStatus: current.status };
    });
  }

  /** Saves `incidents` to the store and, only if that worked, adopts them in memory. */
  async #commit(incidents: Incident[], nextId: number): Promise<void> {
    const frozen = Object.freeze(incidents);
    await this.#persist(frozen, nextId);
    this.#incidents = frozen;
    this.#byId = IncidentRepository.#index(frozen);
    this.#nextId = nextId;
  }

  #ensureWritable(): void {
    if (!this.#writeEnabled) {
      throw new DomainError(
        'WRITE_DISABLED',
        'El servidor está en modo solo lectura. Arráncalo con ' +
          'MESA_INCIDENCIAS_WRITE_ENABLED=1 para permitir cambios.',
      );
    }
  }

  /** Runs `operation` after every previously queued write has settled. */
  #serialized<T>(operation: () => Promise<T>): Promise<T> {
    const result = this.#writeQueue.then(operation);
    this.#writeQueue = result.catch(() => {});
    return result;
  }

  async #persist(incidents: readonly Incident[], nextId: number): Promise<void> {
    // Constructor guarantees a store path whenever writes are enabled.
    const storePath = this.#storePath as string;
    const temp = `${storePath}.tmp`;
    try {
      await mkdir(dirname(storePath), { recursive: true });
      await writeFile(temp, `${JSON.stringify({ nextId, incidents }, null, 2)}\n`);
      await rename(temp, storePath);
    } catch (error) {
      await rm(temp, { force: true }).catch(() => {});
      throw new DomainError(
        'PERSISTENCE_ERROR',
        `No se pudo guardar el almacén: ${(error as Error).message}`,
      );
    }
  }
}
