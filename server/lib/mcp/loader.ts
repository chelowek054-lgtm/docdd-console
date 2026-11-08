import { existsSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

import type { McpTool } from './types';

function isTool(value: unknown): value is McpTool {
  const tool = value as Partial<McpTool> | null;
  return typeof tool?.name === 'string' && typeof tool.run === 'function' && (tool.access === 'read' || tool.access === 'write');
}

/**
 * Инструменты лежат в `<модуль>/tools/*.ts` и находятся обходом каталога:
 * новый инструмент — новый файл модуля, сервер править не надо (R-0113).
 */
export async function loadTools(libDir: string): Promise<McpTool[]> {
  const found: McpTool[] = [];
  for (const entry of readdirSync(libDir, { withFileTypes: true })) {
    if (!entry.isDirectory()) continue;
    const dir = join(libDir, entry.name, 'tools');
    if (!existsSync(dir)) continue;
    for (const file of readdirSync(dir).sort()) {
      if (!/\.[cm]?[jt]s$/.test(file) || file.endsWith('.d.ts')) continue;
      const loaded = (await import(pathToFileURL(join(dir, file)).href)) as { default?: unknown };
      if (!isTool(loaded.default)) throw new Error(`${entry.name}/tools/${file}: нет инструмента в экспорте по умолчанию`);
      found.push(loaded.default);
    }
  }
  return found;
}
