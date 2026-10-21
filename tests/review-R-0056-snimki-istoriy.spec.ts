// V-0056
import { describe, expect, it } from 'vitest';

import type { DesignComponent } from '../server/lib/design';
import { buildCatalogReport, REFERENCE_STACK } from '../server/lib/design-catalog';
import { snapshotPath, storyPairLines, storyPairs, withStoryPairs, STORIES_MARKER } from '../server/lib/design-port';

/**
 * Проверка по тексту R-0056: запрос Pixel-Perfect принимает пару «эталон
 * истории — снимок стека»; консоль снимков не делает, только описывает те,
 * что положил CI (`<каталог>/<стек>/<id истории>.<расширение>`).
 */

const cat = (id: string, name: string) => JSON.stringify({ entries: { [id]: { id, type: 'story', title: 'Button', name } } });
const button: DesignComponent = { name: 'Button', states: ['disabled'] };
const report = buildCatalogReport([button], [
  { stack: REFERENCE_STACK, label: 'Storybook', path: 'a', text: cat('b--disabled', 'Disabled') },
  { stack: 'expo', label: 'Expo', path: 'b', text: cat('e--disabled', 'Disabled') },
  { stack: 'compose', label: 'Compose', path: 'c', text: cat('c--other', 'Other') }
]);

describe('путь снимка', () => {
  it('каталог/стек/id.расширение; допустимы png, jpg, jpeg, webp; нет файла — null', () => {
    const files = new Set(['snaps/expo/e--disabled.webp']);
    expect(snapshotPath('snaps/', 'expo', 'e--disabled', files)).toBe('snaps/expo/e--disabled.webp');
    expect(snapshotPath('snaps', 'expo', 'e--x', files)).toBeNull();
    expect(snapshotPath('snaps\\', 'expo', 'e--disabled', new Set(['snaps/expo/e--disabled.png']))).toBe('snaps/expo/e--disabled.png');
    expect(snapshotPath('snaps', 'expo', 'e--disabled', new Set(['snaps/expo/e--disabled.gif']))).toBeNull();
  });
});

describe('пары эталон — снимок', () => {
  it('пара только там, где история есть и в опорном каталоге, и на стеке', () => {
    const pairs = storyPairs(report, 'snaps', new Set());
    expect(pairs.map((p) => `${p.stack}/${p.item}`)).toEqual(['expo/disabled']);
  });

  it('эталон и снимок стека находятся по соглашению; чего нет — null', () => {
    const files = new Set(['snaps/storybook/b--disabled.png', 'snaps/expo/e--disabled.png']);
    expect(storyPairs(report, 'snaps', files)[0]).toMatchObject({
      reference: { story: 'b--disabled', shot: 'snaps/storybook/b--disabled.png' },
      port: { story: 'e--disabled', shot: 'snaps/expo/e--disabled.png' }
    });
    expect(storyPairs(report, 'snaps', new Set(['snaps/expo/e--disabled.png']))[0]!.reference.shot).toBeNull();
  });

  it('без опорного каталога пар нет', () => {
    const noRef = buildCatalogReport([button], [{ stack: 'expo', label: 'Expo', path: 'b', text: cat('e--disabled', 'Disabled') }]);
    expect(storyPairs(noRef, 'snaps', new Set())).toEqual([]);
  });
});

describe('запрос Pixel-Perfect', () => {
  const tpl = `до\n${STORIES_MARKER}\nпосле`;
  it('метка заменяется описью пар, недостающий снимок назван', () => {
    const full = withStoryPairs(tpl, storyPairs(report, 'snaps', new Set(['snaps/storybook/b--disabled.png', 'snaps/expo/e--disabled.png'])));
    expect(full).toContain('`snaps/storybook/b--disabled.png`');
    expect(full).toContain('`snaps/expo/e--disabled.png`');
    expect(full).not.toContain(STORIES_MARKER);
    const part = withStoryPairs(tpl, storyPairs(report, 'snaps', new Set(['snaps/expo/e--disabled.png'])));
    expect(part).toContain('эталона нет');
    expect(withStoryPairs(tpl, storyPairs(report, 'snaps', new Set()))).toContain('снимка нет');
  });

  it('пар нет — одна строка о пропуске; без метки запрос не меняется', () => {
    expect(storyPairLines([])).toContain('пропусти');
    expect(withStoryPairs('без метки', [])).toBe('без метки');
  });

  it('шаблон Pixel-Perfect действительно содержит метку', async () => {
    const { readFileSync } = await import('node:fs');
    expect(readFileSync(new URL('../docs/prompts/design-pixel-perfect.md', import.meta.url), 'utf8')).toContain(STORIES_MARKER);
  });
});
