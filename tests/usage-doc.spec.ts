import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { join } from 'node:path';

import { describe, expect, it } from 'vitest';

import { extractDiagrams } from '../server/lib/diagrams';

/**
 * Экран «Как пользоваться» показывает этот файл. Пустая или битая инструкция
 * означала бы пустой экран — а инструмент, который не объясняет себя, объяснять
 * чужие проекты тоже не поможет.
 */

const root = fileURLToPath(new URL('..', import.meta.url));
const path = join(root, 'docs', '08-usage.md');

describe('docs/08-usage.md', () => {
  it('существует и не пуст', () => {
    expect(existsSync(path)).toBe(true);
    expect(readFileSync(path, 'utf8').length).toBeGreaterThan(2000);
  });

  const text = readFileSync(path, 'utf8');

  it('front matter не имеет: это документация инструмента, а не запись проекта', () => {
    expect(text.startsWith('---')).toBe(false);
  });

  it('диаграммы в нём разбираются: экран рисует их как есть', () => {
    const diagrams = extractDiagrams(text);
    expect(diagrams.length).toBeGreaterThan(0);
    expect(diagrams.every((diagram) => !diagram.error)).toBe(true);
  });

  it('ссылки на соседние документы ведут в существующие файлы', () => {
    const links = [...text.matchAll(/\]\(([^)]+\.md)\)/g)].map((match) => match[1] as string);
    expect(links.length).toBeGreaterThan(0);

    const broken = links.filter((link) => !existsSync(join(root, 'docs', link)));
    expect(broken).toEqual([]);
  });

  it('назван в оглавлении README', () => {
    expect(readFileSync(join(root, 'README.md'), 'utf8')).toContain('docs/08-usage.md');
  });
});
