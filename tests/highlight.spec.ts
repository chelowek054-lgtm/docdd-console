import { describe, expect, it } from 'vitest';

import { highlightCode, languageOf } from '../app/utils/highlight';

/**
 * Подсветка — украшение: код должен показаться в любом случае, поэтому
 * проверяется, что незнакомое расширение и битый ввод не роняют вывод, а
 * дают те же строки одним куском (app/utils/highlight.ts).
 */

describe('languageOf', () => {
  it('узнаёт язык по расширению', () => {
    expect(languageOf('server/lib/maps.ts')).toBe('typescript');
    expect(languageOf('backend/gastrograf/config.py')).toBe('python');
    expect(languageOf('app/pages/index.vue')).toBe('vue');
    expect(languageOf('docs/07-maps.md')).toBe('markdown');
  });

  it('незнакомое расширение — без подсветки', () => {
    expect(languageOf('Makefile')).toBeNull();
    expect(languageOf('data.bin')).toBeNull();
  });
});

describe('highlightCode', () => {
  it('незнакомый язык — строки одним токеном, без потери текста', async () => {
    const lines = await highlightCode('первая\nвторая', 'notes.txt', false);
    expect(lines).toEqual([[{ content: 'первая' }], [{ content: 'вторая' }]]);
  });

  it('известный язык — токены с цветом, текст строки сохранён целиком', async () => {
    const lines = await highlightCode('const x = 1;', 'a.ts', false);
    expect(lines.map((tokens) => tokens.map((token) => token.content).join(''))).toEqual(['const x = 1;']);
    expect(lines[0]?.some((token) => token.color)).toBe(true);
  });
}, 20_000);
