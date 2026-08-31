import { realpathSync } from 'node:fs';
import { isAbsolute, join, normalize, relative, resolve, sep } from 'node:path';

/**
 * Единственное место, где решается, можно ли трогать путь. Сервер работает
 * только внутри объявленного корня проекта: любой путь за его пределы — отказ,
 * без исключений (docs/01-architecture.md, раздел «Безопасность»).
 */

export class OutsideRootError extends Error {
  constructor(readonly requested: string, readonly root: string) {
    super(`Путь \`${requested}\` лежит за пределами корня проекта \`${root}\`. Сервер читает только внутри корня.`);
    this.name = 'OutsideRootError';
  }
}

/** Корень приводится к абсолютному и разворачивается: сравнивать надо реальные пути. */
export function normalizeRoot(root: string): string {
  const absolute = resolve(root);
  try {
    return realpathSync.native(absolute);
  } catch {
    // Корня может не быть — об этом скажет чтение манифеста, а не проверка пути.
    return absolute;
  }
}

/**
 * Путь внутри корня. Принимает только относительный путь без выхода наверх:
 * абсолютный путь из браузера — всегда ошибка, а `..` не разворачивается даже
 * если после нормализации он вернулся бы внутрь.
 */
export function resolveInside(root: string, relativePath: string): string {
  if (isAbsolute(relativePath) || /^[a-zA-Z]:/.test(relativePath)) {
    throw new OutsideRootError(relativePath, root);
  }
  if (relativePath.split(/[\\/]/).includes('..')) {
    throw new OutsideRootError(relativePath, root);
  }

  const normalizedRoot = normalizeRoot(root);
  const target = normalize(join(normalizedRoot, relativePath));
  if (!isInside(normalizedRoot, target)) {
    throw new OutsideRootError(relativePath, root);
  }

  // Символическая ссылка наружу не разворачивается: проверяем то, куда она ведёт.
  try {
    const real = realpathSync.native(target);
    if (!isInside(normalizedRoot, real)) throw new OutsideRootError(relativePath, root);
  } catch (error) {
    if (error instanceof OutsideRootError) throw error;
    // Файла ещё нет — это не нарушение границы, а отсутствие файла.
  }

  return target;
}

/** Путь относительно корня, всегда через прямой слеш: он уходит в JSON и в UI. */
export function toProjectPath(root: string, absolute: string): string {
  return relative(normalizeRoot(root), absolute).split(sep).join('/');
}

function isInside(root: string, target: string): boolean {
  if (target === root) return true;
  const step = relative(root, target);
  return step !== '' && !step.startsWith('..') && !isAbsolute(step);
}
