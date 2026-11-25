import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { PROCESS_DOCUMENTS } from '../../src/mcp/resources/process-documents.js';
import { type Harness, startHarness } from '../helpers/harness.js';

describe('process documents', () => {
  let harness: Harness | undefined;
  let emptyDir: string | undefined;

  afterEach(async () => {
    await harness?.close();
    if (emptyDir) await rm(emptyDir, { recursive: true, force: true });
    harness = emptyDir = undefined;
    vi.restoreAllMocks();
  });

  it('are listed as Markdown resources with title and description', async () => {
    harness = await startHarness();
    const { resources } = await harness.client.listResources();
    expect(resources).toEqual(
      PROCESS_DOCUMENTS.map(({ name, title, description }) =>
        expect.objectContaining({
          uri: `docs://${name}`,
          name,
          title,
          description,
          mimeType: 'text/markdown',
        }),
      ),
    );
  });

  it.each(PROCESS_DOCUMENTS.map(({ name }) => name))(
    'docs://%s returns the file content',
    async (name) => {
      harness = await startHarness();
      const { contents } = await harness.client.readResource({ uri: `docs://${name}` });
      expect(contents).toEqual([
        {
          uri: `docs://${name}`,
          mimeType: 'text/markdown',
          text: await readFile(join(harness.docsDirectory, `${name}.md`), 'utf8'),
        },
      ]);
    },
  );

  it('fails with an internal protocol error, without leaking paths, if the file is missing', async () => {
    const stderr = vi.spyOn(console, 'error').mockImplementation(() => {});
    emptyDir = await mkdtemp(join(tmpdir(), 'docs-'));
    harness = await startHarness({ docsDirectory: emptyDir });

    const read = harness.client.readResource({ uri: 'docs://proceso_triaje' });

    await expect(read).rejects.toMatchObject({
      code: -32603,
      message: expect.stringContaining('No se pudo leer el documento docs://proceso_triaje'),
    });
    await expect(read).rejects.not.toThrow(emptyDir);
    expect(stderr).toHaveBeenCalledWith(
      'No se pudo leer el documento docs://proceso_triaje:',
      expect.objectContaining({ code: 'ENOENT' }),
    );
  });
});
