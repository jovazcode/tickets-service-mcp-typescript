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

describe('localIsoDate', () => {
  it('formats the local calendar date with zero padding', () => {
    expect(localIsoDate(new Date(2026, 0, 5, 0, 1))).toBe('2026-01-05');
  });
});
