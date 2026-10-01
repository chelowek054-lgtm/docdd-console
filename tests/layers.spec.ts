import { describe, expect, it } from 'vitest';

import { NO_LAYER, layerOf } from '../server/lib/layers';

/**
 * Слой модуля по папке файла (docs/07-maps.md, «`layer` не обязателен»).
 */

describe('layerOf', () => {
  it('объявленный в карте слой всегда сильнее папки', () => {
    expect(layerOf({ id: 'server/lib/maps.ts', layer: 'ядро' })).toBe('ядро');
  });

  it('нет слоя — берётся папка файла', () => {
    expect(layerOf({ id: 'code/frontend/app/pages/login.vue' })).toBe('pages');
    expect(layerOf({ id: 'a', path: 'server/lib/maps.ts' })).toBe('lib');
    expect(layerOf({ id: 'code/frontend/app/entities/session/model/types.ts' })).toBe('model');
  });

  it('index.ts и __init__.py — это сама папка, берётся папка над ней', () => {
    expect(layerOf({ id: 'code/backend/src/interactmed/modules/access/__init__.py' })).toBe('modules');
    expect(layerOf({ id: 'code/frontend/app/widgets/concept-card/index.ts' })).toBe('widgets');
    expect(layerOf({ id: 'code/frontend/app/shared/api/index.ts' })).toBe('shared');
  });

  it('path важнее id: id может быть логическим именем', () => {
    expect(layerOf({ id: 'maps-core', path: 'app/widgets/maps/index.ts' })).toBe('widgets');
  });

  it('dotted-имя пакета: предпоследний сегмент', () => {
    expect(layerOf({ id: 'gastrograf.catalog.usda' })).toBe('catalog');
    expect(layerOf({ id: 'pkg.mod.__init__' })).toBe('pkg');
  });

  it('папки нет вовсе — «без слоя»', () => {
    expect(layerOf({ id: 'nuxt.config.ts', path: 'nuxt.config.ts' })).toBe(NO_LAYER);
    expect(layerOf({ id: 'standalone' })).toBe(NO_LAYER);
    expect(layerOf({ id: 'index.ts', path: 'index.ts' })).toBe(NO_LAYER);
    expect(layerOf({ id: 'pages/index.ts' })).toBe(NO_LAYER);
  });
});
