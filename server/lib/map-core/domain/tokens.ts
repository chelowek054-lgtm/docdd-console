/**
 * Цветовые группы карт (A-0010, п. 5; R-0143). Узел получает цвет по виду из стандарта, в записи цвет
 * не пишется. Значения — для светлой и тёмной темы; каждое держит AA (4,5:1) на фоне страницы и
 * карточки своей темы — это проверяет тест.
 */
export type MapTokenGroup = 'ddd' | 'layer' | 'infra' | 'ui' | 'external' | 'strategy';

export interface MapToken {
  group: MapTokenGroup;
  light: string;
  dark: string;
}

export const MAP_TOKENS = {
  'map-capability': { group: 'strategy', light: '#4338ca', dark: '#a5b4fc' },
  'map-person': { group: 'ui', light: '#047857', dark: '#6ee7b7' },
  'map-ddd': { group: 'ddd', light: '#6d28d9', dark: '#c4b5fd' },
  'map-ddd-strong': { group: 'ddd', light: '#5b21b6', dark: '#ddd6fe' },
  'map-layer-domain': { group: 'layer', light: '#1d4ed8', dark: '#93c5fd' },
  'map-layer-application': { group: 'layer', light: '#0369a1', dark: '#7dd3fc' },
  'map-layer-interface': { group: 'layer', light: '#0e7490', dark: '#67e8f9' },
  'map-layer-infrastructure': { group: 'layer', light: '#0f766e', dark: '#5eead4' },
  'map-infra': { group: 'infra', light: '#c2410c', dark: '#fdba74' },
  'map-ui': { group: 'ui', light: '#15803d', dark: '#86efac' },
  'map-external': { group: 'external', light: '#4b5563', dark: '#cbd5e1' }
} as const satisfies Record<string, MapToken>;

export type MapTokenName = keyof typeof MAP_TOKENS;

/** Фоны, на которых стоит цвет узла: страница и карточка каждой темы. */
export const MAP_BACKGROUNDS = { light: ['#ffffff', '#f8fafc'], dark: ['#0f172a', '#1e293b'] } as const;

export function isMapToken(value: unknown): value is MapTokenName {
  return typeof value === 'string' && Object.prototype.hasOwnProperty.call(MAP_TOKENS, value);
}

export function tokenColor(name: string, theme: 'light' | 'dark'): string | null {
  return isMapToken(name) ? MAP_TOKENS[name][theme] : null;
}
