import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { IncidentRepository } from '../../src/store/incident-repository.js';
import { incident } from '../fixtures.js';
import { loadFixture } from '../helpers/harness.js';

describe('IncidentRepository', () => {
  let dir: string;

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), 'incidents-'));
  });

  afterEach(async () => {
    await rm(dir, { recursive: true, force: true });
  });

  async function write(content: string): Promise<string> {
    const path = join(dir, 'tickets.json');
    await writeFile(path, content);
    return path;
  }

  it('loads the fixture in file order', async () => {
    const ids = (await loadFixture()).all().map(({ id }) => id);
    expect(ids).toEqual(['INC-101', 'INC-102', 'INC-103', 'INC-104']);
  });

  it('rejects duplicate IDs', () => {
    expect(() => new IncidentRepository([incident(), incident()])).toThrow('ID duplicado: INC-001');
  });

  it('exposes an immutable list', () => {
    const all = new IncidentRepository([incident()]).all();
    expect(Object.isFrozen(all)).toBe(true);
  });

  it('rejects a file that is not an array of incidents', async () => {
    const path = await write(JSON.stringify({ incidents: [] }));
    await expect(IncidentRepository.load(path)).rejects.toThrow(/Incidencias no válidas/);
  });

  it('rejects an invalid incident', async () => {
    const path = await write(JSON.stringify([{ ...incident(), status: 'cerrada' }]));
    await expect(IncidentRepository.load(path)).rejects.toThrow(/status/);
  });

  it('rejects invalid JSON', async () => {
    const path = await write('{');
    await expect(IncidentRepository.load(path)).rejects.toThrow(SyntaxError);
  });

  it('rejects a missing file', async () => {
    await expect(IncidentRepository.load(join(dir, 'missing.json'))).rejects.toThrow(/ENOENT/);
  });
});
