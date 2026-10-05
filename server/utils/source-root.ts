import { resolve } from 'node:path';

import { BUILTIN_SOURCE } from '../lib/builtin';
import { normalizeRoot } from '../lib/paths';

/**
 * Корень источника практик: путь `builtin` — каталог `practices/` в корне
 * приложения (ADR-0015), остальное — свой отдельный корень, как раньше.
 */
export function sourceRoot(path: string): string {
  return path === BUILTIN_SOURCE ? normalizeRoot(resolve(process.cwd(), 'practices')) : normalizeRoot(path);
}
