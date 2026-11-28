import { readFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { type Harness, startHarness, tempDir } from '../helpers/harness.js';

type Message = Awaited<ReturnType<Harness['client']['getPrompt']>>['messages'][number];

function textOf(message: Message | undefined): string {
  if (message?.content.type !== 'text') throw new Error('expected a text message');
  return message.content.text;
}

describe('abrir_incidencia', () => {
  let harness: Harness | undefined;
  let emptyDir: string | undefined;

  afterEach(async () => {
    await harness?.close();
    if (emptyDir) await rm(emptyDir, { recursive: true, force: true });
    harness = emptyDir = undefined;
    vi.restoreAllMocks();
  });

  it('is listed with title, description and an optional problema argument', async () => {
    harness = await startHarness();
    const { prompts } = await harness.client.listPrompts();
    expect(prompts).toEqual([
      expect.objectContaining({
        name: 'abrir_incidencia',
        title: 'Abrir incidencia',
        description: expect.stringContaining('duplicados'),
        arguments: [
          expect.objectContaining({
            name: 'problema',
            description: 'Descripción libre del problema a registrar',
            required: false,
          }),
        ],
      }),
    ]);
  });

  it('embeds docs://proceso_apertura and includes the problem', async () => {
    harness = await startHarness({ writeEnabled: true });
    const result = await harness.client.getPrompt({
      name: 'abrir_incidencia',
      arguments: { problema: '  No funciona la impresora  ' },
    });

    const [document, instructions, ...rest] = result.messages;
    expect(rest).toEqual([]);
    expect(document).toEqual({
      role: 'user',
      content: {
        type: 'resource',
        resource: {
          uri: 'docs://proceso_apertura',
          mimeType: 'text/markdown',
          text: await readFile(join(harness.docsDirectory, 'proceso_apertura.md'), 'utf8'),
        },
      },
    });
    const text = textOf(instructions);
    expect(text).toContain('Problema: No funciona la impresora\n');
    expect(text).toContain('buscar_incidencias');
    expect(text).toContain('docs://proceso_triaje');
    expect(text).toContain('espera mi confirmación');
    expect(text).toContain('llama a crear_incidencia');
  });

  it.each([{}, { problema: '   ' }])(
    'asks for the problem when it is missing (%o)',
    async (args) => {
      harness = await startHarness();
      const result = await harness.client.getPrompt({ name: 'abrir_incidencia', arguments: args });
      expect(textOf(result.messages[1])).toContain('Pregúntame primero');
    },
  );

  it('does not ask to create the incident in read-only mode', async () => {
    harness = await startHarness();
    const result = await harness.client.getPrompt({
      name: 'abrir_incidencia',
      arguments: { problema: 'VPN caída' },
    });
    const text = textOf(result.messages[1]);
    expect(text).toContain('no llames a crear_incidencia');
    expect(text).toContain('MESA_INCIDENCIAS_WRITE_ENABLED=1');
  });

  it('rejects an overly long problem', async () => {
    harness = await startHarness();
    const get = harness.client.getPrompt({
      name: 'abrir_incidencia',
      arguments: { problema: 'x'.repeat(5001) },
    });
    await expect(get).rejects.toMatchObject({ code: -32602 });
  });

  it('fails with an internal protocol error if the document is missing', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    emptyDir = await tempDir();
    harness = await startHarness({ docsDirectory: emptyDir });
    const get = harness.client.getPrompt({ name: 'abrir_incidencia' });
    await expect(get).rejects.toMatchObject({
      code: -32603,
      message: expect.stringContaining('No se pudo leer el documento docs://proceso_apertura'),
    });
    await expect(get).rejects.not.toThrow(emptyDir);
  });
});
