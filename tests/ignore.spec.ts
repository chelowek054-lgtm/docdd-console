import { describe, expect, it } from 'vitest';

import { isIgnored, parseGitignore } from '../server/lib/ignore';

/**
 * Опись кода не должна спрашивать про сборочный мусор, который сам проект
 * уже назвал не своим кодом в `.gitignore` (docs/07-maps.md).
 */

describe('parseGitignore', () => {
  it('отбрасывает пустые строки и комментарии', () => {
    expect(parseGitignore('__pycache__/\n\n# комментарий\n*.pyc')).toEqual(['__pycache__/', '*.pyc']);
  });

  it('отбрасывает отрицания и правила с путём внутри — не полный движок', () => {
    expect(parseGitignore('!keep.txt\nsrc/generated/\nnode_modules/')).toEqual(['node_modules/']);
  });
});

describe('isIgnored', () => {
  it('правило с `/` подходит только папке', () => {
    expect(isIgnored(['__pycache__/'], '__pycache__', true)).toBe(true);
    expect(isIgnored(['__pycache__/'], '__pycache__', false)).toBe(false);
  });

  it('правило без `/` подходит и файлу, и папке с таким именем', () => {
    expect(isIgnored(['dist'], 'dist', true)).toBe(true);
    expect(isIgnored(['dist'], 'dist', false)).toBe(true);
  });

  it('`*` — маска по расширению', () => {
    expect(isIgnored(['*.pyc'], 'nutrition.cpython-312.pyc', false)).toBe(true);
    expect(isIgnored(['*.pyc'], 'nutrition.py', false)).toBe(false);
  });

  it('обычный код мимо правил не попадает', () => {
    expect(isIgnored(['__pycache__/', '*.pyc', '.pytest_cache/'], 'nutrition.py', false)).toBe(false);
  });
});
