/**
 * Слой модуля для экрана кодовой карты (docs/07-maps.md, «`layer` не
 * обязателен»). Чистая функция: объявленный в карте слой всегда сильнее, а нет
 * его — слой берётся прямо из папки файла, как проект сам называет слои
 * описанных модулей. В карту выведенный слой не записывается.
 */

/** Папки нет вовсе: файл в корне проекта или голое имя без разделителей. */
export const NO_LAYER = 'без слоя';

/** `index.ts` и `__init__.py` — это сама их папка, а не файл внутри неё. */
const STANDS_FOR_FOLDER = /^(index|__init__)(\.|$)/;

export interface LayeredModule {
  id: string;
  path?: string;
  layer?: string;
}

export function layerOf(module: LayeredModule): string {
  if (module.layer) return module.layer;

  const source = module.path ?? module.id;
  // dotted-имя пакета (`gastrograf.catalog.usda`): нет path и нет слеша в id.
  const dotted = module.path === undefined && !source.includes('/');
  const parts = source.split(dotted ? '.' : '/').filter(Boolean);

  const file = parts.pop();
  if (file === undefined) return NO_LAYER;
  if (STANDS_FOR_FOLDER.test(file)) parts.pop();

  return parts.at(-1) ?? NO_LAYER;
}
