import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { IncidentRepository, localIsoDate } from '../../src/store/incident-repository.js';
import { incident } from '../fixtures.js';
import { FIXTURE_PATH, loadFixture, tempDir } from '../helpers/harness.js';

const draft = { title: 'Nueva', detail: 'Algo falla', impact: 'alto' } as const;
const clock = () => new Date(2026, 10, 25, 23, 30);

let dir: string;
let storePath: string;

beforeEach(async () => {
  dir = await tempDir();
  storePath = join(dir, 'data', 'tickets.local.json');
});

afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

async function write(name: string, content: unknown): Promise<string> {
  const path = join(dir, name);
  await writeFile(path, typeof content === 'string' ? content : JSON.stringify(content));
  return path;
}

const readStore = async () => JSON.parse(await readFile(storePath, 'utf8'));

const writable = (incidents = [incident({ id: 'INC-101' })]) =>
  new IncidentRepository(incidents, { storePath, writeEnabled: true, clock });

describe('IncidentRepository', () => {
  it('loads the fixture in file order', async () => {
    const ids = (await loadFixture()).all().map(({ id }) => id);
    expect(ids).toEqual(['INC-101', 'INC-102', 'INC-103', 'INC-104']);
  });

  it('rejects duplicate IDs', () => {
    expect(() => new IncidentRepository([incident(), incident()])).toThrow('ID duplicado: INC-001');
  });

  it('rejects a nextId that is not above every ID', () => {
    expect(() => new IncidentRepository([incident({ id: 'INC-105' })], { nextId: 105 })).toThrow(
      'nextId (105) debe ser mayor que 105',
    );
  });

  it('requires a store path to enable writes', () => {
    expect(() => new IncidentRepository([], { writeEnabled: true })).toThrow(/storePath/);
  });

  it('is read-only by default and exposes an immutable list', () => {
    const repository = new IncidentRepository([incident()]);
    expect(repository.writeEnabled).toBe(false);
    expect(Object.isFrozen(repository.all())).toBe(true);
  });

  it('rejects a file that is not an array of incidents', async () => {
    const path = await write('tickets.json', { incidents: [] });
    await expect(IncidentRepository.load(path)).rejects.toThrow(/Incidencias no válidas/);
  });

  it('rejects an invalid incident', async () => {
    const path = await write('tickets.json', [{ ...incident(), status: 'cerrada' }]);
    await expect(IncidentRepository.load(path)).rejects.toThrow(/status/);
  });

  it('rejects invalid JSON', async () => {
    const path = await write('tickets.json', '{');
    await expect(IncidentRepository.load(path)).rejects.toThrow(SyntaxError);
  });

  it('defaults the revision of incidents without one to 1', async () => {
    const { revision: _, ...legacy } = incident();
    const repository = await IncidentRepository.load(await write('legacy.json', [legacy]));
    expect(repository.getById('INC-001').revision).toBe(1);
  });

  it('rejects a missing file', async () => {
    await expect(IncidentRepository.load(join(dir, 'missing.json'))).rejects.toThrow(/ENOENT/);
  });
});

describe('IncidentRepository.getById', () => {
  const repository = new IncidentRepository([incident({ id: 'INC-101', title: 'Acceso' })]);

  it('returns the incident with that ID', () => {
    expect(repository.getById('INC-101').title).toBe('Acceso');
  });

  it('throws NOT_FOUND for an unknown ID', () => {
    expect(() => repository.getById('INC-999')).toThrow(
      expect.objectContaining({
        name: 'DomainError',
        code: 'NOT_FOUND',
        message: expect.stringMatching(/^NOT_FOUND: No existe la incidencia INC-999\./),
      }),
    );
  });
});

describe('IncidentRepository.open', () => {
  it('starts from the fixture while there is no store', async () => {
    const repository = await IncidentRepository.open({ fixturePath: FIXTURE_PATH, storePath });
    expect(repository.all()).toHaveLength(4);
    expect(repository.writeEnabled).toBe(false);
  });

  it('prefers the working store, keeping its nextId', async () => {
    await mkdir(join(dir, 'data'));
    await writeFile(storePath, JSON.stringify({ nextId: 200, incidents: [incident()] }));
    const repository = await IncidentRepository.open({
      fixturePath: join(dir, 'missing.json'),
      storePath,
      writeEnabled: true,
      clock,
    });
    expect(repository.all().map(({ id }) => id)).toEqual(['INC-001']);
    expect((await repository.create(draft)).id).toBe('INC-200');
  });

  it('rejects an invalid store instead of falling back to the fixture', async () => {
    await mkdir(join(dir, 'data'));
    await writeFile(storePath, JSON.stringify([incident()]));
    await expect(IncidentRepository.open({ fixturePath: FIXTURE_PATH, storePath })).rejects.toThrow(
      /Incidencias no válidas/,
    );
  });

  it('rejects an unreadable store', async () => {
    await mkdir(storePath, { recursive: true });
    await expect(IncidentRepository.open({ fixturePath: FIXTURE_PATH, storePath })).rejects.toThrow(
      /EISDIR/,
    );
  });
});

describe('IncidentRepository.create', () => {
  it('opens an incident with the next ID, status abierta and the local date', async () => {
    const repository = writable();
    const created = await repository.create({ ...draft, title: '  Nueva ', workaround: true });
    expect(created).toEqual({
      id: 'INC-102',
      title: 'Nueva',
      status: 'abierta',
      impact: 'alto',
      workaround: true,
      created: '2026-11-25',
      detail: 'Algo falla',
      revision: 1,
    });
    expect(repository.getById('INC-102')).toEqual(created);
    expect(repository.all().map(({ id }) => id)).toEqual(['INC-101', 'INC-102']);
  });

  it('pads IDs to three digits and starts at 1 on an empty desk', async () => {
    expect((await writable([]).create(draft)).id).toBe('INC-001');
  });

  it('saves the store atomically, creating its folder, and reopens it', async () => {
    const created = await writable().create(draft);
    expect(await readStore()).toEqual({
      nextId: 103,
      incidents: [incident({ id: 'INC-101' }), created],
    });
    await expect(readFile(`${storePath}.tmp`)).rejects.toThrow(/ENOENT/);

    const reopened = await IncidentRepository.open({
      fixturePath: FIXTURE_PATH,
      storePath,
      writeEnabled: true,
      clock,
    });
    expect((await reopened.create(draft)).id).toBe('INC-103');
  });

  it('never writes the fixture', async () => {
    const before = await readFile(FIXTURE_PATH, 'utf8');
    const repository = await IncidentRepository.open({
      fixturePath: FIXTURE_PATH,
      storePath,
      writeEnabled: true,
    });
    await repository.create(draft);
    expect(await readFile(FIXTURE_PATH, 'utf8')).toBe(before);
  });

  it('serializes concurrent creations without reusing IDs', async () => {
    const repository = writable();
    const created = await Promise.all([1, 2, 3].map(() => repository.create(draft)));
    expect(created.map(({ id }) => id)).toEqual(['INC-102', 'INC-103', 'INC-104']);
    expect((await readStore()).incidents).toHaveLength(4);
  });

  it('refuses to write in read-only mode', async () => {
    const repository = new IncidentRepository([], { storePath });
    await expect(repository.create(draft)).rejects.toMatchObject({ code: 'WRITE_DISABLED' });
  });

  it('validates before writing', async () => {
    const repository = writable();
    await expect(repository.create({ ...draft, title: ' ' })).rejects.toMatchObject({
      code: 'VALIDATION_ERROR',
    });
    expect(repository.all()).toHaveLength(1);
  });

  it('reports PERSISTENCE_ERROR and changes nothing if the store cannot be written', async () => {
    const blocker = await write('blocker', 'not a folder');
    const repository = new IncidentRepository([incident({ id: 'INC-101' })], {
      storePath: join(blocker, 'tickets.local.json'),
      writeEnabled: true,
    });
    await expect(repository.create(draft)).rejects.toMatchObject({
      code: 'PERSISTENCE_ERROR',
      message: expect.stringMatching(/^PERSISTENCE_ERROR: No se pudo guardar el almacén/),
    });
    expect(repository.all()).toHaveLength(1);
    expect(() => repository.getById('INC-102')).toThrow(/NOT_FOUND/);
  });

  it('keeps working after a failed write', async () => {
    const repository = writable();
    await mkdir(`${storePath}.tmp`, { recursive: true }); // makes the temp write fail
    await expect(repository.create(draft)).rejects.toMatchObject({ code: 'PERSISTENCE_ERROR' });
    await rm(`${storePath}.tmp`, { recursive: true });
    expect((await repository.create(draft)).id).toBe('INC-102');
  });
});

describe('IncidentRepository.update', () => {
  it('changes only the given fields, trimmed, and bumps the revision', async () => {
    const repository = writable([incident({ id: 'INC-101' }), incident({ id: 'INC-102' })]);
    const updated = await repository.update('INC-101', 1, {
      title: '  Otro título ',
      workaround: true,
    });
    expect(updated).toEqual(
      incident({ id: 'INC-101', title: 'Otro título', workaround: true, revision: 2 }),
    );
    expect(repository.getById('INC-101')).toEqual(updated);
    expect(repository.all().map(({ id }) => id)).toEqual(['INC-101', 'INC-102']);
    expect(await readStore()).toEqual({
      nextId: 103,
      incidents: [updated, incident({ id: 'INC-102' })],
    });
  });

  it('keeps the ID sequence for later creations', async () => {
    const repository = writable();
    await repository.update('INC-101', 1, { impact: 'alto' });
    expect((await repository.create(draft)).id).toBe('INC-102');
  });

  it('rejects a stale revision without changing anything', async () => {
    const repository = writable();
    await repository.update('INC-101', 1, { detail: 'Primero' });
    await expect(repository.update('INC-101', 1, { detail: 'Segundo' })).rejects.toMatchObject({
      code: 'REVISION_CONFLICT',
      message: expect.stringContaining('su revisión actual es 2, no 1'),
    });
    expect(repository.getById('INC-101')).toMatchObject({ detail: 'Primero', revision: 2 });
  });

  it('lets only one of two concurrent edits of the same revision win', async () => {
    const repository = writable();
    const results = await Promise.allSettled([
      repository.update('INC-101', 1, { title: 'A' }),
      repository.update('INC-101', 1, { title: 'B' }),
    ]);
    expect(results.map(({ status }) => status)).toEqual(['fulfilled', 'rejected']);
    expect(repository.getById('INC-101')).toMatchObject({ title: 'A', revision: 2 });
  });

  it('throws NOT_FOUND for an unknown ID', async () => {
    await expect(writable().update('INC-999', 1, { impact: 'alto' })).rejects.toMatchObject({
      code: 'NOT_FOUND',
    });
  });

  it('refuses to write in read-only mode', async () => {
    const repository = new IncidentRepository([incident()], { storePath });
    await expect(repository.update('INC-001', 1, { impact: 'alto' })).rejects.toMatchObject({
      code: 'WRITE_DISABLED',
    });
  });

  it('validates before writing', async () => {
    const repository = writable();
    await expect(repository.update('INC-101', 1, {})).rejects.toMatchObject({
      code: 'VALIDATION_ERROR',
    });
    await expect(repository.update('INC-101', 1, { detail: '  ' })).rejects.toMatchObject({
      code: 'VALIDATION_ERROR',
    });
    expect(repository.getById('INC-101').revision).toBe(1);
  });

  it('reports PERSISTENCE_ERROR and changes nothing if the store cannot be written', async () => {
    const repository = writable();
    await mkdir(`${storePath}.tmp`, { recursive: true });
    await expect(repository.update('INC-101', 1, { title: 'Nuevo' })).rejects.toMatchObject({
      code: 'PERSISTENCE_ERROR',
    });
    expect(repository.getById('INC-101')).toEqual(incident({ id: 'INC-101' }));
  });
});

describe('IncidentRepository.changeStatus', () => {
  it('moves the incident, bumps the revision and returns the previous status', async () => {
    const repository = writable();
    const change = await repository.changeStatus('INC-101', 1, 'en_progreso');
    expect(change).toEqual({
      incident: incident({ id: 'INC-101', status: 'en_progreso', revision: 2 }),
      previousStatus: 'abierta',
    });
    expect(repository.getById('INC-101')).toEqual(change.incident);
    expect((await readStore()).incidents).toEqual([change.incident]);
  });

  it('reopens a resolved incident only with a reason', async () => {
    const repository = writable([incident({ id: 'INC-101', status: 'resuelta' })]);
    await expect(repository.changeStatus('INC-101', 1, 'abierta')).rejects.toMatchObject({
      code: 'REASON_REQUIRED',
    });
    const { incident: reopened } = await repository.changeStatus(
      'INC-101',
      1,
      'abierta',
      '  Ha vuelto a fallar ',
    );
    expect(reopened).toMatchObject({ status: 'abierta', revision: 2 });
  });

  it('rejects a transition that is not allowed without changing anything', async () => {
    const repository = writable([incident({ id: 'INC-101', status: 'resuelta' })]);
    await expect(repository.changeStatus('INC-101', 1, 'en_progreso', 'x')).rejects.toMatchObject({
      code: 'INVALID_TRANSITION',
    });
    expect(repository.getById('INC-101')).toMatchObject({ status: 'resuelta', revision: 1 });
  });

  it('rejects a stale revision', async () => {
    const repository = writable();
    await repository.changeStatus('INC-101', 1, 'en_progreso');
    await expect(repository.changeStatus('INC-101', 1, 'resuelta')).rejects.toMatchObject({
      code: 'REVISION_CONFLICT',
    });
  });

  it('validates the reason before writing', async () => {
    const repository = writable();
    await expect(repository.changeStatus('INC-101', 1, 'resuelta', '  ')).rejects.toMatchObject({
      code: 'VALIDATION_ERROR',
    });
    expect(repository.getById('INC-101').status).toBe('abierta');
  });

  it('refuses to write in read-only mode', async () => {
    const repository = new IncidentRepository([incident()], { storePath });
    await expect(repository.changeStatus('INC-001', 1, 'resuelta')).rejects.toMatchObject({
      code: 'WRITE_DISABLED',
    });
  });
});

describe('IncidentRepository.delete', () => {
  const deletable = (incidents = [incident({ id: 'INC-101' }), incident({ id: 'INC-102' })]) =>
    new IncidentRepository(incidents, { storePath, writeEnabled: true, deleteEnabled: true });

  it('needs both writes and deletion enabled', () => {
    expect(writable().deleteEnabled).toBe(false);
    expect(deletable().deleteEnabled).toBe(true);
    expect(new IncidentRepository([], { deleteEnabled: true }).deleteEnabled).toBe(false);
  });

  it('removes the incident for good without reusing its ID', async () => {
    const repository = deletable();
    const deleted = await repository.delete('INC-102', 'Duplicada');
    expect(deleted).toEqual(incident({ id: 'INC-102' }));
    expect(() => repository.getById('INC-102')).toThrow(/NOT_FOUND/);
    expect(await readStore()).toEqual({ nextId: 103, incidents: [incident({ id: 'INC-101' })] });
    expect((await repository.create(draft)).id).toBe('INC-103');
  });

  it('checks without deleting', () => {
    const repository = deletable();
    expect(repository.checkDeletable('INC-101', 'Duplicada')).toEqual(incident({ id: 'INC-101' }));
    expect(repository.all()).toHaveLength(2);
  });

  it.each([
    [{ writeEnabled: false, deleteEnabled: true }, 'WRITE_DISABLED'],
    [{ writeEnabled: true, deleteEnabled: false }, 'DELETE_DISABLED'],
  ])('refuses with %o', async (flags, code) => {
    const repository = new IncidentRepository([incident()], { storePath, ...flags });
    await expect(repository.delete('INC-001', 'x')).rejects.toMatchObject({ code });
    expect(repository.all()).toHaveLength(1);
  });

  it('validates the reason and the ID', async () => {
    const repository = deletable();
    await expect(repository.delete('INC-101', '  ')).rejects.toMatchObject({
      code: 'VALIDATION_ERROR',
    });
    await expect(repository.delete('INC-999', 'x')).rejects.toMatchObject({ code: 'NOT_FOUND' });
  });

  it('lets only one of two concurrent deletions succeed', async () => {
    const repository = deletable();
    const results = await Promise.allSettled([
      repository.delete('INC-101', 'x'),
      repository.delete('INC-101', 'x'),
    ]);
    expect(results.map(({ status }) => status)).toEqual(['fulfilled', 'rejected']);
    expect(repository.all().map(({ id }) => id)).toEqual(['INC-102']);
  });

  it('reports PERSISTENCE_ERROR and keeps the incident if the store cannot be written', async () => {
    const repository = deletable();
    await mkdir(`${storePath}.tmp`, { recursive: true });
    await expect(repository.delete('INC-101', 'x')).rejects.toMatchObject({
      code: 'PERSISTENCE_ERROR',
    });
    expect(repository.all()).toHaveLength(2);
  });
});

describe('localIsoDate', () => {
  it('formats the local calendar date with zero padding', () => {
    expect(localIsoDate(new Date(2026, 0, 5, 0, 1))).toBe('2026-01-05');
  });
});
