import type { ToolAnnotations } from '@modelcontextprotocol/server';

/** Hints for read-only tools over local data. */
export const READ_ONLY_ANNOTATIONS = {
  readOnlyHint: true,
  destructiveHint: false,
  idempotentHint: true,
  openWorldHint: false,
} as const satisfies ToolAnnotations;
